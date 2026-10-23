"""Mesh assembly contact and projected-mask connectivity diagnostics."""
import numpy as np
import trimesh
from scipy.ndimage import label


def mask_components(binary, minimum_area=2):
    data=np.asarray(binary,dtype=bool)
    marks,count=label(data,np.ones((3,3),dtype=np.uint8))
    sizes=np.bincount(marks.ravel())[1:]
    ordered=sorted((int(v) for v in sizes),reverse=True)
    return {'count':int(count), 'significant_count':sum(v>=minimum_area for v in ordered),
            'areas':ordered, 'stray_area':sum(ordered[1:]),
            'relative_stray_area':sum(ordered[1:])/max(1,ordered[0]) if ordered else 1.0}


def assembly_contacts(mesh, tolerance=None, relative_tolerance=0.008):
    """Report conservative broad-phase contact between independent mesh parts.

    Overlapping bounding boxes establish candidate contact, not Boolean union.
    The raw vertex/face component counts remain available separately.
    """
    boxes=[]
    verts=np.asarray(mesh.vertices)
    faces=np.asarray(mesh.faces)
    for part in mesh.parts:
        subset=faces[part['first_face']:part['first_face']+part['num_faces']]
        xyz=verts[np.unique(subset)]
        boxes.append((xyz.min(axis=0),xyz.max(axis=0)))
    n=len(boxes)
    if tolerance is None:
        span=np.asarray(mesh.vertices).max(axis=0)-np.asarray(mesh.vertices).min(axis=0)
        tolerance=max(1e-8,float(relative_tolerance)*float(np.linalg.norm(span)))
    roots=list(range(n))
    def find(x):
        while roots[x]!=x:
            roots[x]=roots[roots[x]]
            x=roots[x]
        return x
    for i in range(n):
        for j in range(i+1,n):
            lo0,hi0=boxes[i]
            lo1,hi1=boxes[j]
            gap=np.maximum(0,np.maximum(lo1-hi0,lo0-hi1))
            if float(np.linalg.norm(gap))<=tolerance:
                r0,r1=find(i),find(j)
                roots[r0]=r1
    groups={}
    for i in range(n):
        groups.setdefault(find(i),[]).append(mesh.parts[i]['name'])
    result=sorted(groups.values(),key=len,reverse=True)
    raw=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
    return {'part_contact_groups':result,'part_contact_count':len(result),
            'unattached_parts':[p for group in result[1:] for p in group],
            'indexed_body_count':int(raw.body_count), 'watertight':bool(raw.is_watertight),
            'method':'scale-relative expanded axis-aligned bounding-box broad-phase',
            'contact_tolerance':float(tolerance),
            'contact_is_heuristic':True}


def connectivity_cost(mask,minimum_area=4):
    stats=mask_components(mask,minimum_area)
    return (2.0*max(0,stats['significant_count']-1)
            +3.0*stats['relative_stray_area'],stats)
