"""Native N8 living-place crucible: one interpreted crossing, actual STEP evidence.

This is a synthetic operator-authored architectural challenge, never Elyncia
canon or an independently surveyed external location.
"""
import argparse
from pathlib import Path
from projection_loom.developmental import GrowthNode, GrowthProgram
from projection_loom.intent_seed import IntentContract
from projection_loom.location_stack import LocationStack
from projection_loom.spatial_intent import SpatialIntent,SpatialGoal
from projection_loom.place_genome import PlaceGenome,PlaceBody,Walkway
from projection_loom.place_campaign import (run_place_campaign, review_place_candidate,
                                            verify_place_campaign, continue_place_campaign)
from projection_loom.generalized_campaign import save_once


def main(argv=None):
    parser=argparse.ArgumentParser()
    parser.add_argument("--out",type=Path,required=True)
    a=parser.parse_args(argv)
    def body(name,dimensions,offset):
        return PlaceBody(name,GrowthProgram((GrowthNode("root","foundation",size=dimensions),)),offset)
    original=PlaceGenome((body("deck",(12,2,.5),(5,0,2)),
                          body("east",(4,4,2),(10,0,0)),
                          body("west",(4,4,2),(0,0,0))),
                         (Walkway("west","deck","east"),))
    intent=IntentContract("n8-two-heights","A passage physically connects two separated heights",
                          ("authored-route","source-honesty"))
    spatial=SpatialIntent(intent.identity,(SpatialGoal("connect","west","east",.8,1.1),),"fire-and-operator")
    source=LocationStack(intent.location)
    summary=run_place_campaign(source,intent,spatial,original,a.out,
                               epochs=2,offspring=3,exact_budget=2,seed=41)
    if not summary["admitted"]:
        raise AssertionError("No measured native crossing survived; do not promote")
    retained=next(r["candidate_id"] for r in summary["candidates"] if r["status"]=="admitted")
    choice=review_place_candidate(a.out,retained,actor="test-operator",
                                  decision="abstain",reason="Await artistic judgment",
                                  destination=a.out.parent/"n8-operator-review.json")
    if choice["review"]["automatic_canon_promotion"] or choice["automatic_next_epoch"]:
        raise AssertionError("Crucible wrongly promoted native architecture")
    verify_place_campaign(a.out)
    # A separate explicit fixture acceptance tests heredity; the abstention
    # above remains preserved, not silently converted into permission.
    accepted=a.out.parent/"n8-fixture-acceptance.json"
    review_place_candidate(a.out,retained,actor="test-operator",decision="accept",
                           reason="Fixture-only lineage acceptance",
                           destination=accepted)
    successor=continue_place_campaign(a.out,accepted,intent,spatial,
              a.out.parent/"n8-successor",epochs=1,offspring=1,exact_budget=1,seed=73)
    if not successor["admitted"] or not verify_place_campaign(a.out.parent/"n8-successor"):
        raise AssertionError("Reviewed native successor failed re-entry")
    report={"schema":"projection-loom/n8-two-heights-witness",
            "admitted":summary["admitted"],"niches":summary["spatial_niches"],
            "candidate":retained,"review_sha256":choice["review"]["sha256"],
            "explicit_accepted_successor":successor["run_id"],
            "unreal_witness":False,"load_certification":False,
            "operator_artistic_winner":False}
    save_once(a.out.parent/"n8-two-heights-report.json",report)
    print(report)
    return report


if __name__=="__main__":
    main()
