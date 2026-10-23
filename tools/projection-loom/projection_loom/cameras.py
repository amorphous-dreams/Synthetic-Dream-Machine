"""Orthographic projection frames with explicit viewing axes."""
from dataclasses import dataclass
import numpy as np


@dataclass(frozen=True)
class Camera:
    azimuth: float = 0.0
    elevation: float = 0.0
    fit: str = 'height'
    margin: float = 0.02

    @classmethod
    def from_dict(cls, value):
        return cls(float(value.get('azimuth',0)),float(value.get('elevation',0)),
                   value.get('fit','height'),float(value.get('margin',.02)))

    def basis(self):
        a,e=np.radians((self.azimuth,self.elevation))
        outward=np.array((np.sin(a)*np.cos(e),-np.cos(a)*np.cos(e),np.sin(e)),dtype=float)
        right=np.array((np.cos(a),np.sin(a),0),dtype=float)
        up=np.cross(outward,right)
        return right,up,outward

    def project(self, vertices, size):
        w,h=size
        right,up,out=self.basis()
        xyz=np.asarray(vertices,dtype=float)
        u,v,depth=xyz@right,xyz@up,xyz@out
        urange=max(1e-9,float(np.ptp(u)))
        vrange=max(1e-9,float(np.ptp(v)))
        usable=1-2*self.margin
        if self.fit=='height':
            scale=usable*h/vrange
        elif self.fit=='bounds':
            scale=usable*min(w/urange,h/vrange)
        else:
            raise ValueError('Camera fit must be height or bounds')
        xy=np.column_stack((w/2+(u-(u.max()+u.min())/2)*scale,
                            h/2-(v-(v.max()+v.min())/2)*scale))
        return xy,depth,float(scale)
