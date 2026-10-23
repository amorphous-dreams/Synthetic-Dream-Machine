"""Silhouette, contact, and material-aware directional light scoring."""
from dataclasses import dataclass
from pathlib import Path
import numpy as np
import cv2
from PIL import Image
from scipy.ndimage import distance_transform_edt,gaussian_filter
from .render import silhouette,buffers
from .topology import mask_components,connectivity_cost,assembly_contacts


def load_mask(path,size=(256,384),channel='auto',threshold=96,invert=False):
    with Image.open(path) as src:
        im=src.convert('RGBA')
        alpha=np.asarray(im.getchannel('A'))
        if channel=='alpha' or (channel=='auto' and np.ptp(alpha)>0):
            data=alpha
        elif channel in ('luma','auto'):
            data=np.asarray(im.convert('L'))
        else: raise ValueError(f'Unsupported channel {channel}')
    if invert: data=255-data
    h,w=size[1],size[0]
    if data.shape!=(h,w):
        # Keep the entire reference frame registered; no bounding-box auto-crop.
        data=cv2.resize(data,(w,h),interpolation=cv2.INTER_AREA)
    return data>=threshold


def silhouette_score(reference,rendered,roi=None):
    a,b=np.asarray(reference,dtype=bool),np.asarray(rendered,dtype=bool)
    if a.shape!=b.shape: raise ValueError('Masks differ in shape')
    intersection=int((a&b).sum())
    union=int((a|b).sum())
    iou=intersection/max(1,union)
    edge_a=cv2.morphologyEx(np.uint8(a),cv2.MORPH_GRADIENT,np.ones((3,3),np.uint8))>0
    edge_b=cv2.morphologyEx(np.uint8(b),cv2.MORPH_GRADIENT,np.ones((3,3),np.uint8))>0
    d_a=distance_transform_edt(~edge_a)
    d_b=distance_transform_edt(~edge_b)
    chamfer=.5*((float(d_a[edge_b].mean()) if edge_b.any() else 100)
                 +(float(d_b[edge_a].mean()) if edge_a.any() else 100))
    region_score=iou
    if roi is not None:
        x0,y0,x1,y1=[float(x) for x in roi]
        h,w=a.shape
        aa=a[round(y0*h):round(y1*h),round(x0*w):round(x1*w)]
        bb=b[round(y0*h):round(y1*h),round(x0*w):round(x1*w)]
        region_score=(aa&bb).sum()/max(1,(aa|bb).sum())
    value=.75*iou+.18*float(region_score)+.07*np.exp(-chamfer/4)
    return {'iou':float(iou),'roi_iou':float(region_score),
            'chamfer':float(chamfer),'value':float(value)}


@dataclass
class Target:
    view: str
    mask: np.ndarray
    weight: float=1.0
    roi: tuple | None=None

    @classmethod
    def read(cls,spec,base,size=(256,384)):
        p=Path(spec['path'])
        if not p.is_absolute():p=Path(base)/p
        return cls(str(spec['view']),load_mask(p,size,
                  spec.get('channel','auto'),int(spec.get('threshold',96)),bool(spec.get('invert',False))),
                  float(spec.get('weight',1)),tuple(spec['roi']) if spec.get('roi') else None)


def _weighted_corr(x,y,mask):
    a=np.asarray(x)[mask]
    b=np.asarray(y)[mask]
    if len(a)<16:return 0.
    a=a-a.mean();b=b-b.mean()
    den=np.sqrt((a*a).sum()*(b*b).sum())
    return float((a*b).sum()/den) if den>1e-9 else 0.


class PhotoReference:
    def __init__(self,path,size=(256,384)):
        im=Image.open(path).convert('RGBA').resize(size,Image.Resampling.LANCZOS)
        px=np.asarray(im,dtype=np.float32)/255
        self.alpha=px[...,3]
        self.luma=gaussian_filter(px[...,:3]@np.array((.2126,.7152,.0722)),1.3)
        self.warm=gaussian_filter(np.maximum(0,px[...,0]-.8*px[...,2]),1.3)

    def score(self,buffer,light):
        occupied=buffer['occupancy']&(self.alpha>.3)
        normal=buffer['normal']
        predicted=np.clip(normal@np.asarray(light,dtype=np.float32),0,1)
        parts=[]
        for mid in sorted(set(int(m) for m in np.unique(buffer['material']) if m>=0)):
            selected=occupied&(buffer['material']==mid)
            if selected.sum()<30:continue
            parts.append(.75*_weighted_corr(predicted,self.luma,selected)
                         +.25*_weighted_corr(predicted,self.warm,selected))
        return float(np.mean(parts)) if parts else -1.


class Objective:
    def __init__(self,build,parameter_bounds,prior,targets,cameras,
                 size=(256,384),light=None,photo=None,weights=None):
        self.build=build
        self.bounds=parameter_bounds
        self.prior=prior
        self.targets=targets
        self.cameras=cameras
        self.size=size
        self.light=light
        self.photo=photo
        self.weights={'topology':.12,'shape_prior':.08,'photometry':.035,**(weights or {})}
        self.calls=0

    def __call__(self,params,include_light=False):
        self.calls+=1
        model=self.build(params)
        total_weight=sum(t.weight for t in self.targets)
        value=0.
        scores={}
        for t in self.targets:
            mask=silhouette(model,self.cameras[t.view],self.size)>96
            metric=silhouette_score(t.mask,mask,t.roi)
            cc,connectivity=connectivity_cost(mask)
            scores[t.view]={**metric,'connected':connectivity}
            value+=(t.weight/max(1e-8,total_weight))*(1-metric['value'])
            value+=self.weights['topology']*cc/max(1,len(self.targets))
        contacts=assembly_contacts(model)
        value+=self.weights['topology']*max(0,contacts['part_contact_count']-1)
        prior_penalty=0.
        for k,(lo,hi) in self.bounds.items():
            delta=(params[k]-self.prior[k])/(hi-lo)
            prior_penalty+=delta*delta
        value+=self.weights['shape_prior']*prior_penalty/max(1,len(self.bounds))
        scores['contacts']=contacts
        scores['shape_prior']=float(prior_penalty)
        if include_light and self.photo is not None and self.light is not None:
            ref_view=next((t.view for t in self.targets if t.view=='reference'),self.targets[0].view)
            buf=buffers(model,self.cameras[ref_view],self.size)
            lit=self.photo.score(buf,self.light)
            value+=self.weights['photometry']*(1-np.clip(lit,-1,1))
            scores['photometry']=lit
        return float(value),scores,model
