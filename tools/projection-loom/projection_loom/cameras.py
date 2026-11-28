"""Orthographic camera with independent presentation and fixed evidence frames.

A fixed camera maps world coordinates to a reproducible reference pixel frame.
Auto-fit may be used to display an object, never to compare evolving geometry
against an external reference.
"""
from dataclasses import dataclass
import numpy as np


@dataclass(frozen=True)
class Camera:
    azimuth: float = 0.0
    elevation: float = 0.0
    fit: str = 'height'
    margin: float = 0.02
    roll: float = 0.0
    pixel_scale: float | None = None
    world_anchor: tuple = (0.0, 0.0, 0.0)
    pixel_center: tuple | None = None
    reference_size: tuple | None = None

    @classmethod
    def from_dict(cls, value):
        return cls(
            azimuth=float(value.get('azimuth', 0)),
            elevation=float(value.get('elevation', 0)),
            fit=value.get('fit', 'height'),
            margin=float(value.get('margin', .02)),
            roll=float(value.get('roll', 0)),
            pixel_scale=(float(value['pixel_scale']) if value.get('pixel_scale') is not None else None),
            world_anchor=tuple(float(v) for v in value.get('world_anchor', (0, 0, 0))),
            pixel_center=(tuple(float(v) for v in value['pixel_center'])
                          if value.get('pixel_center') is not None else None),
            reference_size=(tuple(int(v) for v in value['reference_size'])
                            if value.get('reference_size') is not None else None)
        )

    def to_dict(self):
        result = {'azimuth': self.azimuth, 'elevation': self.elevation,
                  'roll': self.roll, 'fit': self.fit, 'margin': self.margin}
        if self.fit == 'fixed':
            result.update(pixel_scale=self.pixel_scale,
                          world_anchor=list(self.world_anchor),
                          pixel_center=list(self.pixel_center) if self.pixel_center else None,
                          reference_size=list(self.reference_size) if self.reference_size else None)
        return result

    def basis(self):
        a, e = np.radians((self.azimuth, self.elevation))
        outward = np.array((np.sin(a)*np.cos(e), -np.cos(a)*np.cos(e), np.sin(e)), dtype=float)
        right = np.array((np.cos(a), np.sin(a), 0), dtype=float)
        up = np.cross(outward, right)
        if self.roll:
            t = np.radians(self.roll)
            right, up = np.cos(t)*right + np.sin(t)*up, -np.sin(t)*right + np.cos(t)*up
        return right, up, outward

    def project(self, vertices, size):
        w, h = size
        if w <= 0 or h <= 0:
            raise ValueError('Invalid projection dimensions')
        right, up, out = self.basis()
        xyz = np.asarray(vertices, dtype=float)
        if xyz.ndim != 2 or xyz.shape[1] != 3 or not xyz.size or not np.isfinite(xyz).all():
            raise ValueError('Expected finite Nx3 geometry')
        if self.fit == 'fixed':
            if self.pixel_scale is None or not np.isfinite(self.pixel_scale) or self.pixel_scale <= 0:
                raise ValueError('Fixed cameras require positive pixel_scale')
            if self.reference_size is None or len(self.reference_size) != 2 or min(self.reference_size) <= 0:
                raise ValueError('Fixed cameras require reference_size')
            sx=w/self.reference_size[0]
            sy=h/self.reference_size[1]
            if abs(sx-sy)/max(sx,sy) > .015:
                raise ValueError('Fixed camera cannot stretch its registration frame non-uniformly')
            anchor = np.asarray(self.world_anchor, dtype=float)
            if anchor.shape != (3,) or not np.isfinite(anchor).all():
                raise ValueError('Bad world_anchor')
            pixel = np.array(self.pixel_center if self.pixel_center is not None else
                             (self.reference_size[0]/2, self.reference_size[1]/2), dtype=float)
            if pixel.shape != (2,) or not np.isfinite(pixel).all():
                raise ValueError('Bad pixel_center')
            coord = xyz - anchor
            uv = np.column_stack((coord @ right, coord @ up))
            x = (pixel[0] + uv[:, 0]*self.pixel_scale)*(w/self.reference_size[0])
            y = (pixel[1] - uv[:, 1]*self.pixel_scale)*(h/self.reference_size[1])
            return np.column_stack((x, y)), coord @ out, float(self.pixel_scale*w/self.reference_size[0])
        u, v, depth = xyz @ right, xyz @ up, xyz @ out
        urange = max(1e-9, float(np.ptp(u)))
        vrange = max(1e-9, float(np.ptp(v)))
        usable = 1 - 2*self.margin
        if self.fit == 'height':
            scale = usable*h/vrange
        elif self.fit == 'bounds':
            scale = usable*min(w/urange, h/vrange)
        else:
            raise ValueError('Camera fit must be height, bounds or fixed')
        xy = np.column_stack((w/2 + (u - (u.max()+u.min())/2)*scale,
                              h/2 - (v - (v.max()+v.min())/2)*scale))
        return xy, depth, float(scale)
