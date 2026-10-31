"""An intentional architectural birth remains legible before STEP audition."""
import copy
import json
import pytest
from projection_loom.intent_seed import IntentContract
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.place_genome import PlaceBody,PlaceGenome
from projection_loom.spatial_intent import SpatialGoal,SpatialIntent
from projection_loom.place_intent_preview import preview_place_intent,verify_place_intent_preview


def inputs():
    prog=lambda size: GrowthProgram((GrowthNode("root","foundation",size=size),))
    original=PlaceGenome((
        PlaceBody("begin",prog((3,3,1)),(0,0,0)),
        PlaceBody("summit",prog((3,3,2.2)),(9,0,0))))
    intent=IntentContract("preview-site","Rise beneath a partial cover",("ascending","cover"))
    spatial=SpatialIntent(intent.identity,(
        SpatialGoal("ascend","begin","summit",.9,.6),
        SpatialGoal("shelter","begin","roof",.9,1.1)),"operator")
    return original,intent,spatial


def test_preview_proves_authored_consequences_without_stamping_native_success():
    original,intent,spatial=inputs()
    preview=preview_place_intent(intent,spatial,original)
    assert preview["original_body_count"]==2
    assert preview["proposed_body_count"]>2
    assert preview["preserved_original_bodies"]==["begin","summit"]
    assert preview["added_relations"]["ascents"]
    assert any(b["entity_id"]=="roof" for b in preview["added_native_bodies"])
    assert not preview["native_audition_completed"] and not preview["automatic_promotion"]
    assert verify_place_intent_preview(intent,spatial,original,preview)


def test_preview_replay_refuses_modified_native_consequences():
    original,intent,spatial=inputs()
    original_receipt=preview_place_intent(intent,spatial,original)
    mutated=copy.deepcopy(original_receipt)
    mutated["added_native_bodies"][0]["placement"][0]+=1
    with pytest.raises(ValueError,match="no longer matches"):
        verify_place_intent_preview(intent,spatial,original,mutated)
    changed_intent=IntentContract("preview-site","A different aim",("ascending","cover"))
    with pytest.raises(ValueError,match="stale intent"):
        preview_place_intent(changed_intent,spatial,original)


def test_preview_cli_writes_and_verifies_the_identical_typed_receipt(tmp_path):
    from projection_loom.cli import main
    original,intent,spatial=inputs()
    raw={"location":intent.location,"aim":intent.aim,
         "objectives":list(intent.objectives),"invariants":list(intent.invariants),
         "budgets":[list(x) for x in intent.budgets]}
    for name,obj in (("intent",raw),("spatial",spatial.to_dict()),("genome",original.to_dict())):
        (tmp_path/(name+".json")).write_text(json.dumps(obj))
    paths=["--intent",str(tmp_path/"intent.json"),
           "--spatial",str(tmp_path/"spatial.json"),
           "--genome",str(tmp_path/"genome.json")]
    receipt=tmp_path/"preview.json"
    data=main(["place-intent-preview",*paths,"--out",str(receipt)])
    assert json.loads(receipt.read_text())==data
    assert main(["place-intent-preview-verify",*paths,"--receipt",str(receipt)])["valid"]
