# Session State — Lararium Web3 Refactor

> Updated: 2026-05-04
> Branch: feature/lararium-node-3
> Purpose: Resume artifact — enough state to continue without prior chat context

---

## Bootstrap Paste

```text
Resume from /home/joshu/Synthetic-Dream-Machine/SESSION.md.
Branch: feature/lararium-node-3.
Active work: 5-sprint web3 genesis artifact refactor (ROADMAP.md).
Architecture laws in memory: feedback_architecture_principles.md.
Do not re-decide the five architecture laws or the BOOTSTRAP_SCANS / Path α grammar decision.
Sprint 0 complete. Sprint 1 complete. Next: Sprint 2 — build-genesis-island.ts.
```

---

## What Just Happened (Sprint 1 Complete)

### Added to `packages/lararium-core/src/system-invariants.ts`

- `SYSTEM_LAWS` — five architecture laws as typed witnessing constants (IDs importable by tests and agents)
- `GENESIS_INVARIANTS` — causal origin, content-addressed identity, immutability, quine property stub (`@phase: S5`)
- `PEER_INVARIANTS` — boot symmetry, post-boot operational divergence is not authority, capability-from-receipt

### Already completed (not stale — Sprint 1 ran before SESSION.md was updated)

- `grammar-invariants.ts` Invariant 3 — grammar travels in genesis artifact; peer halts on hash divergence; transitional `CODEC_EX_PRE_S2_COLD_BOOT` named
- `CODEC_EXCEPTIONS` in `system-invariants.ts` — was present from prior pass

### Clarified sprint boundary

- `buildLaresPluginBlob()` runtime body deletion is **S2 scope**, not S1. The `// SPRINT-2` marker at the call site in `lararium-island.ts` line 211 is correct. CURRENT-EPIC.md Sprint 1 description overshot; corrected.

---

## What Just Happened (Sprint 0 Complete)

### Deleted

- `packages/lararium-node/src/seed-grammar-tiddler.ts` — web2 runtime disk-read pattern; gone entirely
- Exports removed from `packages/lararium-node/src/index.ts`

### Refactored (web2 residue excised, SPRINT-2 markers placed)

- `packages/lararium-node/src/lararium-island.ts`
  - Removed `reconcileEngineBlobIfChanged()` and `reconcileLaresPluginBlobIfChanged()`
  - Marked `buildLaresPluginBlob()` call: moves to `buildGenesisIsland` at build time
  - Added `pluginInstallable: "true"` and `pluginTitle` tagging in `seedBlobDescriptors()`
- `packages/lararium-node/src/open-node-lar-peer.ts`
  - Collapsed vacuous `findWithProgress` conditional
  - Added `recipePlugins` Set filter — vendored plugins opt-in per Recipe, not default
  - Added `catalog-url` named-exception comment (codec layer, not CRDT)
  - Replaced reconcile call sites with `// SPRINT-2: reconcileIslandFromGenesis(...)` markers

### Type safety hardened

- `packages/lararium-tw5/src/types/tiddlywiki.d.ts` — added `declare global { var $tw: TW5Instance | undefined }`
- `packages/lararium-tw5/src/tw5-vm.ts` — removed `const g = globalThis as any`; all `g.` references replaced with typed `globalThis.$tw` / `(globalThis as Record<string, unknown>).process`

### New interfaces

- `packages/lararium-core/src/recipe.ts` — `RecipeTiddler.plugins?: readonly string[]` + `parsePlugins()`
- `packages/lararium-core/src/composite-store.ts` — `getRecipe()` reads and returns plugins field

### Grammar bootstrap resolved

- Path α chosen: raw carrier text stored in CRDT; no grammar on first parse (BOOTSTRAP_SCANS serves as the codec escape hatch)
- `packages/lararium-core/src/grammar-invariants.ts` Invariant 2 updated to document the decision

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
- Documented in `packages/lararium-core/src/grammar-invariants.ts` Invariant 2

---

## Open Work, In Order

See ROADMAP.md Sprint column for sequencing.

| # | Item | Sprint | Status |
|---|---|---|---|
| 1 | `grammar-invariants.ts` Invariant 3 — declare genesis artifact approach | S1 | ✅ Done |
| 2 | `system-invariants.ts` in `lararium-core` — constitutional declaration | S1 | ✅ Done |
| 3 | `packages/lararium-node/scripts/build-genesis-island.ts` — build-time genesis builder | S2 | Next |
| 4 | `loadGenesisIsland()` runtime function | S3 | Locked |
| 5 | Rewrite `openNodeLarPeer` + `openBrowserLarPeer` to use genesis artifact | S4 | Locked |
| 6 | Wire `.tw5.cjs` outputs into genesis artifact; verify quine round-trip | S5 | Locked |

---

## Do Not Re-Decide

- Five architecture laws (above)
- Path α for grammar bootstrap
- `catalog-url` as named codec-layer exception (not web2)
- Vendored plugins optional via `RecipeTiddler.plugins`; no default recipe auto-loads them
- `.tw5.cjs` format (CJS exports, not IIFE) for TW5 plugin modules

---

## Likely Next Files To Touch

- `packages/lararium-core/src/grammar-invariants.ts` — Invariant 3
- `packages/lararium-core/src/system-invariants.ts` — create new
- `packages/lararium-node/scripts/build-genesis-island.ts` — create new (Sprint 2)
- `packages/lararium-node/src/lararium-island.ts` — `buildGenesisIsland` extraction
