"""Parametric polygonal assemblies and portable mesh records."""
from dataclasses import dataclass, field
from pathlib import Path
import json
import numpy as np
import trimesh


@dataclass
class Mesh:
    vertices: np.ndarray
    faces: np.ndarray
    materials: np.ndarray
    edges: np.ndarray
    parts: list[dict] = field(default_factory=list)

    def __post_init__(self):
        self.vertices = np.asarray(self.vertices, dtype=np.float32).reshape(-1, 3)
        self.faces = np.asarray(self.faces, dtype=np.int32).reshape(-1, 3)
        self.materials = np.asarray(self.materials, dtype=np.int16).reshape(-1)
        self.edges = np.asarray(self.edges, dtype=np.int32).reshape(-1, 3)
        if len(self.materials) != len(self.faces):
            raise ValueError('One material ID is required per face')
        if not len(self.vertices) or not len(self.faces):
            raise ValueError('A mesh requires vertices and faces')
        if not np.isfinite(self.vertices).all():
            raise ValueError('Mesh contains nonfinite coordinates')
        if self.faces.min() < 0 or self.faces.max() >= len(self.vertices):
            raise ValueError('Face vertex index outside geometry')
        if self.edges.size and (self.edges[:, :2].min() < 0 or self.edges[:, :2].max() >= len(self.vertices)):
            raise ValueError('Edge vertex index outside geometry')

    def save(self, path, parameters=None):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(path, vertices=self.vertices, faces=self.faces,
                            materials=self.materials, edges=self.edges,
                            parts_json=np.array(json.dumps(self.parts)),
                            parameters_json=np.array(json.dumps(parameters or {}, sort_keys=True)))
        return path

    @classmethod
    def load(cls, path):
        with np.load(path, allow_pickle=False) as data:
            parts=(json.loads(str(data['parts_json'].item())) if 'parts_json' in data
                   else [{'name':path.stem, 'first_face':0,'num_faces':len(data['faces'])}])
            return cls(data['vertices'], data['faces'], data['materials'], data['edges'],parts)

    @classmethod
    def from_file(cls, path, crease_degrees=28):
        """Read portable checkpoints and mesh interchange formats.

        OBJ/PLY/STL/GLB/GLTF carry their visible mesh; the generated material
        and part annotations of a native NPZ checkpoint have higher fidelity.
        """
        path = Path(path)
        if not path.is_file():
            raise FileNotFoundError(path)
        if path.suffix.lower() == '.npz':
            return cls.load(path)
        if path.suffix.lower() not in {'.obj', '.ply', '.stl', '.glb', '.gltf'}:
            raise ValueError('Geometry format must be NPZ, OBJ, PLY, STL, GLB or GLTF')
        source = trimesh.load(path, force='mesh', process=False)
        if not isinstance(source, trimesh.Trimesh) or len(source.faces) == 0:
            raise ValueError('Geometry input contains no triangular mesh')
        face_materials = np.zeros(len(source.faces), dtype=np.int16)
        edges = []
        adjacency = source.face_adjacency
        adjacency_edges = source.face_adjacency_edges
        adjacency_angles = source.face_adjacency_angles
        for edge, angle in zip(adjacency_edges, adjacency_angles):
            if float(angle) >= np.deg2rad(crease_degrees):
                edges.append((int(edge[0]), int(edge[1]), 0))
        shared = {tuple(sorted(map(int,edge))) for edge in adjacency_edges}
        for edge in source.edges_unique:
            edge = tuple(sorted(map(int,edge)))
            if edge not in shared:
                edges.append((edge[0], edge[1], 0))
        return cls(np.asarray(source.vertices, np.float32),
                   np.asarray(source.faces, np.int32), face_materials,
                   np.asarray(edges, dtype=np.int32).reshape(-1,3),
                   [{'name': path.stem, 'first_face': 0, 'num_faces':len(source.faces)}])

    def export_obj(self, path):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        trimesh.Trimesh(vertices=self.vertices, faces=self.faces, process=False).export(path)
        return path


class Assembly:
    """Construct a multipart asset with explicit material and edge identity."""
    def __init__(self):
        self.vertices = []
        self.faces = []
        self.materials = []
        self.edges = []
        self.parts = []

    def add(self, name, vertices, faces, material=0, creases=True):
        verts = np.asarray(vertices, dtype=np.float64)
        tris = np.asarray(faces, dtype=np.int32)
        if verts.ndim != 2 or verts.shape[1] != 3 or tris.shape[1] != 3:
            raise ValueError('Expected vertices (N,3) and triangular faces (F,3)')
        offset = len(self.vertices)
        first = len(self.faces)
        self.vertices.extend(verts.tolist())
        self.faces.extend((tris + offset).tolist())
        self.materials.extend([int(material)] * len(tris))
        self.parts.append({'name':str(name), 'first_face':first, 'num_faces':len(tris)})
        if creases:
            pts = verts[tris]
            normals = np.cross(pts[:, 1]-pts[:, 0], pts[:, 2]-pts[:, 0])
            normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)
            face_edges = {}
            for i, t in enumerate(tris):
                for j in range(3):
                    key = tuple(sorted((int(t[j]), int(t[(j+1)%3]))))
                    face_edges.setdefault(key, []).append(i)
            for (a,b), attached in face_edges.items():
                if len(attached) == 2 and abs(float(normals[attached[0]] @ normals[attached[1]])) > .995:
                    continue
                self.edges.append((a+offset,b+offset,int(material)))
        return self

    def prism(self, name, center, extent, material=0, taper=0.0, rotation=0.0):
        x,y,z = (float(v) for v in center)
        w,d,h = (float(v) for v in extent)
        if min(w,d,h) <= 0:
            raise ValueError('Prism dimensions must be positive')
        if not -.95 < taper < .95:
            raise ValueError('Taper must preserve nonzero faces')
        c,s = np.cos(rotation), np.sin(rotation)
        points=[]
        for index,height in enumerate((z,z+h)):
            factor=1-taper if index else 1
            for u,v in ((-1,-1),(1,-1),(1,1),(-1,1)):
                xx,yy=u*w*factor/2,v*d*factor/2
                points.append((x+c*xx-s*yy,y+s*xx+c*yy,height))
        faces=[(0,2,1),(0,3,2),(4,5,6),(4,6,7)]
        for j in range(4):
            k=(j+1)%4
            faces.extend(((j,k,k+4),(j,k+4,j+4)))
        return self.add(name,points,faces,material)

    def beam(self, name, start, end, width, depth, material=0):
        p=np.asarray(start,dtype=float)
        q=np.asarray(end,dtype=float)
        direction=q-p
        norm=np.linalg.norm(direction)
        if norm < 1e-8:
            raise ValueError('Beam endpoints must differ')
        direction/=norm
        reference=np.array((0.,0.,1.)) if abs(direction[2]) < .9 else np.array((1.,0.,0.))
        u=np.cross(direction,reference)
        u/=np.linalg.norm(u)
        v=np.cross(direction,u)
        points=[]
        for endpoint in (p,q):
            for x,y in ((-1,-1),(1,-1),(1,1),(-1,1)):
                points.append(endpoint+x*u*width*.5+y*v*depth*.5)
        faces=[(0,2,1),(0,3,2),(4,5,6),(4,6,7)]
        for j in range(4):
            k=(j+1)%4
            faces.extend(((j,k,k+4),(j,k+4,j+4)))
        return self.add(name,points,faces,material)

    def mesh(self):
        return Mesh(self.vertices,self.faces,self.materials,self.edges,self.parts)
