"""Counterfactual goal contrasts have attributable arms and no causal overclaim."""
from projection_loom.compound_intent_study import goal_contrasts,_arms
from projection_loom.spatial_intent import SpatialIntent,SpatialGoal

def test_goal_contrasts_use_one_goal_controls_for_three_intentions():
    goals=(SpatialGoal("bear","floor","roof"),
           SpatialGoal("connect","floor","east"),
           SpatialGoal("shelter","floor","roof"))
    s=SpatialIntent("a"*64,goals,"operator")
    records=[]
    for name,arm in _arms(s):
        records.append({"arm_id":name,
                        "state":"native-spatial-witnessed",
                        "native_evidence":{"goals":[
                            {"goal":goal.to_dict(),"status":"geometric-"+goal.kind+"-proposal"}
                            for goal in arm]}})
    result=goal_contrasts(s,records)
    assert len(result)==3
    assert [r["single_goal_arm"] for r in result]==["only-00","only-01","only-02"]
    assert [r["without_goal_arm"] for r in result]==["without-00","without-01","without-02"]
    assert not any(r["observed_status_differs"] for r in result)
    assert not any(r["causal_synergy_certified"] for r in result)
