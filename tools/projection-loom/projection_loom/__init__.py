"""Projection Loom: geometry-to-control-image evolutionary production pipeline."""
from .geometry import Assembly, Mesh
from .geometry_seed import DEFORMATION_BOUNDS, IDENTITY, imported_geometry, seeded_builder
from .cameras import Camera
__all__=['Assembly','Mesh','Camera','DEFORMATION_BOUNDS','IDENTITY','imported_geometry','seeded_builder','ArchitectureGraph','Attachment','ConstructionGrammar']

from .architecture_graph import ArchitectureGraph, Attachment
from .structural_mutations import ConstructionGrammar
