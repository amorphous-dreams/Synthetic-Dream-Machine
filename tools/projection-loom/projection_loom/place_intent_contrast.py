"""N8: fixed-source, equal-budget architectural-intent contrast with real STEP."""
from pathlib import Path
import argparse
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.intent_seed import IntentContract
from projection_loom.place_genome import PlaceBody,PlaceGenome,propose_from_spatial_intent
from projection_loom.spatial_intent import SpatialGoal,SpatialIntent
from projection_loom.place_affordances import assess_place,verify_place_affordances
from projection_loom.scene_usd import package_scene
from projection_loom.receipt_store import save_once
from projection_loom.provenance_encoding import canonical_json_sha256


def run_intent_contrast(out):
    out=Path(out)
    if out.exists():
        raise ValueError("Matched experiment must publish to a new immutable folder")
    out.mkdir(parents=True)
    root=GrowthProgram((GrowthNode("root","foundation",size=(4,4,2)),))
    original=PlaceGenome(tuple(PlaceBody(n,root,(float(i*10),0.,0.))
                               for i,n in enumerate(("site_a","site_b","site_c"))))
    intent=IntentContract("contrasting-site","Which two heights shall the route connect?",
                          ("source-fixed","spatial-diversity"))
    arms=(("a-to-b",SpatialGoal("connect","site_a","site_b")),
          ("b-to-c",SpatialGoal("connect","site_b","site_c")))
    results=[]
    for name,goal in arms:
        spatial=SpatialIntent(intent.identity,(goal,),"test-operator")
        genome=propose_from_spatial_intent(original,spatial)
        path=out/name
        package_scene(genome.declaration(intent.location),path)
        evidence=assess_place(path,genome,spatial)
        if not evidence["all_declared_goals_witnessed"]:
            raise ValueError("Matched intent did not create its independently witnessed crossing")
        verify_place_affordances(path,genome,spatial,evidence)
        save_once(out/(name+".json"),{"genome":genome.to_dict(),
                                   "spatial":spatial.to_dict(),"native":evidence})
        results.append({"name":name,"goal":goal.to_dict(),
                        "native_scene_sha256":evidence["native_scene_sha256"],
                        "place_genome_sha256":genome.identity,
                        "route":genome.walkways[0].to_dict()})
    if results[0]["place_genome_sha256"]==results[1]["place_genome_sha256"]:
        raise AssertionError("Changing authored intent left real construction unchanged")
    report={"schema":"projection-loom/n8-matched-intent-contrast",
            "original_genome_sha256":original.identity,
            "same_original_construction":True,
            "same_exact_native_audition_budget":True,
            "source_fitness_claim":None,"real_survey_claim":False,
            "arms":results,"automatic_artist_winner":False}
    save_once(out/"comparison.json",report)
    return report


def main(argv=None):
    parser=argparse.ArgumentParser()
    parser.add_argument("--out",type=Path,required=True)
    args=parser.parse_args(argv)
    print(run_intent_contrast(args.out))


if __name__=="__main__":
    main()
