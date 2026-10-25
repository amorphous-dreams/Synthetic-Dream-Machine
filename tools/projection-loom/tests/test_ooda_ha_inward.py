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
    assert not hasattr(engine, 'OODAHAJournal')
    assert not hasattr(engine, 'run_ooda_ha_epochs')


@pytest.mark.parametrize('command',(
    'ooda-ha-run', 'ooda-ha-status', 'ooda-ha-steer', 'ooda-ha-finalists'))
def test_theme_cli_names_the_five_phase_procedure(command, capsys):
    with pytest.raises(SystemExit) as raised:
        cli.main([command, '--help'])
    assert raised.value.code == 0


@pytest.mark.parametrize('legacy',('ooda-ha-run','ooda-ha-status','ooda-ha-steer','ooda-ha-finalists'))
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
