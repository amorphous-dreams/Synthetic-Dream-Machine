"""Reproducible breeding archive and phenotype observations beneath the OODA-HA helm.

This module never runs a phase, approves an operator control, or certifies
native geometry. Only *scored* CAD-gated candidates reach its reproductive
archive. Rejected and deferred candidates remain counted in generation receipts.
"""
from __future__ import annotations

import copy
import math
import re
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


def _scored_observation(result):
    """Check native admission before an epoch can influence reproduction.

    Source-view scores are provisional unless independently certified; a
    convincing loss without a complete native gate is not lineage evidence.
    """
    audit=result.get('audit')
    if (not isinstance(audit,dict) or audit.get('valid') is not True
            or audit.get('union_valid') is not True
            or type(audit.get('union_solids')) is not int
            or audit['union_solids'] != 1):
        raise ValueError('Scored lineage requires a valid single-solid native CAD/void audit')
    losses=result.get('losses')
    if not isinstance(losses,dict) or not losses or any(
            isinstance(v,bool) or not isinstance(v,(int,float))
            or not math.isfinite(v) or v<0 for v in losses.values()):
        raise ValueError('Scored lineage requires finite nonnegative measured losses')
    combined=result.get('combined_loss')
    if (isinstance(combined,bool) or not isinstance(combined,(int,float))
            or not math.isfinite(combined) or combined<0):
        raise ValueError('Scored lineage combined loss must be finite and nonnegative')
    if not isinstance(result.get('witness_id'),str) or not result['witness_id'].strip():
        raise ValueError('Scored lineage requires a native source-bound witness')
    if result.get('evidence_state') not in ('provisional','synthetic','verified'):
        raise ValueError('Scored lineage requires an attributed evidence state')
    traits=result.get('phenotype')
    if not isinstance(traits,list) or not all(isinstance(v,str) for v in traits):
        raise ValueError('Scored lineage requires recorded visual mask and niche')
    masks=[v.split(':',1)[1] for v in traits if v.startswith('visual:')]
    niches=[v.split(':',1)[1] for v in traits if v.startswith('visual-niche:')]
    if (len(masks)!=1 or re.fullmatch('[0-9a-f]{64}',masks[0]) is None
            or len(niches)!=1 or not niches[0]):
        raise ValueError('Scored lineage requires one exact SHA-256 mask and measured niche')
    return masks[0],niches[0]


def _activation_thresholds(activations):
    """Only declared constructive switches become part of a durable funnel."""
    if isinstance(activations, dict):
        pairs = activations.items()
    else:
        pairs = ((name, .5) for name in activations)
    thresholds = {}
    for name, threshold in pairs:
        if (not isinstance(name, str) or not name
                or isinstance(threshold, bool) or not isinstance(threshold, (int, float))
                or not math.isfinite(threshold) or not 0 < threshold < 1):
            raise ValueError('Activation funnel needs named finite thresholds in (0,1)')
        if name in thresholds:
            raise ValueError('Duplicate activation in source-bound funnel')
        thresholds[name] = float(threshold)
    return dict(sorted(thresholds.items()))


def _native_valid(result):
    audit = result.get('audit')
    return (isinstance(audit, dict) and audit.get('valid') is True
            and audit.get('union_valid') is True
            and type(audit.get('union_solids')) is int
            and audit['union_solids'] == 1)


def activation_funnel(proposals, results, activations=()):
    """Witness each topological switch through proposed -> audited -> scored.

    CAD rejection is evidence of *attempted* exploration, not a successful
    native descendant. Never infer feasibility from score or reachability.
    """
    thresholds = _activation_thresholds(activations)
    stages = ('proposed', 'exact_attempted', 'native_valid',
              'scored', 'audited', 'rejected', 'deferred', 'error')
    report = {
        key: {stage: {'active': 0, 'inactive': 0} for stage in stages}
        for key in thresholds
    }
    for ident, proposal in proposals.items():
        result = results[ident]
        state = result['state']
        for key, threshold in thresholds.items():
            genome = proposal.get('genome', {})
            value = genome.get(key)
            if (isinstance(value, bool) or not isinstance(value, (int, float))
                    or not math.isfinite(value)):
                raise ValueError(f'Missing or invalid activation locus {key}')
            side = 'active' if value >= threshold else 'inactive'
            report[key]['proposed'][side] += 1
            if state != 'deferred':
                report[key]['exact_attempted'][side] += 1
            if _native_valid(result):
                report[key]['native_valid'][side] += 1
            report[key][state][side] += 1
    return report


class LineageArchive:
    """One durable archive per *source-bound* breeding campaign.

    Assimilation is idempotent on the epoch's immutable source checkpoint.
    Epoch results are written by WideEpoch *before* this Archive. A crash
    after archive save but before OODA-HA Aftermath replays the exact receipt.
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

    def assimilate(self, generation, checkpoint, *, activations=()):
        """Assimilate complete native observations, exactly once per epoch."""
        if type(generation) is not int or generation < 1:
            raise ValueError('Generation must be a positive integer')
        if not isinstance(checkpoint, dict):
            raise ValueError('Epoch must provide a durable checkpoint dictionary')
        proposals = checkpoint.get('proposals', {})
        results = checkpoint.get('results', {})
        if set(results) != set(proposals):
            raise ValueError('A completed generation needs a result for every source proposal')
        # Admit no fictitious geometry: valid native audits must precede
        # reproductive scoring, while unsuccessfully audited topology remains
        # recorded as a separate, useful searchability observation.
        thresholds = _activation_thresholds(activations)
        funnel = activation_funnel(proposals, results, thresholds)
        for result in results.values():
            if result['state'] == 'audited' and not _native_valid(result):
                raise ValueError('Audited unscored member needs a native CAD/void witness')
        # Validate scored evidence BEFORE the checksum touches potentially
        # nonfinite JSON, and before any partial lineage mutation can occur.
        measured={}
        for proposal_id,result in results.items():
            if result.get('state')=='scored':
                measured[proposal_id]=_scored_observation(result)
        key = str(generation)
        # Bind replay to every admitted and refused state, not only the winners.
        checksum = _hash({'run_id':checkpoint['run_id'], 'proposals':proposals,
                          'results':results, 'activation_thresholds':thresholds})
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
            if family not in FAMILY_FOCUSES:
                raise ValueError('Scored breeding member has an unknown search family')
            mask_sha,niche=measured[proposal_id]
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
                   'mask_sha256': mask_sha, 'niche': niche,
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
                                         'run_id': checkpoint['run_id'],
                                         'activation_funnel':funnel}
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
        census = searchability_census(bounds,self,family_focus=FAMILY_FOCUSES,
                                     activations=activations)
        cumulative = {}
        for generation in sorted(self.data['generations'], key=int):
            observed = self.data['generations'][generation].get('activation_funnel', {})
            for locus, stages in observed.items():
                target = cumulative.setdefault(locus, {
                    stage: {'active':0, 'inactive':0} for stage in stages})
                for stage, sides in stages.items():
                    for side in ('active','inactive'):
                        target[stage][side] += sides[side]
        census['activation_funnel'] = cumulative
        return census


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
                    # Isolate one topology switch per proposal, not a
                    # bundle of correlated changes whose failing native CAD
                    # gate cannot be attributed to an individual capability.
                    discrete=tuple(k for k in focus if k in (
                        'spire_segmentation','join.enable',
                        'grammar.gallery','grammar.buttress'))
                    selected=(discrete[(generation + j//3) % len(discrete)]
                              if discrete else None)
                    if key==selected:
                        value=lo+(.8 if value < (lo+hi)/2 else .2)*(hi-lo)
                    elif selected is None and k==(j//3)%len(focus):
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
