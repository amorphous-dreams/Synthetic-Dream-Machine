# Projection Loom — Necrospire lineage breeding (alpha wave XX–XXIII)

**Source:** The original Necrospire painting alpha mask (`source_alpha_8bit.png`),
referenced by the SHA-256 in the immutable capability recipe. **Authority:**
The one `fractal_ooda_ha.run_ooda_ha_epochs` controller owns Observe → Orient →
Decide → Act → Aftermath. The breeding archive and culling policies do not
create a second helm or promote a rendering into source evidence.

## Ground truth and distinct versioned construction

The original `project.json` and `hybrid/recipe.json` remain available for
reproduction of the old 0.7045 IoU seed. The new `project_breeding.json` and
`hybrid/recipe_breeding.json` are **version-2** constructive experiments: the
same source painting and fixed camera but additional bounded continuous and
discrete CAD loci for shaft bend/roughness/segmentation, terrace width/offset,
keep and crown tapers, and crown/parapet shape. A source or recipe/code change
requires a **fresh output directory**, not replay into an earlier journal.

## Birth, audition, cull and Aftermath

* Six anonymous *search* families are `needle`, `fractured`, `terraces`,
  `crown`, `keep`, `crystal`. They are not Operator pet-names or independent
  structural certificates. Each proposes bounded Sobol, local and topology
  offspring with recorded parent IDs. Compatible donor genes may migrate
  every four generations without deleting the recipient's lineage.
* Emitter reservation rotates when there are fewer exact CAD-audit seats than
  emitters. In breeding mode, **detailed-scoring** seats are likewise
  distributed across families and variation methods. The scheduler may
  *defer* a proposal, not reject its geometry on cheap preview evidence.
* The existing `WideEpoch` audits a fused BRep and its authored voids before
  any candidate is scored. Compounds also pass independent polygon and socket
  gates. Candidate errors are reported as evaluator errors, not bad geometry.
* The source-fixed binary silhouette receives an exact pixel hash and a
  phenotype niche combining area/extent/asymmetry with six quantized horizontal
  silhouette-width bands. This intentionally tolerates one-pixel fringe noise
  but separates different vertical terrace/crown profiles. `lineage_archive.json` retains
  family champions, distinct niche elites, parentage and every generation's
  scored/rejected/audited/deferred/error counts. Numeric genome differences
  alone do not make a new visible phenotype.
* The journal assimilates completed epoch receipts **before** transitioning
  to epoch Aftermath, with an idempotent source-bound archive digest. If a
  process stops between these writes, reentry reconstructs the same offspring
  from the prior generation only and refuses a changed source checkpoint.
* The location gallery regrows the native-audited finalists. The additional
  `lineage_gallery/` renders two visibly distinct audited alternatives per
  family where available; it never asserts fused CAD+polygon certification.

## Three-generation control (already measured)

```sh
python -m projection_loom ooda-ha-run \
  --project examples/necrospire/project_breeding.json \
  --capability-recipe examples/necrospire/hybrid/recipe_breeding.json \
  --out out/necrospire-breeding-pilot-v2 --control full-speed --breeding \
  --passes 3 --offspring-per-family 3 --exact-budget 12 --detail-budget 12 \
  --seed 41 --score-size 128 192 --finalists 3
```

Observed: 54 proposals, 36 exact audits and detailed scores, 18 deferred
(rather than invalidated), 36 source-bound scored entries, six surviving
family champions, 12 distinct masks in the operator gallery, 3 native-audited
finalists. Best silhouette IoU: **0.721470**, against the old **~0.7045**
fixed-view provisional baseline. These observations are *not* survey/engineering
certificates and have not yet demonstrated independent generalization.

## Six-generation pilot — completed, audited pre-regional-niche baseline

The full source-fixed, seed-41, 128×192 experiment **completed with exit code 0**,
its single OODA-HA location and all child loops closed, and
`scripts/check_compound_epoch.py` passed. Results below are from the frozen
run **before** the six-band regional-niche correction, so the archive remains
an honest same-code checkpoint and is not relabeled retroactively.

| Measure | Observed |
|---|---:|
| Births / native CAD auditions | **432 / 216** |
| Scored / exact-audited without detail / deferred | **108 / 108 / 216** |
| Rejected / evaluator errors | **0 / 0** |
| Distinct source-view silhouette SHA-256 masks | **89** |
| Coarse global phenotype niches (old descriptor) | **2** |
| Surviving family champions | **6 of 6** |
| Finalists / family review masks | **3 / 12** |
| OODA-HA candidate / capability child loops | **216 / 1,944** |
| Best silhouette IoU | **0.738410** (`needle-006-004`, generation 6, Sobol) |

The original fixed-view three-epoch seed score was ~0.7045 IoU, so the absolute
same-reference improvement is ~0.0339 IoU. The source image, alpha, camera
and native CAD/void and mesh/socket audit boundaries were unchanged. All six
families earned scored Sobol, local and topology descendants; deferred proposals
were not silently called structural failures. Generated preview or model validity
is not authenticated survey registration, structural engineering certification
or a proved cross-kernel Boolean union.

**Re-entry boundary:** This completed baseline was run with the previous coarse
phenotype descriptor (commit ancestry through RED `e3c6dce`, no source behavior
change from `619c20c`). The next GREEN commit `42e62f2` changes measured
niche semantics. It MUST use a separate output directory, never resume or
relabel the old archive's niche identifiers. On 12 exact distinct previously
rendered family-survivor silhouettes, the six-band profile distinguished **four**
regional niches versus **one** coarse global niche. That is an offline diagnostic
of the descriptor; a new-code campaign needs its own receipts.

## Six-generation pilot — reproducible command

```sh
python -m projection_loom ooda-ha-run \
  --project examples/necrospire/project_breeding.json \
  --capability-recipe examples/necrospire/hybrid/recipe_breeding.json \
  --out out/necrospire-breeding-six-generations-v2 --control full-speed \
  --breeding --passes 6 --offspring-per-family 12 \
  --exact-budget 36 --detail-budget 18 --seed 41 \
  --score-size 128 192 --finalists 3
```

This produced 432 births, 216 native exact audits and 108 detailed scores
under the *pre-regional-correction* code and source-bound recipe. It retains
deferred and failed attempts as separate counts. Compare actual masks under the
same source and fixed viewport. Report absolute IoU, family survival and unique
visible niches independently;
do not collapse them into one generic success label. Never change a previous
checkpoint's experiment parameters to force resumption.

## Re-entry and open questions

Continue at the highest exact-scoped receipt already committed. If all families
remain valid but progress plateaus, investigate construction expressivity,
mutation scale, source-vs-model region residuals, and fairness before buying
more generations. A coarse niche can contain multiple distinct exact masks:
report both counts. Other kernel or source authentication must not be inferred.

`ooda-ha="closed 5↺"` denotes RED→GREEN implementation waves XX–XXIV,
with fresh-code regression verification required at the latest head. The
six-generation *pre-correction* experiment is complete and independently audited.
Experiment Aftermath closes per generation and per gallery; no automated culling
may exercise Operator pet-name or o-takiage authority.
