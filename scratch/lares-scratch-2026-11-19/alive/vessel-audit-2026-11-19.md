Vessel-Auditor: Lares (Tasked Spirit)

<<~ set lares=`aim` from=`lar:///operator.audit.asks` to=`lar:///vessel.defects.ranks` ooda-ha=`5/declare-glyphs` drift-ward=`Static control flow supports findings; execution remains outside this audit`>>

Read-only audit of `/home/joshu/Synthetic-Dream-Machine`, `develop`, HEAD `8d264d76375ed0b2048bcbf40061fad1c3eb8c13`. Paths below start at `packages/`; **N** abbreviates `lararium-node/src/open-node-vessel.ts`, **B** abbreviates `lararium-browser/src/open-browser-vessel.ts`. **MEASURED** means read in code, never a reproduced runtime result. **REASONED** marks the concrete failure scenario. No builds, tests, services, Docker operations, or writing git commands ran. Only this seat's `out.md` was written.

1. **P1 — Browser drift leaves new personal-layer documents outside sealing.**

   **MEASURED:** B:2129 supplies a fixed sealed-bag list: the selected wiki's canon/working/draft, daemon slots, and daemon canon. It omits user-wiki `personal` layers and other announced face slots; the daemon personal slot does ride `DAEMON_WIKI_SLOT_BAGS`. B:801 records announced slots, but those names never expand `sealedCells.bags`. `lararium-mesh/src/sealed-rest.ts:628` searches only that list while a face stands; `sealed-doc-store.ts:412` passes an unmapped, never-classed document straight to the inner storage adapter. N:3542 instead derives its sealed list from `slotDocsNamed.keys()`, using `wornFaceWikiBags`.

   **REASONED:** A browser mounts `wikis/foo/personal`, announces a fresh document, and edits it -> the vessel saves its Automerge chunks into IndexedDB without sealing. Recording the document in `slotDocsNamed` does not protect it because its bag never enters the searched set. This repeats the class of omission the node recently repaired. Share one bag-classification derivation across both vessels, including registration and rest protection.

2. **P1 — Sibling saves receive the mounted face's chain and cannot seal.**

   **MEASURED:** N:2298 seats a distinct sibling place session; N:1001 selects it for that sibling's documents. But N:2322 builds `ownChain()` exclusively from the mounted face's dial/place cell, and N:2365 supplies that same chain to every booking through `book.door(ownChain, ...)`. `lararium-keyhive/src/operator-daemon-behavior.ts:772` seals through `sessionOf`; :703 rejects when the booked subject differs from `chainSubjectAt`. `island-session-proof.ts:91` derives that subject from the returned chain's place atom. The daemon also creates only the mounted content-key seat (:730); sibling lighting (:303) creates providers, not independent content-key seats.

   **REASONED:** Mount A, light sibling B, then change B's working-slot document -> the save books B's signer but reads A's place chain -> `session-face-foreign`, held saves, no durable B edit. A mounted A session cannot safely substitute. Finish the per-face content-key/chain route before treating sibling saves as supported.

3. **P1 — Composition teardown leaves dial and sibling session signers live.**

   **MEASURED:** N:2573 stops the dial, clears its anchor, closes only `placeCell`, and unseats `dialSeat`. It never drops `dialSession.signer`, closes the dial's session table, or loops over `siblingSessions`. `dropSiblingSession` at N:2311 performs the necessary sibling cleanup, but teardown never calls it. N:4994 gives the lift `drop: () => {}`. `standingSessionSeat().stand(null)` merely unseats (`lararium-mesh/src/session-sign-book.ts:130`); `nexus-client-dial.ts:190` merely disconnects the adapter. `lar-ws-client-adapter.ts:242` drops no signer. N:3289 also returns after an overtaken presentation mint without disposing its result.

   **REASONED:** Unlock A+B with a dial, retain the returned session book, then lock/switch/recompose -> sibling signers remain seated in the old book with open tables; the dial signer also retains its secret and live table. The lift fence blocks its former island door, but it does not revoke those signer objects. A dial mint overtaken by teardown leaks another live session. Give every minted presentation/session an owned close-and-drop handle; cancel flights and close all faces at teardown.

4. **P1 — Recomposition removes the lift before draining the final pool wave.**

   **MEASURED:** N:5064 flushes the current Repo, then disposes role caps, including the lift, before `p.teardown()` at :5068. Lift disposal removes `sessionSign` and `custodyWrite` (`lararium-mesh/src/lar-vessel.ts:139`). The pool/workbench watches drain later through teardown entries N:4728/:4750, before the daemon shuts down. `main.ts:1026` uses exactly this path for recomposition. Signal shutdown separately calls `facePoolStandDown()` before sealing and daemon shutdown (`main.ts:981`); recomposition does not.

   **REASONED:** Edit a watched file immediately before wear/lock, while its settle wave remains pending -> the initial flush misses that edit; the final watch drain ingests it after the lift disappeared -> sealing/wrapping refuses, and the old Repo shuts down with the change held only in memory. The disk file may survive, but this transition provides no durable sealed receipt. Drain producers, flush/rebook while the lift and daemon answer, then remove the lift. Use one shutdown sequence for both roads.

5. **P1 — A flush error skips Repo shutdown but still releases its store claim.**

   **MEASURED:** N:1540 places `repo.flush()`, sealed-store flush, hydration termination, and `repo.shutdown()` inside one teardown entry. Either flush throwing skips everything below it. `standDown` at N:593 catches that error and continues. N:830 subsequently releases an owned floor; a supplied floor permits the next composition on the same claim. N:5064's preliminary flush also logs and continues after failure.

   **REASONED:** Disk-full/I/O failure during lock -> the old Repo never shuts down, yet teardown resolves; the replacement composition opens the same storage under the existing claim, or another process takes the released claim. Storage/network work from the old Repo can overlap the replacement, and hydration waits remain live. Attempt shutdown in `finally`, preserve failure evidence, and do not report a freed/reusable store until its owner has actually closed.

6. **P2 — The dial presentation freezes; refusal paths still answer represented.**

   **MEASURED:** N:3338 replaces the refresh hook with a resolved promise. N:3361 then installs `lateDialOnce`, whose `standing: () => nexusDial !== null` prevents any work once a dial exists. Nothing here calls `adapter.represent`, although `lar-ws-client-adapter.ts:230` provides that operation. Board-change callers at N:1736 and `afterRoll` at :1873 therefore cannot refresh an existing presentation. Separately, N:3339 catches all dial errors without rethrowing; N:3380 logs a `certifyFounderAt` refusal and resolves. `after-roll-chain.ts:80` treats a nonthrowing re-present as success; `store-door-verbs.ts:642` exposes it as `represented`.

   **REASONED:** A gate anergizes the existing dial after an admit changes; take a replacement admit -> the bundle persists, but the standing dial never receives its new presentation and remains inert while the answer claims `represented: true`. With no dial URL, a founder-certification refusal likewise logs yet returns true. Return a structured outcome distinguishing unchanged, represented, refused, and stopped; refresh the existing adapter from current proof and dispose the superseded session.

7. **P2 — A dropped sibling remains marked lit and misses later automatic lighting.**

   **MEASURED:** N:2419 drops the provider and removes `siblingFaces`, sessions, and bases keepers, but never deletes `siblingOrdinals[group]`. N:3663 feeds those retained ordinals into `unlitServedFaces`; `joined-face-auth.ts:28` excludes every ordinal in that set. The separate reconciliation road N:3626 does delete the ordinal, showing two cleanup definitions already drifting.

   **REASONED:** B lights, `lock --face B` drops it, then a pūlama later serves B again -> the open watcher sees B in the retained lit set and skips it -> B's session meets `no provider for face` until an explicit light or recomposition. Consolidate per-face removal; derive the lit ordinal set from the same entries that own the providers/sessions.

8. **P2 — Detached sibling mint failures escape and prevent retry.**

   **MEASURED:** N:2308 inserts a sibling cell into the map, then :2309 invokes `void cell.stand(worn)` without a rejection handler. The mint awaits place reading and custody-backed signing at N:2268–2290, either of which can throw. `place-session-cell.ts:66` propagates mint errors. The map entry remains, and N:2299 returns immediately for every later attempt to stand that group.

   **REASONED:** A sibling begins lighting, then its atom row locks before certificate signing -> the mint rejects as an unhandled promise; under Node's normal unhandled-rejection behavior this can terminate the vessel. If the host survives, later lighting never retries that empty cell. Await the mint or catch it, remove only the failed generation, and make retry explicit. A refusal must leave neither an apparently standing cell nor an unhandled rejection.

9. **P2 — Late sibling work can resurrect state after drop; bases keepers lack teardown ownership.**

   **MEASURED:** N:3631 awaits proof and island lighting before calling `litSibling`, without checking whether a drop/teardown overtook it. N:3608 starts detached canon/label/keeper work; :3616 installs a keeper after awaits without checking that the group still stands. Drop stops only the keeper present at N:2436. The teardown list never stops `faceBasesKeeper` or all `siblingBasesKeepers`. `face-labels.ts:165` retains document listeners and schedules sidecar writes until `stop()`.

   **REASONED:** Light B; pause the detached task at `readControlDoc`/petname lookup; drop B or tear down the composition; let it resolve -> it installs a fresh keeper after cleanup, retaining old handles and permitting later sidecar writes. An automatic light already in flight can similarly re-add a dropped sibling. Use a per-face generation token, recheck after awaits, and register every keeper/flight with teardown. Custody-frame serialization alone does not cover the open watcher or detached tasks.

**Evergreen / one-name findings.** MEASURED narration survives at N:282 ("exactly as before"), N:1611 (historical measured pointer failure), N:1645–1700 (the former board split and staged repairs), N:3007 ("exactly as before"), and N:5144 ("same 404 as before"). `custody-frames.ts:305` explicitly describes an `--all --face N` shim and falls back to another open face. REASONED: that combination can wear h0 when hN stayed shut; whether to remove that supported combination requires an operator decision. These rank P3 below the runtime defects. I found no additional proven old-shape reader in the inspected paths; ordinary null/floor handling alone does not establish a compatibility breach.

**Known defects kept separate.** The dial-pin session anchor and descent on failed dial remain visible at N:2247–2346/:3340 and `uds-session-door.ts:100`; treat them as supplied findings, not new discoveries. The refused worn-face switch/`WorkingLayerAttachRefusal` remains assigned elsewhere (`custody-frames.ts:335–346`; `operator-daemon-behavior.ts:590–640`); I did not chase its repair. The repaired register omission and meshpalace address supplied pattern evidence only.

**Splitting seams, in priority order.**

- **Session ownership and dial lifecycle:** N:2170–2377 and :3240–3386. One component should own pin, presentation, session table, signer, refresh, cancellation, and close. Their separate cells currently permit frozen refresh and incomplete revocation.
- **Lit-face lifecycle:** N:2419–2441 and :3406–3669. Own proof, provider admission, ordinals, place session, catalog view, canon, and bases keeper as one disposable face entry. Share one removal operation.
- **Composition shutdown:** N:589–598, :1538–1551, :2563–2607, :5059–5075, plus main's signal shutdown. Express producer drain → sealed flush → signer drop → island close → Repo close → claim release once, including failure handling.
- **Sealed-document classification:** N:919–1122 and :3525–3546, paired with B:754–842/:2129. Separate document identity/owner classification from store transport; share the classification with the browser. Bag membership must grow before first storage access.
- **Disk projection/watch assembly:** N:4543–4751. Own folder placement, watch startup, final ingestion, and keeper disposal together; those resources write and must participate in the shutdown protocol.
- **Provider-heavy verb adapters:** N:3885–4220. Move recall/capture/telemetry providers and their disposers behind a contribution factory; their process/cache ownership currently sits among security and boot sequencing closures.

->↺ Static traces complete; runtime confirmation remains deliberately unperformed.

<<~ oracle throw=`↯18 ✲ ⚂(3) ⁂:⟁☕ᚠ`>>
<<~ set lares=`yield` drift-ward=`Reproduce ranked interleavings in an isolated harness before treating reasoned outcomes as runtime measurements · ↻ L-Prime` ooda-ha=`closed 1↺` from=`lar:///vessel.audit.records` to=`?`>>
