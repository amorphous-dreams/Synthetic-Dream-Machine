from hashlib import sha256
from pathlib import Path
import pytest
from projection_loom.intent_seed import SeedEntry, SeedBundle, IntentContract, GrowthContext, normalize_location

def mk(tmp_path,name,kind):
    path=tmp_path/name
    path.write_bytes(name.encode())
    return SeedEntry.from_file(kind,path)

def intent():
    return IntentContract("no-named-subject","grow inhabitable places",
                          ("native-validity","structural-novelty"))

def test_normalizes_same_semantic_source_order(tmp_path):
    i=mk(tmp_path,"image.bin","image-group")
    g=mk(tmp_path,"grammar.bin","constructive-grammar")
    z=mk(tmp_path,"proxy.bin","geometry-proxy")
    a,b=SeedBundle((i,g,z)),SeedBundle((z,g,i))
    assert a.identity==b.identity
    assert normalize_location(a,intent()).to_dict()==normalize_location(b,intent()).to_dict()
    stack=normalize_location(a,intent())
    assert stack.audit()["sources"]==3
    assert stack.audit()["frames"]==2
    assert all(x.observed_as=="source" for x in stack.sources.values() if x.kind=="image_set")
    assert all(x.observed_as=="proposed" for x in stack.sources.values() if x.kind!="image_set")

def test_runs_are_reproducible_but_fork_on_source_or_intent(tmp_path):
    a=SeedBundle((mk(tmp_path,"source-a","image-group"),))
    b=SeedBundle((mk(tmp_path,"source-b","image-group"),))
    i=intent()
    h="a"*64
    ctx=GrowthContext(a,i,h,h,17)
    assert ctx.run_id==GrowthContext(a,i,h,h,17).run_id
    assert ctx.substream_seed("epoch",2,"candidate",4)==ctx.substream_seed("epoch",2,"candidate",4)
    assert ctx.substream_seed("epoch",2,"candidate",4)!=ctx.substream_seed("epoch",2,"candidate",5)
    assert ctx.run_id!=GrowthContext(b,i,h,h,17).run_id
    assert ctx.run_id!=GrowthContext(a,IntentContract(i.location,"new intent",i.objectives),h,h,17).run_id

def test_file_tamper_is_visible(tmp_path):
    e=mk(tmp_path,"source","image-group")
    e.verify_file()
    (tmp_path/"source").write_text("different")
    with pytest.raises(ValueError,match="changed"):
        e.verify_file()

def test_duplicate_and_false_authority_rejected(tmp_path):
    a=mk(tmp_path,"source","image-group")
    with pytest.raises(ValueError,match="Repeated"):
        SeedBundle((a,a))
    with pytest.raises(ValueError,match="pixel"):
        SeedEntry("image-group",a.content_sha256,a.locator,"local3d","source")
    with pytest.raises(ValueError,match="digest"):
        GrowthContext(SeedBundle((a,)),intent(),"?",a.content_sha256,4)

def test_one_artwork_two_channels_stays_one_observation(tmp_path):
    raw=mk(tmp_path,"picture","image-group")
    channels=(("alpha","1"*64),("rgba","2"*64))
    grouped=SeedEntry(raw.kind,raw.content_sha256,raw.locator,raw.frame_kind,
                      raw.authority,channels)
    stack=normalize_location(SeedBundle((grouped,)),intent())
    assert stack.audit()["sources"]==1
