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

## OODA-HA Wave B · portable native scene interchange (2026-10-28)

**Observe:** USD is a composed representation of evidence, not a causal ledger or CAD validator. PyPI publishes `usd-core==26.11` for CPython 3.12/Linux; this is a **declared CI input**, not a previous executable witness.

**Orient:** Native CadQuery/OpenCascade shapes can be audited then tessellated into USD, while STEP re-import independently checks geometric claims. Neither STEP nor a tessellated prim preserves the Loom's semantic history without explicit bindings.

**Decide:** Author the OpenUSD layer stack with generated geometry beneath an operator-presentation layer, explicit Z-up and user-declared meters per model unit, and custom semantic ID bindings. Maintain portable relative sublayers and content hashes. Keep separate exact STEP receipts per assembly.

**Act:** Add `scene-package --declaration ... --out ...` and `scene-validate --bundle ...`, via the existing CLI. Create and reopen actual USD stages and STEP files; compare native volumes/bounds/solid count, refuse missing or tampered assets, permit relocation. Exercise an independent two-assembly village fixture rather than Necrospire assumptions.

**Aftermath:** The scene-package vertical capability is implemented but **awaits exact-head USD CI**. This is not full Wave B: Blender and Unreal open/import witnesses, scene variant selection and direct editor writeback remain incomplete. No standalone claim of engineered load safety, metric survey, or editor operation.

**Sources:** [OpenUSD stage authoring](https://openusd.org/release/tut_helloworld.html); [USD stage metrics](https://openusd.org/release/user_guides/schemas/usdGeom/overview.html); [usd-core on PyPI](https://pypi.org/project/usd-core/26.11/).

## OODA-HA Wave C · dependency-sensitive rebuild planning (2026-10-28)

**Observe:** Full scene repackaging is more expensive than renewing the affected dependencies, but treating unchanged file existence as freshness risks stale native claims.

**Orient:** A plan can prove invalidation reachability, not the correctness of any cached CAD body. Identity and source/program digests must remain separate.

**Decide:** Add a pure, finite, deterministic dependency graph (source/program → native CAD audit → STEP/mesh → composed USD, and separate operator presentation), not an alternate five-phase execution controller.

**Act:** Add `scene-invalidation --before ... --after ...`; test moved/modified one-assembly inputs, preserved independent assemblies, deterministic order, cycle and missing-source refusal. The full OODA-HA journal remains the only helm.

**Aftermath:** C-03 selective invalidation *planning* is implemented; actual selective CAD rebuild/cache reuse, interrupted replay and concurrent full editor reconciliation are **not yet witnessed**. Mark full Wave C incomplete.

## CI correction · distinct native USD test environments

At head `57c683d9`, the `usd-interchange` job **passed**: real OpenUSD stages and STEP reimports completed. The generic `contracts` lane passed 50 tests but failed four USD-only tests because it did not install `pxr`. That was a CI test-lane ownership error, not a demonstrated native interchange failure. The generalized/relational/incremental tests now run in `contracts`; four real USD/STEP tests run in `usd-interchange` with pinned `usd-core==26.11`. Re-run at the correction's exact head.

## OODA-HA Wave D-00 · editor-neutral causal proposals (2026-10-28)

**Observe:** USD prim transforms are presentation; ordinary mesh-topology editing cannot be assumed reversible into authored CAD growth.

**Orient:** A supported rigid translation of an independently authored assembly can be expressed as a semantic operation without guessing an inverse developmental genome.

**Decide:** Bind native scene declarations to explicit semantic IDs via `editor-seed`, then take one actor-attributed, source-bundle-pinned, observed-frontier proposal through the existing relational ground. Reject unknown ids, stale conflicting frontiers, and arbitrary mesh topology. Move exact CAD, rerun its native audit, re-export/reimport STEP, and compose a new USD bundle; preserve old evidence and branch ancestry.

**Act:** `editor-apply` accepts supported editor-neutral proposals and writes `ground.json`, `declaration.json`, `scene/` and `reconciliation.json` only after native regeneration. Actual native cache reuse is **zero**; an invalidation *plan* cannot be counted as avoided CAD work. The supported operation is whole-assembly translation, not parent-relative structural repair.

**Aftermath:** A real headless edit/reconcile/regenerate path is implemented and must pass CI. This does **not** close D-B or D-U: Blender and Unreal application-side writeback are not yet witnessed, and presentation retention across editor reload remains open.

## OODA-HA D-B · actual Blender-side contract and headless witness (2026-10-28)

**Observe:** `bpy.ops.wm.usd_import` is Blender Editor's actual USD import interface, but generated mesh topology and object names alone must not become causal identity.

**Orient:** Bind imported objects to semantic identities using the native bundle's explicit prim-map receipt, then keep that custom semantic ID through object rename. Mesh local-vertex/index digests expose unsupported hand modeling. Matrix checks refuse scale, shear and rotation; only local whole-assembly translation is supported.

**Decide:** Bridge real Blender scenes using `blender/bridge.py` with import/capture/reload verbs. An independent `scripts/real_blender_witness.py` runs Blender in background mode, creates a deliberate test move, submits the attributed proposal through the native reconciler, then reloads the regenerated bundle while retaining an operator-owned Blender note.

**Act:** Add dedicated `blender-real-editor` CI job; install actual Blender on Ubuntu and execute the full path. No bpy mock, proxy renderer or fake editor report.

**Aftermath:** Until that workflow passes at its exact SHA, Blender support remains REVIEW, not DONE. Even when it passes, the verified edit vocabulary is intentionally limited to rigid translation; arbitrary mesh edits, rotations, physically checked support reparenting and full interactive UI review remain unsupported. Unreal remains BLOCKED without an actual editor runner.

## OODA-HA Wave E · bounded native site responsiveness (2026-10-28)

**Observe:** The developmental program already records parent/face sites measured from CAD bounding extents. Structural support and load safety remain distinct.

**Orient:** Changing a support's extents should alter dependent proposed child size without global coordinates or an independent evolutionary controller. We can test that claim under the same CAD budget as a fixed-program control.

**Decide:** Use `regulative_growth.regulate` to compile the current prefix, read the actual semantic support-site capacity and bound the child width/depth/height along its face. Refuse ambiguous parent sites and unbounded parameters. Keep unsupported rotations, load checks, and source views out of the score.

**Act:** `regulative-control --growth ... --fill ... --out ...` runs one exact native audition for fixed and one for locally regulated programs through the existing five-phase `OODAHAJournal`, retaining activation, validity and errors. Held-out subjects include a vertical terrace and horizontal coastal jetty.

**Aftermath:** Native regulative capability and matched controls require exact-head CI. This does not close E-01 through E-08: structural crossover fairness, matched source-conditioned multi-camera fitness, multiple generations, environment sensing beyond local site capacity, and operator-steered evolution remain open. No automatic winner promoted.

## Blender application witness failure at `a0bc227a`

The `blender-real-editor` job installed actual Blender 4.0.2 but could not find its `LOOM_BLENDER_IMPORT` marker. The Blender subprocess exited zero without the marker, demonstrating that its process exit alone is insufficient evidence. The witness now includes Blender stdout on missing-marker failure; D-B remains REVIEW/BLOCKED until the underlying import error is attributed and repaired.

## OODA-HA Wave F · held-out cross-representation adversarial run (2026-10-28)

**Observe:** A scene can appear correct while a stale editor overwrites history or STEP assets are altered after emission. The original seven seed combinations alone do not independently demonstrate a second architectural subject or a re-entry edit loop.

**Orient:** Create a held-out coastal conservatory with two independently authored assemblies, distinct from Experiment Zero's original Necrospire and image/grammar/proxy inputs.

**Decide:** Exercise real native CAD admission, USD layer composition, STEP re-import, semantic ID preservation, editor-neutral accepted relocation, regenerating CAD evidence, selective *planned* invalidation, stale concurrent edit refusal and tampered STEP asset refusal in one reproducible run.

**Act:** `python -m projection_loom.hephaestus_crucible --out ...` produces inspectable source/regenerated bundles, original and new causal ground, rejected tamper copy and a separate `crucible.json` outcome. CI retains all artifacts. The previous seven-cohort experiment remains a separate mandatory lane.

**Aftermath:** This is the new held-out F-02/F-04 test slice, **not** full F acceptance: no actual Unreal Editor, no multi-camera calibration, no demonstrated native incremental cache reuse, no robust cross-tool variant writeback and no repository-wide cleanup. Every status requires exact-head CI.

## OODA-HA Wave A-06 · independently authored producer capability (2026-10-28)

**Observe:** The generalized engine previously inferred an initial program by a direct switch on the three Experiment Zero seed kind names. That prevented a truly independent fourth program without modifying generic engine selection.

**Orient:** Source kind identifies testimony, not the implementation capability or scene winner. The adapter knows how it constructs or supplies a visual observation, while the generic engine need only compose its declared growth programs and an explicit bounded constructive priority.

**Decide:** Permit canonical new capability names at the seed substrate with explicit source frame and retained authority; move construction offer behavior into `SeedAdapter.offered_growth()` and `visual_source`. The generic `initial_program` selects offers by an explicit constructive priority and grafts independently sourced subtrees without knowing any producer kinds. Do not infer unregistered cameras.

**Act:** Independent `independent-program` fixture enters through `SeedAdapter(SeedEntry.from_file(...), program)`, and is auditioned as genuine native CAD through the one OODA-HA helm. Preserve the original seven-cohort matrix and verify old native behavior via exact-head CI.

**Aftermath:** This closes the kind-switch *in the generic initial construction path*, but not Wave A's full replacement of `LocationStack` or complete multiview evidence; new adapters still need per-kind validation and composition policies. Exact-head CI remains required.
