import json
from PIL import Image, ImageDraw
from pathlib import Path
import pytest

from experiments.zero.run import COHORTS,run_matrix,run_fixture_cohort as run_cohort

def fixture(tmp_path):
    root=tmp_path/"inputs"
    for name in ("image_group","brutalist_grammar","ziggurat_proxy"):
        (root/name).mkdir(parents=True)
    im=Image.new("RGBA",(64,96),(0,0,0,0))
    ImageDraw.Draw(im).rectangle((11,7,47,89),fill=(220,120,100,255))
    im.save(root/"image_group"/"original.png")
    im.getchannel("A").save(root/"image_group"/"alpha.png")
    (root/"image_group"/"manifest.json").write_text(json.dumps({
        "kind":"image-group","views":[{"rgba":"original.png",
                                        "alpha":"alpha.png","registration":"provisional"}]}))
    (root/"brutalist_grammar"/"grammar.json").write_text(json.dumps({
        "kind":"constructive-grammar","growth_program":{"nodes":[
            {"key":"root","op":"foundation","size":[7,7,2]},
            {"key":"tower","op":"spawn","parent":"root","face":"up",
             "size":[3,3,2]}]}}))
    (root/"ziggurat_proxy"/"proxy.json").write_text(json.dumps({
        "kind":"geometry-proxy","tiers":[
            {"width":8,"depth":8,"height":2,"offset":[0,0]},
            {"width":5,"depth":5,"height":1.3,"offset":[0,0]}]}))
    return root

def test_matrix_uses_one_helm_and_replays_idempotently(tmp_path):
    root=fixture(tmp_path)
    out=tmp_path/"campaign"
    first=run_matrix(root,out,epochs=1,offspring=2,exact_budget=2,finalists=1)
    assert first["passed"] and len(first["cohorts"])==7
    assert all(v["native_valid"]>=1 for v in first["cohorts"].values())
    assert all((out/k/"session.json").exists() for k in COHORTS)
    before=(out/"matrix.json").read_bytes()
    assert run_matrix(root,out,epochs=1,offspring=2,exact_budget=2,finalists=1)==first
    assert (out/"matrix.json").read_bytes()==before
    assert first["cohorts"]["B"]["finalists"][0]["full_source"] is None
    assert first["cohorts"]["I"]["finalists"][0]["full_source"] is not None
    for cohort,summary in first["cohorts"].items():
        for finalist in summary["finalists"]:
            assert (out/cohort/"finalists"/finalist["id"]/"six_view.png").is_file()

def test_output_forks_on_changed_intent(tmp_path):
    root=fixture(tmp_path);out=tmp_path/"experiment"
    run_cohort(root,("brutalist",),out,epochs=1,offspring=1,exact_budget=1,finalists=1)
    with pytest.raises(ValueError,match="different immutable receipt"):
        run_cohort(root,("brutalist",),out,epochs=2,offspring=1,exact_budget=1,finalists=1)

def test_generic_engine_never_imports_necrospire_builder():
    import inspect
    from projection_loom import generalized_campaign,seed_adapters,developmental,intent_evolution,intent_seed
    for module in (generalized_campaign,seed_adapters,developmental,intent_evolution,intent_seed):
        source=inspect.getsource(module)
        assert "from examples.necrospire" not in source
        assert "import examples.necrospire" not in source


def test_engine_package_has_no_experiment_zero_dependency():
    import inspect
    from projection_loom import generalized_campaign
    code=inspect.getsource(generalized_campaign)
    assert "experiments.zero" not in code
    assert "image_group/manifest.json" not in code
    assert "ziggurat_proxy/proxy.json" not in code
    assert "COHORTS=" not in code


def test_actual_zero_typed_fixture_matrix_is_live(tmp_path):
    from experiments.zero.run import run_matrix
    inputs=Path(__file__).resolve().parents[1]/"experiments"/"zero"/"inputs"
    result=run_matrix(inputs,tmp_path/"zero",epochs=1,offspring=2,exact_budget=2,finalists=1)
    assert result["passed"] and len(result["cohorts"])==7
    assert all(x["native_valid"]>0 for x in result["cohorts"].values())
    assert (tmp_path/"zero"/"IBZ"/"finalists").is_dir()
