# Experiment Zero · source-anchored exploration

Experiment Zero is an opt-in policy on the EXISTING OODA-HA helm, not a second controller or a rewritten historic pilot.

## Run (independent fresh output directory)

    cd tools/projection-loom
    python -m projection_loom ooda-ha-run \
      --project examples/necrospire/project_alpha.json \
      --capability-recipe examples/necrospire/hybrid/recipe_alpha.json \
      --out out/experiment-zero-sample \
      --control full-speed --breeding --passes 2 \
      --offspring-per-family 3 --exact-budget 12 --detail-budget 6 \
      --score-size 64 96 --finalists 3 \
      --explore-overscan 2 --explore-depth 2 \
      --explore-max-faces 200000 --explore-max-vertices 150000 \
      --explore-review-seats 6

The reference frame retains its original pixels-per-world-unit scale; the 2x outer frame extends around it. A larger raster by itself does NOT add spatial slack. A separate depth budget, mesh complexity limits, and fixed candidate audit budgets bound CPU cost. Native exact CAD/void validity remains an independent gate. A geometry-envelope rejection is attributed, not counted as a scoring backend failure.

Source silhouette fitness continues using the original fixed camera, unchanged score dimensions and objective policy. Extra-frame occupancy and geometry complexity are separate observations, not an undocumented objective bonus.

After the OODA-HA location completes, experiment_zero_review/review.json holds a bounded survivor shortlist and comparable views from original-seed-frozen orthographic cameras, with immutable lineage references, audits and measurements. A shortlist may keep unusual shapes even if they are not the single best source-fit genome.

## Steering

While a run is active, the existing ooda-ha-steer CLI and opt-in --llm-provider advice can choose among audited candidates at safe phase boundaries. At completion, choose from IDs in the review JSON:

    python -m projection_loom experiment-zero-select \
      --out out/experiment-zero-sample \
      --proposal 0001/needle-001-001 --actor operator \
      --reason "Preserve morphology and native CAD integrity"

An adviser record is explicitly advisory-only; an Operator selection is separately attributed. No new pet-name or promotion follows from an adviser record. Both choices remain bound to exact reviewed receipts.

All reference images remain provisional artwork evidence, other orthographic views are synthetic inspection, and neither implies surveyed truth. Never compare this experiment's scores directly to the frozen six-generation pilot.

## Native six-view gallery

Once a bounded OODA-HA run has completed, `python -m projection_loom review-orthos --project ... --capability-recipe ... --out <run> --gallery <new-empty-folder> --seats 3` re-grows the archived native finalists and verifies all original mask and camera digests before producing shaded/line and silhouette boards. This is read-only presentation, not a new scorer or winner. See [Loom Field Guide](GUIDEBOOK.md) for the image-seed interpretation and architectural expansion hypotheses.
