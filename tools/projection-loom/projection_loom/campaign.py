"""Reproducible breeding archive and phenotype observations beneath the OODA-HA helm.

This module never runs a phase, approves an operator control, or certifies
native geometry. Only *scored* CAD-gated candidates reach its reproductive
archive. Rejected and deferred candidates remain counted in generation receipts.
"""
from __future__ import annotations

import copy
from hashlib import sha256
from pathlib import Path
import numpy as np

from .epochs import _atomic, _hash

SCHEMA = 'projection-loom/lineage-archive/v1'


def visual_descriptor(mask):
    """Camera-fixed binary occupancy phenotype; identical pixels have one ID.

    Binned area/extent/center/asymmetry provide a *coarse* quality-diversity
    niche. The full mask digest catches identical output despite different
    numeric genes. Descriptors compare only the same fixed view and size.
    """
    pixels = np.asarray(mask)
    if pixels.ndim != 2 or pixels.size == 0:
        raise ValueError('Visual descriptor requires a nonempty 2D mask')
    if pixels.dtype != np.dtype('bool'):
        raise ValueError('Visual descriptor needs a thresholded boolean silhouette')
    height, width = pixels.shape
    digest = sha256(f'{width}x{height}\0'.encode() + pixels.tobytes(order='C')).hexdigest()
    area = int(pixels.sum())
    if area == 0:
        return {'mask_sha256': digest, 'niche': 'empty', 'occupancy': 0.0}
    yy, xx = np.where(pixels)
    x0, x1, y0, y1 = int(xx.min()), int(xx.max()) + 1, int(yy.min()), int(yy.max()) + 1
    left = int(pixels[:, :width//2].sum())
    right = int(pixels[:, width-width//2:].sum())
    occupancy = area / pixels.size
    def binned(value, bins=8):
        return min(bins - 1, max(0, int(value * bins)))
    descriptor = {
        'mask_sha256': digest, 'occupancy': round(occupancy, 9),
        'bbox': [x0, y0, x1, y1],
        'asymmetry': round((right - left) / area, 9),
        'niche': f'area:{binned(occupancy)}|width:{binned((x1-x0)/width)}|'
                 f'height:{binned((y1-y0)/height)}|x:{binned((x0+x1)/(2*width))}|'
                 f'asym:{binned((1+(right-left)/area)/2)}'
    }
    return descriptor


class LineageArchive:
    """One durable archive per *source-bound* breeding campaign.

    Assimilation is idempotent on the epoch's immutable source checkpoint.
    Epoch results are written by WideEpoch *before* this Archive. A crash
    after archive save but before OODA Aftermath replays the exact receipt.
    """

    def __init__(self, path, *, identity):
        self.path = Path(path)
        if not isinstance(identity, dict) or not identity:
            raise ValueError('Lineage archive requires bounded source identity')
        self.identity = copy.deepcopy(identity)
        if self.path.exists():
            import json
            data = json.loads(self.path.read_text())
            if data.get('identity') != self.identity:
                raise ValueError('Lineage archive identity mismatch; fork a fresh checkpoint')
            check = data.get('snapshot_sha256')
            if not check or check != _hash({k:v for k,v in data.items() if k != 'snapshot_sha256'}):
                raise ValueError('Lineage archive snapshot digest mismatch')
            if data.get('schema') != SCHEMA:
                raise ValueError('Unknown lineage archive schema')
            self.data = data
        else:
            self.data = {'schema': SCHEMA, 'identity': self.identity,
                         'generations': {}, 'elites': {}, 'champions': {}, 'members': {}}
            self._save()

    @property
    def generation_count(self):
        return len(self.data['generations'])

    def _save(self):
        self.data['snapshot_sha256'] = _hash({k:v for k,v in self.data.items()
                                               if k != 'snapshot_sha256'})
        _atomic(self.path, self.data)

    def assimilate(self, generation, checkpoint):
        """Assimilate only completed auditable results, exactly once per epoch."""
        if type(generation) is not int or generation < 1:
            raise ValueError('Generation must be a positive integer')
        if not isinstance(checkpoint, dict):
            raise ValueError('Epoch must provide a durable checkpoint dictionary')
        proposals = checkpoint.get('proposals', {})
        results = checkpoint.get('results', {})
        if set(results) - set(proposals):
            raise ValueError('A candidate result has no recorded source proposal')
        key = str(generation)
        # Bind replay to every admitted and refused state, not only the winners.
        checksum = _hash({'run_id':checkpoint['run_id'], 'proposals':proposals,
                          'results':results})
        old = self.data['generations'].get(key)
        if old is not None:
            if old['epoch_digest'] != checksum:
                raise ValueError('Generation collision: checkpoint changed on replay')
            return dict(old['summary'])
        snapshot = copy.deepcopy(self.data)
        counts = {state:0 for state in ('scored','audited','rejected','deferred','error')}
        for proposal_id in sorted(results):
            result = results[proposal_id]
            state = result['state']
            if state not in counts:
                raise ValueError(f'Unexpected candidate evaluation state: {state}')
            counts[state] += 1
            if state != 'scored':
                continue
            proposal = proposals[proposal_id]
            emitter = proposal['emitter']
            parts = emitter.split(':')
            if len(parts) != 3 or parts[0] != 'family':
                raise ValueError('Breeding archive needs a source-bound family emitter')
            family = parts[1]
            traits = result.get('phenotype', [])
            masks = [feature.split(':', 1)[1] for feature in traits if feature.startswith('visual:')]
            niches = [feature.split(':', 1)[1] for feature in traits if feature.startswith('visual-niche:')]
            if len(masks) != 1 or len(masks[0]) != 64 or len(niches) != 1:
                raise ValueError('Scored breeding member needs one measured visual phenotype')
            ident = f'{generation:04d}/{proposal_id}'
            row = {'id': ident, 'family': family, 'emitter': emitter,
                   'parent': proposal.get('parent'), 'genome': dict(proposal['genome']),
                   'mask_sha256': masks[0], 'niche': niches[0],
                   'combined_loss': result['combined_loss'],
                   'losses': dict(result['losses']),
                   'witness_id': result.get('witness_id'),
                   'evidence_state': result.get('evidence_state')}
            snapshot['members'][ident] = row
            best = snapshot['champions'].get(family)
            if best is None or (row['combined_loss'],row['id']) < (best['combined_loss'],best['id']):
                snapshot['champions'][family] = row
            best = snapshot['elites'].get(row['niche'])
            if best is None or (row['combined_loss'],row['id']) < (best['combined_loss'],best['id']):
                snapshot['elites'][row['niche']] = row
        snapshot['generations'][key] = {'epoch_digest': checksum, 'summary': counts,
                                         'run_id': checkpoint['run_id']}
        self.data = snapshot
        self._save()
        return dict(counts)

    def best(self, family):
        row = self.data['champions'].get(family)
        return copy.deepcopy(row) if row else None

    def parents(self, family, limit=3):
        if not 1 <= limit <= 20:
            raise ValueError('Parent selection must be bounded')
        eligible = sorted((x for x in self.data['members'].values() if x['family'] == family),
                          key=lambda row: (row['combined_loss'], row['id']))
        seen, parents = set(), []
        for row in eligible:
            if row['mask_sha256'] in seen:
                continue
            parents.append(copy.deepcopy(row))
            seen.add(row['mask_sha256'])
            if len(parents) >= limit:
                break
        return parents

    def elites(self):
        return sorted((copy.deepcopy(x) for x in self.data['elites'].values()),
                      key=lambda x: (x['combined_loss'], x['id']))


# These are anonymous search families, not Operator pet-names. Every family
# shares the same source-bound recipe and native CAD / polygon audit rules.
FAMILY_FOCUSES = {
    'needle': ('shaft_width', 'shaft_length', 'shaft_asymmetry', 'shaft_jaggedness'),
    'fractured': ('shaft_jaggedness', 'spire_segmentation', 'crystal.fracture', 'crystal.wave'),
    'terraces': ('terrace_overhang', 'terrace_offset', 'gallery_reach', 'fortress_width'),
    'crown': ('crown_taper', 'crown_offset', 'parapet_fraction', 'tower_height'),
    'keep': ('keep_taper', 'tower_height', 'spire_segmentation', 'gate_width'),
    'crystal': ('crystal.relief', 'crystal.guide', 'crystal.fracture', 'join.relief'),
}


def make_brood(bounds, initial, archive, *, seed, generation, offspring_per_family,
               migration_every=4, mutation_scale=.16):
    """Deterministic Sobol/local/topology variations of durable family parents.

    This is only a proposal generator, never a second OODA-HA executor. A
    compatible immigrant may lend loci every N generations; no family gets
    deleted because its global fitness is temporarily worse than the seed.
    """
    from scipy.stats import qmc
    from .epochs import Proposal
    if type(generation) is not int or generation < 1:
        raise ValueError('Breeding generation must be a positive integer')
    if type(offspring_per_family) is not int or not 1 <= offspring_per_family <= 32:
        raise ValueError('Offspring per family must lie within 1..32')
    if type(migration_every) is not int or migration_every < 2:
        raise ValueError('Migration cadence must be at least two generations')
    if not np.isfinite(mutation_scale) or not 0 < mutation_scale <= .4:
        raise ValueError('Mutation scale must lie within (0, .4]')
    if set(initial) != set(bounds):
        raise ValueError('Brood genome must match declared bounds')
    if any(not set(keys).issubset(bounds) for keys in FAMILY_FOCUSES.values()):
        raise ValueError('Breeding family loci absent from compound recipe')
    families = list(FAMILY_FOCUSES)
    brood = []
    for family_index, family in enumerate(families):
        focus = FAMILY_FOCUSES[family]
        rng = np.random.default_rng(seed + generation*1009 + family_index*7919)
        sobol = qmc.Sobol(len(focus), scramble=True,
                          seed=seed+generation*1013+family_index*65521).random_base2(
                              max(1, int(np.ceil(np.log2(offspring_per_family)))))
        parents = archive.parents(family, limit=3)
        for j in range(offspring_per_family):
            mode = ('sobol', 'local', 'topology')[j % 3]
            primary = parents[j % len(parents)] if parents else None
            anchor = dict(primary['genome'] if primary else initial)
            parent_id = primary['id'] if primary else 'original-seed'
            # Migrations are compatible because all islands share the recipe;
            # the donor contributes only focus loci and remains attributable.
            if parents and generation % migration_every == 0 and j == 0:
                donor_family = families[(family_index-1) % len(families)]
                donor = archive.best(donor_family)
                if donor is not None:
                    for k in focus[::2]:
                        anchor[k] = float(donor['genome'][k])
                    parent_id = f'{primary["id"]}+migration:{donor["id"]}'
            if len(parents) > 1 and j % 4 == 3:
                donor = parents[(j+1) % len(parents)]
                for k in focus[::2]:
                    anchor[k] = float(donor['genome'][k])
                parent_id = f'{parent_id}+cross:{donor["id"]}'
            for k, key in enumerate(focus):
                lo, hi = bounds[key]
                if mode == 'sobol':
                    value = lo + float(sobol[j, k]) * (hi-lo)
                elif mode == 'local':
                    value = anchor[key] + float(rng.normal(0, mutation_scale)) * (hi-lo)
                else:
                    value = anchor[key]
                    # Toggle one explicit grammar branch. Nonbranch topology
                    # families perturb their most descriptive constructive locus.
                    if key in ('spire_segmentation','join.enable'):
                        value = (lo + .75*(hi-lo) if value < (lo+hi)/2
                                 else lo + .25*(hi-lo))
                    elif k == j//3 % len(focus):
                        value += (.22 if generation % 2 else -.22)*(hi-lo)
                anchor[key] = float(np.clip(value, lo, hi))
            brood.append(Proposal(
                id=f'{family}-{generation:03d}-{j+1:03d}',
                emitter=f'family:{family}:{mode}', genome=anchor, parent=parent_id))
    return brood
