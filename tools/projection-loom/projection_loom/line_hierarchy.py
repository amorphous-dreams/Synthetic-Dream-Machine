"""Camera-aware architectural line hierarchy for multipart polygonal meshes.

The drawing separates the outline, occluding interpart seams, structural
creases, and material boundaries. It preserves 3D visibility and optional
project-authored part roles while treating fine triangulation as construction
metadata rather than automatically meaningful ink.

All stroke masks are projected in a single camera frame. The compositor keeps
classes separate until after prioritization, so a large outline never inherits
an accidental detail stroke's weight or alpha.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
import numpy as np
import cv2
from PIL import Image

CLASS_ORDER = (
    'detail', 'material', 'crease', 'occlusion', 'outline',
)
# Defaults describe relative graphic hierarchy, not a standardized drafting scale.
DEFAULT_STYLE = {
    'outline': {'width': 3.0, 'opacity': 1.0},
    'occlusion': {'width': 2.0, 'opacity': .87},
    'crease': {'width': 1.35, 'opacity': .73},
    'material': {'width': 1.0, 'opacity': .58},
    'detail': {'width': .85, 'opacity': .40},
}
ROLE_STRENGTH = {
    'primary': 1.0,
    'secondary': .76,
    'detail': .43,
    'suppress': 0.0,
}


@dataclass(frozen=True)
class EdgeEvidence:
    edge: tuple[int, int]
    face_ids: tuple[int, ...]
    category: str
    crease_degrees: float
    projected_length: float = 0.0
    part_role: str = 'primary'


def _face_normals(mesh):
    xyz = np.asarray(mesh.vertices, dtype=np.float64)[np.asarray(mesh.faces)]
    normals = np.cross(xyz[:, 1] - xyz[:, 0], xyz[:, 2] - xyz[:, 0])
    lengths = np.linalg.norm(normals, axis=1, keepdims=True)
    return normals / np.maximum(lengths, 1e-10)


def _face_parts(mesh):
    ids=np.full(len(mesh.faces), -1, dtype=np.int32)
    for index, part in enumerate(getattr(mesh, 'parts', ())):
        start=int(part['first_face'])
        stop=start+int(part['num_faces'])
        if start < 0 or stop > len(ids):
            raise ValueError('Part face range outside mesh')
        ids[start:stop]=index
    if (ids<0).any():
        ids[ids<0]=len(getattr(mesh, 'parts', ()))
    return ids


def _part_roles(mesh, face_parts, roles):
    parts=list(getattr(mesh, 'parts', ()))
    result=[]
    for face_part_id in np.unique(face_parts):
        if int(face_part_id)>=len(parts):
            role='primary'
        else:
            part=parts[int(face_part_id)]
            role=roles.get(str(part['name']), part.get('line_role','primary'))
        if role not in ROLE_STRENGTH:
            raise ValueError(f'Unknown line role {role}; choose {tuple(ROLE_STRENGTH)}')
        result.append((int(face_part_id),role))
    return dict(result)


def classify_edges(mesh, camera, size=(1024,1536), *,
                   crease_angle=33.0, detail_angle=14.0,
                   role_overrides=None, presentation_width=None,
                   min_display_length=1.6):
    """Categorize mesh edges from face adjacency, dihedral angle, and author roles.

    Edges of ordinary coplanar triangulation do not enter the ink graph.
    Presentational length is measured at the smaller intended display size.
    """
    role_overrides=role_overrides or {}
    xy, _, _=camera.project(mesh.vertices, size)
    fids=np.asarray(mesh.faces, dtype=np.int32)
    matids=np.asarray(mesh.materials, dtype=np.int32)
    normals=_face_normals(mesh)
    part_index=_face_parts(mesh)
    role_of_part=_part_roles(mesh, part_index, role_overrides)
    graph=defaultdict(list)
    for fid,tri in enumerate(fids):
        for ia,ib in ((0,1),(1,2),(2,0)):
            a,b=sorted((int(tri[ia]), int(tri[ib])))
            graph[(a,b)].append(fid)
    # A saved edge list can mark structural lines that the geometry alone
    # cannot classify, but it cannot promote a coplanar triangulation edge.
    explicit={tuple(sorted((int(edge[0]),int(edge[1])))) for edge in mesh.edges}
    ratio=float(presentation_width or size[0])/max(1,size[0])
    evidence=[]
    for pair,facing in graph.items():
        length=float(np.linalg.norm(xy[pair[0]]-xy[pair[1]]))
        if length*ratio < min_display_length:
            continue
        if len(facing)==1:
            category='crease'; angle=180.0
        elif len(facing)>2:
            category='crease'; angle=180.0
        else:
            i,j=facing
            cos=np.clip(abs(float(normals[i]@normals[j])),0.,1.)
            angle=float(np.degrees(np.arccos(cos)))
            if matids[i] != matids[j]:
                category='material'
            elif angle>=crease_angle:
                category='crease'
            elif angle>=detail_angle and pair in explicit:
                category='detail'
            else:
                continue
        # Suppressed parts do not contribute non-contour strokes.
        strengths=[ROLE_STRENGTH[role_of_part[part_index[fid]]] for fid in facing]
        strength=max(strengths)
        if strength<=0:
            continue
        if category=='crease' and strength<.6:
            category='detail'
        role=max((role_of_part[part_index[fid]] for fid in facing),
                 key=lambda k:ROLE_STRENGTH[k])
        evidence.append(EdgeEvidence(pair,tuple(facing),category,angle,length,role))
    return evidence


def _line_runs(values):
    x=np.asarray(values,dtype=bool)
    where=np.flatnonzero(np.diff(np.r_[False,x,False].astype(np.int8)))
    return zip(where[::2],where[1::2])


def _render_edge_categories(mesh,camera,buffer,size,strokes, *,
                           depth_epsilon_ratio=.004,scale=2):
    w,h=size
    xy,depth,_=camera.project(mesh.vertices,size)
    scene_range=float(np.ptp(depth))
    epsilon=max(1.e-4,scene_range*depth_epsilon_ratio)
    zbuffer=buffer['depth']
    masks={c:np.zeros((h,w),dtype=np.uint8) for c in CLASS_ORDER}
    # Low-priority strokes land first; later primary strokes retain their opacity.
    for ev in sorted(strokes,key=lambda x:ROLE_STRENGTH[x.part_role]):
        a,b=ev.edge
        p0,p1=xy[a],xy[b]
        length=float(np.linalg.norm(p1-p0))
        n=max(3,int(np.ceil(length/.75)))
        t=np.linspace(0,1,n)
        pts=p0[None,:]*(1-t[:,None])+p1[None,:]*t[:,None]
        zs=depth[a]*(1-t)+depth[b]*t
        ix=np.rint(pts[:,0]).astype(np.int32)
        iy=np.rint(pts[:,1]).astype(np.int32)
        within=(ix>=0)&(ix<w)&(iy>=0)&(iy<h)
        safe_x=np.clip(ix,0,w-1);safe_y=np.clip(iy,0,h-1)
        sample=zbuffer[safe_y,safe_x]
        visible=within & np.isfinite(sample)&(zs+epsilon>=sample)
        for start,end in _line_runs(visible):
            if end-start<2:continue
            poly=pts[start:end].reshape(-1,1,2)
            strength=ROLE_STRENGTH[ev.part_role]
            cv2.polylines(masks[ev.category],[np.rint(poly).astype(np.int32)],
                          False,int(round(255*strength)),1,lineType=cv2.LINE_AA)
    return masks


def _visible_part_boundaries(mesh, buffer, *,
                             minimum_part_pixels=50, depth_jump_ratio=.004):
    """Extract interpart occlusions and material seams from visible G-buffer faces.

    No face-index edge sharing is required: assembled prisms can intersect in
    model space without sharing vertices. A depth discontinuity or changed
    normal establishes geometric occlusion; a material change establishes a
    softer drafting seam. Both require visible sides of the contact.
    """
    fids=buffer['face_id']
    occupied=buffer['occupancy']
    h,w=occupied.shape
    part_faces=_face_parts(mesh)
    part=np.full((h,w),-1,dtype=np.int32)
    part[occupied]=part_faces[fids[occupied]]
    material=np.full((h,w),-1,dtype=np.int32)
    material[occupied]=np.asarray(mesh.materials)[fids[occupied]]
    z=buffer['depth']; normals=buffer['normal']
    visible_z=z[occupied]
    zscale=float(np.ptp(visible_z)) if visible_z.size else 1.
    threshold=max(1.e-5,zscale*depth_jump_ratio)
    sizes=np.bincount(part[occupied].ravel()) if occupied.any() else np.zeros(1,dtype=int)
    occlusion=np.zeros((h,w),dtype=np.uint8)
    material_seam=np.zeros((h,w),dtype=np.uint8)
    for axis in (0,1):
        if axis==0:
            a,b=part[:-1,:],part[1:,:]
            ma,mb=material[:-1,:],material[1:,:]
            za,zb=z[:-1,:],z[1:,:]
            n0,n1=normals[:-1,:],normals[1:,:]
            out_occ=occlusion[:-1,:]; out_mat=material_seam[:-1,:]
        else:
            a,b=part[:,:-1],part[:,1:]
            ma,mb=material[:,:-1],material[:,1:]
            za,zb=z[:,:-1],z[:,1:]
            n0,n1=normals[:,:-1],normals[:,1:]
            out_occ=occlusion[:,:-1]; out_mat=material_seam[:,:-1]
        diff=(a>=0)&(b>=0)&(a!=b)
        if not diff.any():continue
        two_important=np.maximum(sizes[np.maximum(0,a)],sizes[np.maximum(0,b)])>=minimum_part_pixels
        depth_difference=np.zeros_like(za,dtype=np.float32)
        np.subtract(za,zb,out=depth_difference,where=diff)
        change=np.abs(np.sum(n0*n1,axis=-1))<.93
        visible_boundary=diff & two_important
        seam=visible_boundary & (ma!=mb)
        occ=visible_boundary & (~seam) & ((np.abs(depth_difference)>threshold)|change)
        out_occ[occ]=255
        out_mat[seam]=255
    return occlusion,material_seam


def _contour_rim(mask, width=3.0, scale=2):
    shape=mask.shape
    result=np.zeros(shape,dtype=np.uint8)
    contours,_=cv2.findContours(np.uint8(mask>128),cv2.RETR_TREE,cv2.CHAIN_APPROX_NONE)
    if contours:
        cv2.drawContours(result,contours,-1,255,max(1,int(round(width*scale))),lineType=cv2.LINE_AA)
    return result


def _rgba_alpha(mask, color, opacity):
    a=np.uint8(np.clip(mask.astype(np.float32)*opacity,0,255))
    rgba=np.zeros((*mask.shape,4),dtype=np.uint8)
    rgba[:,:,:3]=np.asarray(color,dtype=np.uint8)
    rgba[:,:,3]=a
    return Image.fromarray(rgba,'RGBA')


def render_line_hierarchy(mesh,camera,size=(1024,1536), *,
                          style=None, visibility_buffer=None):
    """Return explicit feature classes and a composited RGBA structural drawing.

    Supersampling happens before alpha clipping. The output remains transparent
    outside the authoritative whole-asset silhouette. The silhouette always
    participates as a separate highest-priority layer.
    """
    from .render import silhouette, buffers
    style=dict(style or {})
    width,height=size
    mult=max(1,int(style.get('line_supersample',2)))
    work=(width*mult,height*mult)
    mask=np.asarray(silhouette(mesh,camera,work,supersample=1),dtype=np.uint8)
    buf=buffers(mesh,camera,work) if visibility_buffer is None else visibility_buffer
    if buf['depth'].shape!=mask.shape:
        raise ValueError('Visibility buffer and supersampled render dimensions must match')
    evidence=classify_edges(
        mesh,camera,work,crease_angle=float(style.get('crease_angle',33.)),
        detail_angle=float(style.get('detail_angle',14.)),
        role_overrides=style.get('part_roles',{}),
        presentation_width=float(style.get('presentation_width', width)),
        min_display_length=float(style.get('min_display_length',1.7)))
    classes=_render_edge_categories(mesh,camera,buf,work,evidence,
                                   depth_epsilon_ratio=float(style.get('depth_epsilon_ratio',.004)),scale=mult)
    raster_occlusion,raster_material=_visible_part_boundaries(mesh,buf,
        minimum_part_pixels=max(5,int(style.get('min_part_pixels',50))*mult*mult),
        depth_jump_ratio=float(style.get('depth_jump_ratio',.004)))
    classes['occlusion']=raster_occlusion
    classes['material']=np.maximum(classes['material'],raster_material)
    classes['outline']=_contour_rim(mask,float(style.get('outline_width',3)),scale=mult)
    layer_style={c:{**DEFAULT_STYLE[c], **style.get('classes',{}).get(c,{})} for c in CLASS_ORDER}
    color=tuple(style.get('color',(184,211,237)))
    out={}
    for category in CLASS_ORDER:
        raw=classes[category]
        st=layer_style[category]
        draw_width=max(1,int(round(float(st['width'])*mult)))
        # Screen-space raster masks already hold sampled centerlines.
        if category not in ('outline',) and draw_width>1:
            kernel=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(draw_width,draw_width))
            raw=cv2.dilate(raw,kernel)
        # The controlling silhouette clips stroke coverage proportionally at
        # antialiased edges rather than throwing away graded alpha.
        clipped=np.uint8(np.round(raw.astype(np.float32)*(mask.astype(np.float32)/255.)))
        if mult>1:
            clipped=cv2.resize(clipped,size,interpolation=cv2.INTER_AREA)
        out[category]=_rgba_alpha(clipped,color,float(st['opacity']))
    # Compositing identical ink color by alpha-over artificially brightens
    # overlapping detail. Preserve the strongest priority at each pixel.
    dominant=np.maximum.reduce([np.asarray(out[c])[...,3] for c in CLASS_ORDER])
    out['structure']=_rgba_alpha(dominant,color,1.0)
    out['stats']={
        'classified_edges':len(evidence),
        'by_category':{name:sum(e.category==name for e in evidence) for name in CLASS_ORDER},
        'ink_pixels_by_category':{name:int((np.asarray(out[name])[...,3]>5).sum()) for name in CLASS_ORDER},
        'ink_coverage':float((np.asarray(out['structure'])[...,3]>5).mean()),
        'presentation_width':float(style.get('presentation_width',width)),
    }
    return out
