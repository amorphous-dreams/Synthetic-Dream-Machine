"""Source-bound search policies; no authority to run phases or certify geometry."""
from __future__ import annotations
from collections import Counter
import math
import numpy as np

FAMILY_REGIONS = {
    'needle':(3,4,5), 'fractured':(3,4,5), 'crystal':(3,4,5),
    'terraces':(1,2,3,4), 'crown':(0,1,2), 'keep':(0,1,2),
}

def regional_loss(source, candidate, family, *, attention=None):
    """Small regional feedback term; fixed artwork view, not surveyed component evidence."""
    if family not in FAMILY_REGIONS:
        raise ValueError('Unknown architectural family')
    a,b=np.asarray(source),np.asarray(candidate)
    if a.dtype!=np.dtype('bool') or b.dtype!=np.dtype('bool') or a.shape!=b.shape or a.ndim!=2:
        raise ValueError('Regional loss needs matching binary source-view masks')
    bands=np.array_split(np.arange(a.shape[0]),6)
    if attention is not None:
        region=np.asarray(attention)
        if region.dtype!=np.dtype('bool') or region.shape!=a.shape or not region.any():
            raise ValueError('Feature attention needs a nonempty matching binary mask')
        x,y=a[region],b[region]
    else:
        rows=np.concatenate([bands[n] for n in FAMILY_REGIONS[family]])
        x,y=a[rows],b[rows]
    u=np.logical_or(x,y).sum()
    return float(.04*(1-float(np.logical_and(x,y).sum()/u))) if u else 0.

def pareto_front(rows):
    """Keep nondominated audited observations; hard native gates happen upstream."""
    rows=list(rows)
    if not rows:return []
    # Family-local regional penalties describe DIFFERENT source-image bands.
    # They are meaningful only within the same family, never as cross-family
    # coordinates of a supposedly global Pareto front.
    comparable={'silhouette','prior','macro','contour'}
    shared=[frozenset(r.get('losses',{})) & comparable for r in rows]
    if any(axis != shared[0] for axis in shared[1:]):
        raise ValueError('Pareto requires consistent measured objective axes')
    keys=sorted(shared[0])
    def vector(r):
        return tuple(float(r['losses'][k]) for k in keys) if keys else (float(r['combined_loss']),)
    observations=[(r,vector(r)) for r in rows]
    if any(not all(math.isfinite(x) and x>=0 for x in v) for _,v in observations):
        raise ValueError('Pareto observations need nonnegative finite losses')
    return sorted((r for r,v in observations if not any(
        o is not r and all(x<=y for x,y in zip(w,v)) and any(x<y for x,y in zip(w,v))
        for o,w in observations)),key=lambda r:(r['combined_loss'],r['id']))

def diversity_parents(rows,limit,*,specialist=False):
    """Retain the global champion, niche specialists, Pareto survivors, other masks."""
    if type(limit) is not int or not 1<=limit<=20:
        raise ValueError('Parent limit must lie in 1..20')
    rows=list(rows)
    if not rows:return []
    ranked=sorted(rows,key=lambda r:(r.get('specialist_loss',r['combined_loss'])
          if specialist else r['combined_loss'],r['combined_loss'],r['id']))
    # A local specialist with the SAME exact mask must not displace the
    # genuinely best whole-location genome before the global champion is
    # retained. Other masks still compete by local specialist score.
    champion=min(rows,key=lambda r:(r['combined_loss'],r['id']))
    unique={champion['mask_sha256']:champion}
    for row in ranked:unique.setdefault(row['mask_sha256'],row)
    candidates=list(unique.values())
    selected=[champion]
    def add(row):
        if row['mask_sha256'] not in {v['mask_sha256'] for v in selected}:
            selected.append(row)
    for row in candidates:
        if len(selected)>=limit:break
        if row['niche'] not in {v['niche'] for v in selected}:add(row)
    for row in pareto_front(candidates):
        if len(selected)>=limit:break
        add(row)
    for row in candidates:
        if len(selected)>=limit:break
        add(row)
    return selected[:limit]

class SurrogatePreview:
    """Uncertainty/novelty-aware *ordering* only. No model may waive an exact audit."""
    def __init__(self,bounds,archive,*,min_samples=None,before_generation=None,
                 activation_loci=()):
        self.keys=list(bounds)
        activation_loci=tuple(activation_loci)
        if len(set(activation_loci))!=len(activation_loci) or any(
                k not in bounds for k in activation_loci):
            raise ValueError('Activation loci must be distinct declared genome keys')
        self.activation_indices=tuple(self.keys.index(k) for k in activation_loci)
        # A dozen scores in a 29-locus grammar cannot validate a global
        # predictor. Only use model-based ordering after a conservative
        # observations-per-dimension floor; earlier epochs still explore by
        # measured genome novelty, never by fabricated predicted fitness.
        if min_samples is None:
            min_samples=max(12,2*(len(self.keys)+1))
        if type(min_samples) is not int or min_samples<1:
            raise ValueError('Surrogate sample floor must be a positive integer')
        self.min_samples=min_samples
        self.low=np.array([bounds[k][0] for k in self.keys],dtype=float)
        self.spread=np.array([bounds[k][1]-bounds[k][0] for k in self.keys],dtype=float)
        if np.any(self.spread<=0):raise ValueError('Invalid surrogate bounds')
        rows=sorted((r for r in archive.data['members'].values()
            if before_generation is None or int(r['id'].split('/')[0])<before_generation),
            key=lambda r:r['id']) if archive else []
        self.x=np.array([[r['genome'][k] for k in self.keys] for r in rows],dtype=float).reshape((-1,len(self.keys)))
        self.x=(self.x-self.low)/self.spread
        self.y=np.array([r['losses']['silhouette'] for r in rows],dtype=float)
        self.ready=len(rows)>=min_samples
    def predict(self,genome):
        x=(np.array([genome[k] for k in self.keys],dtype=float)-self.low)/self.spread
        if not np.isfinite(x).all():raise ValueError('Invalid candidate vector')
        if not len(self.y):
            return {'predicted_loss':None,'novelty':1.,'neighbors':0}
        # Do not extrapolate measured inactive-topology fitness onto newly
        # activated geometry. Preserve new structural branches as high-
        # uncertainty exploration until their own native scores exist.
        cohort=np.ones(len(self.y),dtype=bool)
        for index in self.activation_indices:
            cohort &= (self.x[:,index]>=.5)==(x[index]>=.5)
        if not cohort.any():
            return {'predicted_loss':None,'novelty':1.,'neighbors':0}
        members=self.x[cohort]
        losses=self.y[cohort]
        dist=np.sqrt(np.mean((members-x)**2,axis=1))
        nearest=np.argsort(dist,kind='stable')[:min(5,len(dist))]
        weights=1/np.maximum(dist[nearest],.015)
        value=float(np.dot(weights,losses[nearest])/weights.sum())
        return {'predicted_loss':value if len(losses)>=self.min_samples else None,
                'novelty':float(dist.min()),'neighbors':len(nearest)}
    def priority(self,genome):
        result=self.predict(genome)
        # Reserve family/method seats in the evaluator, independent of prediction.
        if result['predicted_loss'] is None:return -min(.5,result['novelty'])
        return result['predicted_loss']-.06*min(.5,result['novelty'])

def searchability_census(bounds,archive,*,family_focus,activations=()):
    """Distinguish syntactically reachable loci from actual observed variation."""
    declared=set(bounds)
    reachable=declared & set().union(*(set(f) for f in family_focus.values()))
    rows=list(archive.data['members'].values()) if archive is not None else []
    observed={}
    for key in sorted(declared):
        v=sorted({float(r['genome'][key]) for r in rows})
        observed[key]={'unique_observed':len(v),'range':[v[0],v[-1]] if v else None}
    return {'schema':'projection-loom/searchability-census',
        'declared_loci':len(declared),'reachable_loci':len(reachable),
        'unreachable_loci':sorted(declared-reachable),
        'observed_constant_loci':sorted(k for k,v in observed.items() if v['unique_observed']==1),
        'activation_loci':{k:{'threshold':.5,'active':sum(r['genome'][k]>=.5 for r in rows),
                           'inactive':sum(r['genome'][k]<.5 for r in rows)} for k in activations if k in declared},
        'scored_members':len(rows),'unique_masks':len({r['mask_sha256'] for r in rows}),
        'niches':len({r['niche'] for r in rows}),
        'families':{f:{'scored':sum(r['family']==f for r in rows),
            'unique_masks':len({r['mask_sha256'] for r in rows if r['family']==f})} for f in family_focus},
        'observed':observed}


def emitter_performance(archive,*,before_generation=None):
    """Measured quality/diversity gain per family/method; never native validity."""
    if archive is None:
        return {}
    rows=sorted((r for r in archive.data['members'].values()
                 if before_generation is None or int(r['id'].split('/')[0])<before_generation),
                key=lambda x:x['id'])
    best={}
    seen=set()
    score={}
    for row in rows:
        key=row['emitter']
        state=score.setdefault(key,{'scored':0,'new_masks':0,'improvements':0,
                                    'best_loss':None})
        state['scored']+=1
        if row['mask_sha256'] not in seen:
            state['new_masks']+=1
            seen.add(row['mask_sha256'])
        previous=best.get(row['family'])
        if previous is None or row['combined_loss']<previous:
            state['improvements']+=1
            best[row['family']]=row['combined_loss']
        state['best_loss']=row['combined_loss'] if state['best_loss'] is None else min(
            state['best_loss'],row['combined_loss'])
    for key,row in score.items():
        n=row['scored']
        row['exploration_value']=(row['new_masks']+row['improvements'])/max(1,n)
    return score


def adaptive_priorities(proposals, archive, *, before_generation=None):
    """Bounded secondary ordering, preserving mandatory emitter reservations.

    Smaller score means earlier audition *within a reserved method/priority
    stratum*. No unseen candidate is marked invalid; under-tested methods
    receive optimistic uncertainty credit.
    """
    performance=emitter_performance(archive,before_generation=before_generation)
    all_seen=sum(x['scored'] for x in performance.values())
    value={}
    for proposal in proposals:
        state=performance.get(proposal.emitter)
        if state is None:
            value[proposal.id]=-.2
        else:
            n=state['scored']
            reward=state['exploration_value']
            confidence=(2*math.log(all_seen+2)/max(1,n))**.5
            value[proposal.id]=-min(1.,reward+.15*confidence)
    return value


def multiscale_source_loss(source,candidate):
    """Image-level macro/micro observations, not registration or native CAD proof."""
    from scipy.ndimage import binary_erosion, distance_transform_edt
    a,b=np.asarray(source),np.asarray(candidate)
    if a.dtype!=np.dtype('bool') or b.dtype!=np.dtype('bool') or a.shape!=b.shape or a.ndim!=2:
        raise ValueError('Multiscale losses need equal boolean masks')
    # Occupancy pooling suppresses image-scale aliasing while retaining major
    # architectural masses. Do not interpret this as a source-authentic view.
    def pool(mask,factor):
        h,w=mask.shape
        return np.array([[mask[i:min(i+factor,h),j:min(j+factor,w)].any()
            for j in range(0,w,factor)] for i in range(0,h,factor)],dtype=bool)
    levels=[]
    for factor in (2,4,8):
        x,y=pool(a,factor),pool(b,factor)
        union=np.logical_or(x,y).sum()
        levels.append(1-float(np.logical_and(x,y).sum()/union) if union else 0.)
    edge_a=np.logical_xor(a,binary_erosion(a))
    edge_b=np.logical_xor(b,binary_erosion(b))
    if not edge_a.any() and not edge_b.any():
        contour=0.
    elif not edge_a.any() or not edge_b.any():
        contour=1.
    else:
        da=np.minimum(distance_transform_edt(~edge_a),8.)
        db=np.minimum(distance_transform_edt(~edge_b),8.)
        contour=.5*(float(np.mean(db[edge_a]))+float(np.mean(da[edge_b])))/8.
    return {'macro':float(.04*np.mean(levels)),
            'contour':float(.025*contour)}

def infer_locus_interactions(bounds,archive,*,before_generation=None,
                             min_samples=24,threshold=.25,max_pairs=24):
    """Observational residual associations, never causal gene interaction claims.

    Fit a baseline additive linear least-squares model, then rank product-term
    association with held residuals. Only stored scored native-admitted rows
    enter; generation cutoffs keep scheduling deterministic on replay.
    """
    keys=sorted(bounds)
    rows=sorted((r for r in archive.data['members'].values()
        if before_generation is None or int(r['id'].split('/')[0])<before_generation),
        key=lambda r:r['id']) if archive else []
    # A least-squares model with more parameters than observations can
    # interpolate the losses perfectly: its residuals then provide no usable
    # interaction evidence. Require meaningful residual degrees of freedom.
    if type(min_samples) is not int or min_samples<2:
        raise ValueError('Interaction sample floor must be a positive integer')
    if len(rows)<max(min_samples,2*(len(keys)+1)) or len(keys)<2:return []
    data=np.array([[(r['genome'][k]-bounds[k][0])/(bounds[k][1]-bounds[k][0])
                    for k in keys] for r in rows],dtype=float)
    y=np.array([r['losses']['silhouette'] for r in rows],dtype=float)
    if not np.isfinite(data).all() or not np.isfinite(y).all():
        raise ValueError('Interaction data must be finite')
    x=data-data.mean(axis=0)
    target=y-y.mean()
    baseline=np.column_stack([np.ones(len(rows)),x])
    if np.linalg.matrix_rank(baseline)<len(keys)+1:
        return []
    coefficients=np.linalg.lstsq(baseline,target,rcond=None)[0]
    residual=target-baseline@coefficients
    observed=[]
    for i in range(len(keys)):
        for j in range(i+1,len(keys)):
            v=x[:,i]*x[:,j]
            # Remove additive projections from the interaction feature.
            v=v-baseline@np.linalg.lstsq(baseline,v,rcond=None)[0]
            den=float(np.linalg.norm(v)*np.linalg.norm(residual))
            effect=abs(float(v@residual)/den) if den>1e-12 else 0.
            if effect>=threshold:
                observed.append({'a':keys[i],'b':keys[j],
                    'strength':round(effect,9),'samples':len(rows),
                    'evidence':'observational-association'})
    return sorted(observed,key=lambda item:(-item['strength'],item['a'],item['b']))[:max_pairs]

def adaptive_foci(family_focus, interactions, *, max_extra=2):
    """Expand each family with bounded implicated partners; keep original loci."""
    if type(max_extra) is not int or max_extra<0 or max_extra>8:
        raise ValueError('Invalid interaction expansion budget')
    results={}
    for family, focus in family_focus.items():
        ordered=list(dict.fromkeys(focus))
        additions=0
        for item in interactions:
            a,b=item['a'],item['b']
            if additions>=max_extra:break
            if (a in ordered) != (b in ordered):
                other=b if a in ordered else a
                if other not in ordered:
                    ordered.append(other); additions+=1
        results[family]=tuple(ordered)
    return results
