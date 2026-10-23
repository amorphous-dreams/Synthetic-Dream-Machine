"""Hybrid location: independently audited CAD, polygon and authored relations.

A polygon surface can bind to a *validated* CAD cage without claiming an exact
BRep union. The shared frame governs scene projection; CAD-only STEP and mesh
assets remain separate sources. No imported surface becomes a growth genome.
"""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import json
import math
import re
import numpy as np
import cadquery as cq
import trimesh

from .geometry import Mesh
from .render import export_controls


@dataclass(frozen=True)
class CageAttachment:
    name: str
    mesh_layer: str
    cad_part: str
    mesh_vertex: int
    cad_anchor: tuple[float, float, float]
    tolerance: float
    relation: str = 'attached-to'


class HybridLocation:
    """One named location with separate mechanical and visual invariants.

    The CAD assembly owns structural validity. Polygon meshes own visual
    surface validity; proximity anchors prove only an interface measurement,
    *not* a mechanical bond or a Boolean union across geometry kernels.
    """
    def __init__(self, location, assembly, *, pet_name=None):
        self.location = str(location)
        self.pet_name = pet_name
        self.assembly = assembly
        self.layers = {}
        self.attachments = {}

    def add_mesh(self, name, mesh, *, role='sculptural', source='procedural',
                 requires_volume=True, transform=None, genotype=None, source_sha256=None):
        if not name or name in self.layers:
            raise ValueError('Polygon layer requires a unique name')
        if source not in ('procedural', 'external', 'inferred'):
            raise ValueError('Mesh source status must be declared')
        if source == 'external' and not re.fullmatch(r'[0-9a-f]{64}', str(source_sha256)):
            raise ValueError('External mesh requires a digest-checked source SHA-256')
        if role not in ('sculptural', 'terrain', 'surface', 'structural-hypothesis'):
            raise ValueError('Invalid mesh role')
        if not isinstance(mesh, trimesh.Trimesh):
            raise TypeError('Polygon layer requires a triangle mesh')
        shape=mesh.copy()
        pose=np.eye(4) if transform is None else np.asarray(transform,dtype=float)
        if pose.shape!=(4,4) or not np.isfinite(pose).all() or not np.allclose(pose[3],[0,0,0,1]):
            raise ValueError('Mesh transform needs an affine 4x4 matrix')
        if abs(np.linalg.det(pose[:3,:3]))<1e-9:
            raise ValueError('Mesh transform cannot collapse the surface')
        shape.apply_transform(pose)
        if not len(shape.faces) or not len(shape.vertices) or not np.isfinite(shape.vertices).all():
            raise ValueError('Polygon layer must have finite nonempty triangles')
        self.layers[name]={'mesh':shape,'role':role,'source':source,
                           'requires_volume':bool(requires_volume),
                           'transform':pose.tolist(), 'genotype':dict(genotype or {}),
                           'source_sha256':source_sha256}
        return self

    def attach(self, name, mesh_layer, cad_part, mesh_vertex, cad_anchor, *, tolerance=.1):
        if not name or name in self.attachments:
            raise ValueError('Attachment requires a unique name')
        anchor=tuple(float(x) for x in cad_anchor)
        if len(anchor)!=3 or any(not math.isfinite(x) for x in anchor):
            raise ValueError('Attachment CAD anchor must be finite XYZ')
        if not math.isfinite(tolerance) or tolerance<=0:
            raise ValueError('Attachment tolerance must be positive')
        self.attachments[name]=CageAttachment(name,mesh_layer,cad_part,int(mesh_vertex),
                                              anchor,float(tolerance))
        return self

    def audit(self):
        cad=self.assembly.audit(join=True)
        surface=[]
        for name,item in self.layers.items():
            shape=item['mesh']
            valid=bool(np.isfinite(shape.vertices).all() and len(shape.faces)>0)
            if item['requires_volume']:
                valid=bool(valid and shape.is_volume and shape.is_watertight and shape.volume>0)
            surface.append({'name':name,'role':item['role'],'source':item['source'],
                            'valid':valid,'triangles':int(len(shape.faces)),
                            'watertight':bool(shape.is_watertight),
                            'positive_volume':bool(shape.is_volume and shape.volume>0),
                            'scope':'polygon-surface-only'})
        joined=[]
        for binding in self.attachments.values():
            if binding.mesh_layer not in self.layers or binding.cad_part not in self.assembly.parts:
                joined.append({'name':binding.name,'valid':False,'error':'missing bound endpoint'})
                continue
            verts=self.layers[binding.mesh_layer]['mesh'].vertices
            if binding.mesh_vertex<0 or binding.mesh_vertex>=len(verts):
                joined.append({'name':binding.name,'valid':False,'error':'missing mesh anchor vertex'})
                continue
            anchor=np.array(binding.cad_anchor)
            difference=float(np.linalg.norm(verts[binding.mesh_vertex]-anchor))
            part=self.assembly.parts[binding.cad_part].solid
            # Geometric proximity to the actual BRep solid, not only its AABB.
            distance=float(part.distance(cq.Vertex.makeVertex(*binding.cad_anchor)))
            valid=bool(difference<=binding.tolerance and distance<=binding.tolerance)
            joined.append({'name':binding.name,'valid':valid,
                           'mesh_to_cad_anchor':difference, 'cad_point_to_brep':distance,
                           'tolerance':binding.tolerance,
                           'scope':'interface-proximity-not-structural-fusion'})
        return {'location':self.location,'pet_name':self.pet_name,
                'cad_valid':bool(cad['valid']), 'cad':cad,
                'layers':surface,'attachments':joined,
                'composite_valid_for_render':bool(cad['valid'] and all(x['valid'] for x in surface+joined)),
                'composite_cad_union_verified':False,
                'authority':'CAD valid per body; meshes valid for render; anchors verify proximity only'}

    def render_mesh(self, *, linear=.19, angular=.27):
        audit=self.audit()
        if not audit['composite_valid_for_render']:
            raise ValueError('Hybrid scene rejected: verify CAD, meshes and anchors')
        cad=self.assembly.tessellate(linear=linear,angular=angular,union=True)
        vertices=[cad.vertices];faces=[cad.faces];materials=[cad.materials]
        edges=[cad.edges]
        parts=list(cad.parts)
        for idx,(name,record) in enumerate(sorted(self.layers.items())):
            shape=record['mesh'];offset=sum(len(x) for x in vertices)
            first=sum(len(x) for x in faces)
            vertices.append(shape.vertices)
            faces.append(shape.faces+offset)
            mat=4+idx
            materials.append(np.full(len(shape.faces),mat,dtype=np.int16))
            unique=np.asarray(shape.edges_unique,dtype=np.int32)
            edges.append(np.column_stack((unique+offset,np.full(len(unique),mat,dtype=int))))
            parts.append({'name':name,'first_face':first,'num_faces':len(shape.faces),
                          'line_role':'primary' if record['role']=='sculptural' else 'detail'})
        return Mesh(np.concatenate(vertices),np.concatenate(faces),
                    np.concatenate(materials),np.concatenate(edges),parts)

    def export(self, output, cameras, *, size=(360,480), style=None):
        out=Path(output);out.mkdir(parents=True,exist_ok=True)
        audit=self.audit()
        if not audit['composite_valid_for_render']:
            raise ValueError('Cannot export hybrid scene with invalid witnesses')
        # STEP stays strictly BRep; OBJ depicts multiple materials/surfaces.
        self.assembly.material_solid().exportStep(str(out/'cad_body.step'))
        for name,record in self.layers.items():
            record['mesh'].export(out/(name+'.obj'))
        combined=self.render_mesh()
        combined.export_obj(out/'composite_render.obj')
        controls=export_controls(combined,cameras,out/'controls',size=size,
                                 style=style or {'supersample':1,'work_width':200})
        manifest={'schema':'projection-loom/hybrid-location/v1',
                  'location':self.location,'pet_name':self.pet_name,
                  'cad_step':'cad_body.step', 'composite_mesh':'composite_render.obj',
                  'mesh_layers':{name:{'asset':name+'.obj','source':v['source'],
                               'role':v['role'],'genotype':v['genotype'],
                               'source_sha256':v['source_sha256']}
                                 for name,v in self.layers.items()},
                  'attachments':[a.__dict__ for a in self.attachments.values()],
                  'audit':audit,'controls':controls,
                  'epistemic_boundary':'Composite render includes un-fused polygon layers; STEP validates CAD only'}
        (out/'hybrid_manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        return manifest


def faceted_crystal_mesh(sections, *, sides=8, jaggedness=.05, phase=0., perturb=.13):
    """Watertight multi-ring polymesh with an unchanged top attachment ring.

    The top ring duplicates a named CAD cage ring; lower rings add deterministic
    sculptural perturbations. No mesh triangles become a CAD growth genotype.
    Each section: (z, cx, cy, rx, ry); ordered bottom-to-top.
    """
    if len(sections)<2 or sides<4 or not 0<=jaggedness<.3 or not 0<=perturb<.4:
        raise ValueError('Invalid faceted crystal parameters')
    vertices=[]
    last=len(sections)-1
    for index,(z,cx,cy,rx,ry) in enumerate(sections):
        if min(rx,ry)<=0:raise ValueError('Crystal ring radii must be positive')
        for j in range(sides):
            angle=math.tau*j/sides+phase
            baseline=1+jaggedness*math.sin(j*2.34+.35)
            scalar=1 if index==last else 1+perturb*math.sin(j*3.71+index*2.11)
            vertices.append((cx+rx*math.cos(angle)*baseline*scalar,
                             cy+ry*math.sin(angle)*baseline*scalar,z))
    lower=np.mean(vertices[:sides],axis=0);upper=np.mean(vertices[last*sides:],axis=0)
    basecenter=len(vertices);vertices.append(tuple(lower))
    roofcenter=len(vertices);vertices.append(tuple(upper))
    faces=[]
    for k in range(len(sections)-1):
        for j in range(sides):
            a=k*sides+j;b=k*sides+(j+1)%sides
            c=(k+1)*sides+j;d=(k+1)*sides+(j+1)%sides
            faces.extend(((a,b,d),(a,d,c)))
    for j in range(sides):
        faces.append((basecenter,(j+1)%sides,j))
        faces.append((roofcenter,last*sides+j,last*sides+(j+1)%sides))
    return trimesh.Trimesh(vertices=vertices,faces=faces,process=True)
