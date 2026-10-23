"""Projection Loom: rooted CAD-solid growth, evolution, and technical views."""
from .solid import SolidAssembly, box, beam, faceted_loft
from .voids import VoidAssembly
from .cameras import Camera
__all__=['SolidAssembly','box','beam','faceted_loft','VoidAssembly','Camera']

from .voids import VoidAssembly, VoidPart
