"""Volumetric joint evidence for multipart geometric assemblies.

AABB overlap is only a broad-phase test. A positive Chebyshev radius in the
intersection of two CLOSED CONVEX volumes supports an interior overlap; zero
radius also includes face/edge/vertex touching and gaps. Open or nonconvex
parts never receive a positive 'verified' verdict from their convex hulls.
Numerical tolerances and role-scaled thresholds belong to project policy.
"""
from __future__ import annotations
from dataclasses import dataclass
import numpy as np
from scipy.optimize import linprog
from scipy.spatial import ConvexHull, QhullError
import trimesh

@dataclass
class PartSolid:
    name: str
    vertices: np.ndarray
    faces: np.ndarray
    bounds: np.ndarray
    planes: np.ndarray | None
    is_watertight: bool
    convex: bool
    reliable: bool
    smallest_extent: float
    volume: float | None


def part_solids(mesh, convexity_tolerance=1e-4):
    V=np.asarray(mesh.vertices, dtype=float)
    F=np.asarray(mesh.faces, dtype=np.int32)
    result={}
    for part in mesh.parts:
        first=int(part['first_face']); stop=first+int(part['num_faces'])
        if first<0 or stop>len(F) or first>=stop:
            raise ValueError(f'Invalid face range for {part["name"]}')
        f=F[first:stop]
        u,local=np.unique(f,return_inverse=True)
        verts=V[u]
        tri=local.reshape(-1,3)
        surface=trimesh.Trimesh(vertices=verts,faces=tri,process=False)
        b=np.stack([verts.min(0),verts.max(0)])
        smallest=float(np.min(np.maximum(b[1]-b[0],0)))
        hull=None; planes=None; convex=False
        try:
            hull=ConvexHull(verts)
            planes=np.asarray(hull.equations,dtype=float)
            vol=abs(float(surface.volume)) if surface.is_watertight else None
            convex=bool(vol is not None and vol > 1e-10 and
                        abs(float(hull.volume)-vol)/max(float(hull.volume),1e-10)<=convexity_tolerance)
        except (QhullError,ValueError,FloatingPointError):
            vol=None
        # A declared type never substitutes for measured convexity or closure.
        reliable=bool(surface.is_watertight and planes is not None and convex)
        result[part['name']]=PartSolid(part['name'],verts,tri,b,planes,bool(surface.is_watertight),
                                      convex,reliable,smallest,vol)
    return result


def aabb_gap(a,b):
    return float(np.linalg.norm(np.maximum(0.,np.maximum(a.bounds[0]-b.bounds[1], b.bounds[0]-a.bounds[1]))))


def overlap(a,b,threshold=0.,tolerance=1e-8):
    """Intersection's maximum inscribed-ball radius, with confidence labeling."""
    if aabb_gap(a,b)>tolerance:
        return {'status':'disjoint','radius':0.,'center':None,'verified':True,'meets_threshold':False}
    if a.planes is None or b.planes is None:
        return {'status':'unknown_mesh','radius':None,'center':None,'verified':False,'meets_threshold':False}
    faces=np.vstack((a.planes,b.planes))
    A=np.column_stack((faces[:,:3],np.linalg.norm(faces[:,:3],axis=1)))
    res=linprog([0,0,0,-1.], A_ub=A, b_ub=-faces[:,3],
                bounds=[(None,None)]*3+[(0.,None)],method='highs')
    if not res.success:
        if res.status==2:
            return {'status':'disjoint','radius':0.,'center':None,'verified':bool(a.reliable and b.reliable),'meets_threshold':False}
        return {'status':f'unknown_solver_{res.status}','radius':None,'center':None,'verified':False,'meets_threshold':False}
    radius=max(0.,float(res.x[3]))
    reliable=bool(a.reliable and b.reliable)
    status=('volume_overlap' if radius>tolerance else 'zero_thickness') if reliable else 'hull_proxy_only'
    return {'status':status,'radius':radius,'center':[float(v) for v in res.x[:3]],
            'verified':reliable,'meets_threshold':bool(reliable and radius+1e-9>=threshold and radius>tolerance)}


def audit_joint(solids,parent,child,min_radius=None,min_ratio=0.055,tolerance=1e-8):
    if parent not in solids or child not in solids:
        raise KeyError(f'Unknown part in joint {parent!r} -> {child!r}')
    a,b=solids[parent],solids[child]
    # Thickness scaled to smaller part, not full asset diagonal.
    size=max(1e-9,min(a.smallest_extent,b.smallest_extent))
    threshold=max(float(min_radius or 0),float(min_ratio)*size)
    evidence=overlap(a,b,threshold=threshold,tolerance=tolerance)
    return {'parent':parent,'child':child,'required_radius':float(threshold),**evidence}


def audit_pairs(mesh, pairs, min_ratio=.055):
    solids=part_solids(mesh)
    result=[]
    for link in pairs:
        if isinstance(link,dict):
            parent,child=link['parent'],link['child']
            radius=link.get('min_radius',0.)
            ratio=link.get('min_ratio',min_ratio)
        else:
            parent,child=link
            radius=0.;ratio=min_ratio
        result.append(audit_joint(solids,parent,child,min_radius=radius,min_ratio=ratio))
    return result
