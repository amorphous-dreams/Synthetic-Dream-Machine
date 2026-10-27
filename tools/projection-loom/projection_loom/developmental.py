"""Bounded developmental construction genomes, not fixed-scene offsets.

Every rule grows actual CAD; typed sites are semantic coordinates reconstructed
from parents, never kernel face IDs or claims of physical load capacity.
"""
from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Mapping
import json
import math
import random

from .intent_seed import GrowthContext
from .solid import SolidAssembly, box, beam
from .provenance_encoding import canonical_json_sha256

FACES=("up","east","west","north","south")
OPS=("foundation","spawn","split","bridge","carve")
MAX_NODES=64
MAX_DEPTH=16


def _vec(values,n=3):
    if not isinstance(values,(list,tuple)) or len(values)!=n:
        raise ValueError("Expected finite vector")
    result=tuple(float(x) for x in values)
    if any(not math.isfinite(x) for x in result):
        raise ValueError("Nonfinite construction parameter")
    return result


@dataclass(frozen=True)
class GrowthNode:
    key: str
    op: str
    parent: str | None = None
    face: str | None = None
    size: tuple[float,float,float] = (2.,2.,1.)
    offset: tuple[float,float] = (0.,0.)
    target: str | None = None
    repeats: int = 1

    def __post_init__(self):
        if (not isinstance(self.key,str) or not self.key or
                not self.key.replace("-","").replace("_","").isalnum()):
            raise ValueError("Rule key must have an unambiguous technical handle")
        if self.op not in OPS:
            raise ValueError("Unknown developmental operator")
        object.__setattr__(self,"size",_vec(self.size))
        object.__setattr__(self,"offset",_vec(self.offset,2))
        if min(self.size)<=0:
            raise ValueError("All dimensions must remain positive")
        if type(self.repeats) is not int or not 1<=self.repeats<=8:
            raise ValueError("Repeat operator requires a bounded count")
        if self.op=="foundation":
            if self.parent is not None or self.target is not None:
                raise ValueError("Foundation cannot have parent")
        elif not self.parent:
            raise ValueError("Constructive growth needs a supporting parent")
        if self.op in ("spawn","split") and self.face not in FACES:
            raise ValueError("Spawn requires a semantic support face")
        if self.op=="bridge" and not self.target:
            raise ValueError("Bridge requires another existing support")
        if self.op=="carve" and not self.target:
            raise ValueError("Carve requires a declared host")

    def as_dict(self):
        return {key:getattr(self,key) for key in
                ("key","op","parent","face","size","offset","target","repeats")}


@dataclass(frozen=True)
class GrowthProgram:
    nodes: tuple[GrowthNode,...]

    def __post_init__(self):
        if not self.nodes or len(self.nodes)>MAX_NODES:
            raise ValueError("Bounded nonempty growth program required")
        if sum(n.repeats for n in self.nodes)>MAX_NODES:
            raise ValueError("Expanded construction exceeds node budget")
        seen=set()
        depths={}
        for i,n in enumerate(self.nodes):
            if n.key in seen:
                raise ValueError("Duplicate construction rule")
            if i==0 and n.op!="foundation" or i>0 and n.op=="foundation":
                raise ValueError("A program needs one root rule")
            if n.parent and n.parent not in seen:
                raise ValueError("Parent must precede child")
            if n.target and n.target not in seen:
                raise ValueError("Target must precede dependent operation")
            seen.add(n.key)
            depths[n.key]=depths.get(n.parent,0)+1
            if depths[n.key]>MAX_DEPTH:
                raise ValueError("Excessive developmental depth")

    @property
    def identity(self):
        return canonical_json_sha256([n.as_dict() for n in self.nodes])

    @classmethod
    def from_dict(cls,data):
        if set(data)!={"nodes"} or not isinstance(data["nodes"],list):
            raise ValueError("Invalid developmental genome")
        return cls(tuple(GrowthNode(**x) for x in data["nodes"]))

    def to_dict(self):
        return {"nodes":[n.as_dict() for n in self.nodes],
                "genome_sha256":self.identity}


@dataclass(frozen=True)
class GrowthSite:
    address: str
    producer: str
    face: str
    center: tuple[float,float,float]
    normal: tuple[int,int,int]
    capacity: tuple[float,float]
    authority: str = "proposed-placement"

    def __post_init__(self):
        if self.face not in FACES or min(self.capacity)<=0:
            raise ValueError("Invalid semantic site geometry")


def _sites(part):
    bb=part.solid.BoundingBox()
    cx=(bb.xmin+bb.xmax)/2
    cy=(bb.ymin+bb.ymax)/2
    cz=(bb.zmin+bb.zmax)/2
    entries={
        "up":((cx,cy,bb.zmax),(0,0,1),(bb.xlen,bb.ylen)),
        "east":((bb.xmax,cy,cz),(1,0,0),(bb.ylen,bb.zlen)),
        "west":((bb.xmin,cy,cz),(-1,0,0),(bb.ylen,bb.zlen)),
        "north":((cx,bb.ymax,cz),(0,1,0),(bb.xlen,bb.zlen)),
        "south":((cx,bb.ymin,cz),(0,-1,0),(bb.xlen,bb.zlen)),
    }
    return {face:GrowthSite(part.name+"/"+face,part.name,face,*details)
            for face,details in entries.items()}


def _spawn_at(site:GrowthSite,size,offset,clearance):
    width,depth,height=size
    x,y,z=site.center
    normal=site.normal
    if site.face=="up":
        center=(x+offset[0],y+offset[1],z+height/2-clearance)
    elif site.face in ("east","west"):
        center=(x+normal[0]*(width/2-clearance),y+offset[0],z+offset[1])
    else:
        center=(x+offset[0],y+normal[1]*(depth/2-clearance),z+offset[1])
    return center


@dataclass
class DevelopmentResult:
    assembly: SolidAssembly
    sites: dict
    relationships: tuple
    genome_sha256: str

    def audit(self):
        report=self.assembly.audit(join=True)
        if not report["valid"] or not report.get("union_valid"):
            raise ValueError("Native developmental candidate not admitted")
        return report


def compile_growth(program:GrowthProgram,*,overlap=.20,native_audit=True):
    if not .05<=overlap<=.5:
        raise ValueError("Bounded geometric overlap needed")
    a=SolidAssembly(overlap_ratio=.005,thickness_ratio=.015)
    sites={}
    relationship=[]
    handles={}
    for node in program.nodes:
        if node.op=="foundation":
            a.add_box(node.key,(0,0,node.size[2]/2),node.size,
                      parents=(),role="foundation",slot=node.key)
            handles[node.key]=[node.key]
            sites.update(_sites(a.parts[node.key]))
            continue
        parent=handles[node.parent][-1]
        if node.op in ("spawn","split"):
            for i in range(node.repeats):
                name=node.key if node.repeats==1 else f"{node.key}-{i:02d}"
                site=sites[parent+"/"+node.face]
                shift=node.offset
                if node.repeats>1:
                    # Distribute siblings around the same stable surface socket.
                    shift=(node.offset[0]+(i-(node.repeats-1)/2)*node.size[0]*.65,
                           node.offset[1])
                center=_spawn_at(site,node.size,shift,overlap)
                a.add_box(name,center,node.size,parents=(parent,),
                          role="primary",slot=name,has=("#has/constructed",))
                relationship.append((name,"bears-on",parent))
                sites.update(_sites(a.parts[name]))
                handles[node.key]=[*(handles.get(node.key,[])),name]
        elif node.op=="bridge":
            target=handles[node.target][-1]
            p=a.parts[parent].solid.Center()
            q=a.parts[target].solid.Center()
            a.add_beam(node.key,(p.x,p.y,p.z),(q.x,q.y,q.z),
                       width=node.size[0],depth=node.size[1],
                       parents=(parent,target),role="secondary",slot=node.key)
            relationship.extend(((node.key,"bridges",parent),(node.key,"bridges",target)))
            handles[node.key]=[node.key]
            sites.update(_sites(a.parts[node.key]))
        elif node.op=="carve":
            host=handles[node.target][-1]
            bb=a.parts[host].solid.BoundingBox()
            center=((bb.xmin+bb.xmax)/2+node.offset[0],
                    (bb.ymin+bb.ymax)/2+node.offset[1],
                    (bb.zmin+bb.zmax)/2)
            a.add_void(node.key,box(center,node.size),host=host,
                       kind="room",exterior=False,slot=node.key)
            handles[node.key]=[node.key]
            relationship.append((node.key,"carves",host))
    result=DevelopmentResult(a,sites,tuple(relationship),program.identity)
    if native_audit:result.audit()
    return result


def mutate_growth(program:GrowthProgram,context:GrowthContext,*,epoch,child,
                  edits=1):
    """Semantic mutation: numeric, subtree replacement, insertion or pruning.

    Fixed keyed RNG ensures worker-independent identity. Invalid mutations
    reject transactionally without modifying the parent program.
    """
    rng=random.Random(context.substream_seed("growth",epoch,child))
    current=list(program.nodes)
    for _ in range(edits):
        options=["rescale","offset","substitute","insert","prune","reparent"]
        op=rng.choice(options)
        if op=="prune" and len(current)>1:
            children={n.parent for n in current if n.parent}
            leaves=[i for i,n in enumerate(current) if i and n.key not in children
                    and all(m.target!=n.key for m in current)]
            if leaves:
                current.pop(rng.choice(leaves))
                continue
        if op=="insert" and len(current)<MAX_NODES-1:
            target=rng.choice(current)
            if target.op=="carve":continue
            name=f"branch_{epoch}_{child}_{len(current)}"
            if name in {n.key for n in current}:continue
            current.append(GrowthNode(name,"spawn",parent=target.key,face=rng.choice(FACES),
                                      size=(1.4,1.4,1.),offset=(0.,0.)))
            continue
        eligible=[i for i,n in enumerate(current) if i and n.op in ("spawn","split")]
        if not eligible:continue
        i=rng.choice(eligible)
        node=current[i]
        if op=="reparent":
            predecessors=[n for n in current[:i] if n.op!="carve"]
            if predecessors:
                current[i]=replace(node,parent=rng.choice(predecessors).key)
        elif op=="substitute":
            current[i]=replace(node,face=rng.choice(FACES))
        elif op=="offset":
            current[i]=replace(node,offset=(round(node.offset[0]+rng.uniform(-.35,.35),5),
                                           round(node.offset[1]+rng.uniform(-.35,.35),5)))
        else:
            scale=rng.uniform(.82,1.18)
            current[i]=replace(node,size=tuple(round(v*scale,5) for v in node.size))
    return GrowthProgram(tuple(current))


def crossover_growth(left:GrowthProgram,right:GrowthProgram,context:GrowthContext,*,epoch,child):
    """A donor subtree graft requires explicit boundary rebinding.

    Preserve target topology and graft a donor *leaf* onto a valid parent;
    collision/conflict remains subject to native CAD admission.
    """
    rng=random.Random(context.substream_seed("crossover",epoch,child))
    parents=[n for n in left.nodes if n.op!="carve"]
    donor=[n for n in right.nodes[1:] if n.op in ("spawn","split")]
    if not donor or len(left.nodes)>=MAX_NODES:
        return left
    p=rng.choice(parents)
    chosen=rng.choice(donor)
    name=f"graft_{epoch}_{child}"
    if name in {n.key for n in left.nodes}:
        raise ValueError("Crossover needs unique graft slot")
    return GrowthProgram((*left.nodes,replace(chosen,key=name,parent=p.key,repeats=1)))
