"""Own the ONNX sessions for the single analysis worker."""

from math import ceil
from threading import Lock, Timer
from time import monotonic

from . import TaggerError


POLICIES = ("immediate", "idle", "keep")
DEFAULT_IDLE_SECONDS = 60
MAX_IDLE_SECONDS = 3600


class ModelSessions:
    def __init__(self):
        self.guard = Lock()
        self.entries = {}
        self.active = None
        self.discard_active = False
        self.policy = "immediate"
        self.idle_seconds = DEFAULT_IDLE_SECONDS
        self.timer = None
        self.deadline = None
        self.last_release = None
        self.manual_revision = 0
        self.closed = False

    def revision(self):
        with self.guard:
            return self.manual_revision

    def begin(self, key, revision):
        with self.guard:
            if self.closed:
                raise TaggerError("cancelled")
            self._cancel_timer()
            # Keep at most one session per model, including when its device or path changes.
            for previous in tuple(self.entries):
                if previous[0] == key[0] and previous != key:
                    del self.entries[previous]
            self.active = key
            self.last_release = None
            self.discard_active = revision != self.manual_revision
            return self.entries.get(key)

    def has(self, key):
        with self.guard:
            return key in self.entries

    def store(self, key, session):
        with self.guard:
            self.entries[key] = session

    def end(self, success):
        with self.guard:
            key, self.active = self.active, None
            if key in self.entries and (not success or self.discard_active or self.policy == "immediate"):
                del self.entries[key]
            self.discard_active = False
            self._schedule_timer()

    def configure(self, policy, idle_seconds):
        with self.guard:
            self.policy = policy
            self.idle_seconds = idle_seconds
            if policy == "immediate":
                # Let an in-flight inference finish before releasing its session.
                self._release("immediate")
            self._schedule_timer()
            return self._status()

    def release(self, reason, *, cuda_only=False, model_path=None):
        with self.guard:
            if reason == "manual":
                self.manual_revision += 1
            removed = self._release(reason, cuda_only, model_path)
            if not self.entries:
                self._cancel_timer()
            return removed

    def close(self):
        with self.guard:
            self.closed = True
            self._cancel_timer()
            self._release("shutdown")

    def status(self):
        with self.guard:
            return self._status()

    def _release(self, reason, cuda_only=False, model_path=None):
        def matches(key):
            return (key is not None and (not cuda_only or key[1] == "cuda")
                    and (model_path is None or key[2] == model_path))

        removed = 0
        if matches(self.active):
            self.discard_active = True
        # CUDA callers can release these idle sessions even while the CPU session is running.
        for key in tuple(self.entries):
            if key != self.active and matches(key):
                del self.entries[key]
                removed += 1
        if removed or matches(self.active):
            self.last_release = reason
        return removed

    def _cancel_timer(self):
        if self.timer:
            self.timer.cancel()
        self.timer = None
        self.deadline = None

    def _schedule_timer(self):
        self._cancel_timer()
        if self.closed or self.policy != "idle" or self.active is not None or not self.entries:
            return
        timer = Timer(self.idle_seconds, lambda: self._expire(timer))
        timer.daemon = True
        self.timer = timer
        self.deadline = monotonic() + self.idle_seconds
        timer.start()

    def _expire(self, timer):
        with self.guard:
            if self.timer is timer:
                self._cancel_timer()
                self._release("idle")

    def _status(self):
        def describe(key):
            return {"id": key[0], "device": key[1]}

        return {
            "policy": self.policy,
            "idleSeconds": self.idle_seconds,
            "remainingSeconds": None if self.deadline is None else max(0, ceil(self.deadline - monotonic())),
            "loaded": [describe(key) for key in self.entries],
            "active": describe(self.active) if self.active is not None else None,
            "pendingRelease": self.active is not None and self.discard_active,
            "lastRelease": self.last_release,
        }
