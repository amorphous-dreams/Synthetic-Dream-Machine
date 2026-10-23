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
