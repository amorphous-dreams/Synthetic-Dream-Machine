<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///SESSION >>

<<~ ahu #iam >>

```toml
uri-path     = "SESSION"
file-path    = "lares/SESSION.md"
content-type = "text/x-memetic-wikitext"
tagspace     = "adjacent"
confidence   = 0.84
register     = "CS"
manaoio      = 0.82
mana         = 0.86
manao        = 0.84
implements   = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme"
]
role         = "session handoff crystal — 2026-04-28 — architecture clarification: TW5 is core VerseGraph binding (not optional guest); room = filtered view on whole wiki; full read/write pipeline locked (canvas edit → draft → branch commit → canon promotion → hostless URI); scale laws from YJS 3D + TW5 large-instance prior art added to MULTIPLAYER doc; kumuRegistry wired as computed view over tiddlerStore; seenText cache stops hot-path CRDT→TW5→kumuRegistry chain from firing on shape moves; ROADMAP TW5 avoid-list superseded; feature/lararium-node-3 active"
```

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
SESSION opens
<<~/ahu >>

<<~ ahu #ooda-ha >>

✶ Architecture clarification lands: TW5 is the isomorphic VerseGraph core — summoned anywhere the CRDT store lives; not a guest grammar, not optional. Room = temporary filtered view on the whole wiki (lazy filter model, TW5 large-instance pattern). Full read/write pipeline locked: canvas edit → draft → branch commit → canon promotion → hostless URI assignment.
⏿ kumuRegistry is now a computed view over tiddlerStore.subscribe() (not a parallel editor shape scan). seenText cache stops the CRDT→TW5→kumuRegistry rebuild chain from firing on every shape move. Three memory layers identified (tldraw CRDT, MemoryTiddlerStore, TW5 wiki) — all load-bearing, gates correct.
◇ ROADMAP TW5 "Avoid" list superseded: TW5 runtime as carrier-law dependency ruling flipped to required binding. MULTIPLAYER doc updated with TW5 VerseGraph section + room-as-view model + scale laws (YJS 3D + TW5 large-instance prior art).
▶ M10 active: TW5 memetic-wikitext parser bridge, lares/ tiddler seeding via /api/tiddlers, full memes with content on canvas. Read/write pipeline (draft → canon) is now a first-class M10 concern alongside projection completeness.
⤴ 330 checks green (last known state). App build clean. kumuRegistry and seenText cache changes are type-clean.
↺ Scale law: ≤500 shapes per room in CRDT at any time. Larger corpora paged via room transitions and zoom-level eviction. TW5 filter index stays small; tiddler bodies demand-loaded via tiddlerStore.get(). Canon-promotion ceremony assigns hostless URI — the only moment a shape URI changes.

<<~/ahu >>

<<~ ahu #state >>

## State as of 2026-04-28 session end (browser TW5 async opening patch complete)

**Branch:** `feature/lararium-node-2` — 280/280 tests green — app build clean

### Shipped this session

- **`LarariumOpenPhase`** — authority-first union type in `packages/lararium-core/src/live-protocol.ts`: host-opening → authority-opening → authority-ready → manifest-opening → manifest-ready → store-opening → store-ready → tw5-opening → tw5-ready → projection-opening → projection-ready → live | error
- **`projection-cache` ChangeOrigin** — `{ kind: "projection-cache"; shapeId: string; receipt?: string }` added to `ChangeOrigin` union in `packages/lararium-core/src/tiddler-store.ts`; audit-labeled path for shape.meta.carrierText entries; cannot promote to canon
- **`packages/lararium-app/src/lararium-browser-host.ts`** (NEW) — `BrowserHostOptions`, `openBrowserLarariumHost()` async generator (authority-first phase sequence), `useLarariumHostOpen()` React hook; allocates `MemoryTiddlerStore` at store-ready and `LarariumTW5` at tw5-ready; store-ready precedes tw5-ready ordering law enforced
- **`LarariumCtxValue` expanded** — new fields: `openPhase: LarariumOpenPhase | null`, `tiddlerStore: MemoryTiddlerStore | null`, `tw5: LarariumTW5 | null`, `renderMode: RenderMode`, `hostReceipt: string | null`; `RenderMode = "native" | "tw5"` type exported from lararium-context.tsx; renderMode reads `?renderMode=tw5` query param
- **`LarariumShell.tsx`** — wires `useLarariumHostOpen({ hostId: "lararium-browser", recipeUri: "lar:///recipe/room", roomId: "altar-fire" })`; passes all new ctx fields through provider
- **`LarariumCanvas.tsx`** — blocking `store.status === "loading"` spinner removed; tldraw mounts immediately with statusful store (Q1 ruling)
- **`MemeDetailPanel.tsx`** — `?renderMode=tw5` branch: shows `⟳ opening…` while tw5/store null; async `tiddlerStore.get(uri)` for text; falls back to `shape.meta.carrierText` (projection-cache, audit-only); renders via `tw5.renderText(text)` → `dangerouslySetInnerHTML`; native branch (React adapter via renderCarrier) unchanged
- **`native-render.tsx`** — renamed from `kumu-react-render.tsx`; all imports updated; comments updated
- **`packages/lararium-app/package.json`** — `"@lararium/tw5": "workspace:*"` added; pnpm install run to materialize symlink

### Open pressures

- **Boot receipt via room metadata (Q3 pending)** — serve.ts currently emits `LiveMsgBootReceipt` as a standalone WS message. Q3 ruling: embed receiptHash as tldraw room-level metadata record so browser reads it through existing CRDT sync. `useLarariumHostOpen` currently uses `local-operator:${hostId}` placeholder.
- **TW5 unconditional bundle entry** — `tiddlywiki` enters browser bundle via `@lararium/tw5` dep; 1.95MB bundle (586KB gzip). Code-split via dynamic import deferred to Q2 recipe-config phase.
- **Projection-cache seeding** — `shape.meta.carrierText` bridge into `MemoryTiddlerStore` with `{ kind: "projection-cache" }` origin via `editor.store.listen()` not yet wired. `MemeDetailPanel` currently falls back directly to `carrierText` from useMemo; store is empty until bridged.

### Invariants held

- Package boundary: `@lararium/core` carries zero `tiddlywiki` runtime dep ✓
- Echo-loop guard: `LarariumCrdtSyncAdaptor._applying` prevents crdt-remote → tw-local writeback ✓
- Draft guard: `$:/temp/*` and `Draft of ...` never reach shared store ✓
- Orichalcum boundary: projection-cache cannot promote without ceremony ✓
- store-ready precedes tw5-ready in opening sequence ✓
- tldraw package carries no TW5 dep ✓

<<~/ahu >>

<<~ ahu #next-build >>

## M9 Priority 2 — Browser Smoke Testing

### The insight

280 tests pass but no tactile surface has been exercised in a browser since M5. Browser smoke remains the highest-value next move — it will surface zoom threshold failures, double-click nav, and detail panel regressions before canon-promotion wiring begins.

### What to verify

**Zoom thresholds (`applyZoomTemplate`):**
- Drag canvas to each zoom level: strategic (`<0.15`), operational (`0.15–0.35`), tactical (`0.35–0.80`), combat (`0.80–1.50`), action (`≥1.50`)
- Meme frame dims change at each threshold; body node geo shapes appear at action zoom
- Ahu frames materialize at combat zoom; socket port shapes reposition
- Ownership arrows: opacity:0 at tactical/lower, opacity:0.3 at combat/action

**Opening status in LarariumMenuPanel:**
- Open browser without server running → canvas mounts (no spinner); menu panel visible
- Open with server → CRDT syncs; meme list populates reactively

**MemeDetailPanel (native render):**
- Double-click meme frame → panel slides up; carrier text renders via renderCarrier
- Kumu-typed nodes render; typed holes render as dashed placeholders

**MemeDetailPanel (TW5 render):**
- Navigate to `?renderMode=tw5` → panel shows `⟳ opening…` while tw5 boots
- After boot: carrier text renders as TW5 HTML (bold, links, etc.)

**Commands:**
```bash
pnpm -r build
pnpm -r test                                                        # 280 must stay green
curl -s http://localhost:4321/admin/reseed | python3 -m json.tool   # reseed after build
open http://localhost:4321                                          # browser smoke
open "http://localhost:4321?renderMode=tw5"                         # TW5 render branch
```

### Pending wiring (before full tw5 render path works end-to-end)

**Boot receipt via room metadata (Q3):**
```
packages/lararium-node/scripts/serve.ts  — embed receiptHash in tldraw room-level metadata record
packages/lararium-app/src/lararium-browser-host.ts  — read receipt from CRDT room meta instead of placeholder
```

**Projection-cache store seeding:**
```
packages/lararium-app/src/LarariumCanvas.tsx  — editor.store.listen() → MemoryTiddlerStore.put() with { kind: "projection-cache" } origin
```

### Files for canon-promotion (P4, after smoke)

```
packages/lararium-node/scripts/serve.ts        — add PUT /admin/promote route
packages/lararium-node/src/node-host.ts        — writeCarrierText(uri, text) guard
packages/lararium-app/src/MemeDetailPanel.tsx  — promote button in panel chrome
lares/ha-ka-ba/api/v0.1/pono/hooponopono.md    — canon-promotion ceremony invariant
```

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
SESSION closes
<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #to-roadmap ? -> lar:///LARARIUM-NODE/ROADMAP family:relation role:companion >>
<<~ pranala #to-wiki ? -> lar:///LARARIUM-NODE/MULTIPLAYER-INFINITE-CANVAS-WIKI family:relation role:companion >>

<<~/ahu >>

<<~&#x0004; -> ? >>
