"""Tessellated render buffers of verified constructive-solid assemblies.

This mesh format is an output representation, not an evolutionary genotype.
"""
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
    parts: list[dict]=field(default_factory=list)

    def __post_init__(self):
        self.vertices=np.asarray(self.vertices,np.float32).reshape(-1,3)
        self.faces=np.asarray(self.faces,np.int32).reshape(-1,3)
        self.materials=np.asarray(self.materials,np.int16).reshape(-1)
        self.edges=np.asarray(self.edges,np.int32).reshape(-1,3)
        if not len(self.faces) or not len(self.vertices) or len(self.faces)!=len(self.materials):
            raise ValueError('Invalid render mesh')
        if self.faces.min()<0 or self.faces.max()>=len(self.vertices):raise ValueError('Invalid triangles')

    def save(self,path):
        path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
        np.savez_compressed(path,vertices=self.vertices,faces=self.faces,materials=self.materials,
                            edges=self.edges,parts_json=np.array(json.dumps(self.parts)))
        return path

    def export_obj(self,path):
        path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
        trimesh.Trimesh(vertices=self.vertices,faces=self.faces,process=False).export(path)
        return path
