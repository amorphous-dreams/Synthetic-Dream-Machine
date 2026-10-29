"""One source-bound architectural location across testimony, causality and CAD.

LocationStack is the immutable source/frame inventory; RelationalGround owns
edited semantic identity; native CAD/STEP and OpenUSD provide independently
validated construction and presentation; OODAHAJournal is the *only* phase
helm. No structure or frame is silently inferred from an image or prim name.

Each edit forks a new immutable location workspace. A completion manifest is
published LAST, after independent validation of the native result and its
causal source. A crash cannot turn an unfinished directory into success.
"""
from __future__ import annotations

from copy import deepcopy
from dataclasses import replace
from hashlib import sha256
import json
import shutil
from pathlib import Path

from .editor_proposals import apply_proposal, seed_editor_ground, verify_transfer_receipts
from .fractal_ooda_ha import OODAHAJournal
from .generalized_campaign import save_once
from .location_stack import Element, LocationStack
from .provenance_encoding import canonical_json_sha256
from .relational_ground import IDENTITY, RelationalGround
from .scene_usd import _validate_declaration, package_scene, validate_scene
from .native_support import native_support, verify_support_proposal

SCHEMA = "projection-loom/location-workspace"


def _read(path):
    return json.loads(Path(path).read_text(encoding="utf8"))


def _sha(value):
    return canonical_json_sha256(value)


def _local_frame(inventory, declaration):
    frames = [f for f in inventory.frames.values() if f.kind == "local3d"]
    if len(frames) != 1:
        raise ValueError("Location needs one unambiguous authored local3d frame")
    frame = frames[0]
    units = {"m": 1., "ft": .3048}
    if frame.units != "model_unit" and (
            abs(declaration["meters_per_unit"] - units[frame.units]) > 1e-12):
        raise ValueError("Location local frame units disagree with model geometry")
    return frame


def _check_bindings(inventory, declaration, ground):
    _validate_declaration(declaration)
    inventory.audit()
    if inventory.location_id != declaration["location"] or ground.location != inventory.location_id:
        raise ValueError("Location inventory, semantic ground and geometry disagree")
    _local_frame(inventory, declaration)
    authored = {x["entity_id"]: x for x in declaration["assemblies"]}
    bodies = {k: v for k, v in inventory.elements.items() if v.kind == "cad_body"}
    if set(authored) != set(bodies):
        raise ValueError("Native bodies and location representation inventory disagree")
    for name, element in bodies.items():
        if element.body_token != name or element.epistemic != "proposed":
            raise ValueError("Location CAD handle must bind one proposed native body")
    for relation in inventory.relations:
        if (relation.verb in ("supports", "contains")
                and relation.subject in bodies and relation.object in bodies):
            raise ValueError("Native structure must live in the causal ground, not a second relation authority")
    entities = ground.snapshot()["entities"]
    if set(entities) != set(authored):
        raise ValueError("Causal entity inventory differs from native location")
    for name, row in authored.items():
        entity = entities[name]
        if (entity["kind"] != "construct" or
                entity["attributes"].get("program_sha256") != _sha(row["growth_program"])):
            raise ValueError("Native source ancestry differs from semantic ground")
        matrix = list(IDENTITY)
        matrix[3], matrix[7], matrix[11] = [
            float(x) for x in row.get("translation", (0, 0, 0))]
        if entity["matrix"] != matrix:
            raise ValueError("Native placement differs from semantic ground")
    return authored


def _freeze_sources(inventory, out):
    """Archive exact local source bytes under digest-addressed relative paths.

    Without this step a CI artifact references the runner's absolute /tmp
    paths and cannot be independently reopened after relocation.
    """
    parent=Path(out)/"sources"
    parent.mkdir(parents=True,exist_ok=True)
    for sid, original in list(inventory.sources.items()):
        source=Path(original.locator)
        if not source.is_file():
            raise FileNotFoundError(
                f"Workspace needs actual local source bytes for {sid}, not an unfetched locator")
        destination=parent/original.sha256
        if not destination.exists():
            shutil.copyfile(source,destination)
        digest=sha256(destination.read_bytes()).hexdigest()
        if digest!=original.sha256:
            raise ValueError(f"Portable source archive bytes disagree with {sid}")
        inventory.sources[sid]=replace(original,locator="sources/"+original.sha256)
    if any(v!="matched" for v in inventory.verify_source_bytes(base_dir=out).values()):
        raise ValueError("Portable workspace cannot claim unfetched source testimony")


def _verify_native_supports(ground, native_dir):
    """Every required semantic support must remain supported by exact STEP.

    A native geometric bearing witness is deliberately NOT load certification.
    The proof is recomputed after every source-bound edit; moving a supported
    body away cannot silently preserve a stale support claim.
    """
    for relation in ground.snapshot()["relations"]:
        if relation["required"] and relation["verb"] == "supports":
            native_support(native_dir, relation["parent"], relation["child"])


def _session(folder, declaration, ground, source_digest, scene_digest, *, parent=None):
    identity = {"location": declaration["location"],
                "score_state": "no-calibrated-source-views",
                "run": _sha({"source": source_digest, "scene": scene_digest,
                             "frontier": list(ground.frontier), "parent": parent})}
    journal = OODAHAJournal(folder / "session.json", identity=identity,
                            initial={}, autonomy=1.)
    name = "location/workspace"
    journal.begin(name, parent="location", scope="epoch",
                  evidence={"source": source_digest, "parent": parent},
                  parent_phase="act")
    journal.transition(name, "orient", {"authority": "native-proposed; source-unregistered"})
    journal.transition(name, "decide", {"goal": "reconcile and independently validate native location"})
    journal.transition(name, "act", {"scene_sha256": scene_digest,
                                     "causal_frontier": list(ground.frontier)})
    journal.transition(name, "aftermath", {"native": "reimport-verified",
                                           "operator_promotion": False})
    journal.transition(name, "closed")
    journal.transition("location", "aftermath", {"scene_sha256": scene_digest,
                                                "operator_promotion": False})
    journal.transition("location", "closed")
    journal.data["status"] = "completed"
    journal.save()
    return journal


def _manifest(out, inventory, declaration, ground, scene, *, parent=None,
              proposal=None, reconciliation=None, native_support_proposal=None,
              native_root="scene", declaration_path="declaration.json",
              ground_path="ground.json"):
    kind=("native-support" if native_support_proposal is not None
          else "editor" if proposal is not None else "initial")
    doc = {"schema": SCHEMA, "location": inventory.location_id,
           "change_kind":kind,
           "parent_workspace_sha256": parent,
           "inventory_sha256": inventory.to_dict()["snapshot_sha256"],
           "ground_sha256": ground.to_dict()["sha256"],
           "declaration_sha256": _sha(declaration),
           "scene_sha256": scene["sha256"],
           "paths": {"inventory": "inventory.json", "declaration": declaration_path,
                     "ground": ground_path, "scene": native_root,
                     "session": "session.json",
                     "parent_manifest": "parent-manifest.json" if parent else None,
                     "proposal": "proposal.json" if proposal is not None else None,
                     "reconciliation": "revision/reconciliation.json" if reconciliation is not None else None,
                     "editor_source_ground": "editor-source-ground.json"
                         if proposal is not None else None,
                     "editor_source_scene": "editor-source-scene"
                         if proposal is not None and proposal.get("transaction") == "support-transfer"
                         else None,
                     "native_support_proposal": "native-support-proposal.json"
                         if native_support_proposal is not None else None,
                     "support_source_ground": "support-source-ground.json"
                         if native_support_proposal is not None else None},
           "proposal_sha256": _sha(proposal) if proposal is not None else None,
           "reconciliation_sha256": _sha(reconciliation) if reconciliation is not None else None,
           "native_support_sha256": _sha(native_support_proposal)
               if native_support_proposal is not None else None,
           "journal_sha256": _read(out / "session.json")["snapshot_sha256"],
           "source_authority": "independent-inventory; no-calibrated-pose",
           "automatic_promotion": False}
    result = {**doc, "sha256": _sha(doc)}
    save_once(out / "manifest.json", result)
    return result


def create_workspace(inventory: LocationStack, declaration, destination):
    """Admit the native scene once and bind every body into source inventory."""
    if not isinstance(inventory, LocationStack):
        raise TypeError("Workspace requires a validated LocationStack")
    _validate_declaration(declaration)
    if inventory.location_id != declaration["location"]:
        raise ValueError("Declaration and source location disagree")
    staged = deepcopy(inventory)
    _local_frame(staged, declaration)
    staged.audit()
    staged.verify_source_bytes()
    for row in declaration["assemblies"]:
        if row["entity_id"] in staged.elements:
            raise ValueError("Source inventory already owns constructed semantic ID")
        staged.add_element(Element(row["entity_id"], "cad_body",
                                   body_token=row["entity_id"], epistemic="proposed"))
    ground = seed_editor_ground(declaration)
    _check_bindings(staged, declaration, ground)
    out = Path(destination)
    if out.exists():
        raise ValueError("Workspace output must be new and immutable")
    out.mkdir(parents=True)
    try:
        _freeze_sources(staged,out)
        scene = package_scene(declaration, out / "scene")
        _verify_native_supports(ground, out / "scene")
        save_once(out / "inventory.json", staged.to_dict())
        save_once(out / "declaration.json", declaration)
        ground.save(out / "ground.json")
        _session(out, declaration, ground, staged.to_dict()["snapshot_sha256"],
                 scene["sha256"])
        report = _manifest(out, staged, declaration, ground, scene)
        verify_workspace(out)
        return report
    except Exception:
        (out / "FAILED").write_text("Incomplete location admission; not a success receipt\n",
                                    encoding="utf8")
        raise


def verify_workspace(directory, *, verify_sources=True):
    """Rehydrate and verify all four independent authorities and their join."""
    out = Path(directory)
    m = _read(out / "manifest.json")
    doc = {k: v for k, v in m.items() if k != "sha256"}
    if m.get("schema") != SCHEMA or m.get("sha256") != _sha(doc):
        raise ValueError("Invalid or modified location workspace manifest")
    if (out / "FAILED").exists():
        raise ValueError("A failed workspace cannot replay as complete")
    paths = m["paths"]
    required = {"inventory", "declaration", "ground", "scene", "session",
                "parent_manifest", "proposal", "reconciliation",
                "editor_source_ground", "editor_source_scene",
                "native_support_proposal", "support_source_ground"}
    if set(paths) != required:
        raise ValueError("Workspace has unexpected path roles")
    for value in paths.values():
        if value is None:
            continue
        path = Path(value)
        if path.is_absolute() or not path.parts or ".." in path.parts:
            raise ValueError("Workspace references an escaping path")
        if not (out / path).resolve().is_relative_to(out.resolve()):
            raise ValueError("Workspace reference escapes evidence boundary")
    inventory = LocationStack.load(out / paths["inventory"])
    for item in inventory.sources.values():
        if item.locator!="sources/"+item.sha256:
            raise ValueError("Location source is not a portable content-addressed snapshot")
        if not (out / item.locator).resolve().is_relative_to(out.resolve()):
            raise ValueError("Location source snapshot escaped the portable workspace")
    declaration = _read(out / paths["declaration"])
    ground = RelationalGround.load(out / paths["ground"])
    scene = _read(out / paths["scene"] / "manifest.json")
    validate_scene(out / paths["scene"])
    _check_bindings(inventory, declaration, ground)
    _verify_native_supports(ground, out / paths["scene"])
    if m["location"] != inventory.location_id:
        raise ValueError("Workspace manifest location differs from witnessed source")
    if verify_sources:
        inventory.verify_source_bytes(base_dir=out)
    if (m["inventory_sha256"] != inventory.to_dict()["snapshot_sha256"]
            or m["ground_sha256"] != ground.to_dict()["sha256"]
            or m["declaration_sha256"] != _sha(declaration)
            or m["scene_sha256"] != scene["sha256"]):
        raise ValueError("Workspace source/ground/native scene evidence changed")
    if scene["declaration_sha256"] != m["declaration_sha256"]:
        raise ValueError("Workspace scene and authored geometry differ")
    journal_doc = _read(out / paths["session"])
    if journal_doc.get("snapshot_sha256") != m["journal_sha256"]:
        raise ValueError("Workspace OODA-HA evidence digest changed")
    j = OODAHAJournal(out / paths["session"], identity=journal_doc["identity"],
                       initial={}, autonomy=1.)
    if j.data["status"] != "completed" or any(
            row["phase"] != "closed" for row in j.data["loops"].values()):
        raise ValueError("Workspace OODA-HA session did not complete")
    if (journal_doc["identity"]["run"] != _sha({
            "source": m["inventory_sha256"], "scene": m["scene_sha256"],
            "frontier": list(ground.frontier),
            "parent": m["parent_workspace_sha256"]})):
        raise ValueError("Workspace OODA-HA session does not identify this causal branch")
    if m["parent_workspace_sha256"] is None:
        if paths["parent_manifest"] is not None:
            raise ValueError("Initial workspace cannot invent a predecessor manifest")
        parent_manifest=None
    else:
        if paths["parent_manifest"] is None:
            raise ValueError("Causal fork is missing its independent parent manifest")
        parent_manifest=_read(out / paths["parent_manifest"])
        unsigned={k:v for k,v in parent_manifest.items() if k!="sha256"}
        if (parent_manifest.get("sha256")!=_sha(unsigned)
                or parent_manifest.get("sha256")!=m["parent_workspace_sha256"]
                or parent_manifest.get("location")!=m["location"]
                or parent_manifest.get("inventory_sha256")!=m["inventory_sha256"]):
            raise ValueError("Causal parent manifest changed or mismatches the source location")
    kind=m.get("change_kind")
    if kind=="initial":
        if (m["parent_workspace_sha256"] is not None or
                m["proposal_sha256"] is not None or
                m["reconciliation_sha256"] is not None or
                m["native_support_sha256"] is not None):
            raise ValueError("Initial workspace cannot invent a causal predecessor")
    elif kind=="editor":
        if (m["parent_workspace_sha256"] is None or
                paths["proposal"] is None or paths["reconciliation"] is None or
                paths["editor_source_ground"] is None or
                m["native_support_sha256"] is not None):
            raise ValueError("Editor workspace needs bounded causal proposal receipts")
        proposal, receipt = (_read(out / paths["proposal"]),
                             _read(out / paths["reconciliation"]))
        if _sha(proposal) != m["proposal_sha256"] or _sha(receipt) != m["reconciliation_sha256"]:
            raise ValueError("Workspace edit/reconciliation receipt changed")
        if (receipt["new_bundle_sha256"] != m["scene_sha256"]
                or receipt["origin_bundle_sha256"] != parent_manifest["scene_sha256"]
                or parent_manifest["scene_sha256"] != proposal["bundle_sha256"]
                or receipt["actor"] != proposal["actor"]
                or receipt["editor"] != proposal["editor"]):
            raise ValueError("Workspace edit and native regeneration disagree")
        prior=RelationalGround.load(out / paths["editor_source_ground"])
        if prior.to_dict()["sha256"] != parent_manifest["ground_sha256"]:
            raise ValueError("Edited source ground is not the authenticated parent ground")
        batch = receipt.get("causal_batch")
        if (not isinstance(batch, dict)
                or receipt["operations"] != batch.get("receipts")
                or receipt.get("transaction_mode") != proposal.get("transaction", "independent")
                or batch.get("source_frontier") != proposal["observed_frontier"]):
            raise ValueError("Editor causal batch differs from authored proposal")
        if prior.verify_batch(batch).to_dict() != ground.to_dict():
            raise ValueError("Edited causal ancestry is not independently replayable")
        if proposal.get("transaction") == "support-transfer":
            if not paths["editor_source_scene"]:
                raise ValueError("Transfer requires archived original native STEP scene")
            old_scene = out / paths["editor_source_scene"]
            validate_scene(old_scene)
            archived = _read(old_scene / "manifest.json")
            if archived["sha256"] != parent_manifest["scene_sha256"]:
                raise ValueError("Transfer source native scene differs from parent")
            verify_transfer_receipts(proposal, receipt, old_scene,
                                     out / paths["scene"])
        elif paths["editor_source_scene"] is not None or receipt.get("support_transfers"):
            raise ValueError("Ordinary editor edit cannot claim native transfer proofs")
    elif kind=="native-support":
        if (m["parent_workspace_sha256"] is None or
                m["proposal_sha256"] is not None or
                m["reconciliation_sha256"] is not None or
                paths["native_support_proposal"] is None or
                paths["support_source_ground"] is None):
            raise ValueError("Native support workspace requires independent causal source")
        prior=RelationalGround.load(out / paths["support_source_ground"])
        proposal=_read(out / paths["native_support_proposal"])
        if _sha(proposal)!=m["native_support_sha256"]:
            raise ValueError("Native support proposal receipt changed")
        if (proposal["native_contact"]["scene_sha256"]!=parent_manifest["scene_sha256"]
                or m["scene_sha256"]!=parent_manifest["scene_sha256"]):
            raise ValueError("Native support ancestry requires one unchanged source-bound scene")
        verify_support_proposal(proposal, prior, out / paths["scene"])
        if proposal["next_ground"] != ground.to_dict():
            raise ValueError("Native support operation differs from current causal ground")
    else:
        raise ValueError("Unknown location workspace change kind")
    return {"valid": True, "location": m["location"],
            "entities": len(declaration["assemblies"]),
            "native": "verified-cad-step-usd",
            "source_authority": m["source_authority"],
            "parent": m["parent_workspace_sha256"],
            "workspace_sha256": m["sha256"],
            "operator_promotion": False}


def edit_workspace(previous, proposal, destination):
    """Fork one attributable edit from a fully verified prior location."""
    parent = Path(previous)
    witness = verify_workspace(parent)
    origin = _read(parent / "manifest.json")
    paths = origin["paths"]
    inventory = LocationStack.load(parent / paths["inventory"])
    declaration = _read(parent / paths["declaration"])
    ground = RelationalGround.load(parent / paths["ground"])
    out = Path(destination)
    if out.exists():
        raise ValueError("Workspace output must be a new causal island")
    out.mkdir(parents=True)
    try:
        shutil.copytree(parent / "sources",out / "sources")
        save_once(out / "parent-manifest.json", origin)
        save_once(out / "inventory.json", inventory.to_dict())
        save_once(out / "proposal.json", proposal)
        ground.save(out / "editor-source-ground.json")
        if proposal.get("transaction") == "support-transfer":
            shutil.copytree(parent / paths["scene"], out / "editor-source-scene")
        receipt = apply_proposal(declaration, ground, parent / paths["scene"],
                                 proposal, out / "revision")
        revised = _read(out / "revision" / "declaration.json")
        next_ground = RelationalGround.load(out / "revision" / "ground.json")
        next_scene = _read(out / "revision" / "scene" / "manifest.json")
        _check_bindings(inventory, revised, next_ground)
        _verify_native_supports(next_ground, out / "revision" / "scene")
        _session(out, revised, next_ground, origin["inventory_sha256"],
                 next_scene["sha256"], parent=origin["sha256"])
        report = _manifest(out, inventory, revised, next_ground, next_scene,
                           parent=origin["sha256"], proposal=proposal,
                           reconciliation=receipt, native_root="revision/scene",
                           declaration_path="revision/declaration.json",
                           ground_path="revision/ground.json")
        verify_workspace(out)
        return report
    except Exception:
        (out / "FAILED").write_text("Incomplete location edit; no success receipt\n",
                                    encoding="utf8")
        raise



def support_workspace(previous, proposal, destination):
    """Fork verified native-bearing support as an immutable causal location.

    This only changes relation ancestry. It revalidates native STEP evidence
    and reuses the original scene without alleging a new CAD construction.
    """
    parent=Path(previous)
    verify_workspace(parent)
    original=_read(parent / "manifest.json")
    prior_paths=original["paths"]
    inventory=LocationStack.load(parent / prior_paths["inventory"])
    declaration=_read(parent / prior_paths["declaration"])
    ground=RelationalGround.load(parent / prior_paths["ground"])
    scene_dir=parent / prior_paths["scene"]
    verify_support_proposal(proposal,ground,scene_dir)
    next_ground=RelationalGround.from_dict(proposal["next_ground"])
    _check_bindings(inventory,declaration,next_ground)
    out=Path(destination)
    if out.exists():
        raise ValueError("Native support workspace must be a new causal island")
    out.mkdir(parents=True)
    try:
        shutil.copytree(parent / "sources",out / "sources")
        save_once(out / "parent-manifest.json", original)
        shutil.copytree(scene_dir,out / "scene")
        scene=_read(out / "scene" / "manifest.json")
        if scene["sha256"] != original["scene_sha256"]:
            raise ValueError("Copied source-bound native scene diverged")
        save_once(out / "inventory.json",inventory.to_dict())
        save_once(out / "declaration.json",declaration)
        ground.save(out / "support-source-ground.json")
        next_ground.save(out / "ground.json")
        save_once(out / "native-support-proposal.json",proposal)
        _verify_native_supports(next_ground,out / "scene")
        _session(out,declaration,next_ground,original["inventory_sha256"],
                 scene["sha256"],parent=original["sha256"])
        result=_manifest(out,inventory,declaration,next_ground,scene,
                         parent=original["sha256"],native_support_proposal=proposal)
        verify_workspace(out)
        return result
    except Exception:
        (out / "FAILED").write_text(
            "Incomplete native support relation; no completed location\n",encoding="utf8")
        raise
