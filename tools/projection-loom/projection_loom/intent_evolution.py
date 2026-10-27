"""Input-neutral intent-conditioned selection and inherited architectural variety.

Only a source image authorizes image metrics. Native BRep/void gates execute
before admission. Distinct morphological niches remain independently viable.
"""
from __future__ import annotations
from dataclasses import dataclass
import hashlib
import json
import math
import numpy as np
from scipy.ndimage import distance_transform_edt

from .developmental import GrowthProgram
from .provenance_encoding import canonical_json_sha256

def source_fit(reference,candidate,*,false_positive_cost=1.6):
    """Exact shared pixel grid; overlarge rectangular blobs lose precision."""
    r=np.asarray(reference)>96
    c=np.asarray(candidate)>96
    if r.shape != c.shape or r.ndim!=2 or not r.any():
        raise ValueError("Source and candidate need one matching nonempty pixel grid")
    tp=int((r&c).sum())
    fp=int((~r&c).sum())
    fn=int((r&~c).sum())
    precision=tp/max(1,tp+fp)
    recall=tp/max(1,tp+fn)
    iou=tp/max(1,tp+fp+fn)
    # Tversky overlap; never reward a broad proxy simply for high recall.
    tversky=tp/max(1,tp+false_positive_cost*fp+fn)
    dr=distance_transform_edt(~r)
    dc=distance_transform_edt(~c) if c.any() else np.full(c.shape,1e3)
    from scipy.ndimage import binary_erosion
    boundary_r=r&~binary_erosion(r)
    boundary_c=c&~binary_erosion(c)
    diag=float(math.hypot(*r.shape))
    contour=(float(dc[boundary_r].mean()) if boundary_r.any() else diag)
    contour+=(float(dr[boundary_c].mean()) if boundary_c.any() else diag)
    contour/=2*max(1.,diag)
    return {"iou":iou,"precision":precision,"recall":recall,
            "tversky":tversky,"contour_error":contour,
            "tp":tp,"fp":fp,"fn":fn,
            "fitness":max(0.,tversky-.2*contour),
            "source_authority":"original-image-pixels"}


def structural_descriptor(program:GrowthProgram, result=None):
    counts={op:0 for op in ("foundation","spawn","split","bridge","carve")}
    orientations={face:0 for face in ("up","east","west","north","south")}
    for node in program.nodes:
        counts[node.op]+=node.repeats
        if node.face:
            orientations[node.face]+=node.repeats
    features={
        "nodes":len(program.nodes),
        "branch":counts["split"]+counts["spawn"],
        "bridge":counts["bridge"],
        "void":counts["carve"],
        "vertical":orientations["up"],
        "lateral":sum(orientations[x] for x in ("east","west","north","south")),
    }
    # Deliberately coarse behavior bins: two genomes with identical genotypes
    # are not evidence of independent geometry, but a different structure
    # should survive even if source-mask IoU is equal.
    niche=(min(4,features["branch"]//2),
           min(3,features["lateral"]),
           min(3,features["bridge"]+features["void"]),
           min(3,features["vertical"]//2))
    features["niche"]=niche
    return features


@dataclass(frozen=True)
class ScoredCandidate:
    id: str
    program: GrowthProgram
    native_valid: bool
    metrics: dict
    descriptor: dict
    parent_id: str | None = None

    @property
    def objective(self):
        # Image-free search uses architectural variation, not invented IoU.
        return float(self.metrics["fitness"]) if "fitness" in self.metrics else (
            .1*len(self.program.nodes) + .04*self.descriptor["lateral"]
            +.05*self.descriptor["bridge"] + .05*self.descriptor["void"])


class QualityArchive:
    """Bounded MAP-Elites-inspired archive with per-behavior elites."""
    def __init__(self,limit=64):
        if type(limit) is not int or limit<1:
            raise ValueError("Archive has finite capacity")
        self.limit=limit
        self.elites={}
        self.rejections=[]
        self.seen=set()

    def consider(self,entry:ScoredCandidate):
        if not entry.native_valid:
            self.rejections.append((entry.id,"native-rejection"))
            return False
        if entry.program.identity in self.seen:
            return False
        self.seen.add(entry.program.identity)
        niche=tuple(entry.descriptor["niche"])
        prior=self.elites.get(niche)
        if prior is not None and (entry.objective,entry.id)<= (prior.objective,prior.id):
            return False
        self.elites[niche]=entry
        if len(self.elites)>self.limit:
            worst=min(self.elites,key=lambda n:(self.elites[n].objective,n))
            del self.elites[worst]
        return niche in self.elites and self.elites[niche] is entry

    def parents(self):
        return sorted(self.elites.values(),key=lambda x:(-x.objective,x.id))

    def receipt(self):
        return {"schema":"projection-loom/intent-quality-archive",
                "niches":len(self.elites),"distinct_programs":len(self.seen),
                "native_rejections":list(self.rejections),
                "elites":[{"id":x.id,"program_sha256":x.program.identity,
                            "niche":x.descriptor["niche"],"objective":x.objective,
                            "metrics":x.metrics}
                           for x in self.parents()]}


def fair_auditions(candidates,budget):
    """Guarantee each represented structural emitter one possible exact seat."""
    if type(budget) is not int or budget<0:
        raise ValueError("Invalid audition budget")
    grouped={}
    for item in candidates:
        emitter=item["emitter"]
        grouped.setdefault(emitter,[]).append(item)
    for group in grouped.values():
        group.sort(key=lambda x:(x.get("preview_loss",0),x["id"]))
    order=sorted(grouped)
    result=[]
    while len(result)<budget and any(grouped.values()):
        for emitter in order:
            if grouped[emitter] and len(result)<budget:
                result.append(grouped[emitter].pop(0))
    return result


def fixed_inspection_cameras(seed_mesh,size=(128,192),*,source=None):
    """Freeze six cameras once from initial native shape, never each candidate."""
    from .cameras import Camera
    v=np.asarray(seed_mesh.vertices,dtype=float)
    w,h=size
    angles=[("oblique",38,22),("front",0,0),("left",90,0),
            ("back",180,0),("right",270,0),("top",0,90)]
    cameras={}
    for name,az,el in angles:
        basis=Camera(azimuth=az,elevation=el)
        right,up,_=basis.basis()
        x=v@right;y=v@up
        scale=.80*min(w/max(1e-8,float(np.ptp(x))),
                      h/max(1e-8,float(np.ptp(y))))
        cameras[name]=Camera(azimuth=az,elevation=el,fit="fixed",
            pixel_scale=scale,reference_size=size,
            world_anchor=(0,0,0),
            pixel_center=(w/2-(x.max()+x.min())/2*scale,
                          h/2+(y.max()+y.min())/2*scale))
    return cameras


def observe_candidate(mesh,cameras,source_mask=None,*,size=(128,192)):
    from .render import silhouette
    views={}
    for name,camera in cameras.items():
        image=silhouette(mesh,camera,size)
        views[name]={"digest":hashlib.sha256(image.tobytes()).hexdigest(),
                     "occupied":int((image>96).sum()),"clipped":bool(
                        (image[0]>96).any() or (image[-1]>96).any() or
                        (image[:,0]>96).any() or (image[:,-1]>96).any())}
        if name=="oblique" and source_mask is not None:
            views[name]["source_fit"]=source_fit(source_mask,image)
    return {
        "views":views,
        "synthetic_non_source_sha256":canonical_json_sha256({
            name:views[name]["digest"] for name in cameras if name!="oblique"}),
        "source_observations":1 if source_mask is not None else 0,
        "camera_authority":"seed-frozen-provisional"}


def multi_fidelity_audit(build,cameras,original_alpha,*,preview=(128,192),
                         final=(1024,1536)):
    from PIL import Image
    from .render import silhouette
    a=np.asarray(original_alpha,dtype=np.uint8)
    if a.shape!=(final[1],final[0]):
        raise ValueError("Full-resolution source cannot be silently resized")
    mesh=build.assembly.tessellate(union=True)
    # Preview orders attention; full-resolution measures a native-valid final.
    preview_source=np.asarray(Image.fromarray(a,"L").resize(preview))>96
    preview_mask=silhouette(mesh,cameras["oblique"],preview)>96
    full_mask=silhouette(mesh,cameras["oblique"],final)>96
    return {"preview":source_fit(preview_source,preview_mask),
            "full_resolution":source_fit(a,full_mask),
            "full_size":list(final),
            "source_count":1,
            "native_valid":True}
