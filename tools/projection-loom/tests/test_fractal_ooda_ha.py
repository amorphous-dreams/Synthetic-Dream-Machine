"""RED-first five-phase procedural law, physical module, and legacy API."""
from importlib import import_module
from pathlib import Path

import pytest

from projection_loom.ooda import OODAJournal, run_ooda_epochs, submit_control


def test_fractal_ooda_ha_owns_the_real_five_phase_engine():
    engine = import_module('projection_loom.fractal-ooda-ha')
    assert Path(engine.__file__).name == 'fractal-ooda-ha.py'
    assert engine.OODAJournal is OODAJournal
    assert engine.run_ooda_epochs is run_ooda_epochs
    assert engine.submit_control is submit_control
    assert engine.PHASES == (
        'observe', 'orient', 'decide', 'act', 'aftermath', 'closed')


def test_aftermath_inquiry_blocks_return_and_carries_own_aftermath(tmp_path):
    journal = OODAJournal(
        tmp_path / 'session.json',
        identity={'location': 'synthetic', 'score_state': 'synthetic',
                  'ledger_path': str(tmp_path / 'names.json')},
        initial={'x': .5}, autonomy=.75)
    journal.begin('epoch', parent='location', scope='epoch',
                  evidence={'source':'original'})
    for phase in ('orient','decide','act','aftermath'):
        journal.transition('epoch', phase, {'observed':phase})
    inquiry = journal.open_inquiry('epoch', 'What did this act reveal?')
    assert inquiry['parent_phase'] == 'aftermath'
    with pytest.raises(ValueError, match='awaits child'):
        journal.transition('epoch', 'closed')
    for phase in ('orient','decide','act','aftermath','closed'):
        journal.advance_inquiry(inquiry['id'], phase, {'receipted':phase})
    assert journal.data['loops']['epoch']['phase'] == 'aftermath'
    journal.transition('epoch', 'closed')
    journal.transition('location', 'aftermath', {'carried':'epoch consequence'})
    journal.transition('location', 'closed', {'next':'observe a new loop'})
    events = [e for e in journal.data['events']
              if e['loop']==inquiry['id'] and e['kind']=='phase']
    assert [e['phase'] for e in events] == list(
        ('observe','orient','decide','act','aftermath','closed'))
    assert any(e['kind']=='child-return' and e['anchor']=='aftermath'
               for e in journal.data['events'])
