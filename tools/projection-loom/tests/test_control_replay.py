"""Crash-window witnesses: a durable operator effect gets one acknowledgement.

RED: if ledger.save succeeds and the process dies before session.save, replay
must recover the committed control without repeating it.
"""
import json

import pytest

from projection_loom.ooda import OODAJournal, submit_control
from projection_loom.relations import Occurrence, PetNameLedger, RelationWitness


def review(tmp_path):
    session = tmp_path / 'session.json'
    ledger_path = tmp_path / 'identity-ledger.json'
    journal = OODAJournal(
        session,
        identity={'location': 'replay-site', 'score_state': 'synthetic',
                  'ledger_path': str(ledger_path)},
        initial={'x': .2}, autonomy=0)
    journal.begin('epoch-0001', parent='location', scope='epoch',
                  evidence={'source': 'known synthetic witness'})
    for phase in ('orient', 'decide', 'act', 'aftermath'):
        journal.transition('epoch-0001', phase)
    witness_path = tmp_path / 'witness.json'
    witness = RelationWitness({
        'foundation': Occurrence('foundation', 'material', 'foundation', (),
                                 ('#has/solid',), slot='foundation')
    }, location='replay-site')
    witness.save(witness_path)
    journal.data['loops']['epoch-0001']['options'] = [
        {'proposal_id': 'candidate-1', 'witness': str(witness_path)}]
    journal.wait('review', epoch_id='epoch-0001', options=['candidate-1'])
    return session, ledger_path, journal


def after_durable_save(monkeypatch, journal):
    actual_save = PetNameLedger.save
    with monkeypatch.context() as patch:
        def crash(self, path):
            actual_save(self, path)
            raise RuntimeError('injected crash after durable ledger save')
        patch.setattr(PetNameLedger, 'save', crash)
        with pytest.raises(RuntimeError, match='injected crash'):
            journal.poll()


def test_pet_name_recovers_committed_ledger_without_reapplying(tmp_path, monkeypatch):
    session, path, journal = review(tmp_path)
    command = submit_control(session, 'pet-name', proposal_id='candidate-1',
                             target='foundation', name='The First Name', mode='entity')
    after_durable_save(monkeypatch, journal)
    assert len(PetNameLedger.load(path).claims) == 1
    assert command['id'] not in OODAJournal(session).data['applied_controls']
    resumed = OODAJournal(session)
    resumed.poll()
    assert command['id'] in resumed.data['applied_controls']
    ledger = PetNameLedger.load(path)
    assert len(ledger.claims) == 1
    assert [e['action'] for e in ledger.history] == ['pet-name']
    assert sum(e['kind'] == 'lineage-intervention' for e in resumed.data['events']) == 1
    assert sum(e['kind'] == 'operator-control' and e['control_id'] == command['id']
               for e in resumed.data['events']) == 1
    count = len(resumed.data['events'])
    resumed.poll()
    assert len(resumed.data['events']) == count


def test_o_takiage_recovers_release_without_releasing_twice(tmp_path, monkeypatch):
    session, path, journal = review(tmp_path)
    submit_control(session, 'pet-name', proposal_id='candidate-1',
                   target='foundation', name='Releasable')
    journal.poll()
    command = submit_control(session, 'o-takiage', name='Releasable')
    after_durable_save(monkeypatch, journal)
    assert not PetNameLedger.load(path).claims[0]['active']
    resumed = OODAJournal(session)
    resumed.poll()
    ledger = PetNameLedger.load(path)
    assert not ledger.claims[0]['active']
    assert [e['action'] for e in ledger.history] == ['pet-name', 'o-takiage']
    assert command['id'] in resumed.data['applied_controls']
    assert sum(e['kind'] == 'lineage-intervention'
               for e in resumed.data['events']) == 2


def test_replay_refuses_tampered_command_after_ledger_commit(tmp_path, monkeypatch):
    session, path, journal = review(tmp_path)
    command = submit_control(session, 'pet-name', proposal_id='candidate-1',
                             target='foundation', name='Original')
    after_durable_save(monkeypatch, journal)
    inbox = session.parent / 'controls' / 'inbox' / (command['id'] + '.json')
    tampered = json.loads(inbox.read_text())
    tampered['parameters']['name'] = 'Changed On Replay'
    inbox.write_text(json.dumps(tampered))
    with pytest.raises(ValueError, match='digest|altered|mismatch'):
        OODAJournal(session).poll()
    ledger = PetNameLedger.load(path)
    assert [c['name'] for c in ledger.claims] == ['Original']
    assert len(ledger.history) == 1


def test_replay_works_when_witness_file_disappears_after_commit(tmp_path, monkeypatch):
    session, path, journal = review(tmp_path)
    cmd = submit_control(session, 'pet-name', proposal_id='candidate-1',
                         target='foundation', name='Original')
    after_durable_save(monkeypatch, journal)
    (tmp_path / 'witness.json').unlink()
    fresh = OODAJournal(session)
    fresh.poll()
    assert cmd['id'] in fresh.data['applied_controls']
    assert PetNameLedger.load(path).claims[0]['name'] == 'Original'
