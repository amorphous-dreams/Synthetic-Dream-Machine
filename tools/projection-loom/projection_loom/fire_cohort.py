"""Read-only, source-bound Fire cohort census. No independent generation helm.

A cohort consists of independently native-audited Fire proposals and their
paired, frozen-camera six-view handbacks. This observer checks those receipts
before describing shape and silhouette diversity. No genotype is selected,
promoted, modified, or admitted by this module.
"""
from __future__ import annotations

from hashlib import sha256
import json
import math
from pathlib import Path

from .fire_contract import verify_plan
from .fire_review import VIEWS
from .provenance_encoding import canonical_json_sha256
from .epochs import _atomic


def _checked_digest(data, label):
    if data.get("sha256") != canonical_json_sha256(
            {k: v for k, v in data.items() if k != "sha256"}):
        raise ValueError(f"{label} digest does not match its contents")


def _read(path, label):
    data = json.loads(Path(path).read_text(encoding="utf8"))
    if not isinstance(data, dict):
        raise ValueError(f"{label} must contain an object")
    _checked_digest(data, label)
    return data


def _images(review, root):
    for label, expected in (("image", "fire_native_orthos.png"),
                            ("differences", "fire_native_differences.png")):
        entry = review[label]
        if entry["path"] != expected:
            raise ValueError("Fire cohort refuses unrecognized image path")
        actual = sha256((root / expected).read_bytes()).hexdigest()
        if entry["sha256"] != actual:
            raise ValueError("Fire cohort image digest mismatch: " + label)


def _view_counts(view, baseline):
    if view["original_mask_sha256"] != baseline["mask_sha256"]:
        raise ValueError("Fire cohort baseline mask identity changed")
    if view["original_occupied"] != baseline["occupied"]:
        raise ValueError("Fire cohort baseline occupancy changed")
    a, d, shared = (view[key] for key in ("appeared", "disappeared", "shared"))
    numbers = [a, d, shared, view["changed"], view["variant_occupied"],
               view["original_occupied"]]
    if any(type(x) is not int or x < 0 for x in numbers):
        raise ValueError("Fire cohort occupancy must be nonnegative integer pixels")
    if (view["changed"] != a+d or
            view["original_occupied"] != d+shared or
            view["variant_occupied"] != a+shared):
        raise ValueError("Fire cohort silhouette arithmetic disagrees")
    union = a+d+shared
    expected = shared/union if union else 1.0
    value = view["silhouette_iou"]
    if (type(value) not in (float, int) or not math.isfinite(value)
            or abs(value-expected) > 1e-9):
        raise ValueError("Fire cohort silhouette intersection disagrees")


def census(pairs):
    """Compare 2-16 sealed (native receipt, review directory) pairs.

    One image-seed identity, one frozen camera set and baseline are required.
    Repeated proposals do not create artificial diversity.
    """
    pairs = list(pairs)
    if not 2 <= len(pairs) <= 16:
        raise ValueError("Fire cohort requires 2..16 independently audited probes")
    identity = cameras = baseline = source_volume = None
    proposals = set()
    seen_topologies, seen_views = {}, {}
    rows = []
    for epoch, (receipt_path, review_path) in enumerate(pairs, 1):
        receipt = _read(receipt_path, "native audition")
        review_dir = Path(review_path)
        review = _read(review_dir / "summary.json", "orthographic handback")
        if (receipt.get("schema") != "projection-loom/fire-native-audition"
                or review.get("schema") != "projection-loom/fire-orthographic-handback"):
            raise ValueError("Fire cohort requires native audition and six-view handback")
        if verify_plan(receipt["plan"])["sha256"] != receipt["plan_sha256"]:
            raise ValueError("Fire cohort plan changed")
        for result in receipt["results"]:
            if result["receipt_sha256"] != canonical_json_sha256(
                    {k: v for k, v in result.items() if k != "receipt_sha256"}):
                raise ValueError("Fire cohort native result digest changed")
        if receipt["plan_sha256"] in proposals:
            raise ValueError("Fire cohort repeats a proposal instead of probing")
        proposals.add(receipt["plan_sha256"])
        current = {key: receipt[key] for key in (
            "original_witness_id", "source_seed_sha256", "source_recipe_sha256",
            "source_construction_digest", "source_genome_sha256")}
        if not current["source_seed_sha256"]:
            raise ValueError("Fire cohort requires an actual named image seed")
        if identity is None:
            identity = current
        elif identity != current:
            raise ValueError("Fire cohort mixed source identity, code or genome")
        if review["audition_sha256"] != receipt["sha256"]:
            raise ValueError("Fire cohort native and review receipts differ")
        if review["native_source_witness_id"] != current["original_witness_id"]:
            raise ValueError("Fire cohort reviewed a different source witness")
        if set(review["cameras"]) != set(VIEWS) or set(review["original_views"]) != set(VIEWS):
            raise ValueError("Fire cohort requires the six frozen native views")
        if (type(review["source_union_volume"]) not in (int, float)
                or not math.isfinite(review["source_union_volume"])
                or review["source_union_volume"] <= 0):
            raise ValueError("Fire cohort requires a positive finite native source volume")
        if cameras is None:
            cameras = review["cameras"]
            baseline = review["original_views"]
            source_volume = review["source_union_volume"]
        elif (cameras != review["cameras"] or baseline != review["original_views"]
              or source_volume != review["source_union_volume"]):
            raise ValueError("Fire cohort changed its camera or original material")
        _images(review, review_dir)
        admitted = {x["id"]: x for x in receipt["results"]
                    if x["state"] == "native-admitted"}
        if not admitted or len(admitted) != len(review["alternatives"]):
            raise ValueError("Fire cohort handback differs from admitted alternatives")
        reviewed = set()
        for item in review["alternatives"]:
            key = item["id"]
            if key not in admitted or key in reviewed:
                raise ValueError("Fire cohort contains unknown or repeated native alternative")
            reviewed.add(key)
            native = admitted[key]
            if (item["native_valid"] is not True or
                    native["native_audit"]["valid"] is not True or
                    native["native_audit"]["union_solids"] != 1 or
                    item["witness_id"] != native["witness_id"] or
                    item["native_part_delta"] != native["part_delta"] or
                    abs(item["added_volume"] - native["added_volume"]) > 1e-7):
                raise ValueError("Fire cohort native verdict differs from its review")
            if set(item["views"]) != set(VIEWS):
                raise ValueError("Fire cohort alternative lacks a fixed view")
            appeared = disappeared = changed = 0
            expressed = []
            fingerprint = {}
            for view in VIEWS:
                observed = item["views"][view]
                _view_counts(observed, baseline[view])
                fingerprint[view] = observed["variant_mask_sha256"]
                appeared += observed["appeared"]
                disappeared += observed["disappeared"]
                changed += observed["changed"]
                if observed["changed"]:
                    expressed.append(view)
            if expressed != item["expressed_in_views"]:
                raise ValueError("Fire cohort expression declaration differs from pixels")
            visual_sha = canonical_json_sha256(fingerprint)
            shape_sha = native["witness_id"]
            row_id = f"{epoch}/{key}"
            row = {
                "id": row_id, "probe": epoch, "alternative": key,
                "native_witness_id": shape_sha, "view_signature_sha256": visual_sha,
                "added_volume": native["added_volume"],
                "expressed_views": expressed,
                "added_pixels_all_views": appeared,
                "removed_pixels_all_views": disappeared,
                "changed_pixels_all_views": changed,
                "off_oblique_changed_pixels": sum(
                    item["views"][v]["changed"] for v in VIEWS if v != "oblique"),
                "topology_duplicate_of": seen_topologies.get(shape_sha),
                "visual_duplicate_of": seen_views.get(visual_sha),
                "evidence": "native-valid; view differences are observations, not merit",
            }
            seen_topologies.setdefault(shape_sha, row_id)
            seen_views.setdefault(visual_sha, row_id)
            rows.append(row)
        if reviewed != set(admitted):
            raise ValueError("Fire cohort omitted a native-admitted alternative")
    output = {
        "schema": "projection-loom/fire-cohort-census",
        "source": identity,
        "cameras_sha256": canonical_json_sha256(cameras),
        "source_views_sha256": canonical_json_sha256(baseline),
        "source_union_volume": source_volume,
        "probes": len(pairs),
        "native_admitted": len(rows),
        "unique_topology_witnesses": len(seen_topologies),
        "distinct_added_volume_values": len({x["added_volume"] for x in rows}),
        "unique_six_view_silhouettes": len(seen_views),
        "visible_source_differences": sum(bool(x["expressed_views"]) for x in rows),
        "off_oblique_expression": sum(x["off_oblique_changed_pixels"] > 0 for x in rows),
        "candidates": rows,
        "authority": "comparison-only; not source reconstruction, a fitness score, OODA-HA choice or Operator promotion",
    }
    output["sha256"] = canonical_json_sha256(output)
    return output


def write_census(pairs, output):
    out = Path(output)
    if out.exists():
        raise ValueError("A Fire cohort census must not overwrite an existing record")
    summary = census(pairs)
    _atomic(out, summary)
    return summary
