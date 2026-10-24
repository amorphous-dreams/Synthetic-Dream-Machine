"""Pure, budgeted attention policies shared across the Projection Loom.

Candidate scheduling decides which genomes earn costly CAD/void audits; review
selection decides which *already scored* alternatives the Operator can inspect.
The shared vocabulary never makes a preview image into evidence or weakens an
auditor. Keep these two policies separate even while reusing their data shapes.
"""
from __future__ import annotations
import math


def schedule_candidates(proposals, *, preview=None, max_exact, reserve_emitter=True):
    """Return the exact, deterministic audition order for an epoch.

    When enough exact seats exist, one representative of each emitter runs
    before filling the remaining budget by preview priority. Preview costs can
    order work; they cannot certify CAD or erase a method's reserved seat.
    """
    proposals = list(proposals)
    if len({p.id for p in proposals}) != len(proposals):
        raise ValueError('Duplicate proposal ID')
    if isinstance(max_exact, bool) or not isinstance(max_exact, int) or max_exact < 1:
        raise ValueError('Exact candidate budget must be positive')
    estimates = []
    for p in proposals:
        estimate = 0.0 if preview is None else float(preview(p.genome))
        if not math.isfinite(estimate):
            raise ValueError('Preview score must be finite')
        estimates.append((estimate, p.id, p))
    ordered = sorted(estimates, key=lambda x: (x[0], x[1]))
    scheduled = []
    if reserve_emitter:
        methods = {p.emitter for _, _, p in estimates}
        if len(methods) <= max_exact:
            for method in sorted(methods):
                scheduled.append(next(row for row in ordered if row[2].emitter == method))
    already = {row[2].id for row in scheduled}
    for row in ordered:
        if len(scheduled) >= max_exact:
            break
        if row[2].id not in already:
            scheduled.append(row)
            already.add(row[2].id)
    return [p for _, _, p in scheduled]


def select_review_candidates(data, *, limit=4):
    """Choose a champion and contrasting *scored* alternatives.

    The operator may choose a non-archive elite that survived the exact CAD
    gate. Unscored, rejected, errored and deferred proposals remain invisible.
    This policy does not render, regrow, certify or grant naming authority.
    """
    if isinstance(limit, bool) or not isinstance(limit, int) or limit < 1:
        raise ValueError('Review budget must be positive')
    scored = []
    for pid, row in data['results'].items():
        if row['state'] != 'scored':
            continue
        scored.append({'proposal_id': pid,
                       'combined_loss': row['combined_loss'],
                       'genome': data['proposals'][pid]['genome'],
                       'niche': row['niche'],
                       'emitter': data['proposals'][pid]['emitter']})
    scored.sort(key=lambda x: (x['combined_loss'], x['proposal_id']))
    selected = []
    if scored:
        selected.append(scored.pop(0))
    while scored and len(selected) < limit:
        niches = {x['niche'] for x in selected}
        emitters = {x['emitter'] for x in selected}
        scored.sort(key=lambda x: (x['niche'] in niches,
                                   x['emitter'] in emitters,
                                   x['combined_loss'], x['proposal_id']))
        selected.append(scored.pop(0))
    return selected
