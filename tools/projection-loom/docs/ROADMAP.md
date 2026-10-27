# Projection Loom · AI Fire / Art Sigils Roadmap

**Historical evidence checkpoint:** `46721eca` (not a globally current release state). **Working branch:** `feature/green-jello-dinosaur-5--projection-loom`, PR [#84](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/pull/84).
**Base / Lares boot ref:** `feature/green-jello-dinosaur-5`.
**Source of truth:** real Git ancestry, source-bound native witnesses and CI jobs. This document marks provisional completion and blockers, not house law or Operator promotion. Refresh run status on re-entry.

## Operator hard reference · Athenaion and input-agnostic Loom backlog (2026-10-27)

The Operator designated [Athenaion](https://github.com/Leonxlnx/athenaion)
a **hard external research reference**, pinned to upstream commit
[9b8bd23b39c458a50fb1201037360047781c45b5](https://github.com/Leonxlnx/athenaion/tree/9b8bd23b39c458a50fb1201037360047781c45b5)
(MIT, copyright 2026 Leon Lin). Read
[the source-investigated comparison](research/athenaion-hard-reference.md)
and the branch-local meme
`lar:///ha.ka.ba/lares/api/projection-loom-athenaion`
before changing generalization, location composition or render review.
Hard reference means required comparison and attributed design influence;
not vendor adoption, Elyncia canon, CAD proof or a dependency pin for CI.

**Decision:** Generalize the Loom, not Experiment Zero. Three independent
Experiment Zero inputs—**image-group**, **brutalist grammar**, and
**ziggurat-proxy**—must each function alone, then in pairs and together
without any special case inside the one OODA-HA controller. No backwards
compatibility requirement in early alpha. All rows below carry
**PROPOSED / NOT YET IMPLEMENTED** status until tested at an exact commit.

| ID | Wave | Work, grounded dependency | Done when / independent witness |
| --- | --- | --- | --- |
| L-01 | A / contract | Define immutable `SeedBundle`, `SeedEntry`, `IntentContract`, `GrowthContext`; source/capability claims retain original authority | Same intent and equivalent seed order normalize to the same semantic contract; changed source/intent changes the digest | **Wave A implemented at pending SHA; tests require exact-head CI.** 
| L-02 | A / identity | Content-addressed source, grammar and proxy assets; hermetic run fingerprint and idempotent entry | Repeated admission/replay cannot duplicate authoritative source, location, pet-name or completed receipts | **Wave A implemented at pending SHA; tests require exact-head CI.** 
| L-03 | A / place | Make `LocationStack` the normalized location substrate with frame graph, proposed sites, registrations and dependencies | No Necrospire labels required; independent frames/conflicts remain explicit | **Wave A implemented at pending SHA; tests require exact-head CI.** 
| L-04 | A / isolation | Separate machinery packages from `experiments/zero/` subjects and code; keep the same OODA-HA helm | Generic engine imports no Experiment Zero builder, seed bytes, fixed-family names or source-size constants | **Wave A contract boundary implemented; existing legacy pipelines retained pending integration migration.** 
| L-05 | B / image-group | Multi-image seed adapter with independently sourced images, grouped RGB/alpha channels, landmarks, camera observations and measured/provisional registration | Distinct images produce independent source identities; channels of one artwork do not; bad pose claims fail visibly | **Wave B implemented (pending exact-head CI).** 
| L-06 | B / brutalist | Reusable grammar adapter for pinned nosycat-derived modular construction, license and producer/consumer operator contracts | Grammar alone produces native-admitted structures without any reference image or Necrospire builder | **Wave B implemented (pending exact-head CI).** 
| L-07 | B / ziggurat | Explicit authored proxy adapter with stepped tiers, cores, courtyards, voids and semantic sockets | Proxy alone develops further geometry with proposal authority; fiction never becomes inferred dimensions | **Wave B implemented (pending exact-head CI).** 
| L-08 | B / composition | Compose inputs alone, in all three pairs and as a triple; bind relationships without overwriting per-input authority | Seven explicit seed matrix cases plus source/conflicting-frame refusals have retained receipts | **Wave B implemented (pending exact-head CI).** 
| L-09 | C / growth | Bounded typed developmental program supporting spawn, split, attach, bridge, subtract and repeat | Variable-length structures appear; descendants inherit rule trees, not only fixed scalar offsets | **Wave C implemented pending CI.**
| L-10 | C / sites | Semantic site producers and consumers: supporting ledges, sockets, attachment affordances, terrain/structure occupation zones | One grown terrace creates usable sites for another generator; collision/footprint/clearance witnesses stay distinct | **Wave C implemented pending CI.**
| L-11 | C / ancestry | Structure-aware mutation/crossover and source-bound grammar lineages | Reparent/duplicate/add/delete rule subtrees survive regrowth with independent program ancestry | **Wave C implemented pending CI.**
| L-12 | C / native | Multi-body constructive compilation, native BRep contact and void gates, spatial routes | Every body validates its own native truth; separate terrain/water/surfaces never claim a scene-wide fused solid | **Wave C native body gate exercised; cross-seed developmental compiler handoff pending E.**
| L-13 | D / objectives | Intent-conditioned metrics: only warranted image evidence receives IoU; add boundaries and region-specific error; grammar/proxy use their own measures | Image-free cohort has no fabricated image fitness; camera/landmark uncertainties remain surfaced | **Wave D code implemented pending CI; complete hosted campaign still requires Wave E.**
| L-14 | D / fairness | Structural novelty and quality-diversity niches, with reserved exact auditions per active grammar/operator | Newly born construction rules receive measurable exact/native trial opportunities rather than solely source-fit rankings | **Wave D code implemented pending CI; complete hosted campaign still requires Wave E.**
| L-15 | D / replay | Independent keyed RNG substreams per source+rule+genome+epoch; deterministic mutation, module execution and resume | Worker order, scheduling and replay leave logical descendants/receipts invariant; future forks remain explicit | **Wave D code implemented pending CI; complete hosted campaign still requires Wave E.**
| L-16 | D / cameras | Seed/frame-frozen multi-camera contact sheets; independent source-view scores; visual inspection budgets | Presentation-only shot dressing cannot change native geometry or lineage; synthetic views never pose as source images | **Wave D code implemented pending CI; complete hosted campaign still requires Wave E.**
| L-17 | E / preregister | Seven seed matrix cohorts with matched budgets: I, B, Z, IB, IZ, BZ, IBZ | Source/intent hashes, constrained objectives, null cases and decision boundaries registered before any epoch | **Wave E implemented; exact-head seven-cohort CI pending.**
| L-18 | E / crucible | Standalone capability audits + full-location integration; metamorphic perturbations and equal-budget controls | All matrix cases run the same helm/gates; source-relative wins and architectural novelty separately measured | **Wave E implemented; exact-head seven-cohort CI pending.**
| L-19 | E / review | Operator-facing galleries: source-group comparisons, six/extra orthos, sockets, routes, failures and constructive ancestry | Reviewer sees which seed/rule produced each body; no pet-name or aesthetic winner auto-promoted | **Wave E implemented; exact-head seven-cohort CI pending.**
| L-20 | E / aftermath | Remove obsolete fixed-genome/fixture couplings, update guidebook, handoff, research/memes and CI after verified replacement | No shadow controller, no old compatibility scaffold, no misleading repo-head status; archived failures remain attributable | **Wave E subject-neutral engine and experiment isolation implemented; legacy fixed-genome scrubbing still requires evidence.**

**Athenaion-derived non-negotiable test cases:**

1. `src/world/layout.js` suggests one shared place authority: when a
   foundation moves, its dependent stair, terrace, support and decoration must
   follow through typed relations rather than duplicate literal coordinates.
2. `src/core/engine.js`, `src/arch/build.js` and
   `src/core/footprints.js` demonstrate slot producers and footprint
   consumers: adapt *typed spatial affordances*, not untyped mutable dictionaries.
   Visual footprint exclusion MUST NOT count as native CAD overlap or walkability.
3. `docs/COMPOSITION.md` provides camera/landmark reasoning across nine
   references: treat every source image and pose claim independently, retain
   contradictions, and preserve one world geometry through every construction
   evidence camera.
4. `docs/CONTRACT.md` and `tools/render.mjs` pair isolated
   module audition with all-scene render, shared budgets and comparison sheets:
   test both local and complete compositions before declaring a feature done.
5. Athenaion's `engine.onShot` demonstrates a useful visual technique
   but a danger to native provenance. Per-shot decorative visibility may vary;
   any constructive change MUST fork an explicitly identified candidate and
   rerun its BRep/void/source truth gates.
6. Its labeled RNG and serialized GPU render harness motivate deterministic
   per-rule RNG substreams and a bounded render queue, while the existing
   OODA-HA controller remains the sole lineage and choice authority.

**Critical path:** L-01..04 → L-05..08 → L-09..12 → L-13..16 → L-17..20.
Iterate locally within each wave, record native refusals as evidence rather
than software regressions, and commit/push at the operator-approved work
boundary. The reference alone changes no candidate or architectural canon.


### Wave A checkpoint · 2026-10-27

Implemented `intent_seed.py`: immutable source/intent/context, independent content digests, canonical source sorting, run fingerprints, independent keyed RNG, file-byte preflight and a bridge to existing `LocationStack`. Original RGB+alpha channels group under one source entity. Added regression tests and a dedicated generalized-machina workflow. **Not yet full engine decoupling**: existing alpha builders remain until Wave C completes; do not mark L-04 fully delivered before the helm runs independent seeds. CI status must be checked at this wave's exact SHA.

### Wave B checkpoint · 2026-10-27

Added independent image-group, constructive-grammar and ziggurat-proxy adapters plus seven-case native CAD composition tests. Image alpha remains a channel, not another view. Structural source inputs retain proposal authority; image-only baselines explicitly label the scaffold provisional. Currently support local source paths and one normalized location inventory; multi-view pose optimization and heritable developmental programs belong to later waves. Full native audit verdict waits for CI at the Wave B SHA.

### Wave C checkpoint · 2026-10-27

Added typed finite `GrowthProgram` with variable-length foundation/spawn/split/bridge/carve operations, semantic coordinate sites and exact native per-body admission. Deterministic mutation and subtree-grafting crossover preserve inherited program digests. The compiler never uses BRep face indices as stable site identity. It retains native validity gates and explicit material/void status. Dedicated tests exercise original, splintering and independently inherited forms. Integration of these genomes into seed matrix reproduction remains tracked for Waves D/E. Check exact-head CI and do not claim it passed before it concludes.

### Wave D checkpoint · 2026-10-27

Added image-authorized, precision-sensitive IoU/Tversky and contour terms, six seed-frozen inspection cameras with synthetic-only non-source views, bounded behavioral quality-diversity archive and fair coverage by structural emitter. Existing keyed `GrowthContext` RNG secures worker-order reproducibility. The image-only full-resolution scorer refuses source mask resize at final evaluation. These primitives require a single-helm execution and seven-cohort exact-head receipts before declaring a full experiment (Wave E).

### Wave E checkpoint · 2026-10-27

The generic developmental seven-seed crucible now enters the **existing** OODAHAJournal. Each cohort preregisters its seed digests/intent/budgets; all candidate Acts construct native BRep, and every failure and observation is persisted. A quality-diversity archive preserves structural niches across epochs. Finalists score against the original native-resolution image where one exists, while image-free runs carry no invented IoU. The same frozen synthetic six views inspect each candidate; no automatic architectural/canonical promotion occurs.

The dedicated generalized CI workflow now runs all seven cohorts for three epochs and retains artifacts. Candidate programs live under generic machinery, with inputs in `experiments/zero/`. The fixed legacy alpha runner remains for historical witnesses; no backward compatibility requirement compels preserving it indefinitely. Verify exact-head CI and native campaign receipts before asserting L-17..L-20 completely accomplished.

## Source-head closing checkpoint · historical records preserved

On source-head `8a073aac` (three-parent historical integration), dedicated CAD [#40429724371](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40429724371), evergreen [#40429719118](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40429719118), and alpha coevolution [#40429719057](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40429719057) passed. Repo-wide [#40429719100](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40429719100) and held-out [#40429719007](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40429719007) were queued; parallel CAD [#40429719027](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40429719027) was running at inspection. Re-query these before deciding whether the full head passed. `_activation_switches(recipe)` now shields CAD-only OODA-HA while preserving Architectural Birth activation funnels. Both historical experimental merge parents remain attributable but inert; no pet-name or lineage promotion follows from ancestry alone. For a concise new-session re-entry, read [BRANCHED_SESSION_HANDOFF](BRANCHED_SESSION_HANDOFF.md).

## Historical experiments consolidated by ancestry

Two divergent research branches join the Loom's Git ancestry through
an explicit multi-parent merge:

- `experiment/necrospire-rerun-20261024-035fb47f` at
  `c0ba2a96113cac56e5dcd14fb7bf878eb2eee9cd`:
  its obsolete rerun/snapshot Actions are inert archive references.
- `feature/necrospire-two-epoch-orthos-20261025` at
  `a5b4e385be701cb657f90047dba4a112a71f8539`:
  source-bound native orthographic images, the render script and
  manifests remain attributable under `examples/necrospire/lineages/`.
  The old self-pushing workflow is archived, not active.

Other inspected Loom-related branches are strict ancestors of the
working branch. **Merging a record is not promoting a candidate**:
no historical experiment was added to the active OODA-HA archive,
no source identity was revised and no pet-name was granted. Confirm
same-head CI after this integration before asserting verification.

## OODA-HA recovery · recipe-free CAD and heritable architecture

Working ancestor `9a3c90a9` includes Architectural Birth feature
`c5c7a146` and native-refusal follow-up `46721eca`. The dedicated
[Architectural Birth workflow #40309995290](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40309995290)
passed its source-held, two-epoch cohort at `46721eca`.
Repository-wide CI and held-out witnesses passed on `9a3c90a9`, but
dedicated [CAD/evidence CI #40310741241](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40310741241)
recorded 14 OODA-HA regressions (371 passing) because the candidate
loop dereferenced `recipe.steps` during CAD-only runs.

**Repair:** `_activation_switches(recipe)` returns no activations for
the recipe-free CAD helm, and source-typed capability switches plus
`arch.birth.enable` when a compound recipe exists. One result feeds
surrogate preview, activation funnels, archive census, and aftermath.
This restores the original single-helm contract without changing
birth selection, original seeds, or any held lineage. The CAD-only
regression suite must pass at the new exact commit before certification.

**Next OODA-HA:** ✶ inspect the exact-head workflow verdicts; ⏿ sort
CAD rejects, renderer errors and artistic proposals; ◇ prerecord a
small matched-seed control-vs-graft study; ▶ run source-held, native
auditions with six-view/route handbacks; ↺ record viable diversity,
source fit, costs and rejections without automatic pet-name promotion.
Multi-image experiments and primary massing replacement remain future
research.

## Current bearing · architecture, location and evidence

**Projection Loom** is the Operator-pet-named architecture/location capability
within the proposed **Looms of Hephaestus** family. The family name describes a
design bearing, not a newly promoted canonical hierarchy. This file is an
evergreen working map: follow branch SHA and workflow receipts, never a global
"now", release number, or a previous assistant's status.

### Last verified baseline and live blockers

- **Fully green ancestor:** `ef4f27da` passed dedicated Fire
  [#40276648968](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40276648968),
  CAD, alpha coevolution, Experiment Zero, evergreen, native pre-campaign,
  six-view gallery, repo-wide CI and held-out witnesses. The actual
  source-bound two-probe Fire study produced **4 native-admitted bearing
  alternatives, 2 relation-topology witnesses, and 4 distinct six-view
  silhouettes**. These are bounded parameter probes, **not** four OODA-HA
  generations, four distinct BRep shapes, or Operator-promoted lineages.
- **Earlier code checkpoint:** `3dc3236d` contains the Hephaestian
  Passage-and-Place observer and the ascending/descending OODA-HA integrity
  repairs. The dedicated Fire [#40280351768](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40280351768)
  and CAD [#40280351807](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40280351807)
  workflows **failed** on the same stale test expectation:
  `test_reject_unadmitted_and_excessive_sample_budget` requires the older
  word `resolution`, whereas the valid new cohort-wide preflight reports
  `Place sampling exceeds total native query budget`. Fire: 33 passed,
  1 failed; CAD: 376 passed, 1 failed. A separate CAD rerun
  [#40280360222](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40280360222)
  also failed. The failing expectation must be reconciled and re-tested; a
  documentation edit does not repair CI.
- The latest workflow receipt must be inspected again before declaring the
  current head green. The gallery, evergreen, native pre-campaign and alpha
  coevolution checks have passed at `3dc3236d`; repository-wide and
  remaining held-out outcomes were not yet final at this writing.

### What the machinery can actually do

1. **Interpret proposals, then deterministically audit.** The living
   Operator↔AI Fire authors bounded typed relations; `fire_contract.py`
   verifies named source selectors and proposal authority. The grammar
   implements `bears/bearing-column`, `bridges/bridge-between`,
   `encircles/ring-around`, `skirts/skirting-court`, and
   `studies/study-only`. Admission is independent per candidate and requires
   native BRep/void validity; the earlier *real Necrospire bridge* remains a
   recorded rejection.
2. **Return independently attributable witnesses.** Fire handback renders
   six fixed native-carved orthographic views, paired silhouette deltas and
   signed receipts. `fire-cohort` compares source/seed/camera-preserved
   alternatives and distinguishes topology identity, added-volume diversity
   and visual signatures without declaring a winner.
3. **Observe a place, not certify inhabitation.** `place-review` reports
   exact carved-material additions/removals, sampled XY sections at bounded
   elevations and declared void-to-exterior graph hops. Shapely/GEOS
   cell-center samples and eroded void interiors are **not** certified
   walking clearance; native contact is **not** structural load safety.
   The cohort-wide native query budget is a hard resource guard.
4. **Keep research backends optional.** TopologicPy graph inspection and
   pyribs archive illumination are opt-in, read-only studies; NetworkX,
   CadQuery, Shapely and the existing OODA-HA helm retain their distinct
   roles. Hypothesis exercises targeted test invariants; direct CI inputs
   are exactly pinned without assigning application release versions.

### Next work, in dependency order

**P0 · Restore same-head evidence.** Correct the outdated test's expected
rejection message (or explicitly justify a changed error precedence); retain
both total-query and individual-section bounds. Run dedicated Fire and CAD
suites and then inspect repo-wide plus held-out results against the same SHA.

**P1 · Architectural Birth (opt-in graft implemented; campaign evidence pending).**
A separate birth recipe adds inheritable `bears / bridges / skirts` graft loci
beneath the unchanged OODA-HA helm, with a source-derived paired recipe and
read-only geometry observation. Run exact native admission, paired sections and
six-view comparisons. **This does not replace the needle–terrace–keep skeleton**;
a more radical primary-massing grammar remains separate research.

**P2 · Free-play comparison.** Run matched-seed cohorts with reserved
exploratory seats, independent proposal streams, exact-CAD quotas, cost and
failure receipts. Compare source fidelity, distinct topology, exact material
variation, off-oblique silhouettes and route graphs without a single hidden
winner. Retain artistic disagreement for the Operator.

**Research holds:** actual multi-image camera registration; full 3D
circulation or load certification; general IFC/OpenUSD interop; learned
image-to-geometry reconstruction; TopologicPy/pyribs production adoption.
The one RGBA/L8 Oblique Seed remains **one** pet-named source, not two views.



## Completed and source-verified

| Workstream | State | Concrete evidence / limit |
| --- | --- | --- |
| Art Sigils integration | **Integrated** | Canonical eight-dimension `~art`, Inscription/Folio, technical-art fieldcraft, optional conversational `~loom-relation`; Git two-parent ancestry preserved in PR #84 |
| Standalone branch retirement | **Completed** | PR #82 closed; former `feature/green-jello-dinosaur-5--art-sigil-house-grammar` ref no longer appears in branch listing; guarded retirement [Actions #40261722529](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40261722529) succeeded |
| Operator ↔ current AI Fire | **Implemented** | The current source-backed AI Fire writes a *proposed* typed binding from natural language / memetic-wikitext; no second AI server, code-executing sigil parser or separate OODA-HA controller |
| Deterministic contract | **Implemented, tested** | `schemas/fire_proposal.schema.json` Draft 2020-12, `fire_contract.py` entity resolution, graph and bounded alternative validation; fail-closed unknown/ambiguous selectors |
| Native relational operations | **Implemented, bounded** | `fire_geometry.py` stages `bridge-between`, `ring-around`, `bearing-column`, `skirting-court`; `study-only` keeps open interpretations nonexecuting. Real Necrospire bridge rejection retained |
| Evidence handback | **Implemented** | `fire_review.py` renders paired six-view carved-native material, `fire_cohort.py` verifies same-seed/camera receipts, `place_witness.py` measures sampled sections and declared void connectivity. No engineering or occupancy certification |
| Dedicated Fire witness | **Passed** | [Actions #40261722482](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40261722482): 16 focused tests + real source context/native audition. Source-bound bridge attempt was **rejected by native validation**, while a study alternative stayed open; controlled fixture tests admitted valid bridge and bearing relations |
| Experiment Zero controls | **Previously verified** | Finite 2x overscan, original source-view score, depth/mesh budgets, seed-frozen orthos, stable pet-named RGBA/L8 Oblique Seed, prior independently archived campaign evidence. [Actions #40261722425](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40261722425) passed |
| Source history | **Preserved** | Frozen six-generation pilot and later small two-epoch preview are never silently imported, rewritten, or promoted |

## KAIROS repairs verified on code head `0b411b22`

**All eight dedicated Loom-specific jobs passed** against commit
`0b411b22deb0e44a13fe91a911b1ffc151c49173`, including two CAD/evidence
runs, Fire grammar, Experiment Zero, native six-view gallery, evergreen grammar,
alpha coevolution, and native pre-campaign evidence. Recovery commit
[`927832b4`](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/commit/927832b474d31d517ea90a83419d9090cd41d1a7)
is therefore **verified by the same-head runners**, not merely staged.

| Earlier failure on `7bf23db4` | Recovery disposition | Current-head witness |
| --- | --- | --- |
| Shadowing local `PetNameLedger` in CLI | Fixed; existing pet-name commands retain module-level import | [CAD/evidence #40263195410](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40263195410) **passed** |
| Obsolete assertion requiring old source-hash map | Fixed test without removing the one RGBA/L8 seed's three additional digests | [Evergreen grammar #40263195398](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40263195398) **passed** |
| Camera digest `0` versus `0.0` after typed rendering | Verify archived raw camera SHA first, then compare normalized typed semantics; never bypass archival hash | [Gallery #40263195368](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40263195368) **passed** |

Other **passed** dedicated witnesses on `0b411b22`:
[Fire #40263195584](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40263195584),
[Experiment Zero #40263195505](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40263195505),
[alpha coevolution #40263195583](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40263195583),
[native pre-campaign #40263195366](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40263195366),
[second CAD/evidence #40263199650](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40263199650).
The full [repository CI #40263195741](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40263195741)
was **in progress**, and
[held-out witnesses #40263195361](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40263195361)
were **queued** at the 2026-10-26 UTC recovery inspection. Their verdicts
must be re-read before claiming repository-wide green. This document-only
successor commit also requires its own final PR-head inspection.

Prior failed runs remain genuine historical receipts, not current failures:
[CAD #40261725075](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40261725075),
[evergreen #40261722443](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40261722443),
[gallery #40261722396](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40261722396).

## Not implemented / not yet demonstrated

- **Source-bound native Fire:** bearing growth and six-view handback passed same-head CI. The earlier real Necrospire bridge remains rejected. New families and heritable primary massing changes require separate proof.
- **Architectural semantic generality:** four constructive Fire relation operators are implemented, not a general shape-grammar engine or a heritable alternate primary massing. Additional verbs must be bounded and native-audited.
- **Rich RGBA attractor freedom:** currently the one named artwork's alpha drives fixed-view silhouette and RGB edges modestly modulate the source-guided polymesh. Image-region interpretation, occlusion hypotheses, semantic roles and uncertainty-bearing alternatives are research and future mechanisms, not completed capabilities.
- **Structural truth:** native BRep contact/union is not mechanical stress, engineering stability, real building circulation, or accurate reconstruction of the reverse side of a painting.
- **Operator promotion:** no Fire audition or automated score may silently name, promote or approve a generated lineage.
- **Comprehensive comparable search:** the source-bound bearing probe is verified, but a matched-seed, genuinely heritable comparison across `bears / bridges / skirts` with exact CAD, route continuity, cost budgets, novelty and source fidelity remains to run.
- **Interop adapters:** SHACL, IFC/OpenUSD and full RFC 8785 canonical JSON are not installed graph backends or encoding guarantees.

## Golden principles from primary standards and prior art

1. **Typed contract precedes execution.** JSON Schema [Draft 2020-12](https://json-schema.org/specification) validates the serialized Fire proposal; contract validity does not grant Operator authority or CAD validity.
2. **Provenance ≠ physical relation.** [W3C PROV-O](https://www.w3.org/TR/prov-o/) distinguishes entities, activities, agents, usage, derivation and responsibility; no `prov:used` assertion can certify a load-bearing `supports` relationship.
3. **Graph validation is its own layer.** [W3C SHACL](https://www.w3.org/TR/shacl/) checks RDF data against shapes without changing the input graphs. It is a possible future adapter; source JSON Schema + native witnesses remain present authority.
4. **Keep alternatives non-destructive.** [OpenUSD](https://openusd.org/dev/glossary.html) composition has layers, references, variants and explicit strength ordering (now described as **LIVERPS**, including Relocates). Borrow compositional discipline, not the claim of implemented OpenUSD semantics.
5. **Canonicalization claims must be exact.** [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html) is a portability reference; the Loom currently uses its own canonical JSON SHA-256. Do not claim bit-for-bit JCS conformance without tests.
6. **Shape-grammar verbs require measurable expression.** A proposed `encircles` relation needs staged candidate alternatives and geometry/evidence witnesses; visual resemblance, prose and native contact alone do not certify the same property.

## Next OODA-HA pass

**✶ Observe:** inspect the actual current PR head, including the Fire and
CAD stale-message failures and all unfinished same-head Actions.
**⏿ Orient:** distinguish an invalid test expectation from a missing resource
guard; do not raise budgets simply to satisfy a test.
**◇ Decide:** retain both individual-section and full-cohort native query
limits, documenting intentional preflight order.
**▶ Act:** correct the focused expectation/test only after verifying which
rejection behavior the code guarantees; run targeted checks and commit a
complete correction.
**↺ Hoʻoko/Aftermath:** compare exact SHA receipts, preserve remaining
rejections, and then begin the next bounded heritable architectural study.

The single Operator↔AI Fire remains the proposal-authoring surface. Native
CAD judges geometry; observational witnesses describe outcomes. The
Operator alone owns pet-name, artistic promotion and disposition.


## Historical wave · source-bound Fire expression implemented and later verified

- One current Operator-facing Fire; no additional model, web2 endpoint, sigil executor or OODA-HA controller.
- A deterministic research fixture binds the actual `lower terrace` and `central keep` selectors from source context and proposes two independently staged native bearing relations plus a `study-only` question. Its proposal does not grant a pet-name, artistic approval, or an inferred hidden elevation.
- The native Fire handback now renders an unchanged source baseline and admitted variants under common seed-frozen cameras. Its paired differential board and SHA-bound per-view counts record appeared/disappeared/shared silhouettes, not physical load or creative merit.
- Focused tests cover mask arithmetic and actual one-seed CAD admission. Fire CI now executes the full source context → proposed alternatives → native audition → six-view handback path and publishes receipts.
- Repository-wide evergreen witness repair rewrites one historical comment into present-tense operational language rather than raising the one-way ceiling.
- **Historical outcome:** source-bound bearing/orthographic studies later passed at `ef4f27da`, including the 4-admission two-probe cohort. This does not certify the newer place-review additions on `3dc3236d`. Historical lineages remain frozen.

## Source-stable Fire free-play probe (subsequently published and verified)

Previous pushed head 06f9c3f2 had Fire/CAD CI failures caused by an ambiguous central-keep selector. The source builder now adds explicit unique lower-terrace and central-keep slots; selector validation remains fail-closed. The native bearing admits bounded setback 0..0.20. Two non-promoting research probes author distinct proposals against one source seed and feed normal Fire audition/review; each creates independent signed six-view evidence if native-admitted.

A separate local CadQuery diagnostic recreated seven source solids and three void solids, then tested 14 bearing parameter placements across two parameter sweeps: 14 passed its BRep union/contact/carving checks, added volume 0.1977..5.9913 cubic model units. This was a BRep-only diagnostic, not a Loom epoch campaign. Subsequent source-bound native auditions and orthographic reviews passed at `ef4f27da` under independent CI.

That historical push hold was resolved by ancestry-preserving commits; the work sits on PR #84. Historical lineages remain unchanged.


## Native-carved Fire cohort witness · implemented evidence

The first Fire six-view comparison rendered individual component meshes even though the actual produced source is the joined, void-carved BRep. Fire review now renders both source and each admitted alternative via `tessellate(union=True)`, so all six views derive from the native-authoritative carved material rather than uncarved independent parts. The source-frozen camera contract remains unchanged. Fire cohort now verifies 2–16 paired native audition/orthographic handbacks (including each document, per-alternative digest, image bytes, camera baseline, seed/recipe/genome/implementation identity, and silhouette arithmetic), then records source-relative and off-oblique expression, duplicate geometry, and duplicate six-view silhouettes without ranking, breeding or promoting anything. The CLI `fire-cohort` writes an immutable checksum-bound census; the two-probe CI uses it rather than an unverified ad-hoc summary. Negative tests refuse mutated geometry receipts, source drift, camera drift, image changes and inconsistent pixel counts. The two-probe real-source bearing evaluation passed at `ef4f27da`; the newer place observer still requires its own green head. Previous proxy results are not native Loom generations.


### Native cohort truth-scopes clarified

A relational witness names topology/semantic slot identity, not exact BRep shape. The cohort therefore reports `unique_topology_witnesses` and `topology_duplicate_of`, alongside distinct measured added-volume values and independent six-view silhouette fingerprints. Do not interpret relation-witness uniqueness as geometric shape uniqueness, nor a distinct volume as a complete geometric fingerprint.

## Hephaestian place and passage witness · implemented; CI reconciliation open

**Projection Loom** remains the Operator's pet-name, understood as an
architectural/location Loom among the possible **Looms of Hephaestus**.
This interpretation does not rename an existing entity or promote a new canon.

Shapely is a direct dependency for sampled plan analysis. The read-only
`place-review` CLI reconstructs native-audited Fire alternatives from
their source genome and signed receipt, checks their native union and
semantic witnesses, then reports exact native-material differences,
declared room/doorway graph routes, and Shapely XY material/void
sections at bounded elevations. The rasterized sections are *cell-center
samples*: their approximate clearance-core areas do not certify
walkability, load, hidden source architecture, or continuous route width.
Circulation hops derive from audited VoidAssembly overlaps; NetworkX
does not substitute for CAD.

The Fire grammar adds a bounded `skirts/skirting-court` U-shaped
open-front relation. Only separately native-admitted alternatives enter
review. No pet-name, Art Sigil executor, second service, or second
OODA-HA scheduler follows from that relation.

Hypothesis supplies targeted bounded invariants. TopologicPy is an
explicit `topology-study` optional dependency, with an isolated
read-only TGraph void-link comparison pilot. Pyribs is an explicit
`quality-study` optional dependency used solely to inspect already
admitted candidates; its scheduler and emitters are not installed in
the active generation flow. build123d, COMPAS, IfcOpenShell and
Ladybug Tools remain under research-only hold rather than redundant
execution authorities. Future architectural inheritance and multi-image
reference experiments require their own attributed evidence.

Python distribution metadata retains the packaging-required numeric
field as an inert `0`; no application release ladder is implied.
Pinned third-party CI constraints serve reproducible dependency
resolution, not a Loom project version ontology.

Sources: Shapely/GEOS docs, Hypothesis docs, TopologicPy TGraph docs,
pyribs GridArchive API, Stiny/Gips shape grammar, Hillier/Hanson
spatial syntax and Alexander's generative systems. The read-only
TopologicPy pilot may require its own backend; it is never a hard
dependency of core source-bound CI.



## OODA-HA ascending/descending sweep · native place integrity

Same-head CAD CI on `fec6dc5d` exposed one environment-contract failure:
the Hypothesis CI constraint was a lower bound, violating the explicit
direct-input pin checker; the 372 other focused regression tests passed.
The next code pass pins Hypothesis exactly for reproducible CI, and keeps
TopologicPy/pyribs outside base CI by naming their isolated study extras in
the direct-input checker. A source-candidate review now checks the source
genome digest and each reconstituted alternative's part count and native
audit; operator-specified section elevations reach the CLI. Native query
budgets span the entire cohort and all voids instead of each section alone.
Material erosion evidence no longer calls itself human clearance. Exact CAD
difference volumes retain kernel floats, not display-rounded numbers.
At `3dc3236d` the focused failure is now the outdated test expectation for the new total-query guard, not the earlier Hypothesis pin; full same-head proof remains red until fixed.


### Descending aftermath: source authority, sampling and output integrity

Fire review and place review now independently recompile native Fire steps
from the original typed proposal before staging source-bound alternatives,
detecting changed rule parameters even when an external receipt is re-sealed.
They recheck source/genome digests, native topology part counts and measured
union-volume differences. Place evidence uses a cohort-wide bound on total
native point queries, checks that elevations are explicitly increasing, and
saves only atomic result receipts. The optional QD pilot computes its study
before either output is written. No downstream observer becomes an approval
or generation controller. Exact same-head CI remains the verification gate.


## Architectural Birth · heritable relational grafts (opt-in)

The original `project_alpha.json` and `recipe_alpha.json` remain
unchanged one-seed controls. `examples/necrospire/birth_fixture.py`
authors a separate source-bound `project_birth.json` +
`hybrid/recipe_birth.json` in their original source directories,
preserving all RGB/alpha source SHA identities and original camera settings.
Generation of the two files refuses any overwrite.

The opt-in `arch.birth.*` loci carry a bounded on/off choice,
one of three inherited relation cells (`bears`, `bridges`, `skirts`),
and native dimensions. Those loci belong to the existing `terraces`
breeding family, with inherited source bounds and original OODA-HA
family scheduling. The growth builder compiles them through the existing
native Fire operations and staged CAD construction rather than writing
new geometry rules or a second optimizer. Invalid arrangements remain
native-rejected and recorded; a relation label is not an admission.

The existing scored phenotype hook independently observes part-envelope
extensions from the **built geometry**. The generation ancestry records
the inherited proposal separately. Emergent geometry observations have
limited AABB meaning, do not certify circulation or safety, and cannot
promote pet-names or replace the Operator.

The first two-epoch source-held OODA-HA birth campaign has completed
under same-head CI; see the measured census below. It does not prove
that all three relation cells produce successful native architecture. Compare exact CAD acceptance, phenotype
diversity, fixed-view source fidelity, and failure reasons. A subsequent
matched-seed control and separated random streams remain open research.


### Architectural Birth operator controls and evidence funnel

The new opt-in source-derived recipe keeps the existing six-family OODA-HA
controller; it does not create a seventh runner. The inherited
`arch.birth.enable` switch participates in exact-attempted / native-valid /
scored activation funnels and is isolated for surrogate uncertainty, so
newly enabled geometry does not inherit invented confidence from inactive
offspring. The mode cell also appears in explicit topology-locus identity.
The dedicated native birth workflow has a source-pair creation gate, a
source-verified active bearing gate, two short OODA-HA epochs, an immutable
archive census, and retained CAD rejection receipts. Those results are
unknown until same-head Actions completes.


### Native refusal versus operational exceptions

A complete compound SolidAssembly rejected by exact BRep/void audit now
raises a typed `NativeConstructionRejected`, which WideEpoch records as
`rejected` with the actual audit. Malformed construction programs,
kernel exceptions, missing sources and broken scoring remain `error`.
This preserves surprising failure testimony without inventing survivors
or pretending software defects represent native design judgments.

## Architectural Birth · first source-held OODA-HA evidence

**Verified at code head `46721eca`:** the dedicated
[Architectural Birth workflow #40309995290](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40309995290)
passed **19 focused tests**, generated the source-derived birth pair,
regrew a native-valid `bears` construction from the one named Oblique Seed,
and completed **two OODA-HA epochs** with its existing six breeding families.

The cohort offered **36 proposals**, attempted **24 exact native audits**,
and produced **12 scored survivors, 12 distinct source-view masks and three
visual niches**. The `arch.birth.enable` activation funnel records:

| Birth-activation stage | Active | Inactive |
| --- | ---: | ---: |
| Proposed | 3 | 33 |
| Exact attempted | 2 | 22 |
| Native valid | 2 | 22 |
| Scored | 1 | 11 |
| Audited but unscored | 1 | 11 |
| Deferred | 1 | 11 |
| Native rejected | 0 | 0 |
| Operational error | 0 | 0 |

This is actual heritable source-bound graft evidence, *not* proof that
all three relation cells were attempted or admitted, nor an aesthetic
improvement over the source. Native-valid **≠** scored, and one distinct
silhouette **≠** an independently certified architectural organization.
No historical lineage, novel pet-name or Operator promotion occurred.

The birth recipe SHA is
`b10070c02ebbc407bd8e76579dd08603606e109a93c09144aee3e5498abbfefa`;
the original pet-named Oblique Seed entity SHA remains
`f3763c590f9972e5879dee9df22877e11136ba80e918d77990e51ffd40776c1c`.
The [retained Actions artifact](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40309995290/artifacts/12644651523)
contains the campaign archive, audits, source pair, and logs.
Repo-wide and held-out checks at `46721eca` must be consulted separately.

**Next evidence tasks:** compare a birth-active accepted child to a
counterfactual with exactly the same other genome loci and the birth switch
off; report native material deltas and all six fixed-camera silhouettes.
Then vary relation modes under a controlled native audit budget, retaining
real CAD refusals and their reasons. Do not call those future experiments
complete merely because the first cohort passed.



## Experiment Zero · source-frozen primary massing and independent high-resolution audit

The early-alpha experimental primary-massing grammar now inherits source-bound
terrace/keep/crown displacements and two optional watchtowers under the *same*
six-family OODA-HA controller. The synthetic five other orthographic views
share seed-frozen inspection cameras and help preserve different inherited
morphologies even when oblique silhouettes coincide. They provide no extra
artwork observations. See [MASSING_EVOLUTION](MASSING_EVOLUTION.md).

The dedicated workflow `.github/workflows/necrospire-massing-fullres.yml`
uses bounded 128×192 scoring during three OODA-HA generations, then re-grows
every scored native-valid descendant for an independent 1024×1536 source
alpha IoU audit with the exact original fixed oblique camera. These independent
high-resolution results do not retroactively select parents or authorize
Operator pet-name promotion. At authoring time, the campaign had not yet
produced hosted results; inspect exact-head workflow receipts and archives
before calling any offspring successful.
