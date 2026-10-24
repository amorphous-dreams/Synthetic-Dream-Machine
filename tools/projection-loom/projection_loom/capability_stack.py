"""Evergreen per-entity capability composition and inheritable constructive recipes.

The recipe is a genome: it records operators, bounded parameters, dependencies,
source witnesses and semantic handles, not copied OBJ triangles or OpenCascade
face indexes. A capability may produce CAD, a sculptural mesh or a relation.
Each result carries only the authority granted by its own validation gate.
"""
from __future__ import annotations
from dataclasses import dataclass, asdict
from hashlib import sha256
import json
import math
from pathlib import Path
import re
import numpy as np
import trimesh
import cadquery as cq

from .hybrid import HybridLocation, derived_cad_surface, semantic_cad_point

SCHEMA='projection-loom/capability-recipe/v1'


def digest(obj):
    return sha256(json.dumps(obj,sort_keys=True,allow_nan=False,
                    ensure_ascii=False,separators=(',',':')).encode('utf-8')).hexdigest()


@dataclass(frozen=True)
class Capability:
    id: str
    entity: str
    operator: str
    depends_on: tuple[str,...]=()
    part: str | None=None
    layer: str | None=None
    activation: str | None=None
    params: tuple[tuple[str,str],...]=()
    socket: str | None=None
    role: str='sculptural'
    has: tuple[str,...]=()

    @classmethod
    def from_dict(cls,obj):
        allowed=set(cls.__dataclass_fields__)
        if set(obj)-allowed:raise ValueError(f'Unrecognized capability fields: {set(obj)-allowed}')
        return cls(**{**obj,
            'depends_on':tuple(obj.get('depends_on',())),
            'params':tuple(sorted((str(k),str(v)) for k,v in obj.get('params',{}).items())),
            'has':tuple(obj.get('has',()))})

    def to_dict(self):
        d=asdict(self)
        d['depends_on']=list(self.depends_on)
        d['params']=dict(self.params)
        d['has']=list(self.has)
        return d


class OperatorRegistry:
    """Explicit, trusted, versioned callbacks; no imports or code from recipe JSON."""
    def __init__(self):self._items={}

    def register(self,name,version,callback):
        if not re.fullmatch(r'[a-z][a-z0-9-]*',name) or not version or not callable(callback):
            raise ValueError('Trusted operators need a stable name, version, and callable')
        if name in self._items:raise ValueError('Duplicate operator')
        self._items[name]=(str(version),callback)

    def fingerprint(self):
        import inspect
        fingerprints={}
        for name,(version,callback) in sorted(self._items.items()):
            try:source=inspect.getsource(callback)
            except (OSError,TypeError):
                # Interactive plugin functions still participate in identity.
                source=callback.__code__.co_code.hex()+repr(callback.__code__.co_consts)
            fingerprints[name]={'version':version,'module':callback.__module__,
                               'implementation_sha256':sha256(source.encode()).hexdigest()}
        return digest(fingerprints)

    def invoke(self,name,context,step):
        if name not in self._items:raise ValueError(f'Untrusted capability operator {name}')
        return self._items[name][1](context,step)

    def knows(self,name):return name in self._items


class CapabilityRecipe:
    """Immutable plan + mutable, bounded numeric loci; one named location."""
    def __init__(self,*,location,pet_name,steps,bounds,initial,cad_keys,
                 source_hashes=None,version=1,provenance='provisional'):
        self.location=str(location)
        self.pet_name=pet_name
        self.steps=tuple(Capability.from_dict(x) if isinstance(x,dict) else x for x in steps)
        self.bounds={str(k):tuple(float(x) for x in v) for k,v in bounds.items()}
        self.initial={str(k):float(v) for k,v in initial.items()}
        self.cad_keys=tuple(cad_keys)
        self.source_hashes=dict(source_hashes or {})
        self.version=int(version)
        self.provenance=provenance
        self._validate()

    @classmethod
    def load(cls,path):
        data=json.loads(Path(path).read_text(encoding='utf8'))
        if data.pop('schema',None)!=SCHEMA:raise ValueError('Unknown capability recipe schema')
        expected=data.pop('sha256',None)
        obj=cls(**data)
        if expected!=obj.sha256:raise ValueError('Recipe digest mismatch')
        return obj

    def _validate(self):
        if not self.location or not self.steps or self.version<1 or self.provenance not in ('synthetic','provisional','verified'):
            raise ValueError('Recipe requires location, capabilities and explicit evidence status')
        if set(self.initial)!=set(self.bounds):raise ValueError('Every locus requires initial value and bounds')
        if not set(self.cad_keys).issubset(self.bounds):raise ValueError('CAD loci missing')
        for k,(a,b) in self.bounds.items():
            if not np.isfinite([a,b,self.initial[k]]).all() or a>=b or not a<=self.initial[k]<=b:
                raise ValueError(f'Invalid locus {k}')
        ids={x.id for x in self.steps}
        if len(ids)!=len(self.steps):raise ValueError('Duplicate capability id')
        for i,step in enumerate(self.steps):
            if not step.id or not step.entity or not re.fullmatch(r'[a-z][a-z0-9-]*',step.operator):
                raise ValueError('Incomplete capability identity')
            if any(dep not in {x.id for x in self.steps[:i]} for dep in step.depends_on):
                raise ValueError('Capability cycle or out-of-order dependency')
            if step.activation and step.activation not in self.bounds:raise ValueError('Missing activation locus')
            if any(locus not in self.bounds for _,locus in step.params):raise ValueError('Undeclared operator locus')
        for v in self.source_hashes.values():
            if not re.fullmatch(r'[a-f0-9]{64}',str(v)):raise ValueError('Invalid source digest')
        # A declared recipe never upgrades artwork to survey registration.
        if self.provenance=='verified' and not self.source_hashes:
            raise ValueError('Verified evidence requires independent sources')

    def to_dict(self):
        obj={'schema':SCHEMA,'location':self.location,'pet_name':self.pet_name,
             'version':self.version,'provenance':self.provenance,
             'steps':[step.to_dict() for step in self.steps],
             'bounds':{k:list(v) for k,v in self.bounds.items()},
             'initial':self.initial,'cad_keys':list(self.cad_keys),
             'source_hashes':self.source_hashes}
        obj['sha256']=digest(obj)
        return obj

    @property
    def sha256(self):return self.to_dict()['sha256']

    def save(self,path):
        target=Path(path);target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text(json.dumps(self.to_dict(),sort_keys=True,indent=2)+'\n',encoding='utf8')

    def verify_genome(self,genome):
        if set(genome)!=set(self.bounds):raise ValueError('Compound genome missing or adding loci')
        for k,value in genome.items():
            if isinstance(value,bool) or not isinstance(value,(int,float,np.number)) or not math.isfinite(float(value)):
                raise ValueError(f'Nonfinite genome locus: {k}')
            lo,hi=self.bounds[k]
            if not lo<=float(value)<=hi:raise ValueError(f'Genome locus outside bounds: {k}')
        return {k:float(genome[k]) for k in self.bounds}

    def cad_genome(self,genome):
        return {k:float(genome[k]) for k in self.cad_keys}

    def lineage(self,genome,registry):
        return {'schema':'projection-loom/compound-lineage/v1',
                'recipe_sha256':self.sha256,'operator_sha256':registry.fingerprint(),
                'genome':self.verify_genome(genome),'source_hashes':self.source_hashes,
                'location':self.location,'pet_name':self.pet_name}


class BuildContext:
    def __init__(self,recipe,genome,assembly,scene,camera,size,source_mask,registry):
        self.recipe=recipe;self.genome=genome;self.assembly=assembly;self.scene=scene
        self.camera=camera;self.size=size;self.source_mask=source_mask;self.registry=registry
        self.results={};self.receipts=[]

    def params(self,step):
        return {p:float(self.genome[locus]) for p,locus in step.params}


def _cad(ctx,step):
    if step.part and step.part not in ctx.assembly.parts:raise ValueError('Missing CAD part: '+step.part)
    return {'kind':'cad','part':step.part,'authority':'BRep/material-after-audit'}


def _contact(ctx,step):
    if not step.part or not step.socket:raise ValueError('Contact needs child and parent part names')
    result=ctx.assembly.contact(step.socket,step.part)
    if not result['valid']:raise ValueError('Required CAD contact fails positive-volume gate')
    return {'kind':'contact','parent':step.socket,'part':step.part,
            'volume_ratio':result['volume_ratio'],'authority':'exact-CAD-contact'}


def _cad_mesh(ctx,step):
    if not step.part or not step.layer:raise ValueError('Derived surface needs CAD part and layer')
    part=ctx.assembly.parts[step.part].solid
    params=ctx.params(step)
    source=ctx.source_mask if params.get('guide',0)>0 else None
    mesh,info=derived_cad_surface(part,params,camera=ctx.camera,size=ctx.size,
                                  source_mask=source,
                                  socket_name=step.socket or 'top-east')
    ctx.scene.add_mesh(step.layer,mesh,genotype=params,source='procedural',role=step.role,
                       requires_volume=True,covers_part=step.part)
    return {'kind':'polymesh','layer':step.layer,'part':step.part,
            'authority':'polygon-surface','geometry':info}


def _standalone_mesh(ctx,step):
    if not step.layer:raise ValueError('Standalone polymesh requires a layer name')
    p=ctx.params(step)
    radius=float(p.get('radius',1))
    if radius<=0:raise ValueError('Invalid standalone radius')
    mesh=trimesh.creation.icosphere(subdivisions=1,radius=radius)
    ctx.scene.add_mesh(step.layer,mesh,genotype=p,source='procedural',role=step.role)
    return {'kind':'polymesh','layer':step.layer,'authority':'standalone-polygon'}


def _socket(ctx,step):
    if not step.part or not step.layer or not step.socket:
        raise ValueError('Socket needs part, mesh layer, semantic selector')
    cad=ctx.assembly.parts[step.part].solid
    location=semantic_cad_point(cad,step.socket)
    name=step.id
    ctx.scene.attach_semantic(name,step.layer,step.part,step.socket,location,
                              tolerance=float(ctx.params(step).get('tolerance',.08)))
    return {'kind':'socket','socket':step.socket,'CAD_xyz':list(location),
            'authority':'spatial-proximity-only'}


def default_registry():
    reg=OperatorRegistry()
    for name,ver,fn in [('cad','1',_cad),('cad-contact','1',_contact),
                        ('cad-polymesh','2',_cad_mesh),('standalone-polymesh','1',_standalone_mesh),
                        ('semantic-socket','1',_socket)]:
        reg.register(name,ver,fn)
    return reg


class CapabilityCompositor:
    """Regrow one compound genome, execute dependency DAG, audit all authorities.

    `stage_event` receives (step, transition, receipt) and may open nested
    OODA-HA child loops; the same recipe runs without any workflow controller.
    """
    def __init__(self,project,recipe,*,registry=None,camera=None,size=(128,192),source_mask=None):
        self.project=project;self.recipe=recipe
        self.registry=registry or default_registry()
        self.camera=camera or project.cameras[project.reference_view]
        self.size=tuple(size)
        self.source_mask=source_mask
        if self.camera.fit!='fixed' and source_mask is not None:
            raise ValueError('External evidence requires a fixed camera')
        if source_mask is not None and np.asarray(source_mask).shape!=(size[1],size[0]):
            raise ValueError('Source mask does not match camera frame')
        if set(recipe.cad_keys)!=set(project.initial):raise ValueError('Recipe CAD loci differ from project')
        if recipe.location!=project.location:raise ValueError('Recipe and project location differ')
        if (recipe.source_hashes.get('image') and project.reference and
              sha256(project.reference.read_bytes()).hexdigest()!=recipe.source_hashes['image']):
            raise ValueError('Source witness digest mismatch')
        for step in recipe.steps:
            if not self.registry.knows(step.operator):raise ValueError('Unknown/untrusted operator '+step.operator)

    def construction_digest(self):
        from .epochs import project_code_digest
        return digest({'engine':project_code_digest(self.project),
                       'recipe':self.recipe.sha256,'operators':self.registry.fingerprint()})

    def grow(self,genome,*,stage_event=None):
        clean=self.recipe.verify_genome(genome)
        assembly=self.project.grow(self.recipe.cad_genome(clean))
        report=assembly.audit(join=True)
        if not report['valid'] or report.get('union_solids')!=1 or not report.get('union_valid'):
            raise ValueError('Composite CAD gate failed')
        scene=HybridLocation(self.recipe.location,assembly,pet_name=self.recipe.pet_name)
        context=BuildContext(self.recipe,clean,assembly,scene,self.camera,self.size,self.source_mask,self.registry)
        for step in self.recipe.steps:
            if stage_event:stage_event(step,'begin',{'dependencies':list(step.depends_on)})
            if any(context.results.get(dep,{}).get('state')!='complete' for dep in step.depends_on):
                row={'id':step.id,'entity':step.entity,'operator':step.operator,'state':'inactive-dependency'}
            elif step.activation and clean[step.activation]<.5:
                row={'id':step.id,'entity':step.entity,'operator':step.operator,'state':'inactive'}
            else:
                try:
                    output=self.registry.invoke(step.operator,context,step)
                    row={'id':step.id,'entity':step.entity,'operator':step.operator,
                         'state':'complete','output':output,'has':list(step.has)}
                except Exception as e:
                    row={'id':step.id,'entity':step.entity,'operator':step.operator,
                         'state':'error','error':str(e)}
                    if stage_event:stage_event(step,'end',row)
                    raise ValueError(f'Capability {step.id} failed: {e}') from e
            context.results[step.id]=row
            context.receipts.append(row)
            if stage_event:stage_event(step,'end',row)
        audit=scene.audit()
        if not audit['composite_valid_for_render']:
            raise ValueError('Composite render gates failed')
        # CAD and mesh authority remain separate even after every stage passes.
        return CompositeBuild(context,audit)


class CompositeBuild:
    def __init__(self,context,audit):self.context=context;self.audit=audit
    @property
    def scene(self):return self.context.scene
    @property
    def genome(self):return self.context.genome
    @property
    def recipe(self):return self.context.recipe
    @property
    def steps(self):return self.context.receipts

    def witness(self):
        """A location/entity witness independent of transient CAD faces/mesh vertices.

        Capability identities and #has claims survive regrowth. The ordinary CAD
        construction witness remains present, so pet-names can bind either a
        composed entity or a physically connected part of that entity.
        """
        from .relations import RelationWitness, Occurrence, capabilities
        witness = self.scene.assembly.relation_witness(location=self.recipe.location)
        nodes = dict(witness.nodes)
        root = '@location'
        if root in nodes:
            raise ValueError('Location witness handle collides with CAD construction')
        nodes[root] = Occurrence(root, 'location', 'composed-location', (),
                                 capabilities(('generative',)), 'location-root')
        entities = dict.fromkeys(step.entity for step in self.recipe.steps)
        for entity in entities:
            handle = '@entity/' + entity
            if handle in nodes:
                raise ValueError('Entity handle collides with authored geometry')
            active = [row for row in self.steps if row['entity'] == entity and
                      row['state'] == 'complete']
            observed = [tag for row in active for tag in row.get('has', ())]
            observed.extend('operator-' + row['operator'] for row in active)
            nodes[handle] = Occurrence(handle, 'entity', 'capability-composition',
                                       (root,), capabilities(observed), entity)
        return RelationWitness(nodes, location=self.recipe.location)

    def manifest(self,registry):
        return {'schema':'projection-loom/compound-build/v1',
                'lineage':self.recipe.lineage(self.genome,registry),
                'steps':self.steps,'audit':self.audit,
                'capability_features':sorted(f"{row['entity']}:{row['operator']}:{row['id']}"
                                for row in self.steps if row['state']=='complete'),
                'claims':{'CAD':'exact BRep validity and positive joins',
                          'polymesh':'closed visual surface',
                          'cross-kernel':'semantic socket proximity, not Boolean fusion'}}

    def export(self,output,cameras,registry,*,size=(256,384)):
        out=Path(output);out.mkdir(parents=True,exist_ok=True)
        self.recipe.save(out/'recipe.json')
        (out/'genome.json').write_text(json.dumps(self.recipe.lineage(self.genome,registry),indent=2)+'\n')
        export=self.scene.export(out,cameras,size=size)
        (out/'compound_manifest.json').write_text(json.dumps(self.manifest(registry),indent=2)+'\n')
        return export
