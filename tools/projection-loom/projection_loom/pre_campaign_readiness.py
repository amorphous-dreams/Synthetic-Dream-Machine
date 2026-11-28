"""Pre-campaign native evidence for the existing five-phase OODA-HA controller.

This module orchestrates bounded experiments; it never replaces the helm,
silently relabels historical losses, or promotes provisional art to survey truth.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from hashlib import sha256
from itertools import product
from pathlib import Path
from unittest.mock import patch
import json
import math

from .capability_stack import CapabilityRecipe, CapabilityCompositor
from .campaign import FAMILY_FOCUSES, validate_breeding_recipe, visual_descriptor
from .epochs import WideEpoch, _atomic, _hash, project_code_digest
from .evidence_receipts import CadAuditReceipt, CompoundAuditReceipt
from .fractal_ooda_ha import run_ooda_ha_epochs
from .pipeline import Project
from .render import silhouette
from .evolution import iou

CONTRACT = "projection-loom/pre-campaign-contract"
REPORT = "projection-loom/pre-campaign-evidence"
SEAL = "projection-loom/sealed-evidence"
SWITCHES = ("join.enable", "grammar.gallery", "grammar.buttress")
GLOBAL = ("silhouette", "prior", "macro", "contour")
OBJECTIVES = ("silhouette", "prior", "regional", "macro", "contour")


def file_digest(path):
    digest = sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def signed(value):
    value = dict(value)
    value["sha256"] = _hash(value)
    return value


def checked(value, schema):
    if not isinstance(value, dict) or value.get("schema") != schema:
        raise ValueError("Unknown evidence schema")
    raw = dict(value)
    if raw.pop("sha256", None) != _hash(raw):
        raise ValueError("Evidence digest mismatch")
    return value


def immutable(path, value):
    path = Path(path)
    if path.exists():
        if json.loads(path.read_text(encoding="utf-8")) != value:
            raise ValueError("Experiment identity changed; fork a fresh output")
    else:
        _atomic(path, value)


def contract_for(project, recipe, *, passes, offspring, exact, detail, seed,
                 size, control_scale, candidate_scale):
    validate_breeding_recipe(recipe)
    if project.reference is None or not project.reference.is_file():
        raise ValueError("Pre-campaign comparison needs real reference image bytes")
    image_sha = file_digest(project.reference)
    if recipe.source_hashes.get("image") != image_sha or project.location != recipe.location:
        raise ValueError("Source or location differs from recipe")
    camera = project.cameras[project.reference_view]
    if camera.fit != "fixed":
        raise ValueError("Comparative source-view camera must remain fixed")
    if (type(passes) is not int or passes < 1 or type(offspring) is not int
            or not 1 <= offspring <= 32 or type(exact) is not int or exact < 1
            or type(detail) is not int or not 1 <= detail <= exact
            or type(seed) is not int or len(size) != 2
            or any(type(x) is not int or not 32 <= x <= 1024 for x in size)):
        raise ValueError("Unbounded or invalid experiment budgets")
    if (any(type(v) not in (float, int) or not math.isfinite(v) or
            not 0 < v <= .4 for v in (control_scale, candidate_scale))
            or control_scale == candidate_scale):
        raise ValueError("Two distinct finite mutation controls required")
    if any(k not in recipe.bounds or
           not recipe.bounds[k][0] < .49 < .51 < recipe.bounds[k][1]
           for k in SWITCHES):
        raise ValueError("All three physical topology switches must straddle 0.5")
    source_mask = project.source_mask(tuple(size))
    compositor = CapabilityCompositor(project, recipe, size=tuple(size),
                                      source_mask=source_mask)
    return signed({
        "schema": CONTRACT, "location": project.location,
        "source": {"image_sha256": image_sha,
                   "mask_sha256": _hash(source_mask.tolist()),
                   "camera": camera.to_dict(),
                   "reference_view": project.reference_view,
                   "score_size": list(size), "mask_threshold_gt": 96,
                   "evidence": "provisional-unregistered"},
        "construction": {"recipe_sha256": recipe.sha256,
                         "project_code_sha256": project_code_digest(project),
                         "operator_sha256": compositor.registry.fingerprint(),
                         "construction_sha256": compositor.construction_digest()},
        "policy": {"passes": passes, "offspring_per_family": offspring,
                   "births_per_epoch": len(FAMILY_FOCUSES) * offspring,
                   "exact_budget": exact, "detail_budget": detail,
                   "seed": seed, "objectives": list(OBJECTIVES),
                   "global_objectives": list(GLOBAL),
                   "local_objectives": ["regional"],
                   "global_sum": "silhouette+prior+macro+contour+pet_loss",
                   "control_mutation_scale": float(control_scale),
                   "candidate_mutation_scale": float(candidate_scale),
                   "historical_pilot": "read-only; incomparable objective policy"}
    })


def topology_controls(project, recipe, output, *, size):
    """Full three-switch 2^3 truth table with native exports and scoped audits."""
    output = Path(output)
    compositor = CapabilityCompositor(project, recipe, size=tuple(size),
                                      source_mask=project.source_mask(tuple(size)))
    source = project.source_mask(tuple(size))
    cases = []
    for settings in product((False, True), repeat=3):
        name = "".join("1" if state else "0" for state in settings)
        genome = dict(recipe.initial)
        for key, active in zip(SWITCHES, settings):
            genome[key] = .51 if active else .49
        item = {"case": name, "switches": dict(zip(SWITCHES, settings)),
                "genome_sha256": _hash(genome), "state": "native-rejected"}
        try:
            build = compositor.grow(genome)
            receipt = CompoundAuditReceipt.from_native(build.audit)
            if not receipt.render_admissible:
                raise ValueError("Native compound audit rejected")
            states = {step["id"]: step["state"] for step in build.steps}
            for step in recipe.steps:
                if step.activation in SWITCHES:
                    expected = "complete" if genome[step.activation] >= .5 else "inactive"
                    if states[step.id] != expected:
                        raise ValueError("Activation state disagrees with physical 0.5 switch")
            mask = silhouette(build.scene.render_mesh(), compositor.camera,
                              tuple(size)) > 96
            destination = output / name
            build.scene.export(destination,
                               {project.reference_view: compositor.camera},
                               size=tuple(size), style=project.render_style)
            native = destination / "hybrid_manifest.json"
            if not native.is_file():
                raise ValueError("Native step and polygon manifest absent")
            item.update(state="native-valid", audit=build.audit,
                        step_states=states, witness_id=build.witness().witness_id,
                        source_view_iou=float(iou(source, mask)),
                        morphology=visual_descriptor(mask),
                        native_manifest=str(native.relative_to(output.parent)))
        except (ValueError, RuntimeError, OSError) as exc:
            item["reason"] = type(exc).__name__ + ": " + str(exc)
        cases.append(item)
    report = signed({
        "schema": "projection-loom/topology-controls",
        "recipe_sha256": recipe.sha256, "physical_threshold": .5,
        "score_size": list(size), "cases": cases, "attempted": len(cases),
        "native_valid": sum(r["state"] == "native-valid" for r in cases),
        "native_rejected": sum(r["state"] != "native-valid" for r in cases),
        "authority": "separate CAD/void, polygon, semantic sockets; no cross-kernel fusion"
    })
    immutable(output / "controls.json", report)
    return report


def campaign_metrics(root, passes):
    """Independently verify native checkpoints and report budget-to-score yield."""
    root = Path(root)
    journal = json.loads((root / "session.json").read_text())
    if journal["status"] != "completed" or any(
            row["phase"] != "closed" for row in journal["loops"].values()):
        raise ValueError("OODA-HA session lacks terminal Aftermath")
    archive = json.loads((root / "lineage_archive.json").read_text())
    if archive.get("snapshot_sha256") != _hash({
            k: v for k, v in archive.items() if k != "snapshot_sha256"}):
        raise ValueError("Lineage archive digest mismatch")
    if len(archive["generations"]) != passes:
        raise ValueError("Lineage archive misses an epoch")
    counts = Counter()
    emitters = defaultdict(Counter)
    masks, niches, source_losses = set(), set(), []
    checkpoint_hashes = []
    for generation in range(1, passes + 1):
        epoch = json.loads((root / ("epoch_%03d.json" % generation)).read_text())
        if epoch.get("snapshot_sha256") != _hash({
                k: v for k, v in epoch.items() if k != "snapshot_sha256"}):
            raise ValueError("Epoch native checkpoint digest mismatch")
        if (epoch["identity"]["objectives"] != list(OBJECTIVES)
                or epoch["identity"]["local_objectives"] != ["regional"]):
            raise ValueError("Changed measured objective policy")
        if set(epoch["proposals"]) != set(epoch["results"]):
            raise ValueError("Incomplete epoch receipts")
        checkpoint_hashes.append(_hash({
            "proposals": epoch["proposals"], "results": epoch["results"]}))
        for ident, proposal in epoch["proposals"].items():
            row = epoch["results"][ident]
            state = row["state"]
            counts["births"] += 1
            counts[state] += 1
            emitters[proposal["emitter"]][state] += 1
            if state != "deferred":
                counts["auditions"] += 1
            if state in ("audited", "scored"):
                if not CadAuditReceipt.from_native(row["audit"]).admitted:
                    raise ValueError("Native-valid state lacks a single-solid CAD gate")
                counts["native_valid"] += 1
            if state == "scored":
                if row.get("evidence_state") != "provisional":
                    raise ValueError("Artwork promoted to unsupported survey evidence")
                combined = sum(row["losses"][name] for name in GLOBAL) + row["pet_loss"]
                if abs(combined - row["combined_loss"]) > 1e-9:
                    raise ValueError("Local specialist score contaminated global rank")
                mask = [v[7:] for v in row["phenotype"] if v.startswith("visual:")]
                niche = [v[len("visual-niche:"):] for v in row["phenotype"]
                         if v.startswith("visual-niche:")]
                if len(mask) != 1 or len(niche) != 1:
                    raise ValueError("Missing exact source-view phenotype")
                masks.add(mask[0]); niches.add(niche[0])
                source_losses.append(row["losses"]["silhouette"])
                counts["backfill"] += row.get("detail_role") == "backfill"
    return {
        "births": counts["births"], "exact_auditions": counts["auditions"],
        "native_valid": counts["native_valid"], "scored": counts["scored"],
        "audited_only": counts["audited"], "deferred": counts["deferred"],
        "rejected": counts["rejected"], "errors": counts["error"],
        "backfill": counts["backfill"], "exact_unique_masks": len(masks),
        "visual_niches": len(niches),
        "native_per_audition": counts["native_valid"] / max(1, counts["auditions"]),
        "scored_per_native_valid": counts["scored"] / max(1, counts["native_valid"]),
        "unique_masks_per_score": len(masks) / max(1, counts["scored"]),
        "best_fixed_source_iou": 1 - min(source_losses) if source_losses else None,
        "emitter_outcomes": {key: dict(value) for key, value in sorted(emitters.items())},
        "surviving_families": sorted(archive["champions"]),
        "epoch_receipts_sha256": _hash(checkpoint_hashes),
        "lineage_sha256": archive["snapshot_sha256"],
        "final_gallery": journal.get("gallery"),
        "lineage_gallery": journal.get("lineage_gallery")
    }


def proposal_divergence(control_root, candidate_root, passes):
    """Prove the declared mutation policy actually changes paired proposals."""
    changed = Counter()
    matched = 0
    for generation in range(1, passes + 1):
        name = "epoch_%03d.json" % generation
        control = json.loads((Path(control_root) / name).read_text())["proposals"]
        candidate = json.loads((Path(candidate_root) / name).read_text())["proposals"]
        if set(control) != set(candidate):
            raise ValueError("Matched run changed proposal identities")
        for ident in sorted(control):
            if control[ident]["emitter"] != candidate[ident]["emitter"]:
                raise ValueError("Matched run changed emitter identity")
            matched += 1
            if control[ident]["genome"] != candidate[ident]["genome"]:
                changed[control[ident]["emitter"]] += 1
    return {"matched_proposals": matched,
            "different_genomes": sum(changed.values()),
            "differing_emitters": dict(sorted(changed.items()))}


def bounded_run(project, recipe, output, policy, mutation_scale, *,
                passes=None, offspring=None, exact=None, detail=None):
    result = run_ooda_ha_epochs(
        project, output, recipe=recipe, breeding=True, autonomy=1.,
        passes=passes if passes is not None else policy["passes"],
        offspring_per_family=offspring if offspring is not None else policy["offspring_per_family"],
        exact_budget=exact if exact is not None else policy["exact_budget"],
        detail_budget=detail if detail is not None else policy["detail_budget"],
        seed=policy["seed"], score_size=tuple(policy["score_size"]),
        mutation_scale=mutation_scale, finalists=3)
    if result["status"] != "completed":
        raise ValueError("Bounded native campaign failed to close OODA-HA")
    return result


class InterruptedAfterCheckpoint(RuntimeError):
    """Injected process termination after durable CAD, before assimilation."""


def replay_control(project, recipe, output, policy):
    output = Path(output)
    tiny = dict(passes=1, offspring=1,
                exact=min(3, policy["exact_budget"]),
                detail=min(2, policy["detail_budget"]))
    scale = policy["control_mutation_scale"]
    bounded_run(project, recipe, output / "continuous", policy, scale, **tiny)
    original = WideEpoch.run
    injected = [False]

    def fail_once(self, *args, **kwargs):
        result = original(self, *args, **kwargs)
        if not injected[0]:
            injected[0] = True
            raise InterruptedAfterCheckpoint("simulated death after durable native checkpoint")
        return result

    resumed_dir = output / "resumed"
    if not (resumed_dir / "session.json").exists():
        try:
            with patch.object(WideEpoch, "run", fail_once):
                bounded_run(project, recipe, resumed_dir, policy, scale, **tiny)
        except InterruptedAfterCheckpoint:
            pass
        if not injected[0]:
            raise ValueError("Crash injection missed the native checkpoint")
    bounded_run(project, recipe, resumed_dir, policy, scale, **tiny)
    continuous = campaign_metrics(output / "continuous", 1)
    resumed = campaign_metrics(resumed_dir, 1)
    result = signed({
        "schema": "projection-loom/native-resume-equivalence",
        "interrupt_boundary": "after WideEpoch.run, before lineage assimilation",
        "continuous": {"epoch": continuous["epoch_receipts_sha256"],
                       "lineage": continuous["lineage_sha256"]},
        "resumed": {"epoch": resumed["epoch_receipts_sha256"],
                    "lineage": resumed["lineage_sha256"]},
        "equivalent": (continuous["epoch_receipts_sha256"] ==
                       resumed["epoch_receipts_sha256"] and
                       continuous["lineage_sha256"] == resumed["lineage_sha256"])
    })
    immutable(output / "replay.json", result)
    return result


def verify_seal(root):
    root = Path(root)
    data = checked(json.loads((root / "seal.json").read_text()), SEAL)
    actual = {}
    for item in sorted(root.rglob("*")):
        if item.is_symlink():
            raise ValueError("Sealed bundle must not contain symlinks")
        if item.is_file() and item != root / "seal.json":
            actual[item.relative_to(root).as_posix()] = {
                "sha256": file_digest(item), "bytes": item.stat().st_size}
    if actual != data["files"]:
        raise ValueError("Sealed evidence changed or went missing")
    return data


def seal(root):
    root = Path(root)
    if (root / "seal.json").exists():
        return verify_seal(root)
    files = {}
    for item in sorted(root.rglob("*")):
        if item.is_symlink():
            raise ValueError("Evidence archive contains a symlink")
        if item.is_file():
            files[item.relative_to(root).as_posix()] = {
                "sha256": file_digest(item), "bytes": item.stat().st_size}
    if "readiness.json" not in files:
        raise ValueError("Cannot seal an incomplete evidence experiment")
    data = signed({"schema": SEAL, "files": files,
                   "historical_pilot_modified": False,
                   "storage_boundary": "local verified snapshot; off-runner durable copy required"})
    _atomic(root / "seal.json", data)
    return verify_seal(root)


def run_readiness(project_file, recipe_file, output, *, passes=2,
                  offspring=3, exact=12, detail=6, seed=41, size=(64, 96),
                  control_scale=.10, candidate_scale=.16):
    """Complete all native P0 evidence; full campaign remains operator-gated."""
    output = Path(output)
    if "experiments" in output.parts or output.name == "breeding_20261025":
        raise ValueError("Historical experiment directories remain read-only")
    if (output / "seal.json").exists():
        verify_seal(output)
        return checked(json.loads((output / "readiness.json").read_text()), REPORT)
    project, recipe = Project.load(project_file), CapabilityRecipe.load(recipe_file)
    contract = contract_for(project, recipe, passes=passes, offspring=offspring,
                            exact=exact, detail=detail, seed=seed, size=size,
                            control_scale=control_scale, candidate_scale=candidate_scale)
    immutable(output / "contract.json", contract)
    topology = topology_controls(project, recipe, output / "native-controls", size=size)
    policy = dict(contract["policy"], score_size=list(size))
    bounded_run(project, recipe, output / "control", policy, control_scale)
    bounded_run(project, recipe, output / "candidate", policy, candidate_scale)
    control = campaign_metrics(output / "control", passes)
    candidate = campaign_metrics(output / "candidate", passes)
    divergence = proposal_divergence(output / "control", output / "candidate", passes)
    replay = replay_control(project, recipe, output / "replay", policy)
    no_go = (topology["native_valid"] != 8 or not replay["equivalent"]
             or divergence["different_genomes"] == 0
             or control["errors"] or candidate["errors"]
             or not control["scored"] or not candidate["scored"])
    result = signed({
        "schema": REPORT, "contract_sha256": contract["sha256"],
        "topology_sha256": topology["sha256"], "replay_sha256": replay["sha256"],
        "paired": {"control": control, "candidate": candidate,
                   "proposal_divergence": divergence,
                   "same_source_camera_seed_objectives_budgets": True,
                   "control_mutation_scale": control_scale,
                   "candidate_mutation_scale": candidate_scale,
                   "best_iou_delta": (candidate["best_fixed_source_iou"] -
                                      control["best_fixed_source_iou"]
                                      if control["best_fixed_source_iou"] is not None and
                                      candidate["best_fixed_source_iou"] is not None else None)},
        "evidence_gate": "no-go" if no_go else "bounded-evidence-complete",
        "still_required": ["current-head held-out and repository-wide CI",
                           "off-runner long-term archive replication",
                           "operator authorization for full Necrospire campaign"],
        "claim_limit": "fixed-view provisional; no surveyed registration or CAD/mesh fusion"
    })
    immutable(output / "readiness.json", result)
    seal(output)
    return result
