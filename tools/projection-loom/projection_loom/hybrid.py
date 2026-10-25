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


@dataclass(frozen=True)
class SemanticAttachment:
    """Persistent by authored socket name and regenerated XYZ, not polygon vertex."""
    name: str
    mesh_layer: str
    cad_part: str
    selector: str
    cad_anchor: tuple[float,float,float]
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
                 requires_volume=True, transform=None, genotype=None, source_sha256=None,
                 covers_part=None):
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
        if covers_part is not None and covers_part not in self.assembly.parts:
            raise ValueError('Visual replacement refers to a missing CAD part')
        if covers_part is not None and source=='external':
            raise ValueError('An unverified external mesh cannot replace an authored CAD witness')
        if covers_part is not None and any(x.get('covers_part')==covers_part for x in self.layers.values()):
            raise ValueError('Only one presentation surface may replace each CAD part')
        self.layers[name]={'mesh':shape,'role':role,'source':source,
                           'covers_part':covers_part,
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

    def attach_semantic(self, name, mesh_layer, cad_part, selector, cad_anchor, *, tolerance=.1):
        if not name or name in self.attachments:
            raise ValueError('Semantic socket needs a unique name')
        if not selector or not isinstance(selector,str):
            raise ValueError('Semantic socket needs a named selector')
        xyz=tuple(float(x) for x in cad_anchor)
        if len(xyz)!=3 or not np.isfinite(xyz).all() or not np.isfinite(tolerance) or tolerance<=0:
            raise ValueError('Invalid semantic socket geometry or tolerance')
        self.attachments[name]=SemanticAttachment(name,mesh_layer,cad_part,selector,xyz,float(tolerance))
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
                            'covers_part':item.get('covers_part'),
                            'scope':'polygon-surface-only'})
        joined=[]
        for binding in self.attachments.values():
            if binding.mesh_layer not in self.layers or binding.cad_part not in self.assembly.parts:
                joined.append({'name':binding.name,'valid':False,'error':'missing bound endpoint'})
                continue
            mesh=self.layers[binding.mesh_layer]['mesh']
            verts=mesh.vertices
            anchor=np.array(binding.cad_anchor)
            if isinstance(binding, SemanticAttachment):
                # Read the nearest actual triangle, not the location of a mesh
                # vertex whose index may change under remeshing or subdivision.
                from trimesh.proximity import closest_point_naive
                _,dist,_=closest_point_naive(mesh,[anchor])
                difference=float(dist[0])
            else:
                if binding.mesh_vertex<0 or binding.mesh_vertex>=len(verts):
                    joined.append({'name':binding.name,'valid':False,'error':'missing mesh anchor vertex'})
                    continue
                difference=float(np.linalg.norm(verts[binding.mesh_vertex]-anchor))
            part=self.assembly.parts[binding.cad_part].solid
            point=cq.Vertex.makeVertex(*binding.cad_anchor)
            # Distance to the actual CAD *faces* avoids treating a point
            # deep inside the solid as proof of a surface attachment.
            distance=min(float(f.distance(point)) for f in part.Faces())
            valid=bool(difference<=binding.tolerance and distance<=binding.tolerance)
            joined.append({'name':binding.name,'valid':valid,
                           'mesh_to_cad_anchor':difference,'cad_point_to_brep':distance,
                           'tolerance':binding.tolerance,
                           'selector':getattr(binding,'selector',None),
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
        # Visual replacement prevents two representations of one crystal from
        # being drawn as two simultaneously present bodies. The original CAD
        # assembly and exact fused STEP remain untouched and independently
        # validated; only its *presentation mesh* omits covered CAD parts.
        covered={x['covers_part'] for x in self.layers.values() if x.get('covers_part')}
        if covered:
            from .solid import _crease_edges
            remainder=[p for p in self.assembly.parts.values() if p.name not in covered]
            vv=[];ff=[];mm=[];ee=[];pp=[]
            for part in remainder:
                solid=part.solid
                if self.assembly.voids is not None:
                    for cutter in self.assembly.voids.voids.values():
                        solid=solid.cut(cutter.solid)
                if not solid.isValid():
                    raise ValueError('CAD presentation cut produced invalid geometry')
                vs,fs=solid.tessellate(linear,angular)
                offset=len(vv); first=len(ff)
                vv.extend(v.toTuple() for v in vs)
                ff.extend([[int(k)+offset for k in tri] for tri in fs])
                mm.extend([part.material]*len(fs))
                ee.extend((a+offset,b+offset,part.material) for a,b in _crease_edges(vs,fs))
                pp.append({'name':part.name,'first_face':first,'num_faces':len(fs),
                           'line_role':'primary' if part.role in ('foundation','primary') else part.role})
            vertices=[np.asarray(vv).reshape(-1,3)];faces=[np.asarray(ff,dtype=int).reshape(-1,3)]
            materials=[np.asarray(mm,dtype=np.int16)];edges=[np.asarray(ee,dtype=int).reshape(-1,3)]
            parts=pp
        else:
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
        manifest={'schema':'projection-loom/hybrid-location',
                  'location':self.location,'pet_name':self.pet_name,
                  'cad_step':'cad_body.step', 'composite_mesh':'composite_render.obj',
                  'mesh_layers':{name:{'asset':name+'.obj','source':v['source'],
                               'role':v['role'],'covers_part':v.get('covers_part'),
                               'genotype':v['genotype'],
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


def semantic_cad_point(shape, selector, *, linear=.35, angular=.3):
    """Recompute named CAD surface points each generation; never persist a face id.

    Cardinal selectors identify a reproducible extremum on the upper/lower
    section of the part's *actual* BRep tessellation. A changed genome may move
    the point, but its relationship and selector remain stable.
    """
    if selector not in ('top-east','top-west','top-north','top-south',
                        'bottom-east','bottom-west','bottom-north','bottom-south'):
        raise ValueError('Unknown semantic CAD socket selector')
    vs,_=shape.tessellate(linear,angular)
    xyz=np.asarray([v.toTuple() for v in vs],dtype=float)
    z=xyz[:,2]
    upper=selector.startswith('top')
    extreme=np.max(z) if upper else np.min(z)
    subset=xyz[np.abs(z-extreme)<=max(1e-5,np.ptp(z)*1e-6)]
    direction=selector.split('-',1)[1]
    axis=0 if direction in ('east','west') else 1
    sign=1 if direction in ('east','north') else -1
    idx=int(np.argmax(sign*subset[:,axis]))
    return tuple(float(v) for v in subset[idx])


def derived_cad_surface(shape, params, *, camera=None, size=(128,192),
                        source_mask=None, socket_name='top-east'):
    """Deterministic, watertight sculptural polymesh from actual BRep vertices.

    Fracture growth acts on a *derived* mesh; the source CAD never changes.
    Mesh density and displacement respect a fixed projected preview budget.
    Protective collars keep the selected semantic interface exactly on the CAD
    cage. Surface fitting to art remains provisional and strictly bounded.
    """
    from .render import silhouette
    from .geometry import Mesh
    linear=float(params.get('linear',.30))
    if not .04<=linear<=1.2:raise ValueError('CAD tessellation tolerance out of bounds')
    vs,fs=shape.tessellate(linear,.3)
    reference=trimesh.Trimesh(vertices=[v.toTuple() for v in vs],faces=fs,process=True)
    if not reference.is_volume:raise ValueError('Source BRep did not tessellate to a closed volume')
    amp=float(params.get('relief',.11))
    fracture=float(params.get('fracture',.10))
    wave=float(params.get('wave',7.))
    seed=int(round(float(params.get('seed',3))))
    guide=float(params.get('guide',0))
    radius=float(params.get('protected_radius',1.0))
    limit=float(params.get('max_shift_px',9.))
    if (not 0<=amp<=.35 or not 0<=fracture<=.3 or not 2<=wave<=20 or
        not 0<=seed<=65535 or not 0<=guide<=.5 or radius<=0 or limit<=0):
        raise ValueError('Sculptural parameters exceed audited bounds')
    xyz=reference.vertices.copy()
    bounds=reference.bounds
    mid=(bounds[0]+bounds[1])/2
    extent=np.maximum(bounds[1]-bounds[0],1e-6)
    normalized=(xyz-mid)/extent
    z=normalized[:,2]
    theta=np.arctan2(normalized[:,1],normalized[:,0])
    # Multi-scale oriented fractures follow continuous *world-space* fields.
    # Deterministic seed changes a phase, not the source topology.
    phase=seed*.12731
    folded=np.sin(wave*theta+2.2*z+phase)*np.sin((wave*.37+1)*theta-4.1*z+phase*.57)
    facets=np.sign(np.sin((wave*.58)*theta+3*z+phase))
    ripple=amp*(.58*folded+.42*np.sin(3.1*theta+11.9*z+phase)) + fracture*.34*facets
    anchor=np.array(semantic_cad_point(shape,socket_name))
    gap=np.linalg.norm(xyz-anchor,axis=1)
    fade=np.clip((gap-radius)/max(radius*.8,1e-5),0,1)**2
    # Protect every vertex at the source socket and gradually release outward.
    delta=reference.vertex_normals*(ripple*fade)[:,None]
    projected_scale=None
    if camera is not None:
        if camera.fit!='fixed' and source_mask is not None:
            raise ValueError('Image evidence requires fixed registration')
        _,_,projected_scale=camera.project(xyz,size)
        max_pixels=float(np.max(np.linalg.norm(delta,axis=1)))*projected_scale
        if max_pixels>limit:delta*=limit/max_pixels
    modified=xyz+delta
    result=trimesh.Trimesh(vertices=modified,faces=reference.faces,process=False)
    if not result.is_volume or not result.is_watertight or result.volume<=0:
        raise ValueError('Sculptural deformation broke the closed surface')
    record={'source_vertices':int(len(reference.vertices)),
            'triangles':int(len(reference.faces)),'BRep_tessellated':True,
            'protected_socket':socket_name,'protected_radius':radius,
            'maximum_world_deviation':float(np.max(np.linalg.norm(modified-xyz,axis=1))),
            'pixel_scale':projected_scale,'evidence_state':'provisional' if source_mask is not None else 'synthetic',
            'guidance_applied':False}
    if source_mask is not None and guide>0 and camera is not None:
        # Model evidence can nudge *visible, unprotected* surface vertices only.
        # The update wins admission only when the mesh remains valid and its
        # actual projected mask improves. No camera or BRep changes here.
        import cv2
        from scipy.spatial import cKDTree
        w,h=size
        target=np.asarray(source_mask)>0
        if target.shape!=(h,w):raise ValueError('Guidance source shape mismatch')
        mono=Mesh(result.vertices,result.faces,np.zeros(len(result.faces),dtype=np.int16),
                  np.empty((0,3),dtype=np.int32),[])
        baseline=silhouette(mono,camera,size)>96
        contours,_=cv2.findContours(np.uint8(target),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
        if contours:
            pixels=np.vstack([c.reshape(-1,2) for c in contours if len(c)>1])
            if len(pixels):
                tree=cKDTree(pixels)
                xy,depth,px_scale=camera.project(result.vertices,size)
                # Only forward-facing extrema near the current silhouette.
                occ=cv2.morphologyEx(np.uint8(baseline),cv2.MORPH_GRADIENT,
                                      np.ones((3,3),np.uint8))
                pick=[];delta_uv=[]
                for i,pt in enumerate(xy):
                    x,y=np.rint(pt).astype(int)
                    if not 1<=x<w-1 or not 1<=y<h-1 or not occ[y-1:y+2,x-1:x+2].any():continue
                    if gap[i]<radius or xyz[i,2]>0:continue
                    d,j=tree.query(pt)
                    if d>min(8,limit):continue
                    v=(pixels[j]-pt)*min(guide, .45)
                    v=np.clip(v,-1.6,1.6)
                    pick.append(i);delta_uv.append(v)
                if pick:
                    trial=result.vertices.copy()
                    right,up,_=camera.basis()
                    for i,v in zip(pick,delta_uv):
                        trial[i]+=right*v[0]/px_scale-up*v[1]/px_scale
                    next_mesh=trimesh.Trimesh(vertices=trial,faces=result.faces,process=False)
                    if next_mesh.is_volume and next_mesh.is_watertight:
                        after=silhouette(Mesh(next_mesh.vertices,next_mesh.faces,
                              np.zeros(len(next_mesh.faces),dtype=np.int16),
                              np.empty((0,3),dtype=np.int32),[]),camera,size)>96
                        from .evolution import iou
                        before_score=float(iou(target,baseline));after_score=float(iou(target,after))
                        record.update(guidance_before_iou=before_score,guidance_trial_iou=after_score)
                        if after_score>before_score+1e-8:
                            result=next_mesh
                            record.update(guidance_applied=True,guided_vertices=len(pick))
    return result,record
