"""Reproducible multi-lineage geometry search with photometric refinement."""
from dataclasses import dataclass, replace
from pathlib import Path
import importlib.util
import json
import math
import time
import numpy as np
from scipy.stats import qmc
from .geometry import Mesh
from .geometry_seed import DEFORMATION_BOUNDS, IDENTITY, imported_geometry, seeded_builder
from .cameras import Camera
from .render import silhouette,export_controls,light_vector
from .fitness import Objective,Target,PhotoReference
from .topology import assembly_contacts,mask_components


@dataclass
class Project:
    path: Path
    rig_path: Path
    builder: object
    bounds: dict
    initial: dict
    cameras: dict
    target_specs: list
    photograph: dict | None
    settings: dict
    geometry_source: str | None = None

    @classmethod
    def load(cls, path):
        path=Path(path).resolve()
        config=json.loads(path.read_text())
        if config.get('schema')!='projection-loom/project/v1':
            raise ValueError('Unrecognized project schema')
        if bool(config.get('builder')) == bool(config.get('geometry')):
            raise ValueError('A project needs exactly one of builder or geometry')
        settings=config.get('settings',{})
        if config.get('geometry'):
            source_path=(path.parent/config['geometry']).resolve()
            source=imported_geometry(source_path)
            builder=seeded_builder(source)
            rig_path=source_path
            bounds={str(k):tuple(map(float,v)) for k,v in
                    config.get('bounds',DEFORMATION_BOUNDS).items()}
            unknown=set(bounds)-set(DEFORMATION_BOUNDS)
            if unknown:
                raise ValueError(f'Unknown geometry deformation parameters: {sorted(unknown)}')
            initial={k:float(config.get('initial',{}).get(k,IDENTITY[k])) for k in bounds}
            geometry_source=str(source_path)
        else:
            module_file,qualname=config['builder'].split(':',1)
            rig_path=(path.parent/module_file).resolve()
            spec=importlib.util.spec_from_file_location('_projection_loom_rig',rig_path)
            if spec is None or spec.loader is None:
                raise ImportError(f'Cannot import builder: {rig_path}')
            module=importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            builder=getattr(module,qualname)
            bounds={str(k):tuple(map(float,v)) for k,v in config['bounds'].items()}
            initial={k:float(config['initial'][k]) for k in bounds}
            geometry_source=None
        for name,(lo,hi) in bounds.items():
            if not np.isfinite(lo+hi) or lo>=hi:
                raise ValueError(f'Invalid bounds for {name}')
        if not bounds:
            raise ValueError('Evolution requires at least one bounded parameter')
        for k,v in initial.items():
            if not bounds[k][0]<=v<=bounds[k][1]:
                raise ValueError(f'Initial {k} outside bounds')
        cameras={name:Camera.from_dict(values) for name,values in config['cameras'].items()}
        if not cameras:raise ValueError('At least one camera is required')
        return cls(path,rig_path,builder,bounds,initial,cameras,
                   config.get('targets',[]),config.get('photograph'),settings,geometry_source)

    def with_geometry_seed(self, path):
        """Evolve this existing mesh with a subject-neutral deformation rig."""
        source=imported_geometry(path)
        return replace(self, rig_path=Path(path).resolve(), builder=seeded_builder(source),
                       bounds=dict(DEFORMATION_BOUNDS),initial=dict(IDENTITY),
                       geometry_source=str(Path(path).resolve()))

    def build(self,params):
        result=self.builder(dict(params),int(self.settings.get('detail_level',1)))
        if hasattr(result,'mesh') and not isinstance(result,Mesh):
            result=result.mesh()
        if not isinstance(result,Mesh):
            raise TypeError('Builder must return a projection_loom.Mesh or Assembly')
        return result

    def targets(self,extra=(),size=(256,384)):
        specs=list(self.target_specs)
        for item in extra:
            if isinstance(item, dict):
                specs.append(dict(item))
            else:
                if '=' not in item: raise ValueError('Target must be VIEW=PATH')
                view,path=item.split('=',1)
                specs.append({'view':view,'path':path,'channel':'auto','weight':1.0})
        for spec in specs:
            if spec['view'] not in self.cameras:
                raise ValueError(f'Unknown camera in target: {spec["view"]}')
        return [Target.read(spec,self.path.parent,size=size) for spec in specs]

    def photo_reference(self,size=(256,384)):
        if not self.photograph:return None,None
        p=Path(self.photograph['path'])
        if not p.is_absolute():p=self.path.parent/p
        angles=self.photograph.get('light_angles',[-80,45])
        return PhotoReference(p,size),light_vector(*angles)


def parameters_from_file(path,defaults):
    if path is None:return dict(defaults)
    path=Path(path)
    if path.suffix=='.npz':
        with np.load(path,allow_pickle=False) as arrays:
            if 'parameters_json' not in arrays:
                raise ValueError('A mesh needs parameters_json to act as an evolutionary seed')
            src=json.loads(str(arrays['parameters_json'].item()))
    else:
        src=json.loads(path.read_text())
        src=src.get('parameters',src.get('winner',src))
    if not isinstance(src,dict):raise ValueError('Seed must be a parameter map')
    return {k:float(src.get(k,defaults[k])) for k in defaults}


class Search:
    def __init__(self,project,targets,photo=None,light=None,resolution=(256,384),rng_seed=4811):
        self.project=project
        self.names=list(project.bounds)
        self.lows=np.array([project.bounds[k][0] for k in self.names])
        self.highs=np.array([project.bounds[k][1] for k in self.names])
        self.spans=self.highs-self.lows
        self.rng=np.random.default_rng(rng_seed)
        self.targets=targets
        self.reference=dict(project.initial)
        self.objective=Objective(project.build,project.bounds,self.reference,targets,
                                 project.cameras,resolution,light,photo,
                                 project.settings.get('objective_weights'))
        self.records=[]

    def vector(self,parameters):
        return np.array([parameters[k] for k in self.names],dtype=float)

    def parameters(self,vector):
        return {name:float(value) for name,value in zip(self.names,self.clip(vector))}

    def clip(self,vector):
        return np.clip(np.asarray(vector,dtype=float),self.lows,self.highs)

    def rank(self,vector,lit=False,cycle=0,stage='explore',stability=None):
        params=self.parameters(vector)
        value,metrics,_model=self.objective(params,include_light=lit)
        stabilizer=0.
        if stability:
            for name,(reference,weight) in stability.items():
                candidate=silhouette(self.project.build(params),self.project.cameras[name],reference.shape[::-1])>96
                overlap=(candidate&reference).sum()/max(1,(candidate|reference).sum())
                stabilizer+=weight*(1-overlap)
        record={'cycle':int(cycle),'stage':stage,'loss':float(value),
                'selection_loss':float(value+stabilizer),'parameters':params,
                'metrics':metrics}
        self.records.append(record)
        return record

    def sobol(self,seed,count):
        exponent=max(1,int(math.ceil(math.log2(count))))
        grid=qmc.Sobol(len(self.names),scramble=True,seed=int(self.rng.integers(1,2**30)))
        samples=qmc.scale(grid.random_base2(exponent),self.lows,self.highs)
        anchor=self.vector(seed)
        halfway=.35*anchor+.65*samples
        return np.vstack((anchor,halfway))

    def choose(self,records,count,separation=.045):
        selected=[]
        for row in sorted(records,key=lambda item:item['selection_loss']):
            vec=self.vector(row['parameters'])
            if all(np.linalg.norm((vec-self.vector(other['parameters']))/self.spans)/np.sqrt(len(self.names))
                   >=separation for other in selected):
                selected.append(row)
            if len(selected)>=count:break
        return selected

    def mutate(self,survivors,sigmas,offspring,cycle,stage,lit=False,stability=None):
        offspring=int(offspring)
        for j,sigma in enumerate(sigmas):
            generation=[]
            for parent in survivors:
                seed=self.vector(parent['parameters'])
                generation.append(self.rank(seed,lit,cycle,stage+f'-{j}',stability))
                for _ in range(offspring):
                    candidate=self.clip(seed+self.rng.normal(size=len(self.names))*self.spans*float(sigma))
                    generation.append(self.rank(candidate,lit,cycle,stage+f'-{j}',stability))
            survivors=self.choose(generation,len(survivors),separation=.02)
        return survivors

    def evolve(self,start=None,cycles=2,burst=32,survivors=6,offspring=6):
        current=dict(start or self.project.initial)
        baseline=self.rank(self.vector(current),bool(self.objective.photo),0,'baseline')
        all_cycles=[]
        for cycle in range(1,int(cycles)+1):
            population=self.sobol(current,burst)
            explored=[self.rank(v,False,cycle,'unlit-burst') for v in population]
            selected=self.choose(explored,max(2,int(survivors)))
            selected=self.mutate(selected,[.11,.065,.035],offspring,cycle,'unlit-lineage')
            finalists=self.choose(selected,max(1,(int(survivors)+1)//2))
            if self.objective.photo is not None:
                lit_roster=[self.rank(self.vector(t['parameters']),True,cycle,'lit-entry') for t in finalists]
                lit_roster=self.mutate(lit_roster,[.055,.028],max(2,offspring//2),cycle,'lit-lineage',lit=True)
                candidate=min(lit_roster,key=lambda t:t['selection_loss'])
            else:
                candidate=min(finalists,key=lambda t:t['selection_loss'])
            base_candidate=self.rank(self.vector(candidate['parameters']),bool(self.objective.photo),cycle,'candidate')
            base_current=self.rank(self.vector(current),bool(self.objective.photo),cycle,'incumbent')
            if base_candidate['loss']<base_current['loss']:
                current=dict(base_candidate['parameters'])
            # Generated feedback controls local drift; acceptance still uses unchanged evidence.
            stabilizers={}
            model=self.project.build(current)
            for name in self.project.settings.get('stability_views',[]):
                if name not in self.project.cameras:raise ValueError('Unknown stability camera '+name)
                mask=silhouette(model,self.project.cameras[name],self.objective.size)>96
                stabilizers[name]=(mask,float(self.project.settings.get('stability_weight',.012)))
            incumbent=self.rank(self.vector(current),bool(self.objective.photo),cycle,'stability-incumbent',stabilizers)
            refined=self.mutate([incumbent],[.017],max(2,offspring//2),cycle,'stabilization',
                                lit=bool(self.objective.photo),stability=stabilizers)
            trial=self.rank(self.vector(min(refined,key=lambda t:t['selection_loss'])['parameters']),
                            bool(self.objective.photo),cycle,'stability-candidate')
            reference_score=self.rank(self.vector(current),bool(self.objective.photo),cycle,'stability-reference')
            if trial['loss']<reference_score['loss']:
                current=dict(trial['parameters'])
            all_cycles.append({'cycle':cycle,'best_loss':self.rank(self.vector(current),
                               bool(self.objective.photo),cycle,'cycle-complete')['loss'],
                               'parameters':dict(current)})
        final=self.rank(self.vector(current),bool(self.objective.photo),int(cycles),'final')
        return {'parameters':current,'score':final,'cycles':all_cycles,'baseline_loss':baseline['loss'],
                'evaluations':self.objective.calls,'records':self.records}


def produce(project_path,out,seed=None,feedback=(),cycles=2,burst=32,survivors=6,offspring=6,
            resolution=(256,384),export_size=(1024,1536),rng_seed=4811,seed_geometry=None):
    start=time.monotonic()
    if seed is not None and seed_geometry is not None:
        raise ValueError('Use --seed for parametric restart or --seed-geometry for mesh deformation')
    project=Project.load(project_path)
    if seed_geometry is not None:
        project=project.with_geometry_seed(seed_geometry)
    targets=project.targets(feedback,size=resolution)
    if not targets:raise ValueError('Evolution requires at least one silhouette target')
    photo,light=project.photo_reference(size=resolution)
    search=Search(project,targets,photo,light,resolution,rng_seed)
    initial=parameters_from_file(seed,project.initial)
    report=search.evolve(initial,cycles,burst,survivors,offspring)
    output=Path(out);output.mkdir(parents=True,exist_ok=True)
    model=project.build(report['parameters'])
    model.save(output/'mesh.npz',report['parameters'])
    model.export_obj(output/'mesh.obj')
    control_files=export_controls(model,project.cameras,output/'controls',export_size,light,
                                  project.settings.get('render'))
    summary={'schema':'projection-loom/run/v1',
             'geometry_source':project.geometry_source,
             'rig_source':str(project.rig_path),
             'geometry_mode':'deformation' if project.geometry_source else 'parametric',
             'parameters':report['parameters'],
             'baseline_loss':report['baseline_loss'],'final_loss':report['score']['loss'],
             'evaluations':report['evaluations'],'cycles':report['cycles'],
             'elapsed_seconds':round(time.monotonic()-start,2),
             'contacts':assembly_contacts(model),'outputs':control_files,
             'projection_connectivity':{v:mask_components(silhouette(model,camera,resolution)>96)
                                        for v,camera in project.cameras.items()}}
    (output/'manifest.json').write_text(json.dumps(summary,indent=2))
    (output/'search.json').write_text(json.dumps(report['records'],indent=2))
    return summary
