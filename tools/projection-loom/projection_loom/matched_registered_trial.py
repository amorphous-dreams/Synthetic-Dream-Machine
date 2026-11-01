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
from .generalized_campaign import run_cohort, measured_view_scores
from .receipt_store import save_once
from .developmental import GrowthProgram, compile_growth
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
        # Evaluate *both* selected finalist sets against the exact same source
        # cameras only after selection; control never saw these fitness values.
        blind = {}
        for arm, root, summary in (
                ("withheld", control_root, control),
                ("measured", measured_root, measured)):
            ancestry = {}
            for epoch in range(epochs):
                for candidate in _read_epoch(root, epoch)["candidates"]:
                    ancestry[candidate["id"]] = candidate
            audits = []
            for winner in summary["finalists"]:
                candidate = ancestry[winner["id"]]
                program = GrowthProgram.from_dict({"nodes": candidate["program"]})
                if program.identity != candidate["program_sha256"]:
                    raise ValueError("Post-selection candidate genome identity changed")
                build = compile_growth(program)
                if not build.audit()["valid"]:
                    raise ValueError("Post-selection native candidate was not valid")
                views = measured_view_scores(
                    build.assembly.tessellate(union=True),
                    registered, full_resolution=True)
                audits.append({"candidate_id": winner["id"],
                               "program_sha256": candidate["program_sha256"],
                               "registered_source_views": views,
                               "mean_source_fitness": sum(
                                   v["source_fit"]["fitness"] for v in views)/len(views)})
            if not audits:
                raise ValueError("Post-selection audit needs one native-valid finalist per arm")
            blind[arm] = audits
        measured_mean = sum(r["mean_source_fitness"] for r in blind["measured"])/len(blind["measured"])
        withheld_mean = sum(r["mean_source_fitness"] for r in blind["withheld"])/len(blind["withheld"])
        result = {"schema": SCHEMA, "pre_registration_sha256": canonical_json_sha256(declared),
                  "arms": {"withheld": control["run_id"], "measured": measured["run_id"]},
                  "same_first_epoch_native_candidates": True,
                  "same_source_and_random_proposal_stream": True,
                  "epochs": per_epoch,
                  "source_view_count": len(registered),
                  "measured_full_source_fitness": [
                      [view["source_fit"]["fitness"] for view in final["registered_source_views"]]
                      for final in measured_source],
                  "post_selection_blind_source_audit": blind,
                  "post_selection_mean_source_delta": measured_mean-withheld_mean,
                  "inference_scope": "descriptive controlled contrast; no significance or external survey certification",
                  "automatic_promotion": False, "operator_winner": None}
        save_once(site / "comparison.json", result)
    except Exception:
        (site / "FAILED").write_text(
            "Matched experiment failed; no completed comparison claim\n", encoding="utf8")
        raise
    return result



def matched_registered_replicates(adapters, intent, out, *, seeds=(41,73,101),
                                  epochs=2, offspring=2, exact_budget=2,
                                  finalists=1):
    """Repeated matched trials; per-seed paired outcomes, no p-value by fiat."""
    if (not isinstance(seeds, (list, tuple)) or not 2 <= len(seeds) <= 8
            or any(type(seed) is not int or seed < 0 or seed > 2**31
                   for seed in seeds) or len(set(seeds)) != len(seeds)):
        raise ValueError("Two to eight unique bounded integer random seeds required")
    adapters = tuple(adapters)
    registered = registered_views(adapters)
    if registered is None or len(registered) < 2:
        raise ValueError("Repeated trials require independent registered source views")
    site = Path(out)
    if site.exists():
        if (site / "FAILED").exists():
            raise ValueError("Failed repeated experiment cannot become a success")
        if not (site / "pre_registration.json").exists():
            raise ValueError("Existing repeated experiment is not a verified output")
    site.mkdir(parents=True, exist_ok=True)
    prereg = {"schema": "projection-loom/registered-repeated-trial",
              "source_ids": [a.seed.identity for a in adapters],
              "registered_camera_sha256s": [r["registration"]["sha256"] for r in registered],
              "intent": intent.identity, "seeds": list(seeds),
              "epochs": epochs, "offspring": offspring,
              "exact_budget": exact_budget, "finalists": finalists,
              "evaluation": "independent full-pixel post-selection audit of both arms",
              "automatic_promotion": False}
    save_once(site / "pre_registration.json", prereg)
    try:
        rows = []
        for seed in seeds:
            report = matched_registered_ablation(
                adapters, intent, site / f"seed-{seed}",
                epochs=epochs, offspring=offspring,
                exact_budget=exact_budget, finalists=finalists, seed=seed)
            rows.append({"seed": seed,
                         "comparison_sha256": canonical_json_sha256(report),
                         "per_arm_post_selection": report["post_selection_blind_source_audit"],
                         "source_fitness_delta": report["post_selection_mean_source_delta"],
                         "native_auditions": {
                             arm: sum(epoch[arm]["attempted"] for epoch in report["epochs"])
                             for arm in ("withheld","measured")}})
        deltas = [r["source_fitness_delta"] for r in rows]
        result = {"schema": "projection-loom/registered-repeated-trial",
                  "pre_registration_sha256": canonical_json_sha256(prereg),
                  "trials": rows, "replicate_count": len(rows),
                  "descriptive_mean_delta": sum(deltas)/len(deltas),
                  "observed_min_delta": min(deltas),
                  "observed_max_delta": max(deltas),
                  "inference_scope": "descriptive across fixed held-out seeds; no statistical significance or external survey certificate",
                  "operator_winner": None, "automatic_promotion": False}
        save_once(site / "summary.json", result)
        return result
    except Exception:
        (site / "FAILED").write_text(
            "Incomplete repeated registered trial; no success receipt\n", encoding="utf8")
        raise
