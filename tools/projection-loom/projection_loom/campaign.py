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
from .search_strategy import diversity_parents, pareto_front, searchability_census, infer_locus_interactions, adaptive_foci

SCHEMA = 'projection-loom/lineage-archive'


def visual_descriptor(mask):
    """Camera-fixed binary occupancy phenotype; identical pixels have one ID.

    Region-binned silhouette spans retain architectural diversity even when
    area, bounding box and asymmetry agree. The exact pixel digest catches
    identical outputs despite different genes. Fixed-view/source comparisons
    only: a visual niche is never a structural or survey certificate.
    """
    pixels = np.asarray(mask)
    if pixels.ndim != 2 or pixels.size == 0:
        raise ValueError('Visual descriptor requires a nonempty 2D mask')
    if pixels.dtype != np.dtype('bool'):
        raise ValueError('Visual descriptor needs a thresholded boolean silhouette')
    height, width = pixels.shape
    digest = sha256(f'{width}x{height}\0'.encode() + pixels.tobytes(order='C')).hexdigest()
    area = int(pixels.sum())
    # Six horizontal bands are an intentionally coarse architectural profile.
    # The 16-bin width quantization tolerates one-pixel fringe variations;
    # exact mask SHA-256 still distinguishes those outputs for lineage receipts.
    region_widths, region_centers, region_coverage = [], [], []
    for band in np.array_split(pixels, 6, axis=0):
        occupied_x = np.flatnonzero(np.any(band, axis=0))
        region_widths.append(int(occupied_x[-1] - occupied_x[0] + 1)
                             if len(occupied_x) else 0)
        region_centers.append(float(occupied_x.mean()) / width if len(occupied_x) else 0.)
        region_coverage.append(float(band.sum()) / band.size if band.size else 0.0)
    region_niche = '-'.join(str(min(15, int(16 * span / width)))
                            for span in region_widths)
    if area == 0:
        return {'mask_sha256': digest, 'niche': 'empty', 'occupancy': 0.0,
                'region_widths': region_widths, 'region_centers':region_centers,
                'region_coverage':region_coverage, 'holes':0}
    yy, xx = np.where(pixels)
    x0, x1, y0, y1 = int(xx.min()), int(xx.max()) + 1, int(yy.min()), int(yy.max()) + 1
    left = int(pixels[:, :width//2].sum())
    right = int(pixels[:, width-width//2:].sum())
    occupancy = area / pixels.size
    def binned(value, bins=8):
        return min(bins - 1, max(0, int(value * bins)))
    from scipy.ndimage import binary_fill_holes, label
    enclosed = binary_fill_holes(pixels) & ~pixels
    holes = int(label(enclosed)[1])
    # Profile centers distinguish offset terraces sharing an overall silhouette
    # bbox. Coarse quantization avoids turning tiny raster fringe noise into
    # an entirely new island. Exact mask hashes still record every difference.
    center_niche = '-'.join(str(min(7,int(8*c))) for c in region_centers)
    holes_niche = min(3,holes)
    descriptor = {
        'mask_sha256': digest, 'occupancy': round(occupancy, 9),
        'bbox': [x0, y0, x1, y1],
        'asymmetry': round((right - left) / area, 9),
        'region_widths': region_widths,
        'region_centers':[round(v,9) for v in region_centers],
        'region_coverage':[round(v,9) for v in region_coverage],
        'holes':holes,
        'niche': f'area:{binned(occupancy)}|width:{binned((x1-x0)/width)}|'
                 f'height:{binned((y1-y0)/height)}|x:{binned((x0+x1)/(2*width))}|'
                 f'asym:{binned((1+(right-left)/area)/2)}|profile:{region_niche}'
                 f'|center:{center_niche}|holes:{holes_niche}'
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
                         'generations': {}, 'elites': {}, 'champions': {},
                         'component_elites':{}, 'pareto':[], 'members': {}}
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
            focus = FAMILY_FOCUSES.get(family, ())
            genome = dict(proposal['genome'])
            regional = result['losses'].get('regional')
            row = {'id': ident, 'family': family, 'emitter': emitter,
                   'entity': FAMILY_ENTITIES.get(family, family),
                   'parent': proposal.get('parent'), 'ancestry':proposal.get('ancestry'),
                   'genome': genome,
                   'component_genome':{k:genome[k] for k in focus if k in genome},
                   'specialist_loss':float(regional + .2*result['losses']['silhouette'])
                         if regional is not None else float(result['combined_loss']),
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
            key_component = family + '/' + row['niche']
            best_component = snapshot['component_elites'].get(key_component)
            if best_component is None or (row['specialist_loss'],row['id']) < (best_component['specialist_loss'],best_component['id']):
                snapshot['component_elites'][key_component] = row
        snapshot['pareto'] = [r['id'] for r in pareto_front(snapshot['members'].values())]
        snapshot['generations'][key] = {'epoch_digest': checksum, 'summary': counts,
                                         'run_id': checkpoint['run_id']}
        self.data = snapshot
        self._save()
        return dict(counts)

    def best(self, family):
        row = self.data['champions'].get(family)
        return copy.deepcopy(row) if row else None

    def parents(self, family, limit=3, *, before_generation=None):
        eligible = (x for x in self.data['members'].values()
                    if x['family'] == family and
                    (before_generation is None or int(x['id'].split('/')[0]) < before_generation))
        return [copy.deepcopy(x) for x in diversity_parents(eligible,limit)]

    def component_parents(self, family, limit=3, *, before_generation=None):
        """Independently reproducing fragment candidates, evaluated in whole-location contexts."""
        eligible = (x for x in self.data['members'].values()
                    if x['family'] == family and
                    (before_generation is None or int(x['id'].split('/')[0]) < before_generation))
        return [copy.deepcopy(x) for x in diversity_parents(eligible,limit,specialist=True)]

    def elites(self):
        return sorted((copy.deepcopy(x) for x in self.data['elites'].values()),
                      key=lambda x:(x['combined_loss'],x['id']))

    def census(self, bounds, *, activations=()):
        return searchability_census(bounds,self,family_focus=FAMILY_FOCUSES,
                                    activations=activations)


# These are anonymous search families, not Operator pet-names. Every family
# shares the same source-bound recipe and native CAD / polygon audit rules.
FAMILY_FOCUSES = {
    'needle': ('shaft_width','shaft_length','shaft_asymmetry','shaft_jaggedness'),
    'fractured': ('shaft_jaggedness','spire_segmentation','crystal.fracture','crystal.wave','crystal.seed'),
    'terraces': ('terrace_overhang','terrace_offset','gallery_reach','fortress_width',
                 'join.enable','join.relief','join.fracture','join.seed','join.wave',
                 'grammar.gallery','grammar.gallery_span'),
    'crown': ('crown_taper','crown_offset','parapet_fraction','tower_height',
              'grammar.buttress','grammar.brace_span'),
    'keep': ('keep_taper','tower_height','spire_segmentation','gate_width'),
    'crystal': ('crystal.relief','crystal.guide','crystal.fracture','crystal.seed'),
}
# Search populations and operator-given pet-names have separate authority.
# An entity may have several distinct reproductive search islands.
FAMILY_ENTITIES = {
    'needle':'Crystal','fractured':'Crystal','crystal':'Crystal',
    'terraces':'Joining','crown':'Fortress','keep':'Fortress',
}

def validate_breeding_recipe(recipe):
    """Admit by required source-held loci, not a release or schema ordinal."""
    required={key for genes in FAMILY_FOCUSES.values()
              for key in genes if not key.startswith('grammar.')}
    if (recipe is None or not required.issubset(recipe.bounds)
            or not recipe.source_hashes or not recipe.cad_keys):
        raise ValueError('Breeding requires a source-bound structural recipe with all required loci')
    return recipe


def make_brood(bounds, initial, archive, *, seed, generation, offspring_per_family,
               migration_every=4, mutation_scale=.16, transfer_seeds=(),
               interaction_min_samples=24):
    """Evolve family-owned gene blocks semi-independently in distinct collaborators.

    A family inherits its own measured fragment, not its whole old context.
    Other families donate versioned *fragments* to an assembled whole-location
    candidate, whose native CAD/mesh audit remains mandatory. No second helm.
    """
    from scipy.stats import qmc
    from .epochs import Proposal
    if type(generation) is not int or generation<1:
        raise ValueError('Breeding generation must be positive')
    if type(offspring_per_family) is not int or not 1<=offspring_per_family<=32:
        raise ValueError('Offspring per family must lie within 1..32')
    if type(migration_every) is not int or migration_every<2:
        raise ValueError('Migration cadence must be at least two')
    if not np.isfinite(mutation_scale) or not 0<mutation_scale<=.4:
        raise ValueError('Mutation scale must lie within (0,.4]')
    if set(initial)!=set(bounds):
        raise ValueError('Source genome and declared bounds differ')
    focus_map={family:tuple(k for k in loci if k in bounds)
               for family,loci in FAMILY_FOCUSES.items()}
    if set().union(*(set(v) for v in focus_map.values())) != set(bounds):
        raise ValueError('Breeding families must cover every declared locus')
    interactions=infer_locus_interactions(bounds,archive,before_generation=generation,
                                          min_samples=interaction_min_samples)
    focus_map=adaptive_foci(focus_map,interactions,max_extra=2)
    transfer_by_family={}
    for transfer in transfer_seeds:
        family=transfer['family']
        if family not in focus_map or transfer.get('authority')!='proposal-only' or not transfer.get('operator_authorized'):
            raise ValueError('Transfer seeds must be authorized and family-bound')
        if any(k not in focus_map[family] or not 0<=v<=1 for k,v in transfer['loci'].items()):
            raise ValueError('Invalid normalized transfer locus')
        transfer_by_family.setdefault(family,[]).append(transfer)
    # A requested donor must enter a real mutation slot, not silently disappear.
    transfer_slots=sum(j%3==1 for j in range(offspring_per_family))
    if any(len(v)>transfer_slots for v in transfer_by_family.values()):
        raise ValueError('Authorized transfer seeds exceed available family-local offspring slots')
    families=list(FAMILY_FOCUSES)
    ancestry={f:archive.component_parents(f,limit=3,before_generation=generation)
              for f in families}
    brood=[]
    for family_index,family in enumerate(families):
        focus=focus_map[family]
        rng=np.random.default_rng(seed+generation*1009+family_index*7919)
        sobol=qmc.Sobol(len(focus),scramble=True,
            seed=seed+generation*1013+family_index*65521).random_base2(
            max(1,int(np.ceil(np.log2(offspring_per_family)))))
        own=ancestry[family]
        for j in range(offspring_per_family):
            mode=('sobol','local','topology')[j%3]
            primary=own[j%len(own)] if own else None
            # Distinct whole-location collaborating contexts cycle across
            # surviving specialist fragments and the original source.
            genome=dict(initial)
            collaborators={}
            for donor_index,donor_family in enumerate(families):
                if donor_family==family:continue
                donors=ancestry[donor_family]
                if not donors:continue
                # Stable alternating collaborator contexts; migration rotates
                # which specialist version seeds the neighboring group.
                pick=(j//3+generation+donor_index) % (len(donors)+1)
                if generation % migration_every==0 and donor_index==(family_index+5)%len(families):
                    pick=0
                if pick==len(donors):continue
                donor=donors[pick]
                for key in focus_map[donor_family]:
                    if key not in focus:
                        genome[key]=float(donor['component_genome'].get(key,donor['genome'][key]))
                collaborators[donor_family]=donor['id']
            if primary:
                for key in focus:
                    genome[key]=float(primary['component_genome'].get(key,primary['genome'][key]))
            parent_id=primary['id'] if primary else 'original-seed'
            imported=transfer_by_family.get(family,())
            transfer_slot=j//3 if j%3==1 else None
            active_transfer=(imported[transfer_slot] if transfer_slot is not None
                             and transfer_slot<len(imported) else None)
            if active_transfer is not None:
                for key,value in active_transfer['loci'].items():
                    lo,hi=bounds[key]
                    genome[key]=float(lo+value*(hi-lo))
                parent_id='transfer:'+active_transfer['donor_id']
            for k,key in enumerate(focus):
                lo,hi=bounds[key]
                if active_transfer is not None and key in active_transfer['loci']:
                    value=genome[key]
                elif mode=='sobol':
                    value=lo+float(sobol[j,k])*(hi-lo)
                elif mode=='local':
                    value=genome[key]+float(rng.normal(0,mutation_scale))*(hi-lo)
                else:
                    value=genome[key]
                    if key in ('spire_segmentation','join.enable',
                                'grammar.gallery','grammar.buttress'):
                        value=lo+(.8 if value < (lo+hi)/2 else .2)*(hi-lo)
                    elif k==(j//3)%len(focus):
                        value+=(.22 if generation%2 else -.22)*(hi-lo)
                genome[key]=float(np.clip(value,lo,hi))
            brood.append(Proposal(
                id=f'{family}-{generation:03d}-{j+1:03d}',
                emitter=f'family:{family}:{mode}',genome=genome,parent=parent_id,
                ancestry={'entity':FAMILY_ENTITIES[family],
                    'family':family,
                    'component_parent':primary['id'] if primary else 'original-seed',
                    'collaborators':collaborators,
                    'generation':generation,'mode':mode,
                    'transfer':dict(active_transfer) if active_transfer else None,
                    'interaction_pairs':interactions[:8]}))
    return brood
