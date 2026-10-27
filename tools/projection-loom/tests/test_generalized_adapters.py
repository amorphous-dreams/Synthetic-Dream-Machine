import itertools
import json
from pathlib import Path
import pytest
from PIL import Image
from projection_loom.seed_adapters import load_adapters, compose_adapters, image_group
from projection_loom.intent_seed import IntentContract

def sample(tmp_path):
    p=tmp_path/"inputs"
    p.mkdir()
    image=Image.new("RGBA",(64,96),(20,20,20,0))
    from PIL import ImageDraw
    ImageDraw.Draw(image).rectangle((10,8,48,91),fill=(220,130,45,255))
    image.save(p/"image.png")
    image.getchannel("A").save(p/"alpha.png")
    (p/"image-group.json").write_text(json.dumps({
        "kind":"image-group","views":[{"rgba":"image.png","alpha":"alpha.png",
                                        "registration":"provisional","camera":"oblique"}]}))
    (p/"brutalist.json").write_text(json.dumps({
        "kind":"constructive-grammar","genome":{},
        "steps":[
            {"key":"root","op":"root-box","center":[0,0,1.],"size":[6,6,2]},
            {"key":"core","op":"box","center":[0,0,2.8],"size":[3,3,2],
             "parents":["root"],"role":"primary","slot":"brutalist/core"},
            {"key":"cantilever","op":"box","center":[1,0,3.6],"size":[4,3,1],
             "parents":["core"],"slot":"brutalist/cantilever"},
        ]}))
    (p/"ziggurat.json").write_text(json.dumps({
        "kind":"geometry-proxy","tiers":[
        {"width":8,"depth":8,"height":2,"offset":[0,0]},
        {"width":6,"depth":6,"height":1.4,"offset":[.2,0]},
        {"width":4,"depth":4,"height":1.1,"offset":[.1,0]},
        ]}))
    return p

def contract():
    return IntentContract("any-location","construct original architecture",
                          ("native-validity","structural-novelty"))

@pytest.mark.parametrize("bits",[x for k in range(1,4) for x in itertools.combinations(range(3),k)])
def test_seven_seed_combinations_native_audit(tmp_path,bits):
    p=sample(tmp_path)
    paths=[p/"image-group.json",p/"brutalist.json",p/"ziggurat.json"]
    args={}
    for i in bits:
        args[["image_manifest","grammar_path","proxy_path"][i]]=paths[i]
    result=compose_adapters(load_adapters(**args),contract())
    assert result.location.audit()["cad_bodies"]==len(bits)
    assert len(result.audit())==len(bits)
    assert len(result.assemblies)==len(bits)
    assert all(a.audit(join=True)["union_valid"] for a in result.assemblies.values())

def test_duplicate_alpha_not_a_second_source(tmp_path):
    p=sample(tmp_path)
    items=image_group(p/"image-group.json")
    scene=compose_adapters(items,contract())
    assert scene.location.audit()["sources"]==1

def test_claimed_camera_registration_needs_anchors(tmp_path):
    p=sample(tmp_path)
    a=p/"image-group.json"
    j=json.loads(a.read_text())
    j["views"][0]["registration"]="registered"
    a.write_text(json.dumps(j))
    with pytest.raises(ValueError,match="independent"):
        image_group(a)

def test_alpha_disagreement_rejected(tmp_path):
    p=sample(tmp_path)
    (p/"alpha.png").write_bytes((p/"image.png").read_bytes())
    with pytest.raises(ValueError,match="L8"):
        image_group(p/"image-group.json")

def test_order_does_not_change_scene_identity(tmp_path):
    p=sample(tmp_path)
    a=load_adapters(p/"image-group.json",p/"brutalist.json",p/"ziggurat.json")
    b=compose_adapters(a,contract(),audit=False)
    c=compose_adapters(tuple(reversed(a)),contract(),audit=False)
    assert b.location.to_dict()==c.location.to_dict()


def test_typed_grammar_and_proxy_voids_are_real_native_constructions(tmp_path):
    from projection_loom.seed_adapters import constructive_grammar, ziggurat_proxy, proxy_growth_program
    import json
    p=tmp_path/"typed_grammar.json"
    p.write_text(json.dumps({"kind":"constructive-grammar",
      "growth_program":{"nodes":[
      {"key":"root","op":"foundation","size":[7,7,2]},
      {"key":"core","op":"spawn","parent":"root","face":"up","size":[3,3,1.5]},
      {"key":"side","op":"spawn","parent":"core","face":"east","size":[1.6,1.4,1.2]}]}}))
    adapter=constructive_grammar(p)
    build=adapter.build()
    assert build.audit(join=True)["valid"]
    q=tmp_path/"authored_proxy.json"
    q.write_text(json.dumps({"kind":"geometry-proxy",
      "tiers":[{"width":8,"depth":8,"height":2,"offset":[0,0]},
               {"width":5,"depth":5,"height":1.4,"offset":[0,0]}],
      "court":{"size":[1.2,1.2,.7],"offset":[0,0]},
      "gate":{"size":[.8,.8,1],"face":"east","offset":[0,0]}}))
    z=ziggurat_proxy(q)
    result=z.build()
    audit=result.audit(join=True)
    assert audit["valid"] and audit["union_valid"]
    assert len(result.voids.voids)==2
    assert "exterior_gate" in result.voids.voids
    assert proxy_growth_program(z.program).identity
