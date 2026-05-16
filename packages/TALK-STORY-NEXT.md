# Talk Story — Next Lares Instance
## Verse Mesh + Virtual Cameras + SharktoothSigil Grammar

> Branch: `feature/lararium-node-4`
> Resume: `packages/HANDOFF.md` + `packages/ROADMAP.md`
> State: 48/48 tests pass. Typecheck clean — `@lararium/core`, `@lararium/tw5`, `@lararium/node`.

---

## The Quine Principle

The lararium engine self-documents in its own format.
Every invariant, every API contract, every design ruling lives as a meme —
a `text/x-memetic-wikitext` file under `bags/` — parseable by the same engine
that acts on it.
The grammar that parses those memes itself lives documented as memes.
That recursion carries the load-bearing architectural law: **quine pono**.

Two sprint arcs closed this session. They do not represent separate concerns —
they form one coherent web3 surface:

- **Verse polychronous CRDT mesh** — the sync boundary between Automerge bags and TW5 wiki worlds
- **SharktoothSigil grammar layer** — the parse boundary that reads the content those bags carry into TW5

The mesh delivers meme content to TW5.
The grammar parses that content using tiddlers the mesh itself delivered.
A remote peer can ship a new sigil definition as a CRDT patch.
The receiving peer's grammar hot-reloads within one frame.
That constitutes quine pono operating at runtime, not just at boot.

---

## Voice 1 — Map-Wisp: The Web3 Sync Surface

### What Changed — MemeSyncAdaptor Deleted

`meme-sync-adaptor.ts` no longer exists.
`$tw.syncer` provably does not run in Lararium — no `module-type:syncadaptor` tiddler
lives in the plugin bundle; `$tw.syncadaptor` stays undefined at boot.
All web2 syncer contract debt has cleared.

Two classes replace it, registered as **siblings** in the MemeProvider projection fan-out:

### IslandAdaptor — Causal-Island ↔ TW5 Bridge

`packages/lararium-tw5/src/island-adaptor.ts` | spec: `bags/@lares/api/v0.1/lararium/island-adaptor.md`

`IslandAdaptor` implements `MemeProjection` and owns the pre-sync time window:

| Path | Behavior |
|---|---|
| Inbound `crdt-remote` before sync | Buffer per `edgeIsland` id |
| `onSyncComplete(islandId)` | Drain that island's buffer in one `wiki.transact()` |
| Inbound non-CRDT (`tw-local`, `canon-hydrate`, `lares-command`) | Apply immediately via `_applyChange` |
| Inbound `crdt-remote` after sync | Return — `IslandAccumulator` owns this path |
| Outbound `saveTiddler` | `store.put()` direct — no syncer queue |
| Outbound `deleteTiddler` | `store.tombstone()` direct |

**Echo-loop guard:** `_applying: Map<string, ChangeOrigin>` keyed by apply slot.
`saveTiddler` and `deleteTiddler` return early whenever `_applying.size > 0`.
Multiple concurrent island replays use distinct slots and do not interfere.

Invariants I-1 through I-8 in `island-adaptor.md`:
I-1 echo-loop guard · I-2 island isolation · I-3 single transact per flush ·
I-4 post-sync pass-through · I-5 non-CRDT immediate apply · I-6 outbound guards ·
I-7 cross-bag tombstone resolution · I-8 child cleanup

### IslandAccumulator — Frame-Aligned CRDT Patch Buffer

`packages/lararium-core/src/island-accumulator.ts` | spec: `bags/@lares/api/v0.1/lararium/island-accumulator.md`

`IslandAccumulator` implements `MemeProjection` and owns the post-sync time window.
Platform-agnostic — no rAF, no TW5, no browser dependency.

```typescript
class IslandAccumulator implements MemeProjection {
  onSyncComplete(islandId?): void   // arms the gate
  onUriChanged(change): void        // enqueues post-sync crdt-remote only
  drain(budget?): LarTiddlerChange[] // caller applies; splices from queue
  get pending(): number
  get syncReady(): boolean
}
```

Invariants A-1 through A-5 in `island-accumulator.md`:
A-1 sync gate · A-2 crdt-remote filter · A-3 drain returns-and-removes ·
A-4 budget cap · A-5 platform-agnostic

**Wiring law — callers register both as siblings:**
```typescript
store.addProjection(adaptor);      // pre-sync + non-CRDT
store.addProjection(accumulator);  // post-sync crdt-remote
```

The adaptor and accumulator cover disjoint time windows. No double-write.

---

## Voice 2 — Tide-Caller: The Virtual Camera Model

### N Local Clocks — Polychronous CRDT Mesh

The Verse mesh runs **N local clocks**, one per TW5 VM instance
(Signal/INRIA polychronous model, Berry 1991).
Rendezvous between clock domains happens only at CRDT merge boundaries.
No global conductor exists.
Each peer runs at its own cadence (rAF in browser, `setInterval` in Node).
The CRDT carries state across the water in causal order.
The accumulator releases it to TW5 one frame at a time.

### Camera = Three-Tree Chain + View Frustum

A **virtual camera** holds its own three-tree chain over the shared wiki world-state:

```
wikitext source
    ↓  wiki.makeTranscludeWidget(rootTiddler, { document, parentWidget })
parse tree   (ParseTreeNode[])
    ↓  widget.makeChildWidgets()
widget tree  (Widget graph, bound to document)
    ↓  widget.render(container, null)
fake DOM     (TW5FakeElement tree)
    ↓  serialize / hydrate / paint
rendered output
```

All cameras in one VM slot **share one TW5 wiki** (world graph).
Each camera receives its own `document` instance — render surfaces stay separate.

**Inverted control:**
Each camera's `IslandAccumulator` drains into `wiki.transact()`.
The wiki fires `change` once per transact.
Each widget tree registered via `wiki.addEventListener("change", tree.refresh)` reacts.
Widget trees with no dependency on the changed tiddlers return `refresh()` in O(1).

**The view frustum** lives in the widget tree's root filter tiddler — not in the accumulator.
The accumulator carries no camera identity.

### CameraRegistration — Dynamic Timing

```typescript
interface CameraRegistration {
  accumulator: IslandAccumulator;
  tickMs?: number;   // 0 = rAF (browser default); N = setInterval(N ms)
  budget?:  number;  // patches per tick, default 200
}

// startRenderLoop — one timer per camera, independent drain cycles
tw5.startRenderLoop(cameras: CameraRegistration[], adaptor): () => void
```

Lower `tickMs` = higher render priority.
Cameras that accept user input (Story River typing, TLDraw drawing) dispatch events
through the widget tree's TW5 event bus.
`reaction-router.ts` catches `tm-verse-event`; `IslandAdaptor.saveTiddler`
handles outbound writes — no new write-back machinery needed for additional cameras.

### CameraMount — Static Structure

```typescript
interface CameraMount {
  rootTiddler: string;              // view frustum root
  document:    Document | TW5FakeDocument;
  container:   TW5FakeElement | HTMLElement;
}
// tw5.mountCamera(mount): () => void  — wires the three-tree chain once
```

`mountCamera` (structural, one-time) and `CameraRegistration` (dynamic, tick-driven)
stay separate concerns. Callers pair them. Teardown calls both.

Spec: `bags/@lares/api/v0.1/lararium/camera-mount.md` — invariants C-1 through C-5.

### Multi-Camera Example

```
VM Slot (one TW5 wiki — shared world graph)
│
├── Story River camera
│    ├── IslandAccumulator (tickMs=0, rAF ~60fps)
│    ├── wiki.makeTranscludeWidget("$:/core/ui/RootTemplate", window.document)
│    └── wiki.addEventListener("change", storyWidget.refresh)
│
├── TLDraw Canvas camera
│    ├── IslandAccumulator (tickMs=16, ~60fps setInterval)
│    ├── wiki.makeTranscludeWidget("lar:.../camera/tldraw-root", offscreenDoc)
│    └── wiki.addEventListener("change", canvasWidget.refresh)
│
└── Mini-map camera
     ├── IslandAccumulator (tickMs=200, 5fps — background priority)
     ├── wiki.makeTranscludeWidget("lar:.../camera/minimap-root", fakeDoc)
     └── wiki.addEventListener("change", minimapWidget.refresh)
```

### Fractal Causal Islands

Causal islands exist at every scale — as above, so below:

| Scale | Boundary |
|---|---|
| Inside lararium | Automerge bag boundary |
| Outside lararium | Peer-to-peer CRDT sync |
| Inside TW5 VM | Per-camera tick domain (distinct `tickMs`) |
| Outside TW5 VM | Warm slots — accumulating, not painting |

Background warm VMs serve as portal-spaces, comms links, nexus leyline feeds, remote signal.
Each constitutes a causal island with its own accumulator chain.

### VM Pool Diagram

```
Peer
 ├── BagResidencyManager
 ├── AutomergeDocStore[bag] — one per bag
 │
 └── VmPool<TW5RecipeVm>
      ├── slot[live] — rAF-driven, paints the UX
      │    ├── TW5Engine (one wiki — shared world graph)
      │    ├── IslandAdaptor
      │    ├── Camera[story-river]
      │    │    ├── IslandAccumulator (rAF)
      │    │    ├── widget tree → window.document
      │    ├── Camera[tldraw]
      │    │    ├── IslandAccumulator (16ms)
      │    │    └── widget tree → OffscreenCanvas doc
      │    └── Camera[...] — additional at own tick rates
      │
      ├── slot[warm-A] — accumulating, not painting
      └── slot[warm-B] — same
```

**Pending wire (next sprint):** `open-node-lar-peer.ts` creates one `IslandAdaptor`
but no `IslandAccumulator`. Wire one accumulator per bag in the recipe, register each
via `store.addProjection`, pass priority-ordered array to the node `setInterval` driver.

---

## Voice 3 — Ink-Clerk: The SharktoothSigil Grammar Layer

### Grammar as Tiddlers

A **SharktoothSigil** tiddler tagged `lar:///ha.ka.ba/tags/SharktoothSigil` defines
one sigil in the memetic-wikitext grammar via `lar-*` fields.
Adding a sigil to the engine means tagging a tiddler — no code change.

`GRAMMAR_TAG = "lar:///ha.ka.ba/tags/SharktoothSigil"` — exported from `@lararium/core`.

`grammar-cache.ts` reads all `[tag[GRAMMAR_TAG]]` tiddlers via `buildGrammarFromWiki()`
and derives the active sigil grammar from their fields.
The old `grammarRulesFromText` and `meme-grammar.ts` no longer exist.
The grammar lives entirely in tiddlers — hot-reloadable at runtime.

**Key `lar-*` fields:**

| Field | Meaning |
|---|---|
| `lar-kind` | `edge-sugar` · `child-slot` · `concurrency` · `concurrency-alias` · `pragma-alias` · `control` · `data` · `family` |
| `lar-name` | canonical sigil name |
| `lar-pattern` | inline match pattern |
| `lar-open-pattern` / `lar-close-pattern` | block container patterns |
| `lar-alias-for` | delegation target |

Tiddler body holds `\widget ~sigilName(...)` wikitext — the render procedure.
No JS. No code change. Only tiddler authoring.

### Self-Hosting State

`memetic-wikitext.tid` now holds one `[[sigils]]` TOML block — the `toml`
data-fence sigil that bootstraps its own parser. Zero `[[families]]` blocks remain.
The grammar self-hosts in SharktoothSigil tiddlers.

**Migrated (all in `packages/lararium-tw5/tiddlers/`):**

Core edge/child-slot: `sigil-ahu` · `sigil-kahea` · `sigil-aka` · `sigil-loulou` ·
`sigil-pranala` · `sigil-pranala-header` · `sigil-kau`

Concurrency: `sigil-lele` · `sigil-hui` · `sigil-puka` · `sigil-holo`

Aliases: `sigil-race` · `sigil-rush` · `sigil-sync`

English pragmas: `sigil-procedure` · `sigil-define` · `sigil-widget` ·
`sigil-function` · `sigil-if` · `sigil-for`

Library: `sigil-toml` · Stub: `sigil-tick` (`\tick`/`\simulate`, name deferred UE6 ~2027)

Families: 8 × `sigil-family-*.tid`

**Remaining migrations** (TOML monolith → tiddlers, in order):
1. Block-container with `close_pattern` — `wehe`, `meme`, `heihei`, `wai`, `huli`
2. Scope/binding — `\let`, `\var`, `\const`, `waiho`
3. OODA-HA narrative — `papalohe`, `pae` (wire to `reaction-router.ts`)
4. Remaining device/data sigils

### Verse Operator Mapping

The sigil vocabulary maps to Unreal Verse operators — same concurrency semantics,
web3 polychronous CRDT context:

| Sigil | Hawaiian | Verse | Semantics |
|---|---|---|---|
| `\spawn` / `lele` | lele (to fly) | `spawn` | detached async task |
| `\sync` / `hui` | hui (to gather) | `sync` | await-all |
| `\race` / `holo` | holo (to run) | `race` | cancelling race; first wins, losers cancel |
| `\rush` / `puka` | puka (hole) | `rush` | first-wins, no cancel |
| `\tick` / `\simulate` | pending | `OnSimulate` | per-nalu device lifecycle hook |
| `hoolele` | hoolele | (6th — no Verse match) | structured escape-hatch |

Six-operator concurrency ontology complete and stable.
Verse docs: `dev.epicgames.com/documentation/en-us/fortnite`

### Grammar Boot Path

1. **Plugin unpack** — `LARES_MEMETIC_WIKITEXT_PLUGIN` preloaded tiddler; TW5 unpacks
   18+ inner modules + all SharktoothSigil tiddlers as shadow tiddlers
2. **Grammar cache warm** — `getGrammar(wiki)` reads `[tag[GRAMMAR_TAG]]` on first call;
   change listener invalidates cache when SharktoothSigil tiddlers change; live hot-reload

`lar-sigil.ts` wikirule (collapsed from two files):
`types = { block: true, inline: true }` — one rule, both forms.
Block containers claim when a closer follows; leaf forms fall through to
`MacroCallWidget → \widget ~` naturally.
`DEFAULT_RULES_EXCEPT = new Set()` — nothing blocked.

---

## Voice 4 — Lares Gatekeeper: Laws to Preserve

**Accumulator carries no camera identity.** View frustum lives in the widget tree's
root filter tiddler. Inverted control — the wiki fires change; cameras react.

**`$tw.syncer` does not run.** No `module-type:syncadaptor` tiddler in the bundle.
Do not add one. `IslandAdaptor` wires directly via `store.addProjection`.

**`GRAMMAR_TAG` only.** `GRAMMAR_MEME_URI` no longer exists. Sigils register by
tagging a tiddler, not by URI. Do not add a new GRAMMAR_MEME_URI variant.

**Remove TOML blocks after migration.** A migrated sigil's TOML block in
`memetic-wikitext.tid` becomes dead code. Tiddler sigils take priority over TOML,
but dead blocks mislead readers. Remove them.

**ONE parser, FOUR call sites** (E.10.1→E.10.4):
`deserializeCarrier` · `saveTiddler → splitBodyTiddler` · `exportMemeText` · `test-quine.ts`.
No fifth call site. No fork. No drift.

**TW5 VM primacy.** Logic that can live in the wiki stays in the wiki.
TS covers only CRDT, network, Keyhive WASM, and worker I/O.

**Web3 only.** No web2 models, code, or flows enter the Lares stack.

**Bag = Automerge doc = sync boundary.** Wikis compose; bags persist.

**`smol-toml` stays a library tiddler.** Do not inline TOML parsing elsewhere.

---

## Orientation

```sh
pnpm test:unit                                                    # 48/48
pnpm --filter @lararium/tw5 build                                 # 18 modules → 119 tiddlers
pnpm --filter @lararium/tw5 exec tsx scripts/smoke-plugin-boot.ts # shadow + grammar tiddlers
pnpm --filter @lararium/core exec tsc --noEmit
pnpm --filter @lararium/tw5  exec tsc --noEmit
pnpm --filter @lararium/node exec tsc --noEmit
```

Key files:

| File | Role |
|---|---|
| `packages/lararium-tw5/src/island-adaptor.ts` | causal-island bridge |
| `packages/lararium-core/src/island-accumulator.ts` | frame buffer |
| `packages/lararium-tw5/src/tw5-vm.ts` | `CameraRegistration`, `startRenderLoop` |
| `packages/lararium-tw5/src/grammar-cache.ts` | `buildGrammarFromWiki` |
| `packages/lararium-core/src/grammar-invariants.ts` | `GRAMMAR_TAG` |
| `packages/lararium-tw5/tiddlers/sigil-*.tid` | SharktoothSigil grammar tiddlers |
| `bags/@lares/api/v0.1/lararium/island-adaptor.md` | I-1 through I-8 |
| `bags/@lares/api/v0.1/lararium/island-accumulator.md` | A-1 through A-5 |
| `bags/@lares/api/v0.1/lararium/camera-mount.md` | C-1 through C-5 |
| `bags/@lares/docs/lararium/verse-mesh.md` | mesh design narrative |
| `bags/@lares/api/v0.1/pono/nihomano-sigils.md` | full sigil vocabulary spec |

**Next work in priority order:**

1. Wire N-accumulator per bag in `open-node-lar-peer.ts` + node `setInterval` driver
2. Implement `mountCamera()` on `TW5Engine` (~20 lines, parallel to `mountPanel`)
3. Jest → Vitest migration (config swap, low cost)
4. `IslandAdaptor.saveTiddler` 300–500ms debounce + projection auto-truncate (Path K)
5. Remaining SharktoothSigil migrations — block-container sigils first

---

## Closing Note — Lares Liminal

The mesh and the grammar meet at one point: the moment a meme tiddler arrives
through an Automerge patch, the `IslandAccumulator` holds it at the frame boundary,
the `IslandAdaptor` applies it via `wiki.transact()`, the wiki fires `change`,
and every registered camera's widget tree decides whether to repaint.

If that tiddler carries a `lar:///ha.ka.ba/tags/SharktoothSigil` tag,
the grammar cache invalidates and rebuilds from the new tiddler set —
before the next parse call.

The peer that receives a sigil definition over CRDT gains the ability to parse
content written with that sigil — within the same frame.

That constitutes the quine closing on itself at runtime.

Welcome to the next turn. The water knows where it goes.
