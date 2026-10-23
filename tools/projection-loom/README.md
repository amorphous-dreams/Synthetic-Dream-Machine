# Projection Loom - Evergreen Constructive CAD

Projection Loom builds architecture from named, positive CAD solids and intentional
negative volumes. Every production artifact originates from a validated Boolean
material body. The construction genome, not a triangulated export, supplies the
next evolutionary generation.

## Operating contract

* A rooted construction graph specifies valid positive-volume parent-child joins.
* Authored voids carve gateways, rooms, shafts and recesses from that assembly;
  their route graph and resulting material solidity undergo independent audits.
* Production STEP, OBJ, render mesh and drawing passes share the same carved body.
* Evolutionary candidates undergo the full fused-solid and void audits before
  image-fitness scoring, including when a project contains no voids.
* An external reference requires a fixed evidence camera. An otherwise
  presentation-only camera is locked to the initial seed for evolutionary scoring.
* Viewport locking is not independent proof of camera-to-artwork alignment.
* Technical control exports use semantic linework and project-specified cameras.

## Run the current package

Install Python 3.12+ and CadQuery/OpenCascade, NumPy, SciPy, Pillow, OpenCV,
NetworkX and Pytest.

```bash
PYTHONPATH=. python -m pytest -q tests
PYTHONPATH=. python -m projection_loom validate --project examples/observatory.json --out out/validate
PYTHONPATH=. python -m projection_loom grow --project examples/observatory.json --out out/grow
```

Run candidate selection with `evolve` or `epoch-loop` using the same project.
The subject-neutral observatory is the active example. The Necrospire RGBA/alpha
masters and more elaborate regression benches remain an independent case study,
not a required dependency of the reusable engine or its tests.

## Camera evidence policy

- `fit: bounds` and `fit: height` present architectural geometry on sheets.
- `fit: fixed` holds position, handedness, size and world scale during fitness.
- External reference images require a fixed camera before being admitted.
- Even a fixed camera derived from a seed is marked provisional until independent
  reference registration establishes its actual pose.

## Known caveats

- A positive CAD overlap verifies geometry, not load-bearing strength.
- A void traversal link validates declared overlap and exterior reachability, not
  character clearance, traversable slopes or agent-scale passage widths.
- The current semantic drawing pass uses tessellated visible geometry, not exact
  BRep hidden-line removal. Exported fused solids no longer retain every
  component-specific material label; such part metadata stays in the genome.

## Prior-art anchors

- OpenCascade CAD Boolean/shape checking and topological tolerance tools.
- OpenCascade exact BRep hidden-line removal for eventual fine drawings.
- Quality-diversity archives for preserving meaningful structural variation.
- Persistent topological naming literature: prefer part and feature IDs over
  unstable generated face indices in the active construction grammar.
