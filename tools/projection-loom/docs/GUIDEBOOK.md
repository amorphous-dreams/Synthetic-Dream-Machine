# Projection Loom · Experiment Zero Field Guide

This is the **Loom operator guidebook**, not the separately authored
`sdm/Vastlands_Guidebook` (which is source material, not the Loom manual).
Read alongside [HANDOFF](HANDOFF.md), [EXPERIMENT_ZERO](EXPERIMENT_ZERO.md),
and [OBLIQUE_SEED](OBLIQUE_SEED.md). Project canon lives in branch-current
`bags/`; this document describes measured machinery and design possibilities,
not promoted Lares law.

## Fire-facing typed architectural grammar

The current backed-source **AI Fire** remains the Operator interface: memetic-wikitext + the canonical Art Sigil Inscription/Folio. Typed machine bindings and native CAD proofs live below that boundary, not inside the artistic invocation. See [Current Fire grammar](FIRE_GRAMMAR.md) for reference, schema, CLI use and limits. No LLM service was added.

## One pet-named image seed, not two independent photographs

Necrospire's First Glimpse (`@seed/oblique-seed`) binds the original
1024×1536 RGBA artwork and extracted L8 alpha as **one** digest-verified
source entity. The RGB/appearance channel and silhouette channel cannot count
as two independent observations. The oblique source is provisional artwork,
not a registered camera survey.

Current code consumes:
- **Alpha** for fixed-oblique occupancy / IoU and limited source-guided
  polymesh surface deformation.
- **RGB-derived edges**, bounded by the alpha and active `guide` locus,
  as a small, local modulation of that same polygon surface treatment.
- **Operator drawn feature evidence** as separately attributed Crystal,
  Joining and Fortress attention masks via `feature-annotate` when provided.
  These masks are interpretations of the source, not independent imagery.
- **Named-seed receipts**, stable SHA-256 identity and relational witness
  so a downstream capability can declare dependency instead of opening files.

Current code does **not** infer full structural volume, hidden elevations,
precise material, room plans, or a surveyed 3D camera from the image.

## Small two-epoch observed search (held outside the Loom branch)

The Oct 25 fresh test used OODA-HA seed `68421`, two generations,
12 offspring per generation, 12 exact native and 6 detailed scoring seats
per generation, 64×96 source scoring and 2× exploration overscan.
Its experiment branch and [native Actions receipts](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40247399160)
remain outside the Loom working branch. Four candidates reached review;
three were rendered at seed-frozen oblique/front/right/back/left/top cameras.

| Reviewed family | Source alpha IoU | Global loss | Off-core silhouette |
| --- | ---: | ---: | ---: |
| Crystal, generation 2 | 0.709156 | 0.306539 | 0 |
| Keep, generation 2 | 0.695613 | 0.320967 | 0 |
| Fractured, generation 2 | 0.689807 | 0.327021 | 0 |

All three occupied **zero** additional silhouette pixels outside the reference
core. That says only that these scored descendants did not extend into the
outer frame, **not** that novel geometry or inherited architectural grammar
could not use it. The underlying construction still strongly encodes a
crystal/needle, terrace, keep and applied facade.

## Use actual reviewed orthos in a new campaign

After a bounded `ooda-ha-run` has completed and
`experiment_zero_review/review.json` exists, run:

```bash
cd tools/projection-loom
python -m projection_loom review-orthos \
  --project examples/necrospire/project_alpha.json \
  --capability-recipe examples/necrospire/hybrid/recipe_alpha.json \
  --out out/my-new-experiment \
  --gallery out/my-new-gallery --seats 3
```

`review-orthos` accepts **2–5** native reviewed specimens. It verifies
the signed review digest and original saved mask/camera receipts before
re-rendering their native-audited CAD/polymesh with common six-view cameras.
It emits `native_shaded_orthos.png`, `native_silhouette_orthos.png`
and `summary.json` with digest-bound evidence. It rejects reused output
directories. It does **not** generate new lineages or select survivors.

## Freeing early lineages · design bearings, NOT yet implemented

**A. Separate architectural syntax from rendering appearance.** Introduce
bounded morphogenetic grammar alternatives: a needle that *bears* a terrace
versus one that *penetrates*, *suspends*, or *skirts* a stepped fortress;
a tier that *supports* a court versus a bridge with a measured load path.
Reuse native BRep joins, negative-volume audits and socket relations.

**B. Turn RGB information into attributable, reversible cues.** Candidate
operators may infer broad appearance/material zones, edge-direction fields,
occlusion boundaries, illuminated-face hypotheses, and region-specific
confidence. They must record the source crop and cue digest, treat painterly
lighting as ambiguous, and never assume RGB gradient means real topography.
Provide ablations `cue on/off` on the **same genotype**; record native
geometry and all-camera differences rather than inserting a hidden scalar.

**C. Separate source preservation from architectural freedom.** Retain a
bounded fixed-view silhouette core as identity evidence. Distinguish the
needle, stepped ziggurat, brutalist volumes, joining/void and negative space
with operator-bound feature masks before adding independent objectives.
Use frontier and family reservations, not a single global IoU champion;
sample proposals that alter adjacency, number of tiers, structural support
and circulation, not merely offsets or facade-bands.

**D. Evaluate contributions and costs.** For every optional capability,
measure differential native volume, viewport occupancy, silhouette masks,
top/side elevation changes, native audit failure, facet count and time.
A source-derived pier that overlaps the keep but adds no visible form is
an *active gene*, not proof of meaningful morphological expression.

**E. Enforce budget and agency.** The 2× overscan expands world-space
coverage but not unlimited mesh complexity or CPU. Preserve small
low-detail birth screens; promote only native-valid, diverse representatives
to expensive image review. The operator alone approves pet-names, lineages
and architectural value judgments.

### Experiment hypotheses worth testing next

- **Matched-seed 2×2 ablation:** semantic ziggurat/step grammar on/off
  × true CC0 brutalist relational grammar on/off. Same source seed,
  same proposal RNG and native admission quotas. Evaluate both morphology
  diversity and source loss; do not infer causality from unrelated runs.
- **Conditional image cue ablation:** alpha only vs alpha + bounded RGB
  features, with identical genomes, frozen cameras and ablation receipts.
- **Architecture-first family reservation:** keep one candidate each for
  stacked, cantilevered, bridged and suspended primary volume relationships;
  compare their other views, void routing and constructibility.

These are **open design proposals**. No semantic relationship grammar,
automatic occlusion solver, structural load simulation or altered fitness
policy is claimed by this guidebook. The unmodified historical six-generation
pilot and the small two-epoch offspring remain outside live ancestry.
