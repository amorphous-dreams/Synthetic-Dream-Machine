# The next path ~ a scout's report

Lane `scout` (controller-handoff `#/the-cloud-lanes`), read on `feature/green-jello-dinosaur-5` at `f7f5fa0`, 2026-10-15. Read-only: this report changes no code. Every claim cites the file and line it rests on; a line marked *inferred* rests on a reading no command confirmed.

## 1 · W's remaining walk

### Step two, the live face-subject and join slice: what stands, what stays owed

- **The signed carriage stands, in a file the kit never names.** `nexus-contract.ts:281-285` commits the gate pin and canon list into the Nexus admit (`openAdmitCarriage` → `carriageCommit`); `held-nexus-root.ts:163-179` carries `carriageCommit` and `head`; `verifySignedAdmitBundle` refuses `admit-carries-no-pin`, `opening-differs` and `pin-differs` (`held-nexus-root.ts:220-222`). Merge `f0bc13f` landed it.
- **Two gaps remain in it.** `lararium-node/src/commands/device-admit.ts:350-357` still carries `hearthGatePubKey` and `hearthCanonDocs` *beside* the signed payload. And every signed pin names the **vessel key**: `nexus-contract.ts:259` (`loadVesselVerifyingKey()`) and `device-admit.ts:353`. W1's per-Nexus wire key has no carriage yet, so the pin moves again at the cutover. That move changes signed admit bytes, so it lands before the fence.
- **`supplySessionFace` already answers a re-issued face.** `REISSUED_FACE_OPENS_LOCAL_SESSION` runs as a plain test and reads green (`lararium-mesh/tests/session-face-reissue.test.ts:31`; commit `33a6362`). The handoff's "repair after it reads red first" (`controller-handoff.mem:98`) reads stale. The function still has no production caller: `face-gate.ts:70` imports its types alone.
- **The removal guard stands in the shore.** `revokeGroupSeat` re-reads the seat after a fault, so a throw after mutation still delivers its roll (commit `57583b6`); `seat-duty-executor.ts:88` awaits it bare and relies on that. The kit's "prove before a removal caller uses `runSeatDuties`" reads closed.
- **Owed, with no production caller anywhere:**
  - `openSignedSession` (`session-signer.ts:221`); `face-dial.ts:46` imports its type alone.
  - `openJoinedFaceSession`, asked by the gated red `JOINED_VESSEL_CERTIFIES_OWN_KEY` (`session-face-reissue.test.ts:9,51`; `unbuilt-laws.test.ts:463`); no source defines it.
  - The vessel face-key certificate: `issueCertificate` and `requestCertificate` stand pure (`face-authority.ts:273,294`), and `storeVesselFaceKey` stands as a custody row (`face-key-custody.ts:229`).
  - The add-a-face grant: only Keyhive's `FaceGrantRecord` sign and verify stand (`face-grant-record.ts:36-80`).
  - **The fleet-join door**: no `fleetJoin` lives under `packages/*/src`.
- **The old join doors still stand**, and the fleet-join door retires them all:
  - `lares-cli/src/commands/device-admit.ts:58` (prints `#admit=`)
  - `lararium-node/src/commands/device-admit.ts`
  - `persona-admit-cmd.ts`
  - `cabal-join.ts`
  - the `LAR_JOIN_GATE` / `LAR_JOIN_SYNC` boot path (`open-node-vessel.ts:1197,1317-1318`)
  - the bare-token reader (`admit-carriage.ts:86-87`)

### The socket cutover, file by file against the kit's `#/cutover`

Every file the kit names exists.

| File | What production does there today | What the cutover owes |
|---|---|---|
| `lararium-node/src/open-node-vessel.ts` | `new DaemonAuthGate` `:638`, armed with the vessel key `:2680-2682`; sorter `:1151`; upgrade `:2709-2716`; Nexus dial `:1848`; relay `:1266`; sibling `:2099`; oracle pull `:2988` | Stand one bundle per (tier, Nexus, route) through `charterHomeFor`; arm `makeFaceGate`; build the (hearth, Nexus) pair index |
| `lararium-browser/src/open-browser-vessel.ts` | `new LarWSClientAdapter` `:798` with a ContactCard leaf `:791`; `standSiblingChannel` `:1285`; `pullAndVerifyOracle` `:1680` | Dial through `dialFaceGate` on the browser envelope; open the browser's `openSignedSession` holder |
| `lararium-mesh/src/lar-ws-client-adapter.ts` | `runPeerHandshake` `:232`, ContactCard `:220` | Swap to `dialFaceGate`, with frame one only after open |
| `lararium-node/src/daemon-auth-gate.ts` | Sends `mkLarChallenge` `:265`; verifies the ContactCard `:284`; hands `vesselKey` to the sorter `:292` | Give way to the face gate and the knock dispatcher |
| `lararium-mesh/src/auth-wire.ts` | Old-wire exports `:242-727`, barrel `index.ts:242-250` | Retire from production; vectors alone keep it |
| `lararium-node/src/socket-sorter.ts` | Decides on `vesselKey` (`:121,178,199,210`); its refusal log prints 12 characters of the key (`:171`) | Decide on the proven face or place key; drop the key from the log |
| `lararium-mesh/src/sibling-channel.ts` | `dialSiblingHerm` `:205` → `runPeerHandshake` `:244`, card = device key | Convert on per-dial transport keys (W9), or shut by name |
| `lararium-mesh/src/oracle-read-client.ts` | `isLarChallengeMsg` `:161`; `runPeerHandshake` `:166` | Convert, or shut by name |
| `lararium-node/src/authenticated-membership-relay.ts` | Gate `:136-146`; `proofOnlyShore` `:99`; client `runPeerHandshake` `:376` | Convert the gate side and the dial side |
| `lararium-mesh/tests/gate-dial-fixture.ts` | `runPeerHandshake` / `mkLarChallenge` `:18,69` | Hand back opaque admitted sockets |
| `lararium-node/tests/gate-dial-fixture.ts` | `DaemonAuthGate` `:16,45` | The same |
| Upgrade route | `http-face-dispatcher.ts:79` `registerUpgrade`; no subprotocol selection | Select `lar-gate` alone (`gate-exchange.ts:123`) |
| `gate-bundle.ts` | `deriveGateBundle` `:307` uncalled; `GATE_SIGNING_PURPOSES` holds the verdict alone `:199`; nothing calls `vesselFloorKeyDoor` or `custodyGateDoor` | The composer; the floor-announcement purpose and its reader |
| `gate-exchange.ts`, `face-gate.ts`, `face-dial.ts`, `noise-ik.ts`, `session-signer.ts`, `face-proof-subjects.ts`, `face-authority.ts` | Reached only by each other and by tests | Their production callers |

### Every production old-wire site still standing

| file:line | Function | Route | Act |
|---|---|---|---|
| `lar-ws-client-adapter.ts:232` | `#runHandshake` → `runPeerHandshake` | ws adapter (node relay `nexus-client-dial.ts:142`, browser `:798`) | convert |
| `oracle-read-client.ts:161,166` | `pullOverChannel` | oracle reader (`carriage-caps.ts:314`, browser `:1680`) | convert or shut |
| `sibling-channel.ts:244` | `dialSiblingHerm` | sibling dial | convert (W9) or shut |
| `authenticated-membership-relay.ts:376` | `AuthenticatedWSMembershipChannel.connect` | membership relay, dial side | convert or shut |
| `authenticated-membership-relay.ts:99,136-146` | `proofOnlyShore`, gate | membership relay, gate side (`carriage-serve-loop.ts:167`, `carriage-relay.ts:103`) | convert |
| `daemon-auth-gate.ts:265,284,292` | attach sends `lar:challenge`; ContactCard verify; `vesselKey` | the `/ws`, `/oracle` and relay gate | replace |
| `open-node-vessel.ts:638,2680` | gate armed with the vessel key | `/ws` | convert |
| `oracle-read-face.ts:141-146` (`main.ts:763`) | `mountOracleReadFace`, a third `DaemonAuthGate` | oracle gate | convert or shut |
| `socket-sorter.ts:121,178,199,205,210` | `verifyLeafProof`; decisions on `vesselKey` | sorter | convert |
| `nexus-carriage.ts:234-236` | `leafReadingFor` → `verifyLeafProof` on `vesselKey` | sorter path | convert |
| `lararium-keyhive/.../operator-daemon-behavior.ts:1099` | V3 `verifyAuthProof` | worker shore behind the gate | retire |
| `device-admit.ts:353`; `nexus-contract.ts:259,284` | gate pin = vessel key | admit carriage | repin to the wire key |

The kit's `#/cutover` list misses six of these: `nexus-client-dial.ts`, `oracle-read-face.ts` with `main.ts`, `carriage-caps.ts`, `carriage-serve-loop.ts` with `carriage-relay.ts`, `nexus-carriage.ts` and `operator-daemon-behavior.ts`.

### The order that lands it as one assembled commit

1. **Funnel first.** Rewrite both `gate-dial-fixture.ts` helpers on `dialFaceGate` / `makeFaceGate`. About 26 suites import them, among them `nexus-client-dial`, `walker-sort`, `hosted-walker` and `nexus-carriage`; they move with the helpers.
2. **Narrow builder patches, each against its fixed contract:**
   - the `gate-bundle` composer, with the announcement purpose and its reader;
   - the sorter keyed on face or place;
   - the dispatcher's `lar-gate` selection and knock;
   - the face-gate arming in `open-node-vessel.ts` and `oracle-read-face.ts`;
   - the relay's gate and dial;
   - the adapter onto `face-dial`;
   - the oracle client;
   - the sibling dial, or its explicit shut;
   - the browser vessel.
3. **Retire the old wire:**
   - `DaemonAuthGate`, the `auth-wire` production exports and Keyhive's V3 verify;
   - the old-wire vector suites `gate-dial-funnel.test.ts:34-42` lists (`auth-proof`, `auth-proof-domain`, `auth-wire-no-clock`, `presented-leaf-proof`, `ed25519-door-families`, `socket-sort`, `daemon-auth-gate`, `v3-proof-crux`, `p1-authority-audit`).

   Then unskip `NO_OLD_WIRE_PRODUCTION_CALLER` (`gate-cutover-reach.test.ts:24`). Register `.train-w-built-image.test.ts` with its driver.
4. **The lander proves in the kit's `#/cutover` order:** pure vectors → two-root custody and a real `openSignedSession` → node↔node first flight → browser↔hearth through the terminator → frame one exactly once after open → withdrawal memory across restart → tier pins refuse crossing → two faces, two Nexuses, two hearths → no old wire on any enabled route.

**Before the cutover, widen its witness.** `gate-cutover-reach.test.ts:10-16` enumerates five files, and its regex (`:21,25`) matches only `runPeerHandshake(` and `mkLarChallenge(`. It never sees `new DaemonAuthGate` (three sites), `verifyLeafProof` or `verifyAuthProof`. A green unskip today would not prove the old wire gone. The smallest cure derives the inventory from the source rather than listing it: every non-test file under `packages/*/src` that names any of those five symbols.

### Its red window

- **The suites the kit's `#/done` names, all present:**
  - `lararium-mesh/tests/gate-dial-funnel.test.ts`
  - `lararium-node/tests/live-wire-node-crossing.test.ts`
  - `lararium-node/tests/browser-crossing.test.ts`
  - `lararium-node/tests/nexus-client-dial.test.ts`
  - `lararium-browser/tests/wire-hearth-crossing.test.ts`
  - `lararium-node/tests/authenticated-membership-relay.test.ts`
  - `lararium-node/tests/sibling-herm-relay.test.ts`
- **Suites the window also reaches:**
  - `lararium-node/tests/lar-ws-client-adapter.test.ts`
  - `oracle-read-client.test.ts`
  - `oracle-closed-door.test.ts`
  - `tests/e2e/hosted-walk.test.ts`
  - `lararium-node/tests/e2e/persona-ring-cross-operator-admit.test.ts`
- **E2E shard sets** (`tools/e2e-shards.mjs:66-69`): `tests`, with 4 shards over `tests/e2e/*.test.ts`, and `node`, with 1 shard.
- **Held-out drivers** (`tools/held-out-cells.mjs:44-48`): `crossing` and `herm-mesh`. The probes `probes/crossing-client.ts:66`, `crossing-daemon.ts:101` and `swarm-present.ts` speak the old wire too, so they move in the same commit.
- **Mesh-scenario cells** (`tools/mesh-scenarios.sh:50-69`): quorum, relation, leaf, open, crossing, nexus, realm-crossing and meme.

### Two more surprises

- **W8 builds the announcement from nothing.** No floor-announcement code exists to "move under the wire key" (`gate-bundle.ts:199`).
- **W7's pair index has no ground yet.** A single `joinSyncUrl` / `joinGatePubKey` drives the one dial (`open-node-vessel.ts:1317-1318`; *inferred* from that read).

## 2 · The two sensorium reds on the base

### `CollectionNameMismatchError: collection 'form'`, job `test` (`ci.yml:190-191`)

**Root cause.** Commit `02bdfa6` moved `mempalace` from `25cb792` to upstream `develop` at `d9bf01e`.

- At that sha, `mempalace/palace/collection.py:331-334` gates `get_collection` on three names: the configured drawers, `mempalace_closets` and `mempalace_assets` (`_allowed_wrapper_collection_names`, `:220-236`). Every other name raises the error (`:240`).
- The same signature carries a deliberate door for a known second store, `_skip_name_check: bool = False` (`:287`, documented at `:320-325`).
- The sensorium's form store opens a collection named `form` at three sites. All three skip the identity check, and none skips the name check:
  - `lararium-sensorium/scripts/form_encoder.py:764-766`, the writer, with `create=True`;
  - `loci_io.py:186`, the reader, which swallows the error at `:187-189` and degrades to 0 rows;
  - `content_io.py:124`, when `--collection form` reaches it.
- The upstream lines rest on a scratch clone of `d9bf01e`, since removed. The submodule stands uninitialised here, and the suite did not run; the failing tests read as *inferred*: every store test through the `store` fixture at `test_form_encoder.py:436-438`.

**Smallest pono cure.** Pass `_skip_name_check=True` at those three call sites, and at `content_io.py:124` only on its named-collection branch. That door matches what upstream offers for a deliberate second store, and `form_encoder.py:717-727` already names `form` as one. Widen the fake `get_collection` at `test_loci.py:36` to take `**kw`.

The cure leaves several things alone:

- It never edits the submodule and never wraps the library in a shim.
- It never renames `form` onto `mempalace_closets`. That rename would mix two stores and collide with the dimension pin at `form_encoder.py:727-728`.
- It leaves the reader's silent degrade at `loci_io.py:187-189` in place. A wrong name there reads as "no form store yet"; a follow-up could narrow that catch to the store-absent case alone.

### `turn-parity-witness` reads live sigils in the fixture, job `witnesses` (`ci.yml:225` onward)

**Root cause.**

- `tools/turn-parity.mjs:158-162` collects carriers with `grep -rl '<<~ lares aim'`.
- Line `:166` then filters out `/\.(pyc|json)$/`. The author already meant to skip JSON carriers, whose sigils sit inside escaped string literals.
- The frozen transcript `lararium-sensorium/fixtures/claude-week-2026-10-07/sources/claude/7bdba225-….jsonl` (commit `bfbde92`) holds 67 `<<~ lares aim` spans. Since `$` anchors after `json`, `.jsonl` slips the filter.
- Its escaped turns fall outside the named divergence classes and land in `unclassified`, which reads red (`:427-428`). The unclassified count reads as *inferred*, since the witness did not run.

**Smallest pono cure.** Widen the filter at `turn-parity.mjs:166` to `/\.(pyc|jsonl?)$/`. That one regex extends a skip the author already made, and it keys on format, not location, so real `.mem` fixtures elsewhere stay scanned. The fixture's bytes stay frozen: its manifest pins sha-256 values over "original frozen Claude JSONL bytes, no transcript rewriting". The header counts at `turn-parity.mjs:68` (87 turns, 44 carriers) describe and assert nothing; they drift after the cure.

Both cures touch the Sensorium and a tools witness. Neither touches W's or N's ground, so a side hand may land them beside any lane.

## 3 · The next lanes after W, ranked by what inherits shape from what

The free slot opened when lane `nexus` merged (`cb653cc`). Ranked by grounds before wins (`working-procedures#/grounds-before-wins`):

| Rank | Lane | Inherits from | Feeds | Can start |
|---|---|---|---|---|
| 1 | **N's remainder** (`N4`, `N2`, `N5`) | N's landed doors | X (`N5`), every later roll (`N4`) | Now, beside W, on N's ground |
| 2 | **H, pure, with H8** | N's AID (landed) | E's walker arm, H live, X | Its pure steps now, beside W; mesh `hosting.ts` alone |
| 3 | **O1** | W's verified sessions and both composers | S3, H live, X | After W's cutover; takes the compose seat |
| 4 | **E** | W's fleet-join door, H8, B1 | X | After W's cutover; E3 rides `gate-bundle.ts` |
| 5 | **Sealed-store step 3** | O1's face, signer and scoped view | X | After O1's live mount |
| 6 | **B** (`B1` browser custody first) | The seal's Keyhive step (landed); W's browser composer | E in a browser leaf, X, rung 4 | After W's cutover frees `open-browser-vessel.ts` |

**The next two lanes: N's remainder now, and H's pure steps with H8 now.** Both sit on ground disjoint from lane `wire`, and both carry signed or refusal shapes the fence wants early. After W's cutover lands, **O1** takes the compose seat. The solo chain (`stable-founding-road#/the-trains`) runs W → E → O1 → H → X. This report ranks O1 before E because three trains inherit O1's session shape, while E feeds X alone and still waits on H8 and B1: a house reading, which the controller may overturn.

### N's remainder: first three commits and gates

1. **`N4`, a roll waits on its prior anchor** (operator ruling 2026-10-15, `stable-founding-road.mem:210`). Today a second roll before an anchor lands leaves the first "unanchored for good", and only a comment warns of it (`nexus-contract.ts:581-590`); no refusal stands. First commit: red first, with the refusal by name at the roll's open in `seal-ceremony.ts` and the two-vault rotate, read off the carriage board's anchors (`rollAnchorsFromBoard`), with the single-vault rotate (which anchors inside itself) as the control.
2. **`N2`, which realms a two-vault anchor covers.** `runNexusRollAnchorOpen` anchors the carriage board alone; the realm edge boards stay owed across two vaults (`nexus-contract.ts:588-590`; `lares-cli/src/commands/nexus-anchor-cmd.ts:51` prints "their anchors stay owed"). Second commit: carry `runEdgeRollAnchors`' realm anchors through the same partial.
3. **`N5`, the dormant vault's catch-up** by re-import along one lineage, and its witness on the two-root e2e (`tests/e2e/two-roots*`, commit `e2df91d`).

Gates: `nexus-contract` and `seal-ceremony` suites, the typecheck witness, one shard push per burst (`tests` and `node` sets), and the `nexus` and `quorum` held-out cells.

### H, pure, with H8: first three commits and gates

1. **The act image.** Vectors for the operator-seat delegation, the hosting key's public identity, the act image and its three dials (`train-h-launch#/walk` step 1). Today `hosting.ts` signs a leaf and one cap (`unbuilt-laws.test.ts:534`).
2. **H8's signed grant.** It replaces the keyed POPRF tag (`hosting.ts:34-37`, "a KEYED tag, not a signature") with a signed grant and a public-half verifier. The red stands declared as `SERVING_CHECKS_WALKER_GRANT_WITH_PUBLIC_HALF` (`unbuilt-laws.test.ts:547`).
3. **The public-half derivation for serving rows**, inside the same re-cut, held pure until W hands over `socket-sorter.ts`.

Gates: mesh unit suites, the unbuilt-laws witness reading each declared red that greens, and the typecheck witness. The live cut (issuer, reader, `hosting-store.ts`, sorter) waits on W.

### O1: first three commits and gates

1. **PURE: the working address and the receipt.** The address image comes from N's identity lead (`train-o1-launch#/ground`). Its witness shows two offline vessels converging and each input diverging. The durability receipt carries `docUrl`, the stored heads and the boot epoch.
2. **LIVE: scoped surface mounts** from both composers through `mountSurface`. It unskips `PRODUCTION_SURFACES_USE_SCOPED_VIEW` (`unbuilt-laws.test.ts:522`).
3. **LIVE: node verbs, the watcher and the seat move to session scope.**

Gates: the browser walks (`tools/browser-ci.sh`), the e2e `tests` set and the held-out `leaf` and `open` cells. A failed attach refuses boot visibly.

### E: first three commits and gates

1. **The serving tier's rows under SK and SK's rotation** (`E2`). Today the class stands in `vault-carriers.ts:79` and the census, but no serving row seals under SK.
2. **`E3`, the serving gate's tier** in `gate-bundle.ts`: a third route tier, its own domain and pin.
3. **`E4`, the raise ledger's commit point and its lapse at the next causal boundary** (`vessel-raise.ts`, `custody-seat.ts`).

Gates: the custody census witness, the unbuilt-laws witness and the held-out `crossing` cell. The walker arm waits on H8.

### Sealed-store step 3: first three commits and gates

1. **PURE: sealed change and checkpoint vectors** under the step-1 format.
2. **PURE: the face decision** over every fetch, write, catalog lookup and content read.
3. **LIVE: the sealed Repo rest**, which unskips `FRESH_BASE_PRECEDES_FROM_NOW_CHANGE` (`unbuilt-laws.test.ts:529`).

Gates: a behavioural wrong-face witness at the production reader, a restart from sealed values, and the custody census.

### B: first three commits and gates

1. **`B1`**: a passphrase slot wraps the browser's device seed and Keyhive Archives, which rest in the clear today (`lararium-browser/src/browser-keyhive-archive.ts`).
2. **The confirm-door clear-password act.**
3. **The passkey slot**, only after its derivation gets measured, and never alone.

Gates: the browser walks. The device measures go by hand on the operator's tablet and phone.

## 4 · The critical path to two PCs and one Nexus

**C** marks what a cloud session can do. **O** marks what needs the operator's hands or machines.

1. **C** · W's step-two remainder: the fleet-join door, the face-key certificate, add-a-face, the old doors retired.
2. **C** · W's socket cutover, one assembled commit, after its widened reach witness (§1).
3. **C** · N's remainder (`N4`, `N2`, `N5`), beside 1–2.
4. **C** · H's pure act and H8, beside 1–3.
5. **C** · W's dials: one per (hearth, Nexus) (`W7`), the sibling at face scope (`W9`, `W12`), canon.
6. **C** · O1: sessions, working address, receipts, the switch.
7. **C** · H live: the signed-byte cut, the introduction and answer, the strangers' dial.
8. **C** · E: SK rows, the serving gate, the raise, the walker arm behind H8.
9. **C** · Sealed-store step 3.
10. **C** · B1, browser custody.
11. **C** · The rows before the fence that no train names yet:
    - `K13`, the sealed outbox;
    - `K14`, the restored face's provisional standing;
    - V's enrolled-set bundle and its restore as persona zero;
    - `S2`, the engine fold's live image proof.

    Each changes a shape at rest or in signed bytes, and the fence (`#/rulings`) wants it landed first. `K12` waits on its own name rule.
12. **C** · The last genesis re-bake, after the final bundle move. `genesis/unbaked.json` stands absent today (the tree holds `genesis/seed.json` and `cas/` alone), so no gap reads declared.
13. **C** · X's automated witness: two vessels from one image digest, files as the only courier.
14. **O** · The registrar key limited to the one domain, its API access switched on, and the two credential files placed. Then the first live issuance.
15. **O** · The router hands out the resolver's address; ports 53 and 443 stand free on the node's LAN interface.
16. **O** · The tablet and a phone in hand for `tools/capability-probe/`, before browser custody hardens (bears on 10).
17. **O** · One real-LAN discovery run.
18. **O** · The second machine, the daughter's, with docker and the image pulled by digest.
19. **O** · The hardware choice for an unattended ember raise. Without a hardware anchor, every raise asks a person's confirm (`#/rulings`, the ember's key at rest). The ceremony needs none, since reach on the day stays LAN only.
20. **O** · Push and sign the release index, after the last re-bake and the last wire change.
21. **O** · The fresh start by hand on both machines: old homes moved aside, never deleted.
22. **O** · The dress rehearsal with synthetic names, and four cold-key cards on paper.
23. **O** · **The ceremony (X)**, line by line. The second seat at the founding ends the alpha line.

## 5 · Risks and unknowns, each with the one check that settles it

| Risk or unknown | The check that settles it |
|---|---|
| The cutover's reach witness reads green while old wire stands (§1) | Widen `gate-cutover-reach.test.ts` to every `packages/*/src` file naming `runPeerHandshake`, `mkLarChallenge`, `DaemonAuthGate`, `verifyLeafProof` or `verifyAuthProof`; run it with `LAR_UNBUILT_REDS=1` and expect it to name today's sites |
| The admit pin names the vessel key, so signed admit bytes move twice | Read whether the cutover's commit repins `nexus-contract.ts:259` and `device-admit.ts:353` to the W1 bundle key; the admit suites must move in that same commit |
| Keyhive 0.3.0-alpha.1 carries no face chain (`W11`) | Run `lararium-keyhive/tests/face-chain-substrate.probe.test.ts`; its four alarms must read as they stand |
| The engine fold's live proof stays unproven on the rebuilt image (`S2`) | One shard push on the rebuilt image, read by `node tools/ci-verdict.mjs --head <sha>` with held-out read, not unread |
| O1's working-address bytes need an identity input contract no carrier fixes yet | Grep N's kit and `face-proof.mem` for the address input encoding; absent, the operator rules it before O1's first byte (`train-o1-launch#/rulings`) |
| Kit lines read stale against the rulings | `train-s3-launch.mem:42,80` sends the re-seal question to `#/open`, yet `#/rulings` settled it (2026-10-14: "the format lands with sealed-store step three"). `train-w-launch.mem:95` holds the Offering Antigen scope and fork resolution "with the operator", yet both stand ruled and the scope landed (`a50bfa2`). `controller-handoff.mem:98` asks a red the tree already greened. One canon true-up by the controller settles all three |
| Ports 53, 443 and multicast stand unmeasured on the operator's machine | `ss -lntup` for 53 and 443 on the node's LAN interface, plus one real-LAN discovery run |
| Phone and tablet capabilities stay assumed | One `tools/capability-probe/` run on each device |
| The second machine's readiness stays unknown | `docker image inspect` on the second machine shows the image digest the release manifest names |
| A mis-copied cold-key card freezes a two-seat Nexus at its first roll | `lares nexus seal cold rehearse` at the dress rehearsal, with every card read back |
| The form reader hides the next mempalace break as 0 rows (`loci_io.py:187-189`) | After the cure, a test that opens `form` against the real library with no fake and expects rows |

## Canon and changelog lines for the controller

The scout edits neither the roadmap nor `CHANGELOG.md`; these lines go to the controller:

- **`controller-handoff.mem:98`**: drop "repair `supplySessionFace` after `REISSUED_FACE_OPENS_LOCAL_SESSION` reads red first". The test reads green (`33a6362`), and the session-open callers stay owed.
- **`train-w-launch#/cutover`**: add the six production files §1 names, and the third `DaemonAuthGate` in `oracle-read-face.ts`.
- **`train-w-launch#/walk` step 2**:
  - the signed carriage stands in `nexus-contract.ts`; `device-admit.ts:352-357` still carries the fields beside its payload;
  - the removal guard stands closed (`57583b6`);
  - W8 builds the announcement rather than moving one.
- **`train-w-launch#/done`, its last line**: the Offering Antigen scope and fork resolution stand ruled (`#/rulings`).
- **`train-s3-launch` `:42` and `:80`**: the re-seal proof stands ruled; its format lands with step 3.
- **The changelog** owes nothing from this lane: a scout lands no act a person can do.
