"""RED-first phase-law extraction: pure decisions, single persisted controller.

The noosphere boot establishes five phases; closed is a completion boundary.
These helpers MAY tell the journal if an action is legal, but never persist
events, choose geometry, approve operator controls, or run a second helm.
"""
import json

import pytest

from projection_loom.phase_rules import PHASES, next_phase_allowed, child_phase_anchor
from projection_loom.fractal_ooda_ha import OODAHAJournal


def loop(phase='observe', *, children=(), depth=0):
    return {'phase':phase, 'children':list(children), 'depth':depth}


def test_five_phases_and_closed_boundary_are_explicit_and_pure():
    assert PHASES == ('observe', 'orient', 'decide', 'act', 'aftermath', 'closed')
    assert len(PHASES[:-1]) == 5
    for index, current in enumerate(PHASES):
        loops = {'root':loop(current)}
        before = json.dumps(loops,sort_keys=True)
        assert next_phase_allowed(loops, 'root', current) is False
        if index < len(PHASES)-1:
            assert next_phase_allowed(loops, 'root', PHASES[index+1]) is True
        for target in PHASES:
            if target in (current, PHASES[min(index+1, len(PHASES)-1)]):
                continue
            with pytest.raises(ValueError,match='Illegal OODA-HA phase transition'):
                next_phase_allowed(loops, 'root', target)
        assert json.dumps(loops,sort_keys=True) == before
    with pytest.raises(ValueError,match='Unknown OODA-HA phase'):
        next_phase_allowed({'root':loop()},'root','not-a-phase')


def test_child_at_each_parent_phase_blocks_departure_until_closed():
    for current, target in zip(PHASES[:-1], PHASES[1:]):
        loops = {'root':loop(current,children=('inquiry',)),
                 'inquiry':loop('aftermath',depth=1)}
        with pytest.raises(ValueError,match='awaits child loops'):
            next_phase_allowed(loops,'root',target)
        assert loops['root']['phase'] == current
        assert loops['inquiry']['phase'] == 'aftermath'
        loops['inquiry']['phase'] = 'closed'
        assert next_phase_allowed(loops,'root',target) is True


def test_child_anchor_guard_is_pure_and_bounded():
    loops = {'location':loop('act', depth=0)}
    before = json.dumps(loops,sort_keys=True)
    assert child_phase_anchor(loops,None,parent_phase=None,max_depth=2) == (None,0)
    assert child_phase_anchor(loops,'location',parent_phase=None,max_depth=2) == ('act',1)
    assert child_phase_anchor(loops,'location',parent_phase='act',max_depth=2) == ('act',1)
    with pytest.raises(ValueError,match='Parent phase changed'):
        child_phase_anchor(loops,'location',parent_phase='orient',max_depth=2)
    with pytest.raises(ValueError,match='active parent loop'):
        child_phase_anchor(loops,'missing',parent_phase=None,max_depth=2)
    with pytest.raises(ValueError,match='root loop has no parent phase'):
        child_phase_anchor(loops,None,parent_phase='observe',max_depth=2)
    loops['location']['depth'] = 2
    with pytest.raises(ValueError,match='recursion depth budget'):
        child_phase_anchor(loops,'location',parent_phase='act',max_depth=2)
    loops['location']['phase'] = 'closed'
    with pytest.raises(ValueError,match='active parent loop'):
        child_phase_anchor(loops,'location',parent_phase=None,max_depth=4)
    assert before == json.dumps({'location':loop('act',depth=0)},sort_keys=True)


def test_single_journal_keeps_real_receipt_order_and_crash_reentry(tmp_path):
    session = tmp_path/'session.json'
    j = OODAHAJournal(session, identity={
        'location':'phase-law', 'score_state':'synthetic',
        'ledger_path':str(tmp_path/'ledger.json')}, initial={'x':.3})
    j.begin('child',parent='location',scope='inquiry',
            evidence={'question':'What can Aftermath keep?'})
    original = session.read_bytes()
    with pytest.raises(ValueError,match='Illegal OODA-HA phase transition'):
        j.transition('child','act')
    assert session.read_bytes() == original
    for phase in ('orient','decide','act','aftermath'):
        assert j.transition('child',phase,{'proof':phase}) is True
    assert j.transition('child','aftermath',{'proof':'ignored'}) is False
    with pytest.raises(ValueError,match='awaits child'):
        j.transition('location','aftermath')
    assert j.transition('child','closed') is True
    assert j.transition('location','aftermath') is True
    assert j.transition('location','closed') is True
    expected = ['observe','orient','decide','act','aftermath','closed']
    loaded = OODAHAJournal(session)
    phases = [e['phase'] for e in loaded.data['events']
              if e['kind']=='phase' and e['loop']=='child']
    assert phases == expected
    assert loaded.data['loops']['location']['phase'] == 'closed'
    assert any(e['kind']=='child-return' and e['anchor']=='act'
               for e in loaded.data['events'])
