"""The place archive remembers everything offered, including deferred births."""
import json
import pytest
from projection_loom.place_campaign import run_place_campaign,verify_place_campaign
from projection_loom.place_genome import PlaceGenome
from projection_loom.provenance_encoding import canonical_json_sha256
from test_hephaestus_place_campaign import setup


def test_deferred_proposals_have_full_typed_source_bearing_genomes(tmp_path):
    campaign=tmp_path/"lineage"
    report=run_place_campaign(*setup(),campaign,epochs=2,
                              offspring=3,exact_budget=1,seed=29)
    assert report["offered"]==6
    assert report["attempted"]==2
    assert report["deferred"]==4
    assert len(report["frontier_sha256"])==2
    for i in range(2):
        recorded=json.loads((campaign/"frontiers"/f"epoch_{i:03d}.json").read_text())
        assert report["frontier_sha256"][i]==canonical_json_sha256(recorded)
        assert [x["audition"] for x in recorded["offered"]]==[
            "attempted","deferred","deferred"]
        assert all(PlaceGenome.from_dict(x["genome"]).identity==
                   x["genome_sha256"] for x in recorded["offered"])
    assert verify_place_campaign(campaign)==report


def test_deferred_native_genome_cannot_be_reshashed_into_history(tmp_path):
    campaign=tmp_path/"tamper"
    run_place_campaign(*setup(),campaign,epochs=1,offspring=3,
                       exact_budget=1,seed=29)
    frontier_path=campaign/"frontiers"/"epoch_000.json"
    altered=json.loads(frontier_path.read_text())
    row=altered["offered"][2]
    row["genome"]["bodies"][0]["translation"][0]+=.25
    row["genome_sha256"]=PlaceGenome.from_dict(row["genome"]).identity
    frontier_path.write_text(json.dumps(altered))
    summary_path=campaign/"summary.json"
    summary=json.loads(summary_path.read_text())
    summary["frontier_sha256"]=[canonical_json_sha256(altered)]
    summary_path.write_text(json.dumps(summary))
    with pytest.raises(ValueError,match="proposal frontier diverged"):
        verify_place_campaign(campaign)
