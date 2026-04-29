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

◇ Remaining gaps:
  - **Bulk preload ✓ FIXED** — `loadFromStore(s, onProgress)` runs before `setTw5(t)`; `tw5-ready` now means corpus-populated. `tw5-hydrating` phase emitted during load; `BootSplash` renders progress bar.
  - **Room GC**: Rooms created lazily (`memeHandle` per roomId) are never freed. Acceptable for current scale; note for M11.
  - **Multi-room conflict model**: Last-write-wins via Automerge CRDT — correct by design; no action needed.

▶ Local-first architecture is coherent and closed for M10. M11 opens with Playwright e2e and canvas write-back.

⤴ `boot-receipt.ts` deleted. `laresPathIndex` eliminated. `computeBootRoom` / `buildBootProjection` removed. `useBridgeReceiptFromEditor` removed. Hidden tldraw frame shape pattern removed. `hostReceipt` reads from meta tag once at mount — stable for session. All clients start empty and sync from Automerge peer.

↺ Invariants held: all Lararium tiddlers use `lar:` URI as title ✓. Echo-loop guard active ✓. `/admin/promote` is the only canon ceremony ✓. Server is peer not authority ✓.

<<~/ahu >>

<<~ ahu #ooda-ha-tw5-uefn >>

## OODA-HA: TW5 / UEFN Verse Parity

✶ Widget infrastructure is complete: `DispatchWidget` (lele), `KukaliWidget` (kukali), `KumuWidget` all render structural DOM with correct `data-lar-*` attributes. `ReactionGraph` has `fireSync()` (UEFN within-tick model), `subscribeByFn()` (fn-based wildcard handlers stable across `updateUri` calls), and `fireRace`/`fireRush`. Relay Device pattern wired (`fn:"relay"` in `subscribeByFn`). `MemeDetailPanel` fires `"activate"` + `"begin"` on kumu instances at panel-open. `bindingsForUri()` on `LarariumTW5` enables incremental wiki→graph patching.

⏿ The gap is structural vs. behavioral: grammar and type system complete, runtime execution layer absent. `DispatchWidget` renders `<meta data-lar-target>` — nothing reads it to call `fireMeme()`. `KukaliWidget` renders `<span data-lar-kind="kukali">` — no execution suspension (Verse `suspends`). `KumuWidget` pushes to `_larKumuInstances` and React fires "begin" on them — but there is no isolated async executor that owns the device lifecycle.

◇ Priority ordering:
  - **P1 — lele wire ✓ SHIPPED** — `collectDispatchNodes()` in `vdom-to-react.tsx`; `MemeDetailPanel` fires via `useEffect` gated on uri (not vdom-identity); dispatch nodes fire once per activation.
  - **P2 — kukali suspension** — `subscribeOnce(uri, trigger): Promise<unknown> & { cancel() }` ✓ SHIPPED on `ReactionGraph`. `KukaliWidget → useEffect` wiring in `vdom-to-react.tsx` not yet done — M11 P2.
  - **P3 — KumuExecutor (OnBegin async loop)** — deferred to M11 P4.
  - **P4 — OnEnd lifecycle** — deferred alongside P3.

▶ `subscribeOnce` is the foundation for kukali suspension. The next execution step is wiring `data-lar-kind="kukali"` nodes in `vdom-to-react.tsx` to mount `useEffect` per node calling `reactionGraph.subscribeOnce(uri, trigger)` with cleanup on `cancel()`.

⤴ `fireSync()` is the correct primitive — synchronous, within-tick, matching UEFN OnActivated handler model. `subscribeByFn()` handlers registered once at shell boot cover all future bindings without re-subscription. Relay Device pattern functional end-to-end.

↺ `fireRace`/`fireRush` exist but no corpus paths produce `heihei`/`puka` semantics yet. Phase 2 grammar (rule-interpreter from grammar tiddlers) not yet implemented — parser still hardcoded. Both deferred.

<<~/ahu >>

<<~ ahu #state >>

## State as of 2026-04-29 session end (continued)

**Branch:** `feature/lararium-node-3` — build clean — 301 checks green — docs aligned to shipped architecture

### Shipped previous session (M10 core)

- **`boot-receipt.ts` deleted** — removed from `packages/lararium-node/src/`; dist artifacts cleaned
- **`<meta name="lararium-receipt">` delivery** — `computeReceiptSha()` in `serve.ts`; HTML shell injects receipt + roomId meta tags; `hostReceipt` reads from meta at mount
- **Multi-room HTTP routing** — `/room/:roomId`; rooms lazy-created on first WS connect; `DEFAULT_ROOM = "main"`
- **`LarDiskSyncAdaptor` rewrite** — `resolveLarUri()` path derivation; echo-loop guard (`diskAdaptor.writing: Set<string>`); debounced write with path-traversal guard
- **`/admin/promote` Automerge patch** — patches Automerge doc immediately after disk write
- **lares/ watcher per-file debounce** — echo-loop check via `diskAdaptor.writing`; patches Automerge doc directly
- **lar: URI invariant enforced** — `startSyncer` gates on `lar:` prefix
- **`ReactionGraph` stable-ref** — `useRef<ReactionGraph>`; `load()`/`updateUri()`/`removeUri()`; `subscribeByFn()`; `fireSync()`
- **Relay Device pattern** — `fn:"relay"` handler re-fires trigger on `toUri`
- **`fireMeme` local dispatch** — `useCallback` over `graphRef.current.fireSync()`
- **`bindingsForUri(uri)`** + **`onWikiChange` → incremental graph** — no full rebuild on wiki change
- **`MemeDetailPanel` device lifecycle** — `"activate"` + `"begin"` on panel-open

### Shipped this session (M10 close)

- **Bulk preload race fixed** — `loadFromStore(s)` now runs before `setTw5(t)`; `buildReactionGraph()` sees full corpus at tw5-ready
- **lele wire complete** — `collectDispatchNodes()` in `vdom-to-react.tsx`; `MemeDetailPanel` fires dispatch nodes via `useEffect` gated on `(uri, vdom)`; uri-keyed ref prevents re-fire on peer-edit re-renders
- **`subscribeOnce(uri, trigger)`** — added to `ReactionGraph`; returns `Promise<unknown> & { cancel() }` — Verse `suspends` bridge primitive
- **`ReactionGraph.load()` slot pruning fixed** — occupied handler slots survive graph rebuilds; dynamic subscriptions (`subscribeOnce`, kukali) not silently dropped
- **`tw5-hydrating` phase** — `LarariumOpenPhase` union extended; `loadFromStore(store, onProgress?)` threads count through; `lararium-browser-host.ts` emits `{ kind: "tw5-hydrating", loaded, total }`
- **`BootSplash` component** — `tc-remove-when-wiki-loaded` pattern in React; portal to `document.body`; progress bar during `tw5-hydrating`; renders null at `tw5-ready`/`live`; wired into `LarariumShell`
- **Docs aligned** — `ROADMAP.md` + `MULTIPLAYER-INFINITE-CANVAS-WIKI.md` role fields updated to reflect local-first architecture; stale SQLite/TLSocketRoom/boot-receipt-shape language removed

### Open pressures

- **P2 kukali suspension** — `subscribeOnce` primitive exists; `KukaliWidget → useEffect` wiring not yet in `vdom-to-react.tsx`. Deferred to M11.
- **P3/P4 KumuExecutor + OnEnd** — isolated async device lifecycle; deferred to M11.
- **Canvas write-back** — canvas is read-only; draft path (canvas → TW5 → MemoryTiddlerStore → promote) not wired. M11.
- **Playwright e2e** — no automated browser tests yet. M11.
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
- `tw5-ready` means corpus-populated (loadFromStore complete before signal) ✓
- `ReactionGraph.load()` does not drop occupied handler slots ✓
- Dispatch nodes fire once per uri activation, not per vdom re-render ✓

<<~/ahu >>

<<~ ahu #next-build >>

## M11 Priorities

### P1 — Playwright e2e (browser smoke → automated)

```
packages/lararium-node/tests/e2e/
  — pnpm add -D @playwright/test --filter @lararium/node
  — test: server starts, meta tags present, BootSplash disappears, MemeDetailPanel opens
  — verify: document.querySelector('meta[name="lararium-receipt"]').content non-null
  — verify: window.__larariumDebug.openPhase === "live"
  — verify: no console errors matching "Unknown switch case" or "Empty text nodes"
```

### P2 — kukali suspension wire (KukaliWidget → useEffect)

```
packages/lararium-app/src/vdom-to-react.tsx
  — detect data-lar-kind="kukali" nodes in renderVDom
  — mount useEffect per kukali node: reactionGraph.subscribeOnce(uri, trigger)
  — cleanup: cancel on unmount or uri change
  — subscribeOnce() already exists in ReactionGraph (live-protocol.ts)
```

### P3 — Canvas write-back path

```
packages/lararium-app/src/
  — canvas → TW5 draft: MemeDetailPanel edit mode → wiki tiddler (draft)
  — draft → MemoryTiddlerStore: adaptor.saveTiddler with origin:"canvas-draft"
  — promote: PUT /admin/promote ceremony (already exists)
  — guard: canPromoteToCanon() already enforces ceremony requirement
```

### P4 — KumuExecutor async device lifecycle (OnBegin loop)

```
packages/lararium-app/src/KumuExecutor.ts  [new]
  — one executor per kumu instance (keyed by instanceId)
  — runs OnBegin: sets up kukali suspensions, awaits triggers
  — torn down on OnEnd (panel close → "deactivate" trigger)
  — uses subscribeOnce() for each kukali suspension point
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
