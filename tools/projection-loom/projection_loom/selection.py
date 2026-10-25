"""Pure, budgeted attention policies shared across the Projection Loom.

Candidate scheduling decides which genomes earn costly CAD/void audits; review
selection decides which *already scored* alternatives the Operator can inspect.
The shared vocabulary never makes a preview image into evidence or weakens an
auditor. Keep these two policies separate even while reusing their data shapes.
"""
from __future__ import annotations
import math


def schedule_candidates(proposals, *, preview=None, max_exact, reserve_emitter=True,
                        emitter_turn=0):
    """Return the exact, deterministic audition order for an epoch.

    When enough exact seats exist, one representative of each emitter runs
    before filling the remaining budget by preview priority. Preview costs can
    order work; they cannot certify CAD or erase a method's reserved seat.
    """
    if type(emitter_turn) is not int or emitter_turn < 0:
        raise ValueError('Emitter turn must be a nonnegative integer')
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
            # Preserve the established complete method-seat ordering.
            reserved = sorted(methods)
        elif all(method.startswith('family:') and len(method.split(':')) == 3
                 for method in methods):
            # Keep family fairness independent of incidental lexical names.
            # With 12 seats and 18 family/method emitters, a flat lexical
            # prefix used to fill four families and starve the other two.
            # Interleave families first, then rotate their methods across
            # generations. The preview still only ranks candidates *within*
            # each method's reserved audition seat.
            by_family = {}
            for method in methods:
                _, family, variant = method.split(':')
                by_family.setdefault(family, []).append((variant, method))
            families = sorted(by_family)
            for family in families:
                by_family[family].sort()
            family_count = len(families)
            family_offset = (emitter_turn * max_exact) % family_count
            family_ring = families[family_offset:] + families[:family_offset]
            turns_per_family = max(1, math.ceil(family_count / max_exact))
            seats_per_family = max(1, max_exact // family_count)
            method_offset = (emitter_turn // turns_per_family) * seats_per_family
            ring = []
            for level in range(max(len(variants) for variants in by_family.values())):
                for family in family_ring:
                    variants = by_family[family]
                    if level < len(variants):
                        ring.append(variants[(method_offset + level) %
                                             len(variants)][1])
            reserved = ring[:max_exact]
        else:
            # Ordinary method rings retain their existing behavior.
            # Preview cannot reorder the reserved method rotation.
            ordered_methods = sorted(methods)
            offset = emitter_turn % len(ordered_methods)
            reserved = (ordered_methods[offset:] + ordered_methods[:offset])[:max_exact]
        for method in reserved:
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



def allocate_detail_seats(scheduled, *, max_detail, emitter_turn=0, preview=None,
                          emitter_performance=None):
    """Reserve native-scoring capacity across breeding islands and methods.

    Only already exact-scheduled proposals participate. Existing nonbreeding
    epochs keep their original ordered scoring semantics. For family emitters,
    allocate one rotating method seat per family, then round-robin the remaining
    seats. A preview orders within a mode but is never a validity filter.
    """
    if type(max_detail) is not int or max_detail < 1:
        raise ValueError('Detail budget must be positive')
    if type(emitter_turn) is not int or emitter_turn < 0:
        raise ValueError('Emitter turn must be nonnegative')
    rows = list(scheduled)
    if not rows:
        return []
    if any(not p.emitter.startswith('family:') for p in rows):
        return rows[:max_detail]
    grouped = {}
    for proposal in rows:
        tokens = proposal.emitter.split(':')
        if len(tokens) != 3 or not tokens[1] or not tokens[2]:
            raise ValueError('Malformed family emitter in detail scheduler')
        grouped.setdefault(tokens[1], {}).setdefault(tokens[2], []).append(proposal)
    families = sorted(grouped)
    choices = {}
    for family in families:
        for method, options in grouped[family].items():
            choices[(family,method)] = sorted(
                options,key=lambda p: ((float(preview(p.genome)) if preview else 0.),p.id))
    first = families[emitter_turn % len(families):] + families[:emitter_turn % len(families)]
    chosen, used = [], set()
    performance=emitter_performance or {}
    for level in range(max(len(grouped[family]) for family in families) *
                       max(len(grouped[family][method]) for family in families for method in grouped[family])):
        for family in first:
            if len(chosen) >= max_detail:
                break
            methods = sorted(grouped[family])
            rotation = emitter_turn % len(methods)
            by_turn = methods[rotation:] + methods[:rotation]
            # For subsequent rounds, prefer a different source variation method.
            available_methods=[m for m in by_turn if any(
                p.id not in used for p in choices[(family,m)])]
            if not available_methods:
                continue
            # Preserve one evaluated seat per observed family/method before
            # adapting surplus. Learned reward never erases a fair rotation.
            method=min(available_methods,key=lambda m: (
                any(p.emitter=='family:'+family+':'+m for p in chosen),
                # Sampling a family method for the first time gives more
                # information than repeatedly scoring a known success.
                # Reward/curiosity only breaks ties in observed exposure.
                int(performance.get('family:'+family+':'+m,{}).get('scored',0)),
                -float(performance.get('family:'+family+':'+m,{})
                       .get('exploration_value',0.)),
                by_turn.index(m)))
            available = choices[(family,method)]
            candidate = next((p for p in available if p.id not in used),None)
            if candidate is not None:
                chosen.append(candidate)
                used.add(candidate.id)
        if len(chosen) >= max_detail:
            break
    # If some family modes have few members, still use the remaining budget
    # without conflating a generated preview with structural admission.
    if len(chosen) < max_detail:
        for proposal in rows:
            if proposal.id not in used:
                chosen.append(proposal)
                used.add(proposal.id)
            if len(chosen) >= max_detail:
                break
    return chosen
