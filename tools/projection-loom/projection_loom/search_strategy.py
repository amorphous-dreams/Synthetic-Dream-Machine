"""Source-bound search policies; no authority to run phases or certify geometry."""
from __future__ import annotations
from collections import Counter
import math
import numpy as np

FAMILY_REGIONS = {
    'needle':(3,4,5), 'fractured':(3,4,5), 'crystal':(3,4,5),
    'terraces':(1,2,3,4), 'crown':(0,1,2), 'keep':(0,1,2),
}

def regional_loss(source, candidate, family):
    """Small regional feedback term; fixed artwork view, not surveyed component evidence."""
    if family not in FAMILY_REGIONS:
        raise ValueError('Unknown architectural family')
    a,b=np.asarray(source),np.asarray(candidate)
    if a.dtype!=np.dtype('bool') or b.dtype!=np.dtype('bool') or a.shape!=b.shape or a.ndim!=2:
        raise ValueError('Regional loss needs matching binary source-view masks')
    bands=np.array_split(np.arange(a.shape[0]),6)
    rows=np.concatenate([bands[n] for n in FAMILY_REGIONS[family]])
    u=np.logical_or(a[rows],b[rows]).sum()
    return float(.04*(1-float(np.logical_and(a[rows],b[rows]).sum()/u))) if u else 0.

def pareto_front(rows):
    """Keep nondominated audited observations; hard native gates happen upstream."""
    rows=list(rows)
    if not rows:return []
    # Family-local regional penalties describe DIFFERENT source-image bands.
    # They are meaningful only within the same family, never as cross-family
    # coordinates of a supposedly global Pareto front.
    comparable={'silhouette','prior','macro','contour'}
    keys=sorted(set.intersection(*(set(r.get('losses',{})) for r in rows)) & comparable)
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
    ranked=sorted(rows,key=lambda r:(r.get('specialist_loss',r['combined_loss'])
          if specialist else r['combined_loss'],r['combined_loss'],r['id']))
    unique={}
    for row in ranked:unique.setdefault(row['mask_sha256'],row)
    candidates=list(unique.values())
    if not candidates:return []
    selected=[min(candidates,key=lambda r:(r['combined_loss'],r['id']))]
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
    def __init__(self,bounds,archive,*,min_samples=12):
        self.keys=list(bounds)
        self.low=np.array([bounds[k][0] for k in self.keys],dtype=float)
        self.spread=np.array([bounds[k][1]-bounds[k][0] for k in self.keys],dtype=float)
        if np.any(self.spread<=0):raise ValueError('Invalid surrogate bounds')
        rows=sorted(archive.data['members'].values(),key=lambda r:r['id']) if archive else []
        self.x=np.array([[r['genome'][k] for k in self.keys] for r in rows],dtype=float).reshape((-1,len(self.keys)))
        self.x=(self.x-self.low)/self.spread
        self.y=np.array([r['losses']['silhouette'] for r in rows],dtype=float)
        self.ready=len(rows)>=min_samples
    def predict(self,genome):
        x=(np.array([genome[k] for k in self.keys],dtype=float)-self.low)/self.spread
        if not np.isfinite(x).all():raise ValueError('Invalid candidate vector')
        if not len(self.y):return {'predicted_loss':None,'novelty':1.,'neighbors':0}
        dist=np.sqrt(np.mean((self.x-x)**2,axis=1))
        nearest=np.argsort(dist,kind='stable')[:min(5,len(dist))]
        weights=1/np.maximum(dist[nearest],.015)
        value=float(np.dot(weights,self.y[nearest])/weights.sum())
        return {'predicted_loss':value if self.ready else None,
                'novelty':float(dist.min()),'neighbors':len(nearest)}
    def priority(self,genome):
        result=self.predict(genome)
        # Reserve family/method seats in the evaluator, independent of prediction.
        if result['predicted_loss'] is None:return -min(.5,result['novelty'])
        return result['predicted_loss']-.06*min(.5,result['novelty'])

def searchability_census(bounds,archive,*,family_focus,activations=()):
    """Distinguish syntactically reachable loci from actual observed variation."""
    declared=set(bounds)
    reachable=set().union(*(set(f) for f in family_focus.values()))
    rows=list(archive.data['members'].values()) if archive is not None else []
    observed={}
    for key in sorted(declared):
        v=sorted({float(r['genome'][key]) for r in rows})
        observed[key]={'unique_observed':len(v),'range':[v[0],v[-1]] if v else None}
    return {'schema':'projection-loom/searchability-census/v1',
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


def emitter_performance(archive):
    """Measured quality/diversity gain per family/method; never native validity."""
    if archive is None:
        return {}
    rows=sorted(archive.data['members'].values(),key=lambda x:x['id'])
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


def adaptive_priorities(proposals, archive):
    """Bounded secondary ordering, preserving mandatory emitter reservations.

    Smaller score means earlier audition *within a reserved method/priority
    stratum*. No unseen candidate is marked invalid; under-tested methods
    receive optimistic uncertainty credit.
    """
    performance=emitter_performance(archive)
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
