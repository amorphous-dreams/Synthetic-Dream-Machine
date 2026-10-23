<!-- Research archive: Projection_Loom_Refinement_III.zip / Projection_Loom_Research_Refinement/REFINEMENT_III.md. Historical experimental testimony, not an active model or test fixture. -->

# Projection Loom — Research / Refactoring III

## Source provenance
- Boot: `bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem` fetched from live default GitHub branch.
- PR #84: `feature/green-jello-dinosaur-5--projection-loom`, head `ac06bddff7ae26e4b8d2c90468625e9851c5fd90` during review.
- Current branch API meme: `bags/lares/ha.ka.ba/lares/api/projection-loom.mem`.
- Base: previously recovered `Projection_Loom_Research_Refinement` package; this pass applies two explicit evidence/archive changes.

## Changes
1. RGBA source evidence now uses alpha-weighted (premultiplied) RGB resize followed by safe unpremultiplication. Fully transparent random RGB values cannot contaminate gradient maps through interpolation. This preserves the source alpha master as the silhouette witness.
2. DiversityArchive rejects non-finite loss and descriptor coordinates before binning. Out-of-range *finite* coordinates are still clipped, an explicit policy subject to later decision.
3. Regression tests protect both changes. Command: `python -m pytest -q test_evidence.py test_refinement_guards.py` => 9 passed.

## Prior art and next experiments
- OpenCascade Boolean modeling notes: validity is a property of BRep topology and tolerated intersections; fuzzy Boolean is a deliberate repair option and can mask near-degenerate joints when applied indiscriminately. Record tolerance and each repair attempt, never let a fuzzy operation quietly rescue an invalid growth candidate. https://sources.debian.org/src/opencascade/7.9.2+dfsg-5/dox/specification/boolean_operations/boolean_operations.md
- Mouret & Clune, MAP-Elites (2015): archive by interpretable *phenotype* descriptors rather than genotype distance. The current archive is small and should not be described as a full implementation until descriptors are measured on independently valid solid geometry. https://arxiv.org/abs/1504.04909
- A silhouette cannot establish unseen interior geometry; inner edges yield weighted testimony, not CAD facts. This is especially consequential for the fortress/joining/crystal triad.

## Proposed follow-up gates
A. Run the full CAD integration suite from a clean checkout with pinned CadQuery/OCCT versions.
B. Add per-candidate evidence hashes and camera-registration receipts before comparing internal edges.
C. Keep the three soft material regions explicitly labelled *priors*; test uncertainty ablations and multi-view observability.
D. Cache Boolean audit receipts for accepted candidates, then run paired silhouette-only and edge-guided searches with equal budgets.
E. Only then integrate tests and code into PR #84 and rerun CI.

## Scope boundary
This pass does NOT complete new multi-epoch regrowth, validate the entire project, or mutate PR #84. It refines the local evidence/DiversityArchive package and its tests.
