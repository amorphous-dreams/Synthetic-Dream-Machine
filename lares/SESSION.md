<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///SESSION >>

<<~ ahu #iam >>

```toml
uri-path     = "SESSION"
file-path    = "lares/SESSION.md"
content-type = "text/x-memetic-wikitext"
tagspace     = "adjacent"
confidence   = 0.82
register     = "CS"
manaoio      = 0.80
mana         = 0.84
manao        = 0.82
implements   = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme"
]
role         = "session handoff crystal — 2026-04-28 — isomorphic lararium-tw5.ts complete; tw-filter.ts + tw-filter-browser.ts shims deleted; @lararium/core/tw5 subpath canonical; @lararium/node/dist rebuilt (./tw-filter subpath removed); 259/259 tests green; LarariumSyncAdaptor design: one-way CRDT→TW5 via editor.store.listen() + tw.setTiddler() for Phase 4; M9 remaining: browser smoke (P2), canon-promotion surface (P4), wiki-recipe carriers (P5)"
```

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
SESSION opens
<<~/ahu >>

<<~ ahu #ooda-ha >>

✶ lararium-tw5.ts isomorphic interface is the live TW5 core. tw-filter.ts + tw-filter-browser.ts shims deleted. @lararium/core/tw5 is the single subpath. 259/259 green.
⏿ Sync binding design resolved: TW5 SyncAdaptor is NOT needed for the filter use case. One-way CRDT→TW5 binding via editor.store.listen() + tw.setTiddler() is sufficient for Phase 4 live cascade re-evaluation. Full SyncAdaptor (bidirectional) deferred until TW5 plugin rendering is in scope.
◇ M9 remaining: browser smoke (P2 — all tactile behaviors unverified since M5), canon-promotion surface (P4 — PUT /admin/promote + writeCarrierText guard), wiki-recipe carriers (P5 — lares/recipes/ schema).
▶ Browser smoke (P2) is the highest-value next move. `pnpm -r build && pnpm -r test` then reseed + open browser.
⤴ 259/259 green. @lararium/node/dist rebuilt (./tw-filter removed). MCP smoke passes.
↺ Phase 4 binding sketch: editor.store.listen({scope:"document"}) → for each updated meme shape where meta.carrierText changed → tw.setTiddler(entryToFields(entry)) → cascade re-runs against fresh data.

<<~/ahu >>

<<~ ahu #state >>

## State as of 2026-04-28 session end (isomorphic lararium-tw5.ts + shim removal complete)

**Branch:** `feature/lararium-node-2` — 259/259 tests green — server at `http://localhost:4321`

### Shipped this session (M9 P1 + P3)

- **`render-target.ts`** — explicit boundary contract between widget tree and downstream renderers; `RenderTargetAdapter` interface + `RENDER_TARGET_ADAPTERS` machine-readable registry (tldraw: boot-snapshot; react: on-demand); `WidgetSlot { widget, result }`; `buildWidgetMap(widgetTree, results) → Map<pos, WidgetSlot>`; `projectCarrier(uri, text, registry) → { ast, widgetTree }` (single-parse guarantee)
- **`kumu-react-render.tsx`** — React render adapter extracted from MemeDetailPanel; `renderCarrier(ast, widgetMap)` walks AST, delegates kahea nodes to `widgetMap.get(node.pos)`; all 8 families colored; Hazel typed holes (dashed); suspended kukali `⏿` placeholders; dead css styles (`sigil`, `sigilName`, `sigilAttr`) removed
- **`LarTLBodyNode[]`** — tldraw structural skeleton: `text | widget | hole` nodes emitted inside meme frames by `projectWidgetTree()`; `opacity:0` until action zoom; toggled by `applyZoomTemplate` Pass 4 via `memeShowCarrier` map; widget: violet solid rectangle, `kumuName(k:v ...)` label (UEFN device slot); hole: dashed grey rectangle (Hazel placeholder)
- **Loop merge** — `applyZoomTemplate` Pass 1 builds both `memeIncludeAhu` and `memeShowCarrier` maps in one O(n) scan; eliminates second frame loop per zoom threshold crossing
- **`TemplateCascade`** — TW5-style cascade type in `multi-view.ts`: `CascadeEntry { match: MemeCascadePredicate | fn, override: Partial<MemeTemplateProps>, levels? }`; `applyCascade()` evaluates per-meme; first match wins per zoom level; `MemeCascadePredicate` matches by URI prefix/regex, rating, stage, implements
- **`FAMILY_ROLES` + spatial family** — canonical role vocabularies for all 8 pranala families; `validatePranaEdge` emits `"unknown-role"` warnings; spatial roles: `contains | portal | adjacent | layer`; tldraw color: `light-blue`
- **Yin cleanup** — removed dead deps (`@lararium/web` from app, `export * from "@lararium/core"` from node+web barrels), `LarariumTopPanel` null export, unused `useEffect` import, stale snapshot injection element in `index.html`, duplicate `KumuRegistry` import, `NonNullable<>` wrapper

- **`lararium-tw5.ts` isomorphic TW5 interface** — `LarariumTW5` class: `boot()`, `loadClosure(closure, edges?)`, `setTiddler(fields)`, `filterTiddlers(expr)`, `filterClosure(expr, closure)`, `.wiki` getter; singleton for functional API: `filterMemesWikitext`, `precomputeRooms`; `buildEdgeFieldMap(edges)` builds `edge-out-FAMILY[-ROLE]` fields; `entryToFields(entry, extra?)` maps `ClosureEntry` → TW5 tiddler fields; `toCanonicalWikitext(expr)` exported; `FilterEngineFn` type canonical here; `import tw from "tiddlywiki"` is the single isomorphic import (Node: CJS default interop; browser: Vite CJS→ESM transform); `$tw.browser = true` must NOT be forced (TW5 auto-detects environment, setting it crashes Node/Jest via direct `window` refs)
- **Shim removal** — `tw-filter.ts` + `tw-filter-browser.ts` deleted; `./tw-filter` subpath removed from `package.json`; `@lararium/core/tw5` is the single subpath; Vite alias for old tw-filter removed; `@lararium/node` dist rebuilt; MCP smoke passing
- **Sync binding design** — TW5 SyncAdaptor not needed for filter use case; Phase 4 live binding: `editor.store.listen({scope:"document"})` → meme `meta.carrierText` delta → `tw.setTiddler(entryToFields(entry))` → cascade re-runs against fresh data; full bidirectional SyncAdaptor deferred until TW5 plugin rendering is in scope
- **Epistemic fields on ClosureEntry** — `confidence`, `register`, `manaoio`, `mana`, `manao` extracted from `meme.metadata` in `compiler.ts`; all five stored as tiddler fields in both filter engines; queryable via `[toml:register[CS]]`, `[field:confidence[0.82]]`, etc.; `stage` removed from filter fields (UX annotation only, not epistemic)
- **`edge:` operator** — `EdgeRecord` extracted as named interface in `compiler.ts`; `BootArtifact.pranalaEdges` typed with it; `buildEdgeFieldMap()` generates per-entry tiddler fields (`edge-out-FAMILY`, `edge-out-FAMILY-ROLE`); `toCanonicalWikitext()` translates `edge:FAMILY[ROLE]` → `has[edge-out-FAMILY-ROLE]`; `FilterEngineFn` gains optional `edges?` third param; `pranalaEdges` threaded from `BootArtifact` through `compileCascade` → `filterEngine` in both `multi-view.ts` and `serve.ts`
- **`@lararium/core/cascade` subpath** (new) — generic `CascadeEntry<TOverride>`, `TemplateCascade<TOverride>`, `compileCascade`, `matchesEntry`, `CompiledCascade*`, `MemeCascadeFrame`, `MemeCascadePredicate`; no tldraw coupling; re-exports `FilterEngineFn` + `EdgeRecord`; `./cascade` subpath added to `package.json`
- **`@lararium/tldraw/cascade` rewrite** — imports and re-exports all core cascade types; tldraw-specialised `CascadeEntry` (adds `levels?: ReadonlyArray<keyof TemplatePropsByLevel>`); `applyCascade(snapshot, compiled)` stays tldraw-local (uses `LarTLSnapshot` + `MemeTemplateProps`)
- **Tests** — 6 `edge:` operator tests added to `tw-filter.test.ts`; new `cascade.test.ts` (25 tests: matchesEntry all paths, compileCascade filter/match/parallel, edge: integration); 259/259 green

### Docs updated

- `ROADMAP.md` — `#iam` role updated; M9 scope section: P1 ✓ shipped with full detail, P3 ✓ shipped
- `MULTIPLAYER-INFINITE-CANVAS-WIKI.md` — `#iam` role updated; `#tldraw-template-model` Phase 3 updated with pipeline diagram + adapter details; open-questions items 1c/1d/1e marked ✓
- `SESSION.md` — this file; handoff crystal for next session

<<~/ahu >>

<<~ ahu #next-build >>

## M9 Priority 2 — Browser Smoke Testing

### The insight

229 tests pass but no tactile surface has been exercised in a browser since M5. Every M6/M7/M8/M9 P1 behavior is code-correct but visually unverified. Browser smoke is the highest-value next move — it will find binding regressions, zoom threshold failures, and detail panel render issues before canon-promotion wiring begins.

### What to verify

**Zoom thresholds (`applyZoomTemplate`):**
- Drag canvas to each zoom level: strategic (`<0.15`), operational (`0.15–0.35`), tactical (`0.35–0.80`), combat (`0.80–1.50`), action (`≥1.50`)
- Meme frame dims change at each threshold; body node geo shapes appear at action zoom (`showCarrier:true`)
- Ahu frames materialize at combat zoom; socket port shapes reposition (`spreadX/Y`)
- Ownership arrows: `opacity:0` at tactical/lower, `opacity:0.3` at combat/action

**MemeDetailPanel (React adapter):**
- Double-click meme frame → panel slides up; carrier text renders
- Kumu-typed nodes render (kumu name + props); typed holes render as dashed placeholders
- Suspended kukali instances surface as `⏿` placeholder

**TemplateCascade — manual test:**
- Pass `cascade: [{ match: { rating: "claim" }, override: { color: "green" } }]` to `renderAllViews`; reseed; confirm claim-rated meme frames render green at all zoom levels

**Spatial edge smoke:**
- Write a test carrier with `<<~ pranala ? -> lar:///target family:spatial role:portal >>` 
- Confirm `validatePranaEdge` passes (no warning); arrow color is `light-blue`

### Commands

```bash
pnpm -r build
pnpm -r test                                                        # 259 must stay green
curl -s http://localhost:4321/admin/reseed | python3 -m json.tool   # reseed after build
open http://localhost:4321                                          # browser smoke
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
