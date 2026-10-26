"""Deterministic single-seed native Fire study fixture, never an AI interpreter.

Uses source-backed selectors from fire-context. The actual Fire/Operator may
author different alternatives; this fixture exists to prove the native bridge
and reproducible evidence path under the one-source alpha project.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path


def build_study(context):
    if context.get("source", {}).get("location") != "necrospire":
        raise ValueError("Study requires the actual Necrospire source context")
    parts = {entry["handle"]: entry["selector"] for entry in context["bindings"]}
    for handle in ("lower terrace", "central keep"):
        if handle not in parts or parts[handle]["kind"] != "material":
            raise ValueError("Source context lacks a distinct native terrace and keep")
    return {
        "schema": "projection-loom/fire-proposal",
        "inscription": '<<~ art worktype="architectural study" subject="Necrospire terrace and keep" read="a visible contact supports a constructed mass" relation="bearing" >>',
        "folio": [{"kind": "study", "text": "One source seed; compare a slender and broad native bearing contact under six frozen views."}],
        "source": context["source"],
        "bindings": [
            {"alias": "terrace", "selector": parts["lower terrace"]},
            {"alias": "keep", "selector": parts["central keep"]},
        ],
        "alternatives": [
            {"id": "slender-bearing", "subject": "terrace", "object": "keep",
             "relation": "bears", "implementation": "bearing-column",
             "parameters": {"width": 0.6, "depth": 0.6}},
            {"id": "broad-bearing", "subject": "terrace", "object": "keep",
             "relation": "bears", "implementation": "bearing-column",
             "parameters": {"width": 1.2, "depth": 1.2}},
            {"id": "unresolved-support", "subject": "terrace", "object": "keep",
             "relation": "studies", "implementation": "study-only",
             "parameters": {}},
        ],
        "intent": {"state": "proposed",
                   "read": "Audition two discrete bearing widths against native CAD; hold interpretive support open.",
                   "attribution": "ai-interpretation"},
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--context", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    from projection_loom.fire_contract import validate_proposal
    context = json.loads(args.context.read_text(encoding="utf8"))
    study = validate_proposal(build_study(context))
    if args.out.exists():
        raise ValueError("Research fixtures must not overwrite an existing proposal")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(study, indent=2) + "\n", encoding="utf8")


if __name__ == "__main__":
    main()
