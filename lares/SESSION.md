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
role         = "session handoff crystal — 2026-04-28 — M8 complete; socket skeleton + ownership arrows + kumuDefs pipeline shipped; M9 target is resolveWidgetTree render pass in MemeDetailPanel"
```

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
SESSION opens
<<~/ahu >>

<<~ ahu #ooda-ha >>

✶ Read ROADMAP `#milestone-9-scope` and WIKI `#hidden-skeleton` + `#causal-islands`. Confirm 229/229 tests green. Confirm server at `http://localhost:4321`.
⏿ The tldraw ownership skeleton (meme→ahu→socket `control:owns` arrows) IS the widget tree binding surface. Render targets for tldraw DOM must obey TW5 selective refresh (changedTiddlers) and Verse pull-on-demand (explicit per-island update). No cascading re-renders outside declared papalohe ports.
◇ M9 Priority 1: wire `resolveWidgetTree(ast, registry)` into `MemeDetailPanel` — walk `WidgetNode[]` not raw `MemeAstNode[]`; kumu-typed nodes render via template; unresolved names render as typed holes (Hazel). Priority 2: browser smoke. Priority 3: spatial family. Priority 4: canon-promotion surface.
▶ Start with `MemeDetailPanel.tsx` + `widget-tree.ts`. Build the render pass. Keep TW5 selective refresh law: only re-resolve when `meta.carrierText` changes in CRDT delta.
⤴ Verify 229/229 still green. Visual check: double-click meme at action zoom → detail panel renders kumu-typed nodes. Reseed and confirm.
↺ Update ROADMAP `#milestone-9-scope` as items complete. Note what still crowds: browser smoke, spatial family, canon-promotion.

<<~/ahu >>

<<~ ahu #state >>

## State as of 2026-04-28 session end

**Branch:** `feature/lararium-node-2` — 229/229 tests green — server at `http://localhost:4321`

### Shipped this session

- **Socket port shapes** — `LarTLSocket`, hidden `TLGeoShape` ellipses (8×8, opacity:0) per ahu slot; pranala arrows bind to sockets permanently; `applyZoomTemplate` repositions sockets between `centerX/Y` (meme header, low zoom) and `spreadX/Y` (ahu center, combat/action)
- **Ownership skeleton** — 14 `control:owns` arrows per boot (7 meme→ahu + 7 meme→socket); `isOwnership:true`, `isLocked:true`, `opacity:0` at low zoom → `0.3` at combat/action; `meta.ownsMemeId` for zoom toggle; queryable as graph facts independent of tldraw `parentId`
- **Ahu detachment fix** — ahu frames `isLocked:true` in emission + `opacity:0` at low zoom; prevents tldraw reparenting when meme frame shrinks below ahu bounds
- **kumuDefs pipeline** — `collectKumuDefsFromGraph()` in `node-host.ts` populates `artifact.kumuDefs` (5 defs: meme-strategic → meme-action); `buildKumuRegistry()` live at boot; `templateProps` seeded from lares carriers, not hardcoded defaults
- **kukali / `\suspends`** — parser + grammar meme + 3 tests; depends on `ReactionGraph.fire()` async (already shipped prior session)
- **TW5 / Verse research** — integrated into WIKI `#causal-islands`: TW5 = push-on-change (`changedTiddlers`); Verse = pull-on-demand (`SetText()`); socket repositioning IS TW5 selective refresh

### Docs updated

- `ROADMAP.md` — M8 critical path items 4+5 marked ✓; "Also completed" block; M9 scope section opened
- `MULTIPLAYER-INFINITE-CANVAS-WIKI.md` — `#views` table extended (ahu visibility + ownership cols); `#hidden-skeleton` ahu added; `#causal-islands` TW5/Verse synthesis section added

<<~/ahu >>

<<~ ahu #next-build >>

## M9 Priority 1 — resolveWidgetTree render pass

### The insight

The tldraw skeleton acts as the visual binding of the widget tree and the first working template model. The rendered tldraw DOM should obey TW5 and Verse render target best practices:

- **TW5 law:** each widget self-checks `changedTiddlers` before re-rendering — don't rebuild the whole tree. In Lararium: only re-resolve widget tree when `meta.carrierText` of the focal meme changes in the CRDT delta.
- **Verse law:** each kumu instance = a causal island; render updates cross island boundaries only via declared `papalohe` edges, not by walking tldraw shape hierarchy. The render pass reads `WidgetNode[]`, not `MemeAstNode[]`.

### What to build

`MemeDetailPanel.tsx` currently renders raw `MemeAstNode[]`. Upgrade:

1. Call `resolveWidgetTree(ast, registry): WidgetNode[]` after `parseMemeCarrier`
2. `registry` reconstructed from `artifact.kumuDefs` already seeded in boot store — read from `editor.store` or pass through `LarariumContext`
3. Walk `WidgetNode[]`:
   - `{ def: KumuDef }` → render kumu template body (TOML props → shape props)
   - `{ def: null }` → render placeholder: `"unknown kumu: name"` (Hazel typed hole)
4. TW5 selective refresh: memoize on `meta.carrierText`; only re-resolve when the meme's carrier text changes in the store listener

### Files

```
packages/lararium-core/src/widget-tree.ts     — resolveWidgetTree, KumuRegistry, WidgetNode
packages/lararium-app/src/MemeDetailPanel.tsx  — current raw AST renderer → upgrade target
packages/lararium-app/src/lararium-context.tsx — LarariumContext, useLararium, editor ref
packages/lararium-tldraw/src/records.ts        — LarTLSocket, LarTLArrow.isOwnership, ownsArrowId
packages/lararium-tldraw/src/project.ts        — ownership arrow emission, socket projection
packages/lararium-tldraw/src/layout.ts         — SocketGeometry, ownership arrow geometry
packages/lararium-tldraw/src/tldraw-shapes.ts  — socket geo emission, isOwnership opacity/lock
packages/lararium-node/src/node-host.ts        — collectKumuDefsFromGraph
packages/lararium-node/scripts/serve.ts        — buildBootProjection, buildKumuRegistry
lares/lararium-node/ROADMAP.md                 — #milestone-9-scope
lares/lararium-node/MULTIPLAYER-INFINITE-CANVAS-WIKI.md — #hidden-skeleton, #views
```

### Commands

```bash
pnpm -r build
pnpm -r test                                                        # 229 must stay green
curl -s http://localhost:4321/admin/reseed | python3 -m json.tool   # reseed after build
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
