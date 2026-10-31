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
    assert record["topology_alternatives_offered"]==4
    assert record["construction_refusals"]==[]
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


def test_full_native_topology_cli_round_trip(tmp_path):
    from projection_loom.cli import main
    original,spatial=authored()
    site=tmp_path/"source.json"
    aim=tmp_path/"spatial.json"
    site.write_text(json.dumps(original.to_dict()))
    aim.write_text(json.dumps(spatial.to_dict()))
    flags=["--genome",str(site),"--spatial",str(aim),
           "--location","topological-place","--goal-index","0",
           "--corner-prefix","lane"]
    root=tmp_path/"cli"
    first=main(["place-topology-study",*flags,"--out",str(root)])
    assert first["native_attempts"]==4
    assert main(["place-topology-study-verify",*flags,"--study",str(root)])==first

def test_topology_comparison_retains_one_refused_waypoint_and_other_native_arms(tmp_path):
    from projection_loom.place_genome import PlaceBody,PlaceGenome
    original,spatial=authored()
    extra=PlaceBody("barrier",original.bodies[0].program,(6,0,0))
    site=PlaceGenome(tuple(sorted((*original.bodies,extra),key=lambda v:v.entity_id)))
    args={"location":"topological-place","goal_index":0,"corner_prefix":"lane"}
    root=tmp_path/"barrier-site"
    row=run_topology_study(site,spatial,root,**args)
    assert row["topology_alternatives_offered"]==4
    assert row["native_attempts"]==3
    assert len(row["construction_refusals"])==1
    assert row["construction_refusals"][0]["pattern"]=="x-y-x"
    assert "barrier" in row["construction_refusals"][0]["reason"]
    assert row["arms"][2]["native_evidence"] is None
    assert not row["automatic_artistic_winner"]
    assert verify_topology_study(site,spatial,root,**args)==row


def test_forged_constructive_refusal_is_not_accepted_as_native_proof(tmp_path):
    from projection_loom.place_genome import PlaceBody,PlaceGenome
    original,spatial=authored()
    obstacle=PlaceBody("barrier",original.bodies[0].program,(6,0,0))
    site=PlaceGenome(tuple(sorted((*original.bodies,obstacle),key=lambda x:x.entity_id)))
    args={"location":"topological-place","goal_index":0,"corner_prefix":"lane"}
    root=tmp_path/"source"
    run_topology_study(site,spatial,root,**args)
    p=root/"x-y-x"/"receipt.json"
    row=json.loads(p.read_text())
    row["construction_refusal"]="nothing to see here"
    p.write_text(json.dumps(row))
    with pytest.raises(ValueError,match="changed original goal"):
        verify_topology_study(site,spatial,root,**args)
