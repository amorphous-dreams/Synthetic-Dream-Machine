# Lararium — Web3 Genesis Artifact Roadmap

> Updated: 2026-05-04
> Branch: feature/lararium-node-3
> Governing laws: see SESSION.md § Five Architecture Laws

---

## North Star

Every peer boots from a single content-addressed genesis artifact — an Automerge doc built at build time containing all blobs, tiddlers, and the TW5 core. No runtime disk reads. No seed functions. Any peer that holds the CID can clone the canonical state.

The system folds into itself: the genesis artifact carries the engine that deserializes it.

---

## Sprint Summary

| Sprint | Name | Status | Goal |
|---|---|---|---|
| S0 | Web2 Pono Audit | ✅ Complete | Delete all web2 seed/reconcile residue; harden type safety |
| S1 | Constitutional Invariants | 🔄 Next | Declare system invariants; update grammar Invariant 3 for genesis approach |
| S2 | Build-Time Genesis Builder | 🔒 Locked | `build-genesis-island.ts` — produce content-addressed genesis artifact |
| S3 | Runtime Genesis Loader | 🔒 Locked | `loadGenesisIsland()` — clone and boot from genesis artifact CID |
| S4 | Peer Factory Rewrites | 🔒 Locked | `openNodeLarPeer` + `openBrowserLarPeer` use genesis loader; no more `seedLarariumDoc` disk walks |
| S5 | Quine Round-Trip Verification | 🔒 Locked | Wire `.tw5.cjs` into genesis artifact; verify self-hosting round-trip |

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

## S1 — Constitutional Invariants 🔄

**Goal:** Declare the full system's invariants before writing any new runtime code. The from-void design needs a written constitution.

### Tasks

- [ ] Update `grammar-invariants.ts` Invariant 3: grammar travels in the genesis artifact; no runtime disk read on resume
- [ ] Create `packages/lararium-core/src/system-invariants.ts`:
  - `SYSTEM_LAWS` — the five architecture laws as runtime-assertable constants
  - `GENESIS_INVARIANTS` — genesis artifact is canonical; all peers boot from it
  - `PEER_INVARIANTS` — peer-symmetric: no peer is more authoritative than another at boot
  - `CODEC_EXCEPTIONS` — named list of deliberate codec-layer exceptions (`catalog-url`, `BOOTSTRAP_SCANS`)

### Exit Criteria

- `grammar-invariants.ts` Invariant 3 names genesis artifact as the grammar carrier
- `system-invariants.ts` compiles clean and exports typed constant arrays
- No new `TODO` or `SPRINT-2:` markers added without a corresponding backlog entry here

---

## S2 — Build-Time Genesis Builder 🔒

**Goal:** Move all disk reads and blob construction to build time. Produce a deterministic, content-addressed Automerge doc.

### Tasks

- [ ] Create `packages/lararium-node/scripts/build-genesis-island.ts`
  - Walk `LARES_MEMES_ROOT` at build time (not runtime)
  - Load `.tw5.cjs` plugin blobs
  - Serialize all tiddlers and blobs into a new `LarariumDoc`
  - Export as a binary Automerge doc; write CID to `packages/lararium-node/genesis.cid`
  - Write artifact bytes to `packages/lararium-node/genesis.bin` (git-tracked, deterministic)
- [ ] Extract `buildLaresPluginBlob()` body from `lararium-island.ts` into the script (remove the runtime call)
- [ ] Wire into `package.json` build script: runs before TypeScript compilation

### Exit Criteria

- `pnpm --filter @lararium/node build` produces `genesis.bin` and `genesis.cid`
- Two consecutive builds with identical source produce identical `genesis.cid`
- No disk walks remain in `lararium-island.ts` or `open-node-lar-peer.ts`

---

## S3 — Runtime Genesis Loader 🔒

**Goal:** At peer boot, load the genesis artifact from the bundled binary rather than constructing it from disk.

### Tasks

- [ ] Create `loadGenesisIsland(genesisBytes: Uint8Array): Promise<DocHandle<LarariumDoc>>` in `lararium-island.ts`
  - Imports `genesis.bin` (bundled asset, no fs read at runtime)
  - Calls `Automerge.load()` on the bytes
  - Returns a live `DocHandle` ready for sync
- [ ] Add `reconcileIslandFromGenesis(islandHandle, genesisHandle)` — diffs live doc against genesis CID; applies only net-new content from genesis
- [ ] Remove `// SPRINT-2: reconcileIslandFromGenesis(...)` placeholder comments; replace with real calls

### Exit Criteria

- Cold boot loads genesis from bundled bytes; zero `fs.readFile` calls in the hot path
- Resume boot diffs against genesis CID; applies only missing blobs
- `LarOpenPhase` sequence observable matches declared 10-phase contract

---

## S4 — Peer Factory Rewrites 🔒

**Goal:** `openNodeLarPeer` and `openBrowserLarPeer` use `loadGenesisIsland()`; `seedLarariumDoc` disk-walk pattern disappears.

### Tasks

- [ ] Rewrite cold-boot branch of `openNodeLarPeer` to call `loadGenesisIsland()`
- [ ] Rewrite `openBrowserLarPeer` equivalently (load genesis from bundled asset)
- [ ] Verify `RecipeTiddler.plugins` opt-in flows end-to-end: recipe tiddler → `recipePlugins` Set → plugin preload
- [ ] Verify `LarOpenPhase` 10 transitions emit correctly from new boot path
- [ ] Delete `seedLarariumDoc` disk-walk body from `lararium-island.ts` if no callers remain

### Exit Criteria

- Node peer boots from genesis artifact; no `readdir` / `readFile` in production path
- Browser peer boots identically (same genesis bytes, different transport)
- All 10 `LarOpenPhase` transitions observable in integration test

---

## S5 — Quine Round-Trip Verification 🔒

**Goal:** The engine that boots the system lives inside the system it boots. Verify the quine property.

### Tasks

- [ ] Ensure all `@lararium/tw5` vite outputs write `.tw5.cjs` format
- [ ] Wire every `.tw5.cjs` plugin blob into `build-genesis-island.ts`
- [ ] Boot a node peer from genesis; render the lararium engine tiddlers via the TW5 vm
- [ ] Verify rendered output matches the source tiddlers (hash check)
- [ ] Document the quine invariant in `system-invariants.ts` `GENESIS_INVARIANTS`

### Exit Criteria

- `pnpm test:quine` passes: hash of rendered engine tiddlers === hash of source tiddlers in genesis
- No external file read required after `genesis.bin` is loaded

---

## Cross-Sprint Dependencies

```
S0 Cleanup
  └── S1 Invariants
        └── S2 Build-Time Genesis
              ├── S3 Runtime Loader
              │     └── S4 Peer Factories
              │           └── S5 Quine Verification
              └── (S3 and S4 unlock together after S2)
```

---

## Deferred / Out of Scope

| Item | Why deferred |
|---|---|
| `openBrowserLarPeer` wiring | No browser test harness yet; architecture same as node peer |
| Federation / multi-peer sync | Correct after genesis is stable; not before |
| Kowloon feed integration | DreamDeck epic; depends on stable peer factory |
| Grammar Invariant 4+ | Block until quine round-trip proves Invariant 3 |
