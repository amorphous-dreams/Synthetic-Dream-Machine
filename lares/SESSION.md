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
role         = "session handoff crystal — 2026-04-29 (session 3) — TLSocketRoom tombstoned; P3 body-node emission; M11 incremental canvas projection diff; P4 KumuWidget local-first TW5 transclusion; KumuWidget.refresh delegated; parseMemeCarrier static import; feature/lararium-node-3 active"
```

<<~/ahu >>


<<~ ahu #ooda-ha-local-first >>

## OODA-HA: Local-First Architecture

✶ Server is now an Automerge-repo sync peer (`/meme-sync` WS). Authority delivered via `<meta name="lararium-receipt">` in the HTML shell — no WS round-trip, no hidden tldraw frame. Multi-room HTTP routing (`/room/:roomId`) serves room-specific meta tags; legacy layout rooms are lazy-created on `/rooms` WS connect, while meme content still uses the shared Automerge doc. `LarDiskSyncAdaptor` derives disk paths via `resolveLarUri()` without a stale index — new memes get disk paths automatically. Echo-loop guard (`diskAdaptor.writing: Set<string>`) prevents disk→Automerge→disk loops. `/admin/promote` now patches Automerge doc immediately after writing disk — clients see changes without watcher round-trip.

⏿ The model is coherent: browser = authoritative editor, Automerge = shared truth, disk = canon projection, lares/ file watcher = external edits (git, editor, promote endpoint) → Automerge. No server-side TW5 in the write path. `startSyncer` gates on `title.startsWith("lar:")` — the lar: URI as title invariant is now a hard boundary. Draft (`$:/temp/*`) never reaches shared store; disk write only fires for `lar:` URIs.

◇ Remaining gaps / tensions:
  - **Projection refresh**: `LarariumShell` seeds tldraw from `projectFromTw5(tw5)` once; `tw5.onWikiChange → projection diff → editor.store.put/remove` not wired.
  - **Body-node write-back**: `LarariumCanvas` has a `canvas-draft` listener for `meta.bodyNodeKind`, but `projectToTldraw()` emits no body nodes. Latent, not functional.
  - **Room split**: `/room/:roomId` exists, but content still uses one Automerge meme-store doc. Per-room recipes/docs are M11+.
  - **Legacy layout channel**: `serve.ts` still hosts `/rooms/:roomId` with `TLSocketRoom` + SQLite. Browser content path no longer uses it as authority; decide whether to retire or repurpose.

▶ Local-first architecture coherent for content. M11 opens with projection diffing, body-node canvas write-back, Playwright e2e, room recipe partitioning.

⤴ Receipt via HTML meta tag. Hidden tldraw frame shape pattern removed. `hostReceipt` reads from meta tag once at mount. Clients hydrate content from Automerge, project tldraw records locally from TW5.

↺ All Lararium tiddlers use `lar:` URI as title ✓. Echo-loop guard active ✓. `/admin/promote` is the only canon ceremony ✓. Server is peer not authority ✓.

<<~/ahu >>

<<~&#x0002;>>


<<~ ahu #ooda-ha-hud >>

## OODA-HA: LarariumPanel / HUD Architecture

✶ `LarariumPanel` (new file) merges the HUD chip and TW5 wiki panel into a single always-mounted floating component. `wikiOpen` and `drawingMode` are independent booleans in `LarariumShell` state — replacing the old `paletteOpen`/`canvasMode` coupling. ⌘K toggles wiki panel; `` ` `` toggles full tldraw drawing chrome. Both have hotkeys wired in `LarariumShell` keyboard handler.

⏿ TW5 shadow root mounts once (`mountPanel()`) and survives wiki open/close via `display: none`. Pointer-capture drag, edge-snap (`SNAP_PX=28`), and corner resize handle. `drawingMode` auto-collapses on wiki open (snapshot in `prevDrawRef`), restores on wiki close. Capture-phase keyboard guard blocks single-char tldraw tool keys when shadow root has focus. Escape closes panel.

◇ ZOOM_IN action no longer opens the wiki panel — zoom activates other UX (planned). WikiCommandPalette rename completed → LarariumPanel. Old `LarariumCommandPalette` (quick-jump) deleted — superseded by TW5 story river. `LarariumHUD` slot deleted — absorbed into LarariumPanel.

▶ UX surface: HUD chip (collapsed, bottom-right) expands to TW5 wiki panel. `⌘K` + `◻/✏` buttons in handle bar. Theme toggle in SharePanel. Back+Graph in HelperButtons. All slot components are stable module-level refs.

↺ `wikiOpen` ≠ `navState.activeView === "meme-detail"` — wiki panel open state is independent of nav focus. ZOOM_IN fires reaction; panel opening is a separate user action.

<<~/ahu >>

<<~ ahu #ooda-ha-causal-island >>

## OODA-HA: Causal Island Doctrine (Fuller-Zelenka)

✶ Fuller-Zelenka non-simultaneous apprehension is now the ontological basis for the causal island model. Events in Universe are not simultaneously apprehended by any observer. In a local-first Automerge model: your local doc snapshot = simultaneously apprehended. Everything else (peer states, other Automerge Realms, un-hydrated tiddlers, kumu event horizons) = non-simultaneously apprehended by topology.

⏿ Four tiers named (inner → outer):
  - Tier 0 — active programming memes (kumu/UEFN device instances, kahea invocations): MAY become islands. Own their trigger surface, params, and event horizon.
  - Tier 1 — memes inside rooms (local Automerge doc window): simultaneously apprehended; peer state of same doc is not.
  - Tier 2 — Automerge Realms (distinct Automerge docs): ALWAYS non-simultaneously apprehended, no matter where first encountered on the network.
  - Tier 3 — Lares nodes (federation layer): node-to-node edge islands. MUST be causal islands.

◇ `CAUSAL_ISLAND_MAY` gains `"automerge-realm"` and `"peer-sync-state"` — non-simultaneous by topology, named to make the doctrine explicit.

▶ `causal-island.ts` updated. `federated-causal-islands.md` updated. New pono memes: `reaction-graph.md` (live Tier 0 dispatch interface law), `source-module.md` (Track B source carrier pipeline interface).

↺ `AuthorityFirstGuard` live in `serve.ts`. Doctrine is the law; TypeScript is its runtime projection.

<<~/ahu >>

<<~ ahu #ooda-ha-source-memes >>

## OODA-HA: Track B — Source Meme Pipeline

✶ Priority TypeScript/TSX source files now seed into the Automerge store as navigable memes at boot. URI scheme: `lar:///source/<package-name>/src/<relative-path>`. Body = verbatim source text. Fields carry `package`, `src-path`, `lang`, `built-at`, `content-hash`.

⏿ Implementation: `scripts/source-memes.ts` reads 7 priority files from packages/. `build-snapshot-lib.ts` calls `buildSourceMemes()` and merges results into `BuiltSnapshot.memes` with `laresRelPath: null`. `serve.ts` seeding loop passes `fields` through to the Automerge doc. Interface law: `lares/ha-ka-ba/api/v0.1/pono/source-module.md`.

◇ Priority modules: `parser.ts`, `ast.ts`, `causal-island.ts`, `live-protocol.ts` (lararium-core); `lararium-tw5.ts` (lararium-tw5); `LarariumPanel.tsx`, `LarariumShell.tsx` (lararium-app). All readable through the meme graph as `lar:///source/...` URIs.

▶ Source memes are seeded at first boot only (meme-store doc created fresh). Existing store resumed without re-seeding. Track B infrastructure complete; future laps can expand the priority module list.

↺ `BuiltSnapshot.memes` type updated to `laresRelPath: string | null`. Disk write-back guard in serve.ts already skips virtual caps URIs (laresRelPath null) — source memes correctly excluded from disk write-back.

<<~/ahu >>

<<~ ahu #track-a >>

## Track A: Dead Code Removal (complete)

Removed this session:
- `LarariumBootReceiptMeta` interface (was M9 hidden-shape carrier, superseded by HTML meta tag)
- `LiveMsgBootReceipt`, `LiveMsgSnapshot`, `LiveMsgDelta`, `LiveMsgError`, `LiveMsgFire`, `LiveMsgSubscribe`, `LiveServerMsg`, `LiveClientMsg` — all unused; only `LiveMsgEvent` used in serve.ts
- Dead `LarariumOpenPhase` variants: `manifest-opening`, `manifest-ready`, `projection-opening`, `projection-ready` — never emitted
- Corresponding dead `BootSplash.tsx` switch cases
- Orphaned `renderCarrierVDom` JSDoc block in `lararium-tw5.ts` (method was removed; stale JSDoc persisted)
- Stale `renderMeme()` reference in `injectKumuDefs` doc

All 62 unit tests green after removal.

<<~/ahu >>

<<~ ahu #state >>

## State as of 2026-04-29 (session 3 end)

**Branch:** `feature/lararium-node-3` — build clean — 62/62 tests pass

### Closed this session

- **TLSocketRoom tombstone** — `serve.ts` now pure Automerge-repo + file watcher; `better-sqlite3`, `@tldraw/sync-core`, `TLSocketRoom`, `SQLiteSyncStorage` all removed from deps ✓
- **P1 — Jest/Playwright isolation** — `testPathIgnorePatterns: ["/tests/e2e/"]` in `jest.config.cjs` ✓
- **P2 — kukali suspension wire** — `KukaliWidget` calls `wiki._larKukaliHook`; `LarariumPanel` bridges to `reactionGraph.subscribeOnce()`; `touchTiddler` triggers TW5 refresh ✓
- **P3 — body-node emission** — `projectToTldraw()` now emits `LarTLBodyNode` records from carrier wikitext via `parseMemeCarrier` + `collectText` ✓
- **P4 — KumuWidget local-first** — `KumuWidget.render()` transclubes `lar:///kumu/<name>` via TW5-native `makeTranscludeWidget`; props injected as TW5 variables; `refresh()` delegated to child transclude ✓
- **M11 incremental canvas diff** — `onWikiChange` re-projects and diffs shape IDs: puts new/updated, removes deleted ✓
- **Track C: parseMemeCarrier** — promoted from dynamic `await import()` to static import in `lararium-tw5.ts` ✓

### Open pressures

- **Track C — `lararium-tw5.ts` simplification** — 895 lines; split deferred until next session
- **e2e Playwright smoke** — isolation fixed; tests not yet run against live server
- **Source meme expansion** — priority list at 7 files; expand as agent navigation matures
- **Per-room Automerge docs** — all clients share one doc; room recipe partitioning is M12

### Invariants held

- Package boundary: `@lararium/core` carries zero `tiddlywiki` runtime dep ✓
- Echo-loop guard: `diskAdaptor.writing` prevents disk→Automerge→disk loops ✓
- lar: URI invariant: all Lararium tiddlers use `lar:` URI as title ✓
- Draft guard: `$:/temp/*` never reaches shared store ✓
- Server is sync peer, not authority ✓
- KumuWidget is TW5-native: def lookup → variable injection → makeTranscludeWidget ✓
- KumuWidget.execute no-op; children managed in render; refresh delegated ✓
- `ReactionGraph` stable-ref: `subscribeByFn` handlers never re-subscribed ✓
- `fireMeme` is local-only synchronous — no WS round-trip for local reactions ✓
- `tw5-ready` means corpus-populated ✓
- Causal island doctrine: Fuller-Zelenka basis + four-tier model canonical in both TS and meme ✓
- Source memes: 7 priority modules seeded into Automerge store at first boot ✓

<<~/ahu >>

<<~ ahu #m11-priorities >>

## M11 Priorities

### P1 — Playwright e2e (fix isolation, write smoke tests)

```
packages/lararium-node/
  — separate playwright.config.ts from jest.config.cjs
  — pnpm script: "test:e2e": "playwright test"
  — smoke: server starts, meta tags present, BootSplash disappears
  — verify: lararium-receipt non-null, openPhase === "live", no console errors
```

### P5 — Track C: lararium-tw5.ts split

```
packages/lararium-tw5/src/lararium-tw5.ts  (895 lines, single class)
  — profile: which methods are external surface vs. internal only
  — candidate split: boot/mount surface | tiddler-store sync | kumu/filter
  — constraint: LarariumTW5 class must remain the public export (callers import it)
  — approach: extract helpers into sibling modules; keep class thin
```

### P6 — Playwright e2e smoke run

```
packages/lararium-node/
  — pnpm run e2e against live server
  — verify: meta tags present, BootSplash clears, openPhase === "live"
  — gate: server starts clean on the WSL2 host
```

<<~/ahu >>


<<~ ahu #edges >>

## Edges

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #to-roadmap ? -> lar:///LARARIUM-NODE/ROADMAP family:relation role:companion >>
<<~ pranala #to-wiki ? -> lar:///LARARIUM-NODE/MULTIPLAYER-INFINITE-CANVAS-WIKI family:relation role:companion >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
