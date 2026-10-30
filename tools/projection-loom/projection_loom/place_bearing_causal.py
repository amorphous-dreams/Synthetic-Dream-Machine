"""Convert one STEP-witnessed bearing into the existing causal workspace.

Only an operator-attributed geometric contact can append one required
`supports` relation. The original native source remains immutable; the
existing `support_workspace` implementation owns causal frontier and edits.
This establishes no structural engineering certificate.
"""
from __future__ import annotations
from pathlib import Path
import json
from .location_workspace import verify_workspace,support_workspace
from .relational_ground import RelationalGround
from .place_genome import PlaceGenome
from .spatial_intent import SpatialIntent
from .place_affordances import assess_place
from .native_support import native_support,propose_support
from .generalized_campaign import save_once
from .provenance_encoding import canonical_json_sha256


def _read(path):
    return json.loads(Path(path).read_text(encoding="utf8"))


def materialize_bearing_support(source,genome,spatial,destination,*,actor):
    if not isinstance(actor,str) or not actor.strip():
        raise ValueError("Causal bearing materialization requires an attributed operator")
    if not isinstance(genome,PlaceGenome) or not isinstance(spatial,SpatialIntent):
        raise ValueError("Causal materialization requires typed native construction")
    if len(spatial.goals)!=1 or spatial.goals[0].kind!="bear":
        raise ValueError("One native geometric bearing goal is required")
    original=Path(source)
    audit=verify_workspace(original)
    manifest=_read(original/"manifest.json")
    scene=original/manifest["paths"]["scene"]
    evidence=assess_place(scene,genome,spatial)
    if not evidence["all_declared_goals_witnessed"]:
        raise ValueError("Native bearing must independently prove exact contact before causal change")
    goal=spatial.goals[0]
    if any(b.lower==goal.subject and b.upper==goal.object for b in genome.bearings):
        raise ValueError("Two-contact native column needs separately materialized causal bearing links")
    ground=RelationalGround.load(original/manifest["paths"]["ground"])
    proposal=propose_support(ground,scene,goal.subject,goal.object,actor=actor)
    output=Path(destination)
    if output.exists():
        raise ValueError("Causal bearing needs a fresh immutable destination")
    output.mkdir(parents=True)
    try:
        derived=support_workspace(original,proposal,output/"workspace")
        body={"schema":"projection-loom/native-bearing-causal-binding",
              "source_workspace_sha256":audit["workspace_sha256"],
              "source_genome_sha256":genome.identity,
              "spatial_intent_sha256":spatial.identity,
              "source_native_scene_sha256":evidence["native_scene_sha256"],
              "lower":goal.subject,"upper":goal.object,
              "native_contact_sha256":proposal["native_contact"]["sha256"],
              "event_id":proposal["operation_receipt"]["event_id"],
              "actor_attribution":actor,
              "derived_workspace_sha256":derived["sha256"],
              "scope":"one-native-BRep-contact-causal-support-relation",
              "load_certification":False,"automatic_promotion":False}
        record={**body,"sha256":canonical_json_sha256(body)}
        save_once(output/"receipt.json",record)
        return verify_bearing_support(original,genome,spatial,output)
    except Exception:
        (output/"FAILED").write_text("Causal bearing incomplete; no accepted native edit\n",
                                     encoding="utf8")
        raise


def verify_bearing_support(source,genome,spatial,destination):
    src=Path(source);out=Path(destination)
    receipt=_read(out/"receipt.json")
    if (out/"FAILED").exists() or receipt.get("schema")!=(
            "projection-loom/native-bearing-causal-binding")
            or receipt.get("load_certification") is not False
            or receipt.get("automatic_promotion") is not False):
        raise ValueError("Causal bearing lacks valid non-certifying receipt")
    digest=canonical_json_sha256({k:v for k,v in receipt.items() if k!="sha256"})
    if digest!=receipt.get("sha256"):
        raise ValueError("Causal bearing receipt diverges from its original digest")
    original=verify_workspace(src)
    parent_manifest=_read(src/"manifest.json")
    scene=src/parent_manifest["paths"]["scene"]
    witness=assess_place(scene,genome,spatial)
    if (len(spatial.goals)!=1 or spatial.goals[0].kind!="bear"
            or not witness["all_declared_goals_witnessed"]
            or original["workspace_sha256"]!=receipt["source_workspace_sha256"]
            or genome.identity!=receipt["source_genome_sha256"]
            or spatial.identity!=receipt["spatial_intent_sha256"]
            or witness["native_scene_sha256"]!=receipt["source_native_scene_sha256"]):
        raise ValueError("Causal bearing lacks matching original native testimony")
    goal=spatial.goals[0]
    contact=native_support(scene,goal.subject,goal.object,
                           minimum_contact_area=max(.05,goal.min_width**2/8))
    if (goal.subject!=receipt["lower"] or goal.object!=receipt["upper"]
            or contact["sha256"]!=receipt["native_contact_sha256"]):
        raise ValueError("Materialized causal bearing has changed its native contact")
    derived=verify_workspace(out/"workspace")
    meta=_read(out/"workspace"/"manifest.json")
    if (meta["parent_workspace_sha256"]!=original["workspace_sha256"]
            or derived["workspace_sha256"]!=receipt["derived_workspace_sha256"]):
        raise ValueError("Causal bearing has changed its immutable parent frontier")
    ground=RelationalGround.load((out/"workspace")/meta["paths"]["ground"])
    required={"parent":goal.subject,"child":goal.object,
              "verb":"supports","required":True}
    if required not in ground.snapshot()["relations"]:
        raise ValueError("Materialized causal bearing lacks exact required support")
    proposed=_read((out/"workspace")/meta["paths"]["native_support_proposal"])
    event=proposed["operation_receipt"]["event_id"]
    if (event!=receipt["event_id"] or event not in ground.events
            or ground.events[event]["operation"]["actor"]!=receipt["actor_attribution"]
            or proposed["native_contact"]["sha256"]!=receipt["native_contact_sha256"]):
        raise ValueError("Materialized bearing event or operator attribution changed")
    return receipt
