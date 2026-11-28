import json
import pytest
from projection_loom.epochs import Proposal, WideEpoch, propose_methods, project_silhouette_score
from projection_loom.grammar import grow_program
from projection_loom.solid import SolidAssembly,box


def project(genome):
    steps=[{'key':'root','op':'root-box','center':[0,0,0],'size':[4,4,4],
            'has':['fortress']},
           {'key':'gallery','op':'box','parents':['root'],'center':[1.9,0,1],
            'size':[2,1,1],'anonymous':True,'has':['bridge'],
            'when':{'param':'branch','min':.5}}]
    return grow_program(steps,genome)


def run_example(tmp_path, max_exact=4, max_detail=3):
    return WideEpoch(location='known-test',source_digests={},construction_digest='a'*64,
                     objectives=('shape',),score_state='synthetic',
                     checkpoint=tmp_path/'epoch.json',max_exact=max_exact,max_detail=max_detail)


def test_epoch_runs_method_mix_with_full_cad_gates(tmp_path):
    proposals=propose_methods({'branch':(0.,1.),'height':(2.,4.)},
                              {'branch':.2,'height':3.},seed=4,count=7,
                              topology_loci=('branch',))
    assert {p.emitter for p in proposals}=={'local','sobol','topology'}
    runner=run_example(tmp_path)
    result=runner.run(proposals,grow=project,
                      score=lambda g,a:{'shape':abs(g['height']-3.)})
    assert len(result['results'])==7
    assert sum(r['state']=='scored' for r in result['results'].values())==3
    assert sum(r['state']=='audited' for r in result['results'].values())==1
    assert sum(r['state']=='deferred' for r in result['results'].values())==3
    assert len(result['archive'])>=1
    assert all(r['audit']['valid'] for r in result['results'].values() if r['state']=='scored')
    assert result==run_example(tmp_path).run(proposals,grow=project,score=lambda g,a: {'shape':.4})


def test_checkpoint_rejects_tampered_history_and_mismatched_identity(tmp_path):
    runner=run_example(tmp_path)
    runner.run([Proposal('p1','synthetic',{'branch':0})],grow=project,
               score=lambda g,a:{'shape':.2})
    with pytest.raises(ValueError,match='Incompatible'):
        run_example(tmp_path,max_exact=5)
    p=tmp_path/'epoch.json'
    raw=json.loads(p.read_text());raw['results']['p1']['losses']['shape']=9
    p.write_text(json.dumps(raw))
    with pytest.raises(ValueError,match='digest mismatch'):
        run_example(tmp_path)


def test_invalid_cad_never_enter_archive(tmp_path):
    def broken(g):
        a=SolidAssembly().add('foundation',box((0,0,0),(2,2,2)),role='foundation')
        a.add('floating',box((15,0,0),(1,1,1)),parents=['foundation'])
        return a
    r=run_example(tmp_path)
    data=r.run([Proposal('p1','test',{'branch':1})],grow=broken,
               score=lambda g,a:{'shape':0})
    assert data['results']['p1']['state']=='rejected' and not data['archive']


def test_unavailable_metric_rejected_not_treated_as_zero(tmp_path):
    r=run_example(tmp_path)
    data=r.run([Proposal('p1','test',{'branch':1})],grow=project,
               score=lambda g,a:{})
    assert data['results']['p1']['state']=='error'
    assert not data['archive']


def test_score_certification_is_explicit(tmp_path):
    r=WideEpoch(location='mystery',source_digests={'photo':'f'*64},construction_digest='a'*64,
               objectives=('shape',),score_state='provisional',checkpoint=tmp_path/'epoch.json',
               max_exact=1,max_detail=1)
    d=r.run([Proposal('p1','test',{'branch':1})],grow=project,
            score=lambda g,a:{'shape':.22})
    assert next(iter(d['archive'].values()))['evidence_state']=='provisional'


def test_false_verified_score_refused(tmp_path):
    with pytest.raises(ValueError,match='verified control'):
        WideEpoch(location='test',source_digests={},construction_digest='a'*64,
                  objectives=('shape',),score_state='verified',
                  checkpoint=tmp_path/'run.json',max_exact=1,max_detail=1)


def test_multi_epoch_project_reentry(tmp_path):
    from pathlib import Path
    from projection_loom.pipeline import Project
    from projection_loom.epochs import run_project_epochs
    f=Path(__file__).resolve().parents[1]/'examples'/'observatory.json'
    project=Project.load(f)
    args=dict(passes=2,candidates=3,exact_budget=2,detail_budget=1,seed=7)
    summary=run_project_epochs(project,tmp_path/'wide',**args)
    assert len(summary['passes'])==2 and summary['passes'][1]['scored']==1
    second=run_project_epochs(project,tmp_path/'wide',**args)
    assert summary==second
    with pytest.raises(ValueError,match='checkpoint|Proposal set changed'):
        run_project_epochs(project,tmp_path/'wide',**dict(args,seed=9))


def test_emitter_slack_reserves_structurally_valid_modes(tmp_path):
    proposals=[Proposal('s','sobol',{'branch':1}),
               Proposal('l','local',{'branch':0}),
               Proposal('t','topology',{'branch':1}),
               Proposal('l2','local',{'branch':1})]
    r=WideEpoch(location='test',source_digests={},construction_digest='a'*64,
               objectives=('shape',),score_state='synthetic',
               checkpoint=tmp_path/'many.json',max_exact=3,max_detail=3)
    scores={'s':4,'l':1,'t':5,'l2':.1}
    data=r.run(proposals,grow=project,score=lambda g,a:{'shape':.2},
               preview=lambda g:0.0)
    chosen={data['results'][x]['emitter'] for x in scores if data['results'][x]['state']=='scored'}
    assert chosen=={'local','sobol','topology'}


def test_location_input_hash_revalidated_across_runs(tmp_path):
    from projection_loom.location_stack import LocationStack,Frame,Source
    from pathlib import Path
    from projection_loom.pipeline import Project
    from projection_loom.epochs import run_project_epochs
    project=Project.load(Path(__file__).resolve().parents[1]/'examples'/'grammar'/'project.json')
    asset=tmp_path/'image.png';asset.write_bytes(b'original')
    stack=LocationStack(project.location).add_frame(Frame('px','pixel','px'))
    stack.add_source(Source.from_file('drawing','single_image',asset,'px'))
    assert stack.verify_source_bytes()=={'drawing':'matched'}
    result=run_project_epochs(project,tmp_path/'run',passes=1,candidates=3,
                              exact_budget=2,detail_budget=1,location_stack=stack)
    assert result['passes'][0]['scored']==1
    asset.write_bytes(b'changed')
    with pytest.raises(ValueError,match='Source bytes disagree'):
        run_project_epochs(project,tmp_path/'run',passes=1,candidates=3,
                           exact_budget=2,detail_budget=1,location_stack=stack)
