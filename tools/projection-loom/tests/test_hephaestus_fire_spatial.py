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

@pytest.mark.parametrize("relation,implementation,expected",[
    ("bridges","bridge-between","connect"),
    ("covers","overhead-canopy","shelter"),
    ("ascends","stair-flight","ascend")])
def test_fire_named_relationships_bind_typed_native_spatial_goals(relation,implementation,expected):
    from projection_loom.fire_contract import ALLOWED,SOURCE
    import json
    assert ALLOWED[relation]==implementation
    schema=json.loads(SOURCE.read_text())
    assert relation in schema["properties"]["alternatives"]["items"]["properties"]["relation"]["enum"]
    intent=IntentContract("place","Construct one explicit relationship",("relation",))
    record=bind_fire_spatial(plan(relation,implementation),intent,original(),
        alternative_id="join-1",source_witness_id="witness-a",authored_by="operator")
    spatial=SpatialIntent.from_dict(record["spatial_intent"])
    assert spatial.goals[0].kind==expected
    assert verify_fire_spatial(record,plan(relation,implementation),intent,original())
    assert not record["automatic_promotion"]


def test_fire_cannot_misbind_a_cover_as_an_ascent():
    intent=IntentContract("place","Native meaning",("relation",))
    with pytest.raises(ValueError,match="implemented"):
        bind_fire_spatial(plan("covers","stair-flight"),intent,original(),
             alternative_id="join-1",source_witness_id="witness-a",
             authored_by="operator")


def test_fire_explicit_two_relation_selection_replays_single_intent():
    from projection_loom.fire_spatial import bind_fire_spatial_set,verify_fire_spatial_set
    native=original()
    roof=PlaceBody("roof",native.bodies[0].program,(0,0,4))
    native=PlaceGenome(tuple(sorted((*native.bodies,roof),key=lambda x:x.entity_id)))
    document=plan()
    doc={k:v for k,v in document.items() if k!="sha256"}
    doc["resolved"]={"a":"west","b":"east","c":"roof"}
    doc["alternatives"]=[{"id":"a-bridge","relation":"bridges",
        "implementation":"bridge-between","subject":"a","object":"b"},
        {"id":"b-cover","relation":"covers",
        "implementation":"overhead-canopy","subject":"a","object":"c"}]
    doc={**doc,"sha256":canonical_json_sha256(doc)}
    intent=IntentContract("place","Join two architectural relations",("crossing","cover"))
    record=bind_fire_spatial_set(doc,intent,native,
        alternative_ids=("a-bridge","b-cover"),source_witness_id="witness-a",
        authored_by="operator")
    assert [g["kind"] for g in record["spatial_intent"]["goals"]]==["connect","shelter"]
    assert verify_fire_spatial_set(record,doc,intent,native)
    assert len(propose_from_spatial_intent(native,SpatialIntent.from_dict(
        record["spatial_intent"])).walkways)==1
    assert not record["automatic_selection"] and not record["automatic_promotion"]
    changed=dict(record,selected_alternative_ids=["b-cover","a-bridge"])
    with pytest.raises(ValueError,match="sorted"):
        verify_fire_spatial_set(changed,doc,intent,native)


def test_joint_fire_binding_refuses_duplicate_architectural_goal():
    from projection_loom.fire_spatial import bind_fire_spatial_set
    base=plan()
    body={k:v for k,v in base.items() if k!="sha256"}
    body["alternatives"]=[dict(body["alternatives"][0],id="a-first"),
                           dict(body["alternatives"][0],id="b-second")]
    document={**body,"sha256":canonical_json_sha256(body)}
    with pytest.raises(ValueError,match="duplicate"):
        bind_fire_spatial_set(document,
            IntentContract("place","Duplicate selection",("bridge",)),
            original(),alternative_ids=("a-first","b-second"),
            source_witness_id="witness-a",authored_by="operator")


def test_joint_fire_receipt_rejects_tampered_child_without_accepting_new_source():
    from projection_loom.fire_spatial import bind_fire_spatial_set,verify_fire_spatial_set
    doc=plan()
    core={k:v for k,v in doc.items() if k!="sha256"}
    core["alternatives"]=[dict(core["alternatives"][0],id="a-first"),
                          dict(core["alternatives"][0],id="b-second",
                               relation="ascends",implementation="stair-flight")]
    plan2={**core,"sha256":canonical_json_sha256(core)}
    intent=IntentContract("place","Selected joint construction",("route","rise"))
    receipt=bind_fire_spatial_set(plan2,intent,original(),
        alternative_ids=("a-first","b-second"),
        source_witness_id="witness-a",authored_by="operator")
    altered={**receipt,"individual_bindings":[dict(x) for x in receipt["individual_bindings"]]}
    altered["individual_bindings"][1]["original_source_witness_id"]="stale"
    with pytest.raises(ValueError,match="differs"):
        verify_fire_spatial_set(altered,plan2,intent,original())
