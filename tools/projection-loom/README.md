# Projection Loom - Evergreen Constructive CAD

Projection Loom grows architecture from authored and nameless positive CAD solids and
intentional negative volumes. Every production artifact originates from a validated Boolean
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
* Entity identity follows constructive relationships and `#has` capabilities. New
  nameless branches need no pet-name, and geometry tolerances cannot force a name.
* Operator pet-names, whole-location names, and *o-takiage* live in an optional
  local-first ledger. They influence selection only as bounded soft preferences.
* A share of valid survivors may carry novel structural phenotypes forward. This
  slack never weakens the CAD and void validity gates.

## Fractal OODA-HA steering: the active wide-epoch driver

The default `wide-epoch` CLI now executes an actual five-phase hierarchical
controller, not a descriptive loop label. A pet-named location runs epoch
loops, and each scheduled candidate runs its own Observe / Orient / Decide /
**actual CAD Act** / Aftermath loop. Checkpoints and operator controls can
pause, resume, alter autonomy, review verified CAD previews, pet-name a
nameless entity, select an alternative valid lineage, or perform o-takiage.
The hard geometry and original-evidence gates remain unchanged.

```bash
PYTHONPATH=. python -m projection_loom wide-epoch \
  --project examples/grammar/project.json --out out/helm \
  --passes 3 --candidates 9 --exact-budget 6 --detail-budget 3 \
  --control manual --topology-locus branch
PYTHONPATH=. python -m projection_loom ooda-status --session out/helm/session.json
PYTHONPATH=. python -m projection_loom ooda-steer \
  --session out/helm/session.json --action approve-plan
# Repeat wide-epoch with the same arguments. Inspect out/helm/previews/.
```

For autonomous execution, use `--control auto-nav` (default) or
`--control full-speed`, or set numeric `--autonomy` in `[0,1]`. Even then,
an external operator may queue `pause`, `review`, `set-autonomy` and `choose`
controls that apply at the next safe boundary. The included CLI uses a
**deterministic selection policy**, not a connected LLM; the Python `adviser`
hook accepts AI suggestions from independently wired providers. Read
[the OODA-HA procedural contract](docs/ooda-ha-procedural.md) for the exact
operator pairing, pet-name/o-takiage flow, and limitations.

## Run the current package

Install Python 3.12+ and CadQuery/OpenCascade, NumPy, SciPy, Pillow, OpenCV,
NetworkX and Pytest.

```bash
PYTHONPATH=. python -m pytest -q tests
PYTHONPATH=. python -m projection_loom validate --project examples/observatory.json --out out/validate
PYTHONPATH=. python -m projection_loom grow --project examples/observatory.json --out out/grow
```

Inspect and pet-name emergent structures with the current subject-neutral example:

```bash
PYTHONPATH=. python -m projection_loom discover --project examples/emergent/project.json --out out/emergent
PYTHONPATH=. python -m projection_loom pet-name --witness out/emergent/relations.json \
    --ledger out/identity.json --target '~p-0003' --name 'A Bridge with Opinions' --has bridge
PYTHONPATH=. python -m projection_loom pet-name --witness out/emergent/relations.json \
    --ledger out/identity.json --target foundation --mode location \
    --name 'Place of Many Possibilities' --has bridge --has portal
PYTHONPATH=. python -m projection_loom o-takiage --ledger out/identity.json \
    --witness out/emergent/relations.json --branch '~p-0003'
PYTHONPATH=. python -m projection_loom evolve --project examples/emergent/project.json \
    --identity-ledger out/identity.json --slack-fraction .2 --out out/explorers
```

Run candidate selection with `evolve` or `epoch-loop` using the same project.
The subject-neutral observatory is the active example. The Necrospire RGBA/alpha
masters and more elaborate regression benches remain an independent case study,
not a required dependency of the reusable engine or its tests.

See [Relational identity, pet-names and o-takiage](docs/relational-identity.md) for
the semantics, ambiguity policy, and saved-ledger contract.

## Evidence-first, heterogeneous locations

`projection_loom.location_stack` carries source-linked observations, proposed entities,
separate CAD bodies, and geospatial terrain under one location pet-name. The
current contract never invents metric scale from an image or demands that a
whole location Boolean-fuse into one solid. See
[Multimodal locations and wide epochs](docs/multimodal-location-research.md).
The scene/evidence contract is tested, but the GIS and photogrammetry backends
described in that research remain future integrations.

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
- Authored relational selectors and optional construction slots rather than unstable
  generated face indices for name reconciliation; ambiguity remains explicit.
- Novelty search and quality-diversity archives as protection for useful surprises.
- Otakiage, a culturally distinct ritual of respectful release, as a metaphor for
  retiring a soft computational hold, not erasing a previous creative contribution.

## Deep research / wide-epoch adapters

The [research register](docs/research/register.md) preserves earlier experiments
as archival testimony, with live contracts for
[measured evidence](docs/research/measurement-contract.md),
[constructive grammar](docs/research/growth-contract.md), and
[staged epochs](docs/research/epoch-contract.md).

Geospatial reading requires the optional dependencies: `pip install -e '.[geo]'`.
`inspect_dem` reads real GeoTIFF metadata and validity masks, while `sample_dem`
queries pixels in their declared projected-meter coordinate frame. The horizontal
conversion refuses an unknown/changed vertical datum. A declared height datum
does not itself constitute a survey verification.

`register_control_csv` reads digest-checked, separated training/holdout survey
correspondences and produces a measured 3D rigid-transform receipt. Manually
supplied landmark pairs remain provisional. This does not calibrate a 3D-to-image
projection from one picture. `load_xyz` and `sample_mesh` read actual XYZ and
OBJ evidence; their sampled nearest-neighbor scores cannot replace BRep audits.

`grow_program` offers an optional executable rule grammar for positive and
negative CAD volumes, conditional nameless branches and parametric dimensions.
`apply_rewrite` produces a *proposed* location-graph revision and content-hash
receipt; it cannot change witnessed facts or substitute for CAD validation.

A resumable, matched-method search: 

```bash
PYTHONPATH=. python -m projection_loom validate --project examples/grammar/project.json --out out/grammar-check
PYTHONPATH=. python -m projection_loom wide-epoch --project examples/grammar/project.json \
  --out out/grammar-epochs --passes 3 --candidates 9 --exact-budget 6 \
  --detail-budget 3 --topology-locus branch --seed 41
```

Three emitters (Sobol, local and topology switch) propose bounded genomes. A
cheap preview schedules CAD attention; full BRep and void audits admit candidates
for objective scoring. Unavailable metrics may not masquerade as zero. The
evidence status `synthetic`, `provisional` or `verified` follows its actual
registration rather than the visual beauty of the result. All lineage and
checkpoint files preserve their input/code fingerprints and are refused on
incompatible re-entry.

**Not implemented:** complete SfM/bundle adjustment, metric 3D reconstruction
from a single drawing, learned grammar synthesis, multiwriter ledger merge,
vertical-datum conversion, automatic IFC/OpenUSD/GIS scene import, exact BRep
hidden-line export, or a Bayesian scene posterior. These remain research
interfaces, not hidden compatibility promises.
