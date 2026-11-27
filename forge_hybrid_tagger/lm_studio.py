"""LM Studio image and text requests, and a persistent library for Image Tagger."""
import base64
from contextlib import closing
from io import BytesIO
import json
from ipaddress import ip_address
import logging
import re
import sqlite3
from time import monotonic, sleep
from typing import Literal
from urllib.parse import urlsplit

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError
import requests

from . import TaggerError
from .inference import decode_image

logger = logging.getLogger(__name__)
DEFAULT_URL = "http://127.0.0.1:1234"

# Values are (temperature, top_p) from the respective publisher's model card.
# Qwen's VL and Text settings differ. None leaves that parameter to LM Studio.
SAMPLING_PROFILES = {
    "qwen3-vl-8b-instruct": ("qwen", "Qwen3-VL-8B-Instruct", (0.7, 0.8), (1.0, 1.0)),
    "gemma-4-26b-a4b-it": ("google", "Gemma 4 26B-A4B-it", (1.0, 0.95), (1.0, 0.95)),
    "mistral-small-3.1-24b-instruct-2503": ("mistralai", "Mistral Small 3.1 24B Instruct", (0.15, None), (0.15, None)),
    "bonsai-8b": ("prism-ml", "Bonsai-8B", None, (0.5, 0.9)),
}


def sampling_profile(model):
    key = model["key"].lower()
    namespace, _, name = key.rpartition("/")
    publisher = str(model.get("publisher") or namespace).lower()
    # Strip packaging suffixes only. Preserve revision and fine-tune names.
    name = re.sub(r"(?:\.gguf|[-_]gguf|[-.@_](?:ud-)?(?:i?q\d+(?:_[a-z0-9]+)*|bf16|f16))+$", "", name)
    base = name == "qwen3-vl-8b-nsfw-caption-v4.5"
    if base and publisher in {"thesby", "mradermacher"} and namespace in {"", publisher}:
        name = "qwen3-vl-8b-instruct"
    profile = SAMPLING_PROFILES.get(name)
    if profile:
        author, source, image, text = profile
        packagers = {author, "lmstudio-community", "bartowski", "unsloth", "mradermacher"}
        if base or (publisher in packagers and (not namespace or namespace in packagers)):
            return {"source": source, "base": base, "image": image, "text": text}

    # Some fine-tunes expose only the original architecture, others only a model name.
    for identity in (name, model.get("architecture"), model.get("display_name")):
        match = re.search(r"(?:^|[^a-z0-9])(bonsai|qwen|gemma|mistral|ministral|mixtral)(?=[^a-z]|$)",
                          str(identity or "").lower())
        if match:
            family = match[1]
            if family in {"bonsai", "qwen"}:
                source, image, text = "Qwen", (0.7, 0.8), (1.0, 1.0)
            elif family == "gemma":
                source, image, text = "Gemma", (1.0, 0.95), (1.0, 0.95)
            else:
                source, image, text = "Mistral", (0.15, None), (0.15, None)
            return {"source": source, "family": True, "image": image, "text": text}
    return None


def is_local_server(url):
    host = urlsplit(url).hostname
    if host == "localhost":
        return True
    try:
        return ip_address(host).is_loopback
    except ValueError:
        return False

Task = Literal["tags", "caption", "expand"]
Kind = Literal["presets", "systems"]
Section = Literal["subject", "appearance", "action", "scene", "composition", "style"]


class PromptItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    section: Section
    level: Literal["standard", "detailed", "full"]
    text: str = Field(min_length=1)


class Inscription(BaseModel):
    model_config = ConfigDict(extra="forbid")

    section: Section
    text: str = Field(min_length=1, description="Exact original lettering only, in its original script.")


class PromptItems(BaseModel):
    model_config = ConfigDict(extra="forbid")

    inscriptions: list[Inscription] = Field(default_factory=list)
    items: list[PromptItem]


def prompt_item_format(sections=None):
    item = PromptItem.model_json_schema()
    inscription = Inscription.model_json_schema()
    if sections:
        item["properties"]["section"]["enum"] = list(sections)
        inscription["properties"]["section"]["enum"] = list(sections)
    return {
        "type": "json_schema",
        "json_schema": {
            "name": "image_tagger_prompt",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "inscriptions": {"type": "array", "items": inscription},
                    "items": {"type": "array", "items": item, "minItems": 0 if sections else 1},
                },
                "required": ["inscriptions", "items"],
                "additionalProperties": False,
            },
        },
    }


PROMPT_ITEM_FORMAT = prompt_item_format()


def quoted_wording(seed):
    """Keep source spans so explicit dialogue can survive a model omission."""
    for match in re.finditer(r'「([^」]+)」|『([^』]+)』|“([^”]+)”|"([^"]+)"', seed):
        before = seed[:match.start()].rstrip()
        after = seed[match.end():].lstrip()
        speech = re.search(r"\b(?:says|reads|is saying)\s*[:,]?\s*$", before, re.I)
        japanese = re.match(r"(?:と(?:言[ういっ]|話[すし]|書(?:いた|かれ[たて]))|というセリフ)", after)
        yield match[match.lastindex], bool(speech or japanese)


class Preset(BaseModel):
    task: Task
    instruction: str = ""
    temperature: float | None = Field(None, ge=0)
    top_p: float | None = Field(None, gt=0, le=1)
    max_tokens: int | None = Field(None, gt=0)


class Generation(Preset):
    model: str = Field(min_length=1)
    memory: Literal["forge", "immediate", "server"] = "forge"
    system: str = ""
    text: str = ""
    tiers: bool = False
    sections: list[Section] | None = Field(None, min_length=1)


class SystemPrompt(BaseModel):
    text: str = Field(min_length=1)


class Entry(BaseModel):
    name: str = Field(min_length=1)
    preset: Preset | None = None
    system: SystemPrompt | None = None
    overwrite: bool = False


class Connection(BaseModel):
    url: str


class Studio:
    def __init__(self, database):
        self.database = database

    def connect(self):
        self.database.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(self.database)
        try:
            db.execute("CREATE TABLE IF NOT EXISTS library (kind TEXT, name TEXT, data TEXT NOT NULL, PRIMARY KEY (kind, name))")
            db.execute("CREATE TABLE IF NOT EXISTS connection (id INTEGER PRIMARY KEY, url TEXT NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS analysis_instances (url TEXT, model TEXT, instance TEXT, PRIMARY KEY (url,instance))")
        except sqlite3.Error:
            db.close()
            raise
        return db

    def url(self):
        with closing(self.connect()) as db:
            row = db.execute("SELECT url FROM connection WHERE id=1").fetchone()
        return row[0] if row else DEFAULT_URL

    def set_url(self, raw):
        url = raw.strip().rstrip("/")
        try:
            parts = urlsplit(url)
            port = parts.port
            valid = (parts.scheme in {"http", "https"} and parts.hostname and not parts.username and
                     not parts.password and not parts.path and not parts.query and not parts.fragment and
                     (port is None or port > 0))
        except ValueError:
            valid = False
        if not valid:
            raise HTTPException(400, "lm_url")
        with closing(self.connect()) as db, db:
            db.execute("INSERT OR REPLACE INTO connection VALUES (1, ?)", (url,))
        return url

    def entries(self, kind):
        with closing(self.connect()) as db:
            rows = db.execute("SELECT name,data FROM library WHERE kind=? ORDER BY name COLLATE NOCASE", (kind,))
            return [{"name": name, **json.loads(value)} for name, value in rows]

    def save(self, kind, entry):
        value = entry.preset if kind == "presets" else entry.system
        name = entry.name.strip()
        if not value or not name or (kind == "systems" and not value.text.strip()):
            raise HTTPException(400, "lm_empty")
        with closing(self.connect()) as db, db:
            sql = "INSERT INTO library(kind,name,data) VALUES (?,?,?)"
            if entry.overwrite:
                sql += " ON CONFLICT(kind,name) DO UPDATE SET data=excluded.data"
            try:
                db.execute(sql, (kind, name, json.dumps(value.model_dump(), ensure_ascii=False)))
            except sqlite3.IntegrityError as exc:
                raise HTTPException(409, "lm_exists") from exc

    def remove(self, kind, name):
        with closing(self.connect()) as db, db:
            db.execute("DELETE FROM library WHERE kind=? AND name=?", (kind, name))

    def request(self, method, path, *, url=None, timeout=None, **kwargs):
        try:
            response = requests.request(method, (url or self.url()) + path, allow_redirects=False,
                                        timeout=timeout or (5, 300 if method == "POST" else 10), **kwargs)
        except requests.Timeout as exc:
            raise HTTPException(504, "lm_timeout") from exc
        except requests.ConnectionError as exc:
            raise HTTPException(503, "lm_offline") from exc
        except requests.RequestException as exc:
            raise HTTPException(502, "lm_response") from exc
        try:
            data = response.json()
        except ValueError as exc:
            raise HTTPException(502, "lm_response") from exc
        if response.status_code != 200 or not isinstance(data, dict) or data.get("error"):
            error = data.get("error") if isinstance(data, dict) else None
            detail = error.get("message") if isinstance(error, dict) else error
            raise HTTPException(502, str(detail or "lm_response")[:800])
        return data

    def models(self, url=None):
        data = self.request("GET", "/api/v1/models", url=url, timeout=(2, 5))
        if not isinstance(data.get("models"), list):
            raise HTTPException(502, "lm_response")
        results = []
        for model in data["models"]:
            if not isinstance(model, dict):
                raise HTTPException(502, "lm_response")
            if model.get("type") != "llm" or not model.get("key"):
                continue
            capabilities = model.get("capabilities") or {}
            instances = model.get("loaded_instances")
            if not isinstance(model["key"], str) or not isinstance(capabilities, dict) or not isinstance(instances, list):
                raise HTTPException(502, "lm_response")
            if any(not isinstance(i, dict) or not isinstance(i.get("id"), str) or not i["id"] for i in instances):
                raise HTTPException(502, "lm_response")
            entry = {"key": model["key"], "vision": bool(capabilities.get("vision")),
                     "instances": [i["id"] for i in instances]}
            if profile := sampling_profile(model):
                entry["sampling"] = profile
            results.append(entry)
        return results

    def remember(self, url, model, instance, track):
        with closing(self.connect()) as db, db:
            if track:
                db.execute("INSERT OR REPLACE INTO analysis_instances VALUES (?,?,?)", (url, model, instance))
            else:
                db.execute("DELETE FROM analysis_instances WHERE url=? AND instance=?", (url, instance))

    def purge(self, url, model, targets=None):
        def loaded():
            return next((set(m["instances"]) for m in self.models(url) if m["key"] == model), set())

        remaining = loaded()
        requested = remaining.copy() if targets is None else set(targets)
        for instance in sorted(requested & remaining):
            try:
                self.request("POST", "/api/v1/models/unload", url=url, json={"instance_id": instance}, timeout=(2, 20))
            except HTTPException:
                if instance in loaded():
                    raise
        if requested & remaining:
            deadline = monotonic() + 8
            while (loaded() if targets is None else requested & loaded()):
                if monotonic() >= deadline:
                    raise HTTPException(503, "lm_release_pending")
                sleep(0.2)
        with closing(self.connect()) as db, db:
            if targets is None:
                db.execute("DELETE FROM analysis_instances WHERE url=? AND model=?", (url, model))
            else:
                db.executemany("DELETE FROM analysis_instances WHERE url=? AND instance=?", [(url, i) for i in requested])
        return {"released": True}

    def before_forge(self):
        if not self.database.exists():
            return
        try:
            with closing(self.connect()) as db:
                rows = db.execute("SELECT url,model,instance FROM analysis_instances").fetchall()
        except (OSError, sqlite3.Error) as exc:
            logger.warning("Image Tagger could not read its LM Studio unload list before Forge generation: %s", exc)
            return
        for url, model, instance in rows:
            try:
                self.purge(url, model, [instance])
            except (HTTPException, OSError, sqlite3.Error) as exc:
                logger.warning("Image Tagger could not verify unload of %s before Forge generation: %s", instance, exc)

    def generate(self, config, image=None, *, url=None):
        url = url or self.url()
        if config.task == "expand" and not config.text.strip():
            raise HTTPException(400, "lm_text")
        request_text = {"tags": "Tag this image.", "caption": "Describe this image.", "expand": config.text.strip()}
        if config.task != "expand" and config.tiers:
            request_text[config.task] += (
                " What do the readable words in the selected topics say? Transcribe them in their original "
                "script in inscriptions first, then write the visual prompt in items. Use English for "
                "the visual prompt unless another description language was requested."
            )
        content = [{"type": "text", "text": request_text[config.task]}]
        if config.task != "expand":
            if not image:
                raise HTTPException(400, "lm_image")
            try:
                rgb = decode_image(image)
            except TaggerError as exc:
                raise HTTPException(400, exc.code) from exc
            rgb.thumbnail((2048, 2048))
            stream = BytesIO()
            rgb.convert("RGB").save(stream, "JPEG", quality=92)
            encoded = base64.b64encode(stream.getvalue()).decode("ascii")
            content.append({"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + encoded}})
        messages = []
        system_parts = [config.system.strip(), config.instruction.strip()]
        if config.task != "expand":
            system_parts.append(
                "Transcribe clearly readable text relevant to the selected topics, including dialogue in "
                "speech bubbles, signs and labels. Quote it verbatim in its original language, script and "
                "punctuation within the prompt, even when the surrounding description or tags are English. "
                "In tags, keep each quoted inscription intact. Keep separate speakers' lines separate. "
                "Leave illegible wording out. Do not translate, romanize or invent an inscription."
            )
        sections = tuple(dict.fromkeys(config.sections or ())) if config.task != "expand" else ()
        if config.tiers:
            wording = (
                "Use comma-separated Danbooru tags inside each item's text."
                if config.task == "tags"
                else "Use standalone phrases or sentences in the requested prompt style inside each item's text."
            )
            grounding = "Use only visible details from the reference image. " if config.task != "expand" else ""
            if sections:
                tier_guidance = (
                    "Stay within these image topics: " + ", ".join(sections) + ". "
                    "Keep observations specific to their section. Give each visibly supported topic a brief overview. "
                    "Place the main observation at level standard, more detail at detailed and finer distinctions at full. "
                    "If none of the selected topics has visible evidence, return an empty items array. "
                )
            else:
                tier_guidance = (
                    "Group related details by section, typically in three to eight compact items. "
                    "The level is the first tier that includes the item. Use standard for the main subjects, actions, "
                    "and setting. Use detailed for prominent appearance, objects, and framing. Use full for "
                    "secondary details such as material, texture, lighting nuances, and small visible objects. "
                    "Include at least one standard item and use all three tiers when the input supports them. "
                )
            lettering = (
                "Copy the user's exact words explicitly intended as dialogue or visible writing into inscriptions. "
                "Do not copy the seed description itself. "
                if config.task == "expand" else
                "Look inside speech bubbles and at signs and labels. Copy clearly readable lettering "
                "relevant to the selected topics into inscriptions, one entry per utterance or inscription. "
            )
            system_parts.append(
                "Output format: return one JSON object. Fill inscriptions first. " + lettering +
                "Use the original characters even when the prompt is in another language. Return an empty array "
                "if there is no such writing. In the items array use the requested output language "
                "for the surrounding prompt, regardless of the language of any inscriptions. Describe the "
                "speaker or the location of text without adding a translation, pronunciation or gloss. "
                "Each item has section, level, and text and is one independently usable prompt line. " + tier_guidance +
                "Add distinct details without repeating earlier items. " + wording + " " + grounding +
                "Return positive prompt content only. Omit negative prompts and generic quality boosters "
                "such as masterpiece, best quality, and high quality."
            )
        system = "\n\n".join(filter(None, system_parts))
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": content if image else content[0]["text"]})
        payload = config.model_dump(include={"model", "temperature", "top_p", "max_tokens"}, exclude_none=True)
        if config.tiers:
            payload["response_format"] = prompt_item_format(sections) if sections else PROMPT_ITEM_FORMAT
        instances = next((m["instances"] for m in self.models(url) if m["key"] == config.model), [])
        instance = config.model if config.model in instances or not instances else instances[0]
        local = is_local_server(url)
        if local:
            self.remember(url, config.model, instance, config.memory != "server")
        payload["model"] = instance
        try:
            data = self.request("POST", "/v1/chat/completions", url=url, json={**payload, "messages": messages, "stream": False})
        except HTTPException:
            if config.memory == "immediate":
                try:
                    self.purge(url, config.model, [instance])
                except HTTPException as exc:
                    logger.warning("Image Tagger could not verify unload after failed analysis: %s", exc.detail)
            raise
        release_error = None
        if config.memory == "immediate":
            try:
                self.purge(url, config.model, [instance])
            except HTTPException as exc:
                release_error = exc.detail
        try:
            text = data["choices"][0]["message"]["content"]
        except (IndexError, KeyError, TypeError) as exc:
            raise HTTPException(502, "lm_response") from exc
        if not isinstance(text, str) or not text.strip():
            raise HTTPException(502, "lm_no_output")
        if not config.tiers:
            return {"text": text.strip(), "releaseError": release_error}

        try:
            parsed = PromptItems.model_validate_json(text)
            items = [item.model_dump() for item in parsed.items if item.text.strip() and (not sections or item.section in sections)]
        except ValidationError as exc:
            raise HTTPException(502, "lm_levels") from exc
        quotes = list(quoted_wording(config.text)) if config.task == "expand" else []
        inscriptions = list(parsed.inscriptions)
        for literal, explicit in quotes:
            if explicit and not any(entry.text.strip() == literal for entry in inscriptions):
                inscriptions.append(Inscription(section="subject", text=literal))
        for inscription in inscriptions:
            literal = inscription.text.strip()
            if not literal or (sections and inscription.section not in sections):
                continue
            if config.task == "expand" and literal not in config.text:
                # Some models wrap the transcription in an explanation. Recover only
                # source-quoted words that the model identified in this inscription.
                matches = [wording for wording, _ in quotes if wording in literal]
                if len(matches) != 1:
                    continue
                literal = matches[0]
            existing = next((item for item in items if literal in item["text"]), None)
            if existing:
                existing["level"] = "standard"
            else:
                items.append({"section": inscription.section, "level": "standard", "text": f'"{literal}"'})
        if not any(item["level"] == "standard" for item in items):
            if not sections:
                raise HTTPException(502, "lm_levels")
            if not items:
                return {"items": [], "text": "", "releaseError": release_error}
            # A model may classify every observation on a focused topic as an extra detail.
            main = next((item for item in items if item["level"] == "detailed"), items[0])
            main["level"] = "standard"
        for item in items:
            item["text"] = item["text"].strip()
        if not any(item["level"] == "full" for item in items):
            details = [item for item in items if item["level"] == "detailed"]
            # When a model omits Full, reserve later details for it when enough were generated.
            for item in details[(len(details) + 1) // 2:]:
                item["level"] = "full"
        detailed = "\n".join(item["text"] for item in items if item["level"] != "full")
        return {"items": items, "text": detailed, "releaseError": release_error}
