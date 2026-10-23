"""Digest-checked sampled surface evidence, never an evolutionary mesh genome.

A point cloud and a triangle mesh can add an independently sourced witness.
Nearest *sampled* point distances approximate visible surface agreement; these
numbers never prove solid validity, hidden interiors or correct metric scale.
All comparisons require an identical declared 3D frame and fixed native units.
"""
from __future__ import annotations
from dataclasses import dataclass,asdict
from pathlib import Path
from hashlib import sha256
import numpy as np
from scipy.spatial import cKDTree

from .location_stack import LocationStack


def _source(stack, source_id, kinds):
    stack.audit()
    src=stack.sources[source_id]
    if src.kind not in kinds:
        raise ValueError('Incompatible surface source kind')
    frame=stack.frames[src.frame_id]
    if frame.kind not in ('local3d','geospatial3d'):
        raise ValueError('Point/mesh observations require a 3D frame')
    path=Path(src.locator)
    if not path.is_file():
        raise FileNotFoundError(path)
    hasher=sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024*1024),b''):
            hasher.update(block)
    if hasher.hexdigest()!=src.sha256:
        raise ValueError('Point/mesh source bytes changed')
    return path,src,frame


def _finite_xyz(values):
    a=np.asarray(values,dtype=float)
    if a.ndim!=2 or a.shape[1]!=3 or not len(a) or not np.isfinite(a).all():
        raise ValueError('Expected nonempty finite Nx3 sample coordinates')
    return a


@dataclass(frozen=True)
class SurfaceObservation:
    source_id: str
    source_sha256: str
    frame_id: str
    units: str
    points: tuple[tuple[float,float,float], ...]
    sample_type: str

    def as_array(self):
        return np.array(self.points,dtype=float)

    def to_dict(self):
        return asdict(self)


def load_xyz(stack: LocationStack, source_id, *, max_points=100_000):
    """Read real XYZ lines; fixed input limits avoid unbounded surprise loads."""
    path,src,frame=_source(stack,source_id,{'point_cloud'})
    if max_points<1:raise ValueError('Point limit must be positive')
    points=[]
    with path.open(encoding='utf8') as stream:
        for line in stream:
            if not line.strip() or line.lstrip().startswith('#'):
                continue
            fields=line.strip().split()
            if len(fields)!=3:
                raise ValueError('XYZ expects exactly three coordinates per row')
            points.append(tuple(float(x) for x in fields))
            if len(points)>max_points:
                raise ValueError('Point cloud exceeds stated ingest limit')
    samples=_finite_xyz(points)
    return SurfaceObservation(src.id,src.sha256,frame.id,frame.units,
                              tuple(map(tuple,samples.tolist())),'observed-points')


def sample_mesh(stack: LocationStack, source_id, *, count=2000, seed=19):
    """Surface-sample OBJ/GLB evidence, not a CAD genome or solid certificate."""
    import trimesh
    path,src,frame=_source(stack,source_id,{'photogrammetry_mesh','cad_model'})
    if count<1 or count>500_000:raise ValueError('Invalid sample budget')
    if path.suffix.lower() not in ('.obj', '.glb'):
        raise ValueError('Surface witness adapter accepts OBJ or GLB only')
    # GLB often contains a scene graph, instanced meshes, and transforms.
    # Flatten only into ephemeral *witness points*; never claim a BRep union.
    if path.stat().st_size > 100*1024*1024:
        raise ValueError('Surface source exceeds 100 MiB per-file ingest limit')
    obj=trimesh.load(path,process=False)
    mesh=obj.to_geometry() if isinstance(obj,trimesh.Scene) else obj
    if not isinstance(mesh,trimesh.Trimesh) or len(mesh.faces)<1:
        raise ValueError('Source must contain triangle surface faces')
    if len(mesh.faces)>4_000_000 or len(mesh.vertices)>5_000_000:
        raise ValueError('Mesh exceeds geometric ingest complexity limit')
    if not np.isfinite(mesh.vertices).all():
        raise ValueError('Mesh coordinates must be finite')
    points,_=trimesh.sample.sample_surface(mesh,count,seed=seed)
    points=_finite_xyz(points)
    return SurfaceObservation(src.id,src.sha256,frame.id,frame.units,
                              tuple(map(tuple,points.tolist())),'sampled-triangle-surface')


def sampled_surface_distance(observed: SurfaceObservation, modeled: SurfaceObservation):
    """Two-way sampled nearest-point distances; not an exact CAD distance."""
    if observed.frame_id!=modeled.frame_id or observed.units!=modeled.units:
        raise ValueError('Unregistered or differently scaled surface witnesses')
    x,y=observed.as_array(),modeled.as_array()
    if len(x)<1 or len(y)<1:raise ValueError('Empty witness')
    forward=cKDTree(y).query(x)[0]
    reverse=cKDTree(x).query(y)[0]
    return {'sampled_bidirectional_rms':float(np.sqrt((np.mean(forward**2)+
                                                        np.mean(reverse**2))/2)),
            'observed_count':len(x),'modeled_count':len(y),
            'units':observed.units,'method':'bidirectional-nearest-sampled-point'}
