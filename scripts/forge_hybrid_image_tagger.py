"""Register the Image Tagger tab and API on the native Forge Neo app."""

from ipaddress import ip_address
from threading import Lock
from pathlib import Path
from typing import Literal
import sys

import gradio as gr
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import ValidationError
from modules import script_callbacks, scripts, shared, util
from modules.paths_internal import data_path, models_path

EXTENSION = Path(__file__).resolve().parents[1]
if str(EXTENSION) not in sys.path:
    sys.path.insert(0, str(EXTENSION))

# Reload UI re-executes this script. Discard its old imports without mutating modules
# an earlier request may still be using.
package = EXTENSION / "forge_hybrid_tagger"
for module_name, module in tuple(sys.modules.items()):
    if module_name == package.name or module_name.startswith(package.name + "."):
        filename = getattr(module, "__file__", None)
        if filename and Path(filename).resolve().parent == package:
            del sys.modules[module_name]

from forge_hybrid_tagger import MODELS, MODES, TaggerError
from forge_hybrid_tagger.lm_studio import Connection, Entry, Generation, Kind, Studio, is_local_server
from forge_hybrid_tagger.ocr import SpeechOCR
from forge_hybrid_tagger.service import AnalysisService
from forge_hybrid_tagger.sessions import DEFAULT_IDLE_SECONDS, MAX_IDLE_SECONDS, POLICIES


ROUTE = "/forge-hybrid-image-tagger/v1"
SHARED_MODELS_OPTION = "forge_hybrid_tagger_shared_models"
MAX_UPLOAD = 64 * 1024 * 1024
analysis_service = None
ocr_service = None
studio_service = None


class Script(scripts.Script):
    def title(self):
        return "Image Tagger memory"

    def show(self, is_img2img):
        return scripts.AlwaysVisible

    def ui(self, is_img2img):
        return []

    def before_process(self, p, *args):
        # Forge calls this before managing generation weights. Generation owns its GPU queue lock.
        if analysis_service is not None:
            analysis_service.sessions.release("forge")
        if studio_service is not None:
            studio_service.before_forge()


def settings():
    shared.opts.add_option(SHARED_MODELS_OPTION, shared.OptionInfo(
        "",
        "Shared ONNX model folder (optional, read-only)",
        section=("forge_hybrid_image_tagger", "Image Tagger"),
    ).info("Point to a folder containing pixai_v1_fp16 and/or wd_eva02_large_v3, such as the Anima Tagger folder."))


def on_tabs():
    markup = (EXTENSION / "ui" / "panel.html").read_text(encoding="utf-8")
    with gr.Blocks() as panel:
        gr.HTML(markup, elem_id="forge_hybrid_tagger_mount")
    return [(panel, "Image Tagger", "forge_hybrid_image_tagger")]


def register_api(_demo, app):
    global analysis_service, ocr_service, studio_service
    from modules.call_queue import queue_lock

    service = AnalysisService(
        Path(models_path) / "image_tagger",
        lambda: getattr(shared.opts, SHARED_MODELS_OPTION, "").strip(),
        queue_lock,
        cache_path=Path(data_path) / "cache" / "image_tagger" / "analysis.sqlite3",
    )
    analysis_service = service
    ocr = SpeechOCR(Path(models_path) / "image_tagger" / "ocr", service.sessions, queue_lock)
    ocr_service = ocr
    login = next((route.endpoint for route in app.routes if getattr(route, "path", "") == "/login_check"), None)
    router = APIRouter(prefix=ROUTE, dependencies=[Depends(login)] if login else [])

    def validate_site(request):
        if request.headers.get("sec-fetch-site") == "cross-site":
            raise HTTPException(403, detail="cross_site")

    def loopback(address):
        if address == "localhost":
            return True
        try:
            return ip_address(address).is_loopback
        except ValueError:
            return False

    def allow_model_management(request):
        return (request.client is not None and loopback(request.client.host)
                and loopback(request.url.hostname))

    def validate_model_management(request, model_id):
        validate_site(request)
        origin = request.headers.get("origin")
        expected = f"{request.url.scheme}://{request.url.netloc}"
        if origin and origin != expected:
            raise HTTPException(403, detail="cross_site")
        if not allow_model_management(request):
            raise HTTPException(403, detail="model_management_local")
        if model_id not in MODELS:
            raise HTTPException(404, detail="unknown_model")

    @router.get("/status")
    def status(request: Request):
        return {**service.status(), "manageLocal": allow_model_management(request)}

    @router.get("/sessions")
    def session_status():
        return service.sessions.status()

    @router.put("/sessions")
    def session_policy(request: Request, policy: str, idle_seconds: int = DEFAULT_IDLE_SECONDS):
        validate_site(request)
        if policy not in POLICIES or not 1 <= idle_seconds <= MAX_IDLE_SECONDS:
            raise HTTPException(400, detail="invalid_settings")
        return service.sessions.configure(policy, idle_seconds)

    @router.delete("/sessions")
    def unload(request: Request):
        validate_site(request)
        service.sessions.release("manual")
        return service.sessions.status()

    @router.post("/models/{model_id}/download", status_code=202)
    def download(model_id: str, request: Request):
        validate_site(request)
        if model_id not in MODELS:
            raise HTTPException(404, detail="unknown_model")
        service.models.start(model_id)
        return {"id": model_id}

    @router.post("/models/{model_id}/folder")
    def open_model_folder(model_id: str, request: Request, source: Literal["download", "shared"] = "download"):
        validate_model_management(request, model_id)
        try:
            directory = service.models.folder(model_id, use_shared=source == "shared")
            util.open_folder(str(directory))
        except TaggerError as exc:
            raise HTTPException(400, detail=exc.code) from exc
        except (OSError, RuntimeError) as exc:
            raise HTTPException(500, detail="model_folder_error") from exc
        return {"id": model_id}

    @router.delete("/models/{model_id}")
    def remove_model(model_id: str, request: Request):
        validate_model_management(request, model_id)
        try:
            removed = service.remove_model(model_id)
        except TaggerError as exc:
            code = {"model_busy": 409, "model_path_protected": 403}.get(exc.code, 500)
            raise HTTPException(code, detail=exc.code) from exc
        return {"id": model_id, "removed": removed}

    async def image_bytes(request):
        if request.headers.get("content-type", "").split(";")[0] not in {
            "image/png", "image/jpeg", "image/webp", "application/octet-stream",
        }:
            raise HTTPException(415, detail="bad_image")
        data = bytearray()
        async for chunk in request.stream():
            if len(data) + len(chunk) > MAX_UPLOAD:
                raise HTTPException(413, detail="image_size")
            data.extend(chunk)
        if not data:
            raise HTTPException(400, detail="bad_image")
        return bytes(data)

    @router.post("/analysis", status_code=202)
    async def start(request: Request, mode: str = "wd", device: str = "auto", auto: bool = True, reuse: bool = False):
        validate_site(request)
        if mode not in MODES or device not in {"auto", "cpu", "cuda"}:
            raise HTTPException(400, detail="invalid_settings")
        data = await image_bytes(request)
        try:
            return {"id": service.start(data, mode, device, auto, reuse)}
        except TaggerError as exc:
            raise HTTPException(429, detail=exc.code) from exc

    @router.get("/ocr/status")
    def ocr_status():
        return {"models": ocr.status()}

    @router.post("/ocr/speakers", status_code=202)
    async def infer_speakers(request: Request, device: Literal["auto", "cpu", "cuda"] = "auto"):
        validate_site(request)
        data = await image_bytes(request)
        try:
            return {"id": service.submit({"kind": "speakers"}, ocr.run_speakers, data, device)}
        except TaggerError as exc:
            raise HTTPException(429, detail=exc.code) from exc

    @router.post("/ocr", status_code=202)
    async def read_speech(request: Request, mode: str = "auto", device: str = "auto", box: str = ""):
        validate_site(request)
        if mode not in {"auto", "crop"} or device not in {"auto", "cpu", "cuda"}:
            raise HTTPException(400, detail="invalid_settings")
        region = None
        if mode == "crop":
            try:
                if len(box) > 80:
                    raise ValueError()
                region = tuple(int(value) for value in box.split(","))
                if len(region) != 4 or region[0] >= region[2] or region[1] >= region[3]:
                    raise ValueError()
            except ValueError as exc:
                raise HTTPException(400, detail="ocr_bad_box") from exc
        data = await image_bytes(request)
        try:
            return {"id": service.submit({"kind": "ocr", "mode": mode}, ocr.run, data, mode, region, device)}
        except TaggerError as exc:
            raise HTTPException(429, detail=exc.code) from exc

    @router.get("/analysis/{job_id}")
    def get(job_id: str):
        result = service.get(job_id)
        if result is None:
            raise HTTPException(404, detail="expired")
        return result

    @router.delete("/analysis/{job_id}")
    def cancel(job_id: str, request: Request):
        validate_site(request)
        if not service.cancel(job_id):
            raise HTTPException(404, detail="expired")
        return {"id": job_id}

    studio = Studio(Path(data_path) / "image_tagger" / "lm_studio.sqlite3")

    studio_service = studio
    remote_lock = Lock()

    @router.get("/lm/connection")
    def lm_connection(request: Request):
        return {"url": studio.url(), "editable": allow_model_management(request)}

    @router.put("/lm/connection")
    def lm_connect(body: Connection, request: Request):
        validate_site(request)
        origin = request.headers.get("origin")
        if not allow_model_management(request) or origin and origin != f"{request.url.scheme}://{request.url.netloc}":
            raise HTTPException(403, "model_management_local")
        return {"url": studio.set_url(body.url)}

    @router.get("/lm/models")
    def lm_models():
        return studio.models()

    @router.post("/lm/generate")
    def lm_generate(request: Request, config: str = Form(...), image: UploadFile | None = File(None)):
        validate_site(request)
        try:
            options = Generation.model_validate_json(config)
        except ValidationError as exc:
            raise HTTPException(400, "invalid_settings") from exc
        raw = None
        if options.task != "expand" and image:
            raw = image.file.read(MAX_UPLOAD + 1)
            if len(raw) > MAX_UPLOAD:
                raise HTTPException(413, "image_size")
        url = studio.url()
        # Local captioning and Forge generation share GPU capacity, including JIT model loads.
        with queue_lock if is_local_server(url) else remote_lock:
            return studio.generate(options, raw, url=url)

    @router.delete("/lm/models")
    def lm_unload(model: str, request: Request):
        validate_site(request)
        url = studio.url()
        with queue_lock if is_local_server(url) else remote_lock:
            return studio.purge(url, model)

    @router.get("/lm/library/{kind}")
    def lm_library(kind: Kind):
        return studio.entries(kind)

    @router.post("/lm/library/{kind}")
    def lm_save(kind: Kind, body: Entry, request: Request):
        validate_site(request)
        studio.save(kind, body)
        return {"name": body.name.strip()}

    @router.delete("/lm/library/{kind}")
    def lm_delete(kind: Kind, name: str, request: Request):
        validate_site(request)
        studio.remove(kind, name)
        return {"name": name}

    app.include_router(router)


def close_service():
    global analysis_service, ocr_service
    if analysis_service is not None:
        analysis_service.close()
        analysis_service = None
    if ocr_service is not None:
        ocr_service.close()
        ocr_service = None


script_callbacks.on_script_unloaded(close_service)
script_callbacks.on_ui_settings(settings)
script_callbacks.on_ui_tabs(on_tabs)
script_callbacks.on_app_started(register_api)
