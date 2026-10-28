"""Causal relational edits on stable entities; not a second scene graph or CAD helm.

Events name independent observed frontiers; editor paths and geometry revisions
never substitute for a semantic entity's identity. Exact CAD needs new evidence
after a structural change. No operation certifies support, loads or clearance.
"""
from __future__ import annotations

from copy import deepcopy
from importlib.resources import files
import json
import math
from pathlib import Path

from jsonschema import Draft202012Validator

from .provenance_encoding import canonical_json_sha256

SCHEMA = "projection-loom/relational-ground"
EVENT_SCHEMA = "projection-loom/relational-operation"
ACTIONS = frozenset(("create", "attach", "detach", "reparent",
                     "transform", "remove", "bind-representation", "annotate"))
KINDS = frozenset(("location", "construct", "void", "site", "source", "observation"))
VERBS = frozenset(("contains", "supports", "touches", "decorates", "informs"))
AUTHORITY = frozenset(("source", "inferred", "proposed"))
IDENTITY = tuple(float(i == j) for i in range(4) for j in range(4))


def _digest(value):
    return canonical_json_sha256(value)


def _nonempty(value, label):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be nonblank")
    return value


def _matrix(value):
    if not isinstance(value, (list, tuple)) or len(value) != 16:
        raise ValueError("Local transform requires 16 affine coefficients")
    if any(type(x) not in (int, float) or not math.isfinite(x) for x in value):
        raise ValueError("Transform must be finite numeric values")
    matrix = tuple(float(x) for x in value)
    if matrix[12:] != (0.0, 0.0, 0.0, 1.0):
        raise ValueError("Transform last row must be affine")
    return list(matrix)


def _operation_schema():
    return json.loads(
        files("projection_loom").joinpath("contracts/relational-operation.schema.json")
        .read_text(encoding="utf8"))


def _check_operation(operation):
    Draft202012Validator(_operation_schema()).validate(operation)
    if operation["kind"] not in ACTIONS:
        raise ValueError("Unknown relational operation")
    if len(set(operation["frontier"])) != len(operation["frontier"]):
        raise ValueError("Repeated observed frontier event")
    payload = operation.get("payload", {})
    action = operation["kind"]
    if action == "create":
        if set(payload) - {"kind", "authority", "source_ids", "frame", "attributes"}:
            raise ValueError("Undeclared create fields")
        if payload.get("kind") not in KINDS or payload.get("authority", "proposed") not in AUTHORITY:
            raise ValueError("Unknown entity kind or authority")
        if payload.get("authority") == "source" and not payload.get("source_ids"):
            raise ValueError("Source authority requires source testimony")
        if payload.get("source_ids") is not None and (
            not isinstance(payload["source_ids"], list)
            or not all(isinstance(s, str) and s for s in payload["source_ids"])):
            raise ValueError("Invalid source witnesses")
        if payload.get("attributes") is not None and not isinstance(payload["attributes"], dict):
            raise ValueError("Invalid semantic attributes")
    elif action == "transform":
        if set(payload) != {"matrix", "frame"} or payload["frame"] != "local3d":
            raise ValueError("Transform requires an explicit local3d frame")
        _matrix(payload["matrix"])
    elif action in ("attach", "detach"):
        if set(payload) - {"parent", "verb", "required", "invalidate"}:
            raise ValueError("Undeclared relationship fields")
        _nonempty(payload.get("parent"), "Relation parent")
        if payload.get("verb", "supports") not in VERBS or type(payload.get("required", True)) is not bool:
            raise ValueError("Unknown relation semantics")
    elif action == "reparent":
        if set(payload) - {"old_parent", "new_parent", "invalidate"}:
            raise ValueError("Undeclared reparent fields")
        _nonempty(payload.get("old_parent"), "Former parent")
        _nonempty(payload.get("new_parent"), "New parent")
    elif action == "remove":
        if set(payload) - {"invalidate"}:
            raise ValueError("Undeclared removal fields")
    elif action == "bind-representation":
        if set(payload) != {"path"} or not isinstance(payload["path"], str):
            raise ValueError("Representation requires an authored path")
    elif action == "annotate":
        if set(payload) != {"note"} or not isinstance(payload["note"], str) or not payload["note"].strip():
            raise ValueError("Annotation requires a nonblank note")
    if action in ("remove", "detach", "reparent") and (
        "invalidate" in payload and type(payload["invalidate"]) is not bool):
        raise ValueError("Invalidation consent must be boolean")


def _descendants(entities, links, entity):
    children = {key: set() for key in entities}
    for link in links:
        if link["required"]:
            children[link["parent"]].add(link["child"])
    found, pending = set(), list(children.get(entity, ()))
    while pending:
        current = pending.pop()
        if current not in found:
            found.add(current)
            pending.extend(children[current])
    return found


def _validate_snapshot(entities, links):
    if len(links) != len({(r["parent"], r["child"], r["verb"]) for r in links}):
        raise ValueError("Repeated semantic relation")
    for link in links:
        if link["parent"] not in entities or link["child"] not in entities:
            raise ValueError("Dangling semantic relation")
        if link["parent"] == link["child"]:
            raise ValueError("Self-dependent structure")
    # Both containment and support are directional dependencies.
    for handle in entities:
        if handle in _descendants(entities, links, handle):
            raise ValueError("Required structural relation forms a cycle")


def _apply_one(entities, links, operation):
    action, target = operation["kind"], operation["target"]
    payload = operation.get("payload", {})
    if action == "create":
        if target in entities:
            raise ValueError("Entity already exists; use a new causal identity")
        entities[target] = {
            "id": target, "kind": payload["kind"],
            "authority": payload.get("authority", "proposed"),
            "source_ids": list(payload.get("source_ids", [])),
            "frame": payload.get("frame", "none"),
            "attributes": deepcopy(payload.get("attributes", {})),
            "matrix": list(IDENTITY), "representation": None,
            "annotations": [], "invalidated": False, "revision": ""}
        entities[target]["revision"] = _digest(
            {"kind": entities[target]["kind"], "attributes": entities[target]["attributes"],
             "source_ids": entities[target]["source_ids"], "matrix": entities[target]["matrix"]})
        return
    if target not in entities:
        raise ValueError("Operation targets a nonexistent entity")
    ent = entities[target]
    if operation.get("expected_revision") is not None and ent["revision"] != operation["expected_revision"]:
        raise ValueError("Stale semantic revision; fork or reconcile")
    if action == "transform":
        if ent["kind"] in ("source", "observation"):
            raise ValueError("Cannot rewrite source testimony by moving a representation")
        ent["matrix"] = _matrix(payload["matrix"])
        ent["frame"] = payload["frame"]
        ent["revision"] = _digest({"prior": ent["revision"], "transform": ent["matrix"]})
        for affected in _descendants(entities, links, target):
            entities[affected]["invalidated"] = True
    elif action == "attach":
        parent = payload["parent"]
        if parent not in entities:
            raise ValueError("Missing relation parent")
        relation = {"parent": parent, "child": target, "verb": payload.get("verb", "supports"),
                    "required": payload.get("required", True)}
        if relation in links:
            raise ValueError("Relation is already attached")
        links.append(relation)
        ent["invalidated"] = True  # newly connected geometry must be re-audited
    elif action == "detach":
        parent, verb = payload["parent"], payload.get("verb", "supports")
        matches = [r for r in links if r["child"] == target
                   and r["parent"] == parent and r["verb"] == verb]
        if len(matches) != 1:
            raise ValueError("Expected one attached relation")
        if matches[0]["required"] and not payload.get("invalidate", False):
            raise ValueError("Removing required support needs explicit invalidation")
        links.remove(matches[0])
        ent["invalidated"] = True
        for affected in _descendants(entities, links, target):
            entities[affected]["invalidated"] = True
    elif action == "reparent":
        old, new = payload["old_parent"], payload["new_parent"]
        if new not in entities:
            raise ValueError("Missing replacement parent")
        matches = [r for r in links if r["child"] == target
                   and r["parent"] == old and r["verb"] == "supports"]
        if len(matches) != 1:
            raise ValueError("Reparent needs exactly one existing support")
        links.remove(matches[0])
        links.append({**matches[0], "parent": new})
        ent["invalidated"] = True
        for affected in _descendants(entities, links, target):
            entities[affected]["invalidated"] = True
    elif action == "remove":
        connected = [r for r in links if r["child"] == target or r["parent"] == target]
        if any(r["required"] and r["parent"] == target for r in connected) and not payload.get("invalidate", False):
            raise ValueError("Removal would strand required dependents")
        for r in connected:
            if r["parent"] == target:
                entities[r["child"]]["invalidated"] = True
                for child in _descendants(entities, links, r["child"]):
                    entities[child]["invalidated"] = True
        links[:] = [r for r in links if r not in connected]
        del entities[target]
    elif action == "bind-representation":
        # Prim paths/Blender handles are never identity or native-solid proof.
        ent["representation"] = payload["path"]
    elif action == "annotate":
        ent["annotations"].append({"actor": operation["actor"], "note": payload["note"]})
    _validate_snapshot(entities, links)


class RelationalGround:
    """An immutable event graph reconstructed into one attributable projection."""
    def __init__(self, location, *, events=None):
        self.location = _nonempty(location, "Location")
        self.events = deepcopy(events or {})
        self._project()  # fail closed for forged/invalid causal records

    @property
    def frontier(self):
        parents = {p for e in self.events.values() for p in e["parents"]}
        return tuple(sorted(set(self.events) - parents))

    def _ordered_events(self):
        remaining = dict(self.events)
        ordered, admitted = [], set()
        while remaining:
            ready = sorted(k for k, event in remaining.items()
                           if set(event["parents"]) <= admitted)
            if not ready:
                raise ValueError("Missing causal parents or event cycle")
            for event_id in ready:
                event = remaining.pop(event_id)
                ordered.append((event_id, event))
                admitted.add(event_id)
        return ordered

    def _project(self):
        entities, links = {}, []
        for event_id, event in self._ordered_events():
            if event_id != _digest({"parents": event["parents"], "operation": event["operation"]}):
                raise ValueError("Causal event digest mismatch")
            _check_operation(event["operation"])
            _apply_one(entities, links, event["operation"])
        return {"entities": entities, "relations": sorted(links, key=lambda x:
                (x["parent"], x["child"], x["verb"])), "frontier": list(self.frontier)}

    def snapshot(self):
        return self._project()

    def _ancestors(self, roots):
        reached, pending = set(), list(roots)
        while pending:
            head = pending.pop()
            if head in reached:
                continue
            if head not in self.events:
                raise ValueError("Unknown observed causal frontier")
            reached.add(head)
            pending.extend(self.events[head]["parents"])
        return reached

    @staticmethod
    def _touches(op, snapshot):
        touched = {op["target"]}
        p = op.get("payload", {})
        for key in ("parent", "old_parent", "new_parent"):
            if key in p:
                touched.add(p[key])
        if op["kind"] in ("transform", "remove", "detach", "reparent"):
            touched.update(_descendants(snapshot["entities"], snapshot["relations"], op["target"]))
        return touched

    def apply(self, operation):
        _check_operation(operation)
        parents = tuple(sorted(operation["frontier"]))
        observed = self._ancestors(parents)
        state = self.snapshot()
        incoming = self._touches(operation, state)
        for eid, event in self.events.items():
            if eid not in observed and incoming & set(event["touched"]):
                raise ValueError("Conflicting concurrent edit; preserve separate causal branch")
        prospective = deepcopy(self.events)
        op = deepcopy(operation)
        event_id = _digest({"parents": list(parents), "operation": op})
        if event_id in prospective:
            return self, {"event_id": event_id, "outcome": "already-recorded"}
        entities, relations = deepcopy(state["entities"]), deepcopy(state["relations"])
        _apply_one(entities, relations, op)  # do not publish a partial invalid edit
        prospective[event_id] = {"parents": list(parents), "operation": op,
                                 "touched": sorted(incoming)}
        revised = RelationalGround(self.location, events=prospective)
        return revised, {"event_id": event_id, "outcome": "accepted",
                         "frontier": list(revised.frontier),
                         "invalidated": sorted(k for k, v in revised.snapshot()["entities"].items()
                                               if v["invalidated"])}

    def to_dict(self):
        document = {"schema": SCHEMA, "location": self.location,
                    "events": self.events, "frontier": list(self.frontier)}
        return {**document, "sha256": _digest(document)}

    @classmethod
    def from_dict(cls, data):
        if set(data) != {"schema", "location", "events", "frontier", "sha256"} or data["schema"] != SCHEMA:
            raise ValueError("Invalid relational ground document")
        payload = {k: data[k] for k in ("schema", "location", "events", "frontier")}
        if data["sha256"] != _digest(payload):
            raise ValueError("Relational ground digest mismatch")
        result = cls(data["location"], events=data["events"])
        if list(result.frontier) != data["frontier"]:
            raise ValueError("Forged causal frontier")
        return result

    @classmethod
    def load(cls, path):
        return cls.from_dict(json.loads(Path(path).read_text(encoding="utf8")))

    def save(self, path):
        from .generalized_campaign import save_once
        save_once(path, self.to_dict())

    def as_prov(self):
        """W3C PROV-like JSON mapping, preserving native event IDs separately."""
        records = []
        for eid, event in self._ordered_events():
            op = event["operation"]
            records.append({
                "id": "activity:" + eid, "type": "prov:Activity",
                "prov:wasAssociatedWith": op["actor"],
                "prov:used": ["event:" + p for p in event["parents"]],
                "affected": op["target"], "operation": op["kind"]})
        return {"prefix": {"prov": "http://www.w3.org/ns/prov#"}, "activities": records}
