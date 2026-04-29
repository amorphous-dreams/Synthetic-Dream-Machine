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
role         = "session handoff crystal — 2026-04-29 — local-first architecture locked (receipt via meta, multi-room routing, disk↔Automerge bidirectional, echo-loop guard, lar: URI invariant); ReactionGraph stable-ref architecture (subscribeByFn, updateUri, fireSync UEFN model); TW5/UEFN Verse parity gap map complete (lele P1 wired, kukali P2 pending); feature/lararium-node-3 active"
```

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
SESSION opens
<<~/ahu >>

<<~ ahu #ooda-ha-local-first >>

## OODA-HA: Local-First Architecture

✶ Server is now a sync peer (Y-proto WS Automerge). Authority delivered via `<meta name="lararium-receipt">` in the HTML shell — no WS round-trip, no hidden tldraw frame. Multi-room HTTP routing (`/room/:roomId`) serves room-specific meta tags; rooms lazy-created on first WS connect. `LarDiskSyncAdaptor` derives disk paths via `resolveLarUri()` without a stale index — new memes get disk paths automatically. Echo-loop guard (`diskAdaptor.writing: Set<string>`) prevents disk→Automerge→disk loops. `/admin/promote` now patches Automerge doc immediately after writing disk — clients see changes without watcher round-trip.

⏿ The model is coherent: browser = authoritative editor, Automerge = shared truth, disk = canon projection, lares/ file watcher = external edits (git, editor, promote endpoint) → Automerge. No server-side TW5 in the write path. `startSyncer` gates on `title.startsWith("lar:")` — the lar: URI as title invariant is now a hard boundary. Draft (`$:/temp/*`) never reaches shared store; disk write only fires for `lar:` URIs.

◇ Remaining gaps identified:
  - **Bulk preload**: Browser `MemoryTiddlerStore` is populated lazily via `tiddlerStore.get()` calls. `buildReactionGraph()` may see an empty store on first render if no meme panels have been opened yet. Need `bulkLoad()` from Automerge doc at `store-ready` phase.
  - **Room GC**: Rooms created lazily (`memeHandle` per roomId) are never freed. Acceptable for current scale; note for M11.
  - **Multi-room conflict model**: Last-write-wins via Automerge CRDT — correct by design; no action needed.

▶ P1 fix for next session: `useLarariumHostOpen` should call a `bulkLoad()` pass after `store-ready`, iterating Automerge doc keys to populate `MemoryTiddlerStore` before TW5 boot. This ensures `buildReactionGraph()` has the full corpus on first render, not just lazily-opened memes.

⤴ `boot-receipt.ts` deleted. `laresPathIndex` eliminated. `computeBootRoom` / `buildBootProjection` removed. `useBridgeReceiptFromEditor` removed. Hidden tldraw frame shape pattern removed. `hostReceipt` reads from meta tag once at mount — stable for session. All clients start empty and sync from Automerge peer.

↺ Invariants held: all Lararium tiddlers use `lar:` URI as title ✓. Echo-loop guard active ✓. `/admin/promote` is the only canon ceremony ✓. Server is peer not authority ✓.

<<~/ahu >>

<<~ ahu #ooda-ha-tw5-uefn >>

## OODA-HA: TW5 / UEFN Verse Parity

✶ Widget infrastructure is complete: `DispatchWidget` (lele), `KukaliWidget` (kukali), `KumuWidget` all render structural DOM with correct `data-lar-*` attributes. `ReactionGraph` has `fireSync()` (UEFN within-tick model), `subscribeByFn()` (fn-based wildcard handlers stable across `updateUri` calls), and `fireRace`/`fireRush`. Relay Device pattern wired (`fn:"relay"` in `subscribeByFn`). `MemeDetailPanel` fires `"activate"` + `"begin"` on kumu instances at panel-open. `bindingsForUri()` on `LarariumTW5` enables incremental wiki→graph patching.

⏿ The gap is structural vs. behavioral: grammar and type system complete, runtime execution layer absent. `DispatchWidget` renders `<meta data-lar-target>` — nothing reads it to call `fireMeme()`. `KukaliWidget` renders `<span data-lar-kind="kukali">` — no execution suspension (Verse `suspends`). `KumuWidget` pushes to `_larKumuInstances` and React fires "begin" on them — but there is no isolated async executor that owns the device lifecycle.

◇ Priority ordering:
  - **P1 — lele wire (DispatchWidget → fireMeme)**: `renderVDom` in `vdom-to-react.ts` detects `data-lar-kind="dispatch"` nodes and calls `fireMeme(target, trigger)` as a render side-effect. No new infrastructure — `fireMeme` is already in context. Fire-and-forget is immediate (Verse `spawn` model).
  - **P2 — kukali suspension (KukaliWidget → subscribeOnce Promise)**: Requires `reactionGraph.subscribeOnce(uri, trigger)` returning a cancellable Promise that resolves when the named event fires. `vdom-to-react.ts` would mount a `useEffect` for each `kukali` node. Currently `subscribe()` returns an unsub function, not a Promise — needs `subscribeOnce()` variant on `ReactionGraph`.
  - **P3 — KumuExecutor (OnBegin async loop per device instance)**: Each kumu instance needs an isolated async boundary that runs `OnBegin`, sets up its kukali suspensions, and tears down on `OnEnd`. Deferred to M11.
  - **P4 — OnEnd lifecycle**: Panel close → `"deactivate"` trigger on the meme URI. Simple to add alongside P3. Deferred.

▶ P1 is the minimum viable lele wire and is feasible now. Add to `vdom-to-react.ts`: when walking the vdom, detect `{ tag: "meta", attrs: { "data-lar-kind": "dispatch", "data-lar-target": target, "data-lar-trigger": trigger } }` nodes and call `fireMeme` via `useLararium()` context inside the render adapter.

⤴ `fireSync()` is the correct primitive — synchronous, within-tick, matching UEFN OnActivated handler model. `subscribeByFn()` handlers registered once at shell boot cover all future bindings without re-subscription. Relay Device pattern functional end-to-end.

↺ `fireRace`/`fireRush` exist but no corpus paths produce `heihei`/`puka` semantics yet. Phase 2 grammar (rule-interpreter from grammar tiddlers) not yet implemented — parser still hardcoded. Both deferred.

<<~/ahu >>

<<~ ahu #state >>

## State as of 2026-04-29 session end

**Branch:** `feature/lararium-node-3` — last known build clean — tests: 7d6bf97 baseline

### Shipped this session

- **`boot-receipt.ts` deleted** — `packages/lararium-node/src/boot-receipt.ts` and its test file removed; dist artifacts cleaned
- **`<meta name="lararium-receipt">` delivery** — `computeReceiptSha()` in `serve.ts`; HTML shell injects receipt + roomId meta tags; `hostReceipt` in `LarariumShell` reads from meta at mount
- **Multi-room HTTP routing** — `/room/:roomId` route in `serve.ts`; rooms lazy-created on first WS connect; `DEFAULT_ROOM = "main"`
- **`LarDiskSyncAdaptor` rewrite** — no `pathIndex` param; derives disk path via `resolveLarUri(title)` from `@lararium/core`; `readonly writing = new Set<string>()` public echo-loop guard; debounced write with path-traversal guard
- **`/admin/promote` Automerge patch** — promote endpoint now patches Automerge doc immediately after disk write; `mkdirSync` for new directories
- **lares/ watcher per-file debounce** — per-file debounced handler; URI derived via `laresRelPathToLarUri()`; echo-loop check via `diskAdaptor.writing`; patches Automerge doc directly
- **lar: URI invariant enforced** — `startSyncer` boundary changed from `$:` prefix guard to `lar:` prefix guard
- **`ReactionGraph` stable-ref architecture** — `useRef<ReactionGraph>` never recreated; `load()` preserves handler lists; `updateUri()`/`removeUri()` for incremental patches; `subscribeByFn(fnName, handler)` fn-based wildcard; `fireSync()` synchronous UEFN-model tick
- **Relay Device pattern** — `fn:"relay"` handler in `subscribeByFn` re-fires trigger on `toUri`
- **`fireMeme` local dispatch** — `useCallback(() => graphRef.current.fireSync(...), [])` — no WS round-trip
- **`bindingsForUri(uri)`** — added to `LarariumTW5`; parses one tiddler's pranala edges incrementally
- **`onWikiChange` → incremental graph** — wiki change → `bindingsForUri()` → `updateUri()` or `removeUri()` — no full rebuild
- **`MemeDetailPanel` device lifecycle** — fires `"activate"` on meme URI + `"begin"` on each kumu instance at panel-open; `reactionGraph` and `fireMeme` wired from context
- **`useBridgeReceiptFromEditor` deleted** — `lararium-browser-host.ts` no longer imports `Editor` from tldraw
- **`"cascade-view"` added** — `MemeView` type in `MemeDetailPanel.tsx` now includes all four view variants

### Open pressures

- **Bulk preload gap** — `MemoryTiddlerStore` is lazily populated; `buildReactionGraph()` may see empty store at boot. Fix: `bulkLoad()` pass from Automerge doc at `store-ready` phase in `useLarariumHostOpen`.
- **P1 lele wire** — `DispatchWidget` renders `<meta data-lar-target>` but `renderVDom` does not call `fireMeme()`. Wire in `vdom-to-react.ts` via `data-lar-kind="dispatch"` node detection.
- **P2 kukali suspension** — needs `reactionGraph.subscribeOnce(uri, trigger): Promise` variant. Currently only unsub-function subscribe exists.
- **P3/P4 KumuExecutor + OnEnd** — isolated async device lifecycle boundary; deferred to M11.
- **Room GC** — lazy room map never freed; acceptable at current scale.

### Invariants held

- Package boundary: `@lararium/core` carries zero `tiddlywiki` runtime dep ✓
- Echo-loop guard: `diskAdaptor.writing` prevents disk→Automerge→disk loops ✓
- lar: URI invariant: all Lararium tiddlers use `lar:` URI as title; `startSyncer` gates on this ✓
- Draft guard: `$:/temp/*` and `Draft of ...` never reach shared store ✓
- Server is sync peer, not authority ✓
- Receipt delivered via HTML meta tag — no WS round-trip, no hidden frame shape ✓
- `ReactionGraph` stable-ref: `subscribeByFn` handlers never re-subscribed ✓
- `fireMeme` is local-only synchronous — no WS round-trip for local reactions ✓

<<~/ahu >>

<<~ ahu #next-build >>

## M10 Priorities

### P1 — Bulk preload (unblock reaction graph at boot)

```
packages/lararium-app/src/lararium-browser-host.ts
  — after store-ready: iterate automerge doc, call tiddlerStore.put() for each lar: entry
  — ensures buildReactionGraph() has full corpus before tw5-ready
```

### P2 — lele wire (DispatchWidget execution)

```
packages/lararium-app/src/vdom-to-react.ts
  — detect { tag: "meta", attrs: { "data-lar-kind": "dispatch" } } nodes
  — call fireMeme(target, trigger) as render side-effect via useEffect
  — import useLararium() or accept fireMeme as prop
```

### P3 — subscribeOnce (kukali suspension foundation)

```
packages/lararium-core/src/live-protocol.ts
  — add subscribeOnce(uri: string, trigger: string): Promise<unknown> & { cancel(): void }
  — resolves when fireSync(uri, trigger) fires; rejects on cancel()
  — this is the Verse `suspends` bridge primitive
```

### P4 — Browser smoke testing (M9 carry-forward)

```bash
pnpm --filter @lararium/node serve   # in one terminal
open http://localhost:4321           # check: meta tags, reaction graph boot, meme panel
```

Verify:
- `document.querySelector('meta[name="lararium-receipt"]').content` non-null
- `window.__larariumDebug.openPhase === "tw5-ready"` or `"live"`
- No console errors matching `"Unknown switch case"` or `"Empty text nodes"`
- Command palette (⌘K) opens and shows spaces
- MemeDetailPanel opens on meme click; "activate" fires in ReactionGraph

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
