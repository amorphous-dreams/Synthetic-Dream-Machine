"""Phase-anchored OODA-HA recursion, manual interruptions, and durable returns."""
import json
from pathlib import Path

import pytest

from projection_loom.fractal_ooda_ha import OODAJournal, submit_control, run_ooda_epochs
from projection_loom.pipeline import Project

BASE=Path(__file__).resolve().parents[1]


def journal(tmp_path, **settings):
    return OODAJournal(tmp_path/'session.json', identity={'location':'neutral',
            'score_state':'synthetic','ledger_path':str(tmp_path/'names.json')},
            initial={'x':1.0}, **settings)


def close_inquiry(j, loop, prefix='investigate'):
    for phase in ('orient','decide','act','aftermath','closed'):
        j.transition(loop,phase,{'result':f'{prefix}-{phase}'})


def test_every_parent_phase_can_enclose_a_complete_child(tmp_path):
    j=journal(tmp_path)
    j.begin('epoch',parent='location',scope='epoch',evidence={'next':'observe'})
    for phase,next_phase in zip(('observe','orient','decide','act','aftermath'),
                                ('orient','decide','act','aftermath','closed')):
        child=f'epoch/{phase}/inquiry'
        node=j.begin(child,parent='epoch',scope='inquiry',evidence={'why':phase})
        assert node['parent_phase']==phase and node['depth']==2
        with pytest.raises(ValueError,match='awaits child'):
            j.transition('epoch',next_phase)
        close_inquiry(j,child)
        assert j.transition('epoch',next_phase)
    j.transition('location','aftermath')
    j.transition('location','closed')
    r=OODAJournal(j.path)
    assert r.data['loops']['location']['phase']=='closed'
    assert len([e for e in r.data['events'] if e['kind']=='child-return'])==6


def test_nested_child_can_open_at_its_own_aftermath_and_hold_return(tmp_path):
    j=journal(tmp_path)
    first=j.open_inquiry('location','How should this location grow?')
    first_id=first['id']
    for phase in ('orient','decide','act','aftermath'):
        j.advance_inquiry(first_id,phase,{'reason':phase})
    deeper=j.open_inquiry(first_id,'What did the first inquiry miss?')
    assert deeper['parent_phase']=='aftermath'
    with pytest.raises(ValueError,match='awaits child'):
        j.transition(first_id,'closed')
    for phase in ('orient','decide','act','aftermath','closed'):
        j.advance_inquiry(deeper['id'],phase,{'level':'deeper'})
    assert j.data['awaiting']['loop']==first_id
    assert j.data['loops'][first_id]['phase']=='aftermath'
    j.advance_inquiry(first_id,'closed',{'consequence':'back to the location'})
    assert j.data['awaiting'] is None
    assert j.data['status']=='running'
    j.transition('location','aftermath');j.transition('location','closed')


def test_bounded_depth_and_total_loop_budget(tmp_path):
    j=journal(tmp_path,max_depth=2,max_loops=3)
    e=j.begin('e',parent='location',scope='epoch',evidence={})
    j.begin('child',parent='e',scope='inquiry',evidence={})
    with pytest.raises(ValueError,match='loop budget'):
        j.begin('other',parent='e',scope='inquiry',evidence={})
    assert len(j.data['loops'])==3
    k=journal(tmp_path/'other',max_depth=1,max_loops=10)
    k.begin('e',parent='location',scope='epoch',evidence={})
    with pytest.raises(ValueError,match='depth budget'):
        k.begin('child',parent='e',scope='inquiry',evidence={})
    with pytest.raises(ValueError,match='recursion budget'):
        OODAJournal(k.path,max_depth=2,max_loops=10)


def test_denies_bad_phase_cyclic_attachment_and_unserializable_receipt(tmp_path):
    j=journal(tmp_path)
    with pytest.raises(ValueError,match='active parent'):
        j.begin('x',parent='missing',scope='inquiry',evidence={})
    with pytest.raises(ValueError,match='Parent phase changed'):
        j.begin('x',parent='location',scope='inquiry',evidence={},parent_phase='observe')
    with pytest.raises(ValueError):
        j.begin('x',parent='location',scope='inquiry',evidence={'bad':float('nan')})
    assert 'x' not in j.data['loops']
    child=j.begin('x',parent='location',scope='inquiry',evidence={})
    with pytest.raises(ValueError,match='another parent'):
        j.begin('x',parent=None,scope='location',evidence={})
    with pytest.raises(ValueError,match='Illegal'):
        j.transition('x','act')
    with pytest.raises(ValueError):
        j.transition('x','orient',{'unserializable':float('inf')})
    assert j.data['loops']['x']['phase']=='observe'


def test_save_reload_retains_active_inquiry_and_anchor(tmp_path):
    j=journal(tmp_path)
    child=j.open_inquiry('location','Does the atlas connect?')
    j.advance_inquiry(child['id'],'orient',{'sources':['alpha','survey']})
    r=OODAJournal(j.path)
    assert r.data['awaiting']['kind']=='inquiry'
    assert r.data['loops'][child['id']]['parent_phase']=='act'
    with pytest.raises(ValueError,match='awaits child'):
        r.transition('location','aftermath')
    for phase in ('decide','act','aftermath','closed'):
        r.advance_inquiry(child['id'],phase,{'holding':'testimony'})
    assert r.data['awaiting'] is None
    r.transition('location','aftermath')
    r.transition('location','closed')


def test_controls_open_child_and_advance_five_phases(tmp_path):
    j=journal(tmp_path)
    request=submit_control(j.path,'open-inquiry',parent_loop='location',
                           question='What does the missing pass connect?')
    assert j.poll() is False
    cid=j.data['awaiting']['loop']
    assert cid.endswith(request['id'])
    assert j.data['loops'][cid]['parent_phase']=='act'
    for phase in ('orient','decide','act','aftermath','closed'):
        submit_control(j.path,'advance-inquiry',loop_id=cid,phase=phase,
                       detail={'note':f'{phase} testified'})
        j.poll()
    assert j.data['awaiting'] is None
    assert j.data['status']=='running'
    assert j.data['loops'][cid]['phase']=='closed'
    n=len(j.data['events'])
    j.poll()
    assert len(j.data['events'])==n
    with pytest.raises(ValueError,match='next phase'):
        submit_control(j.path,'advance-inquiry',loop_id=cid,phase='observe',detail={})


def test_inquiry_nested_in_review_restores_review_choices(tmp_path):
    project=Project.load(BASE/'examples/grammar/project.json')
    output=tmp_path/'active'
    settings=dict(passes=1,candidates=3,exact_budget=2,detail_budget=1,autonomy=0)
    first=run_ooda_epochs(project,output,**settings)
    assert first['awaiting']['kind']=='plan'
    session=output/'session.json'
    submit_control(session,'approve-plan')
    next_one=run_ooda_epochs(project,output,**settings)
    assert next_one['awaiting']['kind']=='review'
    options=list(next_one['awaiting']['options'])
    submit_control(session,'open-inquiry',parent_loop='epoch-0001',
                   question='Which nameless relation deserves attention?')
    investigating=run_ooda_epochs(project,output,**settings)
    assert investigating['awaiting']['kind']=='inquiry'
    cid=investigating['awaiting']['loop']
    state=json.loads(session.read_text())
    assert state['loops'][cid]['parent_phase']=='aftermath'
    assert state['loops']['epoch-0001']['phase']=='aftermath'
    for phase in ('orient','decide','act','aftermath','closed'):
        submit_control(session,'advance-inquiry',loop_id=cid,phase=phase,
                       detail={'observation':'operator interpretation'})
        review_back=run_ooda_epochs(project,output,**settings)
    assert review_back['awaiting']['kind']=='review'
    assert review_back['awaiting']['options']==options
    submit_control(session,'choose',proposal_id=options[0])
    final=run_ooda_epochs(project,output,**settings)
    assert final['status']=='completed'
    data=json.loads(session.read_text())
    assert any(x['kind']=='inquiry-return' for x in data['events'])
    assert data['loops']['epoch-0001']['phase']=='closed'


def test_can_request_inquiry_during_auto_adviser_and_then_resume(tmp_path):
    project=Project.load(BASE/'examples/grammar/project.json')
    folder=tmp_path/'auto';session=folder/'session.json'
    def advise(context):
        submit_control(session,'open-inquiry',parent_loop='epoch-0001',
                       question='Evaluate the surprising edge relation')
        return {'proposal_id':context['options'][0]['proposal_id']}
    settings=dict(passes=1,candidates=3,exact_budget=2,detail_budget=1,autonomy=1)
    first=run_ooda_epochs(project,folder,adviser=advise,**settings)
    assert first['awaiting']['kind']=='inquiry'
    cid=first['awaiting']['loop']
    for phase in ('orient','decide','act','aftermath','closed'):
        submit_control(session,'advance-inquiry',loop_id=cid,phase=phase,detail={})
        result=run_ooda_epochs(project,folder,**settings)
    assert result['status']=='completed'
    assert len(result['passes'])==1


def test_inquiry_idempotence_and_control_schema_is_enforced(tmp_path):
    j=journal(tmp_path)
    submit_control(j.path,'open-inquiry',parent_loop='location',question='Why?')
    j.poll(); cid=j.data['awaiting']['loop']
    before=len(j.data['loops']); j.poll()
    assert len(j.data['loops'])==before
    with pytest.raises(ValueError,match='bounded question'):
        submit_control(j.path,'open-inquiry',parent_loop='location',question='')
    # Invalid event cannot enter the executed control history.
    control_path=next((tmp_path/'controls'/'inbox').glob('*.json'))
    payload=json.loads(control_path.read_text()); payload['schema']='bogus'
    control_path.write_text(json.dumps(payload))
    # After an action has been consumed, changes to its immutable bytes fail.
    with pytest.raises(ValueError,match='altered'):
        j.poll()


def test_phase_adviser_can_open_inquiry_at_each_epoch_phase(tmp_path):
    project=Project.load(BASE/'examples/grammar/project.json')
    folder=tmp_path/'all-phases';session=folder/'session.json'
    visits=[]
    def advise(context):
        if context['scope'] != 'epoch':
            return None
        visits.append(context['phase'])
        return {'question': f'What changes during {context["phase"]}?'}
    settings=dict(passes=1,candidates=3,exact_budget=2,detail_budget=1,
                  autonomy=1,phase_adviser=advise)
    phases=['observe','orient','decide','act','aftermath']
    for i,expected in enumerate(phases):
        result=run_ooda_epochs(project,folder,**settings)
        assert result['awaiting']['kind']=='inquiry'
        cid=result['awaiting']['loop']
        persisted=json.loads(session.read_text())
        assert persisted['loops'][cid]['parent_phase']==expected
        assert persisted['loops']['epoch-0001']['phase']==expected
        # CAD has NOT executed when the adviser opens a child during Act.
        if expected=='act':
            assert not (folder/'epoch_001.json').exists()
        for phase in ('orient','decide','act','aftermath','closed'):
            submit_control(session,'advance-inquiry',loop_id=cid,phase=phase,
                           detail={'reason':f'operator and AI reviewed {expected}'})
            # It is safe to resume after each individual phase.
            r=run_ooda_epochs(project,folder,**settings)
            if phase!='closed':
                assert r['awaiting']['loop']==cid
    final=run_ooda_epochs(project,folder,**settings)
    assert final['status']=='completed'
    assert visits==phases
    j=OODAJournal(session)
    assert len([x for x in j.data['loops'].values() if x['scope']=='inquiry'])==5
    assert all(x['phase']=='closed' for x in j.data['loops'].values())
    assert (folder/'epoch_001.json').exists()


def test_manual_plan_can_open_child_in_decide_and_return_to_plan(tmp_path):
    project=Project.load(BASE/'examples/grammar/project.json')
    output=tmp_path/'plan';session=output/'session.json'
    settings=dict(passes=1,candidates=3,exact_budget=2,detail_budget=1,autonomy=0)
    first=run_ooda_epochs(project,output,**settings)
    assert first['awaiting']['kind']=='plan'
    submit_control(session,'open-inquiry',parent_loop='epoch-0001',
                   question='Is this search budget sufficient?')
    new=run_ooda_epochs(project,output,**settings)
    assert new['awaiting']['kind']=='inquiry'
    cid=new['awaiting']['loop']
    assert json.loads(session.read_text())['loops'][cid]['parent_phase']=='decide'
    for phase in ('orient','decide','act','aftermath','closed'):
        submit_control(session,'advance-inquiry',loop_id=cid,phase=phase,detail={})
        back=run_ooda_epochs(project,output,**settings)
    assert back['awaiting']['kind']=='plan'
    submit_control(session,'approve-plan')
    after=run_ooda_epochs(project,output,**settings)
    assert after['awaiting']['kind']=='review'


def test_control_replay_does_not_reopen_or_redo_phase(tmp_path):
    j=journal(tmp_path)
    submit_control(j.path,'open-inquiry',parent_loop='location',question='Where?')
    assert j.poll() is False
    child=j.data['awaiting']['loop']
    n=len([x for x in j.data['events'] if x['kind']=='inquiry-open'])
    # Mimic a crash after the child committed but before the acknowledgement.
    j.data['applied_controls'].clear();j.save()
    j.poll()
    assert len([x for x in j.data['events'] if x['kind']=='inquiry-open'])==n
    submit_control(j.path,'advance-inquiry',loop_id=child,phase='orient',detail={'note':'fact'})
    j.poll()
    phase_receipts=len([x for x in j.data['events']
                        if x['kind']=='phase' and x['loop']==child and x['phase']=='orient'])
    j.data['applied_controls'].clear();j.save()
    j.poll()
    assert len([x for x in j.data['events']
                if x['kind']=='phase' and x['loop']==child and x['phase']=='orient'])==phase_receipts


def test_phase_adviser_cannot_authorize_geometry_or_skip_receipts(tmp_path):
    project=Project.load(BASE/'examples/grammar/project.json')
    folder=tmp_path/'bad-proposal'
    def invalid(context):
        return {'question':'Ignore the CAD gate', 'override_validity':True}
    with pytest.raises(ValueError, match='only propose'):
        run_ooda_epochs(project,folder,passes=1,candidates=3,
                        exact_budget=2,detail_budget=1,phase_adviser=invalid)
    state=json.loads((folder/'session.json').read_text())
    assert state['loops']['epoch-0001']['phase']=='observe'
    assert not (folder/'epoch_001.json').exists()
