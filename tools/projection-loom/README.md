# Projection Loom - Evergreen Constructive CAD

**Current operator handoff:** [Working status, how-tos and backlog](docs/HANDOFF.md)

**Loom Field Guide:** [Operator guidebook, evidence semantics and native ortho reviews](docs/GUIDEBOOK.md). The separately authored Vastlands Guidebook is not a Loom instruction manual., backed by the Lares `projection-loom-handoff.mem` in `bags/lares/ha.ka.ba/lares/api/`. Read the **live** PR head before resuming a checkpoint.

Projection Loom grows architecture from authored and nameless positive CAD solids and
intentional negative volumes. Every production artifact originates from a validated Boolean
material body. The construction genome, not a triangulated export, supplies the
next evolutionary generation.

**Quality-diversity breeding:** see [Necrospire lineage campaign](docs/BREEDING_CAMPAIGN.md) for the version-2 recipe, fairness gates, durable archives, reproducible pilot commands, and provisional evidence boundaries.

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
**actual CAD Act** / Aftermath loop. Any parent phase may also launch a
full nested inquiry (e.g., Observe investigating contradictory sources or
Aftermath asking what an unusual gallery connects). The parent holds that
phase until the inquiry finishes; no phase must spawn a child. Checkpoints
and operator controls can
pause, resume, alter autonomy, review verified CAD previews, pet-name a
nameless entity, select an alternative valid lineage, or perform o-takiage.
The hard geometry and original-evidence gates remain unchanged.

```bash
PYTHONPATH=. python -m projection_loom wide-epoch \
  --project examples/grammar/project.json --out out/helm \
  --passes 3 --candidates 9 --exact-budget 6 --detail-budget 3 \
  --control manual --topology-locus branch
PYTHONPATH=. python -m projection_loom ooda-ha-status --session out/helm/session.json
PYTHONPATH=. python -m projection_loom ooda-ha-steer \
  --session out/helm/session.json --action approve-plan
# Repeat wide-epoch with the same arguments. Inspect out/helm/previews/.
```

Use `ooda-ha-steer --action open-inquiry --loop epoch-0001 --question 'Why?'`
to request a full child OODA-HA under the epoch's current phase. Advance each
inquiry phase using `--action advance-inquiry --loop <id> --phase <phase> --note <receipt>`; when it closes, the original plan or review checkpoint
resumes. See [phase-anchored recursion](docs/ooda-ha-procedural.md#phase-anchored-inquiries-deepen-attention-without-forcing-recursion).

For autonomous execution, use `--control auto-nav` (default) or
`--control full-speed`, or set numeric `--autonomy` in `[0,1]`. Even then,
an external operator may queue `pause`, `review`, `set-autonomy` and `choose`
controls that apply at the next safe boundary. The CLI defaults to a **deterministic selection policy**. Optional
`--llm-provider ollama` or `--llm-provider openai-compatible` engages the
validated adviser for candidate choices; `--llm-phases` also permits bounded
nested-inquiry suggestions. No provider receives authority over CAD gates. Read
[the OODA-HA procedural contract](docs/ooda-ha-procedural.md) for the exact
operator pairing, pet-name/o-takiage flow, and limitations.

## Alpha architecture and CI verification

The canonical controller is `projection_loom.fractal_ooda_ha`.
A lightweight static guard refuses retired OODA-HA aliases, duplicate
controllers, impure phase-law code and dependency back-edges from
renderers to the helm. Check it independently with:

```bash
python scripts/check_architecture.py
python -m compileall -q projection_loom scripts
python -m pip check
python -m pytest -q tests
```

CI uses `requirements-ci.txt` for exact **direct** dependency pins,
checks them against `pyproject.toml` and installed versions, and
records `pip freeze` and tested modeling kernels as artifacts. This
is an inspected environment, **not** an exhaustive transitive wheel-
hash lock. Each commit in the refactoring sequence is independently
bisectable; only the final branch head is eligible for all-three-gate
GREEN claims. See [the evergreen handoff](docs/HANDOFF.md).

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

## PoC 0 original imagery, operator helm, and final gallery

The two **exact** original Necrospire PoC 0 PNGs now live in
[`examples/necrospire/`](examples/necrospire/POC0_README.md). The RGBA alpha and
archived 8-bit mask match exactly. The drawing remains a non-metric,
provisionally registered illustration—not a surveyed 3D scene.

The existing `ooda-ha-steer` inbox lets an Operator–AI pair drive the runtime at
safe phase boundaries without giving the scoring engine an LLM key.
Optionally configure an Ollama or OpenAI-compatible provider for strictly
bounded JSON **advice**, never tool execution or CAD-validity bypass:

```sh
# Deterministic full-speed run: no LLM provider or key needed.
python -m projection_loom ooda-ha-run --project examples/necrospire/project.json \
  --out out/poc0 --passes 5 --candidates 12 --exact-budget 8 \
  --detail-budget 5 --seed 20261023 --control full-speed

# OpenAI-compatible remote endpoint; reads OPENAI_API_KEY from environment.
python -m projection_loom ooda-ha-run --project examples/necrospire/project.json \
  --out out/poc0-llm --control auto-nav --llm-provider openai-compatible \
  --llm-model YOUR_MODEL_NAME

# Local Ollama endpoint (HTTP loopback only).
python -m projection_loom ooda-ha-run --project examples/necrospire/project.json \
  --out out/poc0-ollama --control co-pilot --llm-provider ollama \
  --llm-model YOUR_LOCAL_MODEL_NAME

# Across all scored epochs, re-audit 4 diversity-separated survivors and export.
python -m projection_loom ooda-ha-finalists \
  --project examples/necrospire/project.json --epochs out/poc0 \
  --out out/poc0-finalists --count 4 --size 384 576
```

Pass `--llm-phases` to let an adviser request nested inquiries at phase gates.
Such inquiries deliberately enter durable Operator checkpoints rather than
silently continuing; do not enable that option in unattended production unless
the Operator/agent will actually service those checkpoints. A provider failure
is an operational error, not a failed CAD candidate. Provider prompts send
bounded score/phenotype evidence; original images, local paths and keys remain
outside the advice envelope. The CLI supports explicit manual steering whether
or not a provider is installed.

The across-epoch gallery considers only scored, CAD-valid candidates, then
regrows/re-audits each and writes STEP, OBJ, render mesh, controls, and a
comparison sheet. With the present six-locus PoC 0 builder, all four candidates
may share one broad topology; that is an honest grammar limitation, not evidence
that the method invented new structural kinds. See
[`docs/hard-reference-scout.md`](docs/hard-reference-scout.md) for the next two
hard-source choices and licensing gates.

## Pair A first-pass experiment (isolated branch)

The [Ur reconstruction / Brutalist OpenSCAD](docs/pair-a-first-pass.md) control
runs a modern, lightweight CAD interpretation and a separately compiled synthetic
OpenSCAD STL for each subject. Actual CC BY low-poly Ur and CC0 nosycat archives
are linked but not yet ingested; the initial results test geometry adapters,
fixed cameras, and multiseed operation, **not** external fidelity.

## Hybrid CAD + polymesh named location (research prototype)

The crystalline Necrospire foundation now has a separate faceted polymesh
attached to the verified CAD cage by a named, spatially checked anchor. Exact
CAD and its STEP export remain independently valid; the composite OBJ and
render controls cannot claim one BRep union. Regrow the `#has`-capable location
with two geometric languages, without freezing its relation graph:

```bash
PYTHONPATH=. python examples/necrospire/hybrid/hybrid_demo.py --out out/hybrid-necrospire
PYTHONPATH=. python examples/necrospire/hybrid/run_hybrid_trial.py \
  --out out/hybrid-two-epochs --epochs 2 --per-epoch 6
```

See [hybrid capability stacks](docs/hybrid-capability-stack.md) and the
[surveyed API and license boundaries](docs/reference-intake-ci.md).

## Local/CI dependency and external reference commands

The dedicated `.github/workflows/projection-loom.yml` tests the working branch
and PRs into `feature/green-jello-dinosaur-5` with Python 3.12, OpenSCAD,
regression tests, and a hybrid-CAD smoke run. From Windows/WSL or Linux:

```bash
python -m pip install -r requirements-ci.txt
python -m pip install --no-deps -e .
python -m pytest -q tests
python scripts/fetch_references.py --source brutalism2 \
  --cache .ref-cache --lockfile references.lock.local.json --bootstrap-lock
```

A reference download remains an **unreviewed witness** until its digest has
been inspected and the lock committed. Sketchfab's low-poly Ur uses the
authenticated download API or an official browser archive; no unauthenticated
scene scraping. Original CC0 OpenSCAD scripts and imported STLs never replace
the project's construction genome. See [reference intake/CI](docs/reference-intake-ci.md).

## Evergreen XII — single fractal OODA-HA capability compositor

An individual named or nameless architectural entity can now carry a **narrow,
versioned generative capability stack**. The original CAD root owns exact
structural/void validity. Derived polygon geometry grows from the audited CAD
part, with protected semantic sockets and bounded image-space detail. A part
without CAD representation can also execute a standalone polygon operator
inside a composed location. Each material, polygon, and attachment certificate
retains its own scope.

The existing `ooda-ha-run` and `wide-epoch` commands now share **one controller**.
The selected parent occupies a distinct lineage seed seat, preserving all
Sobol/local/topology proposals rather than masquerading as an exploration sample.
Add `--capability-recipe examples/necrospire/hybrid/recipe.json` to either
command: each scheduled candidate Act opens full OODA-HA capability child
loops, then produces one combined lineage genome for operator review,
pet-naming, o-takiage, and re-entry. The location Aftermath opens its own
final-gallery loop and regrows three to five distinct CAD-plus-mesh artifacts
when enough candidates pass the exact and polygon gates. The program never
chooses a winner or creates a second journal in a separate compound scheduler.

Run the **actual PoC 0** including the independent original RGBA alpha witness:

```bash
python -m projection_loom ooda-ha-run \
  --project examples/necrospire/project.json \
  --capability-recipe examples/necrospire/hybrid/recipe.json \
  --out out/compound-necrospire --control full-speed \
  --passes 3 --candidates 4 --exact-budget 3 --detail-budget 3 \
  --score-size 128 192 --finalists 3
python scripts/check_compound_epoch.py --out out/compound-necrospire
```

See [executable capability composition](docs/capability-ooda-ha-integration.md)
for the phase tree, source/recipe fingerprints, review boundaries and
limitations. Existing `finalists.py` only targets CAD-only experiments;
compound finalists are now produced by the same OODA-HA controller's location
Aftermath, never by a competing runner.

The [three-aperture implementation Aftermath](docs/research/compound-ooda-ha-aftermath.md) records the live engineering critique, corrections and re-entry keys.


### Native pre-campaign readiness

Run `campaign-readiness` for matched source-bound control/candidate campaigns,
independent topology activation controls, replay equivalence and a sealed file manifest.
`campaign-verify --out <directory>` checks the entire archive. See the
[evergreen runbook](docs/HANDOFF.md) for parameters and evidence limitations.


### Experiment Zero · bounded novelty and multi-view reviews

The OODA-HA run command supports optional --explore-overscan, depth, mesh limits and
review seats. The source crop stays fixed inside the extra frame. Native-screened
and scored lineages receive multi-view evidence and independently attributable
Operator/adviser selection. See [Experiment Zero](docs/EXPERIMENT_ZERO.md).


### Current Fire → typed architectural proposals

The canonical house Art Sigils are integrated into Loom ancestry. The *current source-backed AI Fire* translates operator intent into explicitly validated JSON rather than executing memetic-wikitext. `fire-context`, `fire-audition`, and `fire-review` expose relational binding, native CAD auditions, and actual six-view evidence. See [Fire grammar](docs/FIRE_GRAMMAR.md).
