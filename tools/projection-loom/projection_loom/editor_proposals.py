"""Editor-neutral causal proposals with exact native regeneration for rigid relocation.

A user or editor may propose a translation of an independent authored assembly.
Arbitrary mesh rewrites, guessed camera registration, and support reparenting
are never quietly converted into growth genomes. The original bundle remains
immutable and all native claims are re-audited on the new branch.
"""
from __future__ import annotations

from copy import deepcopy
import json
import math
from pathlib import Path

from .provenance_encoding import canonical_json_sha256
from .relational_ground import RelationalGround, IDENTITY
from .scene_usd import package_scene, validate_scene, _validate_declaration
from .incremental_graph import graph_for_scene
from .native_support import native_support


def seed_editor_ground(declaration):
    """Bind explicitly authored assembly IDs, not transient CAD or prim names."""
    _validate_declaration(declaration)
    ground = RelationalGround(declaration["location"])
    for row in sorted(declaration["assemblies"], key=lambda x: x["entity_id"]):
        operation = {"kind": "create", "actor": "loom-authored-proposal",
                     "frontier": list(ground.frontier),
                     "target": row["entity_id"],
                     "payload": {"kind": "construct", "authority": "proposed",
                                 "attributes": {"program_sha256": canonical_json_sha256(
                                     row["growth_program"])}}}
        ground, _ = ground.apply(operation)
        translation = row.get("translation", (0, 0, 0))
        if any(float(x) != 0 for x in translation):
            matrix = list(IDENTITY)
            matrix[3], matrix[7], matrix[11] = [float(x) for x in translation]
            ground, _ = ground.apply({
                "kind": "transform", "actor": "loom-authored-proposal",
                "frontier": list(ground.frontier), "target": row["entity_id"],
                "payload": {"matrix": matrix, "frame": "local3d"}})
    return ground


def validate_proposal(proposal, original, ground, bundle):
    required = {"schema", "editor", "actor", "bundle_sha256",
                "observed_frontier", "edits"}
    allowed = required | {"transaction", "support_transfers"}
    if not required <= set(proposal) or set(proposal) - allowed:
        raise ValueError("Editor proposal requires exact fields")
    if proposal["schema"] != "projection-loom/editor-proposal":
        raise ValueError("Unsupported editor proposal schema")
    if proposal["editor"] not in ("cli", "blender", "unreal"):
        raise ValueError("Unknown editor provenance")
    if not isinstance(proposal["actor"], str) or not proposal["actor"].strip():
        raise ValueError("Actor attribution required")
    if (not isinstance(proposal["observed_frontier"], list)
            or not all(isinstance(x, str) for x in proposal["observed_frontier"])):
        raise ValueError("A causal observed frontier is required")
    if not isinstance(proposal["edits"], list) or not 1 <= len(proposal["edits"]) <= 32:
        raise ValueError("One to 32 supported edits required")
    transaction = proposal.get("transaction", "independent")
    if transaction not in ("independent", "support-group", "support-transfer"):
        raise ValueError("Unsupported structural transaction mode")
    if (transaction == "support-transfer") != ("support_transfers" in proposal):
        raise ValueError("Support transfers require one explicitly authored transaction")
    if list(proposal["observed_frontier"]) != list(ground.frontier):
        raise ValueError("Editor transaction requires current causal frontier")
    if len({x.get("entity_id") for x in proposal["edits"]}) != len(proposal["edits"]):
        raise ValueError("Repeated edit target requires its own causal turn")
    if proposal["bundle_sha256"] != bundle["sha256"]:
        raise ValueError("Editor proposal targets a different scene bundle")
    if canonical_json_sha256(original) != bundle["declaration_sha256"]:
        raise ValueError("Authored declaration differs from witnessed scene")
    if ground.location != original["location"]:
        raise ValueError("Editor and ground location differ")
    rows = {x["entity_id"]: x for x in original["assemblies"]}
    expected = set(rows)
    entities = ground.snapshot()["entities"]
    if expected != set(entities):
        raise ValueError("Editor base has mismatched semantic identity inventory")
    for entity_id, row in rows.items():
        observed = entities[entity_id]
        if (observed["kind"] != "construct"
                or observed["attributes"].get("program_sha256")
                != canonical_json_sha256(row["growth_program"])):
            raise ValueError("Editor ground source program identity differs from native declaration")
        matrix = list(IDENTITY)
        matrix[3], matrix[7], matrix[11] = [
            float(x) for x in row.get("translation", (0, 0, 0))]
        if observed["matrix"] != matrix:
            raise ValueError("Editor ground transform differs from the native declaration")
    for edit in proposal["edits"]:
        if not isinstance(edit, dict) or set(edit) != {"entity_id", "kind", "delta"} or edit["kind"] != "translate":
            raise ValueError("Only rigid assembly translation is currently reversible")
        if edit["entity_id"] not in expected:
            raise ValueError("Edit targets unknown semantic entity")
        delta = edit["delta"]
        if (not isinstance(delta, (list, tuple)) or len(delta) != 3
                or any(type(x) not in (int, float) or not math.isfinite(x) for x in delta)):
            raise ValueError("Translation proposal must contain three finite deltas")
    if transaction == "support-transfer":
        transfers = proposal["support_transfers"]
        if (not isinstance(transfers, list) or not transfers
                or len(transfers) + len(proposal["edits"]) > 32):
            raise ValueError("One to 32 combined structural actions required")
        snapshot_relations = ground.snapshot()["relations"]
        edited = {item["entity_id"] for item in proposal["edits"]}
        children = set()
        for transfer in transfers:
            if (not isinstance(transfer, dict) or
                    set(transfer) != {"child", "old_parent", "new_parent"}):
                raise ValueError("Support transfer requires exact child and parent IDs")
            child, old, new = (transfer[x] for x in ("child", "old_parent", "new_parent"))
            if (any(not isinstance(x, str) for x in (child, old, new))
                    or len({child, old, new}) != 3 or
                    not {child, old, new} <= expected or child in children):
                raise ValueError("Support transfer has invalid or duplicated semantic identities")
            if child not in edited:
                raise ValueError("Transferred dependent must have an authored movement")
            if not any(any(float(v) for v in item["delta"])
                       for item in proposal["edits"] if item["entity_id"] == child):
                raise ValueError("Support transfer requires a nonzero dependent movement")
            if {"parent": old, "child": child, "verb": "supports",
                "required": True} not in snapshot_relations:
                raise ValueError("Support transfer requires an existing required bearing")
            children.add(child)
    if transaction == "support-group":
        movement = {edit["entity_id"]: tuple(float(x) for x in edit["delta"])
                    for edit in proposal["edits"]}
        if len(movement) < 2:
            raise ValueError("Support group needs at least two members")
        required_links = [r for r in ground.snapshot()["relations"]
                          if r["required"] and r["verb"] == "supports"]
        bonded = [r for r in required_links
                  if r["parent"] in movement and r["child"] in movement]
        if not bonded:
            raise ValueError("Support group needs a witnessed required support relation")
        for relation in required_links:
            if relation["parent"] in movement:
                if relation["child"] not in movement:
                    raise ValueError("Support-group move must include all required dependents")
                if movement[relation["parent"]] != movement[relation["child"]]:
                    raise ValueError("Support-group members must share an exact rigid delta")
        seen = {next(iter(movement))}
        while True:
            grown = seen | {x for r in bonded for x in (r["parent"], r["child"])
                            if r["parent"] in seen or r["child"] in seen}
            if grown == seen:
                break
            seen = grown
        if seen != set(movement):
            raise ValueError("Support group must form one connected required bearing component")


def apply_proposal(original, ground, source_bundle, proposal, destination):
    """Accept a supported causal proposal and independently rebuild accepted CAD."""
    source_bundle = Path(source_bundle)
    observed = json.loads((source_bundle / "manifest.json").read_text(encoding="utf8"))
    validate_scene(source_bundle)
    validate_proposal(proposal, original, ground, observed)
    revised = deepcopy(original)
    before_graph = graph_for_scene(original)
    actions = []
    for item in sorted(proposal["edits"], key=lambda row: row["entity_id"]):
        row = next(r for r in revised["assemblies"] if r["entity_id"] == item["entity_id"])
        old = [float(x) for x in row.get("translation", (0, 0, 0))]
        new = [old[i] + float(item["delta"][i]) for i in range(3)]
        row["translation"] = new
        matrix = list(IDENTITY)
        matrix[3], matrix[7], matrix[11] = new
        actions.append({"kind": "transform", "actor": proposal["actor"],
                        "target": item["entity_id"],
                        "payload": {"matrix": matrix, "frame": "local3d"}})
    transfers = proposal.get("support_transfers", [])
    # Old contact MUST come from the immutable source scene, before movement.
    old_contacts = [native_support(source_bundle, t["old_parent"], t["child"])
                    for t in transfers]
    for transfer in sorted(transfers, key=lambda row: row["child"]):
        actions.append({"kind": "reparent", "actor": proposal["actor"],
                        "target": transfer["child"],
                        "payload": {"old_parent": transfer["old_parent"],
                                    "new_parent": transfer["new_parent"]}})
    next_ground, batch = ground.apply_batch(
        actions, observed_frontier=proposal["observed_frontier"])
    records = batch["receipts"]
    plan = graph_for_scene(revised).compare(before_graph)
    dest = Path(destination)
    if dest.exists():
        raise ValueError("Regenerated output must be new and immutable")
    dest.mkdir(parents=True)
    try:
        package = package_scene(revised, dest / "scene",
                                reuse_bundle=source_bundle, previous_document=original)
        contacts = []
        for transfer, before in zip(transfers, old_contacts):
            after = native_support(dest / "scene", transfer["new_parent"],
                                   transfer["child"])
            contacts.append({"transfer": transfer, "before": before, "after": after})
        # Every remaining required bearing, not only the transferred one,
        # must survive on the regenerated STEP solids.
        for relation in next_ground.snapshot()["relations"]:
            if relation["verb"] == "supports" and relation["required"]:
                native_support(dest / "scene", relation["parent"], relation["child"])
        next_ground.save(dest / "ground.json")
        (dest / "declaration.json").write_text(json.dumps(revised, indent=2,
                                                         sort_keys=True) + "\n",
                                               encoding="utf8")
        outcome = {"schema": "projection-loom/editor-reconciliation",
                   "origin_bundle_sha256": observed["sha256"],
                   "new_bundle_sha256": package["sha256"],
                   "editor": proposal["editor"],
                   "actor": proposal["actor"],
                   "operations": records,
                   "causal_batch": batch,
                   "transaction_mode": proposal.get("transaction", "independent"),
                   "support_transfers": contacts,
                   "invalidation_plan": {
                       "rebuilt": plan["rebuilt"],
                       "cached_eligible": plan["cached"],
                       "actual_cache_reuse": package["cache"]["actual_native_cache_reuse"],
                       "native_reaudited": package["cache"]["native_reaudited"]},
                   "auto_promotion": False}
        (dest / "reconciliation.json").write_text(json.dumps(outcome, indent=2,
                                                               sort_keys=True) + "\n",
                                                     encoding="utf8")
    except Exception:
        # Failed construction cannot produce a completed reconciliation receipt.
        (dest / "FAILED").write_text("Editor reconciliation aborted; no success receipt\n",
                                     encoding="utf8")
        raise
    return outcome


def verify_transfer_receipts(proposal, receipt, old_scene, new_scene):
    """Independent old/new native contact proof with authored batch alignment."""
    transfers = proposal.get("support_transfers", [])
    if receipt.get("transaction_mode") != "support-transfer" or not transfers:
        raise ValueError("Native transfer receipt requires a structural proposal")
    reported = receipt.get("support_transfers")
    if not isinstance(reported, list) or len(reported) != len(transfers):
        raise ValueError("Native transfer proof count differs from operator intent")
    actions = receipt["causal_batch"]["operations"]
    actual = [(op["target"], op["payload"].get("old_parent"),
               op["payload"].get("new_parent")) for op in actions
              if op["kind"] == "reparent"]
    expected = [(t["child"], t["old_parent"], t["new_parent"])
                for t in sorted(transfers, key=lambda item: item["child"])]
    if actual != expected:
        raise ValueError("Causal reparent actions differ from operator intent")
    for requested, pair in zip(transfers, reported):
        if pair.get("transfer") != requested:
            raise ValueError("Native transfer witness differs from authored proposal")
        for scene, parent, witness in (
                (old_scene, requested["old_parent"], pair["before"]),
                (new_scene, requested["new_parent"], pair["after"])):
            expected_contact = native_support(scene, parent, requested["child"])
            if expected_contact != witness:
                raise ValueError("Independently reimported bearing contact differs")
    return True
