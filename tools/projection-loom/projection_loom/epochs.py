"""Resumable, multi-method epochs with staged CAD admission and causal receipts.

A fast preview may *schedule* candidates, not certify or reject their geometry.
Only complete fused BRep and void audits admit scored models to the archive.
Missing evidence remains unavailable; provisional image registration never becomes
verified merely because an optimizer reproduces an image. Every local checkpoint
records its source, code and experiment identity and rejects incompatible reentry.
"""
from __future__ import annotations
from dataclasses import dataclass, asdict
from hashlib import sha256
import json
from pathlib import Path
import math
import os
import numpy as np
from scipy.stats import qmc

SCHEMA = 'projection-loom/wide-epoch/v1'


def _hash(value):
    return sha256(json.dumps(value,sort_keys=True,separators=(',',':'),
                             ensure_ascii=False,allow_nan=False).encode()).hexdigest()


def _atomic(path,value):
    target=Path(path)
    target.parent.mkdir(parents=True,exist_ok=True)
    tmp=target.with_suffix(target.suffix+'.pending')
    tmp.write_text(json.dumps(value,indent=2,ensure_ascii=False,allow_nan=False)+'\n')
    os.replace(tmp,target)


@dataclass(frozen=True)
class Proposal:
    id: str
    emitter: str
    genome: dict[str,float]
    parent: str | None = None

    def __post_init__(self):
        if not self.id or not self.emitter or not self.genome:
            raise ValueError('Proposal needs an id, generator, and genome')
        if any(not math.isfinite(float(x)) for x in self.genome.values()):
            raise ValueError('Genome must contain only finite loci')


def propose_methods(bounds,initial,*,seed=41,count=12,topology_loci=(),scale=.12):
    """Generate deterministic Sobol/local/topology candidates, no CAD claims.

    The caller provides the discrete threshold loci; names alone never tell the
    Loom what geometry a parameter controls. The local emitter is bounded.
    """
    if count<=0 or not math.isfinite(scale) or scale<=0:
        raise ValueError('Candidate count and mutation scale must be positive')
    keys=list(bounds)
    low=np.array([bounds[k][0] for k in keys],dtype=float)
    high=np.array([bounds[k][1] for k in keys],dtype=float)
    center=np.array([initial[k] for k in keys],dtype=float)
    if not np.isfinite(low).all() or not np.isfinite(high).all() or np.any(high<=low):
        raise ValueError('Invalid genome bounds')
    if np.any(center<low) or np.any(center>high):
        raise ValueError('Genome starts outside its declared bounds')
    if set(topology_loci)-set(keys):
        raise ValueError('Unknown topology activation locus')
    rng=np.random.default_rng(seed)
    pool=qmc.Sobol(len(keys),scramble=True,seed=seed).random_base2(max(1,int(np.ceil(np.log2(count)))))
    proposals=[]
    for i in range(count):
        mode=('sobol','local','topology')[i%3]
        if mode=='sobol':
            vec=low+pool[i]*(high-low)
        elif mode=='local':
            vec=np.clip(center+rng.normal(0,scale,len(keys))*(high-low),low,high)
        else:
            vec=center.copy()
            if topology_loci:
                key=topology_loci[(i//3)%len(topology_loci)]
                j=keys.index(key)
                threshold=(low[j]+high[j])/2
                vec[j]=np.clip(threshold+(high[j]-low[j])*(.02 if center[j]<threshold else -.02),low[j],high[j])
            else:
                vec=np.clip(center+rng.normal(0,scale,len(keys))*(high-low),low,high)
        proposals.append(Proposal(f'candidate-{i+1:04d}',mode,
                                  {k:float(v) for k,v in zip(keys,vec)},'seed'))
    return proposals


class WideEpoch:
    """Bounded constructive search, independent of any one scoring backend.

    `grow` returns a SolidAssembly, `score` returns a loss dict with every named
    objective present, and `preview` only orders which candidates receive costly
    checks. Each input evaluator must declare its epistemic status explicitly.
    """
    def __init__(self,*,location,source_digests,construction_digest,
                 objectives,score_state,checkpoint,max_exact,max_detail,seed=41,
                 pet_ledger=None,registration_receipt=None,reserve_emitter=True):
        if score_state not in ('synthetic','provisional','verified'):
            raise ValueError('Evidence status must be explicit')
        if score_state=='verified':
            if registration_receipt is None or registration_receipt.get('state')!='verified':
                raise ValueError('Verified scoring requires a verified control receipt')
            receipt_data=dict(registration_receipt)
            digest=receipt_data.pop('sha256',None)
            anchored=receipt_data.get('source_digests') or []
            if (digest!=_hash(receipt_data) or not anchored or
                not set(anchored).issubset(set(source_digests.values())) or
                receipt_data.get('holdout_count',0)<3 or
                receipt_data.get('holdout_max',float('inf'))>receipt_data.get('threshold_m',0)):
                raise ValueError('Registration receipt digest or survey provenance invalid')
        if max_exact<1 or max_detail<1 or max_detail>max_exact:
            raise ValueError('Invalid staged evaluation budgets')
        if not objectives or len(set(objectives))!=len(objectives):
            raise ValueError('Objective names must be unique and nonempty')
        self.objectives=tuple(objectives)
        self.score_state=score_state
        self.checkpoint=Path(checkpoint)
        self.max_exact=int(max_exact)
        self.max_detail=int(max_detail)
        self.pet_ledger=pet_ledger
        self.reserve_emitter=bool(reserve_emitter)
        self.identity={'schema':SCHEMA,'location':str(location),
                       'source_digests':dict(sorted(source_digests.items())),
                       'construction_digest':str(construction_digest),
                       'objectives':list(self.objectives),'score_state':score_state,
                       'max_exact':max_exact,'max_detail':max_detail,'seed':seed,
                       'registration_digest':registration_receipt.get('sha256') if registration_receipt else None,
                       'reserve_emitter':bool(reserve_emitter)}
        for value in self.identity['source_digests'].values():
            if not isinstance(value,str) or len(value)!=64:
                raise ValueError('Source records need content hashes')
        self.run_id=_hash(self.identity)
        if self.checkpoint.exists():
            self.data=json.loads(self.checkpoint.read_text())
            if self.data.get('identity')!=self.identity or self.data.get('run_id')!=self.run_id:
                raise ValueError('Incompatible epoch checkpoint; fork instead of overwriting')
            if self.data.get('snapshot_sha256')!=_hash({k:v for k,v in self.data.items() if k!='snapshot_sha256'}):
                raise ValueError('Epoch checkpoint digest mismatch')
        else:
            self.data={'identity':self.identity,'run_id':self.run_id,
                       'results':{},'archive':{},'attempts':[]}
            self._save()

    def _save(self):
        self.data['snapshot_sha256']=_hash({k:v for k,v in self.data.items() if k!='snapshot_sha256'})
        _atomic(self.checkpoint,self.data)

    def run(self,proposals,*,grow,score,preview=None,before_candidate=None,after_candidate=None,should_continue=None):
        proposals=list(proposals)
        if len({p.id for p in proposals})!=len(proposals):
            raise ValueError('Duplicate proposal ID')
        pmap={p.id:asdict(p) for p in proposals}
        existing=self.data.get('proposals')
        if existing is None:
            self.data['proposals']=pmap
            self._save()
        elif existing!=pmap:
            raise ValueError('Proposal set changed after epoch began')
        estimates=[]
        for p in proposals:
            estimate=0.0 if preview is None else float(preview(p.genome))
            if not math.isfinite(estimate):
                raise ValueError('Preview score must be finite')
            estimates.append((estimate,p.id,p))
        # When budget permits, every method retains a seat at the audition.
        # This is scheduling slack, never a structural or fitness waiver.
        ordered=sorted(estimates,key=lambda x:(x[0],x[1]))
        scheduled=[]
        if self.reserve_emitter:
            methods={p.emitter for _,_,p in estimates}
            if len(methods)<=self.max_exact:
                for method in sorted(methods):
                    scheduled.append(next(row for row in ordered if row[2].emitter==method))
        already={row[2].id for row in scheduled}
        for row in ordered:
            if len(scheduled)>=self.max_exact:break
            if row[2].id not in already:
                scheduled.append(row)
                already.add(row[2].id)
        selected={p.id for _,_,p in scheduled}
        for _,_,p in estimates:
            if p.id not in selected and p.id not in self.data['results']:
                self.data['results'][p.id]={'state':'deferred','reason':'exact-audit budget',
                                            'emitter':p.emitter,'parent':p.parent}
        detail_count=sum(r.get('state')=='scored' for r in self.data['results'].values())
        for _,_,p in scheduled:
            # Cooperative interruptions happen between completed candidate
            # evaluations, never mid-Boolean operation. Reentry uses the saved
            # candidate receipts and never repeats a completed CAD side effect.
            if should_continue is not None and not should_continue():
                self._save()
                return self.data
            previous=self.data['results'].get(p.id)
            if previous is not None and previous['state'] in ('scored','rejected','audited','error'):
                continue
            if before_candidate is not None:
                before_candidate(p)
            try:
                assembly=grow(p.genome)
                audit=assembly.audit(join=True)
                if not audit.get('valid',False) or audit.get('union_solids')!=1 or not audit.get('union_valid'):
                    result={'state':'rejected','reason':'CAD or void gate','audit':audit}
                elif detail_count>=self.max_detail:
                    result={'state':'audited','reason':'detail budget','audit':audit}
                else:
                    losses=score(p.genome,assembly)
                    if set(losses)!=set(self.objectives):
                        raise ValueError('Every scored model needs every declared loss')
                    losses={k:float(losses[k]) for k in self.objectives}
                    if any(not math.isfinite(v) or v<0 for v in losses.values()):
                        raise ValueError('Losses must be finite and nonnegative')
                    witness=assembly.relation_witness(location=self.identity['location'])
                    pet_loss=float(self.pet_ledger.soft_loss(witness)) if self.pet_ledger else 0.
                    if not math.isfinite(pet_loss) or pet_loss<0:
                        raise ValueError('Invalid pet-name preference')
                    combined=float(sum(losses.values())+pet_loss)
                    phenotype=sorted(witness.feature_set())
                    niche=_hash(phenotype)[:16]
                    result={'state':'scored','losses':losses,'pet_loss':pet_loss,
                            'combined_loss':combined,'niche':niche,'phenotype':phenotype,
                            'witness_id':witness.witness_id,'evidence_state':self.score_state,
                            'audit':audit}
                    old=self.data['archive'].get(niche)
                    if old is None or combined<old['combined_loss']:
                        self.data['archive'][niche]={'proposal_id':p.id,
                            'combined_loss':combined,'genome':dict(p.genome),
                            'losses':losses,'evidence_state':self.score_state,
                            'phenotype':phenotype}
                    detail_count+=1
            except Exception as exc:
                # A broken scoring backend is not evidence of a bad architectural
                # candidate. Keep operational failures apart from CAD rejection.
                result={'state':'error','reason':str(exc),'error_class':type(exc).__name__}
            result.update(emitter=p.emitter,parent=p.parent)
            self.data['results'][p.id]=result
            self.data['attempts'].append({'proposal_id':p.id,'state':result['state']})
            self._save()
            if after_candidate is not None:
                after_candidate(p,result)
        self._save()
        return self.data

    def completed(self, proposals, *, preview=None):
        """Check that the exact scheduled candidate set has durable results.

        Deferred candidates do not count as completed auditions. An evaluator
        error counts as a completed attempt, never as a valid geometry score.
        """
        estimates=[]
        for p in proposals:
            value=0. if preview is None else float(preview(p.genome))
            if not math.isfinite(value):raise ValueError('Preview score must be finite')
            estimates.append((value,p.id,p))
        ordered=sorted(estimates,key=lambda x:(x[0],x[1]))
        scheduled=[]
        if self.reserve_emitter:
            methods={p.emitter for _,_,p in estimates}
            if len(methods)<=self.max_exact:
                for method in sorted(methods):
                    scheduled.append(next(row for row in ordered if row[2].emitter==method))
        ids={row[2].id for row in scheduled}
        for row in ordered:
            if len(scheduled)>=self.max_exact:break
            if row[2].id not in ids:
                scheduled.append(row);ids.add(row[2].id)
        return all(self.data['results'].get(row[2].id,{}).get('state') in
                   ('scored','audited','rejected','error') for row in scheduled)


def project_silhouette_score(project,*,size=(96,144)):
    """A fixed-view single-source objective; return (score_fn, epistemic_state).

    A frozen unregistered artwork camera permits exploratory fitness only. A
    reference-free initial seed supplies a synthetic comparison, not survey data.
    """
    from .evolution import Evolution, iou
    from .render import silhouette
    evo=Evolution(project,size=size,seed=41)
    def measure(genome,assembly):
        mesh=assembly.tessellate(linear=.38,angular=.3,union=True)
        candidate=silhouette(mesh,evo.reference_camera,size)>96
        return {'silhouette':float(1-iou(evo.source,candidate))}
    return measure, 'provisional' if project.reference is not None else 'synthetic'


def project_code_digest(project):
    """Source identity of the active project and the construction/runtime modules."""
    root=Path(__file__).resolve().parent
    files=sorted(root.glob('*.py'))+[Path(project.file),Path(project.builder_file)]
    # Hash path roles and contents; adding a new engine module changes the
    # checkpoint identity even if the construction builder stayed unchanged.
    parts=[f.name.encode()+b'\0'+sha256(f.read_bytes()).digest() for f in files]
    return sha256(b''.join(parts)).hexdigest()


def run_project_epochs(project, output, *, passes=3, candidates=9,
                       exact_budget=6, detail_budget=3, seed=41,
                       topology_loci=(), ledger=None, location_stack=None):
    """Reenter fresh, fixed-view constructive epochs; keep distinct checkpoints.

    Each epoch regrows its CAD candidates from genomes. The unchanged external
    source (if present) remains the independent reference; no self-generated
    render becomes new ground truth. We never claim that a provisional camera
    underwent a survey-based calibration.
    """
    if passes<1 or candidates<1:
        raise ValueError('Pass and candidate budgets must be positive')
    from .pipeline import Project
    out=Path(output);out.mkdir(parents=True,exist_ok=True)
    measure,state=project_silhouette_score(project)
    source_hashes=({'image':sha256(project.reference.read_bytes()).hexdigest()}
                   if project.reference else {})
    if location_stack is not None:
        location_stack.audit()
        location_stack.verify_source_bytes()
        if location_stack.location_id!=project.location:
            raise ValueError('Project location and evidence location do not match')
        source_hashes.update({'location:'+k:source.sha256
                              for k,source in location_stack.sources.items()})
        source_hashes['location-snapshot']=location_stack.to_dict()['snapshot_sha256']
    root_genome=dict(project.initial)
    current=dict(root_genome)
    model_hash=project_code_digest(project)
    epochs=[]
    for epoch in range(passes):
        batch=propose_methods(project.bounds,current,seed=seed+epoch,
                              count=candidates,topology_loci=topology_loci)
        # A fixed baseline is a scheduling *heuristic*, not a structural gate.
        preview=lambda g:float(sum(((g[k]-root_genome[k])/(project.bounds[k][1]-project.bounds[k][0]))**2
                                   for k in project.bounds)/len(project.bounds))
        run=WideEpoch(location=project.location,source_digests=source_hashes,
                      construction_digest=model_hash,objectives=('silhouette',),
                      score_state=state,checkpoint=out/f'epoch_{epoch+1:03d}.json',
                      max_exact=exact_budget,max_detail=detail_budget,seed=seed+epoch,
                      pet_ledger=ledger)
        result=run.run(batch,grow=project.grow,score=measure,preview=preview)
        elites=sorted(result['archive'].values(),key=lambda item:(item['combined_loss'],
                             item['proposal_id']))
        if elites:
            current=dict(elites[0]['genome'])
        epochs.append({'epoch':epoch+1,'candidate_count':len(batch),
                       'cad_audits':sum(x['state'] in ('scored','audited','rejected')
                                        and x.get('audit') is not None for x in result['results'].values()),
                       'scored':sum(x['state']=='scored' for x in result['results'].values()),
                       'elite_count':len(elites),'parent_genome':dict(current),
                       'status':state,'receipt':str(run.checkpoint)})
    summary={'schema':'projection-loom/wide-epoch-summary/v1',
             'location':project.location,'source_digests':source_hashes,
             'construction_digest':model_hash,'passes':epochs,
             'selected_genome':current,'evidence_state':state}
    _atomic(out/'summary.json',summary)
    return summary
