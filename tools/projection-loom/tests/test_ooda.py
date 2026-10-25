"""Executable, fractal OODA-HA: phase gates, real CAD action and operator turns."""
from pathlib import Path
import json

import pytest
from PIL import Image

from projection_loom.fractal_ooda_ha import (OODAJournal, run_ooda_epochs, submit_control,
                                  control_mode, single_runner)
from projection_loom.pipeline import Project
from projection_loom.relations import PetNameLedger, RelationWitness
from projection_loom.epochs import Proposal, WideEpoch
from projection_loom.grammar import grow_program

PROJECT = Path(__file__).resolve().parents[1]/'examples'/'grammar'/'project.json'


def current():
    return Project.load(PROJECT)


def options():
    return dict(passes=2, candidates=4, exact_budget=3, detail_budget=2,
                seed=9, topology_loci=('branch',))


def test_policy_gradient_and_finite_boundaries():
    assert [control_mode(x) for x in (0, .4, .75, 1)] == [
        'manual', 'co-pilot', 'auto-nav', 'full-speed']
    for x in (-.01, 1.01, float('nan'),float('inf')):
        with pytest.raises(ValueError, match='Autonomy'):
            control_mode(x)


def test_strict_phase_graph_requires_real_parent_act(tmp_path):
    identity={'location':'lab','score_state':'synthetic','ledger_path':str(tmp_path/'names.json')}
    j=OODAJournal(tmp_path/'session.json',identity=identity,initial={'x':1},autonomy=.75)
    assert j.data['loops']['location']['phase']=='act'
    j.begin('epoch-1',parent='location',scope='epoch',evidence={'source':'neutral'})
    with pytest.raises(ValueError,match='Illegal'):
        j.transition('epoch-1','act')
    with pytest.raises(ValueError,match='Illegal'):
        j.transition('location','closed')
    for phase in ('orient','decide','act'):
        j.transition('epoch-1',phase)
    j.begin('candidate-1',parent='epoch-1',scope='candidate',evidence={})
    for phase in ('orient','decide','act','aftermath','closed'):
        j.transition('candidate-1',phase)
    for phase in ('aftermath','closed'):
        j.transition('epoch-1',phase)
    for phase in ('aftermath','closed'):
        j.transition('location',phase)
    assert OODAJournal(tmp_path/'session.json').data['loops']['candidate-1']['phase']=='closed'


def test_auto_nav_runs_real_nested_loops_and_reenters_without_replay(tmp_path):
    result=run_ooda_epochs(current(),tmp_path/'out',**options(),autonomy=.75)
    assert result['status']=='completed' and result['completed_epochs']==2
    state=json.loads((tmp_path/'out'/'session.json').read_text())
    assert state['loops']['location']['phase']=='closed'
    for epoch in ('epoch-0001','epoch-0002'):
        node=state['loops'][epoch]
        assert node['phase']=='closed' and node['children']
        assert all(state['loops'][x]['phase']=='closed' for x in node['children'])
        assert all(state['loops'][x]['scope']=='candidate' for x in node['children'])
        for child in node['children']:
            states=[event['phase'] for event in state['events']
                    if event['loop']==child and event['kind']=='phase']
            assert states==['observe','orient','decide','act','aftermath','closed']
    preview=tmp_path/'out'/'previews'/'epoch_001'/'review.json'
    cards=json.loads(preview.read_text())['options']
    assert cards
    for card in cards:
        assert Image.open(card['preview']).getbbox() is not None
        assert RelationWitness.load(card['witness']).nodes
        assert card['evidence_state']=='synthetic'
    before=len(state['events'])
    second=run_ooda_epochs(current(),tmp_path/'out',**options(),autonomy=0)
    assert second['status']=='completed' and second['events']==before


def test_manual_operator_plan_review_pet_name_and_o_takiage(tmp_path):
    folder=tmp_path/'manual';project=current()
    x=run_ooda_epochs(project,folder,**options(),autonomy=0)
    assert x['status']=='awaiting_operator' and x['awaiting']['kind']=='plan'
    session=folder/'session.json'
    submit_control(session,'approve-plan')
    x=run_ooda_epochs(project,folder,**options(),autonomy=0)
    assert x['awaiting']['kind']=='review' and x['completed_epochs']==0
    first=json.loads((folder/'previews'/'epoch_001'/'review.json').read_text())['options']
    assert first
    selected=next((c for c in first if '~p-0003' in RelationWitness.load(c['witness']).nodes),None)
    assert selected is not None
    submit_control(session,'pet-name',proposal_id=selected['proposal_id'],
                   name='Unexpected Gallery',target='~p-0003',mode='entity')
    submit_control(session,'choose',proposal_id=selected['proposal_id'])
    x=run_ooda_epochs(project,folder,**options(),autonomy=0)
    assert x['completed_epochs']==1 and x['awaiting']['kind']=='plan'
    ledger=PetNameLedger.load(folder/'identity-ledger.json')
    assert ledger.claims[0]['name']=='Unexpected Gallery' and ledger.claims[0]['active']
    submit_control(session,'approve-plan')
    x=run_ooda_epochs(project,folder,**options(),autonomy=0)
    assert x['awaiting']['kind']=='review'
    next_options=json.loads((folder/'previews'/'epoch_002'/'review.json').read_text())['options']
    submit_control(session,'o-takiage',name='Unexpected Gallery',branch=None,proposal_id=None)
    submit_control(session,'choose',proposal_id=next_options[0]['proposal_id'])
    x=run_ooda_epochs(project,folder,**options(),autonomy=0)
    assert x['status']=='completed' and x['completed_epochs']==2
    ledger=PetNameLedger.load(folder/'identity-ledger.json')
    assert not ledger.claims[0]['active']
    data=json.loads(session.read_text())
    assert any(e['kind']=='lineage-intervention' and e['action']=='o-takiage' for e in data['events'])
    assert any(e['kind']=='lineage-intervention' and e['action']=='pet-name' for e in data['events'])


def test_operator_can_change_manual_into_auto_nav_then_complete(tmp_path):
    folder=tmp_path/'shift';proj=current()
    result=run_ooda_epochs(proj,folder,passes=1,candidates=3,
        exact_budget=2,detail_budget=1,autonomy=0)
    assert result['awaiting']['kind']=='plan'
    submit_control(folder/'session.json','set-autonomy',autonomy=.8)
    result=run_ooda_epochs(proj,folder,passes=1,candidates=3,
        exact_budget=2,detail_budget=1,autonomy=0)
    assert result['status']=='completed' and result['mode']=='auto-nav'


def test_review_can_be_requested_even_during_auto_nav(tmp_path):
    folder=tmp_path/'review';proj=current()
    result=run_ooda_epochs(proj,folder,passes=1,candidates=3,
        exact_budget=2,detail_budget=1,autonomy=0)
    assert result['awaiting']['kind']=='plan'
    submit_control(folder/'session.json','set-autonomy',autonomy=.75)
    submit_control(folder/'session.json','review')
    result=run_ooda_epochs(proj,folder,passes=1,candidates=3,
        exact_budget=2,detail_budget=1,autonomy=0)
    assert result['awaiting']['kind']=='review'
    submit_control(folder/'session.json','choose',proposal_id=result['awaiting']['options'][0])
    assert run_ooda_epochs(proj,folder,passes=1,candidates=3,
        exact_budget=2,detail_budget=1)['status']=='completed'


def test_request_pause_and_resume_only_at_safe_points(tmp_path):
    folder=tmp_path/'pause';proj=current()
    run_ooda_epochs(proj,folder,passes=1,candidates=3,
        exact_budget=2,detail_budget=1,autonomy=0)
    session=folder/'session.json'
    # Approve the plan and issue a pause before Act begins.
    submit_control(session,'approve-plan')
    submit_control(session,'pause')
    paused=run_ooda_epochs(proj,folder,passes=1,candidates=3,
        exact_budget=2,detail_budget=1,autonomy=0)
    assert paused['status']=='paused' and paused['completed_epochs']==0
    assert not (folder/'epoch_001.json').exists()
    submit_control(session,'resume')
    next_step=run_ooda_epochs(proj,folder,passes=1,candidates=3,
        exact_budget=2,detail_budget=1,autonomy=0)
    assert next_step['awaiting']['kind']=='review'


def test_staged_evaluator_resumes_at_next_candidate_no_duplicate(tmp_path):
    def grow(g):
        return grow_program([{'key':'root','op':'root-box','center':[0,0,0],
            'size':[2,2,2]}],g)
    proposals=[Proposal(f'p{i}','manual',{'x':float(i)}) for i in range(4)]
    r=WideEpoch(location='lab',source_digests={},construction_digest='c'*64,
        objectives=('shape',),score_state='synthetic',checkpoint=tmp_path/'epoch.json',
        max_exact=4,max_detail=4)
    evaluated=[]
    def continued():
        return len(evaluated)<1
    r.run(proposals,grow=grow,score=lambda g,a:{'shape':.1},
          after_candidate=lambda p,x:evaluated.append(p.id),
          should_continue=continued)
    assert len(evaluated)==1 and not r.completed(proposals)
    r2=WideEpoch(location='lab',source_digests={},construction_digest='c'*64,
        objectives=('shape',),score_state='synthetic',checkpoint=tmp_path/'epoch.json',
        max_exact=4,max_detail=4)
    r2.run(proposals,grow=grow,score=lambda g,a:{'shape':.1},
           after_candidate=lambda p,x:evaluated.append(p.id))
    assert len(evaluated)==4 and len(set(evaluated))==4 and r2.completed(proposals)


def test_bad_operator_choice_and_tampering_are_not_silently_admitted(tmp_path):
    folder=tmp_path/'bad';proj=current()
    run_ooda_epochs(proj,folder,passes=1,candidates=3,
        exact_budget=2,detail_budget=1,autonomy=0)
    submit_control(folder/'session.json','approve-plan')
    run_ooda_epochs(proj,folder,passes=1,candidates=3,
        exact_budget=2,detail_budget=1,autonomy=0)
    submit_control(folder/'session.json','choose',proposal_id='nonexistent')
    with pytest.raises(ValueError,match='not in the audited'):
        run_ooda_epochs(proj,folder,passes=1,candidates=3,
            exact_budget=2,detail_budget=1,autonomy=0)
    s=folder/'session.json'
    data=json.loads(s.read_text());data['current_epoch']=99
    s.write_text(json.dumps(data))
    with pytest.raises(ValueError,match='digest mismatch'):
        OODAJournal(s)


def test_validated_external_adviser_suggests_but_cannot_approve_invalid(tmp_path):
    seen=[]
    def adviser(context):
        seen.append(context)
        return {'proposal_id':context['options'][0]['proposal_id'],
                'reason':'bounded, observed candidate'}
    folder=tmp_path/'adviser'
    result=run_ooda_epochs(current(),folder,passes=1,candidates=3,
        exact_budget=2,detail_budget=1,adviser=adviser)
    assert result['status']=='completed' and len(seen)==1
    data=json.loads((folder/'session.json').read_text())
    assert any(e['kind']=='adviser-suggestion' for e in data['events'])
    folder=tmp_path/'bad-adviser'
    def invalid(context):return {'proposal_id':'invented'}
    with pytest.raises(ValueError,match='outside the validated'):
        run_ooda_epochs(current(),folder,passes=1,candidates=3,
            exact_budget=2,detail_budget=1,adviser=invalid)
    data=json.loads((folder/'session.json').read_text())
    assert data['loops']['epoch-0001']['phase']=='aftermath'


def test_lock_guards_concurrent_writers(tmp_path):
    p=tmp_path/'session.json'
    with single_runner(p):
        with pytest.raises(RuntimeError,match='already has a runner'):
            with single_runner(p):pass
    assert not p.with_suffix('.runlock').exists()


def test_code_identity_blocks_fork_mismatch(tmp_path):
    folder=tmp_path/'checkpoint';proj=current()
    run_ooda_epochs(proj,folder,passes=1,candidates=3,
        exact_budget=2,detail_budget=1)
    with pytest.raises(ValueError,match='Incompatible OODA'):
        run_ooda_epochs(proj,folder,passes=2,candidates=3,
            exact_budget=2,detail_budget=1)


def test_location_pet_name_and_whole_fork_release_through_helm(tmp_path):
    folder=tmp_path/'fork';proj=current()
    settings=dict(passes=1,candidates=4,exact_budget=3,
                  detail_budget=2,seed=9,autonomy=0)
    run_ooda_epochs(proj,folder,**settings)
    submit_control(folder/'session.json','approve-plan')
    x=run_ooda_epochs(proj,folder,**settings)
    assert x['awaiting']['kind']=='review'
    candidates=x['review_cards']
    chosen=next(o for o in candidates if '~p-0003' in RelationWitness.load(o['witness']).nodes)
    id=chosen['proposal_id']
    submit_control(folder/'session.json','pet-name',proposal_id=id,
                   target='foundation',name='The Unsettled Place',mode='location',
                   has=[],member_has=[],retain=.4)
    submit_control(folder/'session.json','pet-name',proposal_id=id,
                   target='~p-0003',name='Bridge Whose Name May Burn',mode='entity',
                   has=[],member_has=[],retain=.4)
    submit_control(folder/'session.json','o-takiage',proposal_id=id,
                   name=None,branch='~p-0003')
    submit_control(folder/'session.json','choose',proposal_id=id)
    assert run_ooda_epochs(proj,folder,**settings)['status']=='completed'
    claims=PetNameLedger.load(folder/'identity-ledger.json').claims
    location=next(c for c in claims if c['mode']=='location')
    bridge=next(c for c in claims if c['mode']=='entity')
    assert location['active'] and not bridge['active']
    assert location['released_forks']
    assert '#has/bridge' not in location['has']


def test_auto_nav_can_receive_forced_review_during_advice(tmp_path):
    folder=tmp_path/'midrun';session=folder/'session.json'
    def adviser(context):
        submit_control(session,'review')
        return {'proposal_id':context['options'][0]['proposal_id'],
                'reason':'please show the operator'}
    x=run_ooda_epochs(current(),folder,passes=1,candidates=3,
        exact_budget=2,detail_budget=1,autonomy=.75,adviser=adviser)
    assert x['status']=='awaiting_operator' and x['awaiting']['kind']=='review'
    submit_control(session,'choose',proposal_id=x['awaiting']['options'][0])
    assert run_ooda_epochs(current(),folder,passes=1,candidates=3,
        exact_budget=2,detail_budget=1,autonomy=.75)['status']=='completed'
