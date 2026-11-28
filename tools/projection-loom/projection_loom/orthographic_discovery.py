"""One original oblique source and five independent SYNTHETIC CAD views.

All candidate cameras freeze to the original seed; only the original artwork
contributes external source fitness. The five other views serve morphology/QD.
"""
from __future__ import annotations
import hashlib
import json
import numpy as np

VIEWS = ("oblique", "front", "l-side", "back", "r-side", "top")

def freeze_seed_views(project, seed_mesh, source_camera, size):
    from .cameras import Camera
    w, h = size
    vertices = np.asarray(seed_mesh.vertices, dtype=float)
    if min(w,h) < 32 or vertices.ndim != 2 or vertices.shape[1] != 3:
        raise ValueError("Native seed and bounded viewport required")
    if not np.isfinite(vertices).all():
        raise ValueError("Seed has nonfinite vertices")
    if project.reference_view != "oblique" or source_camera.fit != "fixed":
        raise ValueError("Source artwork requires its original fixed oblique")
    cameras = {"oblique": source_camera}
    for name in VIEWS[1:]:
        basis = project.cameras[name]
        right, up, _ = basis.basis()
        u, v = vertices @ right, vertices @ up
        scale = .80 * min(w / max(1e-9,float(np.ptp(u))),
                          h / max(1e-9,float(np.ptp(v))))
        cameras[name] = Camera(
            azimuth=basis.azimuth, elevation=basis.elevation,
            roll=basis.roll, fit="fixed", pixel_scale=float(scale),
            world_anchor=(0,0,0),
            pixel_center=(w/2-(float(u.max())+float(u.min()))/2*scale,
                          h/2+(float(v.max())+float(v.min()))/2*scale),
            reference_size=(w,h))
    return cameras

def measure_views(mesh, cameras, *, size=(128,192)):
    from .campaign import visual_descriptor
    from .render import silhouette
    if tuple(cameras) != VIEWS:
        raise ValueError("Six fixed views must use canonical source view order")
    views = {}
    for name,camera in cameras.items():
        mask = silhouette(mesh,camera,size) > 96
        desc = visual_descriptor(mask)
        views[name] = {
            "mask_sha256": desc["mask_sha256"], "niche": desc["niche"],
            "occupancy": desc["occupancy"], "bbox": desc.get("bbox"),
            "clipped": bool(mask[0].any() or mask[-1].any()
                            or mask[:,0].any() or mask[:,-1].any()),
        }
    enc = lambda x: hashlib.sha256(json.dumps(x,sort_keys=True).encode()).hexdigest()
    return {
        "schema": "projection-loom/seed-frozen-six-view-observation",
        "authority": "CAD-derived synthetic inspection, not additional source photos",
        "size": list(size), "views": views,
        "non_source_niche_sha256": enc({v:views[v]["niche"] for v in VIEWS[1:]}),
        "exact_six_view_sha256": enc({v:views[v]["mask_sha256"] for v in VIEWS}),
        "camera_sha256": enc({k:v.to_dict() for k,v in cameras.items()}),
    }

def render_contact(mesh, cameras, output, *, size=(128,192)):
    from pathlib import Path
    from PIL import Image, ImageDraw
    from .render import silhouette
    w,h = size
    sheet=Image.new("RGB",(len(VIEWS)*w*2,h*2+26),(15,19,26))
    draw=ImageDraw.Draw(sheet)
    for i,name in enumerate(VIEWS):
        pic=Image.fromarray(silhouette(mesh,cameras[name],size),"L").resize((2*w,2*h))
        sheet.paste(pic.convert("RGB"),(2*w*i,26))
        draw.text((2*w*i+6,6),name,fill=(240,240,242))
    path=Path(output);path.parent.mkdir(parents=True,exist_ok=True)
    sheet.save(path)
    return str(path)
