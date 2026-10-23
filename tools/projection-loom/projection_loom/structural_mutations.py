"""Rooted constructive architecture with explicit, measurable attachment volumes.

The grammar places new solids relative to a named parent. An optional brace
operator creates a separate REVIEWABLE connector; it never silently dilates or
repairs the silhouette of an imported mesh.
"""
from __future__ import annotations
from dataclasses import dataclass
import numpy as np
from .geometry import Assembly
from .architecture_graph import ArchitectureGraph

_AXES={'x':0,'y':1,'z':2}

@dataclass
class ConstructionGrammar:
    assembly: Assembly
    roots: list
    links: list
    roles: dict

    def __init__(self):
        self.assembly=Assembly();self.roots=[];self.links=[];self.roles={}

    def _bounds(self,name):
        p=next((i for i in self.assembly.parts if i['name']==name),None)
        if p is None:raise KeyError(name)
        f=np.asarray(self.assembly.faces,dtype=int)[p['first_face']:p['first_face']+p['num_faces']]
        v=np.asarray(self.assembly.vertices,dtype=float)[np.unique(f)]
        return v.min(0),v.max(0)

    def foundation(self,name,center,extent,material=0):
        if any(x['name']==name for x in self.assembly.parts):raise ValueError('Duplicate part name')
        self.assembly.prism(name,center,extent,material)
        self.roots.append(name);self.roles[name]='foundation'
        return self

    def attach_prism(self,name,parent,extent,axis='z',sign=1,overlap=.18,
                     lateral=(0,0),material=1,role='primary',min_ratio=.055):
        """Grow a box from a parent's face with an explicit penetration depth.

        overlap is measured in the attached prism's axis length. Lateral offsets
        are in the two remaining plane axes and must preserve an intersection.
        """
        if any(x['name']==name for x in self.assembly.parts):raise ValueError('Duplicate part name')
        if axis not in _AXES or sign not in (-1,1) or not (0<overlap<.95):
            raise ValueError('Invalid face attachment')
        extent=np.asarray(extent,dtype=float)
        if (extent<=0).any():raise ValueError('Positive dimensions required')
        low,high=self._bounds(parent)
        d=_AXES[axis]
        center=.5*(low+high)
        center[d]=((high[d]-overlap*extent[d]) if sign==1 else (low[d]-(1-overlap)*extent[d])) if d==2 else (high[d] if sign==1 else low[d])+sign*extent[d]*(0.5-overlap)
        k=[i for i in range(3) if i!=d]
        center[k[0]]+=float(lateral[0]);center[k[1]]+=float(lateral[1])
        self.assembly.prism(name,tuple(center),tuple(extent),material)
        self.links.append({'parent':parent,'child':name,'min_ratio':min_ratio})
        self.roles[name]=role
        return self

    def brace(self,name,parent,child,width,depth,material=0,min_ratio=.055):
        """Explicit support proposal joining the interiors of two named volumes.

        The caller, not the optimizer, authorizes the visible new member.
        This may change the silhouette. A validation audit follows before use.
        """
        if width<=0 or depth<=0:raise ValueError('Support section must be positive')
        a,b=self._bounds(parent),self._bounds(child)
        p=.5*(a[0]+a[1]);q=.5*(b[0]+b[1])
        if np.linalg.norm(q-p)<1e-7:raise ValueError('Supports require distinct anchors')
        self.assembly.beam(name,p,q,width,depth,material)
        self.links.extend([{'parent':parent,'child':name,'min_ratio':min_ratio},
                           {'parent':name,'child':child,'min_ratio':min_ratio}])
        self.roles[name]='secondary'
        return self

    def model(self):return self.assembly.mesh()

    def graph(self,policy='gate'):
        return ArchitectureGraph(self.roots,self.links,self.roles,policy)


def apply_structural_operations(mesh,operations,parameters=None):
    """Apply explicit constructive operators to a mesh before validation.

    Each operator comes from a project manifest; the library does not invent
    connectors from a silhouette or assume magical exemption.
    """
    parameters=dict(parameters or {})
    out=Assembly.from_mesh(mesh)
    existing={p['name'] for p in out.parts}
    for op in operations:
        name=op['name']
        if name in existing:
            continue  # existing checkpoint retains this authored support
        if op['operation']!='brace':
            raise ValueError(f'Unsupported structural operation: {op["operation"]}')
        a,b=op['parent'],op['child']
        if a not in existing or b not in existing:
            raise KeyError(f'Missing attachment anchor for {name}: {a}, {b}')
        bounds={}
        verts=np.asarray(out.vertices,dtype=float)
        faces=np.asarray(out.faces,dtype=int)
        for p in out.parts:
            if p['name'] in (a,b):
                f=faces[p['first_face']:p['first_face']+p['num_faces']]
                xyz=verts[np.unique(f)]
                bounds[p['name']]=xyz.mean(0)
        thick=float(parameters.get(op.get('width_parameter',''),op.get('width',.14)))
        depth=float(parameters.get(op.get('depth_parameter',''),op.get('depth',thick)))
        if min(thick,depth)<=0:
            raise ValueError('Structural brace width and depth must be positive')
        out.beam(name,bounds[a],bounds[b],thick,depth,int(op.get('material',0)))
        existing.add(name)
    return out.mesh()
