"""Three independent Experiment Zero seed types, no subject-specific imports.

Input adapters supply source/proposal evidence and trusted constructive plans;
the one OODA-HA helm remains the only evolutionary decision maker.
"""
from __future__ import annotations
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
import json
import math
from PIL import Image

from .intent_seed import SeedBundle, SeedEntry, IntentContract, normalize_location
from .location_stack import Element, Relation
from .grammar import grow_program
from .solid import SolidAssembly, faceted_loft
from .developmental import GrowthNode, GrowthProgram, compile_growth


@dataclass(frozen=True)
class SeedAdapter:
    seed: SeedEntry
    program: dict | None = None

    def build(self):
        if self.seed.kind == "constructive-grammar":
            if "growth_program" in self.program:
                return compile_growth(GrowthProgram.from_dict(self.program["growth_program"])).assembly
            return grow_program(self.program["steps"],self.program.get("genome",{}))
        if self.seed.kind == "geometry-proxy":
            return compile_growth(proxy_growth_program(self.program)).assembly
        if self.seed.kind == "image-group":
            return _build_image_hypothesis(self.seed.locator)
        raise ValueError("Unknown seed capability")


def _declared_json(path):
    p=Path(path).resolve(strict=True)
    data=json.loads(p.read_text(encoding="utf8"))
    if not isinstance(data,dict):
        raise ValueError("Seed manifest must be one JSON object")
    return p,data


def image_group(path):
    """One original image yields one source identity, including derived L8 alpha.

    Multiple independent image files generate independent entities. None is
    called surveyed because a manifest provided a camera name.
    """
    path,document=_declared_json(path)
    if set(document)!={"kind","views"} or document["kind"]!="image-group":
        raise ValueError("Image-group manifest needs only kind and views")
    entries=[]
    views=document["views"]
    if not isinstance(views,list) or not views:
        raise ValueError("At least one independently sourced view required")
    for view in views:
        allowed={"rgba","alpha","camera","registration","anchors"}
        if not isinstance(view,dict) or set(view)-allowed or "rgba" not in view:
            raise ValueError("Invalid image-group view")
        state=view.get("registration","provisional")
        if state not in ("provisional","registered"):
            raise ValueError("Unknown camera registration state")
        if state=="registered" and not view.get("anchors"):
            raise ValueError("Registered camera needs independent anchor evidence")
        image_path=(path.parent/view["rgba"]).resolve(strict=True)
        if not (image_path.is_relative_to(path.parent) or image_path.is_relative_to(Path(__file__).resolve().parents[1])):
            raise ValueError("Image must live inside image-group boundary")
        with Image.open(image_path) as img:
            if img.mode!="RGBA":
                raise ValueError("Appearance must retain original RGBA channels")
            alpha=img.getchannel("A")
            width,height=img.size
        raw=image_path.read_bytes()
        alpha_hash=sha256(alpha.tobytes()).hexdigest()
        if view.get("alpha"):
            alpha_path=(path.parent/view["alpha"]).resolve(strict=True)
            if not (alpha_path.is_relative_to(path.parent) or alpha_path.is_relative_to(Path(__file__).resolve().parents[1])):
                raise ValueError("Alpha escapes image source boundary")
            with Image.open(alpha_path) as declared:
                if declared.mode!="L" or declared.size!=(width,height):
                    raise ValueError("Alpha must have matching L8 dimensions")
                if declared.tobytes()!=alpha.tobytes():
                    raise ValueError("Alpha channel disagrees with original RGBA")
            alpha_hash=sha256(alpha_path.read_bytes()).hexdigest()
        metadata=(("camera",str(view.get("camera","unknown"))),
                  ("registration",state),("width",str(width)),("height",str(height)))
        entry=SeedEntry("image-group",sha256(raw).hexdigest(),str(image_path),
                        "pixel","source",tuple(sorted((("rgba",sha256(raw).hexdigest()),
                                                         ("alpha",alpha_hash)))),
                        tuple(sorted(metadata)))
        entries.append(SeedAdapter(entry))
    return tuple(entries)


def constructive_grammar(path):
    path,data=_declared_json(path)
    if data.get("kind")!="constructive-grammar":
        raise ValueError("Not a constructive grammar seed")
    typed="growth_program" in data
    legacy="steps" in data
    if typed==legacy:
        raise ValueError("Declare exactly one executable grammar representation")
    if typed:
        GrowthProgram.from_dict(data["growth_program"])
    elif not isinstance(data["steps"],list) or not data["steps"] or not isinstance(data.get("genome",{}),dict):
        raise ValueError("Nonempty typed construction steps and genome required")
    return SeedAdapter(SeedEntry.from_file("constructive-grammar",path),data)


def ziggurat_proxy(path):
    path,data=_declared_json(path)
    if data.get("kind")!="geometry-proxy" or not isinstance(data.get("tiers"),list):
        raise ValueError("Proxy needs authored tier geometry")
    if len(data["tiers"])<2 or len(data["tiers"])>32:
        raise ValueError("Proxy tiers must be bounded and nontrivial")
    return SeedAdapter(SeedEntry.from_file("geometry-proxy",path),data)


def proxy_growth_program(program):
    """Build a typed, heritable hypothesis from authored proxy data."""
    tiers=program["tiers"]
    root=tiers[0]
    nodes=[GrowthNode("root","foundation",
                      size=(root["width"],root["depth"],root["height"]))]
    previous="root"
    for i,tier in enumerate(tiers[1:],1):
        name=f"tier_{i}"
        nodes.append(GrowthNode(name,"spawn",parent=previous,face="up",
            size=(tier["width"],tier["depth"],tier["height"]),
            offset=tuple(tier["offset"])))
        previous=name
    if "court" in program:
        court=program["court"]
        if set(court)!={"size","offset"}:
            raise ValueError("Authored court recess needs size and offset")
        nodes.append(GrowthNode("court_recess","carve",parent="root",
                     target="root",size=tuple(court["size"]),
                     offset=tuple(court["offset"])))
    if "gate" in program:
        gate=program["gate"]
        if set(gate)!={"size","face","offset"}:
            raise ValueError("Authored exterior gate needs size, face and offset")
        nodes.append(GrowthNode("exterior_gate","carve",parent="root",
                     target="root",size=tuple(gate["size"]),
                     face=gate["face"],offset=tuple(gate["offset"])))
    return GrowthProgram(tuple(nodes))


def _build_proxy(program):
    a=SolidAssembly(overlap_ratio=.006)
    prev=None
    for idx,tier in enumerate(program["tiers"]):
        if set(tier)!={"width","depth","height","offset"}:
            raise ValueError("Tier needs explicit extents and offset")
        width,depth,height=map(float,(tier["width"],tier["depth"],tier["height"]))
        offset=tier["offset"]
        if len(offset)!=2 or not all(math.isfinite(float(x)) for x in offset):
            raise ValueError("Bad ziggurat tier offset")
        if min(width,depth,height)<=0 or not all(map(math.isfinite,(width,depth,height))):
            raise ValueError("Proxy extents must be positive and finite")
        base_z=(a.parts[prev].solid.BoundingBox().zmax-.12 if prev else 0.)
        z=base_z+height/2
        name=f"tier-{idx:03d}"
        a.add_box(name,(float(offset[0]),float(offset[1]),z),
                  (width,depth,height),parents=() if prev is None else (prev,),
                  role="foundation" if prev is None else "primary",
                  slot=f"tier/{idx:03d}")
        prev=name
    return a


def _build_image_hypothesis(path):
    """Explicitly provisional native starting mass, never inverse metric survey."""
    with Image.open(path) as img:
        if img.mode!="RGBA":
            raise ValueError("Image seed must preserve original alpha")
        a=img.getchannel("A")
        bbox=a.getbbox()
        width,height=img.size
    if bbox is None:
        raise ValueError("Empty original alpha")
    shape_width=max(.15,(bbox[2]-bbox[0])/width)
    center_x=(bbox[0]+bbox[2]-width)/width
    lo=faceted_loft([(0,center_x,0,.5*shape_width,.42),
                     (3.0,center_x,0,.35*shape_width,.31),
                     (7.0,center_x+.11,0,.22*shape_width,.20)],
                    sides=8,jaggedness=.08)
    assembly=SolidAssembly()
    assembly.add("provisional-image-scaffold",lo,parents=(),role="foundation",
                 slot="image/provisional-scaffold")
    return assembly


def load_adapters(image_manifest=None,grammar_path=None,proxy_path=None):
    out=[]
    if image_manifest is not None:
        out.extend(image_group(image_manifest))
    if grammar_path is not None:
        out.append(constructive_grammar(grammar_path))
    if proxy_path is not None:
        out.append(ziggurat_proxy(proxy_path))
    if not out:
        raise ValueError("Experiment requires at least one seed")
    return tuple(out)


@dataclass
class SeedScene:
    location: object
    assemblies: dict
    adapters: tuple
    def audit(self):
        self.location.audit()
        return self.location.audit_cad_bodies(self.assemblies)


def compose_adapters(adapters,intent:IntentContract,*,audit=True):
    """Build separate CAD bodies: no forced fusion across image, grammar, proxy."""
    adapters=tuple(adapters)
    bundle=SeedBundle(tuple(a.seed for a in adapters))
    location=normalize_location(bundle,intent)
    assemblies={}
    for item in sorted(adapters,key=lambda x:x.seed.identity):
        entry=item.seed
        token="body-"+entry.identity[:24]
        if token in assemblies:
            raise ValueError("Ambiguous CAD proposal identity")
        built=item.build()
        assemblies[token]=built
        elem="candidate-"+entry.identity[:24]
        src="seed-"+entry.identity[:24]
        location.add_element(Element(elem,"cad_body",(src,),
                                     ("#has/constructed",),"proposed",token))
        location.relate(Relation("element-"+entry.identity[:24],
                                 "informs",elem,"proposed"))
    result=SeedScene(location,assemblies,adapters)
    if audit:result.audit()
    return result
