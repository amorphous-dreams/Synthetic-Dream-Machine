# Athenaion — hard prior-art reference for Projection Loom

**Reference status:** Operator-designated hard architectural research reference,
not an execution dependency, authority over Elyncia canon, or automatic source
for native CAD/lineage claims.

**Upstream:** [Leonxlnx/athenaion](https://github.com/Leonxlnx/athenaion)
at pinned commit [9b8bd23b39c458a50fb1201037360047781c45b5](https://github.com/Leonxlnx/athenaion/tree/9b8bd23b39c458a50fb1201037360047781c45b5).
Inspected 2026-10-27. MIT license, copyright (c) 2026 Leon Lin.
[Original license](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/LICENSE).
Do not copy executable code without preserving MIT notice and attribution.

## What the upstream actually implements or describes

- [README](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/README.md):
  procedural Three.js ancient Greek world; nine AI-produced reference images;
  4K rendered still/video examples, 168 modules claimed, no external scene
  assets claimed. Its schedule, hardware, complexity and quality claims remain
  upstream self-reports, not independently reproduced measurements.
- [ART_BIBLE](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/docs/ART_BIBLE.md):
  unified world-scale composition, shape, materials, color statistics and
  atmospheric targets tied to individual views.
- [COMPOSITION](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/docs/COMPOSITION.md):
  shared director layout, landmark-based pinhole camera fitting, inter-view
  constraints and explicit occlusion/composition compromises. The source
  does not independently certify metric calibration of all nine images.
- [CONTRACT](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/docs/CONTRACT.md):
  per-module `build(engine)` and `test(engine)` contract, isolated renders,
  shared placement services, named RNG, resource budgets, module ownership and
  integration rendering before completion.
- [World order](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/src/world/index.js)
  and [spatial layout](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/src/world/layout.js):
  dependencies follow terrain through built fabric to vegetation and effects;
  a shared layout anchors moving sites.
- [Engine](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/src/core/engine.js),
  [footprints](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/src/core/footprints.js),
  [architecture building](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/src/arch/build.js):
  labeled RNG, placement slots, occupancy and shared registries let later
  modules respond to spatial placements made by earlier modules.
- [Render harness](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/tools/render.mjs):
  source/render paired previews and isolated test views; practical quality
  tiers, GPU lock and camera-specific diagnostics.
- [Terrain erosion](https://github.com/Leonxlnx/athenaion/blob/9b8bd23b39c458a50fb1201037360047781c45b5/src/terrain/erosion.js):
  procedural fluvial, thermal and droplet growth; useful optional surface
  methodology, not a native BRep certificate.

## The architectural insight

The significant transferable design lies in *shared sites and dependent
capabilities*: a terrace furnishes slots, a structure claims occupancy, plants
avoid those claims, cameras view one scene, and isolated module tests return to
a full integration render. This resonates with Projection Loom's already
existing `location_stack.py`, `capability_stack.py`, `rewriting.py`,
native geometric gates and generative lineages.

Projection Loom should generalize the principle, not copy the specific
`engine.slots` dictionary, direct shared mutable registry, scene module ordering,
hard-coded coordinate layout or `onShot` visibility hooks. In particular:

1. **Typed sites instead of bare positions.** A bearing site, unsupported
   ornamental socket, route/clearance zone and available ground footprint
   grant different capabilities. Producer and consumer bind through
   relationship handles and explicit frames; never through CAD face indices.
2. **Frame and image-group first.** Each of the three Experiment Zero seeds
   contributes different evidence. Image-group members are independent
   source images only when actually distinct; RGB and alpha of one artwork
   stay one entity. Calibration state remains provisional until witnessed.
3. **Constructive truth remains camera-invariant.** Per-view look/lighting
   may vary as presentation. Per-view changing buildings must fork a
   declared candidate, not silently improve a shared model's source loss.
4. **Growth stays generational.** Grammar programs, operators, seed hashes,
   independent RNG streams and native BRep/void/route audits form inheritable
   evidence. Rendering meshes remain outputs, not parents.
5. **Module-first QA, then full location.** Build a capability alone, inspect
   its input/output contracts, then combine it with all other assets under
   the one OODA-HA controller and a bounded multi-view test matrix.

## Backlog deltas from this external witness

| Backlog hook | Athenaion-derived inspection need | Loom acceptance evidence |
| --- | --- | --- |
| L-01 to L-04 | Typed location-wide scene/layout authority, not a hard-coded subject layout | Generic normalized seed/intent isomorphic across reorder/renaming |
| L-05 to L-08 | Nine-view camera/landmark reasoning and per-module source adapters | Three independent seed admissions; pairwise/three-way composition with attributed frame conflicts |
| L-09 to L-12 | Placement slots, occupancy exclusions, dependency-ordered consumers | Heritable typed socket graph creates valid geometry and distinct clearance/footprint/native checks |
| L-13 to L-16 | Isolated source/render comparison, deterministic RNG, shared scene cameras and resource budgets | Fixed multi-view receipts, keyed streams, no camera-dependent mutation of constructive truth |
| L-17 to L-20 | Per-module tests plus whole-scene render/Aftermath | Seven Experiment Zero cohorts, precise source scope and replay witnesses |

### Required counterexamples

- Change camera or presentation-only dressing while keeping native construction
  fixed: STEP/void/audit/lineage digests MUST NOT move.
- Add a tower at a socket and grow vegetation: the placement policy must
  explicitly distinguish visual footprint avoidance from CAD collision
  and from passage/agent clearance.
- Rename module/file handles and reorder independent source declarations:
  canonical intended geometry and receipts MUST remain semantically identical.
- Provide conflicting image-group poses: refuse fabricated registration,
  retain separate unresolved hypotheses.
- Grow from brutalist grammar alone and ziggurat proxy alone: never require
  a Necrospire image or manufacture silhouette loss.

## What Athenaion does not establish

No native CAD contact/Boolean/void truth, inherited procedural genomes,
fitness-driven generational selection, surveyed camera calibration, general
input-seed adapters or idempotent full-run orchestration is demonstrated by
these inspected files. Its reference images concern one authoring world and
its shot-specific hooks occasionally vary presentation; the Loom's invariants
must remain stronger.

**Reference authority:** hard *consultation* obligation by Operator instruction,
not mandatory adoption of upstream code, measurements or aesthetics.
