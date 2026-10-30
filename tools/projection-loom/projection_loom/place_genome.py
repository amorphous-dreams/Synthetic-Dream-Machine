"""Heritable multi-body architectural location, not a world-scale fused solid.

Existing GrowthProgram rules still build each independent exact native body.
Explicit semantic walkway links consume named bodies; they only become evidence
after a STEP-based contact and clearance witness in place_affordances.
"""
from __future__ import annotations
from dataclasses import dataclass, replace
from math import isfinite
import random
import re
from .developmental import GrowthProgram
from .provenance_encoding import canonical_json_sha256

_NAME=re.compile(r"^[A-Za-z][A-Za-z0-9_-]{0,63}$")


@dataclass(frozen=True)
class PlaceBody:
    entity_id: str
    program: GrowthProgram
    translation: tuple[float,float,float]

    def __post_init__(self):
        if not isinstance(self.entity_id,str) or not _NAME.fullmatch(self.entity_id):
            raise ValueError("Location body requires a bounded semantic ID")
        if not isinstance(self.program,GrowthProgram):
            raise ValueError("Location body must carry native construction ancestry")
        if len(self.translation)!=3 or any(type(v) not in (int,float) or not isfinite(v)
                                          or abs(v)>10000 for v in self.translation):
            raise ValueError("Location body needs bounded finite authored placement")

    def to_dict(self):
        return {"entity_id":self.entity_id,"growth_program":{"nodes":[n.as_dict() for n in self.program.nodes]},
                "translation":[float(x) for x in self.translation]}

    @classmethod
    def from_dict(cls,doc):
        if not isinstance(doc,dict) or set(doc)!={"entity_id","growth_program","translation"}:
            raise ValueError("Location body requires exact construction and placement")
        return cls(doc["entity_id"],GrowthProgram.from_dict(doc["growth_program"]),
                   tuple(doc["translation"]))


@dataclass(frozen=True)
class Walkway:
    source: str
    deck: str
    destination: str

    def __post_init__(self):
        if (not all(isinstance(x,str) and _NAME.fullmatch(x)
                    for x in (self.source,self.deck,self.destination))
                or len({self.source,self.deck,self.destination})!=3):
            raise ValueError("Walkway needs distinct named native bodies")

    def to_dict(self):
        return {"source":self.source,"deck":self.deck,"destination":self.destination}

    @classmethod
    def from_dict(cls,doc):
        if not isinstance(doc,dict) or set(doc)!={"source","deck","destination"}:
            raise ValueError("Walkway requires exact endpoints and native deck")
        return cls(**doc)


@dataclass(frozen=True)
class AscentRun:
    """Operator-authored ordered rising tread handles, not an inferred path."""
    source: str
    steps: tuple[str,...]
    destination: str

    def __post_init__(self):
        names=(self.source,*self.steps,self.destination)
        if (not 1<=len(self.steps)<=8 or len(set(names))!=len(names)
                or any(not isinstance(n,str) or not _NAME.fullmatch(n) for n in names)):
            raise ValueError("Ascent requires distinct named endpoints and one to eight treads")

    def to_dict(self):
        return {"source":self.source,"steps":list(self.steps),"destination":self.destination}

    @classmethod
    def from_dict(cls,doc):
        if not isinstance(doc,dict) or set(doc)!={"source","steps","destination"} or not isinstance(doc["steps"],list):
            raise ValueError("Ascent requires exact source, ordered steps and destination")
        return cls(doc["source"],tuple(doc["steps"]),doc["destination"])


@dataclass(frozen=True)
class PlaceGenome:
    bodies: tuple[PlaceBody,...]
    walkways: tuple[Walkway,...]=()
    ascents: tuple[AscentRun,...]=()

    def __post_init__(self):
        if not 2<=len(self.bodies)<=16 or not all(isinstance(b,PlaceBody) for b in self.bodies):
            raise ValueError("A location requires two to sixteen native bodies")
        ids=[b.entity_id for b in self.bodies]
        if ids!=sorted(ids) or len(set(ids))!=len(ids):
            raise ValueError("Location bodies must have unique sorted semantic IDs")
        if len(self.walkways)>16 or not all(isinstance(x,Walkway) for x in self.walkways):
            raise ValueError("Location walkways must be bounded typed links")
        keys=[(x.source,x.deck,x.destination) for x in self.walkways]
        if len(keys)!=len(set(keys)) or keys!=sorted(keys):
            raise ValueError("Walkways must be unique and sorted")
        if any(not {w.source,w.deck,w.destination}<=set(ids) for w in self.walkways):
            raise ValueError("Walkway endpoints require declared native bodies")
        if len(self.ascents)>8 or any(not isinstance(x,AscentRun) for x in self.ascents):
            raise ValueError("Ascent declarations require bounded typed runs")
        keys=[(a.source,a.steps,a.destination) for a in self.ascents]
        if len(keys)!=len(set(keys)) or keys!=sorted(keys):
            raise ValueError("Ascent runs must be uniquely sorted")
        if any(not set((a.source,*a.steps,a.destination))<=set(ids) for a in self.ascents):
            raise ValueError("Ascent treads require declared native bodies")

    @property
    def identity(self):
        return canonical_json_sha256(self.to_dict())

    def to_dict(self):
        return {"schema":"projection-loom/place-genome",
                "bodies":[b.to_dict() for b in self.bodies],
                "walkways":[w.to_dict() for w in self.walkways],
                "ascents":[a.to_dict() for a in self.ascents]}

    @classmethod
    def from_dict(cls,doc):
        if not isinstance(doc,dict) or set(doc)!={"schema","bodies","walkways","ascents"} or doc.get("schema")!="projection-loom/place-genome":
            raise ValueError("Place genome requires exact typed schema, bodies and walkways")
        return cls(tuple(PlaceBody.from_dict(x) for x in doc["bodies"]),
                   tuple(Walkway.from_dict(x) for x in doc["walkways"]),
                   tuple(AscentRun.from_dict(x) for x in doc["ascents"]))

    def declaration(self,location):
        if not location:
            raise ValueError("Location identity required")
        return {"schema":"projection-loom/scene-declaration","location":location,
                "meters_per_unit":1.0,
                "assemblies":[b.to_dict() for b in self.bodies]}

    def vary(self,seed,*,count=1):
        """Bounded, reproducible native deck-width variants; preserve sources."""
        if type(seed) is not int or not 1<=count<=8:
            raise ValueError("Bounded keyed location mutation required")
        rng=random.Random(seed)
        bodies=list(self.bodies)
        choices=sorted({w.deck for w in self.walkways})
        if not choices:
            # A sheltered or otherwise disconnected location still retains
            # individual constructive bodies that can be mutated without
            # inventing a fake causal walkway.
            choices=sorted(b.entity_id for b in bodies)
        for _ in range(count):
            target=rng.choice(choices)
            i=next(i for i,b in enumerate(bodies) if b.entity_id==target)
            body=bodies[i]
            nodes=list(body.program.nodes)
            root=nodes[0]
            factor=round(rng.uniform(.82,1.18),6)
            if rng.choice(("width","lane"))=="width":
                nodes[0]=replace(root,size=(root.size[0],
                                  max(0.5,round(root.size[1]*factor,6)),root.size[2]))
                bodies[i]=replace(body,program=GrowthProgram(tuple(nodes)))
            else:
                offset=round(rng.uniform(-0.55,0.55),6)
                place=(body.translation[0],round(body.translation[1]+offset,6),
                       body.translation[2])
                bodies[i]=replace(body,translation=place)
        return PlaceGenome(tuple(bodies),self.walkways,self.ascents)

def propose_from_spatial_intent(genome:PlaceGenome,spatial):
    """Construct only a supported two-site native crossing hypothesis.

    This narrow constructor consumes an AUTHORED `connect` relationship,
    not prose or imagery. It handles only two single-foundation bodies on
    equal elevated planes along one horizontal axis with finite cross-width.
    More complex location configurations remain explicit future work.
    """
    from .spatial_intent import SpatialIntent
    from .developmental import GrowthNode
    if not isinstance(genome,PlaceGenome) or not isinstance(spatial,SpatialIntent):
        raise ValueError("Spatial construction requires typed inputs")
    bodies=list(genome.bodies)
    routes=list(genome.walkways)
    for i,goal in enumerate(spatial.goals):
        if goal.kind=="shelter":
            known={b.entity_id:b for b in bodies}
            if goal.object in known:
                continue  # Never overwrite an operator-authored native roof.
            if goal.subject not in known:
                raise ValueError("Intent-grown canopy lacks its named native floor")
            floor=known[goal.subject]
            if len(floor.program.nodes)!=1 or floor.program.nodes[0].op!="foundation":
                raise ValueError("Canopy construction needs a simple measurable native floor")
            root=floor.program.nodes[0]
            if len(bodies)>=16:
                raise ValueError("Bounded native location body budget exceeded")
            roof=PlaceBody(goal.object,GrowthProgram((GrowthNode("root","foundation",
                size=(round(max(root.size[0]+1.,goal.min_width*2),6),
                      round(max(root.size[1]+1.,goal.min_width*2),6),.4)),)),
                (floor.translation[0],floor.translation[1],
                 round(floor.translation[2]+root.size[2]+2.2,6)))
            bodies.append(roof)
            continue
        if goal.kind!="connect":
            continue
        if unique_walkway_chain(PlaceGenome(
                tuple(sorted(bodies,key=lambda x:x.entity_id)),
                tuple(sorted(routes,key=lambda w:(w.source,w.deck,w.destination))),
                ),goal.subject,goal.object):
            continue
        found={b.entity_id:b for b in bodies}
        if goal.subject not in found or goal.object not in found:
            raise ValueError("Spatial bridge intent names unknown support sites")
        a,b=found[goal.subject],found[goal.object]
        if (len(a.program.nodes)!=1 or len(b.program.nodes)!=1
                or a.program.nodes[0].op!="foundation"
                or b.program.nodes[0].op!="foundation"):
            raise ValueError("Authored crossing proposal needs two simple measured native root sites")
        x0,y0,z0=a.translation
        x1,y1,z1=b.translation
        p,q=a.program.nodes[0].size,b.program.nodes[0].size
        delta=(x1-x0,y1-y0)
        axis=0 if abs(delta[0])>=abs(delta[1]) else 1
        other=1-axis
        if (abs(delta[other])>1e-7 or abs(delta[axis])<=1
                or abs((z0+p[2])-(z1+q[2]))>1e-7):
            raise ValueError("Authored crossing currently needs one axis-aligned equally elevated support pair")
        centers=((x0,y0),(x1,y1))
        low=max(centers[0][other]-p[other]/2,centers[1][other]-q[other]/2)
        high=min(centers[0][other]+p[other]/2,centers[1][other]+q[other]/2)
        if high-low<goal.min_width or .5>goal.max_step:
            raise ValueError("Authored crossing lacks width or allowed step height")
        name=f"intent_deck_{i:03d}"
        if name in found:
            raise ValueError("Spatial construction would overwrite an existing entity")
        dimension=[0.,0.,.5]
        dimension[axis]=round(abs(delta[axis])+min(p[axis],q[axis]),6)
        dimension[other]=round(min(2.,high-low),6)
        placement=[0.,0.,round(z0+p[2],6)]
        placement[axis]=round((centers[0][axis]+centers[1][axis])/2,6)
        placement[other]=round((low+high)/2,6)
        deck=PlaceBody(name,GrowthProgram((GrowthNode("root","foundation",
            size=tuple(dimension)),)),tuple(placement))
        bodies.append(deck)
        routes.append(Walkway(goal.subject,name,goal.object))
    return PlaceGenome(tuple(sorted(bodies,key=lambda x:x.entity_id)),
                       tuple(sorted(routes,key=lambda w:(w.source,w.deck,w.destination))),
                       genome.ascents)

def unique_walkway_chain(genome:PlaceGenome,subject,destination,*,max_hops=8):
    """Return the one declared directed route, or refuse unresolved choices."""
    if not isinstance(genome,PlaceGenome) or not 1<=max_hops<=16:
        raise ValueError("Bounded native place graph required")
    adjacency={}
    for w in genome.walkways:
        adjacency.setdefault(w.source,[]).append(w)
    candidates=[]
    def visit(node,seen,chain):
        if len(candidates)>1:
            return
        if node==destination and chain:
            candidates.append(tuple(chain))
            return
        if len(chain)>=max_hops:
            return
        for edge in sorted(adjacency.get(node,()),key=lambda x:(x.destination,x.deck)):
            if edge.destination not in seen:
                visit(edge.destination,seen|{edge.destination},chain+[edge])
    visit(subject,{subject},[])
    if len(candidates)>1:
        raise ValueError("Competing authored walkways require an operator-selected path")
    return candidates[0] if candidates else ()
