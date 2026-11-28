"""The step-in reading — what a fallen vessel leaves on disk, read with no verb.

A vessel whose Automerge engine fell answers every verb `engine-terminated`, and one that fell during boot closes its socket
outright, so a seat that asks only through verbs learns nothing it can act on. The fall leaves its count beside the store
(`<dataDir>/.engine-falls`, `@lararium/node` engine-fall.ts) and each quarantined id leaves a manifest
(`<dataDir>/quarantine-torn-snapshots-*/*.manifest.json`, doc-load-probe.ts). This module reads both the way
`lares vessel read` does, so the seat names the same falls, the same held ids and the same hand acts.

It reads and never writes: the files belong to the vessel and the hand.
"""
from __future__ import annotations

import json
import os

FALLS_FILE = ".engine-falls"
QUARANTINE_PREFIX = "quarantine-torn-snapshots-"
HAND_ACT = ("`lares vessel read` names the falls and held ids with no verb; `lares vessel stop` stops the vessel by hand "
            "(the stop clears the count and frees each document a fall named in flight), then `lares vessel stand`")
RELEASE_ACT = "with the vessel stopped, `lares vessel release <documentId> [--keep|--fresh]`"


def _cap(data_dir: str) -> "int | None":
    """The restart cap the vessel wrote beside its count (`ENGINE_RESTART_CAP` in engine-fall.ts, its one owner), or None
    where the file carries none: more falls than the cap rest only on a vessel that stays down."""
    try:
        with open(os.path.join(data_dir, FALLS_FILE), encoding="utf-8") as f:
            cap = json.load(f).get("cap")
    except (OSError, ValueError, AttributeError):
        return None
    return cap if isinstance(cap, int) and not isinstance(cap, bool) else None


def _falls(data_dir: str) -> list:
    try:
        with open(os.path.join(data_dir, FALLS_FILE), encoding="utf-8") as f:
            raw = f.read()
    except OSError:
        return []
    try:
        falls = json.loads(raw).get("falls")
        if isinstance(falls, list) and all(isinstance(x, dict) for x in falls):
            return [{k: x.get(k) for k in ("life", "pid", "cause", "path", "since", "inFlight")} for x in falls]
    except (ValueError, AttributeError):
        pass
    # A torn file reads as one fall of unknown cause, never as a clean run (readEngineFalls).
    return [{"life": None, "pid": None, "cause": "unknown", "path": "unknown", "since": "unknown", "inFlight": None}]


def _quarantined(data_dir: str) -> list:
    newest: dict = {}
    try:
        dirs = sorted(d for d in os.listdir(data_dir) if d.startswith(QUARANTINE_PREFIX))
    except OSError:
        return []
    rows = []
    for d in dirs:
        try:
            names = sorted(n for n in os.listdir(os.path.join(data_dir, d)) if n.endswith(".manifest.json"))
        except OSError:
            continue
        for n in names:
            try:
                with open(os.path.join(data_dir, d, n), encoding="utf-8") as f:
                    m = json.load(f)
            except (OSError, ValueError):
                continue
            if isinstance(m, dict) and isinstance(m.get("documentId"), str) and isinstance(m.get("quarantinedAt"), str):
                rows.append(m)
    for m in sorted(rows, key=lambda m: m["quarantinedAt"]):
        if not m.get("released"):
            newest[m["documentId"]] = m
    return list(newest)


def reading(data_dir: str) -> dict:
    """`{engineFalls, held}` — the same two fields `lares vessel read json=true` answers."""
    falls = _falls(data_dir)
    in_flight = list(dict.fromkeys(f["inFlight"] for f in falls if isinstance(f.get("inFlight"), str)))
    held = [{"documentId": d, "why": "in-flight"} for d in in_flight] + \
           [{"documentId": d, "why": "quarantine"} for d in _quarantined(data_dir)]
    return {"engineFalls": falls, "held": held}


def line(data_dir: str) -> "str | None":
    """One line a refusal carries, or None where nothing rests: the falls, the held ids, and the hand act."""
    r = reading(data_dir)
    if not r["engineFalls"] and not r["held"]:
        return None
    parts = []
    if r["engineFalls"]:
        last = r["engineFalls"][-1]
        cap = _cap(data_dir)
        down = "" if cap is None else ("the vessel stays down; " if len(r["engineFalls"]) > cap else "the vessel rose once; ")
        parts.append(f"{len(r['engineFalls'])} engine fall(s) resting ({down}the last {last.get('cause')} on the "
                     f"{last.get('path')} path since {last.get('since')})")
    if r["held"]:
        parts.append("held: " + ", ".join(f"{h['documentId']} ({h['why']})" for h in r["held"]))
    acts = [HAND_ACT] if r["engineFalls"] else []
    if any(h["why"] == "quarantine" for h in r["held"]):
        acts.append(RELEASE_ACT)
    return f"step-in reading from {data_dir}: " + "; ".join(parts) + ". Hand act: " + "; ".join(acts)
