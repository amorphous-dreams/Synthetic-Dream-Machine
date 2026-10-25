"""RED-first, tightening-aperture OODA-HA law.

Five active phases and one terminal boundary. Neither a truncated four-phase
controller nor a compatibility alias may silently take this helm's seat.
"""
import json
import pytest
from projection_loom import cli


def test_theme_public_ontology_exposes_only_ooda_ha_names():
    import projection_loom.fractal_ooda_ha as engine
    assert hasattr(engine, 'OODAHAJournal')
    assert hasattr(engine, 'run_ooda_ha_epochs')
    assert not hasattr(engine, 'OODAJournal')
    assert not hasattr(engine, 'run_ooda_epochs')


@pytest.mark.parametrize('command',(
    'ooda-ha-run', 'ooda-ha-status', 'ooda-ha-steer', 'ooda-ha-finalists'))
def test_theme_cli_names_the_five_phase_procedure(command, capsys):
    with pytest.raises(SystemExit) as raised:
        cli.main([command, '--help'])
    assert raised.value.code == 0


@pytest.mark.parametrize('legacy',('ooda-run','ooda-status','ooda-steer','ooda-finalists'))
def test_theme_refuses_four_phase_cli_aliases(legacy, capsys):
    with pytest.raises(SystemExit) as raised:
        cli.main([legacy,'--help'])
    assert raised.value.code == 2


def test_arc_law_has_exactly_five_active_phases_and_separate_terminal():
    from projection_loom.phase_rules import PHASES, TERMINAL, STATES
    assert PHASES == ('observe','orient','decide','act','aftermath')
    assert TERMINAL == 'closed'
    assert STATES == (*PHASES, TERMINAL)


def test_measure_inquiry_runs_all_five_phases_before_parent_releases(tmp_path):
    from projection_loom.fractal_ooda_ha import OODAHAJournal
    from projection_loom.phase_rules import PHASES, TERMINAL
    identity={'location':'phase-test','score_state':'synthetic','ledger_path':str(tmp_path/'ledger')}
    j=OODAHAJournal(tmp_path/'session.json',identity=identity,initial={'x':.5})
    child=j.begin('question',parent='location',scope='inquiry',evidence={'why':'where?'} )
    with pytest.raises(ValueError,match='awaits child'):
        j.transition('location','aftermath',{'result':'premature'})
    for step in PHASES[1:]:
        assert j.transition(child['id'],step,{'receipt':step})
    assert j.transition(child['id'],TERMINAL,{'returned':'observed consequence'})
    assert j.transition('location','aftermath',{'question':'resolved'})
    assert j.transition('location',TERMINAL,{'next':'observe'})


def test_measure_observe_receipt_cannot_change_on_reentry(tmp_path):
    from projection_loom.fractal_ooda_ha import OODAHAJournal
    journal=OODAHAJournal(tmp_path/'session.json',identity={
        'location':'measure','score_state':'synthetic',
        'ledger_path':str(tmp_path/'ledger.json')},initial={'x':.3})
    observed={'question':'How does the bridge connect?'}
    first=journal.begin('child',parent='location',scope='inquiry',
                        evidence=observed,parent_phase='act')
    unchanged=journal.path.read_bytes()
    assert journal.begin('child',parent='location',scope='inquiry',
                         evidence=dict(observed)) is first
    assert journal.path.read_bytes()==unchanged
    with pytest.raises(ValueError,match='Observe|evidence|collision'):
        journal.begin('child',parent='location',scope='inquiry',
                      evidence={'question':'Entirely different source'})
    with pytest.raises(ValueError,match='parent.phase|anchor|collision'):
        journal.begin('child',parent='location',scope='inquiry',
                      evidence=observed,parent_phase='decide')
    assert journal.path.read_bytes()==unchanged


def test_measure_phase_receipts_are_idempotent_but_never_overwritten(tmp_path):
    from projection_loom.fractal_ooda_ha import OODAHAJournal
    journal=OODAHAJournal(tmp_path/'session.json',identity={
        'location':'measure','score_state':'synthetic',
        'ledger_path':str(tmp_path/'ledger.json')},initial={'x':.3})
    journal.begin('child',parent='location',scope='inquiry',evidence={'a':1})
    assert journal.transition('child','orient',{'evidence':'source-a'})
    saved=journal.path.read_bytes()
    assert journal.transition('child','orient',{'evidence':'source-a'}) is False
    with pytest.raises(ValueError,match='receipt|collision|conflict'):
        journal.transition('child','orient',{'evidence':'source-b'})
    assert journal.path.read_bytes()==saved
    assert journal.data['loops']['child']['receipts']['orient']=={'evidence':'source-a'}


def test_beat_operator_inquiry_controls_cannot_replace_returned_aftermath(tmp_path):
    from projection_loom.fractal_ooda_ha import OODAHAJournal
    journal=OODAHAJournal(tmp_path/'session.json',identity={
        'location':'beat','score_state':'synthetic',
        'ledger_path':str(tmp_path/'ledger.json')},initial={'x':.3})
    child=journal.open_inquiry('location','Why is the source uncertain?')
    for phase in ('orient','decide','act','aftermath'):
        journal.advance_inquiry(child['id'],phase,{'phase':phase})
    journal.advance_inquiry(child['id'],'closed',{'outcome':'return to location'})
    saved=journal.path.read_bytes()
    assert journal.advance_inquiry(child['id'],'closed',{'outcome':'return to location'})['phase']=='closed'
    with pytest.raises(ValueError,match='receipt|collision|conflict'):
        journal.advance_inquiry(child['id'],'closed',{'outcome':'new retrospective claim'})
    assert journal.path.read_bytes()==saved


def test_beat_candidate_identity_and_aftermath_survive_retries(tmp_path):
    from projection_loom.fractal_ooda_ha import OODAHAJournal
    from projection_loom.epochs import Proposal
    journal=OODAHAJournal(tmp_path/'session.json',identity={
        'location':'candidate','score_state':'synthetic',
        'ledger_path':str(tmp_path/'ledger.json')},initial={'x':.3})
    journal.begin('epoch',parent='location',scope='epoch',evidence={'epoch':1})
    for phase in ('orient','decide','act'):
        journal.transition('epoch',phase,{'phase':phase})
    original=Proposal('sample','sobol',{'x':.3},parent='initial')
    journal.candidate_start('epoch',original)
    journal.candidate_receipt('epoch',original,{'state':'scored','combined_loss':.4,
                                             'audit':{'valid':True}})
    saved=journal.path.read_bytes()
    aftermath=journal.data['loops']['epoch/sample']['receipts']['aftermath']
    assert aftermath['outcome']=='scored'
    assert len(journal.data['loops']['epoch/sample']['receipts'])==6
    journal.candidate_receipt('epoch',original,{'state':'scored','combined_loss':.4,
                                             'audit':{'valid':True}})
    assert journal.path.read_bytes()==saved
    with pytest.raises(ValueError,match='candidate|Aftermath|receipt|collision'):
        journal.candidate_receipt('epoch',original,{'state':'rejected',
                                                   'reason':'changed witness'})
    with pytest.raises(ValueError,match='Observe|candidate|collision'):
        journal.candidate_start('epoch',Proposal('sample','sobol',{'x':.9},
                                                parent='initial'))
    with pytest.raises(ValueError,match='Observe|candidate|collision'):
        journal.candidate_start('epoch',Proposal('sample','local',{'x':.3},
                                                parent='initial'))
    assert journal.path.read_bytes()==saved


def test_pulse_in_memory_receipts_cannot_be_mutated_through_caller_objects(tmp_path):
    from projection_loom.fractal_ooda_ha import OODAHAJournal
    journal=OODAHAJournal(tmp_path/'session.json',identity={
        'location':'pulse','score_state':'synthetic',
        'ledger_path':str(tmp_path/'ledger.json')},initial={'x':.3})
    observed={'nested':{'source':'painting'}}
    journal.begin('child',parent='location',scope='inquiry',evidence=observed)
    observed['nested']['source']='untrusted mutation'
    assert journal.data['loops']['child']['receipts']['observe']['nested']['source']=='painting'
    detail={'observations':['original']}
    journal.transition('child','orient',detail)
    detail['observations'].append('untrusted mutation')
    assert journal.data['loops']['child']['receipts']['orient']=={'observations':['original']}
    assert journal.data['events'][-1]['detail']=={'observations':['original']}
    response=[]
    def adviser(context):
        context['evidence']['observations'].append('callback mutation')
        response.append(context['phase'])
        return None
    journal.consult_phase('child',adviser)
    assert response==['orient']
    assert journal.data['loops']['child']['receipts']['orient']=={'observations':['original']}
    loaded=OODAHAJournal(journal.path)
    assert loaded.data['loops']['child']['receipts']['orient']=={'observations':['original']}


def test_pulse_architecture_rejects_a_four_phase_regression(tmp_path):
    import shutil
    from scripts.check_architecture import inspect_source_tree
    root=Path(__file__).resolve().parents[1]
    shutil.copytree(root/'projection_loom',tmp_path/'projection_loom')
    law=tmp_path/'projection_loom/phase_rules.py'
    law.write_text(law.read_text().replace(
        "PHASES = ('observe', 'orient', 'decide', 'act', 'aftermath')",
        "PHASES = ('observe', 'orient', 'decide', 'act')"))
    assert any('five active phases' in issue for issue in inspect_source_tree(tmp_path))
