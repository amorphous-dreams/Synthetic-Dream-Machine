"""Independent full-location crucible: measured sources -> support -> edit -> USD.

Unlike a mock editor, this test calls real CadQuery/OpenCascade and OpenUSD.
Blender application participation has its own separate executable witness.
No step grants external survey authority, engineering load safety, candidate
promotion or automatic operator preference. No second OODA-HA helm exists.
"""
from __future__ import annotations

import json
from pathlib import Path

from .generalized_campaign import save_once
from .seed_adapters import image_group
from .registered_inventory import registered_location_inventory
from .location_workspace import (
    create_workspace, edit_workspace, support_workspace, verify_workspace)
from .native_support import propose_support, native_support
from .relational_ground import RelationalGround
from .scene_variants import build_variants, validate_variants
from .scene_usd import _validate_declaration
from .provenance_encoding import canonical_json_sha256

SCHEMA="projection-loom/full-location-crucible"


def _load(path):
    return json.loads(Path(path).read_text(encoding="utf8"))


def run_holistic(image_manifest, declaration, lower, upper, moved, delta, output):
    """Run one attributable held-out location without a synthetic geometry CRDT."""
    _validate_declaration(declaration)
    declared={x["entity_id"] for x in declaration["assemblies"]}
    if (not {lower,upper,moved} <= declared
            or len({lower,upper,moved}) != 3):
        raise ValueError("A held-out crucible requires three distinct authored native bodies")
    if (not isinstance(delta,(tuple,list)) or len(delta)!=3
            or any(type(v) not in (int,float) for v in delta)
            or all(float(v)==0 for v in delta)):
        raise ValueError("The independent editor move needs a finite nonzero 3D delta")
    import math
    if any(not math.isfinite(float(v)) for v in delta):
        raise ValueError("Crucible translation must be finite")
    adapters=image_group(image_manifest)
    inventory=registered_location_inventory(adapters,declaration["location"])
    out=Path(output)
    if out.exists():
        raise ValueError("The held-out crucible needs a new immutable output directory")
    out.mkdir(parents=True)
    pre={"schema":SCHEMA,
         "location":declaration["location"],
         "image_manifest_sha256":canonical_json_sha256(_load(image_manifest)),
         "source_inventory_sha256":inventory.to_dict()["snapshot_sha256"],
         "authored_declaration_sha256":canonical_json_sha256(declaration),
         "registered_views":len(inventory.registrations),
         "support":{"lower":lower,"upper":upper},
         "independent_move":{"entity_id":moved,"delta":list(delta)},
         "load_certification":False,"automatic_promotion":False}
    save_once(out/"pre_registration.json",pre)
    try:
        origin=out/"initial"
        before=create_workspace(inventory,declaration,origin)
        if not verify_workspace(origin)["valid"]:
            raise ValueError("Initial native location failed full source validation")
        initial_ground=RelationalGround.load(origin/"ground.json")
        native=propose_support(initial_ground,origin/"scene",lower,upper)
        supported=out/"supported"
        support_manifest=support_workspace(origin,native,supported)
        if not verify_workspace(supported)["valid"]:
            raise ValueError("Native-supported location failed independent replay")
        supported_ground=RelationalGround.load(supported/"ground.json")
        proposal={"schema":"projection-loom/editor-proposal","editor":"cli",
                  "actor":"operator-held-out-crucible",
                  "bundle_sha256":support_manifest["scene_sha256"],
                  "observed_frontier":list(supported_ground.frontier),
                  "edits":[{"kind":"translate","entity_id":moved,
                            "delta":[float(x) for x in delta]}]}
        changed=out/"edited"
        edit_manifest=edit_workspace(supported,proposal,changed)
        if not verify_workspace(changed)["valid"]:
            raise ValueError("Independent edit lost source-bound native evidence")
        supported_scene=supported/"scene"
        changed_scene=changed/"revision"/"scene"
        native_after=native_support(changed_scene,lower,upper)
        if native_after["scene_sha256"]!=edit_manifest["scene_sha256"]:
            raise ValueError("Previously supported pair lost its scene identity")
        revised=_load(changed/"revision"/"reconciliation.json")
        if (revised["invalidation_plan"]["native_reaudited"]!=1 or
                revised["invalidation_plan"]["actual_cache_reuse"]!=len(declared)-1):
            raise ValueError("Independent body edit failed real selective native reuse")
        usd=out/"variants"
        variants=build_variants({
            "schema":"projection-loom/scene-variant-input","default":"Before",
            "variants":[
                {"name":"Before","bundle":str(supported_scene)},
                {"name":"After","bundle":str(changed_scene)}]},usd)
        if not validate_variants(usd)["valid"]:
            raise ValueError("Portable native scene variants lost evidence")
        receipt={"schema":SCHEMA,
                 "preregistration_sha256":canonical_json_sha256(pre),
                 "location":inventory.location_id,
                 "initial_workspace_sha256":before["sha256"],
                 "native_support_workspace_sha256":support_manifest["sha256"],
                 "edited_workspace_sha256":edit_manifest["sha256"],
                 "source_inventory_sha256":inventory.to_dict()["snapshot_sha256"],
                 "registered_source_views":len(inventory.registrations),
                 "bearing_evidence":native["native_contact"]["sha256"],
                 "post_edit_bearing_evidence":native_after["sha256"],
                 "edited_entity":moved,
                 "native_reaudited":revised["invalidation_plan"]["native_reaudited"],
                 "native_cache_reused":revised["invalidation_plan"]["actual_cache_reuse"],
                 "usd_variants_sha256":variants["sha256"],
                 "editor_application_witness":"separate real Blender CI",
                 "external_survey_certification":False,
                 "load_certification":False,
                 "operator_winner":None,"automatic_promotion":False}
        save_once(out/"crucible.json",receipt)
        return receipt
    except Exception:
        (out/"FAILED").write_text(
            "Full location crucible incomplete; no accepted evidence result\n",encoding="utf8")
        raise
