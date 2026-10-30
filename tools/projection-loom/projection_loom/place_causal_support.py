"""Materialize one exact two-bearing crossing into immutable causal support.

A verified geometric bridge may yield two independently revalidated
`supports` relations. Each applies via the existing native_support and
support_workspace APIs, never by copying a fake graph edge or editing
the source workspace. Shelter and ascent have different evidence scopes.
"""
from __future__ import annotations
import json
from pathlib import Path
from .location_workspace import verify_workspace,support_workspace
from .relational_ground import RelationalGround
from .place_genome import PlaceGenome,unique_walkway_chain
from .spatial_intent import SpatialIntent
from .place_affordances import assess_place
from .native_support import propose_support
from .generalized_campaign import save_once
from .provenance_encoding import canonical_json_sha256


def _json(path):
    return json.loads(Path(path).read_text(encoding="utf8"))


def materialize_crossing_support(source,genome,spatial,destination,*,actor):
    if not actor or not isinstance(actor,str):
        raise ValueError("An attributable operator must request causal materialization")
    if not isinstance(genome,PlaceGenome) or not isinstance(spatial,SpatialIntent):
        raise ValueError("Causal bridge needs typed native bodies and goal")
    source=Path(source)
    initial=verify_workspace(source)
    if len(spatial.goals)!=1 or spatial.goals[0].kind!="connect":
        raise ValueError("Only one independently witnessed horizontal crossing can become supports")
    goal=spatial.goals[0]
    paths=_json(source/"manifest.json")["paths"]
    scene=source/paths["scene"]
    proof=assess_place(scene,genome,spatial)
    if not proof["all_declared_goals_witnessed"]:
        raise ValueError("Native bridge bearing proof missing before causal attachment")
    chain=unique_walkway_chain(genome,goal.subject,goal.object)
    if len(chain)!=1:
        raise ValueError("Causal support requires one explicit native deck, not a route chain")
    deck=chain[0]
    original_ground=RelationalGround.load(source/paths["ground"])
    destination=Path(destination)
    if destination.exists():
        raise ValueError("Causal output must be a fresh immutable destination")
    destination.mkdir(parents=True)
    current=source
    links=[]
    try:
        for number,parent in enumerate((deck.source,deck.destination),1):
            manifest=_json(current/"manifest.json")
            native=current/manifest["paths"]["scene"]
            ground=RelationalGround.load(current/manifest["paths"]["ground"])
            proposal=propose_support(ground,native,parent,deck.deck,actor=actor)
            target=destination/f"support-{number}"
            receipt=support_workspace(current,proposal,target)
            links.append({"bearing_parent":parent,
                          "native_contact_sha256":proposal["native_contact"]["sha256"],
                          "causal_workspace_sha256":receipt["sha256"],
                          "event_id":proposal["operation_receipt"]["event_id"]})
            current=target
        final=verify_workspace(current)
        body={"schema":"projection-loom/native-bridge-causal-binding",
              "source_workspace_sha256":initial["workspace_sha256"],
              "source_genome_sha256":genome.identity,
              "spatial_intent_sha256":spatial.identity,
              "source_native_scene_sha256":proof["native_scene_sha256"],
              "deck":deck.deck,"actor_attribution":actor,
              "links":links,"final_workspace_sha256":final["workspace_sha256"],
              "scope":"two-independent-native-horizontal-bearing-relations",
              "load_certification":False,"automatic_promotion":False}
        record={**body,"sha256":canonical_json_sha256(body)}
        save_once(destination/"receipt.json",record)
        return verify_crossing_support(source,genome,spatial,destination)
    except Exception:
        (destination/"FAILED").write_text("Incomplete causal bridge; no accepted support chain\n",
                                          encoding="utf8")
        raise


def verify_crossing_support(source,genome,spatial,destination):
    source=Path(source);out=Path(destination)
    record=_json(out/"receipt.json")
    if ((out/"FAILED").exists()
            or record.get("schema")!="projection-loom/native-bridge-causal-binding"
            or record.get("scope")!="two-independent-native-horizontal-bearing-relations"
            or record.get("automatic_promotion") is not False
            or record.get("load_certification") is not False):
        raise ValueError("Incomplete or unknown causal bridge receipt")
    body={k:v for k,v in record.items() if k!="sha256"}
    if record["sha256"]!=canonical_json_sha256(body):
        raise ValueError("Changed causal bridge receipt")
    initial=verify_workspace(source)
    if initial["workspace_sha256"]!=record["source_workspace_sha256"]:
        raise ValueError("Causal bridge original source changed")
    src=_json(source/"manifest.json")
    proof=assess_place(source/src["paths"]["scene"],genome,spatial)
    chain=unique_walkway_chain(genome,spatial.goals[0].subject,spatial.goals[0].object)
    if (len(chain)!=1 or len(record["links"])!=2
            or not proof["all_declared_goals_witnessed"]
            or proof["native_scene_sha256"]!=record["source_native_scene_sha256"]
            or genome.identity!=record["source_genome_sha256"]
            or spatial.identity!=record["spatial_intent_sha256"]
            or record["deck"]!=chain[0].deck):
        raise ValueError("Causal bridge geometry or authored intent differs")
    last=initial["workspace_sha256"]
    for number,expected_parent in enumerate((chain[0].source,chain[0].destination),1):
        workspace=out/f"support-{number}"
        verified=verify_workspace(workspace)
        manifest=_json(workspace/"manifest.json")
        relation=RelationalGround.load(workspace/manifest["paths"]["ground"])
        if (manifest["parent_workspace_sha256"]!=last
                or verified["workspace_sha256"]!=record["links"][number-1]["causal_workspace_sha256"]
                or record["links"][number-1]["bearing_parent"]!=expected_parent):
            raise ValueError("Causal support ancestry or native receipt differs")
        required={"parent":expected_parent,"child":chain[0].deck,
                  "verb":"supports","required":True}
        if required not in relation.snapshot()["relations"]:
            raise ValueError("Native bridge lacks its independently attached causal support")
        proposal=_json(workspace/manifest["paths"]["native_support_proposal"])
        link=record["links"][number-1]
        event=proposal["operation_receipt"]["event_id"]
        if (event!=link["event_id"]
                or proposal["native_contact"]["sha256"]!=link["native_contact_sha256"]
                or event not in relation.events
                or relation.events[event]["operation"]["actor"]!=record["actor_attribution"]):
            raise ValueError("Causal support actor, event or native contact receipt changed")
        last=verified["workspace_sha256"]
    if last!=record["final_workspace_sha256"]:
        raise ValueError("Final native causal workspace changed")
    return record
