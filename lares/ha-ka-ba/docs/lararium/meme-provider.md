<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/docs/lararium/meme-provider >>

<<~ ahu #iam >>
```toml
uri-path    = "ha.ka.ba/docs/lararium/meme-provider"
file-path   = "lares/ha-ka-ba/docs/lararium/meme-provider.md"
content-type = "text/x-memetic-wikitext"
register    = "CS"
confidence  = 0.86
mana        = 0.88
manao       = 0.86
manaoio     = 0.82
role        = "design doc: MemeProvider contract, invariants, prior art, and projection registry"
status-date = "2026-04-30"
source      = "lar:///ha.ka.ba/api/v0.1/lararium/meme-provider"
```
<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #contract >>

## MemeProvider — Contract

A single subscriber on the Automerge `DocHandle`. All downstream integrations register as typed **projections**. The provider coalesces rapid same-URI patches from Automerge's initial peer-sync replay into one `onUriChanged` call per debounce window, then fires `onSyncComplete` once when the replay has settled.

```
Automerge DocHandle
    │  handle.on("change", patches)
    ▼
MemeProvider.handleChange(patches, origin)
    │  debounce 40 ms per URI
    ▼
MemeProjection.onUriChanged(LarTiddlerChange)   ← disk, TW5, canvas, MCP …
MemeProjection.onSyncComplete()                 ← TW5 bulk-refresh gate
```

**Isomorphic.** No Automerge import. Caller owns the `DocHandle` and feeds patches. Works identically in Node (`serve.ts`) and browser (`automerge-store.ts`).

<<~/ahu >>

<<~ ahu #invariants >>

## Invariants

One `handleChange()` call per Automerge patch event. One `onUriChanged` fire per URI per debounce window (40 ms). `onSyncComplete` fires exactly once per provider lifetime, after `markSyncComplete()` is called by the host. All pending debounces flush before `onSyncComplete` fires — projections always receive final state before the sync-complete signal.

Local writes (`put`, `tombstone`) bypass the debounce via `fireImmediate()` — echo-loop guards in `LarariumCrdtSyncAdaptor` depend on synchronous delivery of `tw-local` origin changes.

Projection errors are caught and logged. One failing projection does not block others.

<<~/ahu >>

<<~ ahu #prior-art >>

## Prior Art

**Yjs provider pattern** (`y-websocket`, `y-indexeddb`): the `Y.Doc` is the hub; providers subscribe to update events and fan out to persistence or network without coupling to each other. y-websocket fires a `sync` boolean event when the initial server payload arrives — the direct precedent for `onSyncComplete`. Multiple providers on the same `Y.Doc` receive the same update stream in parallel; Lararium adapts this into the typed `MemeProjection` slot registry.

**Automerge `DocHandle` event model**: DocHandle emits `change` with a `Patch[]` payload representing atomic modifications. The patches enable selective downstream updates without full re-materialization. No built-in coalescing or sync-complete gate exists in automerge-repo (as of 2026-04) — `MemeProvider` fills this gap.

**Event-sourcing / CQRS projections**: read models are idempotent-designed derived views built incrementally from an immutable event log. Canonical deduplication strategies: (1) event-position tracking, (2) event-ID deduplication with transactions, (3) checkpoint-based last-handled-position verification. `MemeProvider`'s debounce-keyed-by-URI is strategy (1) applied at the patch level.

**RxJS `ReplaySubject`**: replays cached emissions to late subscribers even after stream completion, unlike `BehaviorSubject` (current value only). `MemeProvider.addProjection()` mirrors this — projections registered after `markSyncComplete()` receive `onSyncComplete()` immediately rather than entering an unbounded buffer state.

**Logseq / Obsidian bulk-mutation patterns**: Logseq batches transactions and rebuilds block references asynchronously post-commit to avoid UI blocking. Obsidian's `turbovault-batch` (Rust) offers atomic `BatchTransaction` with rollback. `bulkSetTiddlers()` + `wiki.transact()` applies the same principle to TW5's widget refresh cascade.

The automerge-repo ecosystem (as of 2026-04) provides no built-in coalescing or projection layer. `MemeProvider` synthesises the Yjs sync-complete gate, CQRS projection idempotency, ReplaySubject late-subscriber semantics, and wiki batch-transaction patterns into one isomorphic, zero-Automerge-import class.

<<~/ahu >>

<<~ ahu #projection-registry >>

## Registered Projections

| projection | package | trigger |
|---|---|---|
| `LarDiskProjector` | `@lararium/tw5` | writes `carrier-text` / `ahu-slot` to `lares/` |
| `LarariumCrdtSyncAdaptor` | `@lararium/tw5` | applies changes to TW5 wiki engine |
| tldraw canvas *(planned)* | `@lararium/tldraw` | reflects meme shapes on the canvas |
| MCP tool feed *(planned)* | `@lararium/mcp` | pushes meme state to MCP tool consumers |

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
