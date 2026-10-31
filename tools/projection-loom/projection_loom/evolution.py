"""Structural-gated evolutionary growth of CAD-solid architectural genomes."""
from __future__ import annotations
import numpy as np
from scipy.stats import qmc
from PIL import Image
from .render import silhouette,buffers,light_vector


def iou(a,b):
    both=int((a&b).sum());either=int((a|b).sum())
    return both/max(either,1)


class Evolution:
    def __init__(self,project,size=(128,192),seed=63,*,ledger=None,slack_fraction=.20):
        self.project=project
        if ledger is not None and ledger.location != project.location:
            raise ValueError('Identity ledger location does not match project')
        if not 0 <= slack_fraction <= 0.5:
            raise ValueError('slack_fraction must lie between zero and one half')
        self.ledger=ledger
        self.slack_fraction=float(slack_fraction)
        self.phenotypes={}
        self.size=size
        self.rng=np.random.default_rng(seed)
        self.keys=list(project.bounds)
        self.low=np.array([project.bounds[k][0] for k in self.keys])
        self.high=np.array([project.bounds[k][1] for k in self.keys])
        self.spread=self.high-self.low
        from .calibration import ensure_fixed_evidence_camera, freeze_display_camera
        initial=project.grow().tessellate(linear=.32,union=True)
        self.fitness_cameras={}
        for name,cam in project.cameras.items():
            if cam.fit=='fixed':
                self.fitness_cameras[name]=cam
            else:
                self.fitness_cameras[name]=freeze_display_camera(cam,initial.vertices,size)
        self.reference_camera=self.fitness_cameras[project.reference_view]
        ensure_fixed_evidence_camera(self.reference_camera)
        if project.reference is not None:
            ensure_fixed_evidence_camera(project.cameras[project.reference_view])
        self.source=project.source_mask(size)
        if self.source is None:
            self.source=silhouette(initial,self.reference_camera,size)>96
        self.records=[]
        self.eval_count=0

    def as_vector(self,p):return np.array([p[k] for k in self.keys])
    def as_genome(self,x):return dict(zip(self.keys,[float(v) for v in np.clip(x,self.low,self.high)]))

    def evaluate(self,vec,lit=False,view_feedback=None):
        self.eval_count+=1
        genome=self.as_genome(vec)
        try:
            assembly=self.project.grow(genome)
            audit=assembly.audit(join=True)
            if not audit['valid']:
                loss=2.0+0.3*len(audit['failed'])
                self.records.append({'valid':False,'loss':loss,'genome':genome,'failed':len(audit['failed'])})
                return loss
            mesh=assembly.tessellate(linear=.35,angular=.30,union=True)
            mask=silhouette(mesh,self.reference_camera,self.size)>96
            shape_loss=1-iou(self.source,mask)
            # A weak, scale-free prior resists trivial fortress shrinkage.
            prior=np.mean(((np.asarray(vec)-self.as_vector(self.project.initial))/self.spread)**2)
            loss=shape_loss+.023*prior
            witness=assembly.relation_witness(location=self.project.location)
            traits=witness.feature_set()
            self.phenotypes[tuple(np.round(vec,12))]=traits
            pet_penalty=self.ledger.soft_loss(witness) if self.ledger is not None else 0.0
            loss+=pet_penalty
            if view_feedback:
                similarity=[]
                for name,reference in view_feedback.items():
                    if name in self.project.cameras:
                        now=silhouette(mesh,self.fitness_cameras[name],self.size)>96
                        similarity.append(iou(reference,now))
                if similarity:loss+=.035*(1-np.mean(similarity))
            if lit and self.project.reference and self.project.reference.suffix.lower()=='.png':
                # Lighting stays secondary to solid-contact validity and silhouette.
                buf=buffers(mesh,self.reference_camera,self.size)
                li=light_vector(*self.project.light_angles)
                predicted=(buf['normal']@li).clip(0,1)
                import cv2
                image=np.array(Image.open(self.project.reference).convert('RGB'))
                image=cv2.resize(image,self.size)
                target=cv2.GaussianBlur(image.astype(np.float32)@np.array([.2126,.7152,.0722]),(0,0),2)
                hit=mask & buf['occupancy']
                if hit.sum()>50:
                    a=predicted[hit];b=target[hit]
                    corr=np.corrcoef(a,b)[0,1] if a.std()>1e-6 and b.std()>1e-6 else 0.0
                    loss+=.025*(1-max(0,float(corr)))
            row={'valid':True,'loss':float(loss),'shape_iou':iou(self.source,mask),'genome':genome,'lit':lit,
                 'pet_name_soft_loss':pet_penalty,'phenotype':sorted(traits)}
        except Exception as exc:
            loss=5.0
            row={'valid':False,'loss':loss,'error':str(exc),'genome':genome,'lit':lit}
        self.records.append(row)
        return loss

    def burst(self,center,count):
        m=max(2,int(np.ceil(np.log2(count))))
        pts=qmc.Sobol(len(self.keys),scramble=True,seed=int(self.rng.integers(1,2**30))).random_base2(m)
        anchor=self.as_vector(center)
        return [anchor]+[np.clip(.30*anchor+.70*(self.low+pt*self.spread),self.low,self.high) for pt in pts]

    def select_with_slack(self, candidates, limit, separation):
        '''Reserve a survivor slot for a different construction phenotype if available.'''
        valid=sorted((item for item in candidates if item[0] < 2),key=lambda item:item[0])
        if limit <= 0 or not valid:return []
        reserve=min(limit-1,round(limit*self.slack_fraction))
        chosen=[]
        def fits(row):
            return all(np.linalg.norm((row[1]-c[1])/self.spread)>separation for c in chosen)
        # The main objective keeps at least one valid champion.
        for row in valid:
            if fits(row):chosen.append(row)
            if len(chosen)>=limit-reserve:break
        if reserve and chosen:
            represented=set().union(*(self.phenotypes.get(tuple(np.round(c[1],12)),frozenset()) for c in chosen))
            possibles=[]
            for row in valid:
                if any(np.array_equal(row[1],c[1]) for c in chosen) or not fits(row):continue
                features=self.phenotypes.get(tuple(np.round(row[1],12)),frozenset())
                novelty=len(features.symmetric_difference(represented))
                if novelty>0:possibles.append((novelty,row))
            for _,row in sorted(possibles,key=lambda x:(-x[0],x[1][0])):
                if fits(row):
                    chosen.append(row)
                    represented.update(self.phenotypes.get(tuple(np.round(row[1],12)),frozenset()))
                if len(chosen)>=limit:break
        for row in valid:
            if len(chosen)>=limit:break
            if fits(row):chosen.append(row)
        return chosen

    def evolve(self,start=None,*,burst=32,survivors=6,offspring=5,rounds=2,lit_rounds=1,feedback=None):
        begin=dict(start or self.project.initial)
        first=self.burst(begin,burst)
        population=[(self.evaluate(x,view_feedback=feedback),x) for x in first]
        population=sorted(population,key=lambda r:r[0])
        seeds=self.select_with_slack(population,survivors,.11)
        if not seeds:raise RuntimeError('No structurally valid lineage survived growth burst')
        for generation in range(rounds):
            sigma=[.13,.07,.035][min(generation,2)]
            children=[]
            for _,parent in seeds:
                children.append((self.evaluate(parent,view_feedback=feedback),parent))
                for _ in range(offspring):
                    vec=np.clip(parent+self.rng.normal(0,sigma,size=len(parent))*self.spread,self.low,self.high)
                    children.append((self.evaluate(vec,view_feedback=feedback),vec))
            seeds=self.select_with_slack(children,survivors,.06)
        if lit_rounds:
            for generation in range(lit_rounds):
                lit_candidates=[]
                for _,vec in seeds:
                    lit_candidates.append((self.evaluate(vec,lit=True,view_feedback=feedback),vec))
                    for _ in range(max(2,offspring//2)):
                        candidate=np.clip(vec+self.rng.normal(0,.035,size=len(vec))*self.spread,self.low,self.high)
                        lit_candidates.append((self.evaluate(candidate,lit=True,view_feedback=feedback),candidate))
                seeds=self.select_with_slack(lit_candidates,survivors,.035)
        chosen=self.select_with_slack(seeds,3,.04)
        return [{'loss':float(score),'genome':self.as_genome(vec),
                 'phenotype':sorted(self.phenotypes.get(tuple(np.round(vec,12)),frozenset()))}
                for score,vec in chosen]
