# Growth of connected CAD-solid architecture

A construction project declares named solid parts, parent relationships, semantic roles, materials, bounded parameters, and one shared 3D coordinate frame. A builder returns a `SolidAssembly` from ordinary CadQuery solids or the library's box, beam, and loft constructors.

## Attachment contract

A non-root part declares one or more parents that have already been built. The builder describes the visible member and its attachment shape; the engine measures actual intersection of each child CAD solid with each parent using OpenCascade BRep Booleans. A valid joint requires positive shared volume, a configurable minimum fraction of the smaller solid's volume, and a scale-relative minimum bounding extent of the intersecting region. An axis-aligned intersection box is only an envelope test, **not** a proof of mechanical neck thickness. The stronger exact-volume check protects against touching surfaces masquerading as joined architecture.

All parts follow a rooted DAG. A full model must Boolean-fuse into a **single, valid solid**. Exported triangulation does not supersede this test. Failed joint candidates remain rejected even if their projected silhouettes match the artist's reference.

## Constructive operators

- `SolidAssembly.add`: registers a validated closed CAD solid and its structural parents.
- `SolidAssembly.add_box`: adds rectangular or straight-tapered architectural masses.
- `SolidAssembly.add_beam`: grows a rectangular section between explicitly chosen anchor points; both endpoints require verified attachment by named parents.
- `faceted_loft`: creates a continuous, tapered sectional shaft or sculptural foundation.
- `SolidAssembly.audit(join=True)`: measures every authored joint and validates the final BRep union.
- `SolidAssembly.tessellate`: generates a transient rendering mesh and named line roles; this output cannot enter the growth genome.

## Negative volumes and route relations

`SolidAssembly.add_void` grows negative BRep cutters from the same project genome. The void audit verifies intersection with material, declared overlaps between connected spaces, exterior access, reachability, and one valid remaining material solid. These checks establish modeled connections, not agent-scale walkability or strength.

After validation, `material_solid()` supplies the carved body for STEP, OBJ and all four image-control passes. Uncarved per-part meshes may serve diagnostics but never production controls.

## Evolution

The genome controls authored construction dimensions and relationships. Search candidates regenerate all participating volumes and are rejected unless every authored contact, final Boolean union, and void-connectivity audit passes. Diversity is held through selected lineages. Reference silhouettes direct broad proportions; fitted lighting carries secondary weight. Epochs can re-enter `genome.json` with unchanged underlying growth rules, while external art remains evidence rather than geometry.

## Rendering

Every named camera view shares a single object coordinate frame. Evidence scoring freezes its camera and pixel frame before mutation. The solid graph assigns semantic roles to production linework, with optional independent silhouette, occlusion, crease, material, and detail layers. The renderer is downstream of physical construction: raster filtering changes marks, never joints.

## Boundary

CAD-solid validation proves modeled topological/volumetric relations within tolerances; it does not replace engineering stress tests, real-world load assumptions, or a complete plan of architecture unseen in reference images. Concept-art-derived construction retains interpretive design decisions openly in the project builder.
