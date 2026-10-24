"""RED-first shared selection policies: same seats, independent truth scopes."""
import math

import pytest

from projection_loom.epochs import Proposal
from projection_loom.selection import schedule_candidates, select_review_candidates


def proposals():
    return [
        Proposal('a', 'sobol', {'x': .1}),
        Proposal('b', 'local', {'x': .2}),
        Proposal('c', 'topology', {'x': .3}),
        Proposal('d', 'local', {'x': .4}),
    ]


def test_scheduler_preserves_emitter_seats_and_preview_order():
    rows = proposals()
    scored = lambda g: g['x']
    assert [p.id for p in schedule_candidates(
        rows, preview=scored, max_exact=3)] == ['b', 'a', 'c']
    assert [p.id for p in schedule_candidates(
        rows, preview=scored, max_exact=2)] == ['a', 'b']
    assert [p.id for p in schedule_candidates(
        rows, preview=scored, max_exact=3, reserve_emitter=False)] == ['a', 'b', 'c']
    assert [p.id for p in schedule_candidates(
        list(reversed(rows)), preview=lambda g: 0, max_exact=3)] == ['b', 'a', 'c']


def test_scheduler_rejects_unusable_preview_and_duplicate_ids():
    with pytest.raises(ValueError, match='finite'):
        schedule_candidates(proposals(), preview=lambda g: math.inf, max_exact=3)
    with pytest.raises(ValueError, match='Duplicate proposal'):
        schedule_candidates(proposals()[:2] + proposals()[:1], max_exact=3)


def review_data():
    rows = [
        ('best', 'sobol', .10, 'n1', 'scored'),
        ('similar', 'sobol', .11, 'n1', 'scored'),
        ('local', 'local', .12, 'n1', 'scored'),
        ('new-niche', 'topology', .15, 'n2', 'scored'),
        ('error', 'local', 0, 'n3', 'error'),
        ('deferred', 'topology', 0, 'n4', 'deferred'),
    ]
    return {
        'results': {pid: {'state':state,'combined_loss':loss,'niche':niche,'emitter':emitter}
                    for pid,emitter,loss,niche,state in rows},
        'proposals': {pid: {'genome': {'x':index/10},'emitter':emitter}
                      for index,(pid,emitter,loss,niche,state) in enumerate(rows)},
        'archive': {'n1': {'proposal_id':'best'}, 'n2': {'proposal_id':'new-niche'}},
    }


def test_review_selector_is_diverse_and_never_shows_unscored():
    data = review_data()
    got = select_review_candidates(data, limit=3)
    assert [x['proposal_id'] for x in got] == ['best', 'new-niche', 'local']
    assert all(x['proposal_id'] not in ('error','deferred') for x in got)
    assert got[0] == {
        'proposal_id': 'best', 'combined_loss': .10,
        'genome': {'x': 0.0}, 'niche': 'n1', 'emitter': 'sobol'}
    assert select_review_candidates(data, limit=3) == got


def test_review_selector_preserves_non_elite_scored_operator_choice():
    data = review_data()
    got = select_review_candidates(data, limit=5)
    assert {x['proposal_id'] for x in got} == {'best', 'similar', 'local', 'new-niche'}
    assert select_review_candidates({'results':{},'proposals':{},'archive':{}},limit=4)==[]
