"""Exact native segmented place route witnesses, never engineering certification.

Each authored route step proves two positive horizontal STEP face contacts,
a bounded low step and an empty axis-aligned agent corridor. A graph path
may combine several independent steps without creating a global BRep union.
Unverified and competing routes never acquire automatic aesthetic authority.
"""
from __future__ import annotations
from math import isfinite
from pathlib import Path
import json
import cadquery as cq
from OCP.BRepAlgoAPI import BRepAlgoAPI_Common
from .native_support import native_support, _bounds
from .scene_usd import validate_scene
from .place_genome import PlaceGenome, unique_walkway_chain
from .spatial_intent import SpatialIntent
from .place_shelter import native_shelter_cover
from .place_ascent import native_ascent_run
from .native_support import native_support
from .provenance_encoding import canonical_json_sha256


def _solid(path):
    shape=cq.importers.importStep(str(path)).val()
    if not shape.isValid() or len(shape.Solids())!=1:
        raise ValueError("Route requires independently reimported valid STEP solid")
    return shape


def _segment(bundle,manifest,solids,bounds,route,goal,headroom):
    a,b,d=(bounds[x] for x in (route.source,route.destination,route.deck))
    centers=tuple(((v[0]+v[3])/2,(v[1]+v[4])/2) for v in (a,b))
    differences=(centers[1][0]-centers[0][0],centers[1][1]-centers[0][1])
    axis=0 if abs(differences[0])>=abs(differences[1]) else 1
    other=1-axis
    low_main=min(centers[0][axis],centers[1][axis])
    high_main=max(centers[0][axis],centers[1][axis])
    if (abs(differences[other])>1e-7 or high_main-low_main<=1
            or d[axis]>low_main or d[axis+3]<high_main):
        return None,"Deck fails to span an axis-aligned, independently authored corridor"
    shared_y=(max(a[other],b[other],d[other]),
              min(a[other+3],b[other+3],d[other+3]))
    width=shared_y[1]-shared_y[0]
    rise=max(abs(d[5]-a[5]),abs(d[5]-b[5]))
    if width<goal.min_width or rise>goal.max_step:
        return None,"Width or step envelope outside explicitly authored bounds"
    try:
        left=native_support(bundle,route.source,route.deck)
        right=native_support(bundle,route.destination,route.deck)
    except ValueError as exc:
        return None,"Independent native deck bearings refused: "+str(exc)
    mid=[0.,0.,d[5]+headroom/2+0.002]
    mid[axis]=(low_main+high_main)/2
    mid[other]=(shared_y[0]+shared_y[1])/2
    shape=[goal.min_width,goal.min_width,headroom]
    shape[axis]=high_main-low_main
    corridor=cq.Workplane("XY").box(*shape).translate(tuple(mid)).val()
    blocked=[]
    for key,body in solids.items():
        # Independent decks are possible continuations of the same floor,
        # not necessarily upper obstacles. Exact elevation still decides:
        # any body that intrudes into the agent envelope will be measured.
        if key==route.deck:
            continue
        common=BRepAlgoAPI_Common(body.wrapped,corridor.wrapped)
        common.Build()
        if not common.IsDone():
            raise ValueError("Exact native corridor-clearance intersection failed")
        overlap=float(cq.Shape.cast(common.Shape()).Volume())
        if not isfinite(overlap):
            raise ValueError("Nonfinite native corridor volume")
        if overlap>1e-6:
            blocked.append({"entity_id":key,"native_overlap_volume":overlap})
    if blocked:
        return None,"Native solid obstructs declared agent headroom: "+repr(blocked)
    proof={"schema":"projection-loom/natively-bounded-route-proposal",
           "scene_sha256":manifest["sha256"],
           "source":route.source,"destination":route.destination,"deck":route.deck,
           "bearing_sha256":[left["sha256"],right["sha256"]],
           "route_width_lower_bound":float(width),
           "deck_to_endpoint_step_upper_bound":float(rise),
           "agent_headroom":float(headroom),
           "principal_axis":("x" if axis==0 else "y"),
           "native_clearance_obstructions":0,
           "scope":"native-BRep-contact-and-axis-aligned-agent-corridor-only",
           "load_certification":False,"accessibility_certification":False}
    return {**proof,"sha256":canonical_json_sha256(proof)},None


def assess_place(bundle,genome:PlaceGenome,spatial:SpatialIntent,*,headroom=1.8):
    if (not isinstance(genome,PlaceGenome) or not isinstance(spatial,SpatialIntent)
            or type(headroom) not in (int,float) or not isfinite(headroom)
            or not 1<=headroom<=4):
        raise ValueError("Typed spatial intent and bounded agent clearance required")
    bundle=Path(bundle)
    validate_scene(bundle)
    manifest=json.loads((bundle/"manifest.json").read_text(encoding="utf8"))
    if canonical_json_sha256(genome.declaration(manifest["location"]))!=manifest["declaration_sha256"]:
        raise ValueError("Audition scene does not match inherited construction genome")
    bodies={r["entity_id"]:r for r in manifest["bodies"]}
    solids={k:_solid(bundle/v["step_path"]) for k,v in bodies.items()}
    bounds={k:_bounds(v) for k,v in solids.items()}
    outcomes=[]
    for goal in spatial.goals:
        item={"goal":goal.to_dict(),"status":"unverified","proof":None}
        if goal.kind=="bear":
            if goal.subject not in solids or goal.object not in solids:
                item["reason"]="Geometric bearing requires two named independent STEP bodies"
            else:
                chains=[b for b in genome.bearings
                        if b.lower==goal.subject and b.upper==goal.object]
                try:
                    if len(chains)>1:
                        raise ValueError("Competing authored columns require operator selection")
                    if chains:
                        chain=chains[0]
                        contacts=[
                            native_support(bundle,chain.lower,chain.column,
                                minimum_contact_area=max(.05,goal.min_width**2/8)),
                            native_support(bundle,chain.column,chain.upper,
                                minimum_contact_area=max(.05,goal.min_width**2/8))]
                    else:
                        contacts=[native_support(bundle,goal.subject,goal.object,
                            minimum_contact_area=max(.05,goal.min_width**2/8))]
                except ValueError as exc:
                    item["reason"]="Independent native bearing refused: "+str(exc)
                else:
                    item.update(status="geometric-bearing-proposal",
                                proof={"schema":"projection-loom/place-geometric-bearing",
                                       "source":goal.subject,"destination":goal.object,
                                       "scene_sha256":manifest["sha256"],
                                       "genome_sha256":genome.identity,
                                       "support_chain":contacts,
                                       "native_contact":contacts[0] if len(contacts)==1 else None,
                                       "contact_count":len(contacts),
                                       "load_certification":False,
                                       "automatic_promotion":False})
            outcomes.append(item)
            continue
        if goal.kind=="ascend":
            matches=[run for run in genome.ascents
                     if run.source==goal.subject and run.destination==goal.object]
            if len(matches)!=1:
                item["reason"]="Ascent requires exactly one explicit native ordered tread chain"
            else:
                proof,reason=native_ascent_run(bundle,manifest,solids,bounds,
                                              matches[0],goal,headroom=headroom)
                if proof is None:
                    item["reason"]=reason
                else:
                    item.update(status="geometric-ascent-proposal",
                                proof={**proof,"genome_sha256":genome.identity})
            outcomes.append(item)
            continue
        if goal.kind=="shelter":
            proof,reason=native_shelter_cover(bundle,manifest,solids,bounds,goal,
                                               headroom=headroom)
            if proof is None:
                item["reason"]=reason
            else:
                item.update(status="geometric-shelter-proposal",
                            proof={**proof,"genome_sha256":genome.identity})
            outcomes.append(item)
            continue
        if goal.kind!="connect":
            item["reason"]="No native affordance witness implements this goal kind"
            outcomes.append(item)
            continue
        try:
            chain=unique_walkway_chain(genome,goal.subject,goal.object)
        except ValueError as exc:
            item["reason"]=str(exc)
            outcomes.append(item)
            continue
        if not chain:
            item["reason"]="No uniquely declared supported walkway chain for endpoints"
            outcomes.append(item)
            continue
        proofs=[]
        for route in chain:
            proof,reason=_segment(bundle,manifest,solids,bounds,route,goal,headroom)
            if proof is None:
                item["reason"]="Route "+route.source+" to "+route.destination+": "+reason
                break
            proofs.append(proof)
        if len(proofs)==len(chain):
            if len(proofs)==1:
                body={**{k:v for k,v in proofs[0].items() if k!="sha256"},
                      "genome_sha256":genome.identity}
                proof={**body,"sha256":canonical_json_sha256(body)}
            else:
                body={"schema":"projection-loom/native-walkway-chain",
                      "scene_sha256":manifest["sha256"],
                      "genome_sha256":genome.identity,
                      "source":goal.subject,"destination":goal.object,
                      "route_width_lower_bound":min(x["route_width_lower_bound"] for x in proofs),
                      "segments":proofs,"hops":len(proofs),
                      "scope":"bounded-native-contact-chain-not-occupancy-certification",
                      "load_certification":False,"accessibility_certification":False}
                proof={**body,"sha256":canonical_json_sha256(body)}
            item.update(status="geometric-route-proposal",proof=proof)
        outcomes.append(item)
    return {"schema":"projection-loom/place-affordance-audit",
            "location":manifest["location"],"native_scene_sha256":manifest["sha256"],
            "spatial_intent_sha256":spatial.identity,
            "all_declared_goals_witnessed":all(x["status"] in (
                "geometric-route-proposal","geometric-shelter-proposal",
                "geometric-ascent-proposal","geometric-bearing-proposal")
                for x in outcomes),
            "goals":outcomes,"automatic_promotion":False}


def verify_place_affordances(bundle,genome,spatial,record):
    expected=assess_place(bundle,genome,spatial)
    if record!=expected:
        raise ValueError("Recorded architectural affordances differ from native evidence")
    return True
