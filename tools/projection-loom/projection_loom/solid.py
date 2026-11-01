"""Constructive-solid architecture with certified internal contact evidence.

Geometry derives from a rooted directed acyclic graph of CAD volumes.
Attached parts occupy positive-volume intersections with their parents;
a single valid Boolean union is the authoritative production solid.
"""
from __future__ import annotations
from dataclasses import dataclass
from collections import defaultdict
from pathlib import Path
import json
import math
import cadquery as cq
import numpy as np
import networkx as nx

@dataclass(frozen=True)
class Part:
    name: str
    solid: object
    parents: tuple[str, ...]
    role: str
    material: int
    min_overlap: float
    has: tuple[str, ...] = ()
    slot: str | None = None
    anonymous: bool = False


def box(center, size, taper=0.0):
    """Watertight box with optional straight-sided taper toward its roof."""
    x,y,z = [float(t) for t in center]
    w,d,h = [float(t) for t in size]
    if min(w,d,h)<=0:raise ValueError('Solid dimensions must be positive')
    if not 0<=float(taper)<0.85:raise ValueError('Taper must be in [0, .85)')
    if taper==0:
        return cq.Workplane('XY').box(w,d,h).val().translate((x,y,z))
    lower=cq.Workplane('XY').workplane(offset=z-h/2).rect(w,d).val()
    upper=cq.Workplane('XY').workplane(offset=z+h/2).rect(w*(1-taper),d*(1-taper)).val()
    return cq.Solid.makeLoft([lower,upper],ruled=True).translate((x,y,0))


def faceted_loft(sections, sides=8, phase=0.0, jaggedness=0.08):
    """Faceted continuous spine with project-defined cross sections.

    Every section supplies z, center_x, center_y, radius_x, radius_y.
    """
    wires=[]
    for z,cx,cy,rx,ry in sections:
        if min(rx,ry)<=0:raise ValueError('Each section requires positive radii')
        pts=[]
        for j in range(sides):
            angle=2*math.pi*j/sides + phase
            radius_adjust=1+jaggedness*math.sin(j*2.34+.35)
            pts.append((cx+rx*math.cos(angle)*radius_adjust,
                        cy+ry*math.sin(angle)*radius_adjust))
        wires.append(cq.Workplane('XY').workplane(offset=float(z)).polyline(pts).close().val())
    result=cq.Solid.makeLoft(wires,ruled=True)
    if not result.isValid():raise ValueError('Loft produced an invalid BRep')
    return result


def beam(start,end,width,depth):
    """Watertight square-section member between two solid anchor locations."""
    start=np.asarray(start,dtype=float);end=np.asarray(end,dtype=float)
    delta=end-start
    length=float(np.linalg.norm(delta))
    if length<1e-5 or min(width,depth)<=0:raise ValueError('Invalid beam')
    plane=cq.Plane(origin=cq.Vector(*start),normal=cq.Vector(*(delta/length)))
    return cq.Workplane(plane).rect(float(width),float(depth)).extrude(length).val()


def _bbox_dims(shape):
    bb=shape.BoundingBox()
    return np.array([bb.xlen,bb.ylen,bb.zlen],dtype=float)


def _extent(shape):
    bb=shape.BoundingBox();return (np.array([bb.xmin,bb.ymin,bb.zmin]),np.array([bb.xmax,bb.ymax,bb.zmax]))


class SolidAssembly:
    def __init__(self, *, overlap_ratio=.012, thickness_ratio=.035):
        self.parts={}
        self.overlap_ratio=float(overlap_ratio)
        self.thickness_ratio=float(thickness_ratio)
        self.voids=None
        self._verified_material=None
        self._verified_audit=None

    def add(self,name,solid,*,parents=(),role='primary',material=0,min_overlap=None,has=(),slot=None):
        from .relations import capabilities
        anonymous = name is None
        name = (f'~p-{len(self.parts)+1:04d}' if anonymous else str(name).strip())
        if not name or (name.startswith('~p-') and not anonymous):
            raise ValueError('Reserved or empty construction handle')
        if slot is not None:
            slot = str(slot).strip()
            if not slot or any(p.slot == slot for p in self.parts.values()):
                raise ValueError('Slot must be a unique nonempty construction relation')
        parents=tuple(parents)
        if name in self.parts:raise ValueError(f'Duplicate part: {name}')
        if not solid.isValid() or len(solid.Solids())!=1 or solid.Volume()<=0:
            raise ValueError(f'Part {name} must be one valid positive-volume CAD solid')
        if role not in ('foundation','primary','secondary','detail'):
            raise ValueError('Unsupported structural role')
        if not self.parts and parents:raise ValueError('The first part must be a root')
        if self.parts and not parents:raise ValueError(f'{name} must name at least one parent')
        if any(p not in self.parts for p in parents):raise ValueError(f'Missing parent of {name}: {parents}')
        part=Part(name,solid,parents,role,int(material),float(self.overlap_ratio if min_overlap is None else min_overlap),capabilities(has),slot,anonymous)
        self.parts[name]=part
        self._verified_material=None
        self._verified_audit=None
        return self

    def add_box(self,name,center,size,*,parents,role='primary',material=0,taper=0,min_overlap=None,has=(),slot=None):
        return self.add(name,box(center,size,taper=taper),parents=parents,role=role,material=material,min_overlap=min_overlap,has=has,slot=slot)

    def add_beam(self,name,start,end,width,depth,*,parents,role='secondary',material=2,min_overlap=None,has=(),slot=None):
        return self.add(name,beam(start,end,width,depth),parents=parents,role=role,material=material,min_overlap=min_overlap,has=has,slot=slot)

    def spawn(self, solid, *, parents=(), role='secondary', material=2, has=(), slot=None, min_overlap=None):
        '''Grow an unnamed part; return an internal handle for downstream relations.'''
        self.add(None, solid, parents=parents, role=role, material=material,
                 has=has, slot=slot, min_overlap=min_overlap)
        return next(reversed(self.parts))

    def relation_witness(self, *, location='untitled-location'):
        from .relations import RelationWitness
        return RelationWitness.from_assembly(self, location=location)

    def contact(self,parent,child):
        a=self.parts[parent];b=self.parts[child]
        common=a.solid.intersect(b.solid)
        vol=max(0.,float(common.Volume()))
        ref=min(float(a.solid.Volume()),float(b.solid.Volume()))
        small_extent=max(1e-9,min(float(np.min(_bbox_dims(a.solid))),float(np.min(_bbox_dims(b.solid)))))
        bbox_min=float(np.min(_bbox_dims(common))) if vol>1e-9 else 0.
        threshold=max(1e-7,b.min_overlap*ref)
        required_thickness=self.thickness_ratio*small_extent
        return {'parent':parent,'child':child,'overlap_volume':vol,'volume_ratio':vol/max(ref,1e-10),
                'minimum_intersection_extent':bbox_min,'required_volume':threshold,
                'required_thickness':required_thickness,
                'valid':bool(vol>=threshold and bbox_min>=required_thickness)}

    def audit(self, *, join=False):
        # A complete, immutable assembly may reuse its verified BRep receipt.
        # add()/add_void() invalidate both CAD material and audit together.
        if join and self._verified_audit is not None:
            from copy import deepcopy
            return deepcopy(self._verified_audit)
        graph=nx.DiGraph()
        graph.add_nodes_from(self.parts)
        for part in self.parts.values():
            for parent in part.parents:graph.add_edge(parent,part.name)
        if not nx.is_directed_acyclic_graph(graph):raise ValueError('Support graph contains a cycle')
        roots=[n for n in graph if graph.in_degree(n)==0]
        if len(roots)!=1:raise ValueError('Exactly one physical foundation is required')
        if set(nx.descendants(graph,roots[0]))|set(roots)!=set(graph):
            raise ValueError('Every part must descend from the root')
        joints=[self.contact(parent,child) for part in self.parts.values() for parent in part.parents for child in (part.name,)]
        valid=all(j['valid'] for j in joints)
        result={'valid_joints':valid,'root':roots[0], 'parts':len(self.parts),
                'joints':len(joints),'failed':[j for j in joints if not j['valid']],
                'weakest_volume_ratio':min((j['volume_ratio'] for j in joints),default=1.),
                'min_intersection_extent':min((j['minimum_intersection_extent'] for j in joints),default=0.),
                'contacts':joints}
        result['valid']=valid
        if not join or not valid:
            return result
        fused=self.fuse()
        solids=fused.Solids()
        result.update({'union_solids':len(solids),'union_valid':bool(fused.isValid()),
                       'union_volume':float(fused.Volume())})
        result['valid']=bool(fused.isValid() and len(solids)==1)
        if not result['valid']:
            return result
        if self.voids is None:
            self._verified_material=fused
        else:
            void_report=self.voids.audit(shell=fused)
            result['voids']={k:v for k,v in void_report.items() if k!='carved'}
            result['valid']=bool(void_report['valid'])
            self._verified_material=void_report['carved'] if result['valid'] else None
        if result['valid']:
            from copy import deepcopy
            self._verified_audit=deepcopy(result)
        return result

    def add_void(self,name,solid,*,kind='room',connects=(),exterior=False,has=(),slot=None,host=None):
        from .voids import VoidAssembly
        if self.voids is None:self.voids=VoidAssembly(self)
        self._verified_material=None
        self._verified_audit=None
        self.voids.add(name,solid,kind=kind,connects=connects,exterior=exterior,has=has,slot=slot,host=host)
        return self

    def spawn_void(self, solid, *, kind='room', connects=(), exterior=False, has=(), slot=None, host=None):
        '''Grow an unnamed void; return its internal handle for later route links.'''
        self.add_void(None, solid, kind=kind, connects=connects, exterior=exterior,
                      has=has, slot=slot, host=host)
        return next(reversed(self.voids.voids))

    def material_solid(self):
        if self._verified_material is None:
            audit=self.audit(join=True)
            if not audit['valid']:
                raise ValueError('Material solid has not passed structural and void checks')
        return self._verified_material

    def fuse(self):
        if not self.parts:raise ValueError('Empty assembly')
        parts=list(self.parts.values())
        # Fuse in the declared support order; touching solids must have an actual overlap.
        result=parts[0].solid
        for part in parts[1:]:
            result=result.fuse(part.solid)
        if not result.isValid() or len(result.Solids())!=1:
            raise ValueError(f'Solid union did not produce one valid solid; count={len(result.Solids())}')
        return result

    def tessellate(self,linear=0.16,angular=0.2,*,union=False):
        """Render transport mesh; never feeds mutations or construction."""
        from .geometry import Mesh
        selected=[('fused',self.material_solid(),0,'foundation')] if union else [
            (p.name,p.solid,p.material,p.role) for p in self.parts.values()]
        vertices=[];faces=[];materials=[];parts=[];edges=[]
        for name,solid,mat,role in selected:
            vs,fs=solid.tessellate(float(linear),float(angular))
            offset=len(vertices); first=len(faces)
            vertices.extend(v.toTuple() for v in vs)
            faces.extend([[int(k)+offset for k in tri] for tri in fs])
            materials.extend([int(mat)]*len(fs))
            parts.append({'name':name,'first_face':first,'num_faces':len(fs),'line_role':
                          ('primary' if role in ('foundation','primary') else role)})
            for a,b in _crease_edges(vs,fs):edges.append((a+offset,b+offset,mat))
        return Mesh(vertices,faces,materials,edges,parts)


def _crease_edges(verts, faces, threshold=.36):
    tris=np.asarray(faces,dtype=int)
    xyz=np.array([v.toTuple() for v in verts],dtype=np.float64)
    ft=xyz[tris]
    n=np.cross(ft[:,1]-ft[:,0],ft[:,2]-ft[:,0]);n/=np.maximum(1e-12,np.linalg.norm(n,axis=1,keepdims=True))
    groups=defaultdict(list)
    for fi,(a,b,c) in enumerate(tris):
        for u,v in ((a,b),(b,c),(c,a)):groups[tuple(sorted((int(u),int(v))))].append(fi)
    selected=[]
    for pair,attached in groups.items():
        if len(attached)!=2 or abs(float(n[attached[0]]@n[attached[1]]))<1-threshold:
            selected.append(pair)
    return selected
