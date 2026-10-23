"""Silhouette, material, normal, lighting, and depth-tested drafting passes."""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image,ImageDraw
from .cameras import Camera


def silhouette(mesh,camera,size=(256,384),supersample=1):
    w,h=size
    multiplier=int(supersample)
    if multiplier<1: raise ValueError('supersample must be positive')
    xy,_,_=camera.project(mesh.vertices,(w*multiplier,h*multiplier))
    integer=np.rint(xy).astype(np.int32)
    mask=np.zeros((h*multiplier,w*multiplier),dtype=np.uint8)
    for face in mesh.faces:
        cv2.fillConvexPoly(mask,integer[face],255,lineType=cv2.LINE_8)
    if multiplier>1:
        mask=cv2.resize(mask,(w,h),interpolation=cv2.INTER_AREA)
    return mask


def buffers(mesh,camera,size=(256,384)):
    w,h=size
    xy,depth,_=camera.project(mesh.vertices,size)
    xyz=mesh.vertices[mesh.faces]
    normals=np.cross(xyz[:,1]-xyz[:,0],xyz[:,2]-xyz[:,0])
    normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-9)
    fids=np.full((h,w),-1,np.int32)
    zbuffer=np.full((h,w),-np.inf,np.float32)
    for face_index,tri in enumerate(mesh.faces):
        poly=xy[tri]
        depths=depth[tri]
        x0=max(0,int(np.floor(poly[:,0].min())))
        x1=min(w-1,int(np.ceil(poly[:,0].max())))
        y0=max(0,int(np.floor(poly[:,1].min())))
        y1=min(h-1,int(np.ceil(poly[:,1].max())))
        if x0>x1 or y0>y1: continue
        mat=np.column_stack((poly,np.ones(3)))
        if abs(float(np.linalg.det(mat)))<1.:continue
        local=np.zeros((y1-y0+1,x1-x0+1),dtype=np.uint8)
        cv2.fillConvexPoly(local,np.rint(poly-(x0,y0)).astype(np.int32),1)
        if not local.any():continue
        try: coeff=np.linalg.solve(mat,depths)
        except np.linalg.LinAlgError:continue
        yy,xx=np.mgrid[y0:y1+1,x0:x1+1]
        projected_depth=(coeff[0]*xx+coeff[1]*yy+coeff[2]).astype(np.float32)
        region=zbuffer[y0:y1+1,x0:x1+1]
        front=(local>0)&(projected_depth>region)
        region[front]=projected_depth[front]
        fid_region=fids[y0:y1+1,x0:x1+1]
        fid_region[front]=face_index
    occupied=fids>=0
    materials=np.full((h,w),-1,dtype=np.int16)
    surface_normal=np.zeros((h,w,3),dtype=np.float32)
    materials[occupied]=mesh.materials[fids[occupied]]
    surface_normal[occupied]=normals[fids[occupied]]
    toward=camera.basis()[2]
    flip=(surface_normal@toward)<0
    surface_normal[flip]*=-1
    return {'occupancy':occupied,'face_id':fids,'depth':zbuffer,
            'normal':surface_normal,'material':materials}


def light_vector(azimuth,elevation):
    a,e=np.radians((float(azimuth),float(elevation)))
    return np.array((np.cos(e)*np.cos(a),np.cos(e)*np.sin(a),np.sin(e)),dtype=np.float32)


def lit_rgba(buffer,light=(0,0,1),ambient=.25,diffuse=.7,material_gray=None):
    occupancy=buffer['occupancy']
    normal=buffer['normal']
    material=buffer['material']
    intens=ambient+diffuse*np.clip(normal@np.asarray(light,dtype=np.float32),0,1)
    albedos=material_gray or {0:.50,1:.67,2:.55,3:.78}
    base=np.full(occupancy.shape,.60,dtype=np.float32)
    for index,value in albedos.items():
        base[material==int(index)]=float(value)
    gray=np.uint8(np.clip(intens*base*255,0,255))
    return Image.fromarray(np.dstack((gray,gray,gray,np.uint8(occupancy)*255)),'RGBA')


def _runs(values):
    changes=np.flatnonzero(np.diff(np.r_[False,values,False]))
    return zip(changes[::2],changes[1::2])


def visible_lines(mesh,camera,buffer,size,style=None):
    style=style or {}
    w,h=size
    xy,depth,_=camera.project(mesh.vertices,size)
    zbuffer=buffer['depth']
    ink=Image.new('RGBA',(w,h),(0,0,0,0))
    painter=ImageDraw.Draw(ink)
    rgba=tuple(style.get('color',(196,223,242,228)))
    width=int(style.get('width',2))
    epsilon=float(style.get('depth_epsilon',.065))
    for a,b,material in mesh.edges:
        p0,p1=xy[a],xy[b]
        length=float(np.linalg.norm(p1-p0))
        if length<1.5:continue
        n=max(3,int(length/1.3))
        t=np.linspace(0,1,n)
        coords=p0[None,:]*(1-t[:,None])+p1[None,:]*t[:,None]
        zs=depth[a]*(1-t)+depth[b]*t
        ix=np.clip(np.rint(coords[:,0]).astype(int),0,w-1)
        iy=np.clip(np.rint(coords[:,1]).astype(int),0,h-1)
        valid=np.isfinite(zbuffer[iy,ix])&(zs+epsilon>=zbuffer[iy,ix])
        for start,end in _runs(valid):
            if end-start<2:continue
            painter.line([tuple(coords[start]),tuple(coords[end-1])],fill=rgba,width=width)
    return ink


def render_controls(mesh,camera,size=(1024,1536),light=None,style=None):
    style=style or {}
    w,h=size
    mask=silhouette(mesh,camera,size,supersample=int(style.get('supersample',2)))
    mask_image=Image.fromarray(mask,'L')
    work_width=int(style.get('work_width',min(w,512)))
    work_height=max(1,round(h*work_width/w))
    work_size=(work_width,work_height)
    buf=buffers(mesh,camera,work_size)
    key=np.asarray(light if light is not None else light_vector(-75,50),dtype=np.float32)
    shaded=lit_rgba(buf,key,ambient=float(style.get('ambient',.27)),
                    diffuse=float(style.get('diffuse',.66)),material_gray=style.get('material_gray'))
    shaded=shaded.resize(size,Image.Resampling.BICUBIC)
    mode=style.get('linework_mode','legacy')
    if mode=='semantic':
        from .line_hierarchy import render_line_hierarchy
        lines=render_line_hierarchy(mesh,camera,size,style=style)['structure']
    elif mode=='legacy':
        line_buf=buffers(mesh,camera,size)
        lines=visible_lines(mesh,camera,line_buf,size,style)
        stroke=np.asarray(lines,dtype=np.uint8).copy()
        # Preserve graded silhouette alpha on the composited linework pass.
        stroke[...,3]=np.uint8(np.rint(stroke[...,3].astype(np.float32)*(
            np.asarray(mask,dtype=np.float32)/255.)))
        lines=Image.fromarray(stroke,'RGBA')
    else:
        raise ValueError('linework_mode must be legacy or semantic')
    plain=np.asarray(shaded,dtype=np.uint8).copy()
    plain[...,3]=mask
    shaded=Image.fromarray(plain,'RGBA')
    combined=Image.alpha_composite(shaded,lines)
    return {'silhouette':mask_image,'structure':lines,'lit':shaded,'lit_structure':combined}


def export_controls(mesh,cameras,output,size=(1024,1536),light=None,style=None):
    out=Path(output);out.mkdir(parents=True,exist_ok=True)
    written={}
    for name,camera in cameras.items():
        produced=render_controls(mesh,camera,size,light,style)
        written[name]={}
        for kind,img in produced.items():
            path=out/f'{name}_{kind}.png'
            img.save(path)
            written[name][kind]=str(path)
    return written
