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
    if ((out/"FAILED").exists() or receipt.get("schema")!=(
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
    # Revalidate the original causal operation using its recorded native
    # threshold; the separate spatial audit above checks the authored width.
    contact=native_support(scene,goal.subject,goal.object)
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


def materialize_bearing_chain(source,genome,spatial,destination,*,actor):
    """Operator-initiated pair of independent native/causal contact events."""
    if not isinstance(actor,str) or not actor.strip():
        raise ValueError("Native column ancestry requires an attributed operator")
    if not isinstance(genome,PlaceGenome) or not isinstance(spatial,SpatialIntent):
        raise ValueError("Native column ancestry requires typed original construction")
    if len(spatial.goals)!=1 or spatial.goals[0].kind!="bear":
        raise ValueError("Two-step native support needs one original bearing goal")
    goal=spatial.goals[0]
    chain=[b for b in genome.bearings
           if b.lower==goal.subject and b.upper==goal.object]
    if len(chain)!=1:
        raise ValueError("Native column must declare exactly one bounded bearing chain")
    original=Path(source)
    first=verify_workspace(original)
    original_manifest=_read(original/"manifest.json")
    native=original/original_manifest["paths"]["scene"]
    evidence=assess_place(native,genome,spatial)
    if (not evidence["all_declared_goals_witnessed"]
            or evidence["goals"][0]["proof"]["contact_count"]!=2):
        raise ValueError("Both original native bearing contacts must be independently proven")
    src_pairs=((chain[0].lower,chain[0].column),
               (chain[0].column,chain[0].upper))
    output=Path(destination)
    if output.exists():
        raise ValueError("Native column causal handback must use fresh immutable destination")
    output.mkdir(parents=True)
    current=original
    events=[]
    try:
        for idx,(lower,upper) in enumerate(src_pairs,1):
            manifest=_read(current/"manifest.json")
            scene=current/manifest["paths"]["scene"]
            ground=RelationalGround.load(current/manifest["paths"]["ground"])
            proposal=propose_support(ground,scene,lower,upper,actor=actor)
            target=output/f"support-{idx}"
            result=support_workspace(current,proposal,target)
            events.append({"lower":lower,"upper":upper,
                           "native_contact_sha256":proposal["native_contact"]["sha256"],
                           "event_id":proposal["operation_receipt"]["event_id"],
                           "workspace_sha256":result["sha256"]})
            current=target
        final=verify_workspace(current)
        body={"schema":"projection-loom/native-column-causal-chain",
              "source_workspace_sha256":first["workspace_sha256"],
              "source_genome_sha256":genome.identity,
              "spatial_intent_sha256":spatial.identity,
              "source_native_scene_sha256":evidence["native_scene_sha256"],
              "actor_attribution":actor,"events":events,
              "final_workspace_sha256":final["workspace_sha256"],
              "load_certification":False,"automatic_promotion":False,
              "claim_scope":"two-independent-native-column-support-events"}
        receipt={**body,"sha256":canonical_json_sha256(body)}
        save_once(output/"receipt.json",receipt)
        return verify_bearing_chain(original,genome,spatial,output)
    except Exception:
        (output/"FAILED").write_text("Native column causal chain incomplete\n",encoding="utf8")
        raise


def verify_bearing_chain(source,genome,spatial,destination):
    original=Path(source);out=Path(destination)
    report=_read(out/"receipt.json")
    if ((out/"FAILED").exists()
            or report.get("schema")!="projection-loom/native-column-causal-chain"
            or report.get("load_certification") is not False
            or report.get("automatic_promotion") is not False
            or report.get("claim_scope")!="two-independent-native-column-support-events"
            or canonical_json_sha256({k:v for k,v in report.items() if k!="sha256"})
               !=report.get("sha256")):
        raise ValueError("Invalid or altered native column causal receipt")
    if not isinstance(genome,PlaceGenome) or not isinstance(spatial,SpatialIntent):
        raise ValueError("Original typed native column construction required")
    if len(spatial.goals)!=1 or spatial.goals[0].kind!="bear":
        raise ValueError("Native column must keep its unique original bearing goal")
    goal=spatial.goals[0]
    matching=[b for b in genome.bearings
              if b.lower==goal.subject and b.upper==goal.object]
    if len(matching)!=1 or len(report["events"])!=2:
        raise ValueError("Native column causal chain lost its two original links")
    pair=((matching[0].lower,matching[0].column),
          (matching[0].column,matching[0].upper))
    first=verify_workspace(original)
    meta=_read(original/"manifest.json")
    native=original/meta["paths"]["scene"]
    evidence=assess_place(native,genome,spatial)
    if (first["workspace_sha256"]!=report["source_workspace_sha256"]
            or genome.identity!=report["source_genome_sha256"]
            or spatial.identity!=report["spatial_intent_sha256"]
            or not evidence["all_declared_goals_witnessed"]
            or evidence["native_scene_sha256"]!=report["source_native_scene_sha256"]):
        raise ValueError("Original native column evidence diverges")
    prior=first["workspace_sha256"]
    current_source=original
    for idx,(lower,upper) in enumerate(pair,1):
        path=out/f"support-{idx}"
        audited=verify_workspace(path)
        info=_read(path/"manifest.json")
        row=report["events"][idx-1]
        source_info=_read(current_source/"manifest.json")
        scene=current_source/source_info["paths"]["scene"]
        bearing=native_support(scene,lower,upper)
        ground=RelationalGround.load(path/info["paths"]["ground"])
        expected={"parent":lower,"child":upper,"verb":"supports","required":True}
        proposal=_read(path/info["paths"]["native_support_proposal"])
        event=proposal["operation_receipt"]["event_id"]
        if (info["parent_workspace_sha256"]!=prior
                or audited["workspace_sha256"]!=row["workspace_sha256"]
                or row["lower"]!=lower or row["upper"]!=upper
                or bearing["sha256"]!=row["native_contact_sha256"]
                or proposal["native_contact"]["sha256"]!=row["native_contact_sha256"]
                or event!=row["event_id"] or event not in ground.events
                or ground.events[event]["operation"]["actor"]!=report["actor_attribution"]
                or expected not in ground.snapshot()["relations"]):
            raise ValueError("Native column event, face contact or causal frontier changed")
        prior=audited["workspace_sha256"]
        current_source=path
    if prior!=report["final_workspace_sha256"]:
        raise ValueError("Native column final causal evidence changed")
    return report
