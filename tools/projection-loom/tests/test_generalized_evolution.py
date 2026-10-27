import numpy as np
from projection_loom.intent_evolution import source_fit,structural_descriptor,QualityArchive,ScoredCandidate,fair_auditions,fixed_inspection_cameras,observe_candidate
from projection_loom.developmental import GrowthNode,GrowthProgram,compile_growth

def prog(side):
    return GrowthProgram((
        GrowthNode("root","foundation",size=(5,5,2)),
        GrowthNode("tower","spawn",parent="root",face=side,size=(2,2,1)),
    ))

def test_source_metric_penalizes_fat_envelope():
    target=np.zeros((64,64),np.uint8);target[10:42,20:36]=255
    small=target.copy()
    fat=np.zeros_like(target);fat[8:48,12:42]=255
    a=source_fit(target,small)
    b=source_fit(target,fat)
    assert a["fitness"]>b["fitness"]
    assert b["fp"]>a["fp"]

def test_image_free_has_no_image_fitness():
    p=prog("east")
    d=structural_descriptor(p)
    c=ScoredCandidate("x",p,True,{},d)
    assert c.objective>0
    assert "iou" not in c.metrics

def test_qd_preserves_different_structural_niches():
    archive=QualityArchive()
    for i,face in enumerate(("up","east","west")):
        p=prog(face)
        c=ScoredCandidate(str(i),p,True,{},structural_descriptor(p))
        archive.consider(c)
    assert archive.receipt()["niches"]==2
    assert archive.receipt()["distinct_programs"]==3

def test_fair_seats_give_every_operator_one_trial():
    tasks=[{"id":f"a{i}","emitter":"mutation","preview_loss":i} for i in range(6)]
    tasks.extend([{"id":"b","emitter":"crossover","preview_loss":9},
                  {"id":"c","emitter":"new-rule","preview_loss":99}])
    seats=fair_auditions(tasks,3)
    assert {x["emitter"] for x in seats}=={"mutation","crossover","new-rule"}

def test_fixed_cameras_are_unchanged_by_new_candidate():
    a=compile_growth(prog("east"))
    b=compile_growth(prog("west"))
    cameras=fixed_inspection_cameras(a.assembly.tessellate(union=True))
    first=observe_candidate(a.assembly.tessellate(union=True),cameras)
    second=observe_candidate(b.assembly.tessellate(union=True),cameras)
    assert first["camera_authority"]=="seed-frozen-provisional"
    assert first["source_observations"]==0
    assert first["synthetic_non_source_sha256"]!=second["synthetic_non_source_sha256"]
