"""Measured route order participates in location morphology without ranking."""
from projection_loom.place_campaign import observed_place_descriptor
from projection_loom.place_orthogonal_route import propose_orthogonal_route
from test_hephaestus_place_orthogonal_route import site


def test_route_turn_order_distinguishes_phenotypes_not_artist_winners():
    initial,goal=site()
    outputs=[]
    for turn,axes in (("x-then-y",["x","y"]),("y-then-x",["y","x"])):
        place=propose_orthogonal_route(initial,goal,turn=turn,corner_id="landing")
        proof={"segments":[{"bearing_sha256":["a"*64,"b"*64],
                            "native_clearance_obstructions":0,
                            "principal_axis":axis,
                            "route_width_lower_bound":1.0} for axis in axes]}
        record={"all_declared_goals_witnessed":True,
                "native_scene_sha256":"a"*64,
                "goals":[{"status":"geometric-route-proposal","proof":proof}]}
        phenotype=observed_place_descriptor(place,record)
        assert phenotype["ordered_route_axis_sequences"]==[axes]
        assert phenotype["max_native_route_turns"]==1
        assert phenotype["artistic_fitness_claim"] is None
        outputs.append(phenotype)
    assert outputs[0]["niche"]!=outputs[1]["niche"]
