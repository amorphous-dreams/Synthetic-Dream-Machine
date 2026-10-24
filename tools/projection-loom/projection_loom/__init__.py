"""Projection Loom: constructive CAD, relational emergence and technical views."""
from .solid import SolidAssembly, box, beam, faceted_loft
from .voids import VoidAssembly, VoidPart
from .cameras import Camera
from .relations import RelationWitness, PetNameLedger, capabilities
from .location_stack import LocationStack, Frame, Source, Element, Relation, RegistrationReceipt
from .grammar import grow_program
from .rewriting import apply_rewrite, RewriteReceipt
from .epochs import WideEpoch, Proposal, propose_methods, run_project_epochs
from .ooda import OODAJournal, run_ooda_epochs, submit_control, control_mode
from .geospatial import inspect_dem, sample_dem, project_xy
from .registration3d import register_control_csv, register_landmarks, fit_rigid
from .surface_witness import load_xyz, sample_mesh, sampled_surface_distance
from .capability_stack import Capability, CapabilityRecipe, CapabilityCompositor, OperatorRegistry

__all__ = ['SolidAssembly','box','beam','faceted_loft','VoidAssembly',
           'VoidPart','Camera','RelationWitness','PetNameLedger','capabilities',
           'LocationStack','Frame','Source','Element','Relation','RegistrationReceipt',
           'grow_program','apply_rewrite','RewriteReceipt',
           'WideEpoch','Proposal','propose_methods','run_project_epochs',
           'OODAJournal','run_ooda_epochs','submit_control','control_mode',
           'inspect_dem','sample_dem','project_xy','register_control_csv',
           'register_landmarks','fit_rigid','load_xyz','sample_mesh','sampled_surface_distance',
           'Capability','CapabilityRecipe','CapabilityCompositor','OperatorRegistry']
