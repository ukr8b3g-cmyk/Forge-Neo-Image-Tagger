"""Verify and acquire pinned model assets."""

from concurrent.futures import ThreadPoolExecutor
from hashlib import file_digest, sha256
from http.client import HTTPException
from pathlib import Path
from tempfile import NamedTemporaryFile
from threading import Lock
from time import sleep
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import logging
import os
import shutil
import stat

from . import MODELS, TaggerError


logger = logging.getLogger(__name__)


def files_for(model):
    if "files" in model:
        return model["files"]
    return [model, model["metadata"], *([model["preprocess_metadata"]] if "preprocess_metadata" in model else [])]


class ModelStore:
    def __init__(self, root, shared_root, models=MODELS):
        self.root = Path(root).absolute()
        self.shared_root = shared_root
        self.models = models
        self.pool = ThreadPoolExecutor(max_workers=len(models), thread_name_prefix="image-tagger-download")
        self.guard = Lock()
        self.hash_lock = Lock()
        self.hash_cache = {}
        self.transfers = {}
        self.progress = {}
        self.failures = {}

    @staticmethod
    def signature(path):
        stat = path.stat()
        return stat.st_size, stat.st_mtime_ns, stat.st_ino

    def check_file(self, path, entry):
        try:
            signature = self.signature(path)
        except FileNotFoundError:
            return "missing"
        except OSError:
            return "invalid"
        if signature[0] != entry["size"]:
            return "invalid"

        with self.hash_lock:
            cached = self.hash_cache.get(path)
            if cached and cached[0] == signature:
                return "valid" if cached[1] == entry["sha256"] else "invalid"
            try:
                with path.open("rb") as stream:
                    digest = file_digest(stream, "sha256").hexdigest()
                if self.signature(path) != signature:
                    return "invalid"
            except OSError:
                return "invalid"
            self.hash_cache[path] = (signature, digest)
            return "valid" if digest == entry["sha256"] else "invalid"

    def shared_directory(self, model_id):
        shared = self.shared_root()
        return Path(os.path.expandvars(shared)).expanduser().absolute() / model_id if shared else None

    def inspect(self, model_id):
        entries = files_for(self.models[model_id])
        shared = self.shared_directory(model_id)
        if shared and all(self.check_file(shared / entry["filename"], entry) == "valid" for entry in entries):
            return shared, True, ["valid"] * len(entries)
        directory = self.root / model_id
        return directory, False, [self.check_file(directory / entry["filename"], entry) for entry in entries]

    @staticmethod
    def check_local_path(path, expected_type):
        try:
            info = path.lstat()
        except FileNotFoundError:
            return None
        # Junctions and other reparse points can redirect a managed path on Windows.
        reparse = getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT
        if reparse or not expected_type(info.st_mode):
            raise TaggerError("model_path_protected")
        return info

    def managed_directory(self, model_id):
        directory = self.root / model_id
        for path in (self.root, directory):
            self.check_local_path(path, stat.S_ISDIR)
        shared = self.shared_directory(model_id)
        if shared is not None and shared.resolve() == directory.resolve():
            raise TaggerError("model_path_protected")
        return directory

    def local_inventory(self, model_id):
        directory = self.managed_directory(model_id)
        found = []
        for entry in files_for(self.models[model_id]):
            path = directory / entry["filename"]
            info = self.check_local_path(path, stat.S_ISREG)
            if info is not None:
                found.append((path, info.st_size))
        return found

    def folder(self, model_id, use_shared):
        if use_shared:
            directory = self.shared_directory(model_id)
        else:
            directory = self.root / model_id
            if not directory.exists():
                self.managed_directory(model_id).mkdir(parents=True, exist_ok=True)
        if directory is None or not directory.is_dir():
            raise TaggerError("model_folder_error")
        return directory.resolve()

    def remove(self, model_id, before_remove):
        # Exclude acquisition for this model until all of its managed files are handled.
        with self.guard:
            transfer = self.transfers.get(model_id)
            if transfer is not None and not transfer.done():
                raise TaggerError("model_busy")
            try:
                files = self.local_inventory(model_id)
                if not files:
                    return 0
                before_remove(self.root / model_id)
                self.failures.pop(model_id, None)
                with self.hash_lock:
                    for path, _ in files:
                        path.unlink(missing_ok=True)
                        self.hash_cache.pop(path, None)
                return len(files)
            except (OSError, RuntimeError) as exc:
                logger.warning("Could not remove model files for %s: %s", model_id, exc)
                raise TaggerError("model_delete_error") from exc

    def status(self, model_id):
        model = self.models[model_id]
        entries = files_for(model)
        size = sum(entry["size"] for entry in entries)
        summary = {
            "id": model_id, "label": model["label"], "totalBytes": size,
            "thresholds": model.get("thresholds", {}), "downloadPath": str(self.root / model_id),
        }
        with self.guard:
            active = self.progress.get(model_id)
        if active:
            return {**summary, **active}

        directory, shared, states = self.inspect(model_id)
        present = sum(entry["size"] for entry, state in zip(entries, states) if state == "valid")
        with self.guard:
            active = self.progress.get(model_id)
            failure = self.failures.get(model_id)
        if active:
            return {**summary, **active}
        try:
            local_files = self.local_inventory(model_id)
            summary.update(localFiles=len(local_files), localBytes=sum(size for _, size in local_files))
        except (TaggerError, OSError, RuntimeError):
            summary["localProtected"] = True
        summary.update(
            path=str(directory),
            shared=shared,
            bytes=present,
            needed=[entry["filename"] for entry, state in zip(entries, states) if state != "valid"],
        )
        if present == size:
            return {**summary, "state": "ready"}
        if failure:
            return {**summary, "state": failure.code, "detail": failure.detail}
        if "invalid" in states:
            return {**summary, "state": "verification_failed"}
        return {**summary, "state": "incomplete" if present else "missing"}

    def start(self, model_id):
        with self.guard:
            pending = self.transfers.get(model_id)
            if pending and not pending.done():
                return pending
            self.failures.pop(model_id, None)
            self.progress[model_id] = {"state": "checking", "bytes": 0}
            pending = self.pool.submit(self.acquire, model_id)
            self.transfers[model_id] = pending
            return pending

    def publish(self, model_id, state, count, filename=None):
        with self.guard:
            self.progress[model_id] = {"state": state, "bytes": count, "file": filename}

    def acquire(self, model_id):
        try:
            directory, _, states = self.inspect(model_id)
            model = self.models[model_id]
            entries = files_for(model)
            if all(state == "valid" for state in states):
                return directory

            shared = self.shared_directory(model_id)
            if shared is not None and shared.resolve() == directory.resolve():
                raise TaggerError("download_failed", "model_path_protected")
            directory.mkdir(parents=True, exist_ok=True)
            remaining = sum(entry["size"] for entry, state in zip(entries, states) if state != "valid")
            if shutil.disk_usage(directory).free < remaining:
                raise TaggerError("download_failed", "disk_space")
            acquired = sum(entry["size"] for entry, state in zip(entries, states) if state == "valid")
            for entry, state in zip(entries, states):
                if state == "valid":
                    continue
                self.transfer(model, entry, directory, acquired)
                acquired += entry["size"]
            return directory
        except (OSError, HTTPException) as exc:
            reason = getattr(exc, "reason", exc)
            detail = f"HTTP {exc.code}" if isinstance(exc, HTTPError) else type(reason).__name__
            if not isinstance(exc, HTTPError):
                logger.warning("Could not acquire %s: %s", model_id, reason)
            failure = TaggerError("download_failed", detail)
            with self.guard:
                self.failures[model_id] = failure
            raise failure from exc
        except TaggerError as exc:
            with self.guard:
                self.failures[model_id] = exc
            raise
        finally:
            with self.guard:
                self.progress.pop(model_id, None)

    def transfer(self, model, entry, directory, acquired):
        for attempt in range(3):
            try:
                self.transfer_once(model, entry, directory, acquired)
                return
            except (URLError, TimeoutError, ConnectionError, HTTPException) as exc:
                if attempt == 2 or (isinstance(exc, HTTPError) and exc.code not in {408, 429, 500, 502, 503, 504}):
                    raise
                sleep(1 << attempt)

    def transfer_once(self, model, entry, directory, acquired):
        name = entry["filename"]
        target = directory / name
        url = model["download_url"].rsplit("/", 1)[0] + "/" + name
        request = Request(url, headers={"User-Agent": "Forge-Neo-Hybrid-Image-Tagger", "Accept-Encoding": "identity"})
        temporary = None
        digest = sha256()
        count = 0
        try:
            self.publish(model["id"], "downloading", acquired, name)
            with NamedTemporaryFile(dir=directory, prefix=f".{name}.", suffix=".part", delete=False) as output:
                temporary = Path(output.name)
                with urlopen(request, timeout=40) as response:
                    while block := response.read(1024 * 1024):
                        count += len(block)
                        if count > entry["size"]:
                            raise TaggerError("verification_failed", name)
                        output.write(block)
                        digest.update(block)
                        self.publish(model["id"], "downloading", acquired + count, name)
            self.publish(model["id"], "verifying", acquired + count, name)
            hexdigest = digest.hexdigest()
            if count != entry["size"] or hexdigest != entry["sha256"]:
                raise TaggerError("verification_failed", name)
            os.replace(temporary, target)
            with self.hash_lock:
                self.hash_cache[target] = (self.signature(target), hexdigest)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
