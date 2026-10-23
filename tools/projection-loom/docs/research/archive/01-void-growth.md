<!-- Research archive: Projection_Loom_Void_Growth_Research_Prototype.zip / loom_voids/README.md. Historical experimental testimony, not an active model or test fixture. -->

# Projection Loom: Negative-volume architectural growth experiment

This research prototype adds first-class BRep *negative* parts to positive CAD constructions. The positive assembly still needs to pass its original contact/fusion gate; `VoidAssembly` subsequently subtracts authored room, corridor, gate, shaft, and recess volumes and verifies the remaining material remains one valid solid.

## Semantics
- Void geometry uses `cadquery.Solid` objects rather than raster masks.
- Each non-recess navigable void must have a declared route to an external opening.
- Declared connections require positive volumetric intersection, not merely adjacency.
- Exterior-tagged entry voids must cross the outer material surface.
- Internal non-exterior voids must not breach the surface.
- Valid geometry and navigation are distinct: a route graph can be connected while a cut splits the material, and both conditions are audited.
- This implementation validates *declared* adjacency only. Undeclared spatial intersections and path clearances are not exhaustively checked. No physical load-capacity claim is made.

## Architectural precedents
- Historic English stone castles: defended gatehouse, forebuilding, controlled access, keep and chambers. [Historic England: Stone Castles](https://historicengland.org.uk/images-books/publications/iha-stone-castles/heag235-stone-castles/)
- Mesopotamian/Iranian ziggurat: staged concentric cores, terraces and internal stair routes. [Encyclopaedia Iranica: Ziggurat](https://www.iranicaonline.org/articles/ziggurat/)
- Bidirectional procedural architecture: geometry and connectivity inform one another. [Hua et al. 2016](https://doi.org/10.1111/cgf.13074)
- Parametric CAD cutting: [CadQuery cut](https://cadquery.readthedocs.io/en/latest/classreference.html)

## Test
`python -m pytest -q test_voids.py`

## Specimen
`python necrospire_void_specimen.py` writes a STEP fortress/gatehouse with actual entrance, hall, stair shaft, sanctum and a non-through niche. The specimen studies the *architectural vocabulary* of the target but is not a canonical Necrospire geometry reconstruction.

## Next iteration
- Full support for explicit void intersections without bilateral authored links; configurable minimum passage cross-section for walkability.
- Void construction grammar with DAG parent relationships, relationship-conditioned mutations and a differentiated carving order.
- Orthographic section/plan exporters tied to the same positive-minus-negative BRep.
- Distinguish role-specific physical contracts (ordinary supported, magically suspended).
- Run new tests against the exact PR checkout and add a clean CI environment before proposing merge.
