"""Subject-independent seeds, intent and deterministic run identities.

Evidence does not inherit authority from a convenient renderer. The three
Experiment Zero formats are clients of this contract, never dependencies.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from hashlib import sha256
from pathlib import Path
from typing import Mapping
import json
import re

from .provenance_encoding import canonical_json_sha256

_SHA = re.compile(r"^[0-9a-f]{64}$")
# The generic seed substrate accepts attributed capability names. Named source
# adapters validate their own payloads and frames; a novel producer does not
# require an edit to this module's kind-switch.
_KIND_NAME = re.compile(r"^[a-z][a-z0-9-]{2,63}$")
AUTHORITIES = frozenset({"source", "proposed"})


def _missing_capability_frame(kind):
    raise ValueError(f"New capability {kind!r} must explicitly name its source frame")


def _canonical(value):
    return json.loads(json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False))


def _digest(value):
    return canonical_json_sha256(_canonical(value))


@dataclass(frozen=True)
class SeedEntry:
    kind: str
    content_sha256: str
    locator: str
    frame_kind: str
    authority: str
    channels: tuple[tuple[str, str], ...] = ()
    metadata: tuple[tuple[str, str], ...] = ()

    def __post_init__(self):
        if not isinstance(self.kind, str) or not _KIND_NAME.fullmatch(self.kind) or self.authority not in AUTHORITIES:
            raise ValueError("Invalid seed capability name or authority")
        if not _SHA.fullmatch(self.content_sha256):
            raise ValueError("Seed requires a complete content SHA256")
        if not isinstance(self.locator,str) or not self.locator:
            raise ValueError("Seed locator required")
        if self.frame_kind not in ("pixel", "local3d", "none"):
            raise ValueError("Unknown seed frame")
        if self.kind == "image-group" and self.frame_kind != "pixel":
            raise ValueError("Image-group must have a pixel frame")
        if self.kind == "geometry-proxy" and self.frame_kind != "local3d":
            raise ValueError("Proxy must declare local3d")
        if self.kind == "constructive-grammar" and self.frame_kind != "none":
            raise ValueError("Grammar does not imply a geometric frame")
        c = tuple(self.channels)
        if c != tuple(sorted(set(c))) or any(
                not name or not _SHA.fullmatch(digest) for name,digest in c):
            raise ValueError("Channels must be sorted unique names and verified digests")
        if tuple(self.metadata) != tuple(sorted(set(self.metadata))):
            raise ValueError("Metadata must be normalized")
        if self.kind != "image-group" and c:
            raise ValueError("Non-image seeds cannot declare image channels")

    @classmethod
    def from_file(cls, kind, path, *, frame_kind=None, authority=None,
                  channels=(), metadata=()):
        p = Path(path).resolve(strict=True)
        data=p.read_bytes()
        return cls(kind,sha256(data).hexdigest(),str(p),
                   frame_kind or {"image-group":"pixel",
                                  "constructive-grammar":"none",
                                  "geometry-proxy":"local3d"}.get(kind)
                   or _missing_capability_frame(kind),
                   authority or ("source" if kind=="image-group" else "proposed"),
                   tuple(sorted(channels)),tuple(sorted(metadata)))

    @property
    def identity(self):
        return _digest({"kind":self.kind, "digest":self.content_sha256,
                        "frame":self.frame_kind, "channels":self.channels,
                        "metadata":self.metadata, "authority":self.authority})

    def manifest(self):
        return {"kind":self.kind,"content_sha256":self.content_sha256,
                "frame_kind":self.frame_kind,"authority":self.authority,
                "channels":dict(self.channels),"metadata":dict(self.metadata),
                "identity":self.identity}

    def verify_file(self):
        p=Path(self.locator)
        if not p.is_file():
            raise FileNotFoundError(str(p))
        if sha256(p.read_bytes()).hexdigest()!=self.content_sha256:
            raise ValueError("Seed bytes changed after admission")
        return True


@dataclass(frozen=True)
class SeedBundle:
    entries: tuple[SeedEntry, ...]

    def __post_init__(self):
        if not self.entries or not all(isinstance(e, SeedEntry) for e in self.entries):
            raise ValueError("A seed bundle needs typed entries")
        unique={e.identity:e for e in self.entries}
        if len(unique)!=len(self.entries):
            raise ValueError("Repeated seed entity, not a new observation")
        object.__setattr__(self,"entries",tuple(sorted(unique.values(),key=lambda x:x.identity)))

    @property
    def identity(self):
        return _digest([e.identity for e in self.entries])

    def verify_files(self):
        return {e.identity:e.verify_file() for e in self.entries}

    def kinds(self):
        return tuple(sorted({e.kind for e in self.entries}))

    def manifest(self):
        return {"schema":"projection-loom/seed-bundle",
                "identity":self.identity,
                "entries":[e.manifest() for e in self.entries]}


@dataclass(frozen=True)
class IntentContract:
    location: str
    aim: str
    objectives: tuple[str, ...]
    invariants: tuple[str, ...] = ()
    budgets: tuple[tuple[str, int], ...] = ()

    def __post_init__(self):
        if not self.location or not self.aim or not self.objectives:
            raise ValueError("Intent needs a location, aim and objectives")
        for k,v in self.budgets:
            if not isinstance(k,str) or not k or type(v) is not int or v<0:
                raise ValueError("Invalid bounded intent budget")
        if (tuple(self.objectives)!=tuple(sorted(set(self.objectives))) or
                tuple(self.invariants)!=tuple(sorted(set(self.invariants))) or
                tuple(self.budgets)!=tuple(sorted(set(self.budgets)))):
            raise ValueError("Intent fields must be canonical and unique")

    @property
    def identity(self):
        return _digest({"location":self.location,"aim":self.aim,
                        "objectives":self.objectives,"invariants":self.invariants,
                        "budgets":self.budgets})


@dataclass(frozen=True)
class GrowthContext:
    seeds: SeedBundle
    intent: IntentContract
    grammar_sha256: str
    kernel_sha256: str
    root_seed: int
    namespace: str = "projection-loom"

    def __post_init__(self):
        if not _SHA.fullmatch(self.grammar_sha256) or not _SHA.fullmatch(self.kernel_sha256):
            raise ValueError("Execution requires pinned grammar and kernel digests")
        if type(self.root_seed) is not int or self.root_seed<0:
            raise ValueError("Invalid deterministic root RNG seed")

    @property
    def run_id(self):
        return _digest({"seeds":self.seeds.identity, "intent":self.intent.identity,
                        "grammar":self.grammar_sha256,"kernel":self.kernel_sha256,
                        "root_seed":self.root_seed,"namespace":self.namespace})

    def substream_seed(self, *semantic_path):
        """Stable stream independent of process order, worker count or global RNG."""
        path=[str(x) for x in semantic_path]
        return int(_digest({"run":self.run_id,"path":path})[:16],16)


def normalize_location(seeds: SeedBundle, intent: IntentContract):
    """Normalize seeds through the sole source/frame admission owner."""
    from .location_stack import LocationStack
    return LocationStack.admit_seed_bundle(seeds, intent)
