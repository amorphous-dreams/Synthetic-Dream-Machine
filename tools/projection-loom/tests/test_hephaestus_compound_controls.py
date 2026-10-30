"""Compound intent retains independent single-goal controls for interactions."""
from projection_loom.spatial_intent import SpatialIntent, SpatialGoal
from projection_loom.compound_intent_study import _arms,_manifest
from projection_loom.intent_seed import IntentContract
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.place_genome import PlaceBody,PlaceGenome


def test_three_goal_contrast_has_singletons_and_leave_one_out():
    goals=tuple(sorted((SpatialGoal("connect","west","east"),
                        SpatialGoal("shelter","west","roof"),
                        SpatialGoal("bear","west","roof")),
                       key=lambda g:(g.kind,g.subject,g.object)))
    spatial=SpatialIntent("a"*64,goals,"operator")
    arms=_arms(spatial)
    assert [name for name,_ in arms]==[
        "full","without-00","without-01","without-02",
        "only-00","only-01","only-02"]
    assert len(set(tuple((g.kind,g.subject,g.object) for g in arm)
                   for _,arm in arms))==7
    assert all(len(arm)==1 for _,arm in arms[-3:])
    assert all(len(arm)==2 for _,arm in arms[1:4])


def test_two_goal_existing_counterfactual_remains_distinct():
    spatial=SpatialIntent("a"*64,(
        SpatialGoal("connect","a","b"),SpatialGoal("shelter","a","c")),"operator")
    assert [name for name,_ in _arms(spatial)]==[
        "full","without-00","without-01"]
