# Projection Loom

Projection Loom grows supported architecture from **parametric CAD solids**, selects viable forms, and projects consistent orthographic drafting controls. A project supplies one Python growth builder, bounded construction parameters, named cameras, and optional reference imagery. The same authoritative BRep serves every view.

Every solid beyond the root names its parent volumes. Parent-child joints must have measurable three-dimensional overlap, not a point/edge/face touch or apparent contact in a projection. Accepted models produce **one valid Boolean union** before export. Volumetric overlap is a construction constraint; it is not a finite-element analysis or proof of mechanical load-bearing strength.

## Install

```bash
python -m pip install -e '.[test]'
python -m pytest -q
```

Requires Python 3.12+ and CadQuery/OpenCascade. To run directly from the package directory without installing:

```bash
python -m projection_loom validate --project examples/observatory.json --out out/validation
```

## Growth contract

```python
from projection_loom import SolidAssembly, box


def grow(parameters):
    assembly = SolidAssembly()
    assembly.add('foundation', box((0, 0, 0), (3, 3, 3)), role='foundation')
    assembly.add_box('tower', (0, 0, 2.1), (1.6, 1.6, parameters['height']),
                     parents=['foundation'], role='primary')
    return assembly
```

A JSON project uses schema `projection-loom/solid-project/v2` and declares the builder entry point, bounded genome, initial values, cameras, and optional `reference` and light direction. The builder owns object geometry; the engine supplies structural validation, candidate selection, and rendering.

**Solids are the source of truth.** Tessellated meshes, projected masks, RGBA linework, and reference paintings cannot become new growth genotypes. A saved `genome.json` can seed subsequent growth while preserving the authored construction relationships. Changes to an assembly originate in its builder and parameter genome, not vertex deformation of a rendered mesh.

## CLI

```bash
projection-loom validate --project examples/observatory.json --out out/validation
projection-loom grow --project examples/observatory.json --out out/grown
projection-loom evolve --project examples/observatory.json --out out/lineages \
    --burst 32 --survivors 6 --offspring 5
projection-loom epoch-loop --project examples/observatory.json --out out/epochs \
    --passes 5 --burst 32 --survivors 6 --offspring 5
```

Use `--genome out/lineages/lineage_01/genome.json` to re-enter the **construction genome**. No command accepts `--seed-geometry`; an imported OBJ/NPZ/GLB cannot bypass CAD construction or support validation.

## Evidence and selection

An exploratory Sobol population grows new assemblies from the same root grammar. Every candidate must pass measured parent-child overlap before its orthographic reference fit is scored. Surviving lineages receive progressively smaller constructive mutations; optional directional lighting influences only a small secondary score. Epoch loops regrow solids from selected genomes, compare against a fixed source reference, and retain previous orthographic masks as bounded stabilizers. Self-produced views never replace external reference evidence.

Accepted exports contain `solid.step` (the fused BRep), `fused.obj` (interchange geometry), `render_mesh.npz` (render transport only), `genome.json`, `manifest.json`, and the four **independent** image-control passes for each camera:

- `VIEW_silhouette.png` — graded 8-bit matte.
- `VIEW_structure.png` — transparent semantic architectural lines.
- `VIEW_lit.png` — simple grayscale lighting over a transparent ground.
- `VIEW_lit_structure.png` — combined lit form and technical lines.

Lines have explicit priority: silhouette, interpart occlusion, meaningful creases, material seams, and small detail. Renderer decisions never alter the CAD-solid support graph. Drawings do not prove geometry joined; the BRep audit does not replace visual critique.

## Geometry policy

- A model contains exactly one root and a rooted acyclic attachment graph.
- Every descendant part is one valid closed CAD solid with positive volume.
- Every declared parent-child link must exceed its minimum common-volume ratio and its role-scaled intersection-envelope threshold.
- The complete assembly must Boolean-fuse into one valid BRep solid.
- Broad-phase bounding boxes, 2D silhouette continuity, and indexed-triangle connectivity supply diagnostics only; none certifies a joint.
- A STEP union certifies topological solidity within CAD tolerances. Physical strength, stability, manufacturability, and structural engineering demand additional analysis.
- No imported triangle mesh may serve as an evolutionary geometry seed.

See [Solid growth](docs/solid-growth.md) for construction semantics and [Semantic linework](docs/semantic-lines.md) for the linework hierarchy.
