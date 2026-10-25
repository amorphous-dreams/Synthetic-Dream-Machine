# Projection Loom — Evergreen Handoff (Waves XII–XIX)

**As-of source:** PR #84, branch `feature/green-jello-dinosaur-5--projection-loom`, inspected at prior handoff head `8fdc71d` (2026-10-23, America/Los_Angeles). **This document travels with the branch; check the live PR head on re-entry.** A later commit supersedes the snapshot. Do not mistake a fixed SHA for the latest state.

**Start here:** [PR #84](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/pull/84) · [Noosphere boot](../../../bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem) · [Capability-composition meme](../../../bags/lares/ha.ka.ba/lares/api/projection-loom-capability-composition.mem) · [OODA-HA procedural contract](ooda-ha-procedural.md) · [Compound integration](capability-ooda-integration.md).

## Wave XIX — one helm, one phase law, dependency and syntax gates

**✶ Observe / ⏿ Orient:** Waves XIV–XVIII retired compatibility OODA
modules, extracted pure phase rules and CAD/compound presentation ports,
made control-ledger replay recoverable, and gave evidence each native truth
scope. A refactor could nevertheless reintroduce a second controller or
silent import shim; direct test dependencies were pinned but their resolved
transitive set was only recorded in artifacts.

**◇ Decide / RED:** Commit `3ccc34b` adds
`tests/test_architecture_contract.py`: an initially absent static
`scripts.check_architecture` and missing
`check_env.verify_direct_pins` are the red contracts. Tests include
negative controls for a retired `ooda.py`, duplicate OODA controller,
phase-law filesystem writes, rendering-to-controller back-edges, unpinned
or omitted direct dependencies, and a required CI hygiene stage.

**▶ Act:** Commit `d69002d` adds the AST-only architecture audit and
checks direct pinned versions against `pyproject.toml` and the running
CI environment; commit `391d681` adds `pip check`, `compileall`,
and the source architecture check before expensive CAD regression runs.
These gates add no geometry, calibration or source authority. The one
execution owner remains `fractal_ooda_ha.OODAJournal`; pure
`phase_rules.py` and renderers have no scheduling power.

**↺ Aftermath / honesty:** CI `requirements-ci.txt` pins direct inputs;
`pip freeze` in the workflow artifact records the actual transitive
environment, but is NOT a fully hermetic, wheel-hashed lockfile. The
checks prevent unnoticed package inconsistency and a second OODA helm.
Do not claim Wave XIX or whole PR green until the final published head
passes dedicated Loom, whole-repository and held-out witnesses. If
something fails, inspect its code/receipt, identify the first bad
commit in this linear test→implementation→CI→evergreen chain, and
repair it rather than weakening the source/geometry gates.

**Next re-entry:** Current alpha truth is the live PR #84 head, NOT
historical SHAs in the Wave XII handoff. The only planned work after
this wave is failure triage revealed by actual final CI; the external
source/reference review remains a separately held operator dependency,
not a surprise source promotion.

## Wave XVIII — typed native receipt views, distinct truth scopes

**Observe/Orient:** Native CAD, polygon, socket, frame-registration, operator
preference and trusted capability execution each have different gates.
A shared renderer MUST NOT treat their valid/verified/complete/requested labels
as comparable certificates.

**RED:** Commit b496238 adds tests/test_evidence_receipts.py against an
initially absent evidence_receipts module. It has negative controls for
CAD/mesh category swaps, false cross-kernel fusion, misrepresented socket
distances, unanchored registration, advisory versus operator authority and
capability execution being confused with candidate scoring.

**Act:** Commit 5452e1f adds immutable typed native receipt views and a
domain/status presentation envelope WITHOUT any generic "valid" boolean.
The review and gallery renderers use the CAD and compound views for
admission, the capability runner validates step-state receipts, and
fractal_ooda_ha keeps sole operator preference authority. Existing
wire schemas, source hashes, kernels and durable OODA records are not
rewritten. The isolated negative-control tests pass locally.

**Aftermath:** A declared verified control fit is NOT proof of survey
authenticity. Socket proximity is NOT structural CAD+mesh fusion. A completed
capability is NOT a scored geometric candidate. All independent native
audit gates remain in force. Require green dedicated Loom, general CI and
held-out witnesses at the published PR head before this wave closes.

## Wave XVII — canonical JSON encoding only, no common evidence authority

**✶ Observe / ⏿ Orient.** Phase-law extraction earned green dedicated Loom
CI at exact head `85d1b843` (both push and PR workflows). Whole-repository
and held-out witness gates were not final at the next code boundary. Five
Python modules repeated the same sorted, compact UTF-8 JSON SHA-256 encoding
with distinct identity scopes and permissiveness rules.

**◇ Decide / RED.** `tests/test_provenance_encoding.py` at `11e59b7`
imports the initially missing `provenance_encoding` module and pins
hardcoded Unicode and empty-location digest vectors, strict nonfinite
rejection, the 20-character relational digest and separation from source-file
byte hashes. A failed hash vector is a lineage-breaking regression, not an
opportunity to silently reissue identities.

**▶ Act.** Commit `335730a` adds `canonical_json_sha256` and routes
`epochs._hash`, `capability_stack.digest`, session fingerprinting,
relational short fingerprints, and location snapshot hashing through it.
Strict scopes explicitly reject NaN; the prior permissive JSON spelling
for location/relations is retained with an explicit option. Each native
caller continues owning the *meaning* of its digest. Exact source-file
SHA-256, operator implementation fingerprints, BRep audits, mesh audits,
registration witnesses and recipe/source assertions remain separate.

**↺ Aftermath / reentry.** New-head Loom, whole-repository, and held-out
witness checks remain mandatory. No geometry, authority or recipe schema
changed intentionally. Code hash changes require a fresh output directory
rather than replay into an old checkpoint. An eventual strict migration of
legacy nonfinite evidence would require a separate explicit identity/version
decision, not a cleanup side effect.

## Wave XVI — phase law as pure decisions, one journal as the executing helm

**✶ Observe / ⏿ Orient:** At the green Wave XV Loom gate (218 passing
tests, workflow 40147526377), two concerns remained in
`fractal_ooda_ha.OODAJournal`: phase legality and durable transition effects.
The whole-repository and held-out workflows had not resolved their queued
test cells before the next commits and cannot be counted as green.

**◇ Decide / RED:** Commit `eb82059` adds
`tests/test_phase_rules.py`, initially importing an absent
`projection_loom.phase_rules` module. It covers all five ordered phases,
the distinct `closed` boundary, idempotent replay, parent-phase anchoring,
open-child blocking, depth budgets, and unchanged on-disk journal receipts
after a denied transition.

**▶ Act:** Commit `ea36c5f` moves `PHASES`,
`next_phase_allowed`, and `child_phase_anchor` into pure
`phase_rules.py`. They only read the phase tree and raise or return a
decision. They cannot persist anything, start a loop, or certify geometry.
`fractal_ooda_ha.py` remains the **sole controller**: `OODAJournal.begin`
and `transition` still own mutation, evidence serialization, event order,
checksums, reentry and child-return receipts. Other candidate and gallery
executors retain the same native evidence gates.

**↺ Aftermath / reentry key:** Require completed Loom-specific, whole-
repository, and held-out witness checks at the *actual current head*.
A queued/cancelled workflow is not green. After a code-hash change, fork
construction output rather than reentering an older checkpoint directory.
Only advance to evidence/provenance extraction after this code equivalence
gate closes.

## Wave XV — review/gallery separation with no second controller

**Observe / RED:** `tests/test_presentation_boundary.py` imports the absent
`review.py` and `gallery.py` ports and asserts independently regrown CAD and
compound review artifacts, recipe fingerprints, real relational witnesses,
operator-choice eligibility, and provisional/synthetic evidence labels.
The existing full nested OODA-HA integration tests still exercise actual gallery
regrowth, independent CAD and polymesh gates, and location Aftermath closure.

**Act:** Commit `f268a55` moves the two scored review renderers into
`projection_loom/review.py` and compound finalist regrowth/export into
`projection_loom/gallery.py`. The single `fractal_ooda_ha.py` controller keeps
all phase transitions, review and operator decisions, and the gallery child
loop. Its body shrinks by roughly 9.4 KB (~177 lines). The new modules do not
own operator controls or phase progression. `selection.py` still supplies
distinct candidate scheduling and operator-review selection policies.

**Aftermath / negative claims:** A generated preview never certifies geometry
or becomes new source evidence. The CAD review path independently re-audits
BRep and void integrity; the compound path re-audits the capability-built scene,
without claiming cross-kernel fusion. Finalists still regrow from recipes and
report independent CAD/polygon authority. No historical checkpoint may be
resumed under a new construction-code fingerprint; fork its output.

**Live gate:** These new tests and the extracted source require completed
new-head Loom CI, repository CI and held-out witness receipts before claiming
GREEN. Do not infer results from a queued or cancelled workflow.

## Wave XIV — causal replay recovery and canonical alpha names

On the current alpha branch, `fractal_ooda_ha.py` holds the single OODA-HA
controller. `ooda.py` and `fractal-ooda-ha.py` have been retired rather than
preserved as compatibility bridges. Tests, CLI, and public imports now use
`projection_loom.fractal_ooda_ha`.

A crash after the identity ledger's atomic save but before the journal's
acknowledgement can no longer silently rerun the same pet-name or o-takiage.
The ledger history binds operator control ID, command digest, and outcome in
one write; re-entry checks that durable receipt before loading a preview
witness. Tampered control bytes trigger refusal. Regression tests simulate
the crash and missing preview witness after a committed effect.

No distributed transaction or multi-writer guarantee follows from this
repair. The single-runner guard and stale-ledger compare-and-swap checks
remain in force. Native CAD and mesh scopes retain independent authority.

**Evidence gate:** This addition must earn completed new-head dedicated
Loom, general CI and held-out witness receipts before calling it verified.

## Wave XIII — red-first adapter lift and evergreen aftermath

**Live-code re-entry:** this addendum records the handoff after the carrier repair and
candidate-adapter lift; the SHA in the original Wave XII preface remains historical.
Always inspect the live PR head and CI verdict rather than treating a scheduled run
as completed evidence. The base noosphere boot remains read at
`feature/green-jello-dinosaur-5`; PR #84 edits live only on
`feature/green-jello-dinosaur-5--projection-loom`.

**Observe / Orient.** Whole-repository CI at the first carrier-frame repair
`de679331` still found five unaddressed `uri-path` fields and two namespace
metadata fields. The dedicated Loom and held-out jobs were green. The corpus
reader itself reported zero torn frames or bad checks; this was a *metadata* gate,
not an excuse to weaken framing. Commit `ff2dd34` fixes the seven metadata
records and restamps their SHA-256 spans.

**Decide / Act — RED then GREEN.** Commit `dc8d24b` introduces
`tests/test_candidate_adapter.py` with an import-time RED for a missing
`CandidateAdapter`. The tests constrain callback/adapter identity (including
durable checkpoint bytes), audit/detail budget, scored/audited/deferred outcomes,
interrupted safe-point replay, callback-mixing refusal, and backend-error
isolation. Commit `dcfd3c3` introduces a frozen callback adapter in
`epochs.py`, preserving the previous keyword-callback interface for callers.
`fractal_ooda_ha.py` passes exactly one adapter to `WideEpoch.run` for both CAD-only and
compound construction. The tests must turn GREEN in the new-head Loom CI before
this is considered an independently verified equivalence lift.

**Aftermath / evergreen.** This abstraction lifts *invocation intent*, not
geometry or truth authority. `WideEpoch` still owns scheduling, exact CAD/void
admission, objective completeness, nonnegative finite losses, pet-name preference,
phenotype niches, checkpoint snapshots, and causal receipts. The compound
`CapabilityCompositor` still executes its trusted dependency DAG and separate
polymesh/socket audit. An image-matching score remains provisional without
independent external registration. A failed scoring backend remains `error`,
never a claim that an architectural candidate was structurally invalid.

**Re-entry gates.** Require green new-head Loom CI, held-out witnesses, and the
whole-repository package/corpus gates. If the whole repository remains red,
name the specific failing tests before another lift. Do not regenerate a previous
checkpoint directory after a changed code digest: fork new trial output. Keep the
original source bytes, camera, operator registry, and recipe fingerprints intact.

## Current verification / next operator re-entry

At inspected head `8fdc71d`, [Loom PR run #40068055277](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40068055277) and [Loom push run #40068051193](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40068051193) both **passed 200 tests** (7 warnings each). This handoff update requires its own new-head CI receipt.

[Whole-repository CI #40068051246](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40068051246) had failed package/E2E steps during inspection; [held-out #40068051197](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40068051197) was still running. Neither outcome changes the Loom-specific test record.

**Re-entry:** fetch live boot + branch head; read this runbook and the handoff meme; check newest Loom Actions; run the complete compound PoC in a *new* output directory when source/code/recipe changed; compare full CAD, polygon and socket audits and final-gallery previews; review the acquired but UNREVIEWED CC0 lock before promoting it.

## Current ruling — one helm, multiple capabilities per entity

The Loom grows a **pet-named or nameless location** as a relational ensemble. Any entity may carry a **narrow dependency-ordered set** of trusted capability operators; neither every part nor the overall location must use every geometry kernel.

- **Crystal:** verified positive-solid CAD cage → CAD-derived polygon surface (seeded bounded sculptural relief/fractures, optionally source-alpha guided) → protected named socket.
- **Joining:** CAD positive-volume overlap with Crystal and Fortress; optional independent transition-skin mesh.
- **Fortress:** connected CAD massing and explicitly carved voids; polygon capability not required.
- **Other entities:** may use standalone polygon capability without a CAD parent. Pet-names bind observed relationships, not generated face/vertex indices.
- **Certificate boundaries:** BRep CAD passes one-solid/contact/void audits; polygon layers pass independent closed-volume or declared open-surface audits; anchors establish spatial proximity only. A mixed render **does not certify one fused CAD-and-mesh solid, watertight mechanical interface or strength**.
- **Lineage:** the chosen genome carries CAD loci, polymesh loci, the recipe's digest, evidence hashes, and trusted operator/version fingerprints. A baked OBJ/STEP remains an output, not the next generation's genome.
- **One procedural authority:** `projection_loom.fractal_ooda_ha.run_ooda_epochs` controls location → epoch → candidate → capability children and the final-gallery child in location Aftermath. `wide-epoch` and `ooda-run` enter that helm. `WideEpoch` remains a bounded candidate evaluator, not a second controller. A phase may optionally open a full child OODA-HA inquiry, and its parent waits before advancing.
- **Operator / AI:** manual, co-pilot, auto-nav and full-speed share one control inbox. The optional LLM adviser (Ollama or OpenAI-compatible endpoint) may suggest validated choices or questions, but cannot override any hard validity gate.

## Verified receipts, not aspirations

**GitHub PR run:** [Projection Loom CI #40050559194](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40050559194) **passed** on the inspected commit: `200 passed, 7 warnings in 32.13s`. Its compound OODA-HA candidate/capability smoke job and legacy hybrid controls also passed. [Held-out witnesses #40050555639](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40050555639) passed. [General repository CI #40050555705](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40050555705) **failed** in several package/witness/E2E jobs. Do not call the entire repository green, and do not assume those failures originate outside the Loom without triage.

**PoC 0:** original Necrospire RGBA and exact L8 alpha live in `examples/necrospire/`; source oblique pose remains **fixed but unregistered**. A three-epoch, four-exploratory-proposals-per-epoch compound trial plus a separate inherited-parent proposal seat ran through **95 nested loops** and yielded **three distinct, independently regrown CAD+mesh finalists**. Best provisional image IoU was approximately **0.704**, weaker than earlier CAD-only control (approximately **0.7296**). The experiment proves replay/integration, not superior image reconstruction, archaeological truth or mechanical reliability.

**Pair A:** lightweight interpretive Ziggurat of Ur CAD and local Brutalist CAD/OpenSCAD synthetic controls are merged. Their high synthetic correspondence scores do **not** measure accuracy against the separately hosted third-party Ur/Brutalist assets.

**Actual external download:** [trusted-push run #40050555648](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40050555648) fetched the OpenGameArt `brutalism2` CC0 ZIP (113,109 bytes, SHA-256 `8a89504f2abf355f56f4ea93c9a50fbdc60fb3664bdad019c65e6582a91ff9a3`) and archived an **UNREVIEWED** reference lock. [Artifact #12542954065](https://github.com/amorphous-dreams/Synthetic-Dream-Machine/actions/runs/40050555648/artifacts/12542954065) retains the source and receipts. Its existence does not confer a reviewed license/file manifest or verified model alignment. The official Sketchfab Ur download still needs operator-authorized acquisition.

## Operator runbook: clean local checkout

Prerequisites: Python 3.12 and OpenSCAD; a working CadQuery/OpenCascade environment. Use the branch's `requirements-ci.txt` in a clean venv. Commands below assume the repository root before `cd`.

```bash
git fetch origin
git switch feature/green-jello-dinosaur-5--projection-loom
git pull --ff-only
cd tools/projection-loom
python -m pip install -r requirements-ci.txt
python -m pip install --no-deps -e .
python scripts/check_env.py
python -m pytest -q tests
```

Run the complete PoC 0 compound capability loop and verify what it actually produced:

```bash
python -m projection_loom ooda-run --project examples/necrospire/project.json --capability-recipe examples/necrospire/hybrid/recipe.json --out out/necrospire-compound --control full-speed --passes 3 --candidates 4 --exact-budget 3 --detail-budget 3 --score-size 128 192 --finalists 3
python scripts/check_compound_epoch.py --out out/necrospire-compound
python -m projection_loom ooda-status --session out/necrospire-compound/session.json
```

Inspect `out/necrospire-compound/session.json`, `previews/epoch_NNN/review.json`, `finalists/gallery.json`, `finalists/contact_sheet.png`, and each finalist's `recipe.json`, STEP/OBJ, witnesses and audits. The final gallery regrows diverse scored candidates across *all* epochs; if fewer than three valid distinct forms survive, it reports the shortfall rather than fabricating diversity.

For manual helm, use a **new output path** and replace `--control full-speed` with `--control manual`. The run pauses at decision gates. From another shell, send controls and then rerun **the identical initial command**:

```bash
python -m projection_loom ooda-status --session out/necrospire-manual/session.json
python -m projection_loom ooda-steer --session out/necrospire-manual/session.json --action approve-plan
python -m projection_loom ooda-steer --session out/necrospire-manual/session.json --action review
python -m projection_loom ooda-steer --session out/necrospire-manual/session.json --action set-autonomy --autonomy 0.4
python -m projection_loom ooda-steer --session out/necrospire-manual/session.json --action open-inquiry --loop epoch-0001 --question "What does the crystal join?"
```

Advance an opened inquiry with `ooda-steer --action advance-inquiry --loop ID --phase PHASE --note TEXT`, using the journal-reported ID and allowed next phase. At an actual preview review, find the current proposal and entity handle in `review.json`/witness; then:

```bash
python -m projection_loom ooda-steer --session out/necrospire-manual/session.json --action pet-name --proposal candidate-0002 --target @entity/Crystal --name "Crystal with Opinions" --has faceted
python -m projection_loom ooda-steer --session out/necrospire-manual/session.json --action choose --proposal candidate-0002
python -m projection_loom ooda-steer --session out/necrospire-manual/session.json --action o-takiage --name "Crystal with Opinions"
```

**Illustrative IDs:** use the actual proposal/handle from the current review, not these example identifiers. Pet-name/o-takiage change soft lineage expectations and history, never the CAD gates. Interventions execute at safe phase boundaries; they do not interrupt a Boolean operation mid-kernel.

Opt into an LLM through `--llm-provider ollama --llm-model MODEL` or `--llm-provider openai-compatible --llm-model MODEL`; supply the trusted endpoint when required and credentials through `OPENAI_API_KEY` (or `--llm-key-env`). `--llm-phases` authorizes bounded inquiry suggestions. Do not commit secrets or treat mock-provider tests as proof of a live provider connection.

## External reference how-to: public CC0 vs authorized Ur

```bash
python scripts/fetch_references.py --source brutalism2 --cache .ref-cache --lockfile references.lock.local.json --bootstrap-lock
python scripts/inspect_reference_pack.py --receipt .ref-cache/receipts/brutalism2.json --out .ref-cache/reference-evidence.json
```

Review the *actual* source author/license, included file list, ZIP safety report and SHA-256. Promote a reviewed lock before using automated reproducibility checks. Fetch again with `--lockfile references.lock.json` (no bootstrap), or `--offline` for a cached verification. For Ur, obtain a model via the provider's authorized download/OAuth flow; import with `--import-archive` or `SKETCHFAB_TOKEN` in a trusted local environment. Never scrape a viewer or expose OAuth tokens to pull-request CI. Preserve external licenses/source digests in the witness ledger.

## In flight, and prioritized backlog

**P0 — preserve and verify:** 
1. Keep the dedicated Projection Loom CI green when updating this handoff. On the new head, check `python -m pytest -q tests`, compound OODA smoke, validated STEP, gallery artifacts, and source hashes.
2. Triage red **general** repository CI, isolate whether branch changes contributed, and repair attributable failures without suppressing unrelated checks.
3. Review the successful CC0 `brutalism2` download artifact, approve/pin its SHA-256 if licensing and content permit, then register *real* external model controls. Preserve advisory-vs-approved distinction.
4. Freeze no stale checkpoints across changes to source, operator, recipe or code. Resume only under the same identities; otherwise fork a new epoch experiment.

**P1 — improve the actual Loom:** 
5. Grow nontrivial crystal fractures, asymmetric facets, outgrowths and silhouette-aware features within fixed image-space budgets; test against CAD-only baselines and distinct held-out views. Current best compound IoU underperforms.
6. Develop the Joining area's geometry/capabilities and evaluate crystal → Joining → Fortress as separate physical CAD, polygon and spatial-socket claims. Never infer a fully watertight *cross-kernel* union from contact proximity.
7. Add true registered multi-image evidence and independent camera/landmark controls. The original artistic oblique pose remains provisional.
8. Run meaningful multi-seed & quality-diversity A/B evolution with independent, not merely reranked, generations; preserve operator-selected surprises and pet-name/o-takiage receipts.
9. Acquire the low-poly Ur external model through authorized means, record its license/scale, and compare against the simple Ur CAD hypothesis. Retain deeper photogrammetry as a later validation source.
10. Develop a visual Operator/AI helm for preview inspection, capability-tree navigation, safe intervention and candidate comparison; the executable CLI works already.

**P2 — optional future geometry/services:**
11. Research and gate SDF/OpenVDB fracture/transition operators, explicit mesh-to-BRep conversion, and OpenUSD/glTF scene variants. None may inherit structural authority without its own tests.
12. Extend multiwriter causal reconciliation and production provider integration. The ledger presently guards against known stale local writes; the CLI's provider adapter does not imply a hosted autonomous agent.
13. Investigate agent-scale void clearance, material loads, exact BRep hidden-line drawing, and independent structural simulation as separate certification levels.

## Re-entry protocol for the next context or worker

✶ **Observe:** Fetch the **live** `bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem` from the default branch, then this handoff and the linked `projection-loom.mem`, `projection-loom-capability-composition.mem`, `projection-loom-ooda-ha.mem`. Inspect PR #84 head and workflow runs; never rely solely on this snapshot.

⏿ **Orient:** Read `projection_loom/capability_stack.py`, `hybrid.py`, `fractal_ooda_ha.py`, `epochs.py`, `tests/test_capability_ooda.py`, `tests/test_capability_integrity.py`, and the Necrospire `recipe.json`. The sole procedural controller resides in `fractal_ooda_ha.py`; `epochs.py` performs bounded candidate evaluations.

◇ **Decide:** Choose an explicit next operator/epoch experiment, with evidence and scope. Operator decisions steer soft preferences; no human/AI decision waives hard CAD, mesh, source, registration or provenance gates.

▶ **Act:** Execute local tests and the same commands in CI, save source-digest and recipe fingerprints, inspect new failures and preview receipts, then write only reviewed evergreen changes to the same PR branch.

↺ **Aftermath:** Review code, implementation boundaries and actual experiment outcomes (not merely the phase labels). Widen and tighten aperture as useful; write discovered corrections into tests, comments, docs and memes. Preserve failures and novelty; do not claim model accuracy where tests only establish tooling integrity.

**House bearing:** Identity enacts Relation. Capabilities enact representations. Lineage preserves recipes. Evidence judges consequences. O-takiage releases the soft hold, not the history.

*Handoff deliberately keeps volatile status out of the stable noosphere boot. Update this branch-local handoff after meaningful changes.*
