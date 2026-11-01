"""N8-A: language stays inert; only bounded attributed goal bindings execute."""
import pytest
from projection_loom.intent_seed import IntentContract
from projection_loom.spatial_intent import SpatialGoal, SpatialIntent

def test_aim_alone_grants_no_automated_spatial_authority():
    intent=IntentContract("two-heights","Pilgrims emerge into sky",("sanctuary",))
    goal=SpatialGoal("connect","west","east",0.9,1.1)
    bound=SpatialIntent(intent.identity,(goal,),"operator")
    assert SpatialIntent.from_dict(bound.to_dict()).identity==bound.identity
    assert bound.bind(intent) is bound
    other=IntentContract("two-heights","A different interpretation",("sanctuary",))
    with pytest.raises(ValueError,match="stale intent"):
        bound.bind(other)

def test_goal_refuses_silent_unknowns_and_unauthorized_numerics():
    with pytest.raises(ValueError,match="supported relation"):
        SpatialGoal("looks-majestic","west","east")
    with pytest.raises(ValueError,match="distinct"):
        SpatialGoal("connect","west","west")
    with pytest.raises(ValueError,match="finite bounded"):
        SpatialGoal("connect","west","east",float("nan"))
    with pytest.raises(ValueError,match="exact typed"):
        SpatialGoal.from_dict({"kind":"connect","subject":"west","object":"east"})
    intent=IntentContract("two-heights","Walk",("crossing",))
    with pytest.raises(ValueError,match="unique and ordered"):
        SpatialIntent(intent.identity,(SpatialGoal("connect","west","east"),
                                       SpatialGoal("connect","west","east")),"fire")
