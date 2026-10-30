"""N8-K: source-backed Fire constructs a tested place relation, never raw prose."""
import pytest
from projection_loom.intent_seed import IntentContract
from projection_loom.spatial_intent import SpatialIntent
from projection_loom.fire_spatial import bind_fire_spatial,verify_fire_spatial
from projection_loom.place_genome import PlaceGenome,PlaceBody,propose_from_spatial_intent
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.provenance_encoding import canonical_json_sha256

def original():
    a=GrowthProgram((GrowthNode("root","foundation",size=(4,4,2)),))
    return PlaceGenome((PlaceBody("east",a,(10,0,0)),PlaceBody("west",a,(0,0,0))))

def plan(relation="bridges", implementation="bridge-between"):
    raw={"schema":"projection-loom/fire-bound-plan","source_witness_id":"witness-a",
         "seed_entity_sha256":None,"location":"place","resolved":{"a":"west","b":"east"},
         "alternatives":[{"id":"join-1","relation":relation,
                          "implementation":implementation,"subject":"a","object":"b"}]}
    return {**raw,"sha256":canonical_json_sha256(raw)}

def test_explicit_selected_fire_relation_changes_native_construction():
    intent=IntentContract("place","Connect an imagined crossing",("crossing",))
    original_place=original()
    record=bind_fire_spatial(plan(),intent,original_place,alternative_id="join-1",
                    source_witness_id="witness-a",authored_by="operator")
    spatial=SpatialIntent.from_dict(record["spatial_intent"])
    assert verify_fire_spatial(record,plan(),intent,original_place)
    assert len(propose_from_spatial_intent(original_place,spatial).bodies)==3
    assert not record["automatic_promotion"]

def test_fire_refuses_unsourced_or_unimplemented_language():
    intent=IntentContract("place","Bridge",("crossing",))
    with pytest.raises(ValueError,match="source location"):
        bind_fire_spatial(plan(),intent,original(),alternative_id="join-1",
                          source_witness_id="wrong",authored_by="operator")
    with pytest.raises(ValueError,match="implemented"):
        bind_fire_spatial(plan("encircles","ring-around"),intent,original(),
                          alternative_id="join-1",source_witness_id="witness-a",
                          authored_by="operator")

def test_fire_binding_cli_preserves_original_plan_and_refuses_stale_witness(tmp_path):
    import json
    from projection_loom.cli import main
    intent=IntentContract("place","Connect an imagined crossing",("crossing",))
    inputs={
        "location":intent.location,"aim":intent.aim,
        "objectives":list(intent.objectives),"invariants":list(intent.invariants),
        "budgets":[list(x) for x in intent.budgets]}
    for n,value in (("intent",inputs),("genome",original().to_dict()),("plan",plan())):
        (tmp_path/(n+".json")).write_text(json.dumps(value))
    root=str(tmp_path)
    binding=tmp_path/"bound.json"
    common=["--plan",root+"/plan.json","--intent",root+"/intent.json",
            "--genome",root+"/genome.json"]
    saved=main(["fire-place-bind",*common,"--alternative","join-1",
                "--witness-id","witness-a","--actor","operator","--out",str(binding)])
    assert saved==json.loads(binding.read_text())
    result=main(["fire-place-verify",*common,"--binding",str(binding)])
    assert result["valid"] and not result["automatic_promotion"]
    with pytest.raises(ValueError,match="original"):
        main(["fire-place-bind",*common,"--alternative","join-1",
              "--witness-id","forged","--actor","operator",
              "--out",str(tmp_path/"forged.json")])
    assert not (tmp_path/"forged.json").exists()
