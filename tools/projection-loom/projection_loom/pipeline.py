"""Solid-grown projects and their orthographic production contracts."""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import importlib.util, json, hashlib
import numpy as np
from .cameras import Camera
from .solid import SolidAssembly
from .render import silhouette, export_controls, light_vector

SCHEMA='projection-loom/solid-project/v2'

@dataclass
class Project:
    file: Path
    builder_file: Path
    builder: object
    cameras: dict
    initial: dict
    bounds: dict
    reference: Path | None
    reference_view: str
    light_angles: tuple
    render_style: dict
    location: str = 'untitled-location'

    @classmethod
    def load(cls,path):
        f=Path(path).resolve()
        conf=json.loads(f.read_text())
        if conf.get('schema')!=SCHEMA:
            raise ValueError(f'Projection Loom requires the project schema {SCHEMA}')
        src,fn=conf['builder'].split(':',1)
        builder_path=(f.parent/src).resolve()
        module_spec=importlib.util.spec_from_file_location('projection_loom_solid_rig',builder_path)
        mod=importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(mod)
        builder=getattr(mod,fn)
        cameras={n:Camera.from_dict(v) for n,v in conf['cameras'].items()}
        bounds={n:tuple(map(float,b)) for n,b in conf['bounds'].items()}
        initial={n:float(conf['initial'][n]) for n in bounds}
        if not cameras or not bounds:raise ValueError('Project needs cameras and bounded parameters')
        if not all(a<b and a<=initial[n]<=b for n,(a,b) in bounds.items()):
            raise ValueError('Invalid construction parameter bounds')
        ref=conf.get('reference')
        ref_path=(f.parent/ref).resolve() if ref else None
        reference_view=conf.get('reference_view','oblique')
        if ref_path is not None:
            if reference_view not in cameras:
                raise ValueError('Reference camera must be declared in cameras')
            from .calibration import ensure_fixed_evidence_camera
            ensure_fixed_evidence_camera(cameras[reference_view])
        settings=conf.get('render',{})
        if settings.get('linework_mode','semantic') != 'semantic':
            raise ValueError('Only semantic linework is supported')
        settings={'linework_mode':'semantic','line_supersample':1,'presentation_width':540,
                  'supersample':1,'work_width':300,'material_gray':{0:.17,1:.70,2:.55},**settings}
        location = str(conf.get('location') or (f.parent.name if f.stem == 'project' else f.stem))
        return cls(f,builder_path,builder,cameras,initial,bounds,ref_path,
                   reference_view,tuple(conf.get('light_angles',[-80,35])),settings,location)

    def grow(self,genome=None):
        pars=dict(self.initial)
        if genome:
            for k,v in genome.items():
                if k not in self.bounds:raise ValueError(f'Unknown genome locus: {k}')
                lo,hi=self.bounds[k]
                if not lo<=float(v)<=hi:raise ValueError(f'Genome locus outside bounds: {k}')
                pars[k]=float(v)
        assembly=self.builder(pars)
        if not isinstance(assembly,SolidAssembly):
            raise TypeError('Growth builder must return a SolidAssembly')
        return assembly

    def load_genome(self,path):
        obj=json.loads(Path(path).read_text())
        return obj.get('genome',obj)

    def source_mask(self,size):
        if self.reference is None:return None
        import cv2
        from PIL import Image
        if not self.reference.exists():raise FileNotFoundError(self.reference)
        im=Image.open(self.reference).convert('RGBA')
        if np.ptp(np.array(im.getchannel('A')))>0:
            channel=np.array(im.getchannel('A'))
        else:
            channel=np.array(im.convert('L'))
        return cv2.resize(channel,size,interpolation=cv2.INTER_AREA)>96

    def anchor_mask(self,mesh,size):
        name=self.reference_view
        if name not in self.cameras:raise ValueError(f'Missing reference camera: {name}')
        return silhouette(mesh,self.cameras[name],size,supersample=1)>96

    def export(self,assembly,out,genome,size=(1024,1536),*,ledger=None):
        out=Path(out);out.mkdir(parents=True,exist_ok=True)
        audit=assembly.audit(join=True)
        if not audit['valid']:
            raise ValueError('Cannot export an invalid CAD construction')
        shape=assembly.material_solid()
        shape.exportStep(str(out/'solid.step'))
        assembly.tessellate(linear=.12,angular=.19,union=True).export_obj(out/'fused.obj')
        # Every production pass projects the same carved material as solid.step.
        # Per-part uncarved meshes are diagnostic only: they may fill doorways.
        mesh=assembly.tessellate(linear=.15,angular=.2,union=True)
        mesh.save(out/'render_mesh.npz')
        renders=export_controls(mesh,self.cameras,out/'controls',size=size,
                    light=light_vector(*self.light_angles),style=self.render_style)
        witness=assembly.relation_witness(location=self.location)
        witness.save(out/'relations.json')
        pet_receipt = ledger.resolve(witness) if ledger is not None else []
        if ledger is not None:
            (out/'pet_name_receipt.json').write_text(json.dumps(
                {'schema':'projection-loom/pet-name-receipt/v1',
                 'witness_id': witness.witness_id, 'resolutions':pet_receipt,
                 'soft_loss':ledger.soft_loss(witness)},indent=2))
        summary={'schema':'projection-loom/solid-model/v2',
                 'project':str(self.file),'genome':{k:float(v) for k,v in genome.items()},
                 'geometry':'solid.step','contacts':audit,'relations':'relations.json',
                 'pet_name_receipt':'pet_name_receipt.json' if ledger is not None else None,
                 'render_mesh':'render_mesh.npz','controls':renders,
                 'linework':'semantic','reference_evidence':str(self.reference) if self.reference else None,
                 'reference_camera':self.cameras[self.reference_view].to_dict() if self.reference else None,
                 'reference_registration':'provisional-unverified' if self.reference else None,
                 'authority':'BRep solid union; triangle mesh is export-only and cannot seed growth'}
        (out/'manifest.json').write_text(json.dumps(summary,indent=2))
        (out/'genome.json').write_text(json.dumps({'schema':'projection-loom/genome/v2','genome':summary['genome']},indent=2))
        return summary
