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
role         = "session handoff crystal — 2026-04-28 — M9 P1+P3 complete; three-tree pipeline live for both adapters; render-target.ts boundary contract explicit; TemplateCascade TW5 cascade type wired; FAMILY_ROLES + spatial family locked; 229/229 tests green; M9 remaining: browser smoke (P2), canon-promotion surface (P4), wiki-recipe carriers (P5)"
```

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
SESSION opens
<<~/ahu >>

<<~ ahu #ooda-ha >>

✶ Read ROADMAP `#milestone-9-scope` and WIKI `#tldraw-template-model`. Confirm 229/229 tests green. Confirm server at `http://localhost:4321`.
⏿ Three-tree pipeline complete for both adapters. Render-target.ts owns the boundary contract. TemplateCascade wired. FAMILY_ROLES locked. The widget tree IS the kumu-typed intermediate layer — kahea sigil nodes resolve to WidgetNode via registry, then delegate to executed output (React) or structural skeleton (tldraw). TW5 selective refresh law: re-resolve only when `meta.carrierText` changes in CRDT delta.
◇ M9 remaining: browser smoke (P2 — all tactile behaviors unverified), canon-promotion surface (P4 — `PUT /admin/promote`), wiki-recipe carriers (P5 — `lares/recipes/` schema). Wehe executor (future — Verse procedure call, depends on async ReactionGraph).
▶ Browser smoke is the highest-value unverified surface. Start Playwright baseline: zoom thresholds, body node visibility at action zoom, socket repositioning, detail panel kumu-typed render, TemplateCascade applied to specific meme URIs.
⤴ Verify 229/229 still green after browser smoke scaffold. Confirm body nodes visible at action zoom, hidden at tactical. Confirm cascade override changes frame color for matching memes.
↺ Update SESSION.md as items complete. Canon-promotion surface is the next structural advance.

<<~/ahu >>

<<~ ahu #state >>

## State as of 2026-04-28 session end (M9 P1+P3 complete)

**Branch:** `feature/lararium-node-2` — 229/229 tests green — server at `http://localhost:4321`

### Shipped this session (M9 P1 + P3)

- **`render-target.ts`** — explicit boundary contract between widget tree and downstream renderers; `RenderTargetAdapter` interface + `RENDER_TARGET_ADAPTERS` machine-readable registry (tldraw: boot-snapshot; react: on-demand); `WidgetSlot { widget, result }`; `buildWidgetMap(widgetTree, results) → Map<pos, WidgetSlot>`; `projectCarrier(uri, text, registry) → { ast, widgetTree }` (single-parse guarantee)
- **`kumu-react-render.tsx`** — React render adapter extracted from MemeDetailPanel; `renderCarrier(ast, widgetMap)` walks AST, delegates kahea nodes to `widgetMap.get(node.pos)`; all 8 families colored; Hazel typed holes (dashed); suspended kukali `⏿` placeholders; dead css styles (`sigil`, `sigilName`, `sigilAttr`) removed
- **`LarTLBodyNode[]`** — tldraw structural skeleton: `text | widget | hole` nodes emitted inside meme frames by `projectWidgetTree()`; `opacity:0` until action zoom; toggled by `applyZoomTemplate` Pass 4 via `memeShowCarrier` map; widget: violet solid rectangle, `kumuName(k:v ...)` label (UEFN device slot); hole: dashed grey rectangle (Hazel placeholder)
- **Loop merge** — `applyZoomTemplate` Pass 1 builds both `memeIncludeAhu` and `memeShowCarrier` maps in one O(n) scan; eliminates second frame loop per zoom threshold crossing
- **`TemplateCascade`** — TW5-style cascade type in `multi-view.ts`: `CascadeEntry { match: MemeCascadePredicate | fn, override: Partial<MemeTemplateProps>, levels? }`; `applyCascade()` evaluates per-meme; first match wins per zoom level; `MemeCascadePredicate` matches by URI prefix/regex, rating, stage, implements
- **`FAMILY_ROLES` + spatial family** — canonical role vocabularies for all 8 pranala families; `validatePranaEdge` emits `"unknown-role"` warnings; spatial roles: `contains | portal | adjacent | layer`; tldraw color: `light-blue`
- **Yin cleanup** — removed dead deps (`@lararium/web` from app, `export * from "@lararium/core"` from node+web barrels), `LarariumTopPanel` null export, unused `useEffect` import, stale snapshot injection element in `index.html`, duplicate `KumuRegistry` import, `NonNullable<>` wrapper

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
pnpm -r test                                                        # 229 must stay green
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
