"""The same source-bound obligation digest crosses OODA-HA phase boundaries."""
import json
import pytest
from projection_loom.place_campaign import run_place_campaign,verify_place_campaign
from projection_loom.provenance_encoding import canonical_json_sha256
from test_hephaestus_place_campaign import setup


def test_real_place_journal_attests_to_original_composition(tmp_path):
    root=tmp_path/"native"
    result=run_place_campaign(*setup(),root,epochs=1,offspring=1,exact_budget=1)
    pre=json.loads((root/"pre_registration.json").read_text())
    journal=json.loads((root/"session.json").read_text())
    digest=pre["construction_obligations"]["sha256"]
    epoch=journal["loops"]["location/place-000"]
    candidate=journal["loops"]["location/place-000/"+result["candidates"][0]["candidate_id"]]
    assert epoch["receipts"]["observe"]["construction_obligations_sha256"]==digest
    assert epoch["receipts"]["decide"]["construction_obligations_sha256"]==digest
    assert candidate["receipts"]["observe"]["construction_obligations_sha256"]==digest
    assert verify_place_campaign(root)==result


def test_rehashed_journal_cannot_switch_constructive_obligations(tmp_path):
    root=tmp_path/"native"
    run_place_campaign(*setup(),root,epochs=1,offspring=1,exact_budget=1)
    file=root/"session.json"
    session=json.loads(file.read_text())
    epoch=session["loops"]["location/place-000"]
    epoch["receipts"]["decide"]["construction_obligations_sha256"]="0"*64
    for event in session["events"]:
        if (event["kind"]=="phase" and event["loop"]=="location/place-000"
                and event["phase"]=="decide"):
            event["detail"]["construction_obligations_sha256"]="0"*64
    session["snapshot_sha256"]=canonical_json_sha256({
        k:v for k,v in session.items() if k!="snapshot_sha256"})
    file.write_text(json.dumps(session))
    with pytest.raises(ValueError,match="original spatial goal|original compositional intent"):
        verify_place_campaign(root)
