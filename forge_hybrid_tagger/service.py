"""Analysis jobs shared by the tab's local HTTP routes."""

from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from hashlib import sha256
from pathlib import Path
from threading import Event, Lock
from uuid import uuid4
import logging

from . import MODELS, MODES, TaggerError
from .inference import analyze, decode_image, ort_runtime
from .models import ModelStore
from .saved_results import SavedResults
from .sessions import ModelSessions


TERMINAL = {"done", "failed", "cancelled"}
TRANSFER_STATES = {"checking", "downloading", "verifying"}
TRANSIENT_AUTO_FALLBACKS = {"cuda_memory", "cuda_oom"}
MAX_JOBS = 12
MAX_PENDING = 4
MAX_RESULT_CACHE = 8
logger = logging.getLogger(__name__)


class AnalysisService:
    def __init__(self, root, shared_root, gpu_lock, cache_path=None):
        self.models = ModelStore(root, shared_root)
        self.gpu_lock = gpu_lock
        self.pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="image-tagger-analysis")
        self.guard = Lock()
        self.jobs = OrderedDict()
        self.pending = OrderedDict()
        self.cache = OrderedDict()
        self.saved_results = SavedResults(cache_path) if cache_path is not None else None
        self.sessions = ModelSessions()
        self.closed = False
        self.active = False

    def _analysis_busy(self):
        return self.active or bool(self.pending)

    def status(self):
        try:
            providers = ort_runtime().get_available_providers()
        except TaggerError:
            providers = []
        models = [self.models.status(model_id) for model_id in MODELS]
        with self.guard:
            busy = self._analysis_busy()
        return {
            "models": models,
            "analysisBusy": busy,
            "runtime": {"available": bool(providers), "cuda": "CUDAExecutionProvider" in providers},
        }

    def remove_model(self, model_id):
        def release_local_session(directory):
            self.sessions.release("deleted", model_path=directory / MODELS[model_id]["filename"])
            for key in tuple(self.cache):
                if key[1] == model_id:
                    del self.cache[key]

        with self.guard:
            if self.closed or self._analysis_busy():
                raise TaggerError("model_busy")
            return self.models.remove(model_id, release_local_session)

    def close(self):
        with self.guard:
            self.closed = True
            for job, stop in self.jobs.values():
                if job["state"] not in TERMINAL:
                    stop.set()
                    job["state"] = "cancelled"
            self.pending.clear()
        self.sessions.close()
        self.pool.shutdown(wait=False, cancel_futures=True)
        self.models.pool.shutdown(wait=False, cancel_futures=True)

    def start(self, data, mode, device, auto, reuse=False):
        return self.submit({"mode": mode, "total": 1}, self.run, data, MODES[mode], device, auto, reuse)

    def submit(self, fields, work, *args):
        with self.guard:
            if self.closed or len(self.pending) + self.active >= MAX_PENDING:
                raise TaggerError("busy")
            while len(self.jobs) >= MAX_JOBS:
                oldest_finished = next(key for key, (job, _) in self.jobs.items() if job["state"] in TERMINAL)
                del self.jobs[oldest_finished]
            job_id = uuid4().hex
            stop = Event()
            job = {**fields, "id": job_id, "state": "queued"}
            self.jobs[job_id] = (job, stop)
            self.pending[job_id] = (work, args)
            if not self.active:
                self.schedule_next()
            return job_id

    def schedule_next(self):
        # Called with the guard held. The executor only receives work that is ready to start.
        self.active = not self.closed and bool(self.pending)
        if self.active:
            job_id, (work, args) = self.pending.popitem(last=False)
            job, stop = self.jobs[job_id]
            self.pool.submit(self.run_job, job, stop, work, *args)

    def get(self, job_id):
        with self.guard:
            item = self.jobs.get(job_id)
            return dict(item[0]) if item else None

    def cancel(self, job_id):
        with self.guard:
            item = self.jobs.get(job_id)
            if not item:
                return False
            job, stop = item
            if job["state"] not in TERMINAL:
                stop.set()
                job["state"] = "cancelled"
                self.pending.pop(job_id, None)
            return True

    def obtain(self, model_id, auto, report, check_cancelled):
        status = self.models.status(model_id)
        check_cancelled()
        if status["state"] == "ready":
            return Path(status["path"])
        if not auto and status["state"] not in TRANSFER_STATES:
            raise TaggerError("model_needed")
        report("downloading")
        transfer = self.models.start(model_id)
        while True:
            check_cancelled()
            try:
                return transfer.result(timeout=0.3)
            except TimeoutError:
                if transfer.done():
                    raise

    def run_job(self, job, stop, work, *args):
        def check_cancelled():
            if stop.is_set():
                raise TaggerError("cancelled")

        def report(state, **data):
            with self.guard:
                if not stop.is_set():
                    job.update(state=state, **data)

        try:
            check_cancelled()
            work(report, check_cancelled, *args)
        except TaggerError as exc:
            report("failed", error=exc.code, detail=exc.detail)
        except Exception as exc:
            logger.exception("Image tagger job failed")
            report("failed", error="analysis_failed", detail=type(exc).__name__)
        finally:
            with self.guard:
                self.schedule_next()

    def run(self, report, check_cancelled, data, model_id, device, auto, reuse):
        try:
            check_cancelled()
            report("checking", step=1, model=model_id)
            image_hash = sha256(data).hexdigest()
            saved = self.saved_results if reuse else None
            stored = saved.get(image_hash, model_id, device) if saved is not None else None
            check_cancelled()
            if stored is not None and stored[0].get("fallbackReason") not in TRANSIENT_AUTO_FALLBACKS:
                outcome, width, height = stored
                report("done", width=width, height=height, results=[{**outcome, "cached": True, "cacheSource": "disk"}])
                return

            image = decode_image(data)
            del data
            report("checking", width=image.width, height=image.height)
            ort = ort_runtime()
            cuda_supported = "CUDAExecutionProvider" in ort.get_available_providers()
            if device == "cuda" and not cuda_supported:
                raise TaggerError("cuda_unavailable")
            revision = self.sessions.revision()
            directory = self.obtain(model_id, auto, report, check_cancelled)
            check_cancelled()
            cache_key = (image_hash, model_id, device)
            cached = self.cache.get(cache_key)
            if cached:
                self.cache.move_to_end(cache_key)
                outcome = cached
            else:
                outcome = analyze(
                    ort, directory, MODELS[model_id], image, device,
                    self.gpu_lock, self.sessions, revision, report, check_cancelled,
                )
                if not (cuda_supported and outcome["fallback"]):
                    self.cache[cache_key] = outcome
                    if len(self.cache) > MAX_RESULT_CACHE:
                        self.cache.popitem(last=False)
            check_cancelled()
            if saved is not None and outcome.get("fallbackReason") not in TRANSIENT_AUTO_FALLBACKS:
                saved.put(image_hash, model_id, device, outcome, image.width, image.height)
            report("done", results=[{**outcome, "cached": cached is not None}])
        except TaggerError as exc:
            report("failed", error=exc.code, detail=exc.detail, model=model_id, results=[])
        except Exception as exc:
            logger.exception("Image tagger failed")
            report("failed", error="analysis_failed", detail=type(exc).__name__, model=model_id, results=[])
