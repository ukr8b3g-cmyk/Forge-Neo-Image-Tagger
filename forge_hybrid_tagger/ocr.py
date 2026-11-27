"""Local speech-bubble detection and Manga OCR for the reference image."""

from concurrent.futures import TimeoutError
from math import ceil, floor
from pathlib import Path
from time import perf_counter, sleep
import json
import re

from . import TaggerError
from . import magi
from .inference import decode_image, gpu_fallback, ort_runtime
from .models import ModelStore


DETECTOR = "bubble-detector"
READER = "manga-ocr"
SPEAKERS = "magi-v2"
OCR_MODELS = {
    model["id"]: model
    for model in json.loads(Path(__file__).with_name("ocr_models.json").read_text(encoding="utf-8"))["models"]
}
FULLWIDTH = str.maketrans({chr(code): chr(code + 0xFEE0) for code in range(33, 127)})
DETECTION_MIN = {0: 0.35, 1: 0.35, 2: 0.45}
MIN_FREE_CUDA = 1600 * 1024 * 1024


def clamp_box(box, size, padding=0.0):
    x1, y1, x2, y2 = box
    dx, dy = (x2 - x1) * padding, (y2 - y1) * padding
    return (
        max(0, min(size[0], floor(x1 - dx))),
        max(0, min(size[1], floor(y1 - dy))),
        max(0, min(size[0], ceil(x2 + dx))),
        max(0, min(size[1], ceil(y2 + dy))),
    )


def area(box):
    return max(0, box[2] - box[0]) * max(0, box[3] - box[1])


def intersection(a, b):
    return area((max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])))


def deduplicate(found):
    unique = []
    for box, score, label in sorted(found, key=lambda item: -item[1]):
        if all(intersection(box, other) / (area(box) + area(other) - intersection(box, other)) <= 0.55
               for other, _, _ in unique):
            unique.append((box, score, label))
    return unique


def in_reading_order(regions):
    pending = sorted(regions, key=lambda region: (region["box"][1], -region["box"][0]))
    ordered = []
    while pending:
        first, *rest = pending
        top, bottom = first["box"][1::2]
        row, pending = [first], []
        for region in rest:
            start, end = region["box"][1::2]
            overlap = min(bottom, end) - max(top, start)
            (row if overlap > 0.45 * min(bottom - top, end - start) else pending).append(region)
        ordered.extend(sorted(row, key=lambda region: -sum(region["box"][0::2])))
    return ordered


def speech_regions(labels, boxes, scores, size):
    detections = []
    for label, box, score in zip(labels, boxes, scores):
        if label not in DETECTION_MIN or score < DETECTION_MIN[label]:
            continue
        box = clamp_box(box, size)
        if area(box):
            detections.append((box, float(score), int(label)))
    bubbles = [box for box, _, _ in deduplicate(item for item in detections if item[2] == 0)]
    groups = {box: [] for box in bubbles}
    regions = []
    for box, score, label in deduplicate(item for item in detections if item[2] != 0):
        containing = [bubble for bubble in bubbles if intersection(box, bubble) >= 0.65 * area(box)]
        if containing:
            groups[min(containing, key=area)].append((box, score))
        else:
            regions.append({"box": box, "crop": clamp_box(box, size, 0.08),
                            "kind": "text" if label == 2 else "bubble", "score": score})
    for bubble, blocks in groups.items():
        if not blocks:
            continue
        box = (min(rect[0] for rect, _ in blocks), min(rect[1] for rect, _ in blocks),
               max(rect[2] for rect, _ in blocks), max(rect[3] for rect, _ in blocks))
        regions.append({"box": bubble, "crop": clamp_box(box, size, 0.08), "kind": "bubble",
                        "bubbleDetected": True, "score": max(score for _, score in blocks)})
    return in_reading_order(regions)


def clean_reading(text):
    # Manga OCR decodes WordPiece tokens and renders the Japanese text without token spaces.
    text = "".join(text.split()).replace("…", "...")
    return re.sub(r"[・.]{2,}", lambda match: "." * len(match[0]), text).translate(FULLWIDTH)


class SpeechOCR:
    def __init__(self, root, sessions, gpu_lock):
        self.models = ModelStore(root, lambda: "", OCR_MODELS)
        self.sessions = sessions
        self.gpu_lock = gpu_lock

    def close(self):
        self.models.pool.shutdown(wait=False, cancel_futures=True)

    def status(self):
        return [self.models.status(name) for name in OCR_MODELS]

    def obtain(self, model, report, cancelled):
        cancelled()
        report("ocr_preparing", model=model)
        state = self.models.status(model)
        if state["state"] == "ready":
            return Path(state["path"])
        future = self.models.start(model)
        while True:
            cancelled()
            try:
                return future.result(timeout=0.25)
            except TimeoutError:
                if future.done():
                    raise

    def detect(self, image, directory, revision, cancelled):
        import numpy as np
        from PIL import Image

        path = directory / OCR_MODELS[DETECTOR]["files"][0]["filename"]
        key = (DETECTOR, "cpu", path, None)
        session = self.sessions.begin(key, revision)
        loaded = 0.0
        success = False
        try:
            if session is None:
                start = perf_counter()
                ort = ort_runtime()
                options = ort.SessionOptions()
                options.intra_op_num_threads = 4
                session = ort.InferenceSession(str(path), sess_options=options, providers=["CPUExecutionProvider"])
                if (
                    [value.name for value in session.get_inputs()] != ["images", "orig_target_sizes"] or
                    [value.name for value in session.get_outputs()] != ["labels", "boxes", "scores"]
                ):
                    raise TaggerError("incompatible_model", DETECTOR)
                self.sessions.store(key, session)
                loaded = perf_counter() - start
            cancelled()
            start = perf_counter()
            rgb = np.asarray(image.resize((640, 640), Image.Resampling.BILINEAR), dtype=np.float32)
            tensor = np.ascontiguousarray((rgb / 255).transpose(2, 0, 1)[None])
            labels, boxes, scores = session.run(None, {
                "images": tensor, "orig_target_sizes": np.asarray([image.size], dtype=np.int64),
            })
            regions = speech_regions(labels[0], boxes[0], scores[0], image.size)
            cancelled()
            success = True
            return regions, loaded, perf_counter() - start
        finally:
            del session
            self.sessions.end(success)

    def load_reader(self, directory):
        try:
            from transformers import BertTokenizer, ViTImageProcessor, VisionEncoderDecoderModel
        except (ImportError, OSError) as exc:
            raise TaggerError("ocr_runtime_missing", type(exc).__name__) from exc

        processor = ViTImageProcessor.from_pretrained(str(directory), local_files_only=True)
        # Only decoding is needed. The original vocabulary avoids a separate Japanese word segmenter.
        tokenizer = BertTokenizer(vocab_file=str(directory / "vocab.txt"), do_lower_case=False)
        model = VisionEncoderDecoderModel.from_pretrained(
            str(directory), local_files_only=True, use_safetensors=False, weights_only=True,
        ).eval()
        return processor, tokenizer, model

    def on_device(self, action, model, device, report, cancelled):
        import torch

        if device == "cpu":
            return action("cpu"), "cpu", None
        try:
            if not torch.cuda.is_available():
                raise TaggerError("cuda_unavailable")
            report("waiting_gpu", model=model)
            if device == "auto" and not self.gpu_lock.acquire(blocking=False):
                raise TaggerError("ocr_gpu_busy")
            if device == "cuda":
                while not self.gpu_lock.acquire(blocking=False):
                    cancelled()
                    sleep(0.05)
            try:
                gpu = torch.cuda.current_device()
                if device == "auto" and torch.cuda.mem_get_info(gpu)[0] < MIN_FREE_CUDA:
                    raise TaggerError("cuda_memory")
                return action(f"cuda:{gpu}"), "cuda", None
            finally:
                try:
                    # OCR moves its weights back to the CPU; return unused Torch blocks before Forge takes the lock.
                    torch.cuda.empty_cache()
                finally:
                    self.gpu_lock.release()
        except Exception as exc:
            if device != "auto" or not (gpu_fallback(exc) or
                                        isinstance(exc, TaggerError) and exc.code == "ocr_gpu_busy"):
                raise
            fallback = exc.code if isinstance(exc, TaggerError) else "cuda_unavailable"
            return action("cpu"), "cpu", fallback

    def read(self, image, regions, directory, revision, device, report, cancelled):
        try:
            import torch
        except (ImportError, OSError) as exc:
            raise TaggerError("ocr_runtime_missing", type(exc).__name__) from exc

        path = directory / OCR_MODELS[READER]["files"][0]["filename"]
        key = (READER, "cpu", path, None)
        bundle = self.sessions.begin(key, revision)
        loaded = 0.0
        success = False
        try:
            if bundle is None:
                report("ocr_loading", model=READER)
                start = perf_counter()
                bundle = self.load_reader(directory)
                self.sessions.store(key, bundle)
                loaded = perf_counter() - start
            processor, tokenizer, model = bundle

            def recognize(target):
                cancelled()
                report("ocr_reading", model=READER, device="cpu" if target == "cpu" else "cuda")
                try:
                    if target != "cpu":
                        model.to(target)
                    readings = []
                    with torch.inference_mode():
                        for offset in range(0, len(regions), 4):
                            cancelled()
                            crops = [image.crop(region["crop"]).convert("L").convert("RGB")
                                     for region in regions[offset:offset + 4]]
                            pixels = processor(images=crops, return_tensors="pt").pixel_values.to(target)
                            tokens = model.generate(pixel_values=pixels, max_length=300).cpu()
                            readings.extend(clean_reading(text) for text in
                                            tokenizer.batch_decode(tokens, skip_special_tokens=True))
                    cancelled()
                    return readings
                finally:
                    if target != "cpu":
                        model.to("cpu")

            start = perf_counter()
            readings, actual, fallback = self.on_device(recognize, READER, device, report, cancelled)
            success = True
            return readings, loaded, perf_counter() - start, actual, fallback
        finally:
            bundle = processor = tokenizer = model = None
            self.sessions.end(success)

    def run(self, report, cancelled, data, mode, box, device):
        start = perf_counter()
        report("checking")
        image = decode_image(data)
        del data
        revision = self.sessions.revision()
        metrics = {"detectLoadSeconds": 0.0, "detectSeconds": 0.0,
                   "ocrLoadSeconds": 0.0, "ocrSeconds": 0.0}
        if mode == "auto":
            detector = self.obtain(DETECTOR, report, cancelled)
            report("ocr_detecting", model=DETECTOR)
            regions, metrics["detectLoadSeconds"], metrics["detectSeconds"] = self.detect(
                image, detector, revision, cancelled,
            )
        else:
            crop = clamp_box(box, image.size)
            if crop[2] - crop[0] < 2 or crop[3] - crop[1] < 2:
                raise TaggerError("ocr_bad_box")
            regions = [{"box": crop, "crop": crop, "kind": "bubble"}]
        results, actual, fallback = [], None, None
        if regions:
            directory = self.obtain(READER, report, cancelled)
            readings, metrics["ocrLoadSeconds"], metrics["ocrSeconds"], actual, fallback = self.read(
                image, regions, directory, revision, device, report, cancelled,
            )
            results = [{**region, "text": text} for region, text in zip(regions, readings) if text]
        cancelled()
        metrics["seconds"] = perf_counter() - start
        report("done", width=image.width, height=image.height, results=results, device=actual,
               fallbackReason=fallback, metrics={key: round(value, 3) for key, value in metrics.items()})

    def run_speakers(self, report, cancelled, data, device):
        start = perf_counter()
        report("checking", model=SPEAKERS)
        image = decode_image(data)
        del data
        revision = self.sessions.revision()
        phase_start = perf_counter()
        directory = self.obtain(SPEAKERS, report, cancelled)
        metrics = {"acquireSeconds": perf_counter() - phase_start, "loadSeconds": 0.0}
        key = (SPEAKERS, "cpu", directory / "pytorch_model.bin", None)
        bundle = self.sessions.begin(key, revision)
        success = False
        try:
            if bundle is None:
                report("ocr_speaker_loading", model=SPEAKERS)
                phase_start = perf_counter()
                bundle = magi.load(directory)
                self.sessions.store(key, bundle)
                metrics["loadSeconds"] = perf_counter() - phase_start
            processor, model = bundle
            import torch

            def infer(target):
                cancelled()
                report("ocr_speaker_infer", model=SPEAKERS, device=target.split(":")[0])
                try:
                    if target != "cpu":
                        model.to(target)
                    with torch.inference_mode():
                        return magi.predict(image, processor, model, target)
                finally:
                    if target != "cpu":
                        model.to("cpu")

            phase_start = perf_counter()
            prediction, actual, fallback = self.on_device(infer, SPEAKERS, device, report, cancelled)
            metrics["inferSeconds"] = perf_counter() - phase_start
            cancelled()
            success = True
            metrics["seconds"] = perf_counter() - start
            report("done", width=image.width, height=image.height, prediction=prediction,
                   device=actual, fallbackReason=fallback,
                   metrics={key: round(value, 3) for key, value in metrics.items()})
        finally:
            bundle = processor = model = None
            self.sessions.end(success)
