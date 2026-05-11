# Lararium — Web3 Genesis Artifact Roadmap

> Updated: 2026-05-10 (disk projection five-layer child meme structure verified; J.3 implementation next)
> Branch: feature/lararium-node-3
> Governing laws: see SESSION.md § Five Architecture Laws

---

## North Star

Every peer boots from a single content-addressed genesis artifact — an Automerge doc built at build time containing all blobs, tiddlers, and the TW5 core. No runtime disk reads. No seed functions. Any peer that holds the CID can clone the canonical state.

The system folds into itself: the genesis artifact carries the engine that deserializes it. **Myth speaks reality into being.**

Social graph control inverts: circles are owned by their center, not the platform. Adding to a circle IS the follow. Membership never federates. (Kowloon / jzellis model.)

**Settled terminology (2026-05-06):**
- **DreamNet** — the entire distributed network of nexus-meshes: allied, neutral, and oppositional. Opposition is designed in. A Nexus may be hostile, degraded, or incompatible. "Not a single machine, nor merely a choir of helpful ghosts, but a living mesh of thresholds." (Elyncia_02)
- **Lararium** — one operator's infrastructure: a `lararium-node` process + browser peers + devices. The household shrine. Smallest unit. Has two layers: *stable mesh* (lares/ carriers, genesis → `ha` content tiga) and *transitory flow* (operators, agents, sessions → social tiga).
- **Nexus** — a *confederation of lararia* sharing a stable internal ley-line mesh. Named by community + place (e.g. "Floating Library of Mu, PNW Branch"). Resources may extend geographically beyond the name. Cross-Nexus connections = wild-magic-zone hops: explicitly brokered, potentially unreliable. NOT a single server. NOT a single lararium. "Each node a city of spirits, not a solitary saint — but a city can be besieged." The Nexus keypair serves as the confederation keypair — Keyhive-group-rooted when available.
- **DreamDeck** — the first personal browser app for accessing DreamNet. One UX surface among possible others. Package: `@dreamdeck/app`.
- **`@lararium/*`** — DreamNet protocol/infra (core, tw5, node, browser, mcp)
- **`@dreamdeck/*`** — DreamDeck app stack (tldraw, app)

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
| S5.3 | FfzClock Type | ✅ Complete | `FfzClock` + clock ops in `@lararium/core`; `ExchangeState` FSM; `ffzSerialize` |
| S5.4 | Multi-Clock Architecture | ✅ Complete | `PresenceSlot` multi-clock; `WorldClockTiddler`; `ObservedClockTiddler`; `LarEventBus` interface; `LarTickCounter` |
| S5.5 | Genesis Bootstrap Causal Correction | ✅ Complete | Init script extracted; projection registry landed; admin URI constants added; AGENTS.md updated |
| S5.6 | Admin VM Lift | ✅ Complete | Admin TW5 VM stood up; admin doc seeded; `openNodeLarPeer` boots both VMs; bag-mirror configs now readable from admin-room tiddlers tagged `$:/tags/LarariumBagMirror` |
| S5.7 | Heleuma Coverage + Bag Mirror | ✅ Complete | Genesis discovery walks all packages' memes/; `LarDiskProjector` bag-aware (canon leak closed); `pnpm heleuma` audit/scaffold; `lares-chapel-perilous-opens` removed |
| S5.8 | Promotion Ceremony | ✅ Complete | `@lares/cli` package + `lares promote` CLI; command-tiddler protocol (cmd/=signal, log/=durable record); TS dispatcher + promote handler in `@lararium/node`; CLI ↔ daemon coordination via admin-doc tiddlers (no HTTP/RPC) |
| S6 | BagResidencyManager | ✅ Complete | Three-tier residency (pinned/hot/cold) for Automerge bags. LRU + idle sweeper + sync-state guard. `lares pin/unpin/residency/register-cold`. composite-store hydrate-on-read. `lares status` residency line. C.5 same-machine peer consolidation deferred to the dreamdeck-app sprint where the consumer side firms up. Five-commit C-arc C.1→C.6 |
| S6 (legacy) | SessionEventLog | ✅ Complete | Per-session append-only Automerge doc; `broadcast()` for presence (renumbered: BagResidencyManager took the S6 slot 2026-05-08) |
| S7.1 | Capability Layer (Keyhive concap) | ✅ Complete | `@keyhive/keyhive` adopted pre-alpha (0.0.0-alpha.56c); operator-key bridge; `AdminEventStore` persists cap events across daemon restarts; `ctx.cap` wired through dispatcher; promote-handler enforces `verify({access:"admin", bagUrl})`. Two-tier policy stands: Keyhive crypto gate + future ABILITY_LADDER caveats above it. Six-commit D-arc D.1→D.6 |
| S7.4 | Admin doc ingress trust gate | ⬜ Designed | Admin doc federation gates on `cap=infrastructure` proofs (waits on S7.1 D-arc closure) |
| S7 (legacy) | Circles + Identities Capability Layer | partly absorbed | Keyhive direction confirmed via S7.1; UCAN direction rejected (Keyhive does NOT use UCAN — uses concap); Seitan token circle invites still pending |
| S8 | Wiki composition (E-arc) | ✅ Complete | `lares bag` + `lares wiki` subcommand surfaces; per-wiki draft bagId; explicit `BAG_IDS.projection` layer; disk → CRDT sync; whole-recipe pin/unpin; recipe composition via add-bag/remove-bag (hot-reload); DXOS-style bag epoch; Nix-generations recipe-rotation; prune-stale draft inspection. Ten-commit E-arc E.1→E.10. |
| S8.1 | Canon-promote hardening + ahu render rewrite (E.10.1→E.10.4) | ✅ Complete | Six interlocking bugs in cross-bag promote ceremony fixed; `lares draft` ceremony lands; canonical bags open as writable+defaultWritable:false; AhuWidget rewritten as TW5-native cascade-resolve + transclude shim with template tiddlers; new wikirule `wikirules/memetic-wikitext-sigil.ts` makes `<<~` first-class TW5 grammar. Round-trip verified end-to-end. |
| S8.2 | Yin-mode collapse (E.10.5→E.10.9) | ✅ Complete | 18 dead files purged. MemeticParser collapses ~330 → ~30 lines (proper WikiParser subclass replacing pragma injection). Drop tag-driven cascade discriminator (Roslyn / recast / XInclude consensus). Consolidate ahu scanner into `@lararium/core/meme-ast/ahu-scan.ts` (single source of truth). `<$lar-meme-split>` widget closes the four-call-sites law: `lar-generated` field marker + content-equality guards (TW5 editor-widget pattern). Always-split, always-kahea invariant established. |
| S8.3 | tw5-typed coexistence (E.10.10→E.10.11) | ✅ Complete | linonetwo's `tw5-typed@^1.1.5` dev dep added + activated in tsconfig types array. Hand-rolled types coexist (parallel type graphs, no collision). Per-site migration as call sites are touched. |
| V.1 | Vite plugin packaging — first artifact (E.10.12) | ✅ Complete | `vite.plugin.config.ts` + `scripts/build-plugin-tiddler.ts`. Output: `dist-plugin/lares-memetic-wikitext.tid` (71.3 KiB), drag-and-drop installable in any TW5 5.4+ wiki. Five JS module tiddlers (wikirule + 2 widgets + parser + deserializer) + seven data tiddlers (cascades + templates + mount + readme). |
| V.2 | Boot-path conversion + lar:// namespace alignment (E.10.13) | ✅ Complete | TW5Engine pushes one envelope tiddler (`lar:///plugins/lares/memetic-wikitext`) into `preloadTiddlers`; TW5's standard plugin loader registers wikirule/parser/deserializer/widget modules and materializes cascade + template + mount shadow tiddlers. `_registerWidgets` / `_registerDeserializer` / parser-wrapper-injection block deleted. Single-backtick parser regression cured as a side effect (canonical `$tw.modules` construction path). Folded with namespace alignment: every Lares system title moved to `lar:///` (cascades, mount, templates, plugin envelope) so shadow-tiddler edits and in-VM plugin re-packs sync to disk through the existing `lar:`-only filter; canon-promote ceremony no longer bugs out on `$:/`-prefixed system tiddlers. Tag VALUES stay TW5-conventional. Dual-distribution emits both `lar:///` (canonical, 72.2 KiB) and `$:/` (drag-and-drop) envelopes from one Vite library bundle. Decision recorded in `packages/lares/memes/api/v0.1/pono/lar-uri.md` (TW5 System Boundary). |
| A | Canonical TW5 module export shapes (E.10.14) | ✅ Complete | Wikirule split into 3 module-type:wikirule files (lar-sigil-block / lar-sigil-inline / lar-doctype-comment). Parser exports as `{MemeticParser as "text/x-memetic-wikitext"}`. Widgets self-`require`("$:/core/.../widget.js"), set prototype chain, export under tag name. Plugin loader unpacks via canonical `$tw.modules.applyMethods` flow. In-process smoke harness at `scripts/smoke-plugin-boot.ts`. |
| W | CodeMirror 6 / Lezer alignment + Memetic Wikitext LSP server | ⬜ Designed (way downstream — gated on CLI wiki stability) | Two-stage: (1) wikirule patterns map onto CM6 + Lezer grammar; `tobibeer/codemirror-6-tw5` is the closest active community effort. (2) **Operator's TW5-Grammar textmate VSCode plugin evolves into a full Memetic Wikitext LSP server** — Lezer grammar definitions feed both CM6 (browser TW5 + standalone) and the LSP (VSCode + JetBrains + neovim + any LSP-aware editor). Operator-stated trigger: "once CLI wikis stabilize completely." |
| G.1→G.5 | Sigil family ports + factory | ✅ Complete | aka URI sigil (G.1), pranala-header (G.2), kahea + loulou URI sigils (G.3), pranala edge inline+block (G.4), `widgets/_cascade-sigil-base.ts::makeCascadeSigilWidget` factory collapses 5 widgets (G.5). Six sigils now ride template-cascade architecture (ahu, aka, kahea, loulou, pranala-header, pranala); five share factory. ahu stays bespoke (slot/uri/parentUri logic). kau retired from G — its dispatch is logic-heavy, not cascade-shaped. |
| G.rest | Remaining sigils (lele, papalohe, pae) | ⬜ Less urgent | Less-load-bearing per operator; can land when use cases surface. Same factory pattern; mostly mechanical. |
| H | Save-side auto-split | ✅ Complete (E.10.8) | `<$lar-meme-split>` widget closes the four-call-sites law; symmetric with disk-sync deserializer. |
| I | Wikifier polish (DOCTYPE + dash) | ⬜ Single-backtick cured by V.2; DOCTYPE/dash remain | Parser instantiation now canonical via Path A; remaining DOCTYPE comment + `dash` rule conversions are aesthetic round-trip diffs. Defer. |
| J.1+J.2a/b/c | Per-slot iam emission + preamble/postamble + default-elision | ✅ Complete |
| J.2d | Disk projection five-layer child structure + TW5 VM primacy enforcement | ✅ Complete (2026-05-10) |
| J.3 | Recursive promote / child co-promotion | ⬜ Gap named — implementation next | `lares promote` is single-URI. `splitRecursive` creates `#fragment` child tiddlers in the bag alongside the parent, but the promote handler moves only the parent URI. Children stay in the room bag; canonical disk projector writes only what's in its bag — child slot files never land in `packages/`. Fix: promote handler walks all `#fragment` children of the promoted parent and co-promotes them in the same ceremony (single atomic audit event). Prerequisite for any multi-slot meme to be fully promoted to canon. | J.1: meme-level postamble symmetric with prologue. J.2a: extractSlotStructure captures preamble (with `<<~ iam >>` sentinel marking iam position) + iam fields + text + postamble per slot — slot-as-full-meme-MD-projection invariant. J.2c: meme-template uses `<$text>` to bytes-faithfully emit prologue/preamble-rendered/postamble (per Jermolene GH #6712 — pragma scope doesn't propagate through field transclude). J.2b: regenerateIamToml + IAM_DENYLIST + parentIam threading through splitRecursive — child elides values matching parent's effective iam (inherited + own merged). Operator edits to native iam-class fields flow back to disk. |
| F | F-arc TW5 routing + debounce shim + auto-truncate projection | ⬜ Deferred | `$:/state/*` → projection; `Draft of *` → per-wiki draft; Yjs-style 300-500ms debounce; idle auto-truncate. Important once browser peer surfaces let operators edit at sustained rates. |
| S8 | Kowloon Bridge | ⬜ Designed | `KowloonOutbox` draft queue + `KowloonInbox` feed mirror; `elyncia.app` deployment |
| S9 | lararium-browser scaffold | ⬜ Queued | Full Automerge browser peer; IndexedDB; broadcast() presence engine; OPFS option |
| S10 | dreamdeck-tldraw scaffold | ⬜ Queued | tldraw shapes as lar:// resource containers; three-tier store; edge types first-class |
| S11 | dreamdeck-app scaffold | ⬜ Queued | React shell; DreamDeck boot; TW5+canvas composition; no protocol logic || R | ReactionEngine unpark + wire | ⧾ Designed (see Path R) | Unpark kumu-device.ts (rewrite from scratch); one RE per hot-tier wiki; co-located with TW5Engine in its Worker Thread; MemeProjection ordering invariant (adaptor → RE within each changeset); FfzClock as tick boundary; Keyhive cap gate at subscribe time; speculative execution deferred |
| R.1 | P.3-narrow: piscina for parse | ⧾ Queued (gate: P.2 stable) | Separate Piscina pool for stateless deserializeCarrier/parseMeme calls only |
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

## S5.3 — FfzClock Type ✅ Complete

**Goal:** Define `FfzClock` in `@lararium/core` before S6 closes so `SessionEvent` and `PresenceSlot` use the right clock type from the start.

### Completed

- [x] `FfzLevel`, `FfzClock`, `FFZ_DEFAULT_BOUNDS`, `FFZ_LEVEL_NAMES`, `FFZ_REGISTER_NAMES` in `ffz-clock.ts`
- [x] `ffzZero`, `ffzTick`, `ffzCompare`, `ffzMerge`, `ffzSerialize`, `ffzDeserialize`
- [x] `ExchangeState` FSM type (`idle → operator-sent → agent-working → agent-responded → grounded → blocked`)
- [x] `FfzClockProfile` interface + `FFZ_PROFILES` map (session / diegetic / world-time)
- [x] `LarTickCounter` branded number type
- [x] Exported from `@lararium/core` index

### Key decisions

- L4 epoch MUST be unbounded (epoch aliasing problem)
- L1 = operator perceptual grain; L1 tick fires on `"grounded"` ExchangeState transition (Clark-Brennan 1991)
- `actorId` tie-breaker preserves Automerge ordering contract
- Stub bounds `[64, 256, 1024, 365, Infinity]`; coprime-prime candidates noted: `[59, 251, 1021, 367, Infinity]`
- Reference: `packages/lares/lararium-research/FFZ-CHRONOMETER.md`

---

## S5.4 — Multi-Clock Architecture ✅ Complete

**Goal:** Extend `@lararium/core` type contracts to support multiple concurrent clocks, world/observed clocks, and the Verse-shaped event bus interface.

### Completed

- [x] `PresenceSlot.clocks: Record<string, FfzClock>` replaces single `clock: FfzClock`
- [x] `PresenceSlot.worldClockRef?: string` — lar: URI pointer to WorldClockTiddler
- [x] `PresenceSlot.exchangeState?: ExchangeState`
- [x] `WorldClockTiddler` interface: `writePolicy`, `tickPolicy: "autonomous"|"freeze"|"manual"`, `lastTickedAt`
- [x] `ObservedClockTiddler` interface: LWW-Register cluster with hwm (Flink watermark), stale flag, bi-temporal anchor
- [x] `WorldTimeAdvancedEvent` interface: bi-temporal event (Verraes 2022) with `atSessionClock` + `atTickCounter`
- [x] `lar-event-bus.ts`: `Cancelable`, `LarEventStream<T>`, `IngressRingDescriptor`, `LarEventBus` interface, `LAR_EVENT` constants
- [x] All compile clean; `pnpm tsc --noEmit` zero errors

### Key decisions

- Two time bases that must not conflate: Automerge async I/O vs simulation tick (configurable fixed-rate)
- CRDT merges always-commit; no STM rollback across Automerge boundaries
- Five clock domains: two owned (tick counter + session clock), three observed (connected-world, diegetic, world calendar)
- `externalClockHwm` never decreases — implements Flink watermark; triggers use `hwm >= threshold`, not `value == threshold`
- `branch` tasks scope to session lifetime — structural leak prevention for Automerge listeners

### Runtime work deferred to `@lararium/node`

- `LarEventBusImpl` — concrete ingress ring + configurable multi-rate tick loop
- `WorldClockTickService` — `tickPolicy` dispatch

---

## S6 — SessionEventLog 🔴 Active

**Goal:** Per-session append-only event log; ephemeral presence via `broadcast()`.

### Tasks

- [x] Add `eventLogUrl`, `eventLogHeads` fields to `SessionTiddler` in `social-doc.ts`
- [x] Add `SessionEventLog` doc type + `SessionEvent` entry type (`clock: FfzClock`, `tickCounter: LarTickCounter`) in `social-doc.ts`
- [x] Add `seedSessionEventLog(repo, sessionId, sessionsHandle)` in `genesis-island.ts`
- [x] `PresenceSlot` with `clocks: Record<string, FfzClock>` defined in `social-doc.ts`
- [x] `broadcast()` pattern documented via `PresenceSlot` type — no separate doc needed
- [x] Wire `seedSessionEventLog` into session open path via `createNodeSession()`
- [x] `LAR_EVENT.SESSION_GROUNDED` subscriber wired in `createNodeSession()`; callers enqueue via `eventBus.enqueueToRing("session-ring", …)`

### Key design decisions

- `docHandle.broadcast()` (automerge-repo `EphemeralMessage`) = presence channel. Never persisted. Direct Yjs-awareness equivalent.
- `SessionEventLog` = one Automerge doc per session, referenced by `{ url: AutomergeUrl, heads: string[] }` in session tiddler. Supports replay via `Automerge.view(doc, heads)`.
- Log compaction: patternist.xyz lossless snapshot pattern when event count exceeds threshold.

### Exit Criteria

- Session open creates a `SessionEventLog` doc; URL stored in session tiddler
- Presence broadcasts on session doc handle; never touches `NodeFSStorageAdapter`

---

## S7 — Circles + Identities Capability Layer 🔴 Active

**Goal:** `IdentitiesDoc` and `CirclesDoc` acquire real protocol integrity across a
hostile multi-Nexus mesh where not all peers are aligned or interoperable.

### Key design decisions (from jzellis/kowloon audit + DreamNet redesign, 2026-05-06)

**Confirmed from Kowloon source:**
- Follow = local circle add, never federated, never announced. `shouldFederate.js` confirms.
- Visibility = writer sets `to`/`canReply`/`canReact` on content; reader's circle membership
  is evaluated locally at read time. No remote server query at check time.
- Block/Mute = local circles, never cross-announced. Actor-level only.
- Circle integrity: signed over `id|name|to|sortedMemberList` by owner's key.

**DreamNet divergence (what Ellis cannot do):**
- Identity anchor = keypair (`did:key`), not server domain. Server is just another peer.
- Circles span Nexus boundaries via Keyhive Group CRDT — not single-actor on single-server.
- Hostile Nexus threat: Nexus-level trust assertions + nonce burn (anti-replay).
  Ellis' block is actor-level only; DreamNet needs server-level circuit breakers.
- Key rotation: Keyhive BeeKEM re-wrap on member change. Ellis has `keyRotationAt` field
  but no protocol.

**Five identity planes (revised):**
- Plane 0: Device (`did:key` Ed25519)
- Plane 1: Operator (Keyhive person-as-group of device keys)
- Plane 2: Circle (local CRDT for personal; Keyhive Group for Nexus-scoped)
- Plane 3: Nexus (confederation keypair; signs cross-Nexus capability tokens)
- Plane 4: DreamNet (no central authority; trust from Nexus treaty events only)

**Three-tier authority separation:**
- Tier 1 (local CRDT): `CirclesDoc` membership checked via TW5 filter. No crypto needed.
- Tier 2 (Nexus CRDT): Keyhive Group replicates to all Nexus peers. Waits on Keyhive WASM.
- Tier 3 (cross-Nexus token): UCAN-compatible token signed by source Nexus keypair. S9.

**Addressing model (from Ellis, upgraded):**
- Three fields on every content tiddler: `to`, `canReply`, `canReact`
- Values: `"@public"` | `"@nexus:{pubkey}"` | `"circle:{id}"` | `"group:{uri}"`
- Replaces implicit follower-list visibility with explicit capability grants

Full design: `packages/lares/lararium-research/S7-CIRCLES-IDENTITIES-REDESIGN.md`

### Sub-sprints

#### S7.0 — Type stubs + design doc ✅
- [x] `CircleTiddler` — `nexusScope`, `memberSignature`, `nonceBurnSet` added; comment updated (web3 only)
- [x] `IdentityTiddler` — `nexusId`, `keyHistory`, `trustTier` added
- [x] `ContentAddressing`, `DeviceDelegationTiddler`, `CircleInviteToken`, `NexusTrustTiddler` added to `social-doc.ts`
- [x] `deviceDelegationUri()`, `nexusTrustUri()` helpers added
- [x] `CAPABILITY-LAYER.md` — code-ready spec with S7.1–S7.4 function signatures

#### S7.1 — Device delegation chain (Tier 1)
- [ ] `DeviceDelegationTiddler` — UCAN-compatible chain proving device→operator
- [ ] Wire into `buildCeremonyTiddlers` in `@lararium/tw5`
- [ ] `verifyDeviceDelegation(deviceDid, operatorDid, tiddlers)` in `@lararium/core`

#### S7.2 — Circle invites + Seitan token (Tier 1/2)
- [ ] Invite token: `sign({ iss: nexusDid, circleId, cap: "join", exp, nonce })`
- [ ] `acceptCircleInvite(token, identitiesHandle, circlesHandle)` in `@lararium/node`
- [ ] Nonce burn: write to `CircleTiddler.nonceBurnSet` on accept

#### S7.3 — Capability check surface (TW5-queryable)
- [ ] `canRead`, `canReply`, `canReact` helpers in `@lararium/core`
- [ ] Expose as TW5 filter operators: `[can-read[{currentUser}]]`

#### S7.4 — Hostile mesh circuit breakers
- [ ] `NexusTrustTiddler` write helpers
- [ ] Nonce burn on inbound cross-Nexus activities
- [ ] `CrdtIngressAdapter` actor-ID allow-list check on `LarEventBus` crdt-ring

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

## S5.5 — Genesis Bootstrap Causal Correction ✅

**Goal:** Remove all social Tiga seeding and identity ceremony from `openNodeLarPeer`.
The server finds what exists; it never authors. Init happens before the server starts.

**Principle:** Three causal moments, strictly separated:

```
Build time   scripts/build-genesis-island.ts    content Tiga → genesis/island.bin ✓ (done)
Init time    scripts/init-lararium.ts (NEW)     social Tiga + identity → social-bootstrap.json
Runtime      openNodeLarPeer (simplified)        finds docs; errors if uninitialised; no seeding
```

**The init script (`scripts/init-lararium.ts`):**
- Creates IdentitiesDoc, CirclesDoc, SessionsDoc
- Runs `buildCeremonyTiddlers` (operator identity + system circles)
- Creates `DeviceDelegationTiddler` with `cap: "infrastructure"` for the node device (S7.1)
- Writes `genesis/social-bootstrap.json` as a **TW5 tiddler bundle** — a JSON array of tiddler objects
  mirroring the oracle tiddler shape (`title` / `text` / `fields` / `bag` / `authority`):
  ```json
  [
    { "title": "lar:///ha.ka.ba/@identities", "text": "automerge:abc...",
      "fields": { "kind": "social-bootstrap" }, "bag": "lar:///ha.ka.ba/@lararium",
      "authority": "lararium-init" },
    { "title": "lar:///ha.ka.ba/@circles",    "text": "automerge:def...", ... },
    { "title": "lar:///ha.ka.ba/@sessions",   "text": "automerge:ghi...", ... },
    { "title": "lar:///ha.ka.ba/@lares",      "text": "automerge:jkl...", ... }
  ]
  ```
  TW5 VM queries it directly: `[field[kind]exact[social-bootstrap]]`. No special loader needed.
- Optionally: `lararium:pack` produces a nexus connect bundle (genesis CID + catalog URL + invite token) for browser peer cold-boot

**The simplified `openNodeLarPeer`:**
- Reads `genesis/social-bootstrap.json` (tiddler bundle) — writes oracle tiddlers into island doc via `islandHandle.change()` on first boot; CRDT already holds them on resume
- Extracts AutomergeUrls from bundle tiddler `text` fields; `waitHandleLocal` for each doc
- `waitHandleLocal` for each doc — they already exist
- Throws `"Run lararium:init before starting the node"` if bootstrap file absent
- Removes: `socialPlaneIsNew`, `seedIdentitiesDoc/Circles/Sessions`, `seedLaresDoc`, `buildCeremonyTiddlers`, `operatorIdentity` option

**Browser cold-boot path:**
Admin runs `lararium:pack` after init. Browser peer receives a bundle encoding:
genesis CID + catalog AutomergeUrl + invite token (nonce-bearing, expiring, Seitan pattern).
Browser loads `genesis/island.bin` from its bundled copy (content-addressed, same binary),
then syncs live docs from the catalog URL. No server-side seeding needed.

**Impact on S7.1:** `buildDeviceDelegation` + ceremony move to `init-lararium.ts`.
S7.1 targets the init script callsite, not `openNodeLarPeer`.

### Tasks

- [x] Create `scripts/init-lararium.ts` — seeds social Tiga, runs ceremony, writes `genesis/social-bootstrap.json` as TW5 plugin container
- [x] Add `lararium:init` / `lararium:reset` / `lararium:fresh` / `lararium:pack` (stub) to `package.json` scripts
- [x] Simplify `openNodeLarPeer` — load bundle, write oracle tiddlers to island doc, extract AutomergeUrls, remove all seeding branches
- [x] Remove `operatorIdentity` from `NodeLarPeerOptions`; loaded in `main.ts` for future capability use
- [x] `lararium-bootstrap-sync` startup module promotes the bootstrap plugin container after the syncer
- [x] Content-equality guard in `AutomergeDocStore.put()` — kills file-watcher echo + Automerge churn
- [x] Retire `_revisions` map in `MemeSyncAdaptor` (web2 revision concept; CRDT handles conflict resolution)
- [x] Projection registry in `@lararium/core` — declarative, kind-based, factory-owned attachment
- [x] `ADMIN_ROOM_URI` (`lar:///ha.ka.ba/@lararium/rooms/admin`) and `ADMIN_BAG_ID` (`lar:///ha.ka.ba/@lararium/@admin`) constants
- [x] Update `AGENTS.md` package map and boot sequence description
- [x] Remove dead playwright config (empty `tests/e2e/`, missing `scripts/serve.ts`, web2 HTTP-test smell)

---

## S5.6 — Admin VM Lift 🔴 Next

**Goal:** Stand up an admin TW5 VM in the node peer. Move operator-private state out of `main.ts` imperative wiring and into a meme-driven coordinator room.

**Two URIs, one Automerge doc:**
- Logical room: `lar:///ha.ka.ba/@lararium/rooms/admin` (TW5 view, what the admin VM "lives in")
- Bag (Automerge doc): `lar:///ha.ka.ba/@lararium/@admin` (sync boundary, sibling to @identities/@circles/@sessions)

**Federation:** scoped to the operator's own devices. Room peers cannot prove `cap=infrastructure`; admin doc never federates outside operator's device set. Trust gate at S7.4 (`checkIngressTrust`).

**What lands in the admin doc:**
- `DeviceDelegationTiddler`s tagged `cap=infrastructure` (S7.1)
- `ProjectionTiddler`s tagged `$:/tags/LarariumProjection` (declarative manifest replacing the programmatic `registry.enable(...)` calls in `main.ts`)
- Session tiddlers (operator → agent; sessions become an admin-room concern, not a room-room concern)
- Future ceremony state (key rotation, invite acceptance)

### Tasks

- [ ] Genesis-island oracle entry for `ADMIN_BAG_ID` (parallel to identities/circles/sessions)
- [ ] `init-lararium.ts` seeds admin doc + writes oracle tiddler into bootstrap bundle
- [ ] New `open-admin-vm.ts` mounts admin doc as writable layer in `CompositeStore` + boots second TW5 engine
- [ ] Move `createNodeSession` from sessions doc → admin doc
- [ ] Convert `main.ts` projection registrations from programmatic to admin-room tiddler-driven (filter `[tag[$:/tags/LarariumProjection]has[enabled]]`)
- [ ] CLI surface stub: `lararium admin <subcommand>` opens session against admin room with operator key

---

## Open Design Questions (pre-sprint, blocking S7.1+)

### Node peer identity — server-as-device

The `lararium-node` process holds its own device key and speaks as the operator via
`DeviceDelegationTiddler`. Even when server and browser run on the same laptop, they
constitute separate peers with separate threat models:

- Node peer: headless, autonomous, holds filesystem, manages social docs — `cap: "infrastructure"`
- Browser/mobile peer: under direct operator attention — `cap: "social"`

**Decided (2026-05-06):**
- `IdentityTiddler.kind` gains `"node"` as a distinct value (five kinds: operator/node/agent/service/device)
- `DeviceDelegationTiddler.cap` scopes the grant: `"infrastructure" | "social" | "relay" | "full"`
- Node peer's delegation carries `cap: "infrastructure"` — can sync, seed, oracle-sign, manage sessions; cannot sign social content or issue circle invites
- Browser peer carries `cap: "social"` — can sign content, manage circles, issue invites
- Ceremony writes the node's `cap: "infrastructure"` delegation during `lararium:init`, not at server start

### Ley-line relay — pass-only sub-peer

A Node.js relay node participates in Automerge sync without holding read authority.
It passes opaque sync byte-streams between peers without deserializing document state.
Analogous to a Tor relay — passes ciphertext, holds no plaintext key.

**Design questions (inform NexusTrustTiddler + DeviceDelegationTiddler before they solidify):**
- Can Automerge sync operate on a stripped transport-layer adapter without a full Repo?
- Does a relay hold a `did:key` identity, or is it purely transport-layer?
- Is the ley-line relay a Nexus peer with `trustLevel: "neutral"` or a distinct concept?
- E2E encryption forcing function: Keyhive BeeKEM would make this pattern natural —
  relay holds no decryption key by construction. Prioritize BeeKEM before relay work.
- Unbounded history problem: a relay that cannot compact Automerge changes accumulates
  forever. Needs a solution before relay nodes operate long-term.

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

- **Nexus identity** = Ed25519 keypair. `lar://<nexus-pubkey>/<doc-id>` serves as the URI form. No DNS.
- **Membership** = signed invite token: `sign_with_operator_key({ iss: nexus_did, cap: "join/nexus", exp, nonce })`. Offline-verifiable, nonce burned on redemption. No central registry.
- **Auth substrate** = Keyhive (Ink & Switch, Brooklyn Zelenka) when TS/WASM bindings ship. Until then: node-local operator keypair + ucanto-compatible capability schemas as forward-compatible surface.
- **Presence** = `DocHandle.broadcast()` + Yjs-awareness-style `{ userId, deviceId, cursor, viewport, selection, clock }` slot per peer. Last-write-wins per `(peerId, deviceId)`. 15s heartbeat, 30s expiry. Never written to Automerge doc.
- **Session-local state** = never enters broadcast(). Enforced at schema level (tldraw three-tier model).
- **DreamDeck visual principles**: spatial position carries semantic weight; nodes act as `lar://` resource containers; edge types function as first-class; no shared mutable state (Verse model, not Blueprint); export to open formats (JSON Canvas).

### Settled Protocol Decisions (2026-05-06)

- **lar:// URI** — three families, no grammar change. Nexus identity uses new `@nexus` scope: `lar:///ha.ka.ba/@nexus/<pubkey>`. Resolver gets `"nexus-doc"` kind. Triple-slash hostless form retained for all system/content memes.
- **Presence routing** — `@lararium/core` types → `@lararium/tw5` tiddler representation → peer packages wire broadcast → UX layer consumes.
- **FFZ Chronometer** — `FfzClock` type lands in `@lararium/core` before S6 closes. `PresenceSlot.clock` and `SessionEvent.clock` are `FfzClock`, not `number`. L4 (epoch) unbounded; L0–L3 bounded + looping.
- **`capabilityFlags` forms a monotonic set** — never negotiate down. Protocol downgrade attack is mitigated structurally.
- **`keyHistory` designed in from day one** — key rotation proofs required; cannot be retrofitted.

### Open Protocol Questions (research pending)

| Question | Status |
|---|---|
| Cross-Nexus federation: room-level or Nexus-level subscription? No `nexus_id` in schemas yet | Research pending |
| Keyhive WASM/TS bindings ETA | Watch Ink & Switch; pre-alpha Rust only as of 2026-05 |
| `FfzClock` bound values — should be coprime primes; final values not yet chosen | Design pending |
| `NexusRegistryDoc` bootstrap into genesis artifact | S9 question |
| `allies` and `blocked` — same doc or separate satellite docs? | Design pending |
| ATProto-style DNS verification as optional operator proof | Deferred — not primary mechanism |
| FfzClock external publication — Google Scholar search for "hierarchical logical clock" + "bounded" first | Before publishing |

---

## Path R — ReactionEngine Sprint

> Status: Designed. Gate: P.2 NodeVmManager three-tier pool stable under test suite.

### What a ReactionEngine IS in this system

A `MemeProjection` that sits alongside each hot-tier TW5Engine and routes CRDT change
events through a `ReactionGraph`. It makes a wiki *reactive* — changing a sensor tiddler
fires `OnValueChanged`, which calls `Enable` on a wired target device.

This is the Lararium's Verse-compatible scripting layer. Verse 5.6+ (UEFN) is the
compatibility target: compositional device model, not Blueprint/inheritance. The
`kumu-device.ts` sketch in `lararium-core/maybe/` is **throwaway TS** — the vocabulary
and invariants in its comments are the load-bearing artifact. Implementation rewrites from
scratch in Path R.

### Verse compatibility — what lands in Path R vs deferred

| Verse property | Path R? | Notes |
|---|---|---|
| Compositional device model (`using` traits, no class hierarchy) | ✅ | `KumuDeviceSpec` derived from pranala edges |
| Typed directional pins (`listenable` OUTPUT / `@subscribes` INPUT) | ✅ | `KumuListenable` / `KumuSubscribable` |
| Single-shot coroutines (`Await(event)<suspends>`) | ✅ | `subscribeOnce()` on `ReactionGraph` |
| Synchronous declaration-order tick | ✅ | `fireSync()` inside `onChangeset` |
| Capability gate on subscription | ✅ | Keyhive `verify()` at `re.subscribe()` call site |
| Speculative execution / failure types / rollback | ⬜ Deferred | Requires transactional tiddler writes |
| Metered execution (gas / tick budget) | ⬜ Deferred | Needed for untrusted operator-authored handlers |

### Architectural invariants (do not re-decide)

1. **RE and TW5Engine co-locate in the same Worker Thread.** RE reads TW5 state
   synchronously inside `onChangeset`. Cross-thread reads would break the Verse tick.
2. **Ordering within a changeset: MemeSyncAdaptor fires first, RE second.** TW5 state
   must be current before RE fires. This ordering IS the tick boundary invariant.
   `ProjectionRegistry` must enforce it.
3. **RE writes go through the composite store.** Handlers call `store.put()`. RE never
   touches `docHandle.change()` directly.
4. **Device graph lives in the wiki, not in the RE.** `KumuDeviceSpec` is derived from
   pranala edges in tiddler text. RE caches `ReactionGraph` in memory; `onUriChanged`
   maintains it incrementally.
5. **FfzClock tick = one RE turn.** `LarTickCounter` advances after each `onChangeset`.
6. **No RE in cold-tier slots.** RE boots with the Worker when a slot promotes to hot.

### Cold-boot sequence per wiki

```
CRDT sync → VmSnapshot (if available)
  ↓
Worker Thread spawns
  ├─ TW5Engine.boot(coreBlob, snapshotTiddlers)
  ├─ MemeSyncAdaptor attaches
  ├─ Automerge.getChangesSince(liveDoc, snapshot.heads) → replay deltas
  └─ ReactionEngine.boot(tw5)  ← full wiki scan for pranala reaction edges
       ReactionGraph loaded; RE.ready = true
       RE registered as second MemeProjection in ProjectionRegistry
```

### P.3 decision (decided 2026-05-11)

NOT piscina for hot-tier wikis. Piscina is load-balanced stateless — wrong shape for
stateful per-wiki VMs. **One dedicated `worker_threads.Worker` per hot-tier wiki slot.**

P.3-narrow (Path R.1): piscina IS right for stateless `deserializeCarrier` / `parseMeme`
calls. Separate `Piscina` instance, any-hot-VM routing, no per-wiki state.

### Wave 3 research findings (2026-05-11)

- **Brooklyn Zelenka** is now a senior researcher at Ink & Switch working on Subduction
  and Keyhive. She is the UCAN spec editor; previously ran Fission.
- **Subduction** (`inkandswitch/subduction`, v0.13.0) — P2P CRDT sync protocol, Rust +
  WASM (Node.js + browser). Uses **Sedimentree** (hash-linked hierarchical storage) for
  metadata-only diffing: peers sync by comparing hashes without decrypting content.
  Pluggable transports: WebSocket, HTTP long-poll, Iroh/QUIC. `subduction_keyhive` crate
  integrates Keyhive authorization. **This is the Ink & Switch answer to E2EE federated
  CRDT sync.** Watch for when it exits pre-alpha.
- **Keyhive + Subduction = the federation stack.** Already adopted Keyhive at S7.1. When
  lararium↔lararium federation firms up (post-S9), Subduction is the protocol to evaluate
  before building bespoke sync.
- **BeeKEM** (inside Keyhive): key encapsulation mechanism that makes relay nodes hold
  ciphertext only by construction. Forcing function for the ley-line relay design.
- **Multi-tenant RE isolation:** each user's wiki runs in its own Worker Thread. Handlers
  in wiki A cannot access wiki B's heap. Keyhive cap check at `re.subscribe()` ensures
  handler registration requires proof of write access to the bag.
- **CRDT + RE federation:** when two larraria merge Automerge changes, each RE fires
  independently on receipt of its merged changeset. Reactions apply causally-after-merge,
  in declaration order. Interleaving across larraria is acceptable under the same model
  Verse uses for networked game state: CRDT eventual consistency + best-effort local
  determinism per tick. Cross-replica speculative rollback is deferred.

---

## Deferred / Out of Scope

| Item | Why deferred |
|---|---|
| `openBrowserLarPeer` wiring | No browser test harness yet; architecture same as node peer |
| Federation / multi-peer sync | Correct after genesis stabilizes; not before |
| Grammar Invariant 4+ | Block until quine round-trip proves Invariant 3 |
| Keyhive WASM integration | `encryptedShareHint` field is the forward-compatible hook; Keyhive WASM not yet stable |
