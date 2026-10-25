"""RED-first: no emitter can starve because the exact budget is smaller than the emitter set."""
import pytest
from projection_loom.epochs import Proposal, WideEpoch
from projection_loom.selection import schedule_candidates


def brood():
    return [Proposal('seed', 'lineage', {'x': 0.0}),
            Proposal('local', 'local', {'x': .10}),
            Proposal('topology', 'topology', {'x': .20}),
            Proposal('sobol', 'sobol', {'x': .90})]


def test_rotating_guarantees_all_four_emitters_get_an_exact_audition():
    seen = set()
    by_turn = []
    for generation in range(4):
        chosen = schedule_candidates(brood(), preview=lambda g: g['x'],
                                     max_exact=3, emitter_turn=generation)
        methods = {p.emitter for p in chosen}
        by_turn.append(methods)
        assert len(methods) == 3
        seen.update(methods)
    assert seen == {'lineage', 'sobol', 'local', 'topology'}
    assert 'sobol' in by_turn[1]
    assert [p.id for p in schedule_candidates(brood(), preview=lambda g:g['x'],
                                              max_exact=4, emitter_turn=3)] == [
        'seed', 'local', 'sobol', 'topology']


def test_epoch_turn_is_in_immutable_checkpoint_identity(tmp_path):
    base = dict(location='test', source_digests={}, construction_digest='0'*64,
                objectives=('loss',), score_state='synthetic',
                checkpoint=tmp_path/'epoch.json', max_exact=3, max_detail=2)
    created = WideEpoch(**base, emitter_turn=1)
    assert created.identity['emitter_turn'] == 1
    with pytest.raises(ValueError, match='Incompatible epoch checkpoint'):
        WideEpoch(**base, emitter_turn=2)


def test_invalid_turn_refuses_silent_nondeterminism():
    for bad in (-1, 1.4, True):
        with pytest.raises(ValueError, match='turn'):
            schedule_candidates(brood(), max_exact=3, emitter_turn=bad)
