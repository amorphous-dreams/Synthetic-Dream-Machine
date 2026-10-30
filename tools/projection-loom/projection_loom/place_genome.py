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
class BearingRun:
    """Explicit native vertical contact chain, NOT a load certificate."""
    lower: str
    column: str
    upper: str

    def __post_init__(self):
        names=(self.lower,self.column,self.upper)
        if len(set(names))!=3 or any(not isinstance(n,str) or not _NAME.fullmatch(n) for n in names):
            raise ValueError("Bearing chain needs three distinct named native bodies")

    def to_dict(self):
        return {"lower":self.lower,"column":self.column,"upper":self.upper}

    @classmethod
    def from_dict(cls,doc):
        if not isinstance(doc,dict) or set(doc)!={"lower","column","upper"}:
            raise ValueError("Bearing chain requires exact native endpoints and column")
        return cls(**doc)


@dataclass(frozen=True)
class PlaceGenome:
    bodies: tuple[PlaceBody,...]
    walkways: tuple[Walkway,...]=()
    ascents: tuple[AscentRun,...]=()
    bearings: tuple[BearingRun,...]=()

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
        if len(self.bearings)>8 or any(not isinstance(b,BearingRun) for b in self.bearings):
            raise ValueError("Native bearing chains must remain bounded")
        rows=[(r.lower,r.column,r.upper) for r in self.bearings]
        if rows!=sorted(set(rows)):
            raise ValueError("Native bearing chains require unique sorted declarations")
        if any(not set((r.lower,r.column,r.upper))<=set(ids) for r in self.bearings):
            raise ValueError("Native bearing chains must resolve all real body handles")

    @property
    def identity(self):
        return canonical_json_sha256(self.to_dict())

    def to_dict(self):
        return {"schema":"projection-loom/place-genome",
                "bodies":[b.to_dict() for b in self.bodies],
                "walkways":[w.to_dict() for w in self.walkways],
                "ascents":[a.to_dict() for a in self.ascents],
                "bearings":[b.to_dict() for b in self.bearings]}

    @classmethod
    def from_dict(cls,doc):
        if not isinstance(doc,dict) or set(doc)!={"schema","bodies","walkways","ascents","bearings"} or doc.get("schema")!="projection-loom/place-genome":
            raise ValueError("Place genome requires exact typed schema, bodies and walkways")
        return cls(tuple(PlaceBody.from_dict(x) for x in doc["bodies"]),
                   tuple(Walkway.from_dict(x) for x in doc["walkways"]),
                   tuple(AscentRun.from_dict(x) for x in doc["ascents"]),
                   tuple(BearingRun.from_dict(x) for x in doc["bearings"]))

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
        return PlaceGenome(tuple(bodies),self.walkways,self.ascents,self.bearings)

    def vary_spatial(self,spatial,seed,*,count=1):
        """Preserve authored contact topology while mutating goal-relevant form.

        This proposal bias carries no native-validity or aesthetic guarantee.
        Exact STEP gates still judge every descendant independently.
        """
        from .spatial_intent import SpatialIntent
        if (not isinstance(spatial,SpatialIntent) or type(seed) is not int
                or type(count) is not int or not 1<=count<=8):
            raise ValueError("Spatial mutation needs bounded attributed goals and seed")
        rng=random.Random(seed)
        current=self
        for index in range(count):
            bodies=list(current.bodies)
            choices=[]
            known={b.entity_id:b for b in bodies}
            for goal in spatial.goals:
                if goal.kind=="bear" and goal.object in known:
                    choices.append(("bear",(goal.object,),0))
                if goal.kind=="shelter" and goal.object in known:
                    choices.append(("shelter",(goal.object,),None))
                elif goal.kind=="ascend":
                    runs=[r for r in current.ascents
                          if r.source==goal.subject and r.destination==goal.object]
                    if len(runs)==1:
                        a,b=known[goal.subject],known[goal.object]
                        axis=0 if abs(b.translation[0]-a.translation[0])>=abs(
                            b.translation[1]-a.translation[1]) else 1
                        choices.append(("ascend",runs[0].steps,1-axis))
                elif goal.kind=="connect":
                    routes=unique_walkway_chain(current,goal.subject,goal.object)
                    if len(routes)==1:
                        a,b=known[goal.subject],known[goal.object]
                        axis=0 if abs(b.translation[0]-a.translation[0])>=abs(
                            b.translation[1]-a.translation[1]) else 1
                        choices.append(("connect",(routes[0].deck,),1-axis))
            if not choices:
                return current.vary(seed+index,count=count-index)
            kind,targets,dim=rng.choice(choices)
            factor=round(rng.uniform(.86,1.14),6)
            updated=[]
            for body in bodies:
                if body.entity_id not in targets:
                    updated.append(body)
                    continue
                nodes=list(body.program.nodes)
                root=nodes[0]
                dimensions=list(root.size)
                if kind=="shelter":
                    for k in (0,1):
                        dimensions[k]=round(max(.5,dimensions[k]*factor),6)
                else:
                    dimensions[dim]=round(max(.5,dimensions[dim]*factor),6)
                nodes[0]=replace(root,size=tuple(dimensions))
                updated.append(replace(body,program=GrowthProgram(tuple(nodes))))
            current=PlaceGenome(tuple(updated),current.walkways,current.ascents,current.bearings)
        return current


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
    ascents=list(genome.ascents)
    bearings=list(genome.bearings)
    # An end-to-end goal may be satisfied by an authored, uniquely
    # connected orthogonal sequence. Construct its direct supported
    # segments BEFORE attempting a diagonal shortcut.
    def _intention_order(item):
        _,goal=item
        if goal.kind=="bear":
            return 2  # Shelter births a declared roof before bearing interpretation.
        if goal.kind!="connect":
            return 0
        known={b.entity_id:b for b in bodies}
        if goal.subject not in known or goal.object not in known:
            return 1
        a,b=known[goal.subject],known[goal.object]
        xy=(abs(a.translation[0]-b.translation[0]),
            abs(a.translation[1]-b.translation[1]))
        return 1 if all(delta>1e-7 for delta in xy) else 0
    for i,goal in sorted(enumerate(spatial.goals),key=_intention_order):
        if goal.kind=="bear":
            if any(b.lower==goal.subject and b.upper==goal.object for b in bearings):
                continue
            known={body.entity_id:body for body in bodies}
            if goal.subject not in known or goal.object not in known:
                raise ValueError("Native bearing construction needs two grounded endpoints")
            lower,upper=known[goal.subject],known[goal.object]
            if (len(lower.program.nodes)!=1 or len(upper.program.nodes)!=1
                    or lower.program.nodes[0].op!="foundation"
                    or upper.program.nodes[0].op!="foundation"):
                raise ValueError("Bearing-column birth requires simple native foundation bodies")
            lo,hi=lower.program.nodes[0].size,upper.program.nodes[0].size
            rise=upper.translation[2]-(lower.translation[2]+lo[2])
            if rise<=.05 or rise>8 or len(bodies)>=16:
                # Touching originals require no invented column. A gap that
                # exceeds the finite construction envelope stays unresolved.
                if abs(rise)<=.001:
                    continue
                raise ValueError("Native bearing-column gap outside constructive envelope")
            if (abs(lower.translation[0]-upper.translation[0])>1e-7
                    or abs(lower.translation[1]-upper.translation[1])>1e-7):
                raise ValueError("Bearing-column birth requires aligned authored footprints")
            width=min(lo[0],lo[1],hi[0],hi[1],1.)
            if width<goal.min_width:
                raise ValueError("Native column cannot preserve authored transverse contact")
            name=f"intent_column_{i:03d}"
            if name in known:
                raise ValueError("Intent-bearing column already occupies another name")
            column=PlaceBody(name,GrowthProgram((GrowthNode("root","foundation",
                size=(round(width,6),round(width,6),round(rise,6))),)),
                (round(lower.translation[0]+lo[0]/2-width/2,6),
                 round(lower.translation[1]+lo[1]/2-width/2,6),
                 round(lower.translation[2]+lo[2],6)))
            bodies.append(column)
            bearings.append(BearingRun(goal.subject,name,goal.object))
            continue
        if goal.kind=="ascend":
            if any(a.source==goal.subject and a.destination==goal.object
                   for a in ascents):
                continue  # Respect the operator's declared native path.
            known={b.entity_id:b for b in bodies}
            if goal.subject not in known or goal.object not in known:
                raise ValueError("Intent-grown ascent requires two original named native endpoints")
            lower,upper=known[goal.subject],known[goal.object]
            if (len(lower.program.nodes)!=1 or len(upper.program.nodes)!=1
                    or lower.program.nodes[0].op!="foundation"
                    or upper.program.nodes[0].op!="foundation"):
                raise ValueError("Intent-grown stair requires two simple original foundation sites")
            ap,bp=lower.program.nodes[0].size,upper.program.nodes[0].size
            top0=lower.translation[2]+ap[2]
            top1=upper.translation[2]+bp[2]
            rise=top1-top0
            if rise<=.001:
                raise ValueError("Ascend requires a higher destination native top face")
            from math import ceil
            intervals=max(2,ceil(rise/goal.max_step))
            if intervals>9 or len(bodies)+intervals-1>16:
                raise ValueError("Bounded stair generation cannot satisfy authored rise")
            horizontal=[upper.translation[j]-lower.translation[j] for j in (0,1)]
            axis=0 if abs(horizontal[0])>=abs(horizontal[1]) else 1
            other=1-axis
            if abs(horizontal[other])>1e-7:
                raise ValueError("Constructive ascent needs aligned horizontal site centers")
            sign=1 if horizontal[axis]>0 else -1
            spacing=(abs(horizontal[axis])-(ap[axis]+bp[axis])/2)/(intervals-1)
            width=min(ap[other],bp[other])
            if sign==0 or spacing<.5 or width<goal.min_width:
                raise ValueError("Native staircase lacks sufficient ordered horizontal run")
            bottom_z=min(lower.translation[2],upper.translation[2])
            names=[]
            for j in range(1,intervals):
                name=f"intent_tread_{i:03d}_{j:02d}"
                if name in known:
                    raise ValueError("Intent tread name collides with authored native body")
                along=(lower.translation[axis]+sign*(
                    ap[axis]/2+spacing/2+(j-1)*spacing))
                position=[lower.translation[0],lower.translation[1],bottom_z]
                position[axis]=round(along,6)
                h=round(top0+rise*j/intervals-bottom_z,6)
                if h<=0:
                    raise ValueError("Constructive rising native tread has nonpositive height")
                dimensions=[spacing,spacing,h]
                dimensions[other]=width
                tread=PlaceBody(name,GrowthProgram((GrowthNode(
                    "root","foundation",size=tuple(dimensions)),)),tuple(position))
                bodies.append(tread)
                names.append(name)
            ascents.append(AscentRun(goal.subject,tuple(names),goal.object))
            continue
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
            roof_position=[floor.translation[0],floor.translation[1],
                           round(floor.translation[2]+root.size[2]+2.2,6)]
            # When the same named floor launches an authored ascending
            # passage, locate its canopy away from the first tread.
            # This changes the PROPOSAL, never grants geometric admission.
            for run in ascents:
                if run.source==goal.subject and run.destination in known:
                    upper=known[run.destination]
                    horizontal=[upper.translation[j]-floor.translation[j] for j in (0,1)]
                    axis=0 if abs(horizontal[0])>=abs(horizontal[1]) else 1
                    sign=1 if horizontal[axis]>0 else -1
                    # Never push the authored floor-centred refuge core
                    # beyond the independently proposed roof footprint.
                    # The STEP core/obstruction test still decides admission.
                    cover_span=max(root.size[axis]+1.,goal.min_width*2.)
                    core_margin=goal.min_width/2+.125
                    displacement=min(root.size[axis]/2+.1,
                                     max(0.,cover_span/2-core_margin))
                    roof_position[axis]=round(
                        roof_position[axis]-sign*displacement,6)
                    break
            roof=PlaceBody(goal.object,GrowthProgram((GrowthNode("root","foundation",
                size=(round(max(root.size[0]+1.,goal.min_width*2),6),
                      round(max(root.size[1]+1.,goal.min_width*2),6),.4)),)),
                tuple(roof_position))
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
                       tuple(sorted(ascents,key=lambda a:(a.source,a.steps,a.destination))),
                       tuple(sorted(bearings,key=lambda b:(b.lower,b.column,b.upper))))

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
