"""Matched counterfactual architecture: explicit intent versus leave-one-out arms.

All arms inherit ONE authored native site, original construction and
IntentContract. Exact STEP reimport decides each arm separately. Presence
of a generated solid is not a source survey or proof of artistic merit.
"""
from __future__ import annotations
import json
from pathlib import Path
from .intent_seed import IntentContract
from .spatial_intent import SpatialIntent
from .place_genome import PlaceGenome,propose_from_spatial_intent
from .scene_usd import package_scene
from .place_affordances import assess_place,verify_place_affordances
from .receipt_store import save_once
from .provenance_encoding import canonical_json_sha256, first_json_difference


def _read(path):
    return json.loads(Path(path).read_text(encoding="utf8"))


def _arms(spatial):
    names=[("full",spatial.goals)]
    for index in range(len(spatial.goals)):
        names.append((f"without-{index:02d}",
                      tuple(goal for i,goal in enumerate(spatial.goals) if i!=index)))
    # Individual-intent controls expose which goals construct without
    # collaboration. For two goals, leave-one-out already gives both controls.
    if len(spatial.goals)>2:
        for index,goal in enumerate(spatial.goals):
            names.append((f"only-{index:02d}",(goal,)))
    return names


def goal_contrasts(spatial, records):
    """Attribute constructive consequences to each original authored goal.

    Compare the complete aim with the same goal alone (and the control
    omitting it). A contrast records observed status, never aesthetic or
    architectural synergy, causal certainty or automatic choice.
    """
    if len(records)!=len(_arms(spatial)):
        raise ValueError("Compound contrast needs the complete original arm set")
    rows=dict((row["arm_id"],row) for row in records)
    if len(rows)!=len(records) or set(rows)!={name for name,_ in _arms(spatial)}:
        raise ValueError("Compound contrast lost an original attributed arm")
    def witness(arm,goal):
        row=rows[arm]
        evidence=row["native_evidence"]
        if evidence is None:
            return "not-natively-audited"
        matches=[item["status"] for item in evidence["goals"]
                 if item["goal"]==goal.to_dict()]
        if len(matches)!=1:
            raise ValueError("Compound goal evidence does not match the attributed arm")
        return matches[0]
    out=[]
    n=len(spatial.goals)
    for i,goal in enumerate(spatial.goals):
        alone=f"only-{i:02d}" if n>2 else f"without-{1-i:02d}"
        full=witness("full",goal)
        individual=witness(alone,goal)
        out.append({"goal_sha256":canonical_json_sha256(goal.to_dict()),
                    "full_arm":"full",
                    "single_goal_arm":alone,
                    "without_goal_arm":f"without-{i:02d}",
                    "full_native_status":full,
                    "single_native_status":individual,
                    "without_goal_state":rows[f"without-{i:02d}"]["state"],
                    "observed_status_differs":full!=individual,
                    "causal_synergy_certified":False,
                    "automatic_operator_selection":False})
    return out


def _manifest(intent,spatial,genome):
    return {"schema":"projection-loom/matched-compound-intent-preregistration",
            "location":intent.location,"intent_sha256":intent.identity,
            "spatial_intent":spatial.to_dict(),
            "spatial_intent_sha256":spatial.identity,
            "original_genome_sha256":genome.identity,
            "original_genome":genome.to_dict(),
            "arms":[{"id":name,"goal_sha256":canonical_json_sha256(
                     [goal.to_dict() for goal in goals])}
                    for name,goals in _arms(spatial)],
            "native_auditions_per_arm":1,
            "counterfactual_design":"full-leave-one-out-and-single-goal-controls",
            "source_camera_authority":"none",
            "automatic_artistic_winner":False,
            "automatic_promotion":False}


def verify_compound_intent_study(root,intent,spatial,genome):
    root=Path(root)
    pre=_read(root/"pre_registration.json")
    if (root/"FAILED").exists():
        raise ValueError("An incomplete compound study cannot be accepted on re-entry")
    if pre!=_manifest(intent,spatial,genome):
        raise ValueError("Compound study original construction or authored aim changed at "+str(first_json_difference(_manifest(intent,spatial,genome),pre)))
    receipt=_read(root/"summary.json")
    if receipt["pre_registration_sha256"]!=canonical_json_sha256(pre):
        raise ValueError("Compound study changed original preregistration")
    expected=[]
    for name,goals in _arms(spatial):
        folder=root/name
        row=_read(folder/"receipt.json")
        if (row["arm_id"]!=name
                or row["goal_sha256"]!=canonical_json_sha256([x.to_dict() for x in goals])
                or row["automatic_promotion"] is not False):
            raise ValueError("Ablation arm lost attributed intent or acquired automatic authority")
        if not goals:
            if row["state"]!="control-empty-no-goal" or (folder/"scene").exists():
                raise ValueError("Empty goal control gained unauthorized native witness")
        else:
            arm=SpatialIntent(spatial.intent_sha256,tuple(goals),spatial.authored_by)
            try:
                built=propose_from_spatial_intent(genome,arm)
            except ValueError as exc:
                if row["state"]!="construction-refused" or row["reason"]!=str(exc) or (folder/"scene").exists():
                    raise ValueError("Refused construct changed its causal conditions")
            else:
                if row["genome_sha256"]!=built.identity:
                    raise ValueError("Matched intent arm changed its original native construction")
                actual=assess_place(folder/"scene",built,arm)
                if row["native_evidence"]!=actual:
                    raise ValueError("Compound arm diverged from independently imported STEP witness")
                verify_place_affordances(folder/"scene",built,arm,row["native_evidence"])
                if row["state"]!=("native-spatial-witnessed" if actual["all_declared_goals_witnessed"]
                                  else "spatial-unverified"):
                    raise ValueError("Study arm status diverged from native witness")
        expected.append(row)
    if receipt.get("intent_goal_contrasts")!=goal_contrasts(spatial,expected):
        raise ValueError("Compound contrasts diverged from independent native arm witnesses")
    if receipt["arms"]!=expected or receipt["native_attempts"]!=sum(
            x["native_evidence"] is not None for x in expected):
        raise ValueError("Compound study summary changed its native outcomes")
    if receipt["automatic_artistic_winner"] is not False or receipt["automatic_promotion"] is not False:
        raise ValueError("Matched architectural study may not choose operator intent")
    return receipt


def run_compound_intent_study(intent:IntentContract,spatial:SpatialIntent,
                              genome:PlaceGenome,out):
    if (not isinstance(intent,IntentContract) or not isinstance(spatial,SpatialIntent)
            or not isinstance(genome,PlaceGenome) or not 2<=len(spatial.goals)<=4):
        raise ValueError("Matched compound study needs two to four attributed native goals")
    spatial.bind(intent)
    root=Path(out)
    pre=_manifest(intent,spatial,genome)
    if (root/"summary.json").exists():
        return verify_compound_intent_study(root,intent,spatial,genome)
    if root.exists():
        raise ValueError("Incomplete or occupied compound study refuses false replay")
    root.mkdir(parents=True)
    save_once(root/"pre_registration.json",pre)
    records=[]
    try:
        for name,goals in _arms(spatial):
            folder=root/name
            folder.mkdir(parents=True)
            row={"arm_id":name,"goal_sha256":canonical_json_sha256(
                    [goal.to_dict() for goal in goals]),
                 "state":"control-empty-no-goal" if not goals else "construction-refused",
                 "genome_sha256":None,"native_evidence":None,
                 "reason":None,"automatic_promotion":False}
            if goals:
                arm=SpatialIntent(spatial.intent_sha256,goals,spatial.authored_by)
                try:
                    child=propose_from_spatial_intent(genome,arm)
                except ValueError as exc:
                    row["reason"]=str(exc)
                else:
                    row["genome_sha256"]=child.identity
                    package_scene(child.declaration(intent.location),folder/"scene")
                    proof=assess_place(folder/"scene",child,arm)
                    row["native_evidence"]=proof
                    row["state"]=("native-spatial-witnessed" if proof["all_declared_goals_witnessed"]
                                  else "spatial-unverified")
                    if row["state"]=="spatial-unverified":
                        row["reason"]="One or more original authored goals lacked native proof"
            save_once(folder/"receipt.json",row)
            records.append(row)
        report={"schema":"projection-loom/matched-compound-intent-study",
                "pre_registration_sha256":canonical_json_sha256(pre),
                "same_original_native_genome":True,
                "native_budget_per_arm":1,
                "native_attempts":sum(x["native_evidence"] is not None for x in records),
                "arms":records,"intent_goal_contrasts":goal_contrasts(spatial,records),
                "automatic_artistic_winner":False,
                "automatic_promotion":False}
        save_once(root/"summary.json",report)
        return verify_compound_intent_study(root,intent,spatial,genome)
    except Exception:
        (root/"FAILED").write_text("Compound native intent study incomplete; no accepted verdict\n")
        raise
