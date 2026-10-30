"""The same authored place enters different source carriers under one helm."""
import json
import pytest
from PIL import Image
from projection_loom.intent_seed import SeedEntry,SeedBundle
from projection_loom.place_source_transfer import run_source_transfer,verify_source_transfer
from test_hephaestus_place_campaign import setup


def inputs(tmp_path):
    image=tmp_path/"source.png"
    Image.new("RGBA",(8,8),(30,30,30,255)).save(image)
    grammar=tmp_path/"grammar.json";grammar.write_text('{"construct":"two sites"}')
    proxy=tmp_path/"proxy.json";proxy.write_text('{"form":"authored local model"}')
    return {kind:SeedBundle((SeedEntry.from_file(kind,path),))
            for kind,path in (("image-group",image),
                              ("constructive-grammar",grammar),
                              ("geometry-proxy",proxy))}


def test_independent_source_carriers_hold_equal_native_budget(tmp_path):
    _,intent,spatial,genome=setup()
    arms=inputs(tmp_path)
    root=tmp_path/"study"
    report=run_source_transfer(arms,intent,spatial,genome,root,
                               epochs=1,offspring=1,exact_budget=1)
    assert len(report["arms"])==3 and report["native_attempts"]==3
    assert report["equal_native_budgets"]
    assert not report["source_conditioned_architecture_proven"]
    assert verify_source_transfer(arms,intent,spatial,genome,root,
                                  epochs=1,offspring=1,exact_budget=1)==report


def test_forged_source_comparison_cannot_rewrite_native_witness(tmp_path):
    _,intent,spatial,genome=setup()
    arms=inputs(tmp_path)
    root=tmp_path/"study"
    run_source_transfer(arms,intent,spatial,genome,root,
                        epochs=1,offspring=1,exact_budget=1)
    file=root/"comparison.json"
    altered=json.loads(file.read_text())
    altered["arms"][0]["admitted"]+=1
    file.write_text(json.dumps(altered))
    with pytest.raises(ValueError,match="diverged"):
        verify_source_transfer(arms,intent,spatial,genome,root,
                               epochs=1,offspring=1,exact_budget=1)

def test_source_transfer_cli_exposes_one_native_helm(tmp_path):
    from projection_loom.cli import main
    _,intent,spatial,genome=setup()
    arms=inputs(tmp_path)
    files={kind:bundle.entries[0].locator for kind,bundle in arms.items()}
    authored={"location":intent.location,"aim":intent.aim,
              "objectives":list(intent.objectives),"invariants":list(intent.invariants),
              "budgets":[list(item) for item in intent.budgets]}
    for name,data in (("sources",files),("intent",authored),
                      ("spatial",spatial.to_dict()),("genome",genome.to_dict())):
        (tmp_path/(name+".json")).write_text(json.dumps(data))
    args=[key for name in ("sources","intent","spatial","genome")
          for key in ("--"+name,str(tmp_path/(name+".json")))]
    args+=["--epochs","1","--offspring","1","--exact-budget","1"]
    destination=tmp_path/"cli-study"
    result=main(["place-source-transfer",*args,"--out",str(destination)])
    assert result["native_attempts"]==3
    assert main(["place-source-transfer-verify",*args,
                 "--study",str(destination)])==result
