# One OODA-HA helm, per-entity capability composition

## Current executable contract

The **only active multi-epoch CLI controller** for exploratory and compound
search runs in `projection_loom.ooda.run_ooda_epochs`. `wide-epoch` and
`ooda-run` invoke the same controller. `projection_loom.capability_stack`
defines validated operators and recipes, not another epoch state machine.
The lower-level `WideEpoch` handles budgeted candidate CAD/void admission and
fitness within the parent OODA-HA Act; it never independently makes operator
lineage choices.

A pet-named location owns a **capability recipe**, bounded numeric genome,
source witnesses and a relation ledger. Its operators form a dependency DAG.
Each entity may use a *narrow subset* of trusted operators, including CAD,
CAD-to-polymesh, standalone polymesh, physical CAD contact, and semantic
cross-kernel attachment sockets. An entity can remain nameless; capability
steps record what it did, not a mandatory pet-name.

## Executed fractal workflow

```text
Location ✶ ⏿ ◇ ▶
  Epoch ✶ ⏿ ◇ ▶
    Candidate ✶ ⏿ ◇ ▶ (complete construction / scoring)
      Capability ✶ ⏿ ◇ ▶ (trusted operator executes) ↺ closed
      Capability ✶ ⏿ ◇ ▶ (may be inactive)       ↺ closed
    Candidate ↺ closed (CAD / mesh / socket / score receipt)
  Epoch ↺ (operator previews, pet-name, o-takiage, selection) closed
Location ↺
  Final gallery ✶ ⏿ ◇ ▶ (regrow finalists) ↺ closed
Location closed
```

**One journal** owns all these loops. A parent cannot leave its phase while
children remain open. Manual, co-pilot, auto-nav and full-speed use the same
phase graph and can all receive operator inquiries and steering at safe points.
An opt-in LLM adviser can suggest a *validated* winner or a bounded inquiry;
neither human nor adviser can waive CAD and source evidence gates.

## Capability authority

- The underlying `SolidAssembly` validates each positive-volume parent/child
  attachment and the single fused CAD material (and connected authored voids).
- `derived_cad_surface` tessellates the **actual validated CAD part** and
  applies bounded seeded sculptural relief. A semantic socket protects its
  attachment region. The camera establishes a measured screen-space detail cap;
  any guidance from an unregistered illustration remains explicitly provisional.
- Polymesh surfaces independently prove closed positive volume or an expressly
  allowed open surface. Socket proximity to CAD earns a *spatial* certificate,
  **not** mechanical fusion or load-bearing proof.
- Visual replacement excludes covered structural CAD parts from the composed
  render, while production STEP continues to contain the validated CAD body.
- A location/entity witness adds stable `@entity/…` relational handles and
  `#has` descriptions for completed operators, while keeping all physical CAD
  part and void witnesses. No mesh vertex index becomes a durable pet-name.

## Epoch inheritance and operator controls

Each surviving proposal carries both CAD and surface loci as one bounded
**compound genome**, with immutable recipe digest, source hashes and trusted
operator fingerprint. Changing a source, recipe, implementation, or algorithm
invalidates an in-progress journal's identity; fork the run rather than
silently reusing old fitness receipts.

`_composition_previews` regrows every operator-ready option from the scored
candidate. `pet-name`, `o-takiage` and `choose` then operate through the same
existing durable operator inbox. Aftermath can retain a less fit but more
interesting candidate on an explicit Operator decision. A final-gallery child
under location Aftermath gathers **all scored and valid candidates across all
epochs**, prioritizes meaningful phenotype variation, regrows them, audits
again, and exports 3–5 when enough distinct survivors exist.

If fewer than three valid distinct models survive, the manifest reports the
smaller *actual* count, without cloning models to manufacture diversity.

## Run locally or in GitHub Actions

```bash
python -m projection_loom ooda-run \
  --project examples/necrospire/project.json \
  --capability-recipe examples/necrospire/hybrid/recipe.json \
  --out out/necrospire-compound \
  --control full-speed --passes 3 --candidates 4 \
  --exact-budget 3 --detail-budget 3 \
  --score-size 128 192 --finalists 3
python scripts/check_compound_epoch.py --out out/necrospire-compound
```

The same `ooda-run` command, with the **same** project, recipe, budgets,
viewport and code, resumes after a checkpoint. Inspect
`out/necrospire-compound/previews/`, `session.json`, and
`finalists/contact_sheet.png` for operator steering and visual review. Pass
`--control manual` for the plan/review pauses; send safe-point commands with
`ooda-steer`.

## Readiness and limitations

The engine **supports** generic capability DAGs, compound lineage replay,
phase-anchored recursive inquiries, CAD/mesh rendering, and per-kernel
validation. It does not implement a real SDF/VDB backend, production OpenUSD,
metric camera calibration of the Necrospire painting, or cross-kernel exact
Boolean fusion. The current crystal morphologies still underperform some
CAD-only silhouettes; improved geometry search requires further experiments,
not stronger claims.
