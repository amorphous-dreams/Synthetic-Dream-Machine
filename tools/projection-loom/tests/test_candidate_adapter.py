"""RED-first equivalence contract for the OODA candidate evaluation lift.

One adapter carries callback intent. It must not alter CAD admission, losses,
witnesses, checkpoints, budgets, failure semantics, or resume behavior.
"""
import json
import pytest

from projection_loom.epochs import CandidateAdapter, Proposal, WideEpoch
from projection_loom.grammar import grow_program


def grow(genome):
    return grow_program([
        {'key': 'root', 'op': 'root-box', 'center': [0, 0, 0],
         'size': [2, 2, 2], 'has': ['foundation']}
    ], genome)


def epoch(path):
    return WideEpoch(location='adapter-test', source_digests={},
                     construction_digest='a'*64, objectives=('shape',),
                     score_state='synthetic', checkpoint=path,
                     max_exact=3, max_detail=2, seed=17)


def candidates():
    return [Proposal('a', 'sobol', {'x': .1}),
            Proposal('b', 'local', {'x': .2}),
            Proposal('c', 'topology', {'x': .3}),
            Proposal('d', 'local', {'x': .4})]


def callbacks():
    return dict(grow=grow,
                score=lambda g, a: {'shape': abs(g['x']-.2)},
                preview=lambda g: g['x'])


def test_adapter_is_checkpoint_and_archive_isomorphic_to_callbacks(tmp_path):
    classic = epoch(tmp_path/'classic.json')
    via_adapter = epoch(tmp_path/'adapter.json')
    expected = classic.run(candidates(), **callbacks())
    actual = via_adapter.run(candidates(), adapter=CandidateAdapter(**callbacks()))
    assert actual == expected
    assert json.loads((tmp_path/'classic.json').read_text()) == json.loads(
        (tmp_path/'adapter.json').read_text())
    assert [actual['results'][p]['state'] for p in ('a', 'b', 'c', 'd')] == [
        'scored', 'scored', 'audited', 'deferred']
    assert via_adapter.run(candidates(), adapter=CandidateAdapter(**callbacks())) == expected


def test_adapter_receipts_stop_and_resume_once(tmp_path):
    seen = []
    actions = dict(callbacks(),
                   after_candidate=lambda p, r: seen.append((p.id, r['state'])),
                   should_continue=lambda: len(seen)<1)
    path = tmp_path/'stop.json'
    first = epoch(path)
    first.run(candidates(), adapter=CandidateAdapter(**actions))
    assert seen == [('a', 'scored')]
    assert not first.completed(candidates(), preview=callbacks()['preview'])
    next_run = epoch(path)
    next_run.run(candidates(), adapter=CandidateAdapter(**dict(
        callbacks(), after_candidate=lambda p, r: seen.append((p.id, r['state'])))))
    assert [x[0] for x in seen] == ['a', 'b', 'c']
    assert next_run.completed(candidates(), preview=callbacks()['preview'])


def test_adapter_rejects_ambiguous_mixed_contract(tmp_path):
    with pytest.raises(ValueError, match='adapter|callbacks'):
        epoch(tmp_path/'conflict.json').run(
            candidates(), adapter=CandidateAdapter(**callbacks()), **callbacks())


def test_adapter_preserves_error_vs_cad_rejection(tmp_path):
    def scoring_error(g, assembly):
        raise RuntimeError('scoring unavailable')
    failed = epoch(tmp_path/'failure.json').run(
        candidates(), adapter=CandidateAdapter(grow=grow, score=scoring_error))
    assert failed['results']['a']['state'] == 'error'
    assert failed['results']['a']['error_class'] == 'RuntimeError'
    assert not failed['archive']
