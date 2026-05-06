# Lararium — Web3 Genesis Artifact Roadmap

> Updated: 2026-05-06 (session 3)
> Branch: feature/lararium-node-3
> Governing laws: see SESSION.md § Five Architecture Laws

---

## North Star

Every peer boots from a single content-addressed genesis artifact — an Automerge doc built at build time containing all blobs, tiddlers, and the TW5 core. No runtime disk reads. No seed functions. Any peer that holds the CID can clone the canonical state.

The system folds into itself: the genesis artifact carries the engine that deserializes it.

Social graph control inverts: circles are owned by their center, not the platform. Adding to a circle IS the follow. Membership never federates. (Kowloon / jzellis model.)

**DreamNet law (2026-05-06):** A Nexus is a keypair-rooted namespace, not a server. `lar://<nexus-pubkey>/<doc-id>` is the canonical URI form. `@lararium/*` = DreamNet protocol/infra. `@dreamdeck/*` = first app stack on the Lares DreamNet. Other Nexus apps possible.

---

## Sprint Summary

| Sprint | Name | Status | Goal |
|---|---|---|---|
| S0 | Web2 Pono Audit | ✅ Complete | Delete all web2 seed/reconcile residue; harden type safety |
| S1 | Constitutional Invariants | ✅ Complete | Declare system invariants; grammar Invariant 3 for genesis approach |
| S2 | Build-Time Genesis Builder | ✅ Complete | `build-genesis-island.ts` — deterministic content-addressed genesis artifact |
| S3 | Runtime Genesis Loader | ✅ Complete | `loadGenesisIsland()` — clone and boot from genesis artifact CID |
| S4 | Peer Factory Rewrites | ✅ Complete | `openNodeLarPeer` uses genesis loader; `lararium-island.ts` deleted |
| S5 | Quine Round-Trip Verification | ✅ Complete | Wire `.tw5.js` CJS into genesis; verify self-hosting round-trip |
| S5.1 | Meme Namespace Consolidation | ✅ Complete | grammar→pono merge; misfile audit (5 moves); voice-house under lares/ |
| S5.2 | Package Reboot | ✅ Complete | Delete lararium-app/tldraw/web; stub lararium-browser, dreamdeck-tldraw, dreamdeck-app |
| S6 | SessionEventLog | 🔴 Active | Per-session append-only Automerge doc; `broadcast()` for presence |
| S7 | Circles + Identities Capability Layer | ⬜ Designed | Keyhive/UCAN device delegation; Seitan token circle invites |
| S8 | Kowloon Bridge | ⬜ Designed | `KowloonOutbox` draft queue + `KowloonInbox` feed mirror; `elyncia.app` deployment |
| S9 | lararium-browser scaffold | ⬜ Queued | Full Automerge browser peer; IndexedDB; broadcast() presence engine; OPFS option |
| S10 | dreamdeck-tldraw scaffold | ⬜ Queued | tldraw shapes as lar:// resource containers; three-tier store; edge types first-class |
| S11 | dreamdeck-app scaffold | ⬜ Queued | React shell; DreamDeck boot; TW5+canvas composition; no protocol logic |

---

## S0 — Web2 Pono Audit ✅

**Goal:** Wipe the slate. Delete all runtime disk-read / reconcile patterns before designing replacements.

### Completed

- [x] Delete `packages/lararium-node/src/seed-grammar-tiddler.ts`
- [x] Remove `seedGrammarTiddler`, `reconcileGrammarTiddlerIfChanged`, `loadGrammarFromStore` exports from `index.ts`
- [x] Remove `reconcileEngineBlobIfChanged()` and `reconcileLaresPluginBlobIfChanged()` from `lararium-island.ts`
- [x] Place `// SPRINT-2: reconcileIslandFromGenesis(...)` markers at removed call sites
- [x] Mark `buildLaresPluginBlob()` call for extraction to build time
- [x] Add `recipePlugins` Set filter — vendored plugins opt-in per `RecipeTiddler.plugins`, not default
- [x] Add `catalog-url` named codec-layer exception comment
- [x] Remove `const g = globalThis as any` from `tw5-vm.ts`; replace all `g.` refs with typed `globalThis.$tw`
- [x] Add `declare global { var $tw: TW5Instance | undefined }` to `tiddlywiki.d.ts`
- [x] Add `RecipeTiddler.plugins?: readonly string[]` + `parsePlugins()` to `recipe.ts`
- [x] Update `getRecipe()` in `composite-store.ts` to return plugins field
- [x] Update `grammar-invariants.ts` Invariant 2 to document Path α decision

---

## S1 — Constitutional Invariants ✅

**Goal:** Declare the full system's invariants before writing any new runtime code. The from-void design needs a written constitution.

### Tasks

- [x] Update `grammar-invariants.ts` Invariant 3: grammar travels in the genesis artifact; no runtime disk read on resume
- [x] Create `packages/lararium-core/src/system-invariants.ts`:
  - `SYSTEM_LAWS` — five architecture laws as typed witnessing constants
  - `GENESIS_INVARIANTS` — causal origin, content-addressed identity, immutability, quine stub (`@phase: S5`)
  - `PEER_INVARIANTS` — boot symmetry, operational divergence not authority, capability-from-receipt
  - `CODEC_EXCEPTIONS` — catalog-url, BOOTSTRAP_SCANS, pre-S2 cold-boot, binary blobs

### Exit Criteria

- `grammar-invariants.ts` Invariant 3 names genesis artifact as the grammar carrier — ✅
- `system-invariants.ts` compiles clean and exports typed constant arrays — ✅
- No new `TODO` or `SPRINT-2:` markers added without a corresponding backlog entry here — ✅

---

## S2 — Build-Time Genesis Builder ✅

**Goal:** Move all disk reads and blob construction to build time. Produce a deterministic, content-addressed Automerge doc.

### Tasks

- [x] Create `packages/lararium-node/scripts/build-genesis-island.ts`
  - Walk `LARES_MEMES_ROOT` at build time (not runtime)
  - Load `.tw5.cjs` plugin blobs
  - Serialize all tiddlers and blobs into a new `LarariumDoc`
  - Export as a binary Automerge doc; write CID to `packages/lararium-node/genesis.cid`
  - Write artifact bytes to `packages/lararium-node/genesis.bin` (git-tracked, deterministic)
- [x] Extract `buildLaresPluginBlob()` body from `lararium-island.ts` into the script (remove the runtime call)
- [x] Wire into `package.json` build script: runs before TypeScript compilation

### Exit Criteria

- `pnpm --filter @lararium/node build` produces `genesis.bin` and `genesis.cid`
- Two consecutive builds with identical source produce identical `genesis.cid`
- No disk walks remain in `lararium-island.ts` or `open-node-lar-peer.ts`

---

## S3 — Runtime Genesis Loader ✅

**Goal:** At peer boot, load the genesis artifact from the bundled binary rather than constructing it from disk.

### Tasks

- [x] Create `loadGenesisIsland(genesisBytes: Uint8Array): Promise<DocHandle<LarariumDoc>>` in `lararium-island.ts`
  - Imports `genesis.bin` (bundled asset, no fs read at runtime)
  - Calls `Automerge.load()` on the bytes
  - Returns a live `DocHandle` ready for sync
- [x] Add `reconcileIslandFromGenesis(islandHandle, genesisHandle)` — diffs live doc against genesis CID; applies only net-new content from genesis
- [x] Remove `// SPRINT-2: reconcileIslandFromGenesis(...)` placeholder comments; replace with real calls

### Exit Criteria

- Cold boot loads genesis from bundled bytes; zero `fs.readFile` calls in the hot path
- Resume boot diffs against genesis CID; applies only missing blobs
- `LarOpenPhase` sequence observable matches declared 10-phase contract

---

## S4 — Peer Factory Rewrites ✅

**Goal:** `openNodeLarPeer` and `openBrowserLarPeer` use `loadGenesisIsland()`; `seedLarariumDoc` disk-walk pattern disappears.

### Tasks

- [x] Rewrite cold-boot branch of `openNodeLarPeer` to call `loadGenesisIsland()`
- [x] Rewrite `openBrowserLarPeer` equivalently (load genesis from bundled asset)
- [x] Verify `RecipeTiddler.plugins` opt-in flows end-to-end: recipe tiddler → `recipePlugins` Set → plugin preload
- [x] Verify `LarOpenPhase` 10 transitions emit correctly from new boot path
- [x] Delete `seedLarariumDoc` disk-walk body from `lararium-island.ts` if no callers remain

### Exit Criteria

- Node peer boots from genesis artifact; no `readdir` / `readFile` in production path
- Browser peer boots identically (same genesis bytes, different transport)
- All 10 `LarOpenPhase` transitions observable in integration test

---

## S5 — Quine Round-Trip Verification ✅

**Goal:** The engine that boots the system lives inside the system it boots.

### Tasks

- [x] Confirm all `@lararium/tw5` vite outputs are `.tw5.js` CJS format (done — labels updated)
- [x] Wire every `.tw5.js` CJS plugin blob into `build-genesis-island.ts`
- [x] Boot a node peer from genesis; render the grammar meme via the TW5 vm
- [x] Verify rendered output hash matches source tiddler hash
- [x] Write genesis CID as `$:/lararium/genesis-cid` self-ref tiddler into island doc

### Exit Criteria

- `pnpm test:quine` passes: hash of rendered grammar meme === hash of source tiddler in genesis ✅
- No external file read required after `genesis/island.bin` is loaded ✅

---

## S5.1 — Meme Namespace Consolidation ✅

**Goal:** Eliminate the `grammars/` duplicate namespace; settle sigil discipline; audit misfiled memes; consolidate voice-house.

### Completed

- [x] Merge `grammars/memetic-wikitext.md` into `pono/memetic-wikitext.md` (law + grammar kernel in one file)
- [x] Delete `api/v0.1/grammars/` tree entirely
- [x] Update `GRAMMAR_MEME_URI`, `GRAMMAR_GENESIS_REL_PATH`, test paths, inline comments → `pono/memetic-wikitext`
- [x] Upgrade all 25 `pono/*.md` files to `⊙` sigils (`<<~⊙&#x0001;` / `<<~⊙&#x0004;`)
- [x] Misfile moves: `circles-kowloon` → `docs/pono/`, `pattern-integrity` → `mu/`, `tiddlywiki-filter` → `docs/pono/`, `source-module` → `docs/lararium/`
- [x] Move `masks/**` → `lares/masks/**`; upgrade to `ॐ ँ` sigils; update all URIs
- [x] Update `lares/voices.md` mask references to `api/v0.1/lares/masks`

### Settled Sigil Table

| Namespace | Open | Close |
|---|---|---|
| `pono/` | `<<~⊙&#x0001;` | `<<~⊙&#x0004;` |
| `mu/`, `lares/` | `<<~ॐ ँ&#x0001;` | `<<~ॐ ँ&#x0004;` |
| `docs/` | `<<~&#x0001;` | `<<~&#x0004;` |
| `kapu.md` | `<<~⊙&#x0011;` | `<<~⊙&#x0014;` (DC1/DC4 — intentional) |

### Known Forward Pointers (not blocking S6)

- `docs/lares/voices/coordinators`, `docs/lares/voices/workers`, `docs/lares/voices/masks` — spec rooms declared in `voices.md` but not yet created

---

## S6 — SessionEventLog 🔴 Active

**Goal:** Per-session append-only event log; ephemeral presence via `broadcast()`.

### Tasks

- [ ] Add `eventLogUrl`, `eventLogHeads` fields to `SessionTiddler` in `social-doc.ts`
- [ ] Add `SessionEventLog` doc type + `SessionEvent` entry type in `social-doc.ts`
- [ ] Add `seedSessionEventLog(repo, sessionId)` in `genesis-island.ts`
- [ ] Document `broadcast()` usage pattern for presence (no separate doc needed)

### Key design decisions

- `docHandle.broadcast()` (automerge-repo `EphemeralMessage`) = presence channel. Never persisted. Direct Yjs-awareness equivalent.
- `SessionEventLog` = one Automerge doc per session, referenced by `{ url: AutomergeUrl, heads: string[] }` in session tiddler. Supports replay via `Automerge.view(doc, heads)`.
- Log compaction: patternist.xyz lossless snapshot pattern when event count exceeds threshold.

### Exit Criteria

- Session open creates a `SessionEventLog` doc; URL stored in session tiddler
- Presence broadcasts on session doc handle; never touches `NodeFSStorageAdapter`

---

## S7 — Circles + Identities Capability Layer ⬜ Designed

**Goal:** `IdentitiesDoc` and `CirclesDoc` acquire real protocol integrity.

### Key design decisions (from research)

- `IdentitiesDoc`: Keyhive person-as-group model — each person = a group of their device `did:key`s; UCAN delegation chain proves "Device B is also me". `IdentityTiddler.verifyingKey` already present.
- `CirclesDoc`: Keyhive convergent capabilities + Seitan token invitations (@localfirst/auth); nexus admin = founding key for system circles; users = founding key for personal circles. `CircleTiddler.encryptedShareHint` already present.
- ERA paper (arXiv:2601.22963): epoch-resolved arbitration for concurrent admin revocations.

### Tasks

- [ ] Write `CAPABILITY-LAYER.md` design doc before any code
- [ ] Implement device delegation chain tiddlers in `IdentitiesDoc`
- [ ] Implement Seitan token invite flow for `CirclesDoc`
- [ ] Introduce capability verification: any peer verifies "Device X speaks as Identity Y at level Z" serverlessly

---

## S8 — Kowloon Bridge ⬜ Designed

**Goal:** DreamDeck users draft and publish to Kowloon from the local-first app. `elyncia.app` runs both services.

### Key design decisions (from research)

**Option B wins:** separate bridge docs, social tiga stays clean. The `ha/ka/ba` tiga remains entirely local-first authoritative. The publish step is a deliberate authority handoff (user keypair → server key for ActivityPub signing) — not undermining, intentional boundary.

- **`KowloonOutbox`** — Automerge doc (tiddler-first) storing unpublished drafts as a mutation queue. On publish: POST to Kowloon API, mark `status: "published"` with `remoteRef`. Replicache outbox pattern.
- **`KowloonInbox`** — Automerge doc caching feed items for display. Refreshed from `/.well-known/kowloon/pull`. Server wins on refresh (not a CRDT peer). Electric SQL shape pattern.
- Local `CirclesDoc` drives `to`/`canReply`/`canReact` addressing — translated to Kowloon user IDs by the adapter. Circle membership never sent to server.

### Tasks

- [ ] Add `KowloonOutbox` + `DraftTiddler` types (`kowloon-doc.ts` or extend `social-doc.ts`)
- [ ] Add `KowloonInbox` type
- [ ] `seedKowloonOutbox(repo)` + `seedKowloonInbox(repo)` in `genesis-island.ts`
- [ ] Write `packages/lararium-node/src/kowloon-adapter.ts` — POST draft, GET feed shape
- [ ] Add Kowloon URLs to oracle tiddlers in island doc
- [ ] `elyncia.app` deployment: Lares node + Kowloon node on same domain, separate services

### References

`packages/lares/lararium-research/KOWLOON-BRIDGE.md`

---

## Cross-Sprint Dependencies

```
S0 Cleanup ✅
  └── S1 Invariants ✅
        └── S2 Build-Time Genesis ✅
              ├── S3 Runtime Loader ✅
              │     └── S4 Peer Factories ✅
              │           └── S5 Quine Closure ✅
              │                 └── S5.1 Namespace Consolidation ✅
              │                       └── S6 SessionEventLog 🔴 ← HERE
              │                       └── S7 Capability Layer ⬜
              │                       └── (S6+S7 can run in parallel)
              │                             └── S8 Kowloon Bridge ⬜
              └── (S3 and S4 unlocked together after S2)
```

---

## S5.2 — Package Reboot ✅

**Goal:** Delete the web2-brained app packages. Stub the new DreamNet-first package triad.

### Completed

- [x] `packages/lararium-app` deleted
- [x] `packages/lararium-tldraw` deleted
- [x] `packages/lararium-web` deleted
- [x] Stub dirs created: `lararium-browser`, `dreamdeck-tldraw`, `dreamdeck-app` (typo `dreakdeck-app` corrected)
- [x] `packages/AGENTS.md` package map updated to new namespaces + spine flow + test routes
- [x] `lararium-node/package.json` — `@lararium/tldraw` dep removed
- [x] `lararium-node/scripts/source-memes.ts` — `lararium-app` source entries removed
- [x] `lararium-tw5/memes/canvas/*.md` — `source-file` paths updated to `dreamdeck-tldraw`
- [x] All `@lararium/app`, `@lararium/tldraw`, `@lararium/web` comment refs updated across `lararium-core` and `lararium-tw5` src

### New Package Map

| Package | Namespace | Role |
|---|---|---|
| `lararium-core` | `@lararium/core` | Contracts, parser, AST, lar:// URIs, Nexus identity primitives, capability schemas |
| `lararium-tw5` | `@lararium/tw5` | TW5 runtime, widget/render, CRDT sync adaptor, carrier children |
| `lararium-node` | `@lararium/node` | Local host peer: filesystem, operator key, canon promotion, serve/CLI |
| `lararium-browser` | `@lararium/browser` | Browser/OPFS peer: Automerge repo, IndexedDB, broadcast() presence, WebSocket sync |
| `dreamdeck-tldraw` | `@dreamdeck/tldraw` | tldraw shapes as lar:// containers; three-tier store; edge types; spatial layout |
| `dreamdeck-app` | `@dreamdeck/app` | React shell, DreamDeck boot, UX composition — no protocol logic |
| `lares-mcp` | `@lararium/mcp` | Agent-facing tools and resources; stdout pure JSON-RPC |

---

## DreamNet Protocol Design (Research 2026-05-06)

Full research: `packages/lares/lararium-research/DREAMNET-FEDERATION-RESEARCH.md`

### Settled Decisions

- **Nexus identity** = Ed25519 keypair. `lar://<nexus-pubkey>/<doc-id>` is the URI form. No DNS.
- **Membership** = signed invite token: `sign_with_operator_key({ iss: nexus_did, cap: "join/nexus", exp, nonce })`. Offline-verifiable, nonce burned on redemption. No central registry.
- **Auth substrate** = Keyhive (Ink & Switch, Brooklyn Zelenka) when TS/WASM bindings ship. Until then: node-local operator keypair + ucanto-compatible capability schemas as forward-compatible surface.
- **Presence** = `DocHandle.broadcast()` + Yjs-awareness-style `{ userId, deviceId, cursor, viewport, selection, clock }` slot per peer. Last-write-wins per `(peerId, deviceId)`. 15s heartbeat, 30s expiry. Never written to Automerge doc.
- **Session-local state** = never enters broadcast(). Enforced at schema level (tldraw three-tier model).
- **DreamDeck visual principles**: spatial position is semantic; nodes are `lar://` resource containers; edge types are first-class; no shared mutable state (Verse model, not Blueprint); export to open formats (JSON Canvas).

### Open Protocol Questions (research pending)

| Question | Status |
|---|---|
| `lar://` URI grammar: `lar:///path` → `lar://<nexus-pubkey>/path` — when? | Design pending |
| Cross-Nexus federation: room-level or Nexus-level subscription? No `nexus_id` in schemas yet | Research pending |
| Keyhive WASM/TS bindings ETA | Watch Ink & Switch; pre-alpha Rust only as of 2026-05 |

---

## Deferred / Out of Scope

| Item | Why deferred |
|---|---|
| `openBrowserLarPeer` wiring | No browser test harness yet; architecture same as node peer |
| Federation / multi-peer sync | Correct after genesis stabilizes; not before |
| Grammar Invariant 4+ | Block until quine round-trip proves Invariant 3 |
| Keyhive WASM integration | `encryptedShareHint` field is the forward-compatible hook; Keyhive WASM not yet stable |
