# A named object in the void: multi-kernel capability stacks

**Status:** executable CAD + polygon + relational-cage prototype; other kernels remain research.

The essential unit of persistence is the *location's relation graph*, not a single
OpenCascade solid and not one mesh vertex array. A pet-name may hold a collection
of construction entities, anonymous generated forms, source witnesses and
attachments. A name witnesses what a relation *does*, not a permanent face ID.

## ✶ Observe: geometry kernels serve different purposes

| Stack | Native witness / operator | Strong uses | Distinct caveat |
|---|---|---|---|
| OpenCascade / CadQuery BRep | planes, edge loops, analytic surfaces, closed solids | staircase, fortress, beams, door, gallery, hard structural contact | irregular surfaces, erosion, displaced shards require expensive Booleans |
| Poly mesh / Trimesh / Blender | triangle or quad topology, weights, modifiers | faceted obsidian, sculptural and fractured terrain, scans and shaders | mesh topology and winding do not prove a structural BRep union |
| Signed/unsigned distance fields / OpenVDB | voxels and signed-distance sampling | cave systems, erosion, breaks, smooth/blobby transitions | resolution/offset errors; output generally an approximation |
| DEM / point cloud / photogrammetry | measured elevations, XYZ samples and projection frames | external witnesses and alignment | unknown scale, occlusions or surface holes must not create invented interiors |
| OpenUSD-style scene composition | named nodes, transform relationships, variants | non-destructive alternatives and LoD, across engines | scene composition does not run CAD validations by itself |

## ⏿ Tell: from one BRep to multiple capability stacks

A minimum useful proposal: one CAD **cage** attests where structural architecture
anchors; a generated polygon crystal holds a different mutable surface; both
contribute to a composed render, without claiming that the composite forms a
single certified CAD solid. The stack's relation register records:

- the location pet-name and anonymous polygon entity;
- the CAD parent part, vertex anchor on the generated mesh, and tested BRep anchor;
- the transform, coordinate frame and provenance (procedural/external/inferred);
- independent CAD audit, polygon surface audit, and interface proximity receipt;
- what a render can show and what a STEP solid actually certifies.

The first implementation uses `projection_loom.hybrid.HybridLocation`,
`faceted_crystal_mesh`, and `examples/necrospire/hybrid/hybrid_demo.py`.
The `run_hybrid_trial.py` probe mutates both fortress dimensions and crystal
facet perturbations under a fixed unregistered art camera. It compares both
CAD-only and composite silhouettes and **does not assume the hybrid wins**.

## ◇ Alternatives still open for Operator judgment

1. **Parallel rendering over a CAD cage (implemented):** fast, reversible, honest.
   The visible polymesh can overlap the BRep cage; the STEP export remains CAD only.
2. **Promote a tested, watertight triangle mesh to a BRep (not implemented):** only
   after geometric checks and independently successful CAD Boolean conversion;
   never infer it from a shared render or measured anchor alone.
3. **BRep + procedural modifiers (research):** the polygon grammar can inherit
   a CAD cage's attachment rings, but mesh weights, remeshing or topology-changing
   operations remain outside the source CAD genome unless their own parameters
   become explicit authored growth operators.
4. **SDF/VDB layered with CAD (research):** strong candidate for caves, fractures,
   overgrowth and transitions; requires explicit voxel resolution and error
   bounds before proximity or clearance claims cross into the CAD gate.
5. **OpenUSD or glTF scene carriers (research):** preserve variants, provenance,
   partial loading, material/camera state and independently audited sub-objects.

## ▶ Act: current guarantees

- A positive CAD body retains its own one-solid and void checks.
- A polygon sculpture can require positive closed surface volume; an open
  source/terrain layer can opt into a strictly surface-only role.
- An attachment checks a named CAD point against the **actual BRep shape**, and
  checks a designated transformed mesh vertex against that anchor. Neither
  check certifies fusion or load-bearing continuity.
- All composite buffers render from one shared coordinate frame, with explicit
  `composite_cad_union_verified: false` in every result.
- Raw imported meshes need a source SHA-256 before entering a source-identified
  polygon layer, but the digest alone does not establish a measured coordinate frame.
- A seedable crystal grammar shares its top ring with the CAD cage while allowing
  the lower rings to deform and gain faceted irregularity.

## ↺ Aftermath: evidence from the first control

The local two-epoch, 12-candidate hybrid trial reached best IoU 0.7133 against
the original oblique alpha, compared with best CAD-only 0.7296. The crude
mesh grammar did *not* outperform the current CAD silhouette. It did demonstrate
independent polygon evolution under CAD-attested attachment. The original image
is a single unregistered artwork, so even the comparison IoU remains provisional.

## Research anchors

- OpenUSD layer composition and variant sets: https://openusd.org/release/usdfaq.html
- Blender Geometry Nodes mesh Boolean, topology caveats: https://docs.blender.org/manual/en/4.2/modeling/geometry_nodes/mesh/operations/mesh_boolean.html
- OpenVDB `MeshToVolume` signed/unsigned field operators: https://github.com/AcademySoftwareFoundation/openvdb/blob/master/openvdb/openvdb/tools/MeshToVolume.h
- CGAL polygon-mesh corefinement/Boolean and manifold criteria: https://doc.cgal.org/5.3/Polygon_mesh_processing/index.html
- Trimesh Blender Boolean interface: https://trimesh.org/trimesh.interfaces.blender.html

No unrequested SDF backend or production USD export appears in this wave.

## Evergreen implementation: capability composition enters the single OODA-HA helm

The first control above remains historical. Current production-facing
capability composition lives in `projection_loom.capability_stack`, and the
only multi-epoch controller for these recipes lives in
`projection_loom.ooda.run_ooda_ha_epochs`. A candidate's validated BRep passes
through trusted per-entity operators to grow a separate, protected polymesh
surface and semantic sockets. Every stage executes as an actual OODA-HA child
in the parent candidate Act; selected *CAD and mesh loci* return as one genome.
The operator may pet-name `@entity/Crystal` or an entire `@location` witness
without assigning a permanent identity to an OpenCascade face or mesh vertex.
The old `run_hybrid_trial.py` remains a comparative **historical probe**, not
another source of lineage authority.

See [the executable contract](capability-ooda-ha-integration.md).
