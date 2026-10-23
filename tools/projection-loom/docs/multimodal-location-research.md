# Projection Loom: multimodal locations and wide generative epochs

Research wave VII — 2026-10-23. Status: researched system architecture and a tested **evidence/scene contract**. The photogrammetry, GIS resampling, inverse-graphics and multi-fidelity solvers described below are proposed integrations, not implemented backends.

## Bearing: one location, many independently tested representations

A single picture of a ruin can seed a location. An image set, DEM, point cloud, mesh, surveyed plan, manuscript, or detailed CAD model can add stronger constraints later. A location's pet-name binds a *relational set* of entities, not a global fused piece of material. Each solid body still goes through its strict BRep union/void audit; landscape rasters, open surfaces, and disconnected buildings do not become invalid merely because they do not fuse to the first building.

A pet-name may cover a heterogeneous set of anonymous members. Release of a name or fork changes a soft retention preference, never the underlying source facts, geometric audits, or provenance. The existing `RelationWitness` and `PetNameLedger` supply intra-body relational identity; `LocationStack` adds the world/evidence boundary above them. That boundary is additive, not an alternative CAD engine.

## Ten pattern-integrity rhymes

| Domain | Established idea | Proposed Loom operator/invariant | Failure ward |
| --- | --- | --- | --- |
| Cybernetics | Conant/Ashby good-regulator model; Ashby requisite variety | Maintain several structural hypotheses, not a single certainty, when evidence underdetermines the location | Do not pretend unseen surfaces have been observed |
| Structured scene inference | Jointly infer scene objects, cameras, lighting and relations | Variables `G, theta, C, T, Z` and separate image/survey/geometry witness factors | Camera–shape compensation and imagined interiors |
| ShapeAssembly / CGA | Hierarchical grammatical parts and continuous parameters | Discrete edits spawn/join/void/bridge, continuous loops tune dimensions | Only mutate existing numeric loci |
| ShapeCoder / Szalinski | Compress repeated geometry into reusable macros | Operator discovery after an epoch has shown repeated motifs; allow fallback to original rules | Premature abstraction and irreversible compression |
| Factor graphs / SLAM | Observations as factors on shared latent geometry and poses | Per-modality loss terms bound to a specific source and frame | Uncalibrated images treated as metric witnesses |
| IFC / CityGML | Buildings, openings, spaces and district context as distinct typed things | Independent valid solid bodies, route volumes, terrain and collections | One global BRep union for an entire location |
| OpenUSD | Compositional layer stacks, references, variants | Optional scene interchange layer for location membership and alternative hypotheses | Making interchange paths the construction genotype |
| Graph rewriting | Type-checked transformations and dangling-edge guards | Rewrite relations/branches with predictable parent/child survival | Orphan child and silent identity reassignment |
| Quality diversity | Archive locally excellent solutions across distinct niches | Elite-per-phenotype grids, operator-reserved slack, novelty separate from correctness | One scalar score erases every alternative |
| Multi-fidelity optimization | Allocate expensive validation to promising candidates | Coarse silhouette screening -> exact CAD/void gates -> high-res witness comparison | Expensive Boolean audits of every unpromising candidate |

Key references:

- Roger C. Conant and W. Ross Ashby (1970), *Every good regulator of a system must be a model of that system*: https://doi.org/10.1080/00207727008920220
- W. Ross Ashby (1956), *The Law of Requisite Variety*: https://www.panarchy.org/ashby/variety.1956.html
- Structured Generative Models for Scene Understanding (2023): https://arxiv.org/abs/2302.03531
- ShapeAssembly (2020): https://doi.org/10.1145/3414685.3417812
- ShapeCoder (2023): https://doi.org/10.1145/3592416
- Szalinski (2020): https://doi.org/10.1145/3385412.3386012
- GTSAM factor graph tutorial: https://gtsam.org/tutorials/intro.html
- buildingSMART IFC opening semantics: https://standards.buildingsmart.org/IFC/RELEASE/IFC4/FINAL/HTML/schema/ifcproductextension/lexical/ifcopeningelement.htm
- OGC CityGML 3.0: https://www.ogc.org/standards/citygml/
- OpenUSD scene composition: https://openusd.org/25.11/glossary.html
- Graph Rewriting Techniques in Engineering Design (2021): https://doi.org/10.3389/fbuil.2021.815153
- pyribs / CMA-ME archives and emitters: https://pyribs.org/
- Hyperparameter optimization and successive halving: https://doi.org/10.1002/widm.1484

## Mathematical carrier: a constrained *distribution* over constructions

Let `E = {e_i}` carry source evidence, `G` a typed construction grammar, `theta` its continuous dimensions, `C` cameras, `T` world/image registration, `Z` entity correspondences and `V` the proposed void/route graph. A probabilistic long-range design would seek:

`p(G, theta, C, T, Z, V | E) proportional to p(E | G, theta, C, T, Z, V) * p(G, theta, C, T, Z, V)`.

The current Loom does **not** evaluate that posterior. Its practical approximation can minimize a vector of modality-specific losses, only within the feasible set:

```
L_image = 1 - full_frame_IoU(render_silhouette, alpha_master)
L_edge  = robust_distance(visible_semantic_edges, reference_edge_field)
L_sfm   = robust_reprojection_error(cameras, visible_3D_landmarks)
L_dem   = robust_height_residual(terrain_surface, DEM) after verified frame conversion
L_cloud = robust_point_to_surface_distance(visible_CAD, measured_point_cloud)
L_code  = description_length(construction_program)
feasible = valid_per_body_BRep AND valid_void_routes AND valid_frame_claims
```

`L_sfm`, `L_dem` and `L_cloud` must remain disabled (reported *unavailable*, never treated as zeros) when corresponding witnesses are absent. Unknown elevations and unsurveyed source scale retain explicit `unknown` status.

A single optimization scalar can serve a *local* emitter, but the outer archive should retain Pareto alternatives and category diversity: visual correspondence, architectural coherence, interpretability, useful novelty, complexity, and computing cost should remain separately inspectable.

**Scale-gauge law:** unanchored single-view images and ordinary unscaled Structure-from-Motion reconstructions cannot determine global metric scale. Image-fitting auto-scale and guessed camera poses never certify measured meters. A surveyed control, an independently known dimension, or an accepted geospatial transformation must ground that claim. COLMAP documentation and bundle-adjustment theory both make camera/scale gauge freedoms explicit. https://colmap.github.io/tutorial.html ; https://wanghemath.github.io/Book-MathCV/chapters/chapter-17-bundle-adjustment.html

**Raster/terrain law:** a DEM is not simply a large picture. Preserve its geotransform, CRS, resolution, nodata, and height datum; distinguish terrain and surface elevations. An EPSG code alone need not identify a vertical datum. Use GDAL/PROJ or equivalent implementations for *actual* conversions, not hand-waved affine metadata. https://gdal.org/en/stable/tutorials/geotransforms_tut.html ; https://docs.opendronemap.org/gcp/

## The staged, resumable OODA-HA epoch

One outer epoch can host multiple bounded inner methods, with records and reversible choices:

1. **Observe / ingest** — hash original sources, parse EXIF or georeferencing when present, preserve image/time/metric witnesses, detect conflicting or redundant inputs.
2. **Orient / register** — recover or fit cameras, coordinate frames and landmark associations. Record whether transforms are provisional or independently verified. Preserve competing explanations when registration lacks anchors.
3. **Grow topological alternatives** — grammar-level mutations add a body, gate, corridor, stair, brace, cavern, terrain refuge, or nameless fork. Every candidate carries a relational signature, not a permanent mesh face index.
4. **Refine continuous parameters** — search dimensions, placements, loft sections, and materials within the selected grammar; keep camera and architecture optimization decoupled during a scored trial.
5. **Gate validity** — fast cheap checks may *reject* early, but only exact per-body CAD and void audits may *admit* to production. Site-level disconnected bodies may coexist without a false union requirement.
6. **Compare multiple witness fields** — silhouette, edge, camera reprojection, DEM residuals, photogrammetry, and `#has` relations, only where witnesses support that comparison.
7. **Archive quality and diversity** — preserve structural niches, accepted genomes and valid surprise forks. New geometry should not inherit a pet-name unless its relational selector uniquely answers that claim.
8. **Query an absent witness** — optionally request a new photograph, plan, manual annotation, survey coordinate, section, or other source when expected information gain exceeds the effort. Do not manufacture missing observations.
9. **Abstract and name** — factor recurring structures into reusable grammar macros only after evidence supports the pattern. Pet-name an entity or a location; o-takiage releases retention preferences non-destructively.
10. **Ho'oko / checkpoint** — checkpoint code/kernel hashes, evidence digests, frame receipts, genomes, independent validation, conflicts, costs, the operator's selections, and alternative live branches.

The *next best witness* can be selected conceptually by expected predictive information gain per effort:

`a* = argmax_a [H(Q | E) - E_y H(Q | E, y_a)] / cost(a)`

where `Q` describes operator-relevant unresolved geometry (e.g. which side contains the only stair), not an arbitrary global scene uncertainty. See task-specific active next-best-view research: https://proceedings.mlr.press/v306/song26k.html

## Concrete source ladder

| Source bundle | Admissible claims | What remains undetermined |
| --- | --- | --- |
| One drawing/image | Pixel/color contours, possible visible features and soft architecture hypotheses | Absolute scale, hidden faces, internal connections, actual camera pose |
| Two or more overlapping photographs | Consistency across views; some camera/point constraints | Metric scale without control; unseen surfaces |
| Photo survey + surveyed control | More strongly anchored camera poses and 3D points, conditional on verified residuals | Interiors and occluded sections |
| DEM + map CRS/datum | Elevation surface, slopes, terrain constraints at sampled resolution | Hidden rooms, details smaller than source resolution |
| Point cloud/mesh | Sampled surfaces and visible geometry, conditional on sensor fidelity | Causal architectural grammar and unseen voids |
| CAD/IFC and plan resources | Explicit object topology and authored dimensions; possible rooms/openings | Whether it represents a surveyed location or an ideal design |
| Mixed source collection | Cross-checks, contradictions, multiple scale/temporal witnesses | Any unsupported or conflicting inference |

COLMAP: https://colmap.github.io/ ; OpenDroneMap: https://docs.opendronemap.org/ ; OGC 3D Tiles: https://www.ogc.org/standards/3DTiles/ ; OGC GeoTIFF: https://www.ogc.org/standards/geotiff/

## Evergreen code increment

`projection_loom.location_stack` introduces a source/evidence envelope, deliberately avoiding premature GIS or photogrammetry claims:

- `Frame` names pixel, local 3D, and geospatial 3D coordinates and requires explicit CRS / elevation datum on the latter.
- `Source.from_file` hashes actual bytes to provide a reproducible witness; ordinary `Source` accepts supplied digests but does not independently verify the locator.
- `Element` describes a candidate CAD body, terrain, point field, mesh, void network, image plane, or unresolved structure, with source links and `#has` capabilities.
- `Relation` permits heterogeneous relations while keeping containment acyclic.
- `RegistrationReceipt` records method, anchors, residual, and `verified` versus `provisional`; it is **not** itself an executable camera transform or CRS conversion.
- `LocationStack.audit_cad_bodies()` verifies each supplied `SolidAssembly` independently, never globally fusing a whole location.
- `LocationStack.save/load` yields digest-checked snapshots for re-entry; no backward-compatibility scaffolding.

Limitations, intentionally visible: the envelope does **not** run SfM, ingest a real GeoTIFF into a terrain model, perform map transformations, parse IFC, synthesize construction grammars from a photo, or reconcile concurrent ledgers. The current source-frame validation checks metadata contracts, not coordinate correctness against actual external sensors.

## Immediate experiments to prioritize

1. **Single image, three valid counterfactuals:** identical oblique silhouette from different construction grammars; verify diversity survives and hidden geometry stays marked proposed.
2. **Camera and scale gauge:** compare auto-fit versus fixed camera, with and without a surveyed distance. An unanchored picture must never report meters.
3. **Two buildings + terrain:** accept two separately validated CAD bodies and an open terrain surface under a single location pet-name.
4. **GCP/DEM registration:** use known real-world units, datum, and held-out control points; perturb a vertical datum and ensure the calibrated fit fails.
5. **Exterior/interior contradictions:** a source-anchored façade must retain its witnessed openings while unobserved rooms can branch.
6. **Intervention and o-takiage:** release a named bridge branch; ensure geometry remains valid, evidence unchanged and soft retention drops.
7. **Compute-budget fairness:** compare multi-fidelity emitters and full-cost search under equal wall-clock/valid-CAD budgets, not only equal candidate count.
8. **Multiple sources from different dates:** preserve time as part of evidence identity; do not average incompatible historical states into one fictitious survey.

## Anti-patterns to forbid

- One global Boolean union for an entire world/location.
- A single photo automatically becoming a metric survey or a unique 3D answer.
- Mesh/point cloud/NeRF/3DGS appearance overwriting the CAD construction genome.
- Source contradiction disguised by weighted average or a polished render.
- A stale generated frame becoming independent ground truth on the next epoch.
- A pet-name secretly freezing topology or a released fork deleting source records.
- Hard-coding an unverified `#has` capability as a physical guarantee.
- Treating a low-resolution/surrogate pass as a production CAD audit.
- Allowing a graph edit to leave dangling declared children.
- Destructive grammar abstraction without its original lineage as re-entry evidence.

### Research frontier, not a production promise

A useful future synthesis combines typed graph rewriting (for discrete architectural topologies), factor-graph or equivalent estimation (for cameras/frames), rigorous CAD per body, and quality-diversity archives (for alternatives) under a provenance and pet-name ledger. Each backend should declare exactly what it reads, tests, and emits. The Loom orchestrates them, but never pretends one technique establishes another technique's facts.
