<!-- Research archive: Projection_Loom_Evidence_Diversity_Refinement.zip / Projection_Loom_Research_Refinement/RESEARCH_HANDOFF.md. Historical experimental testimony, not an active model or test fixture. -->

# Projection Loom — evidence / diversity refinement (research branch, no PR mutation)

## Core correction
Prior `three_area_five_epochs` used y-coordinate cutoffs (fortress 0–21%, joining 21–38%, crystal 38–100%). These were *spatial guesses*, not semantic masks or crystal/fortress/joint annotations. This refinement replaces hard cutoffs with overlapping silhouette-relative weight fields and exposes gradient orientation separately. It does not claim automatic material recognition.

## Research rhymes
* CGA architectural shape grammars: express named constructions and contextual production rules, not only numeric dimensions. Engineering direction: grammar mutations respecting parent support and void routes.
* FI-MAP-Elites interior layout research: preserve feasible and infeasible search insights separately; an architect benefits from seeing alternatives in different layout niches.
* ARCH-Elites: quality-diversity specifically applied to architectural/urban design suggests comparing behavioral/shape descriptors rather than only genotype Euclidean distance.
* OCCT HLR BRep: exact CAD edge extraction should eventually replace projected triangle diagonals for production drawing; retain fast raster approximation for search.

## Added tested module
`projection_loom/evidence.py` provides reference extraction, overlapping spatial-prior regions, horizontal/vertical/diagonal gradients, tolerant line agreement, per-region silhouette diagnostics, and a minimal valid-only diversity archive.

## Guardrails
* The distance-tolerant line metric compares **registered** same-frame images only. A similarity number from uncalibrated cameras is withheld by design.
* Do not confuse an RGBA contrast edge with a physical joint.
* Preserve mandatory BRep union and void graph audit before allowing any genome into the archive.
* Descriptor cells require *phenotypes* (e.g. crown breadth/shaft width, silhouette asymmetry), never simply normalized genome parameters.
* Existing tests pass for these helpers, not yet an end-to-end new evolutionary acceptance policy.

## Next controlled experiment
1. Calibrate source oblique projection against model camera with stored transforms and coordinate frame.
2. Partition region priors further with human-confirmed exemplar strokes or segmentation, checking fortress/join/crystal ambiguity.
3. Compare raw silhouette-only against per-region silhouette and line penalties on the **same cached valid candidates**, reporting per-area precision/recall and independent human selection.
4. Add phenotype descriptors and MAP-Elites archive, then test with full Boolean/void gate and budgeted stage-wise screening.
5. Add true opposite-side camera tests, upper fortress cutout panels, and source-derived cutaway diagrams, preserving a single authoritative CAD state.

### Research links
* https://arxiv.org/abs/2104.08774 — ARCH-Elites
* https://github.com/konsfik/FI-MAP-Elites — floorplan constraints/feasible-infeasible MAP-Elites
* https://github.com/Open-Cascade-SAS/OCCT/blob/master/dox/user_guides/modeling_algos/modeling_algos.md — OCCT BRep HLR
* https://doi.org/10.1145/1179352.1141931 — CGA procedural architecture
