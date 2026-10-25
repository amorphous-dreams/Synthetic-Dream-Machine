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
