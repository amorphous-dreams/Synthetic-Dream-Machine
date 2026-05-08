# Session State — Lararium Web3 Refactor

> Updated: 2026-05-07
> Branch: feature/lararium-node-3
> Purpose: Resume artifact — enough state to continue without prior chat context

---

## What Just Happened (2026-05-07 — S5.6 Admin VM Lift complete)

Five-step sub-arc closed (A.1 → A.5):

**A.1 `9461d7ca`** — `seedAdminDoc()` in `genesis-island.ts`; `reconcileWellKnownTiddlers` extended with optional `adminUrl`. AdminDoc reuses `MemeStoreDoc` shape — semantic distinction lives in URI/bag identity (`lar:///ha.ka.ba/@lararium/@admin`).

**A.2 `23047176`** — `init-lararium.ts` seeds admin doc alongside identities/circles/sessions; admin oracle lands in `genesis/social-bootstrap.json`.

**A.3 `aac30c23`** — Standalone `open-admin-vm.ts` module: own TW5Engine, own CompositeStore with admin doc as writable layer, own MemeSyncAdaptor targeting `ADMIN_BAG_ID`. `waitHandleLocal` extracted to `repo-helpers.ts` for sharing with the room VM.

**A.4 `6a7372e3`** — `openNodeLarPeer` mounts admin VM in parallel with the room VM; admin URL flows through `reconcileWellKnownTiddlers`; `NodeLarPeerResult.admin` exposes the admin VM. `init-lararium.ts` calls `repo.flush()` before exit (caught a flush race during smoke test).

**A.5 `5b4a379d`** — `main.ts` reads bag-mirror configs from admin-room tiddlers tagged `$:/tags/LarariumBagMirror`, falling back to programmatic defaults. Operators can edit mirror configs from inside the wiki.

**Smoke test result**: `rm -rf .lararium && lararium:init && main.ts` reaches `live` phase. Both VMs boot, admin URL displayed, falls back to 3 programmatic mirrors when admin doc lacks bag-mirror tiddlers.

**Bug caught and fixed**: `genesis/social-bootstrap.json` accidentally tracked in `6a7372e3` — now gitignored (`1916ab7f`).

S5.7 closure work: Loop 1 `2d365b3f` cleaned 8 orphans (5 deleted, 2 repointed) and fixed multi-source detection in heleuma audit.

### Next:

**S5.8 promotion ceremony** — wiki widget + CLI; operates on the admin VM substrate just landed. The promotion handler will write to the admin doc's session-event-log to record operator decisions.

**S7.1 device delegations** — `cap=infrastructure` proofs go in admin doc; init-lararium ceremony writes the node's own device delegation as part of operator identity.

**Heleuma stub authoring** — 48 missing memes to scaffold + author content for. Defer to a separate "documentation pass" branch.

---

## What Just Happened (2026-05-07 — chapel-perilous-opens deleted)

`packages/lares-chapel-perilous-opens` removed: the empty stub for "unstable three-segment tuple-root URIs not yet stabilized" was superseded by the bag-mirror system. Unstable URIs without an `@-scope` now resolve as `caps-virtual` (no on-disk path). To gain a writable disk surface, an URI must promote into `@lares` or `@lararium` scope, or register a custom bag mirror via the admin room (S5.6+).

Cleanup spans:
- `packages/lares-chapel-perilous-opens/` directory deleted
- `chapelRelPath` removed from `LarResolution` interface
- `CHAPEL_MEMES_ROOT` removed from `@lararium/node` exports
- Workspace dep `@lares/chapel-perilous-opens` removed from `lararium-node/package.json`
- Resolver branches that produced `chapelRelPath` now return virtual

---

## What Just Happened (2026-05-07 — S5.7 Heleuma Coverage + Bag Mirror Reset)

### Three commits closing the canon-promotion arc

**1. Genesis discovery generalized** ([60bbc9ca](lararium-node/scripts/build-genesis-island.ts))
`build-genesis-island.ts` walks every `packages/*/memes/` directory, not just the two hardcoded roots. Lares plugin tiddler count rose to 259 from 429 walked files. `lararium-core/memes/ast.md` and any future per-package self-describing meme now reaches the engine corpus.

**2. Bag-aware disk projector** ([e6152123](lararium-node/src/disk-projector.ts))
Fixed the canon leak: prior projector wrote any URI-with-laresRelPath to `packages/lares/memes/` regardless of bag, so wiki edits violated canon-promotion law automatically. New `BagMirrorConfig` shape: each bag opts into a filesystem mirror via `{ bagId, mirrorRoot, toRelPath }`. Three standard strategies in `@lararium/core/bag-mirror.ts`:
- `laresPathStrategy` — lares carriers
- `enginePathStrategy` — engine corpus, per-package
- `roomShadowPathStrategy` — preserves canonical structure under `rooms/{slug}/`

Room edits land in `rooms/{slug}/...` (gitignored). Promotion ceremony (S5.8) moves a tiddler between bags; the disk side effect is a file move from `rooms/` to `packages/`. The git diff IS the operator's signature on canon.

Mirror configs are programmatic in `main.ts` for now; S5.6 admin VM moves them to admin-room tiddlers tagged `$:/tags/LarariumBagMirror`.

**3. Heleuma generator + audit** ([07e4a1ad](../scripts/heleuma.ts))
`pnpm heleuma` audits every load-bearing source file for a self-describing meme; `pnpm heleuma:write` scaffolds missing memes and fixes iam-block drift. Idempotent.

Filter: source needs heleuma if (in `index.ts` re-exports) OR `// @heleuma:required`, NOT `// @heleuma:exempt`.

Initial audit: 50 missing across core/tw5/node, 8 orphans in tw5 (memes pointing to deleted dreamdeck-tldraw / old core sources). Operator decides which to scaffold and how to handle orphans.

### Architecture clarifications

- **`packages/ha-ka-ba/` doesn't exist as a directory**, by design. `ha.ka.ba` names a URI namespace (engine = ha, catalog = ka, lares = ba); each package owns the memes describing itself, the engine corpus is their *virtual union* materialized in `genesis/island.bin`.
- **Per-bag mirror, not per-package mirror**: disk layout reflects bag boundaries (lares → `packages/lares/memes/`, engine → per-package `memes/`, room → `rooms/{slug}/`); operator-private bags (identities/groups/sessions/admin) never reach disk.

---

## What Just Happened (2026-05-07 — Projection Registry + Admin URI Constants)

### Projections become declarative system plugins

Refactored hard-coded `LarDiskProjector.start()` in `main.ts` into a `LarProjectionRegistry` API. Factories (kinds) own attachment style — `LarDiskProjector` keeps `store.subscribe`, future `MemeProjection`-style kinds use `peer.addProjection`. Registry holds lifecycle only.

Browser peers reuse the same registry shape; only the registered kinds differ.

**New in `@lararium/core`:**
- `LarProjectionConfig`, `LarProjectionKind`, `LarProjectionRegistry`
- `LARARIUM_PROJECTION_TAG = "$:/tags/LarariumProjection"` (TW5 camelCase)
- `ADMIN_ROOM_SLUG`, `ADMIN_ROOM_URI`, `ADMIN_BAG_ID` constants

**Admin URI split (2026-05-07):**
- Room URI (logical, in /rooms/ namespace): `lar:///ha.ka.ba/@lararium/rooms/admin`
- Bag URI (Automerge doc, @-scope sibling to @identities/@circles/@sessions): `lar:///ha.ka.ba/@lararium/@admin`

The two-URI split mirrors the bag-as-doc invariant: each Automerge doc gets its own sync boundary. Admin federation is device-scoped, not room-scoped — operator's other devices reach admin via `cap=infrastructure` device delegations (S7.1) gated at the ingress trust check (S7.4). Room peers can never prove the cap, so admin state stays operator-private without special plumbing.

**New in `@lararium/node`:**
- `makeDiskProjectionKind({ defaultLaresRoot, renderFn, ... })` — TW5-engine-bound disk kind builder

**Deferred:** Reaction kind registration (pre-existing missing `ReactionEngine` export from `@lararium/core` — implementation task, not a refactor concern).

### Content-equality guard + revision retirement

`AutomergeDocStore.put()` now compares incoming record field-by-field against the in-memory tiddler. Identical → returns early before `handle.change()`. Kills the file-watcher echo loop and prevents Automerge changeset churn.

Removed `MemeSyncAdaptor._revisions` map and all `Date.now()` revision strings. TW5 syncer API surface kept (`getTiddlerInfo`/`getTiddlerRevision`/`getSkinnyTiddlers` return constant `"0"`). `buildDirectRecord` signature trimmed to drop `revision`.

### Next: admin VM lift

Step 2 of the plan — stand up an admin TW5 VM in the node peer. Genesis-island oracle entry for `ADMIN_BAG_ID`, new `open-admin-vm.ts`, `createNodeSession` re-pointed sessions doc → admin doc, `init-lararium.ts` seeds admin doc alongside the others.

---

## Bootstrap Paste

```text
Resume from /home/joshu/Synthetic-Dream-Machine/SESSION.md.
Branch: feature/lararium-node-3.
Active sprint: S5.5 — Genesis Bootstrap Causal Correction. Extract social Tiga seeding + ceremony from `openNodeLarPeer` into `lararium:init` CLI. S7.1 follows, targeting the init script callsite.
Architecture laws in memory: feedback_architecture_principles.md.
Do not re-decide the five architecture laws or the BOOTSTRAP_SCANS / Path α grammar decision.
Sprints 0–5 complete. Social tiga renamed Groups→Circles. Packaging model: CJS (not IIFE). Kowloon bridge design locked (Option B) — see ROADMAP.md § S8.
Grammar now lives at api/v0.1/pono/memetic-wikitext (not grammars/). grammars/ tree deleted.
Voice-house consolidated: lares/voices.md parents lares/masks/** (all masks moved from masks/).
lararium-app + lararium-tldraw + lararium-web DELETED. Replaced with: lararium-browser, dreamdeck-tldraw, dreamdeck-app (see ROADMAP.md § Package Reboot).
New package namespaces: @lararium/* = infra/protocol; @dreamdeck/* = first app stack on DreamNet.
Research: packages/lares/lararium-research/DREAMNET-FEDERATION-RESEARCH.md (2026-05-06).
Research docs: packages/lares/lararium-research/PROTOCOL-STACK-IDENTITY-CIRCLES-SESSIONS.md
```

---

## What Just Happened (2026-05-06 — S5.5 Architectural Decision: Genesis Causal Correction)

### Genesis lives outside the server start (web3 causal-islands)

Identified that `openNodeLarPeer` seeds IdentitiesDoc, CirclesDoc, SessionsDoc, and runs
`buildCeremonyTiddlers` on first boot (`socialPlaneIsNew` branch). This violates the
causal-island principle: a server that seeds its own social graph on first run reaches
outside its authority boundary. Server authority covers relaying; admin authority covers
authoring.

**Three causal moments — now strictly separated:**

```
Build time   scripts/build-genesis-island.ts     content Tiga → genesis/island.bin  ✓ (S2)
Init time    scripts/init-lararium.ts (NEW S5.5)  social Tiga + identity ceremony
Runtime      openNodeLarPeer (simplified S5.5)    find + wire; never seed
```

**What moves OUT of `openNodeLarPeer`:**
- `socialPlaneIsNew` flag + entire seeding branch
- `seedIdentitiesDoc`, `seedCirclesDoc`, `seedSessionsDoc`, `seedLaresDoc` calls
- `buildCeremonyTiddlers` call
- `operatorIdentity` option on `NodeLarPeerOptions`

**What `init-lararium.ts` does:**
Creates social Tiga docs, runs ceremony, writes `genesis/social-bootstrap.json` as a
**TW5 tiddler bundle** — a JSON array of tiddler objects mirroring the oracle tiddler shape
(`title` / `text` / `fields` / `bag` / `authority`). Each entry carries an AutomergeUrl in
`text` and `fields.kind = "social-bootstrap"`. TW5 VM queries it directly with
`[field[kind]exact[social-bootstrap]]` — no special loader needed. `openNodeLarPeer` writes
the oracle tiddlers into the island doc on first boot and extracts AutomergeUrls from the
`text` fields. Optionally runs `lararium:pack` to produce a nexus connect bundle
(genesis CID + catalog URL + invite token) for browser peer cold-boot.
The admin runs this once, deliberately, before first server launch.

**Node peer identity decided (2026-05-06):**
- `IdentityTiddler.kind` gains `"node"` as a fifth kind
- `DeviceDelegationTiddler.cap` scopes the grant: `"infrastructure" | "social" | "relay" | "full"`
- Node peer: `cap: "infrastructure"` — sync, seed, oracle-sign, session management; no social signing
- Browser peer: `cap: "social"` — content signing, circle management, invites
- Relay peer (future): `cap: "relay"` — transport only; no Repo deserialization
- Ceremony writes the node's delegation in `init-lararium.ts`, not at server start

**Impact on S7.1:** `buildDeviceDelegation` + ceremony callsite moves to `init-lararium.ts`.

---

## What Just Happened (2026-05-06 — S7 Redesign: Hostile Multi-Nexus Capability Model)

### jzellis/kowloon Source Audit (research spirit)

Audited `jzellis/kowloon` source (Node.js/MongoDB, AGPL-3.0, active as of 2026-05-06).
Key findings confirming and extending our existing design credit:

**Confirmed from source:**
- `shouldFederate.js`: `Follow`, `Unfollow`, `Block`, `Mute`, all Circle operations are
  `privateOperations` — never federated. Following = read-side, local-only circle add.
- `filter.js` / `context.js`: visibility check = MongoDB `$or` over all circles the viewer
  appears in. Membership IS the capability grant. No remote server query at check time.
- Three addressing slots per object: `to`, `canReply`, `canReact` — distinct capability grants.
- Circle integrity: signed over `id|name|to|sortedMemberList` by owner's RSA-2048 key.
- Block/Mute = local circles; inbound activities checked against `blocked` circle before processing.

**What Ellis cannot do (DreamNet gap):**
- Identity = server-scoped (`@user@domain`). No keypair-rooted identity, no DID, no key rotation protocol.
- No capability delegation across server boundaries.
- No hostile server threat model — block is actor-level only.
- No E2E encryption, no CRDT, no offline/local-first operation.
- No content addressing — IDs are mutable domain strings.

### S7 Redesign: Five Identity Planes + Three-Tier Authority

Full design doc: `packages/lares/lararium-research/S7-CIRCLES-IDENTITIES-REDESIGN.md`

**Five identity planes (Plane 0: Device → Plane 4: DreamNet):**
No central authority at Plane 4; trust emerges from Nexus treaty events only.

**Three-tier authority separation:**
- Tier 1 (local CRDT): `CirclesDoc` membership checked via TW5 filter; no crypto needed
- Tier 2 (Nexus CRDT): Keyhive Group replicates to all Nexus peers (waits on Keyhive WASM)
- Tier 3 (cross-Nexus token): UCAN-compatible token signed by source Nexus keypair (S9)

**Hostile mesh additions (beyond Ellis):**
- Nexus-level trust assertions: `NexusTrustTiddler` with `ally|neutral|hostile|unknown`
- Anti-replay: nonce burn in `CircleTiddler.nonceBurnSet` + `NexusTrustTiddler.nonceBurnSet`
- `CrdtIngressAdapter` actor-ID allow-list on `LarEventBus` crdt-ring

**New fields queued for S7.0 type stubs:**
- `CircleTiddler`: `to`, `canReply`, `canReact`, `nexusScope`, `memberSignature`
- `IdentityTiddler`: `nexusId`, `keyHistory`, `trustTier`
- New: `NexusTrustTiddler` interface stub

**S7 broken into four sub-sprints**: S7.0 (type stubs) → S7.1 (device delegation) →
S7.2 (circle invites + Seitan token) → S7.3 (capability check TW5 surface) →
S7.4 (hostile mesh circuit breakers)

---

## What Just Happened (2026-05-06 — S6 Types + Event Bus Impl)

### S6 Type Contracts Complete

**`social-doc.ts`:**
- `SessionTiddler` gains `eventLogUrl?: string` (AutomergeUrl of child log doc) and `eventLogHeads?: string` (space-separated hex heads; replay cursor)
- `SessionEvent` gains `tickCounter: LarTickCounter` alongside `clock: FfzClock`
- Standard `kind` values documented: `exchange:operator-sent`, `exchange:grounded`, `tiddler:change`, `tool:run`, `world:clock-advanced`, etc.
- `SessionEventLog extends LarDoc` — events keyed by event ID in `events: Record<string, SessionEvent>`; satisfies LarDoc invariant (tiddlers carries self-ref + log tiddler)
- `sessionEventLogUri(sessionId)` URI helper added

**`genesis-island.ts` (`@lararium/node`):**
- `seedSessionEventLog(repo, sessionId, sessionsHandle)` — creates child doc, writes self-ref tiddler, writes `eventLogUrl` back into session tiddler

**`lar-event-bus-impl.ts` (`@lararium/node`) — new:**
- `LarEventBusImpl` class implementing `LarEventBus` interface
- `start()` / `stop()` lifecycle; configurable `tickRateHz` (default 20)
- `subscribe`, `listenOnce`, `race`, `branch`, `nextTick`, `emit`, `registerRing` all implemented
- `enqueueToRing(ringName, eventType, event)` — adapter entry point; sheds oldest under backpressure
- `_runTick()` — drains rings in priority order, resolves `nextTick()` awaiters, emits `tick.loop`
- `DEFAULT_RINGS` export: `session-ring` (p1), `crdt-ring` (p2), `vm-ring` (p3), `tool-ring` (p4)
- Both exported from `@lararium/node` index

**`attention-scale.md`:**
- `#clock-profiles` section gains `WorldClockTiddler Integration` block: Rhine rule, owned-vs-observed boundary, `ObservedClockTiddler` hwm pattern, `WorldTimeAdvancedEvent` bi-temporal anchor

**All type-checks clean** (`pnpm tsc --noEmit` zero new errors in both core and node).

**Still wiring (S6 exit criteria):**
- `seedSessionEventLog` call site in `openNodeLarPeer` session open path
- `LAR_EVENT.SESSION_GROUNDED` emission from exchange lifecycle transitions

---

## What Just Happened (2026-05-06 — Multi-Clock Architecture + Tick Loop Interface)

### FfzClock Expansion: Multi-Temporal Type System

All work in `@lararium/core`. Type-check clean (`pnpm tsc --noEmit` zero errors).

**`ffz-clock.ts` additions:**
- `FFZ_REGISTER_NAMES`: canonical 5-tuple `["Pulse","Beat","Measure","Arc","Theme"]` (L0→L4)
- `FFZ_LEVEL_NAMES`: legacy `["sub-action","action","session","day","epoch"]` — kept for backward compat
- `FfzClockProfile` interface: named bound set with `l1Grain` annotation (what ONE Beat means in this domain)
- `FFZ_PROFILES` map with three built-in profiles: `"session"`, `"diegetic"`, `"world-time"`
- `LarTickCounter` branded number type — monotonic sequence number, NOT a FfzClock; serves as causal join key across event sources

**`social-doc.ts` changes:**
- `PresenceSlot.clock: FfzClock` → `clocks: Record<string, FfzClock>` + `worldClockRef?: string` (lar: URI pointer to WorldClockTiddler)
- `exchangeState?: ExchangeState` added to `PresenceSlot`
- New `WorldClockTiddler` interface — lives at `lar:///ha.ka.ba/@world/{worldId}/clock`; has `writePolicy` (Keyhive capability string) + `tickPolicy: "autonomous"|"freeze"|"manual"` + `lastTickedAt`
- New `ObservedClockTiddler` interface — LWW-Register cluster for external system clocks (Valheim, Minecraft, etc.); includes `externalClockHwm` (Flink watermark — never decreases) + `externalClockStale` + `externalClockReceived` (ffzSerialize at observation moment = bi-temporal anchor)
- New `WorldTimeAdvancedEvent` interface — bi-temporal event (Verraes 2022 pattern); carries both `atSessionClock: FfzClock` and `atTickCounter: LarTickCounter`

**`lar-event-bus.ts` (new):**
- `Cancelable` interface
- `LarEventStream<T>` interface (async iterable + eventType label)
- `IngressRingDescriptor` interface (name, priority, depth)
- `LarEventBus` interface — Verse-shaped: `subscribe`, `listenOnce`, `race`, `branch`, `nextTick`, `emit`, `registerRing`
- `LAR_EVENT` constants: `crdt.merge`, `session.grounded`, `session.blocked`, `world.clock.tick`, `tool.connected`, `tool.disconnected`, `tick.loop`

**Architecture decisions grounded:**
- Two time bases that must not conflate: Automerge (wall-clock async I/O) vs simulation tick (configurable fixed-rate). Ingress adapters bridge at ring boundary.
- CRDT merges are always-commit — no STM rollback. `race()` cancels future delivery, not past ops.
- Five clock domains: Lararium tick (owned), Session FfzClock (owned), connected-world clock (observed), diegetic clock (observed), world calendar (observed)
- WorldClockTiddler: owned by the world doc, not by any PresenceSlot. `PresenceSlot.worldClockRef` is a read pointer.
- L1 = operator perceptual grain: THE grounding rule. L1 tick fires on `"grounded"` ExchangeState transition (Clark-Brennan 1991), not on agent response delivery.
- `branch` task lifetimes scope to session — prevents Automerge change-listener accumulation on abandoned handles.

**Research docs produced:**
- `packages/lares/lararium-research/FFZ-WORLD-CLOCK.md` — Rhine rule, three-layer clock separation, WorldClockTiddler schema, ffzMerge concurrent advancement, bi-temporal events
- `packages/lares/lararium-research/LARARIUM-TICK-CLOCK.md` — two time bases, three-layer architecture (ingress rings → unified tick loop → observers), LarTickCounter, owned vs observed clock table, Verse event interface analysis
- `packages/lares/memes/api/v0.1/pono/attention-scale.md` — canonical attention-scale meme with Pulse/Beat/Measure/Arc/Theme registers, three clock profiles, World-Time aliases (Week/Month/Season/Year/Era), FTLS diegetic aliases

**Runtime implementations deferred to `@lararium/node`:**
- `LarEventBusImpl` — concrete ingress ring + configurable tick loop
- `WorldClockTickService` — implements `tickPolicy` dispatch (autonomous/freeze/manual)

---

## What Just Happened (2026-05-06 — Package Reboot + DreamNet Research)

### Package Reboot

- `lararium-app`, `lararium-tldraw`, `lararium-web` deleted — old web2-brained app packages removed entirely
- Stubbed three new blank package dirs: `lararium-browser`, `dreamdeck-tldraw`, `dreamdeck-app` (typo `dreakdeck-app` fixed)
- `packages/AGENTS.md` package map updated to new namespaces
- `lararium-node/package.json` — `@lararium/tldraw` dep dropped
- `lararium-node/scripts/source-memes.ts` — `lararium-app` source entries removed
- `lararium-tw5/memes/canvas/*.md` — `source-file` pointers updated to `dreamdeck-tldraw`
- All src file comments updated (`@lararium/app` → `@dreamdeck/app`, etc.)

**New namespace law:** `@lararium/*` = DreamNet infrastructure/protocol. `@dreamdeck/*` = first app stack on the Lares DreamNet, client UX layer.

### DreamNet Federation Research (four spirits)

Full findings in `packages/lares/lararium-research/DREAMNET-FEDERATION-RESEARCH.md`. Highlights:

- **Nexus = a namespace, not a server.** A Nexus functions as a named group of peers sharing a keypair-rooted identity. `lar://<nexus-pubkey>/<doc-id>` serves as the URI form. No DNS dependency.
- **Keyhive** (Ink & Switch, Brooklyn Zelenka) represents the exact auth substrate we need — convergent capabilities + Beelay E2EE sync co-designed with Automerge. Pre-alpha Rust, no TS yet. Design our capability surface to be Keyhive-compatible now via ucanto-style schemas.
- **Presence** = `DocHandle.broadcast()` + Yjs-awareness-style clock/slot per `(userId, deviceId)`. Never write presence into the Automerge doc. Session-local state never enters broadcast. Schema-level enforcement (tldraw three-tier model) provides the right pattern.
- **Invite token** = SSB-style: `sign_with_operator_key({ iss: nexus_did, cap: "join/nexus", exp, nonce })`. Offline-verifiable. No central registry. Chain of operators possible via UCAN proof chains later.
- **DreamDeck visual principles** (from V.U.E., Kinopio, Verse): spatial position carries semantic weight; canvas nodes act as `lar://` resource containers; edge types function as first-class; no shared mutable state (Verse model, not Blueprint); export to open formats.

### Settled Design Decisions (2026-05-06 talk-story)

**lar:// URI — three families, no grammar change:**
- `lar:///` (triple-slash, hostless) = system/content memes. Stable tagspace: `ha.ka.ba`. Unstable: what3words-style roots.
- `lar://alias:tier@host/` (hostful, existing) = active operators/agents on a machine (VS Code, MCP, etc.)
- NEW: `lar:///ha.ka.ba/@nexus/<nexus-pubkey>` = Nexus identity + registry doc. New `@nexus` scope in resolver. New kind: `"nexus-doc"`. No URI grammar change.

**Presence routing — three-layer:**
`@lararium/core` (PresenceSlot + FfzClock types) → `@lararium/tw5` (`$:/temp/presence/{peerId}` tiddlers, already blocked from sync) → `@lararium/browser` or `@lararium/node` (`DocHandle.broadcast()` wiring) → UX layer. `meme-sync-adaptor.ts:49` already guards `$:/temp/*`.

**FFZ Chronometer — `FfzClock` type to land in `@lararium/core` before S6 closes:**
5-level bounded hierarchical logical clock. L0–L3 bounded (looping/musical time); L4 epoch unbounded (anti-aliasing). `SessionEvent.clock` and `PresenceSlot.clock` both use `FfzClock`, not `number`.
Attention-scale register names now canonical: **Pulse** (L0) / **Beat** (L1) / **Measure** (L2, default band) / **Arc** (L3) / **Theme** (L4). These sit above domain aliases (sub-action/action/session/day/epoch for Lares; Action/Round/Turn/Watch/Week for FTLS/TTRPG). Canonical meme: `lar:///ha.ka.ba/@lares/api/v0.1/pono/attention-scale`.

**NexusRegistryDoc — new doc type, S9 work:**
`lar:///ha.ka.ba/@nexus/<pubkey>`. Fields: `nexusId`, `protocolVersion`, `capabilityFlags` (monotonic set), `allies`, `blocked`, `keyHistory`. Key rotation designed in from day one. Tombstoning eventual; blocked peers starved of capability tokens regardless.

**Nexus naming — three-layer petname model (no global registry):**
- Layer 1: `lar:///ha.ka.ba/@nexus/<pubkey>` — canonical, always
- Layer 2: `NexusRegistryDoc.displayName` — operator-signed self-assertion, not authoritative
- Layer 3: client-local petname map, user-controlled, overrides all
- Disambiguation: truncated pubkey suffix in UI (`DreamDeck [ab3f…]`)
- No ATProto DNS verification, no ENS — both add dependencies we don't need yet
- Keybase lesson: never put naming verification on third-party infrastructure

**FfzClock — CONFIRMED NOVEL, proceed as designed:**
- No prior art in distributed systems for bounded multi-level cyclic hierarchy with unbounded epoch guard
- Closest adjacent: ERA paper (arXiv:2601.22963) — cite if publishing externally
- FfzClock = application-layer rhythmic position. Automerge `<counter, actorID>` OpId = causal total order. COMPLEMENTARY, not substitutable.
- "Total actions taken" as L5: rejected — Automerge already has it, violates Law of Fives
- Beelay uses DAG + wall-clock replay guard only. No conflict. No need to wait on Beelay.
- FfzClock rides alongside Automerge OpId as application-layer annotation on tiddlers/changes

**PENTADIC invariants added to `system-invariants.md`:**
- `PENTA_1_BOUNDED_SCALE` — Law of Fives as structural invariant
- `PENTA_2_CLOCK_ALIGNMENT` — FfzClock L0–L4 maps onto OODA_HA_5
- `PENTA_3_PATTERN_INTEGRITY` — Fuller's FPIs and SYSTEM laws are same invariant in two registers
- `loulou` edge from system-invariants → pattern-integrity now wired

### Research files
- `DREAMNET-FEDERATION-RESEARCH.md` — federation topology, Keyhive, presence, invite-seeding, visual graph
- `NEXUS-REGISTRY-AND-FORK-RESILIENCE.md` — NexusRegistryDoc schema, hostile fork prior art
- `NEXUS-NAMING-PETNAMES.md` — three-layer petname model, Zooko's Triangle, prior art survey
- `FFZ-CHRONOMETER.md` — FfzClock type, deep research findings, novelty confirmed, Lares level mapping

---

## What Just Happened (S5 Complete + Meme Namespace Consolidation)

### S5 Complete — Quine Round-Trip Verification

- `.tw5.js` CJS plugin blobs wired into `build-genesis-island.ts`
- `test-quine.ts` passes: rendered grammar meme hash === source tiddler hash in genesis
- Genesis CID written as `$:/lararium/genesis-cid` self-ref tiddler
- `GEN_4_QUINE_PROPERTY` invariant declared proved in `system-invariants.ts`

### Meme Namespace Consolidation

**Grammar → pono merge (Option B):**
- `api/v0.1/grammars/memetic-wikitext.md` merged into `api/v0.1/pono/memetic-wikitext.md` (single source: law + grammar kernel)
- `api/v0.1/grammars/` tree deleted entirely
- `GRAMMAR_MEME_URI` and `GRAMMAR_GENESIS_REL_PATH` updated to `pono/memetic-wikitext`
- All 25 pono memes upgraded to `⊙` sigils (`<<~⊙&#x0001;` / `<<~⊙&#x0004;`)

**Namespace sigil table (settled):**

| Namespace | Open | Close |
|---|---|---|
| `pono/` | `<<~⊙&#x0001;` | `<<~⊙&#x0004;` |
| `mu/`, `lares/` | `<<~ॐ ँ&#x0001;` | `<<~ॐ ँ&#x0004;` |
| `docs/` | `<<~&#x0001;` | `<<~&#x0004;` |
| `kapu.md` | `<<~⊙&#x0011;` | `<<~⊙&#x0014;` (DC1/DC4 — intentional) |

**Misfile audit — five moves:**
1. `pono/circles-kowloon.md` → `docs/pono/circles-kowloon.md` (doc companion, not binding law)
2. `pono/pattern-integrity.md` → `mu/pattern-integrity.md` (cosmological, not protocol)
3. `docs/grammars/tiddlywiki-filter.md` → `docs/pono/tiddlywiki-filter.md` (docs/grammars/ deleted)
4. `pono/source-module.md` → `docs/lararium/source-module.md` (reference companion)
5. `masks/**` → `lares/masks/**` — voice-house consolidated under `lares/voices.md`

**Voice-house:**
- `lares/voices.md` now functions as the invariant parent of `lares/masks/`
- All mask files upgraded to `ॐ ँ` sigils; URIs updated to `api/v0.1/lares/masks/...`
- Three pending spec rooms: `docs/lares/voices/coordinators`, `/workers`, `/masks` (forward pointers, not yet created)

### Earlier (S0–S4)

- `openNodeLarPeer` rewritten: uses `loadGenesisIsland()`, removes `seedLarariumDoc` disk-walk
- `lararium-island.ts` deleted entirely (605 → 0 lines)
- Social tiga renamed Groups→Circles everywhere; `seedCirclesDoc()` seeds 5 system circles
- All IIFE references replaced with CJS (32 files); packaging model settled

---

## Open Question: Kowloon Bridge (S8 design)

We want `elyncia.app` to serve a Kowloon node (ActivityPub, Node.js + MongoDB) alongside the Lares web3 stack. DreamDeck users draft and publish Kowloon posts from within the local-first app.

**The tension:** Kowloon = server-authoritative (ActivityPub actor lives on server). Lares = keypair-authoritative (DID/UCAN). These must coexist without one undermining the other.

**Three bridge options under consideration** (research pending):
- **A)** `SessionsDoc` (social tiga ba) replaced by a `KowloonDoc` — Automerge mirror of user's Kowloon outbox/drafts/circles. Social tiga ba slot becomes the Kowloon bridge.
- **B)** `SessionsDoc` stays ba; `KowloonDoc` acts as a 4th satellite doc outside the social tiga.
- **C)** No Automerge doc for Kowloon — DreamDeck uses a lightweight HTTP adapter; Automerge stack stays pure.

Research results expected in: `packages/lares/lararium-research/KOWLOON-BRIDGE.md` (to be created on research return).

---

## Settled Terminology (2026-05-06)

| Term | Definition |
|---|---|
| **DreamNet** | The entire distributed network — all nexus-meshes, allied AND oppositional. Opposition designed in. |
| **Nexus** | A *confederation of lararia* sharing a stable internal mesh. Named by community + place. e.g. "Floating Library of Mu, PNW Branch." Cross-Nexus = wild-magic-zone hops: explicitly brokered, potentially unreliable. NOT a single server. NOT a single lararium. |
| **Lararium** | One operator's infrastructure — a `lararium-node` process + their browser peers + devices. The household shrine. Smallest unit. |
| **DreamDeck** | First personal browser app for accessing DreamNet. One UX surface. `@dreamdeck/app`. |
| **Tasked Spirits** | Bounded single-protocol agents — what we spawn for research. Elyncian term, same operational structure. |
| **Named Personas** | Persistent agent identities that follow operator signatures across nodes. Maps to DID/identity system. |
| **Scale ladder** | Lararium (single operator) → Nexus (confederation of lararia, regional mesh) → DreamNet (all Nexuses) |
| **Within-Nexus sync** | Automerge CRDT — stable, reliable internal mesh. |
| **Cross-Nexus federation** | Explicit treaty, astral-sea hops — unreliable, degraded-state-tolerant. Needs `allies` treaty events. |

Canonical grounding: `elyncia/Elyncia_02_The_Lares_DreamNet.md`

## Four-Layer Stack

```
DreamNet                  — entire distributed network of nexus-meshes (allied + oppositional)
  └── Nexus               — threshold space: stable mesh (ha-tiga) + transitory flow (social-tiga)
        ├── lararium-node     — local host peer: filesystem, operator key, canon promotion
        └── lararium-browser  — browser/OPFS peer: IndexedDB, broadcast(), WebSocket sync

elyncia.app               — public domain; reverse proxy (web2 Kowloon ↔ web3 Lares)
  ├── DreamDeck           — first app on DreamNet (@dreamdeck/app); quine-wiki + infinite canvas
  │     ├── Lares         — Agent alignment + HUD; personal workspace (MemeStoreDoc)
  │     └── Lararium      — "where the lares lives"; isomorphic identity + TW5/Automerge quine
  └── Kowloon Node        — web2 ActivityPub gateway; Node.js + MongoDB; @user@elyncia.app
```

`@lararium/*` = DreamNet protocol/infra. `@dreamdeck/*` = DreamDeck app layer. "Myth speaks reality into being." (Elyncia_02)

## Three-Tiga Doc Model

### Content Tiga (genesis-artifact-authoritative)

| Slot | Doc | URI |
|---|---|---|
| ha | `LarariumDoc` | `lar:///ha.ka.ba/@lararium` |
| ka | `CatalogDoc` | `lar:///ha.ka.ba/@catalog` |
| ba | `MemeStoreDoc` | `lar:///ha.ka.ba/@lares` |

### Local Social Tiga (keypair-authoritative, never federates)

| Slot | Doc | URI |
|---|---|---|
| ha | `IdentitiesDoc` | `lar:///ha.ka.ba/@identities` |
| ka | `CirclesDoc` | `lar:///ha.ka.ba/@circles` |
| ba | `SessionsDoc` | `lar:///ha.ka.ba/@sessions` |

Dynamic children: `SessionEventLog` (one per session, AutomergeUrl in session tiddler).
Ephemeral channel: `docHandle.broadcast()` for presence — not a doc.

### Federated Social Tiga (server-authoritative at publish boundary, S8)

| Slot | Doc | Role |
|---|---|---|
| ha | `KowloonProfile` (outbox) | Your authorial voice going out — drafts → published activities |
| ka | `KowloonFeed` (inbox) | Collective signal coming in — discovery, followed servers |
| ba | `KowloonActivity` (notifications) | Live state — mentions, replies, pending invites |

The publish step is a deliberate authority handoff: user keypair authorizes the draft; server keypair signs the federation activity. These are sequential, not concurrent. The local social tiga is unaffected.

---

## Five Architecture Laws (Do Not Re-Derive)

1. **Web2 smell test** — if it smells like web2, throw it aside and redesign from web3 local-first principles
2. **TW5 vm primacy** — if it CAN happen in the TW5 vm pool, it MUST happen there
3. **TS files as TW5 plugin projections** — vite translates TS to TW5 plugin; keep TS to design JS tiddlers
4. **Tiddler format law** — all data as `{ title, text, fields, bag, authority }`
5. **Meme files as tiddler-package projections** — `*.md` = projection of parent+fragment tiddlers; deserialize in vm; write via `renderTiddler`

---

## BOOTSTRAP_SCANS Decision (Grammar Invariant 2)

- Path α: raw carrier text functions as the deliberate exception to Law 5
- BOOTSTRAP_SCANS = codec layer (not web2); Grammar Invariant 1
- Path β (store grammar as fragment tiddlers) rejected: tightens the bootstrap circle

---

## Do Not Re-Decide

- Five architecture laws (above)
- Path α for grammar bootstrap
- `catalog-url` as named codec-layer exception (not web2)
- Vendored plugins optional via `RecipeTiddler.plugins`; no default recipe auto-loads them
- CJS format (not IIFE) for TW5 plugin modules — `exports` object provided by TW5's CJS wrapper
- `Groups` → `Circles` rename complete and settled; `GroupsDoc` now appears as `CirclesDoc` everywhere
- Adding to a circle IS the follow (jzellis principle, web3 implementation); circle membership never federates
- Genesis (content Tiga) lives at build time; social Tiga bootstrap lives at init time (`lararium:init`); server runtime only finds, never seeds
- Node peer holds `cap: "infrastructure"` delegation; browser peer holds `cap: "social"`; `IdentityTiddler.kind: "node"` as a fifth kind

---

## Open Work, In Order

| # | Item | Sprint | Status |
|---|---|---|---|
| 1 | `grammar-invariants.ts` Invariant 3 | S1 | ✅ Done |
| 2 | `system-invariants.ts` constitutional declaration | S1 | ✅ Done |
| 3 | `build-genesis-island.ts` — build-time genesis builder | S2 | ✅ Done |
| 4 | `loadGenesisIsland()` runtime function | S3 | ✅ Done |
| 5 | Rewrite `openNodeLarPeer` to use genesis artifact | S4 | ✅ Done |
| 6 | Wire `.tw5.js` CJS outputs into genesis; quine round-trip | S5 | ✅ Done |
| 7 | `SessionEventLog` per-session append-only doc | S6 | ✅ Complete |
| 7.5 | Genesis bootstrap causal correction | S5.5 | 🔴 Next — extract seeding/ceremony from openNodeLarPeer into lararium:init CLI |
| 8 | Circles + Identities capability layer (Keyhive/UCAN) | S7 | ⬜ Blocked on S5.5 — S7.1 targets init script |
| 9 | Kowloon bridge — `KowloonDoc` or HTTP adapter | S8 | ⬜ Research pending |

---

## Open Design Questions (Not Yet Sprinted)

### Node peer identity — server-as-device vs operator-device

The local Node.js `lararium-node` process holds its own Ed25519 device key and speaks
as the operator via a `DeviceDelegationTiddler`. But it represents a fundamentally
different threat model than the operator's browser/mobile peer, even when both run
on the same laptop:

- The **node peer** runs headlessly, potentially 24/7, holds filesystem access,
  manages genesis + social docs, serves WebSocket connections. Its key signs things
  autonomously without operator presence.
- The **browser/mobile peer** acts under direct operator attention; the operator
  can observe and cancel its actions in real time.

Questions to think through before S7.1 lands:
- Does the node peer's `DeviceDelegationTiddler` carry a narrower capability scope
  than the browser peer's? (e.g. "can sync but cannot sign social content")
- Does `IdentityTiddler.kind: "service"` cover the node peer, or does it need
  `"node"` as a distinct kind with its own ceremony rules?
- If the operator's laptop is compromised, the node peer's key exposure differs
  from the browser peer's key exposure — does the delegation chain encode this?
- Keyhive person-as-group: the node peer = one member of the operator's device group.
  Does it get full group capabilities, or a restricted sub-capability?

### Ley-line relay — pass-only sub-peer

A Node.js relay node participates in Automerge sync without holding read authority
over the content it relays. It passes `Uint8Array` sync messages between peers without
deserializing or storing document state. Think: Tor relay vs exit node, or a TURN
server that relays WebRTC without seeing the payload.

Questions to think through:
- Can Automerge's sync protocol operate on an opaque byte stream without a full
  `Repo` + `DocHandle` stack? (Likely needs a stripped transport-layer adapter.)
- Does the relay hold a `did:key` identity at all, or is it purely transport?
  If it does, what does its `DeviceDelegationTiddler` chain look like?
- Relation to Keyhive BeeKEM: encrypted content passes through the relay as
  ciphertext — the relay never holds a decryption key. This may be the forcing
  function for E2E encryption priority (S7.2+).
- Topology question: is the ley-line relay a Nexus node with `trustLevel: "neutral"`
  from the perspective of the peers it relays between, or a different concept entirely?
- Performance: a relay that cannot merge/compact Automerge changes cannot do
  garbage collection. Long-lived relay nodes may accumulate unbounded history.

Both questions surface before S9 (lararium-browser) and should inform the
`NexusTrustTiddler` and `DeviceDelegationTiddler` designs while they are still malleable.

---

## Likely Next Files To Touch

- `packages/lararium-node/scripts/init-lararium.ts` — NEW; seeds social Tiga, runs ceremony, writes `genesis/social-bootstrap.json` (S5.5)
- `packages/lararium-node/src/open-node-lar-peer.ts` — remove `socialPlaneIsNew` branch + all `seedXxx` calls; read `social-bootstrap.json` instead (S5.5)
- `packages/lararium-core/src/social-doc.ts` — add `cap` field + update signature payload on `DeviceDelegationTiddler`; add `"node"` to `IdentityTiddler.kind` (S5.5 / S7.1)
- `packages/lararium-core/src/capability.ts` — NEW; `buildDeviceDelegation`, `verifyDeviceDelegation` (S7.1)
- `packages/lares/memes/api/v0.1/lares/voices.md` — spec-shelf links need companion docs: `docs/lares/voices/coordinators`, `/workers`, `/masks`
