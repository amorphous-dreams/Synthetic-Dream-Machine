"""Non-authoritative, reproducible RGBA evidence for CAD visual comparison.

Three regions are *spatial priors*, not semantic material ground truth.
They overlap intentionally and depend on the source silhouette span, never raw sheet y.
"""
from __future__ import annotations
from dataclasses import dataclass
import cv2
import numpy as np

@dataclass(frozen=True)
class Evidence:
    reference_mask: np.ndarray
    regions: dict
    edges: dict
    uncertainty: np.ndarray


def prepare_reference(rgba, alpha=None, shape=(192,128), boundary=3):
    rgba=np.asarray(rgba)
    if rgba.ndim != 3 or rgba.shape[2] != 4:
        raise ValueError('Expected RGBA master')
    a=rgba[:,:,3] if alpha is None else np.asarray(alpha)
    if a.shape != rgba.shape[:2]:raise ValueError('Alpha size mismatch')
    width,height=shape
    mask=cv2.resize((a>96).astype('uint8'),(width,height),interpolation=cv2.INTER_NEAREST)>0
    # Edge evidence must not inherit arbitrary RGB from transparent pixels.
    # Premultiply before downsampling, then normalize by downsampled alpha.
    native_alpha=np.asarray(a,dtype=np.float32)/255.0
    native_rgb=np.asarray(rgba[:,:,:3],dtype=np.float32)
    premul=native_rgb*native_alpha[:,:,None]
    area_alpha=cv2.resize(native_alpha,(width,height),interpolation=cv2.INTER_AREA)
    sampled=cv2.resize(premul,(width,height),interpolation=cv2.INTER_AREA)
    rgb=np.clip(sampled/np.maximum(area_alpha[:,:,None],1e-5),0,255).astype(np.uint8)
    ys=np.where(mask)[0]
    if len(ys)==0:raise ValueError('Empty reference silhouette')
    lo,hi=int(ys.min()),int(ys.max());span=max(1,hi-lo)
    y=np.arange(height,dtype=np.float32)[:,None]
    # Overlapping raised-cosine-like windows keep uncertain transition territory shared.
    def sigmoid(z):return 1/(1+np.exp(-np.clip(z,-40,40)))
    t=(y-lo)/span
    raw={'fortress':1-sigmoid((t-.24)/.055),
         'joining':sigmoid((t-.16)/.055)*(1-sigmoid((t-.43)/.065)),
         'crystal':sigmoid((t-.32)/.07)}
    regions={k:(np.broadcast_to(v,(height,width))*mask).astype(np.float32) for k,v in raw.items()}
    gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
    gx=cv2.Sobel(gray,cv2.CV_32F,1,0,ksize=3)
    gy=cv2.Sobel(gray,cv2.CV_32F,0,1,ksize=3)
    magnitude=cv2.magnitude(gx,gy)
    interior=cv2.erode(mask.astype('uint8'),np.ones((2*boundary+1,2*boundary+1),np.uint8))>0
    vals=magnitude[interior]
    level=max(float(np.percentile(vals,97)) if len(vals) else 1,1)
    strength=np.clip(magnitude/level,0,1)*interior
    # Orientation-specific line families are evidence only; gradients are not validated edges.
    edges={'horizontal':strength*np.abs(gy)/(magnitude+1e-6),
           'vertical':strength*np.abs(gx)/(magnitude+1e-6),
           'diagonal':strength*(np.minimum(np.abs(gx),np.abs(gy)) / (magnitude+1e-6))*1.4142}
    for k in edges: edges[k]=edges[k].astype(np.float32)
    # Alpha rims can generate spurious gradients on the RGB side.
    # The interior erosion intentionally suppresses this boundary.
    uncertainty=np.maximum(0,1-strength)*interior
    return Evidence(mask,regions,edges,uncertainty.astype(np.float32))


def tolerant_line_agreement(predicted, evidence, region, distance_px=3):
    """Bidirectional soft chamfer-like agreement. Avoid trivial blank predicted maps."""
    p=(np.asarray(predicted)>0.16)&(region>.1)
    r=(np.asarray(evidence)>0.22)&(region>.1)
    if not np.any(p) and not np.any(r):return 1.0
    if not np.any(p) or not np.any(r):return 0.0
    dref=cv2.distanceTransform((~r).astype('uint8'),cv2.DIST_L2,3)
    dpred=cv2.distanceTransform((~p).astype('uint8'),cv2.DIST_L2,3)
    precision=np.exp(-dref[p]/max(distance_px,.1)).mean()
    recall=np.exp(-dpred[r]/max(distance_px,.1)).mean()
    return float((2*precision*recall)/(precision+recall+1e-10))


def three_area_report(evidence,predicted_mask,predicted_lines=None):
    p=np.asarray(predicted_mask)>0
    if p.shape!=evidence.reference_mask.shape:raise ValueError('Camera/image registration required')
    scores={}
    for name,w in evidence.regions.items():
        intersection=np.sum(w*(p&evidence.reference_mask))
        union=np.sum(w*(p|evidence.reference_mask))
        loss=1-float(intersection/max(union,1e-7))
        scores[name]={'silhouette_loss':loss,'reference_weight_pixels':float(w.sum())}
        if predicted_lines is not None:
            key={'fortress':'horizontal','joining':'diagonal','crystal':'vertical'}[name]
            scores[name]['line_agreement']=tolerant_line_agreement(predicted_lines,evidence.edges[key],w)
    return scores


class DiversityArchive:
    """Separate phenotype niches, not population rank by parameter distance."""
    def __init__(self,bins=(5,5)):
        self.bins=bins
        self.cells={}
    def consider(self,descriptor,loss,genome,valid):
        if not valid:return False
        if not np.isfinite(float(loss)):
            raise ValueError('Fitness must be finite')
        v=np.asarray(descriptor,dtype=float)
        if not np.all(np.isfinite(v)):
            raise ValueError('Descriptor must be finite')
        v=np.clip(v,0,1-1e-10)
        if v.shape!=(len(self.bins),):raise ValueError('Descriptor and bins disagree')
        cell=tuple(np.floor(v*np.array(self.bins)).astype(int).tolist())
        if cell not in self.cells or float(loss)<self.cells[cell]['loss']:
            self.cells[cell]={'loss':float(loss),'genome':dict(genome),'descriptor':v.tolist()}
            return True
        return False
