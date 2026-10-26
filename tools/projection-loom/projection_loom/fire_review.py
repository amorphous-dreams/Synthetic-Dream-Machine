"""Six-view visual handback for native-admitted Fire rule alternatives only.

The native receipt remains the authority. This presentation regenerates each
admitted assembly from the same source genome, checks its native audit/witness,
and uses one set of seed-frozen cameras. Nothing promotes a pet-name or lineage.
"""
from __future__ import annotations
from pathlib import Path
from hashlib import sha256

import numpy as np
from PIL import Image, ImageDraw
from .fire_contract import verify_plan
from .fire_geometry import _staged
from .fire_expression import mask_comparison, difference_image
from .grammar import grow_program
from .capability_stack import CapabilityCompositor
from .exploration import stable_orthographic_cameras
from .render import render_controls, silhouette
from .provenance_encoding import canonical_json_sha256
from .epochs import _atomic

VIEWS = ("oblique", "front", "r-side", "back", "l-side", "top")


def provenance_document(receipt):
    """Small PROV-O-compatible JSON-LD export; not an RDF rule engine."""
    if receipt.get("sha256") != canonical_json_sha256(
            {k: v for k, v in receipt.items() if k != "sha256"}):
        raise ValueError("Fire audition provenance digest mismatch")
    source = "urn:loom-witness:" + receipt["original_witness_id"]
    activity = "urn:loom-fire:" + receipt["plan_sha256"]
    graph = [
        {"@id": source, "@type": "prov:Entity"},
        {"@id": activity, "@type": "prov:Activity",
         "prov:used": {"@id": source},
         "prov:wasAssociatedWith": {"@id": "urn:loom-agent:ai-fire"},
         "rdfs:comment": "Fire interpreted an Operator-AI proposal; no promotion"},
        {"@id": "urn:loom-agent:ai-fire", "@type": "prov:Agent"},
    ]
    for item in receipt["results"]:
        if item["state"] == "native-admitted":
            graph.append({"@id": "urn:loom-witness:" + item["witness_id"],
                          "@type": "prov:Entity",
                          "prov:wasDerivedFrom": {"@id": source},
                          "prov:wasGeneratedBy": {"@id": activity},
                          "rdfs:comment": "Audited native CAD contact and union; not load certification"})
    return {"@context": {"prov": "http://www.w3.org/ns/prov#",
                         "rdfs": "http://www.w3.org/2000/01/rdf-schema#"},
            "@graph": graph}


def render_fire_review(project, recipe, receipt, output, *, size=(160, 240)):
    """Compare each admitted native variant to the original under identical views."""
    from .evidence_receipts import CompoundAuditReceipt
    if tuple(size) != (160, 240):
        raise ValueError("Fixed review size must remain 160x240")
    if receipt.get("sha256") != canonical_json_sha256(
            {k: v for k, v in receipt.items() if k != "sha256"}):
        raise ValueError("Audition receipt changed")
    plan = verify_plan(receipt["plan"])
    if plan["sha256"] != receipt["plan_sha256"]:
        raise ValueError("Plan and native receipt no longer agree")
    if receipt["source_recipe_sha256"] != recipe.sha256:
        raise ValueError("Review recipe no longer matches native source")
    if project.seed_entity is not None and receipt["source_seed_sha256"] != project.seed_entity.sha256:
        raise ValueError("Review source seed changed")
    result = Path(output)
    if result.exists() and (not result.is_dir() or any(result.iterdir())):
        raise ValueError("Fire review output must be a new empty directory")
    comp = CapabilityCompositor(project, recipe, size=(64, 96),
                                source_mask=project.source_mask((64, 96)))
    if comp.construction_digest() != receipt.get("source_construction_digest"):
        raise ValueError("Fire review construction implementation drifted")
    built = comp.grow(receipt["source_genome"])
    if not CompoundAuditReceipt.from_native(built.audit).render_admissible:
        raise ValueError("Regrown source no longer has native construction authority")
    if built.witness().witness_id != receipt["original_witness_id"]:
        raise ValueError("Fire reviewer source witness changed")

    # Freeze on one reference build, before seeing any variant. Native baseline
    # and native variants use the same rendering transport; polymesh appearance
    # never masquerades as a native structural difference.
    frozen = stable_orthographic_cameras(project, built.scene.render_mesh(), size)
    if set(VIEWS) - set(frozen):
        raise ValueError("Missing fixed orthographic review cameras")
    admitted = [item for item in receipt["results"] if item["state"] == "native-admitted"]
    if not admitted:
        raise ValueError("No native admitted alternatives exist to render")
    if len(admitted) > 5:
        raise ValueError("Only five finalists may enter costly review")

    original = built.scene.assembly
    native_baseline = original.tessellate()
    original_audit = original.audit(join=True)
    if not original_audit["valid"]:
        raise ValueError("Native source became invalid before comparison")
    result.mkdir(parents=True, exist_ok=True)
    tile_w, tile_h = size
    gutter, header, footer = 12, 64, 35
    sheet_size = (gutter + (tile_w + gutter) * len(VIEWS),
                  header + (len(admitted) + 1) * (tile_h + footer + gutter))
    sheet = Image.new("RGB", sheet_size, (15, 22, 33))
    delta_sheet = Image.new("RGB", sheet_size, (15, 22, 33))
    draw = ImageDraw.Draw(sheet)
    ddraw = ImageDraw.Draw(delta_sheet)
    draw.text((15, 12), "FIRE / FROZEN NATIVE ALTERNATIVES", (228, 239, 249))
    ddraw.text((15, 12), "FIRE / SOURCE-PAIRED SILHOUETTE CHANGE", (228, 239, 249))
    for j, name in enumerate(VIEWS):
        x = gutter + j * (tile_w + gutter) + 6
        draw.text((x, 43), name.upper(), (120, 190, 221))
        ddraw.text((x, 43), name.upper(), (120, 190, 221))

    def paint(mesh, row, *, baseline=None):
        observations = {}
        for j, name in enumerate(VIEWS):
            camera = frozen[name]
            x = gutter + j * (tile_w + gutter)
            y = header + row * (tile_h + footer + gutter)
            rendering = render_controls(mesh, camera, size=size, style={
                "supersample": 1, "work_width": tile_w,
                "linework_mode": "semantic", "line_supersample": 1})
            sheet.paste(rendering["lit_structure"].convert("RGB"), (x, y))
            mask = silhouette(mesh, camera, size=size) > 96
            if baseline is None:
                observations[name] = {
                    "mask_sha256": sha256(mask.astype("uint8").tobytes()).hexdigest(),
                    "occupied": int(mask.sum())}
                delta_sheet.paste(Image.fromarray(mask.astype("uint8") * 255, "L").convert("RGB"), (x, y))
            else:
                reference = baseline[name]["mask"]
                observations[name] = mask_comparison(reference, mask)
                delta_sheet.paste(difference_image(reference, mask), (x, y))
            if baseline is None:
                observations[name]["mask"] = mask
        return observations

    source_views = paint(native_baseline, 0)
    source_masks = {name: {"mask": source_views[name].pop("mask")} for name in VIEWS}
    draw.text((16, header + tile_h + 6), "0  ORIGINAL NATIVE SOURCE (unchanged)",
              (216, 227, 241))
    ddraw.text((16, header + tile_h + 6), "0  ORIGINAL MASK / GREY",
               (216, 227, 241))
    summaries = []
    for rank, item in enumerate(admitted, 1):
        if item["native_audit"].get("valid") is not True:
            raise ValueError("Unverified Fire rule may not render")
        draft = _staged(original)
        draft = grow_program(item["rule_steps"], {}, assembly=draft)
        rerun = draft.audit(join=True)
        if not rerun.get("valid") or rerun["union_solids"] != 1:
            raise ValueError("Reconstructed Fire variant did not pass native audit")
        prior_volume = item["native_audit"]["union_volume"]
        if abs(rerun["union_volume"] - prior_volume) > max(1e-6, prior_volume * 1e-7):
            raise ValueError("Fire CAD union volume departed from original native receipt")
        witness = draft.relation_witness(location=project.location)
        if witness.witness_id != item["witness_id"]:
            raise ValueError("Fire alternative no longer matches native witness")
        observations = paint(draft.tessellate(), rank, baseline=source_masks)
        y = header + rank * (tile_h + footer + gutter) + tile_h + 6
        draw.text((16, y), f"{rank}  {item['id']}  [{item['relation']}]  native CAD",
                  (216, 227, 241))
        ddraw.text((16, y), f"{rank}  {item['id']}  cyan added / coral removed",
                   (216, 227, 241))
        summaries.append({
            "id": item["id"], "witness_id": witness.witness_id,
            "views": observations, "native_valid": True,
            "added_volume": item["added_volume"],
            "native_part_delta": item["part_delta"],
            "expressed_in_views": [name for name in VIEWS if observations[name]["changed"] > 0],
        })
    sheet.save(result / "fire_native_orthos.png")
    delta_sheet.save(result / "fire_native_differences.png")
    _atomic(result / "provenance.jsonld", provenance_document(receipt))
    payload = {
        "schema": "projection-loom/fire-orthographic-handback",
        "audition_sha256": receipt["sha256"],
        "source": "verified native CAD alternatives, not Operator-approved survivors",
        "native_source_witness_id": receipt["original_witness_id"],
        "source_union_volume": original_audit["union_volume"],
        "cameras": {name: frozen[name].to_dict() for name in VIEWS},
        "original_views": source_views,
        "alternatives": summaries,
        "image": {"path": "fire_native_orthos.png",
                  "sha256": sha256((result / "fire_native_orthos.png").read_bytes()).hexdigest()},
        "differences": {"path": "fire_native_differences.png",
                        "sha256": sha256((result / "fire_native_differences.png").read_bytes()).hexdigest(),
                        "legend": {"appeared": "cyan", "disappeared": "coral",
                                   "shared": "grey", "empty": "near-black"}},
        "evidence_scope": "same-camera native silhouette difference; no mechanical or historical reconstruction claim",
    }
    payload["sha256"] = canonical_json_sha256(payload)
    _atomic(result / "summary.json", payload)
    return payload
