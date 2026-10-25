"""Pre-campaign RED contracts: capacity, fair emitters and measured ancestry.

These small tests have no access to the frozen Necrospire experiment. They
protect the existing OODA-HA helm, not a competing optimization controller.
"""
import copy
import hashlib

import pytest

from projection_loom.campaign import LineageArchive
from projection_loom.epochs import Proposal, WideEpoch
from projection_loom.search_strategy import diversity_parents, pareto_front
from projection_loom.selection import schedule_candidates
from projection_loom.solid import SolidAssembly, box


def test_exact_budget_overflow_rotation_remains_fair_when_preview_rankings_move():
    """A moving preview should not let its ordering cancel the fair rotation."""
    rows = [Proposal(key, key, {"x":float(index)})
            for index,key in enumerate(("a","b","c","d"))]
    seen = []
    for turn in range(4):
        # Adversarial preview: its ranking rotates backwards as the epoch
        # rotates forward. A preview-ordered rotation keeps choosing a/b.
        result = schedule_candidates(
            rows, max_exact=2, emitter_turn=turn,
            preview=lambda genome,turn=turn:(int(genome["x"])+turn)%4)
        seen.extend(p.emitter for p in result)
    assert sorted(seen) == ["a","a","b","b","c","c","d","d"]
    assert [p.emitter for p in schedule_candidates(
        rows,max_exact=2,emitter_turn=2,
        preview=lambda genome:3-genome["x"])]==["c","d"]


def test_specialist_selection_preserves_true_global_champion_when_masks_collide():
    def member(ident,overall,local,mask,niche):
        return {"id":ident,"combined_loss":overall,
                "specialist_loss":local,"mask_sha256":mask,"niche":niche,
                "losses":{"silhouette":overall}}
    global_best=member("global",.10,.40,"same","shape-a")
    local_best=member("specialist",.20,.01,"same","shape-a")
    novel=member("novel",.30,.08,"different","shape-b")
    parents=diversity_parents([local_best,novel,global_best],limit=2,specialist=True)
    assert [p["id"] for p in parents]==["global","novel"]
    assert len({p["mask_sha256"] for p in parents})==2


def test_pareto_does_not_silently_discard_inconsistent_measured_objectives():
    base={"id":"a","combined_loss":.2,"losses":{"silhouette":.2,"prior":.0}}
    missing={"id":"b","combined_loss":.3,"losses":{"silhouette":.3}}
    with pytest.raises(ValueError,match="objective|loss"):
        pareto_front([base,missing])


def _valid_root(genome):
    body=SolidAssembly()
    body.add_box("root",(0,0,0),(3,3,3),parents=())
    if genome["x"]==0:
        body.add("floating",box((20,0,0),(1,1,1)),parents=["root"])
    return body


def test_failed_native_audition_backfills_remaining_detail_capacity_and_replays(tmp_path):
    checkpoint=tmp_path/"epoch.json"
    proposals=[Proposal("a","sobol",{"x":0.0}),
               Proposal("b","local",{"x":1.0}),
               Proposal("c","local",{"x":2.0})]
    settings={"location":"test","source_digests":{},
             "construction_digest":"a"*64,"objectives":("shape",),
             "score_state":"synthetic","checkpoint":checkpoint,
             "max_exact":3,"max_detail":2}
    runner=WideEpoch(**settings)
    scored=[]
    def measure(genome,assembly):
        scored.append(genome["x"])
        return {"shape":.1*genome["x"]}
    result=runner.run(proposals,grow=_valid_root,score=measure,
                      preview=lambda g:g["x"])
    assert result["results"]["a"]["state"]=="rejected"
    assert result["results"]["b"]["state"]=="scored"
    assert result["results"]["c"]["state"]=="scored"
    assert scored==[1.0,2.0]
    assert result["results"]["c"]["detail_role"]=="backfill"
    assert sum(v["state"]=="scored" for v in result["results"].values())==2
    snapshot=checkpoint.read_bytes()
    resumed=WideEpoch(**settings).run(proposals,grow=_valid_root,score=measure,
                                         preview=lambda g:g["x"])
    assert resumed==result and checkpoint.read_bytes()==snapshot
    assert scored==[1.0,2.0]


def _trial(*,audit=None,combined_loss=.2,losses=None,mask=None):
    candidate={"state":"scored","combined_loss":combined_loss,
               "losses":{"silhouette":.2} if losses is None else losses,
               "phenotype":["visual:"+(mask or hashlib.sha256(b"mask").hexdigest()),
                            "visual-niche:regional-a"],
               "witness_id":"native-witness",
               "evidence_state":"provisional",
               "audit":{"valid":True,"union_solids":1,"union_valid":True} if audit is None else audit}
    return {"run_id":"epoch-one","proposals":{"candidate":{
        "id":"candidate","emitter":"family:needle:local",
        "genome":{"shaft_width":2.0},"parent":"original-seed"}},
        "results":{"candidate":candidate}}


@pytest.mark.parametrize("change",(
    {"audit":{"valid":False,"union_solids":1,"union_valid":True}},
    {"audit":{"valid":True,"union_solids":2,"union_valid":True}},
    {"audit":{"valid":True,"union_solids":1,"union_valid":False}},
    {"combined_loss":-1.0},
    {"losses":{"silhouette":float("inf")}},
    {"mask":"this-is-not-a-sha256-mask"},
))
def test_lineage_archive_rejects_false_native_evidence_without_partial_write(tmp_path,change):
    archive=LineageArchive(tmp_path/"lineage.json",identity={"source":"a"*64})
    before=(tmp_path/"lineage.json").read_bytes()
    trial=_trial(**change)
    with pytest.raises(ValueError,match="audit|loss|mask|geometry|source"):
        archive.assimilate(1,trial)
    assert archive.generation_count==0
    assert not archive.data["members"]
    assert (tmp_path/"lineage.json").read_bytes()==before


def test_local_family_residual_never_distorts_global_quality_ranking(tmp_path):
    checkpoint=tmp_path/"comparability.json"
    choices=[Proposal("a","sobol",{"x":1.0}),
             Proposal("b","local",{"x":2.0})]
    settings={"location":"source-view","source_digests":{},
              "construction_digest":"a"*64,
              "objectives":("silhouette","prior","regional"),
              "local_objectives":("regional",),
              "score_state":"synthetic","checkpoint":checkpoint,
              "max_exact":2,"max_detail":2}
    def score(genome,assembly):
        x=genome["x"]
        return {"silhouette":.10 if x==1 else .12,"prior":0.,
                "regional":.04 if x==1 else 0.}
    runner=WideEpoch(**settings)
    data=runner.run(choices,grow=_valid_root,score=score)
    assert data["results"]["a"]["combined_loss"]==pytest.approx(.10)
    assert data["results"]["b"]["combined_loss"]==pytest.approx(.12)
    assert data["results"]["a"]["losses"]["regional"]==pytest.approx(.04)
    assert any(x["proposal_id"]=="a" for x in data["archive"].values())
    unchanged=checkpoint.read_bytes()
    assert WideEpoch(**settings).run(choices,grow=_valid_root,score=score)==data
    assert checkpoint.read_bytes()==unchanged
    changed=dict(settings,local_objectives=())
    with pytest.raises(ValueError,match="checkpoint"):
        WideEpoch(**changed)
