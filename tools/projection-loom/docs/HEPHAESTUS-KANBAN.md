# Loom of Hephaestus · OODA-HA executable kanban

**Authority:** Operator approval for engineering work on PR #84. Do not merge the PR, promote a candidate or alter Elyncia canon. This is a work log; it does not supersede source-bound evidence.

**Re-entry:** read `bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem` from `feature/green-jello-dinosaur-5`, then inspect the *current* head of `feature/green-jello-dinosaur-5--projection-loom`. Base before this campaign: `050538e688487145f0ef187c219800a87334c7da`.

## Wave ledger

| Wave | Scope | Status | Witness / blocker |
| --- | --- | --- | --- |
| R | Re-entry, module census, baseline, replay safety, editor prerequisites | IN PROGRESS | R-04 implementation proposed at this wave; exact-head Actions must run before DONE |
| A | Persistent semantic identities, typed relations, frames, schemas, independent subject | BACKLOG | Depends on R |
| B | Portable deterministic OpenUSD, actual CAD meshes and STEP evidence | BACKLOG | Depends on A, verified OpenUSD/editor prerequisites |
| C | Causal frontiers, safe reconciliation, dependency invalidation, resumable single OODA-HA helm | BACKLOG | Depends on A/B |
| D-B | Full Blender edit/reconcile/regenerate workflow | BACKLOG | Requires actual Blender runner |
| D-U | Full Unreal edit/reconcile/regenerate workflow | BLOCKED | Actual Unreal Editor runner/plugin environment unverified |
| E | Regulative development, controlled experimentation, operator-steered QD | BACKLOG | Requires A/C and editor-originated steering where applicable |
| F | Cross-subject adversarial crucible and deletion of obsolete alpha paths | BACKLOG | Requires witnessed A-E |

## R-04 · Failed replay and immutable receipts

**Observe:** Former `run_cohort` wrote `summary.json` with operational errors, raised, then replayed that file as a successful return. Former `save_once` reused a common `.pending` filename and replaced existing finals.

**Orient:** A summary is an aggregate, not independent evidence of success. Its source/run ID, every epoch, candidate receipt, finalist and OODA-HA journal are part of the claimed completion.

**Decide:** Reject historical failed summaries, validate completed source frontiers, and publish receipts by unique temporary files + atomic no-clobber hard links. Never rewrite an immutable previous failure to claim success.

**Act:** Implement the above and test failed replay, tampering, missing receipts, idempotence and competing writers. A failed campaign stays failed; restart in an independently attributable output directory.

**Aftermath/push gate:** Run focused tests, architecture gate and exact-head generalized seven-cohort CI. Only mark DONE after Actions returns real success at this commit. Where native local checks could not run, explicitly name the hosted witness.

## Wave obligations retained

- A: A-01 through A-09, including independent fourth producer and parent/support metamorphic tests; remove superseded mixed ownership in the same validated wave.
- B: B-01 through B-09, portable USD, native CAD body tessellation, STEP reimport, application consumption, no fake OpenUSD composition support.
- C: C-01 through C-08, causal islands and frontiers, selective incremental rebuild, single phase helm, rejected conflicts and replay.
- D: D-00, DB-01 through DB-04, DU-01 through DU-04; application-side tests mandatory.
- E: E-01 through E-08, actual site-dependent growth and matched source-held experiments, not a scheduler renamed as biology.
- F: F-01 through F-08, original seven cohorts and independent fourth subject, adversarial cross-tool witnesses, full cleanup.

**YIN cut:** no shadow OODA controller, universal geometry CRDT, faux CAD union, unsupported camera registration, alpha compatibility facade, or unexecuted editor success claim.

## OODA-HA Wave A/C interface · relational operations (2026-10-28)

**Observe:** Existing `RelationWitness` and `LocationStack` have valid but bounded duties (construction testimony and source catalog); neither represents typed operator editing with explicit causal parents.

**Orient:** Semantic continuity must persist across prim renames, parent motion, support refusal and source/representation changes.

**Decide:** Add a finite typed operation contract under `relational_ground.py`, one immutable event graph with explicit observed frontiers. Keep exact geometry outside it, keep the source catalog as testimony, and refuse stale conflicting edits rather than a global clock or geometry CRDT.

**Act:** `ground-init`, `ground-apply`, `ground-inspect` enter the existing CLI; JSON Schema validates supported operations, parent/child requirements invalidate downstream candidates, and event DAG receipts preserve ancestry. Test a fourth independent village fixture, intentional support severance, concurrent non-conflicting annotations, stale conflicting edits, and representation rename.

**Aftermath:** This is a **complete standalone causal-edit contract**, but not closure of Wave A or C: existing generalized campaign and `LocationStack` still need integration/migration; no claim that edits regenerate native CAD yet. Hosted tests and architecture check must pass at exact commit before witness status changes. Blender/Unreal must not be inferred from this CLI.

**Wave R check:** Initial replay-safety commit `599d247e` passed dedicated generalization and Experiment Zero Actions. Other CI jobs were not uniformly completed when examined.
