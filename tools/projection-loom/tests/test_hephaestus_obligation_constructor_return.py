"""The obligation constructor always returns a typed location."""
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.place_genome import PlaceBody,PlaceGenome,propose_from_spatial_intent
from projection_loom.spatial_intent import SpatialGoal,SpatialIntent


def test_composition_preserves_native_place_type():
    p=GrowthProgram((GrowthNode("root","foundation",size=(4,4,2)),))
    place=PlaceGenome((PlaceBody("east",p,(10,0,0)),
                       PlaceBody("west",p,(0,0,0))))
    for goal in (SpatialGoal("connect","west","east"),
                 SpatialGoal("shelter","west","roof")):
        intent=SpatialIntent("a"*64,(goal,),"operator")
        result=propose_from_spatial_intent(place,intent)
        assert isinstance(result,PlaceGenome)
        assert result.identity!=place.identity
