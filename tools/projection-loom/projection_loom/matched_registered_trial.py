"""Matched multi-generation source-objective ablation under the single OODA-HA helm.

Two independent campaign journals are matched on source, program, RNG stream,
native audition budget and operator intent. The *only* experimental variable
is source scoring. Historical and resulting candidate ancestry remain distinct.
This comparison does not automatically select a winner or assert statistical
significance from one trial.
"""
from __future__ import annotations
import json
from pathlib import Path
from .generalized_campaign import run_cohort, save_once
from .intent_seed import IntentContract, SeedBundle
from .seed_adapters import registered_views
from .provenance_encoding import canonical_json_sha256

SCHEMA = "projection-loom/registered-multiview-ablation"


def _read(path):
    return json.loads(Path(path).read_text(encoding="utf8"))


def _read_epoch(out, index):
    return _read(out / f"epoch_{index:03d}.json")


def matched_registered_ablation(adapters, intent, out, *, epochs=2,
                                offspring=3, exact_budget=3,
                                finalists=2, seed=41):
    adapters = tuple(adapters)
    if not isinstance(intent, IntentContract):
        raise ValueError("Matched experiment needs one immutable intent")
    registered = registered_views(adapters)
    if registered is None or len(registered) < 2 or len(registered) != len(adapters):
        raise ValueError("Matched multiview control requires two independent calibrated image sources")
    if (not 2 <= epochs <= 8 or not 1 <= offspring <= 16
            or not 1 <= exact_budget <= offspring or not 1 <= finalists <= 8):
        raise ValueError("Matched experiment needs bounded multi-generation budgets")
    sources = SeedBundle(tuple(a.seed for a in adapters))
    sources.verify_files()
    site = Path(out)
    site.mkdir(parents=True, exist_ok=True)
    if (site / "FAILED").exists():
        raise RuntimeError("Previous failed experiment cannot replay as successful")
    declared = {"schema": SCHEMA,
                "intent_sha256": intent.identity,
                "source_bundle_sha256": sources.identity,
                "calibration_sha256s": [entry["registration"]["sha256"] for entry in registered],
                "epochs": epochs, "offspring": offspring, "exact_budget": exact_budget,
                "finalists": finalists, "seed": seed,
                "arms": ["withheld", "auto"],
                "policy_delta": "source-fitness withheld versus independently measured registered views",
                "evaluation": "matched first-epoch genomes and equal exact/native audition budgets",
                "automatic_promotion": False}
    save_once(site / "pre_registration.json", declared)
    try:
        control_root = site / "withheld"
        measured_root = site / "measured"
        control = run_cohort(adapters, intent, control_root, epochs=epochs,
                             offspring=offspring, exact_budget=exact_budget,
                             finalists=finalists, seed=seed, source_policy="withheld")
        measured = run_cohort(adapters, intent, measured_root, epochs=epochs,
                              offspring=offspring, exact_budget=exact_budget,
                              finalists=finalists, seed=seed, source_policy="auto")
        left = _read(control_root / "pre_registration.json")
        right = _read(measured_root / "pre_registration.json")
        if (left["common_proposal_stream_sha256"] != right["common_proposal_stream_sha256"]
                or left["source_policy"] != "withheld" or right["source_policy"] != "auto"):
            raise ValueError("Matched candidate generation stream or objective policies changed")
        first = []
        for root in (control_root, measured_root):
            rows = _read_epoch(root, 0)["candidates"]
            first.append([(r["id"], r["program_sha256"]) for r in rows])
        if first[0] != first[1]:
            raise ValueError("First-epoch exact candidate identities diverged before treatment")
        per_epoch = []
        for e in range(epochs):
            row = {"epoch": e}
            for name, root in (("withheld", control_root), ("measured", measured_root)):
                evidence = _read_epoch(root, e)
                row[name] = {"attempted": evidence["attempted"],
                             "native_valid": evidence["valid"],
                             "native_rejected": evidence["rejected"],
                             "fitness_observed": sum("fitness" in r["metrics"]
                                for r in evidence["candidates"])}
            if row["withheld"]["attempted"] != row["measured"]["attempted"]:
                raise ValueError("Unequal native auditions invalidate matched comparison")
            per_epoch.append(row)
        control_source = [_read(control_root / "finalists" / (f["id"]+".json"))["full_source"]
                          for f in control["finalists"]]
        measured_source = [_read(measured_root / "finalists" / (f["id"]+".json"))["full_source"]
                           for f in measured["finalists"]]
        if any(v is not None for v in control_source):
            raise ValueError("Native-only control unexpectedly received source fitness")
        if any(v is None or len(v["registered_source_views"]) != len(registered)
               for v in measured_source):
            raise ValueError("Measured arm lacks original-resolution independent source witnesses")
        result = {"schema": SCHEMA, "pre_registration_sha256": canonical_json_sha256(declared),
                  "arms": {"withheld": control["run_id"], "measured": measured["run_id"]},
                  "same_first_epoch_native_candidates": True,
                  "same_source_and_random_proposal_stream": True,
                  "epochs": per_epoch,
                  "source_view_count": len(registered),
                  "measured_full_source_fitness": [
                      [view["source_fit"]["fitness"] for view in final["registered_source_views"]]
                      for final in measured_source],
                  "inference_scope": "descriptive controlled contrast; no significance or external survey certification",
                  "automatic_promotion": False, "operator_winner": None}
        save_once(site / "comparison.json", result)
    except Exception:
        (site / "FAILED").write_text(
            "Matched experiment failed; no completed comparison claim\n", encoding="utf8")
        raise
    return result
