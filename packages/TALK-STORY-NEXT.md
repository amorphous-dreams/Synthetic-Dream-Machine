# Talk Story — Next Lares Instance
## Verse Mesh + Virtual Cameras + SharktoothSigil Grammar

> Branch: `feature/lararium-node-4`
> Resume: `packages/HANDOFF.md` + `packages/ROADMAP.md`
> State: 167/167 tests pass · typecheck clean · 18 Vite modules → 119 inner tiddlers · mountCamera() wired · mountPanel() delegates to it

---

## The Sacred Chao Spins Once Per Session

The Chao carries three faces. This session enacted all three.

**Ha / Hodge** — the structure that holds its shape:
`IslandAdaptor`, `IslandAccumulator`, `CameraRegistration`, `CameraMount` — new
invariant forms, documented in the corpus, grounded in code.

**Ka / Podge** — the soul-fire that moves:
The nalu — Automerge patches arriving, accumulating at the frame boundary, draining
into `wiki.transact()`, the wiki firing `change`, cameras reacting at their own rates.
The grammar hot-reloading when a SharktoothSigil tiddler arrives over CRDT.
The quine closing on itself at runtime.

**Ba / Spin** — the psyche-path that carries change:
`meme-sync-adaptor.ts` deleted. `$tw.syncer` gone. The web2 ghost cleared.
The yin-collapse law enacted: TS bridges collapsed toward TW5-native where possible.
Grammar self-hosted in tiddlers. JS sigil widgets: zero.

The Chao spins. Both faces stay necessary. Form and fire together.

---

## Ha — What Holds Its Shape

### The Web3 Sync Surface (heleuma-ka anchors)

Two classes replaced `meme-sync-adaptor.ts`. Both register as **siblings** in the
MemeProvider projection fan-out — not nested, not sequential. Disjoint time windows.

```typescript
store.addProjection(adaptor);      // IslandAdaptor — pre-sync + non-CRDT
store.addProjection(accumulator);  // IslandAccumulator — post-sync crdt-remote only
```

**`IslandAdaptor`** (`packages/lararium-tw5/src/island-adaptor.ts`)
Causal-island ↔ TW5 wiki bridge. Implements `MemeProjection`. Owns:
- Pre-sync inbound: buffer per `edgeIsland` id until `onSyncComplete(islandId)` fires
- Flush: one `wiki.transact()` per island — one widget refresh pass, not one per tiddler
- Non-CRDT origins (`tw-local`, `canon-hydrate`, `lares-command`): apply immediately
- Post-sync `crdt-remote`: return immediately — `IslandAccumulator` owns this path
- Outbound: `saveTiddler → store.put()` / `deleteTiddler → store.tombstone()` — direct
- Echo-loop guard: `_applying: Map<string, ChangeOrigin>` keyed by slot; `saveTiddler`
  and `deleteTiddler` no-op while non-empty

Invariants I-1–I-8 in `bags/@lares/api/v0.1/lararium/island-adaptor.md`.

**`IslandAccumulator`** (`packages/lararium-core/src/island-accumulator.ts`)
Frame-aligned CRDT patch buffer. Implements `MemeProjection`. Platform-agnostic —
zero rAF, zero TW5, zero browser import. Owns:
- Post-sync `crdt-remote` only — gate armed by `onSyncComplete()`
- `drain(budget)` — returns up to `budget` entries, splices from queue; caller applies

Invariants A-1–A-5 in `bags/@lares/api/v0.1/lararium/island-accumulator.md`.

### Virtual Camera Structure

**`CameraRegistration`** — dynamic timing, exported from `@lararium/tw5`:
```typescript
interface CameraRegistration {
  accumulator: IslandAccumulator;
  tickMs?: number;  // 0 = rAF (default); N = setInterval(N ms)
  budget?:  number; // patches per tick, default 200
}
tw5.startRenderLoop(cameras: CameraRegistration[], adaptor): () => void
```

**`CameraMount`** — static structure (spec: `bags/@lares/api/v0.1/lararium/camera-mount.md`):
```typescript
interface CameraMount {
  rootTiddler: string;             // view frustum root tiddler
  document:    Document | TW5FakeDocument;
  container:   TW5FakeElement | HTMLElement;
}
tw5.mountCamera(mount: CameraMount): () => void  // ← not yet implemented
```

These two concerns stay separate. `mountCamera` wires the three-tree chain once.
`CameraRegistration` drives the tick. Callers pair them; teardown calls both.

**Three-tree chain per camera:**
```
wikitext source
  → wiki.makeTranscludeWidget(rootTiddler, { document, parentWidget })
parse tree (ParseTreeNode[])
  → widget.makeChildWidgets()
widget tree (Widget graph, bound to document)
  → widget.render(container, null)
fake DOM (TW5FakeElement tree)
  → serialize / hydrate / paint
```

**VM Pool — current shape:**
```
Peer
 ├── BagResidencyManager
 ├── AutomergeDocStore[bag]  ← one per bag
 └── VmPool<TW5RecipeVm>
      ├── slot[live]  ← rAF-driven, paints UX
      │    ├── TW5Engine (one wiki — shared world graph)
      │    ├── IslandAdaptor
      │    ├── Camera[story-river]
      │    │    ├── IslandAccumulator (tickMs=0, rAF)
      │    │    └── widget tree → window.document
      │    ├── Camera[tldraw]
      │    │    ├── IslandAccumulator (tickMs=16)
      │    │    └── widget tree → OffscreenCanvas doc
      │    └── Camera[...]  ← N cameras, own tick rates
      ├── slot[warm-A]  ← accumulating, not painting
      └── slot[warm-B]  ← same
```

### SharktoothSigil Grammar (Hodge face)

`GRAMMAR_TAG = "lar:///ha.ka.ba/tags/SharktoothSigil"` — the single registration surface.
Tagging a tiddler with it teaches the parser a new word. No code change required.
`grammar-cache.ts` reads all `[tag[GRAMMAR_TAG]]` tiddlers at first call and on change.

**Self-hosting state:** `memetic-wikitext.tid` holds one `[[sigils]]` TOML block —
the `toml` data-fence sigil. Zero `[[families]]` blocks. Grammar lives in tiddlers.

**Migrated sigils** (`packages/lararium-tw5/tiddlers/sigil-*.tid`):
Core: `ahu` · `kahea` · `aka` · `loulou` · `pranala` · `pranala-header` · `kau`
Concurrency: `lele` · `hui` · `puka` · `holo` + aliases `race` · `rush` · `sync`
Pragmas: `procedure` · `define` · `widget` · `function` · `if` · `for` · `toml`
Stubs: `tick` (`\tick`/`\simulate`, Hawaiian name deferred to UE6 ~2027)
Families: 8 × `sigil-family-*.tid`

**Remaining** (TOML → tiddler, in order):
1. Block-container with `close_pattern`: `wehe` · `meme` · `heihei` · `wai` · `huli`
2. Scope/binding: `\let` · `\var` · `\const` · `waiho`
3. OODA-HA narrative: `papalohe` · `pae` (wire to `reaction-router.ts`)
4. Remaining device/data sigils

---

## Ka — What Moves

### The Nalu — Pulse Below the Grammar

From `bags/@lares/api/v0.1/pono/nalu.md`:

> *nalu* — wave, surf; the wave-form that carries energy across distance.
> A nalu does not carry one molecule of water — it carries the entire shaped movement.

The nalu arrives once per `wiki.transact()`. All widgets see the same consistent state.
Nothing sees a partial write. The accumulator gates patches at the frame boundary.
The adaptor releases them as one coherent wave.

Three implementations of the same pattern:

| Layer | Accumulate | Boundary | Wave arrives |
|---|---|---|---|
| TW5 | `wiki.addTiddler() ×N` | `wiki.nextTick()` | `refresh(changedTiddlers)` |
| Verse/UEFN | device events mutate | simulation tick | `OnSimulate(StagedUpdates)` |
| Lararium | CRDT patches queue | `IslandAccumulator.drain()` | `wiki.transact()` → `change` |

### Inverted Control — The View Frustum Stays in the Widget Tree

The accumulator carries no camera identity.
It drains into `wiki.transact()`.
The wiki fires `change`.
Each widget tree registered via `wiki.addEventListener("change", tree.refresh)` reacts.
Trees with no dependency on changed tiddlers return `refresh()` in O(1).
The view frustum lives in the widget tree's root filter tiddler — not in the accumulator.

This resolves to the Elm Architecture / Solid.js / MobX pattern:
one model (wiki world graph), N view functions (widget trees), no shared mutable render state.

### Fractal Causal Islands (Fuller-Zelenka basis)

From `bags/@lares/api/v0.1/pono/federated-causal-islands.md`:

> Events in Universe are not simultaneously apprehended by any observer.
> Any boundary across which causality cannot be guaranteed simultaneously IS a causal island boundary.

| Scale | Causal boundary |
|---|---|
| Inside lararium | Automerge bag boundary |
| Outside lararium | Peer-to-peer CRDT sync |
| Inside TW5 VM | Per-camera tick domain (distinct `tickMs`) |
| Outside TW5 VM | Warm slot — accumulating, not painting |

Background warm VMs serve as portal-spaces, comms links, nexus leyline feeds.
Each constitutes a causal island with its own accumulator chain. As above, so below.

### Grammar Ka — Hot-Reload at Runtime

The grammar cache registers `wiki.addEventListener("change", invalidate)`.
When a CRDT patch delivers a new SharktoothSigil tiddler — arriving through
`IslandAccumulator.drain()` → `wiki.transact()` → `change` — the cache invalidates.
The next `getGrammar(wiki)` call rebuilds from the updated tiddler set.

A remote peer ships a sigil definition as a CRDT patch.
The receiving peer gains the ability to parse content written with that sigil — within one frame.

**The quine closes on itself at runtime, not only at boot.**

### Verse Operator Mapping — The Ka of the Concurrency Ontology

| Sigil / Hawaiian | Verse | Ka — how it moves |
|---|---|---|
| `lele` / `\spawn` | `spawn` | detaches and flies; caller does not wait |
| `hui` / `\sync` | `sync` | gathers all threads; none proceed until all complete |
| `holo` / `\race` | `race` | runs; first to finish wins, all others cancel |
| `puka` / `\rush` | `rush` | first wins, others continue — no cancellation |
| `\tick` / `\simulate` | `OnSimulate` | per-nalu device hook; fires once per wave |
| `hoolele` | — | makes others fly; 6th operator; structured escape-hatch |

Six-operator ontology complete and stable.
`hoolele` carries no Verse equivalent — it constitutes the extension Lararium adds.

---

## Ba — The Path of Change

### Yin-Collapse Enacted

The yin-collapse law (from `bags/@lares/api/v0.1/pono/reaction-graph.md`):
collapse provisional TS bridges toward TW5-native implementations.
Irreducible TS remains only for CRDT, network, Keyhive WASM, and worker I/O.

**This session:**
- `meme-sync-adaptor.ts` deleted — web2 syncer ghost cleared
- `meme-grammar.ts` deleted — TOML monolith parse path retired
- `ReactionEngine` class deleted — replaced by `reaction-router.ts` TW5 startup module
- `kau.ts` + `render-modes.ts` deleted — replaced by `sigil-kau.tid` wikitext
- JS sigil widgets: zero remain in the plugin

**The yin-collapse target holds:** logic that can live in the wiki stays in the wiki.

### Laws to Preserve

**Accumulator carries no camera identity.** Inverted control. Wiki fires; cameras react.

**`$tw.syncer` does not run.** No `module-type:syncadaptor` in the bundle. Do not add one.

**`GRAMMAR_TAG` only.** `GRAMMAR_MEME_URI` deleted. Sigils register by tagging.

**Remove TOML blocks after migration.** Dead blocks mislead readers.

**ONE parser, FOUR call sites** (E.10.1–E.10.4):
`deserializeCarrier` · `saveTiddler → splitBodyTiddler` · `exportMemeText` · `test-quine.ts`

**`smol-toml` stays a library tiddler.** Do not inline TOML parsing elsewhere.

**Content MUST NOT precede authority** (from `causal-islands.md`).
Authority-first sync order: authenticate → authority graph → visible rooms → manifest →
capability ops → CRDT heads → delta payloads → projection receipts.

### Pending Wire — Node Peer N-Accumulator

`open-node-lar-peer.ts` creates one `IslandAdaptor` but no `IslandAccumulator`.
Wire one per bag in the recipe. Register each via `store.addProjection`.
Drive with `setInterval(() => adaptor.flushAll(accumulators, budget), 16)`.

### Next Work (priority order)

1. `mountCamera()` on `TW5Engine` — ~20 lines, parallel to `mountPanel()` · spec C-1 through C-5
2. UEFN scene importer — `.verse` + `.umap` → Automerge bag of tiddlers + pranala edges
3. `IslandAdaptor.saveTiddler` 300–500ms debounce + projection auto-truncate (Path K)
4. SharktoothSigil remaining migrations — block-container sigils first (`wehe`, `meme`, `heihei`)

### Landed This Turn (turn 12)

- **`mountCamera()`** — `CameraMount` interface + isomorphic three-tree chain on `TW5Engine`.
  `mountPanel()` collapsed to delegate — story river becomes a camera view on `"$:/core/ui/RootTemplate"`.
  `rootWidget.children` singleton wiring deleted. `CameraMount` exported from `@lararium/tw5`.

### Landed This Turn (turn 11)

- **Jest → Vitest** — `jest.config.cjs` deleted in all three packages; `vitest.config.ts` replaces it;
  `--experimental-vm-modules` flag gone; 167/167 tests pass on native ESM
- **N-accumulator node wire** — `open-node-lar-peer.ts` step 9: one `IslandAccumulator` per bag in
  `vmBagStack`; each registered via `peer.addProjection`; `setInterval(16ms)` drives `adaptor.flushAll`;
  `stopTick` added to `NodeLarPeerResult` for graceful teardown

---

## Orientation

```sh
pnpm test:unit                                                       # 48/48
pnpm --filter @lararium/tw5 build                                    # 18 modules → 119 tiddlers
pnpm --filter @lararium/tw5 exec tsx scripts/smoke-plugin-boot.ts    # shadow + grammar check
pnpm --filter @lararium/core exec tsc --noEmit
pnpm --filter @lararium/tw5  exec tsc --noEmit
pnpm --filter @lararium/node exec tsc --noEmit
```

| File | Role |
|---|---|
| `packages/lararium-tw5/src/island-adaptor.ts` | causal-island bridge |
| `packages/lararium-core/src/island-accumulator.ts` | frame buffer |
| `packages/lararium-tw5/src/tw5-vm.ts` | `CameraRegistration` · `startRenderLoop` |
| `packages/lararium-tw5/src/grammar-cache.ts` | `buildGrammarFromWiki` |
| `packages/lararium-core/src/grammar-invariants.ts` | `GRAMMAR_TAG` |
| `packages/lararium-tw5/tiddlers/sigil-*.tid` | SharktoothSigil grammar tiddlers |
| `bags/@lares/api/v0.1/lararium/island-adaptor.md` | I-1 through I-8 |
| `bags/@lares/api/v0.1/lararium/island-accumulator.md` | A-1 through A-5 |
| `bags/@lares/api/v0.1/lararium/camera-mount.md` | C-1 through C-5 |
| `bags/@lares/docs/lararium/verse-mesh.md` | mesh design narrative |
| `bags/@lares/api/v0.1/pono/nalu.md` | the wave — below the grammar |
| `bags/@lares/api/v0.1/pono/causal-islands.md` | island law + authority-first order |
| `bags/@lares/api/v0.1/mu/chao.md` | Sacred Chao — Ha/Ka/Ba triad |

---

## The Chao Closes

The mesh delivers meme content to TW5.
The grammar parses that content using tiddlers the mesh delivered.
The accumulator holds patches at the frame boundary.
The adaptor releases them as one nalu.
The wiki fires `change`.
Every registered camera decides whether to repaint.

If the arriving tiddler carries `lar:///ha.ka.ba/tags/SharktoothSigil`,
the grammar cache invalidates within that frame —
and the next peer who sends content written with the new sigil
receives a parser ready to read it.

Ha holds the form.
Ka animates the fire.
Ba carries the change.

The water knows where it goes.
Welcome to the next turn.
