"""Operator-facing location comparison from independently verified native receipts.

This is an evidence index, not an aesthetic ranker, a rendered source, or a
structural engineering safety report. It points to verified source-native
USD and STEP assets while preserving every refusal and deferred audition.
"""
from pathlib import Path
import json
from .place_campaign import verify_place_campaign
from .location_workspace import verify_workspace
from .receipt_store import save_once
from .provenance_encoding import canonical_json_sha256


def _load(path):
    return json.loads(Path(path).read_text(encoding="utf8"))


def place_comparison(campaign,destination):
    root=Path(campaign)
    summary=verify_place_campaign(root)
    pre=_load(root/"pre_registration.json")
    if _load(root/"summary.json")!=summary:
        raise ValueError("Place comparison requires an independently verified immutable run")
    items=[]
    for row in summary["candidates"]:
        folder=root/"candidates"/row["candidate_id"]
        entry={"candidate_id":row["candidate_id"],"status":row["status"],
               "genome_sha256":row["genome_sha256"],
               "emitter_receipt":row["emitter_receipt"],
               "epoch":row["epoch"],"native_workspace_sha256":row["workspace_sha256"],
               "original_goal_evidence":row["initial_affordances"],
               "final_goal_evidence":row["affordances"],
               "reason":row["reason"],"native_scene":None,
               "body_count":None,"topology_niche":row.get("niche"),
               "observed_spatial_descriptor":row.get("descriptor"),
               "load_certification":False}
        if row["status"]=="admitted":
            workspace=folder/"workspace"
            check=verify_workspace(workspace)
            if check["workspace_sha256"]!=row["workspace_sha256"]:
                raise ValueError("Place comparison witness has changed since admission")
            manifest=_load(workspace/"manifest.json")
            scene=workspace/manifest["paths"]["scene"]
            native=_load(scene/"manifest.json")
            entry["native_scene"]={
               "scene_sha256":native["sha256"],
               "usd_scene":str((scene/"generated.usda").relative_to(root)),
               "usd_presentation":str((scene/"presentation.usda").relative_to(root)),
               "native_step":{r["entity_id"]:str((scene/r["step_path"]).relative_to(root))
                              for r in native["bodies"]}}
            entry["body_count"]=len(native["bodies"])
            if entry["final_goal_evidence"]["native_scene_sha256"]!=native["sha256"]:
                raise ValueError("Compared spatial evidence points to another native scene")
        items.append(entry)
    deferred=[{"epoch":e,"candidate_id":row["candidate_id"],
               "genome_sha256":row["genome_sha256"],
               "emitter_receipt":row["emitter_receipt"]}
              for e in range(pre["epochs"])
              for row in _load(root/"frontiers"/f"epoch_{e:03d}.json")["offered"]
              if row["audition"]=="deferred"]
    body={"schema":"projection-loom/place-comparison",
          "pre_registration_sha256":summary["pre_registration_sha256"],
          "location":pre["location"],"spatial_intent_sha256":pre["spatial_intent_sha256"],
          "source_evidence_scope":pre["source_evidence_scope"],
          "native_attempts":summary["attempted"],"deferred_attempts":summary["deferred"],
          "admitted":summary["admitted"],"spatial_niches":summary["spatial_niches"],
          "candidates":items,"deferred_proposals":deferred,
          "frontier_sha256":summary["frontier_sha256"],
          "relational_emissions":summary["relational_emissions"],
          "automatic_ranking":False,
          "automatic_artist_winner":False,"automatic_promotion":False}
    record={**body,"sha256":canonical_json_sha256(body)}
    save_once(destination,record)
    return record


def verify_place_comparison(campaign,receipt):
    from tempfile import TemporaryDirectory
    with TemporaryDirectory(prefix="loom-place-comparison-") as tmp:
        expected=place_comparison(campaign,Path(tmp)/"receipt.json")
    if receipt!=expected:
        raise ValueError("Operator comparison diverges from independent native evidence")
    return True
