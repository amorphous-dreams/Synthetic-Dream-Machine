"""A rehashed journal cannot erase the five-phase consequence trail."""
import json
import pytest
from test_hephaestus_place_campaign import setup
from projection_loom.place_campaign import run_place_campaign,verify_place_campaign
from projection_loom.provenance_encoding import canonical_json_sha256
from projection_loom.fractal_ooda_ha import OODAHAJournal
from projection_loom.constructive_phases import audit_closed_constructive_helm


def test_closed_helm_reconciles_all_real_native_candidate_events(tmp_path):
    path=tmp_path/"place"
    summary=run_place_campaign(*setup(),path,epochs=1,offspring=2,exact_budget=1)
    assert verify_place_campaign(path)==summary
    journal=OODAHAJournal(path/"session.json")
    roster=["location/place-000/"+row["candidate_id"]
            for row in summary["candidates"]]
    verdict=audit_closed_constructive_helm(journal,candidate_ids=roster)
    assert verdict["native_candidate_loops"]==1
    assert verdict["closed_loops"]==3
    assert verdict["phase_authority"]=="existing-OODAHAJournal"


def test_rehashed_phase_snapshot_without_aftermath_still_refuses(tmp_path):
    path=tmp_path/"place"
    report=run_place_campaign(*setup(),path,epochs=1,offspring=1,exact_budget=1)
    session=path/"session.json"
    raw=json.loads(session.read_text())
    node=raw["loops"]["location/place-000/"+report["candidates"][0]["candidate_id"]]
    del node["receipts"]["aftermath"]
    raw["snapshot_sha256"]=canonical_json_sha256({
        key:value for key,value in raw.items() if key!="snapshot_sha256"})
    session.write_text(json.dumps(raw))
    with pytest.raises(ValueError,match="five-phase|phase event"):
        verify_place_campaign(path)
