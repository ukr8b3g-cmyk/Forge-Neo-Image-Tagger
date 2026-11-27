"""Local image tagging for Forge Neo."""

from pathlib import Path
import json


PIXAI = "pixai_v1_fp16"
WD = "wd_eva02_large_v3"
MODES = {"wd": WD, "pixai": PIXAI}
MODELS = {
    model["id"]: model
    for model in json.loads(Path(__file__).with_name("models.json").read_text(encoding="utf-8"))["models"]
}


class TaggerError(Exception):
    def __init__(self, code, detail=""):
        super().__init__(detail or code)
        self.code = code
        self.detail = detail
