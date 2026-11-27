"""Preprocessing and bounded ONNX inference.

The input transforms follow the MIT-licensed Anima Character Sheet Designer
and the model distributors' reference implementations.
"""

import csv
from functools import lru_cache
from io import BytesIO
import time
from warnings import catch_warnings, simplefilter

from . import MODELS, PIXAI, TaggerError


MAX_PIXELS = 64_000_000


def decode_image(data):
    from PIL import Image, ImageOps, UnidentifiedImageError

    try:
        with catch_warnings():
            simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data), formats=["PNG", "JPEG", "WEBP"]) as original:
                if original.width * original.height > MAX_PIXELS:
                    raise TaggerError("image_size")
                if getattr(original, "n_frames", 1) != 1:
                    raise TaggerError("animated_image")
                rgba = ImageOps.exif_transpose(original).convert("RGBA")
    except (Image.DecompressionBombWarning, Image.DecompressionBombError) as exc:
        raise TaggerError("image_size") from exc
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise TaggerError("bad_image") from exc
    if rgba.getchannel("A").getextrema()[1] == 0:
        raise TaggerError("transparent_image")
    canvas = Image.new("RGBA", rgba.size, "white")
    canvas.alpha_composite(rgba)
    return canvas.convert("RGB")


def preprocess(image, model):
    import numpy as np
    from PIL import Image

    if model["id"] == PIXAI:
        side = model["input"]["shape"][-1]
        scale = side / max(image.size)
        size = tuple(max(1, round(value * scale)) for value in image.size)
        resized = image.resize(size, Image.Resampling.BICUBIC)
        square = Image.new("RGB", (side, side), "black")
        square.paste(resized, ((side - size[0]) // 2, (side - size[1]) // 2))
        rgb = np.asarray(square, dtype=np.float32)
        return np.ascontiguousarray(((rgb / 255 - 0.5) / 0.5).transpose(2, 0, 1)[None])

    side = max(image.size)
    target = model["input"]["shape"][1]
    if side * side > MAX_PIXELS:
        scale = target / side
        image = image.resize(tuple(max(1, round(value * scale)) for value in image.size), Image.Resampling.BICUBIC)
        side = target
    square = Image.new("RGB", (side, side), "white")
    square.paste(image, ((side - image.width) // 2, (side - image.height) // 2))
    rgb = np.asarray(square.resize((target, target), Image.Resampling.BICUBIC), dtype=np.float32)
    return np.ascontiguousarray(rgb[None, ..., ::-1])


def ort_runtime():
    try:
        import onnxruntime as ort
    except (ImportError, OSError) as exc:
        raise TaggerError("runtime_missing", type(exc).__name__) from exc
    return ort


def labels(directory, model):
    try:
        with (directory / model["metadata"]["filename"]).open(encoding="utf-8-sig", newline="") as stream:
            rows = [(row["name"], model["categories"][row["category"]]) for row in csv.DictReader(stream)]
    except (KeyError, OSError, UnicodeError) as exc:
        raise TaggerError("verification_failed", model["metadata"]["filename"]) from exc
    if len(rows) != model["metadata"]["rows"]:
        raise TaggerError("verification_failed", model["metadata"]["filename"])
    return rows


@lru_cache(maxsize=len(MODELS) * 2)
def verified_labels(directory, model_id):
    # ModelStore has checked the vocabulary against its pinned digest.
    return labels(directory, MODELS[model_id])


def gpu_fallback(exc):
    if isinstance(exc, TaggerError):
        return exc.code in {"cuda_unavailable", "cuda_memory"}
    message = str(exc).lower()
    if any(reason in message for reason in ("illegal memory access", "device-side assert", "unspecified launch failure")):
        return False
    return any(reason in message for reason in (
        "cudaexecutionprovider", "onnxruntime_providers_cuda", "cudnn", "cublas",
        "out of memory", "failed to allocate", "cudaerrormemoryallocation", "not implemented",
        "failed to find kernel", "could not find an implementation", "cuda driver version"
    ))


def memory_error(exc):
    message = str(exc).lower()
    return any(reason in message for reason in ("out of memory", "failed to allocate", "cudaerrormemoryallocation"))


def session_key(directory, model, gpu):
    return (model["id"], "cpu" if gpu is None else "cuda", directory / model["filename"], gpu)


def run_session(ort, directory, model, tensor, gpu, sessions, revision, stage, cancelled):
    import numpy as np

    key = session_key(directory, model, gpu)
    model_path = key[2]
    cancelled()
    stage("analyzing")
    session = sessions.begin(key, revision)
    reused = session is not None
    load_seconds = 0
    success = False
    try:
        if session is None:
            options = ort.SessionOptions()
            if gpu is None:
                providers = ["CPUExecutionProvider"]
                if model["id"] == PIXAI:
                    options.enable_cpu_mem_arena = False
            else:
                options.intra_op_num_threads = 4
                providers = [("CUDAExecutionProvider", {
                    "device_id": gpu, "arena_extend_strategy": "kSameAsRequested",
                }), "CPUExecutionProvider"]
            start = time.perf_counter()
            session = ort.InferenceSession(str(model_path), sess_options=options, providers=providers)
            session.disable_fallback()
            if gpu is not None and session.get_providers()[0] != "CUDAExecutionProvider":
                raise TaggerError("cuda_unavailable")
            load_seconds = time.perf_counter() - start
            for actual, expected in ((session.get_inputs(), model["input"]), (session.get_outputs(), model["output"])):
                if (
                    len(actual) != 1 or actual[0].name != expected["name"]
                    or actual[0].type != "tensor(float)" or list(actual[0].shape[1:]) != expected["shape"][1:]
                ):
                    raise TaggerError("incompatible_model", model["id"])
            sessions.store(key, session)
        cancelled()
        start = time.perf_counter()
        result = session.run([model["output"]["name"]], {model["input"]["name"]: tensor})[0]
        inference_seconds = time.perf_counter() - start
        cancelled()
        if (
            result.shape != (1, model["metadata"]["rows"]) or not np.isfinite(result).all()
            or result.min() < -1e-6 or result.max() > 1 + 1e-6
        ):
            raise TaggerError("incompatible_model", model["id"])
        scores = np.clip(result[0], 0, 1).tolist()
        success = True
        return scores, load_seconds, inference_seconds, reused
    finally:
        # The cache now owns the only Python reference and can release it synchronously.
        del session
        sessions.end(success)


def analyze(ort, directory, model, image, device, guard, sessions, revision, stage, check_cancelled):
    vocabulary = verified_labels(directory, model["id"])
    tensor = preprocess(image, model)
    actual = "cpu"
    fallback_reason = None

    def run(gpu):
        return run_session(ort, directory, model, tensor, gpu, sessions, revision, stage, check_cancelled)

    if device == "cpu":
        result = run(None)
    else:
        try:
            if "CUDAExecutionProvider" not in ort.get_available_providers():
                raise TaggerError("cuda_unavailable")
            import torch

            if not torch.cuda.is_available():
                raise TaggerError("cuda_unavailable")
            stage("waiting_gpu")
            while not guard.acquire(blocking=False):
                check_cancelled()
                time.sleep(0.05)
            try:
                check_cancelled()
                gpu = torch.cuda.current_device()
                if device == "auto" and not sessions.has(session_key(directory, model, gpu)):
                    minimum = model["cuda_min_free_mib"] * 1024 * 1024
                    if torch.cuda.mem_get_info(gpu)[0] < minimum:
                        sessions.release("pressure", cuda_only=True)
                        if torch.cuda.mem_get_info(gpu)[0] < minimum:
                            raise TaggerError("cuda_memory")
                try:
                    result = run(gpu)
                except Exception as exc:
                    if not memory_error(exc) or not sessions.release("pressure", cuda_only=True):
                        raise
                    result = run(gpu)
            finally:
                guard.release()
            actual = "cuda"
        except Exception as exc:
            if device != "auto" or not gpu_fallback(exc):
                raise
            fallback_reason = exc.code if isinstance(exc, TaggerError) else (
                "cuda_oom" if memory_error(exc) else "cuda_unavailable"
            )
            result = run(None)
    check_cancelled()
    scores, load_seconds, inference_seconds, reused = result
    return {
        "id": model["id"],
        "device": actual,
        "fallback": fallback_reason is not None,
        "fallbackReason": fallback_reason,
        "loadSeconds": round(load_seconds, 3),
        "inferenceSeconds": round(inference_seconds, 3),
        "sessionReused": reused,
        "rows": [(name, category, score) for (name, category), score in zip(vocabulary, scores)],
    }
