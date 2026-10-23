# Projection Loom

Projection Loom constructs, evaluates, and renders parametric polygonal assemblies through shared orthographic cameras. Its outputs support technical illustration, asset turnaround sheets, compositing, and image-generation control references.

The engine holds no subject-specific geometry. A project supplies a procedural builder **or** an existing mesh, named cameras, source masks, and optional color evidence. Every view projects the same 3D object in one shared coordinate frame.

## Contract

A project supplies a JSON manifest conforming to `spec/project.schema.json`, with either a Python builder or a mesh path. A procedural builder can construct a parametric assembly:

```python
from projection_loom import Assembly

def build(parameters: dict[str, float], detail_level: int):
    assembly = Assembly()
    assembly.prism('column', (0, 0, 0), (1, 1, parameters['height']))
    return assembly.mesh()
```

The builder returns a `Mesh` or `Assembly`, without performing image I/O. To start from an existing mesh instead, set `"geometry": "model.obj"` in the project JSON (and omit `builder`, `bounds`, and `initial`). The loom then exposes bounded deformations of the source's vertices. Geometry retains native material IDs, tagged parts, and stored crease edges when available; interchange imports reconstruct usable structural edges. Camera azimuth and elevation use degrees in a right-handed frame with Z upward; view names belong to the project manifest, not the engine.

## Installation

```bash
python -m pip install -e 'tools/projection-loom[test]'
```

Inside the package directory:

```bash
python -m pip install -e '.[test]'
pytest -q
```

## Commands

Render the example's five independent views:

```bash
projection-loom render --project examples/project.json --out out/assembly
```

Validate its multipart contact graph and projected silhouettes:

```bash
projection-loom validate --project examples/project.json --out out/validation
```

Evolve a model using one or more authoritative view references:

```bash
projection-loom evolve --project examples/project.json \
  --feed reference=out/assembly/controls/reference_silhouette.png \
  --cycles 2 --burst 32 --survivors 6 --offspring 6 --out out/search
```

Warm-start a later search from an exported model:

```bash
projection-loom evolve --project examples/project.json \
  --seed out/search/mesh.npz \
  --feed front=path/to/revised_front_mask.png \
  --feed side=path/to/revised_side_rgba.png \
  --out out/revision
```

## Five-pass epoch loops

Run complete geometry search, multi-view rendering, and bounded self-feedback through five separately checkpointed passes:

```bash
projection-loom epoch-loop --project examples/project.json \
  --seed-geometry path/to/existing_mesh.npz \
  --out out/epoch-05 --passes 5 --burst 64 --survivors 10 --offspring 8
```

Every pass re-enters the accepted mesh and all four control modalities per view. Previously generated silhouettes guide the next search at low weight; linework and lighting controls participate in a continuity gate without replacing fixed source evidence. To continue a stopped run, reuse the same options with `--resume`.

See [epoch-loop documentation](docs/epoch-loop.md) for the complete feedback contract, configuration, directory layout, and acceptance rules.

### Geometry re-entry

**Parametric re-entry** uses `--seed` with a previous `mesh.npz` or parameter JSON. It invokes the same project builder and resumes editing that builder's original parameters.

**Direct geometry re-entry** uses `--seed-geometry` with an NPZ, OBJ, PLY, STL, GLB, or GLTF file. It treats the saved mesh itself as the new source and evolves bounded scale, shear, twist, bend, waist, and upper-spread deformations. The source mesh needs no original builder or stored parameter map:

```bash
projection-loom evolve --project examples/project.json \
  --seed-geometry out/search/mesh.npz \
  --feed front=path/to/revised_front_mask.png \
  --cycles 2 --burst 32 --out out/from-held-geometry
```

To continue that result, use its `mesh.npz` as the next `--seed-geometry` input. The saved coordinates become the held surface for the next epoch. A mesh imported from OBJ or another interchange format can be evolved through the same path. A subsequent run records whether the current geometry came from the project builder or from an imported mesh.

`--seed` and `--seed-geometry` are mutually exclusive: a direct mesh restart must not accidentally apply the original builder's parameters twice. For external meshes, verify coordinate orientation and units before accepting the camera registration. All direct re-entry deformations preserve vertex/face connectivity; they do not automatically invent or repair missing surfaces.

## Outputs

For every named camera, the renderer exports four independent PNGs, with transparency outside the silhouette:

- `VIEW_silhouette.png` — grayscale alpha matte.
- `VIEW_structure.png` — visible structural edges in RGBA.
- `VIEW_lit.png` — neutral material-separated grayscale illumination in RGBA.
- `VIEW_lit_structure.png` — grayscale light with visible linework in RGBA.

The optimizer exports a restartable mesh (`mesh.npz`), an interchange mesh (`mesh.obj`), `manifest.json`, and `search.json`. Native checkpoints retain materials, edge tags, part metadata, and the active parameter values; interchange files may lose such annotations. The run manifest records the geometry's origin, selected parameters, image outputs, connectivity reports, and evaluation counts.

## Evolution

The search explores a Sobol population, retains distinct lineages, mutates them across progressively smaller neighborhoods, selects by a shared silhouette-and-topology objective, and optionally refines under a low-weight directional-light objective. Each cycle may use current orthographic outputs as stability references. Acceptance of new geometry always compares candidates under the same authoritative targets and weights; self-generated references do not become independent evidence about unseen surfaces.

`--feed VIEW=FILE` accepts grayscale silhouettes and RGBA art. In automatic mode, varying alpha supplies the mask; otherwise luminance supplies it. A reference stays aligned to its canvas. Supply a project camera with the same name as the re-fed view.

Photometric scoring compares broad brightness/warmth patterns within visible material regions. Illumination, reflectance, texture, and surface orientation cannot be uniquely recovered from a painted image.

## Connectivity and limits

The validator reports indexed mesh bodies, a conservative axis-aligned contact graph among assembly parts, and connected components of every projected mask. The contact graph uses bounding boxes as a broad-phase test; it may report contact where exact polygonal solids do not touch. Conversely, independent prisms may intersect physically while remaining separate indexed mesh bodies. Neither result alone proves watertightness or manifold geometry.

The silhouette evaluator scores **raw masks**: it does not erase disconnected islands before calculating fitness. This is essential because cleaning a mask before selection could conceal a topology defect. Exported controls preserve the raw silhouette for downstream comparison. A project that requires one fused, watertight mesh should add a Boolean-union or voxel-union stage outside this core.

A single-view reference constrains visible appearance, not hidden topology. Orthographic assets and lighting passes provide reproducible controls, not proof that an unseen side follows from a painting.

## Source layout

`projection_loom/geometry.py` defines assemblies and mesh IO; `geometry_seed.py` defines direct geometry re-entry and bounded deformations; `cameras.py` defines view coordinates; `render.py` supplies control passes; `topology.py` supplies connectivity diagnostics; `fitness.py` supplies image and lighting metrics; `evolution.py` supplies search and project loading; `cli.py` supplies the command surface. `examples/` contains a subject-neutral parametric demonstration and `tests/` exercises the contracts.

## Architectural line hierarchy

A semantic drafting renderer classifies visible lines into whole-object outlines,
interpart occlusion contours, angular structural creases, material seams, and
secondary detail. Enable it with `settings.render.linework_mode: "semantic"` while
retaining the same four image-generation control outputs. For independent RGBA
line classes, call `projection_loom.line_hierarchy.render_line_hierarchy`.

See [Semantic linework](docs/semantic-lines.md) for authored part roles,
screen-space detail limits, hierarchy weights, and the visibility contract.

## Structural construction and contact validation

Projects may provide a rooted `structure` graph and explicit `construction` operators. The construction grammar builds named masses from anchored parents, while volumetric joint tests distinguish positive interior overlap from vertex/edge/face contact. `policy: gate` blocks unsupported geometry before it becomes an accepted evolutionary parent. `policy: report` emits the same QA evidence without blocking rendering.

The renderer inherits architectural line priorities from those same part roles. It preserves the four independent image-generation controls and writes a **separate, transparent structural QA overlay**. The overlays never alter the authoritative silhouette or the submitted silver-blueprint artwork.

Use `examples/structural_project.json` to inspect a supported multi-level assembly. See [structural geometry](docs/structural-geometry.md) for the support graph, convex-solid overlap contract, explicit bracing mutations, rendering integration, and limitations for imported open/nonconvex assets.
