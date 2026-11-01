"""Location inheritance changes genuine relational bodies, not labels."""
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.place_genome import PlaceBody,PlaceGenome,propose_from_spatial_intent
from projection_loom.place_orthogonal_route import propose_orthogonal_route
from projection_loom.spatial_intent import SpatialGoal,SpatialIntent


def root(name, xyz, dims=(4,4,2)):
    return PlaceBody(name,GrowthProgram((GrowthNode("root","foundation",size=dims),)),xyz)


def test_multi_hop_route_mutation_preserves_source_sites_and_explicit_chain():
    src=PlaceGenome((root("east",(10,10,0)),root("west",(0,0,0))))
    goal=SpatialIntent("a"*64,(SpatialGoal("connect","west","east"),),"operator")
    grown=propose_orthogonal_route(src,goal,turn="x-then-y",corner_id="landing")
    variants=[grown.vary_spatial(goal,seed) for seed in range(20)]
    assert all(v.walkways==grown.walkways for v in variants)
    assert all(v.bodies[0]==grown.bodies[0] for v in variants)
    assert all({b.entity_id for b in v.bodies}=={b.entity_id for b in grown.bodies}
               for v in variants)
    assert len({v.identity for v in variants})>1


def test_bearing_mutation_targets_generated_column_not_original_upper_support():
    source=PlaceGenome((root("high",(0,0,5)),root("low",(0,0,0))))
    goal=SpatialIntent("a"*64,(SpatialGoal("bear","low","high"),),"operator")
    grown=propose_from_spatial_intent(source,goal)
    assert len(grown.bearings)==1
    child=grown.vary_spatial(goal,41)
    column=grown.bearings[0].column
    old={body.entity_id:body for body in grown.bodies}
    new={body.entity_id:body for body in child.bodies}
    assert child.bearings==grown.bearings
    assert new["low"]==old["low"]
    assert new["high"]==old["high"]
    assert new[column]!=old[column]
