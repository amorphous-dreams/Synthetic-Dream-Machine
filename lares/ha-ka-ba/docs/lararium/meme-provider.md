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

The Yjs **provider pattern** (`y-websocket`, `y-indexeddb`) establishes the same shape: the `Y.Doc` is the hub; providers subscribe to update events and fan out to persistence or network without coupling to each other.

Event-sourcing literature calls the downstream slots **projections** or **read models** — derived views built incrementally from an event log, idempotent by design.

The automerge-repo ecosystem (as of 2026-04) provides no built-in coalescing or projection layer. `MemeProvider` is the Lararium contribution to this gap.

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
