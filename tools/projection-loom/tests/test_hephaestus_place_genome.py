"""N8-B: a multi-body genotype preserves source-independent native ancestry."""
import pytest
from projection_loom.developmental import GrowthNode, GrowthProgram
from projection_loom.place_genome import PlaceGenome,PlaceBody,Walkway

def scene():
    def body(name,size,translation):
        return PlaceBody(name,GrowthProgram((GrowthNode("root","foundation",size=size),)),translation)
    return PlaceGenome((body("deck",(12,2,.5),(5,0,2)),
                        body("east",(4,4,2),(10,0,0)),
                        body("west",(4,4,2),(0,0,0))),
                       (Walkway("west","deck","east"),))

def test_place_is_heritable_multi_body_not_a_false_global_union():
    original=scene()
    assert PlaceGenome.from_dict(original.to_dict()).identity==original.identity
    changed=original.vary(123)
    assert changed.identity!=original.identity
    assert changed.walkways==original.walkways
    assert changed.bodies[1:]==original.bodies[1:]
    assert changed.vary(4)==original.vary(123).vary(4)
    assert len(changed.declaration("two-heights")["assemblies"])==3

def test_place_refuses_ambiguous_or_unbound_members():
    with pytest.raises(ValueError,match="endpoints"):
        PlaceGenome(scene().bodies,(Walkway("west","missing","east"),))
    with pytest.raises(ValueError,match="unique sorted"):
        PlaceGenome(tuple(reversed(scene().bodies)))
    with pytest.raises(ValueError,match="exact"):
        PlaceGenome.from_dict({"schema":"projection-loom/place-genome","bodies":[]})

def test_intent_actually_constructs_missing_spatial_relationship():
    from projection_loom.intent_seed import IntentContract
    from projection_loom.spatial_intent import SpatialIntent,SpatialGoal
    from projection_loom.place_genome import propose_from_spatial_intent
    original=PlaceGenome(scene().bodies[1:],())  # two rooted sites, no deck
    intent=IntentContract("two-heights","Connect the heights",("crossing",))
    goal=SpatialIntent(intent.identity,(SpatialGoal("connect","west","east"),),"fire")
    generated=propose_from_spatial_intent(original,goal)
    assert generated.identity!=original.identity
    assert len(generated.bodies)==3 and len(generated.walkways)==1
    assert generated.bodies[0].entity_id=="east"
    assert proposed_again(generated,goal).identity==generated.identity
    assert original.walkways==()

def proposed_again(genome,goal):
    from projection_loom.place_genome import propose_from_spatial_intent
    return propose_from_spatial_intent(genome,goal)

def test_same_source_different_intent_changes_the_proposed_topology():
    from projection_loom.intent_seed import IntentContract
    from projection_loom.spatial_intent import SpatialGoal,SpatialIntent
    from projection_loom.place_genome import propose_from_spatial_intent
    original=PlaceGenome(scene().bodies[1:],())
    i=IntentContract("two-heights","Different potential narratives",("crossing","shelter"))
    passage=SpatialIntent(i.identity,(SpatialGoal("connect","west","east"),),"fire")
    refuge=SpatialIntent(i.identity,(SpatialGoal("shelter","west","east"),),"fire")
    a=propose_from_spatial_intent(original,passage)
    b=propose_from_spatial_intent(original,refuge)
    assert len(a.bodies)==3 and a.walkways
    assert b==original and not b.walkways
    # An unsupported artistic goal remains an unbuilt study, not made-up geometry.

def test_diagonal_and_mismatched_elevation_are_explicit_intent_refusals():
    from projection_loom.intent_seed import IntentContract
    from projection_loom.spatial_intent import SpatialGoal,SpatialIntent
    from projection_loom.place_genome import propose_from_spatial_intent
    original=PlaceGenome(scene().bodies[1:],())
    i=IntentContract("two-heights","A path",("crossing",))
    goal=SpatialIntent(i.identity,(SpatialGoal("connect","west","east"),),"operator")
    changed=list(original.bodies)
    changed[0]=PlaceBody("east",changed[0].program,(10,1,0))
    with pytest.raises(ValueError,match="axis-aligned"):
        propose_from_spatial_intent(PlaceGenome(tuple(changed)),goal)
    changed[0]=PlaceBody("east",changed[0].program,(10,0,2))
    with pytest.raises(ValueError,match="equally elevated"):
        propose_from_spatial_intent(PlaceGenome(tuple(changed)),goal)
