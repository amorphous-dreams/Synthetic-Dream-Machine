"""Independent construction QA overlay, separate from printable technical ink.

Pass/fail glyphs are intentionally NOT emitted as image-generation controls.
The ordinary four-pass renderer continues to use the approved silhouette.
"""
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw


def draw_joint_diagnostics(mesh,cameras,audit,output,size=(1024,1536)):
    out=Path(output);out.mkdir(parents=True,exist_ok=True)
    V=np.asarray(mesh.vertices,dtype=float)
    F=np.asarray(mesh.faces,dtype=int)
    parts={}
    for p in mesh.parts:
        ff=F[p['first_face']:p['first_face']+p['num_faces']]
        v=V[np.unique(ff)]
        parts[p['name']]=v.mean(0)
    results={}
    for name,cam in cameras.items():
        XY,_,_=cam.project(V,size)
        centers={}
        for p in mesh.parts:
            faces=F[p['first_face']:p['first_face']+p['num_faces']]
            centers[p['name']]=XY[np.unique(faces)].mean(0)
        im=Image.new('RGBA',size,(0,0,0,0))
        d=ImageDraw.Draw(im)
        for edge in audit.get('attachments',[]):
            p=edge['parent'];ch=edge['child']
            a=centers[p];b=centers[ch]
            ok=edge['meets_threshold']
            color=(96,205,177,175) if ok else (240,104,98,230)
            d.line((float(a[0]),float(a[1]),float(b[0]),float(b[1])),fill=color,width=2)
            rad=5 if ok else 9
            d.ellipse((b[0]-rad,b[1]-rad,b[0]+rad,b[1]+rad),outline=color,width=3)
            if not ok:
                d.line((b[0]-rad,b[1]-rad,b[0]+rad,b[1]+rad),fill=color,width=2)
                d.line((b[0]+rad,b[1]-rad,b[0]-rad,b[1]+rad),fill=color,width=2)
        path=out/f'{name}_structural_QA.png';im.save(path)
        results[name]=str(path)
    return results
