"""Matched two- and three-hop topologies test true independent STEP relations."""
import json
import pytest
from projection_loom.place_topology_study import run_topology_study,verify_topology_study
from test_hephaestus_place_three_hop import authored


def test_four_distinct_native_circulation_topologies_under_one_intent(tmp_path):
    original,spatial=authored()
    opts={"location":"topological-place","goal_index":0,"corner_prefix":"lane"}
    root=tmp_path/"study"
    record=run_topology_study(original,spatial,root,**opts)
    assert record["native_attempts"]==4
    assert record["witnessed_route_count"]==4
    assert record["observed_distinct_route_layouts"]==4
    assert sorted(record["observed_hops"])==[2,2,3,3]
    assert len(record["goal_consequences"])==2
    assert record["all_alternatives_witness_every_goal"]
    assert not record["automatic_artistic_winner"]
    assert verify_topology_study(original,spatial,root,**opts)==record


def test_source_bound_topology_study_refuses_forged_goal_or_step(tmp_path):
    original,spatial=authored()
    opts={"location":"topological-place","goal_index":0,"corner_prefix":"lane"}
    root=tmp_path/"study"
    run_topology_study(original,spatial,root,**opts)
    path=root/"x-y-x"/"receipt.json"
    row=json.loads(path.read_text())
    row["witnessed_route"]["hops"]=2
    path.write_text(json.dumps(row))
    with pytest.raises(ValueError,match="changed original goal or STEP evidence"):
        verify_topology_study(original,spatial,root,**opts)
