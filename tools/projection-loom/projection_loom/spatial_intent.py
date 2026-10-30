"""Bounded architectural intent interpreted by Fire, never inferred from prose.

The independent IntentContract owns why a location is proposed; this document
binds its digest to explicitly authored, testable spatial relationships.
Neither a story nor a visual reference silently becomes a route or a survey.
"""
from __future__ import annotations
from dataclasses import dataclass
from math import isfinite
import re
from .provenance_encoding import canonical_json_sha256

KINDS=frozenset(("connect","shelter","ascend","bear"))
_HANDLE=re.compile(r"^[A-Za-z][A-Za-z0-9_-]{0,63}$")


@dataclass(frozen=True)
class SpatialGoal:
    kind: str
    subject: str
    object: str
    min_width: float = 0.8
    max_step: float = 1.1

    def __post_init__(self):
        if self.kind not in KINDS or not all(
                isinstance(v,str) and _HANDLE.fullmatch(v)
                for v in (self.subject,self.object)) or self.subject==self.object:
            raise ValueError("Spatial goal requires distinct named endpoints and supported relation")
        for value in (self.min_width,self.max_step):
            if type(value) not in (int,float) or not isfinite(value) or value<=0 or value>8:
                raise ValueError("Spatial goal needs finite bounded dimensions")

    def to_dict(self):
        return {"kind":self.kind,"subject":self.subject,"object":self.object,
                "min_width":float(self.min_width),"max_step":float(self.max_step)}

    @classmethod
    def from_dict(cls,doc):
        if not isinstance(doc,dict) or set(doc)!={
                "kind","subject","object","min_width","max_step"}:
            raise ValueError("Spatial goal requires exact typed fields")
        return cls(**doc)


@dataclass(frozen=True)
class SpatialIntent:
    intent_sha256: str
    goals: tuple[SpatialGoal,...]
    authored_by: str

    def __post_init__(self):
        if not re.fullmatch(r"[a-f0-9]{64}",self.intent_sha256):
            raise ValueError("Spatial intent must bind the existing IntentContract digest")
        if not self.authored_by or not isinstance(self.authored_by,str):
            raise ValueError("Spatial interpretation needs an attributable author")
        if not 1<=len(self.goals)<=8 or not all(isinstance(g,SpatialGoal) for g in self.goals):
            raise ValueError("Spatial interpretation supports one to eight typed goals")
        keys=[(g.kind,g.subject,g.object) for g in self.goals]
        if len(set(keys))!=len(keys) or keys!=sorted(keys):
            raise ValueError("Spatial goals must be unique and ordered")

    @property
    def identity(self):
        return canonical_json_sha256(self.to_dict())

    def to_dict(self):
        return {"schema":"projection-loom/spatial-intent","intent_sha256":self.intent_sha256,
                "authored_by":self.authored_by,"goals":[g.to_dict() for g in self.goals]}

    @classmethod
    def from_dict(cls,doc):
        if not isinstance(doc,dict) or set(doc)!={"schema","intent_sha256","authored_by","goals"} or doc.get("schema")!="projection-loom/spatial-intent":
            raise ValueError("Not a typed Fire-authored spatial intent")
        if not isinstance(doc["goals"],list):
            raise ValueError("Spatial goals must be a list")
        return cls(doc["intent_sha256"],tuple(SpatialGoal.from_dict(g) for g in doc["goals"]),doc["authored_by"])

    def bind(self,intent):
        if self.intent_sha256!=intent.identity:
            raise ValueError("Spatial interpretation references a stale intent")
        return self
