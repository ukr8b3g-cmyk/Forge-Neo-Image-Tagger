"""Store batch scores and a shared label vocabulary in the local Forge data directory."""

from array import array
from contextlib import closing
from hashlib import sha256
import json
import logging
import sqlite3
from sys import byteorder
from zlib import compress, decompress, error as CompressionError

from . import MODELS


logger = logging.getLogger(__name__)
# Increase this if image preprocessing or score interpretation changes.
CACHE_VERSION = 1
MODEL_FIELDS = ("sha256", "metadata", "preprocess_metadata", "input", "output", "categories")
CACHE_ERRORS = (OSError, sqlite3.Error, CompressionError, ValueError, TypeError, KeyError)
SCHEMA = """
CREATE TABLE IF NOT EXISTS vocabulary (
    revision TEXT PRIMARY KEY,
    labels BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS results (
    image TEXT NOT NULL,
    revision TEXT NOT NULL,
    device TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    metadata TEXT NOT NULL,
    scores BLOB NOT NULL,
    PRIMARY KEY (image, revision, device)
);
"""


class SavedResults:
    def __init__(self, path):
        self.path = path
        self.revisions = {
            model_id: sha256(json.dumps(
                [CACHE_VERSION, model_id, {field: model.get(field) for field in MODEL_FIELDS}],
                sort_keys=True,
            ).encode()).hexdigest()
            for model_id, model in MODELS.items()
        }
        self.labels = {}
        self.last_error = None

    def warn(self, error):
        message = str(error)
        if message != self.last_error:
            self.last_error = message
            logger.warning("Image Tagger batch cache: %s", error)

    def get(self, image, model_id, device):
        revision = self.revisions[model_id]
        row_count = MODELS[model_id]["metadata"]["rows"]
        try:
            if not self.path.is_file():
                return None
            with closing(sqlite3.connect(self.path, timeout=1)) as db:
                result = db.execute(
                    "SELECT width, height, metadata, scores FROM results WHERE image=? AND revision=? AND device=?",
                    (image, revision, device),
                ).fetchone()
                if result is None:
                    return None
                if revision not in self.labels:
                    vocabulary = db.execute(
                        "SELECT labels FROM vocabulary WHERE revision=?", (revision,)
                    ).fetchone()
                    if vocabulary is None:
                        raise ValueError("stored model vocabulary is missing")
                    (packed_labels,) = vocabulary
                    labels = json.loads(decompress(packed_labels))
                    if not isinstance(labels, list) or len(labels) != row_count or any(
                        not isinstance(label, list) or len(label) != 2 or not all(isinstance(value, str) for value in label)
                        for label in labels
                    ):
                        raise ValueError("stored model vocabulary is invalid")
                    self.labels[revision] = (labels, packed_labels)
            width, height, metadata, packed_scores = result
            scores = array("f")
            scores.frombytes(decompress(packed_scores))
            if byteorder != "little":
                scores.byteswap()
            labels, _ = self.labels[revision]
            if len(scores) != len(labels) or len(scores) != row_count:
                raise ValueError("stored score count does not match the model vocabulary")
            if any(not 0 <= score <= 1 for score in scores):
                raise ValueError("stored scores are outside their valid range")
            outcome = json.loads(metadata)
            outcome["rows"] = [(name, category, score) for (name, category), score in zip(labels, scores)]
            return outcome, width, height
        except CACHE_ERRORS as error:
            self.warn(error)
            return None

    def put(self, image, model_id, device, outcome, width, height):
        revision = self.revisions[model_id]
        try:
            if revision not in self.labels:
                labels = [(name, category) for name, category, _ in outcome["rows"]]
                packed = compress(json.dumps(labels, ensure_ascii=False, separators=(",", ":")).encode(), level=1)
                self.labels[revision] = (labels, packed)
            _, packed_labels = self.labels[revision]
            scores = array("f", (score for _, _, score in outcome["rows"]))
            if byteorder != "little":
                scores.byteswap()
            packed_scores = compress(scores.tobytes(), level=1)
            metadata = json.dumps({key: value for key, value in outcome.items() if key != "rows"})
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with closing(sqlite3.connect(self.path, timeout=1)) as db, db:
                db.executescript(SCHEMA)
                db.execute(
                    """INSERT INTO vocabulary VALUES (?, ?)
                    ON CONFLICT(revision) DO UPDATE SET labels=excluded.labels
                    WHERE vocabulary.labels != excluded.labels""",
                    (revision, packed_labels),
                )
                db.execute(
                    "INSERT OR REPLACE INTO results VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (image, revision, device, width, height, metadata, packed_scores),
                )
        except CACHE_ERRORS as error:
            self.warn(error)
