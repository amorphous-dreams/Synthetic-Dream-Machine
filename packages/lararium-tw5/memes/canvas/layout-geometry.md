<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/canvas/layout-geometry >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/canvas/layout-geometry"
file-path = "packages/lararium-tw5/memes/canvas/layout-geometry.md"
type  = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.84
mana          = 0.84
manao         = 0.82
manaoio       = 0.80
tagspace      = "adjacent"
role          = "tldraw canvas layout geometry: canvas-type taxonomy, story-river as TW5/HUD host, docs-wiki meme frame + ahu socket + detail + graph dimensions"
cacheable     = true
retain        = true
status-date   = "2026-04-30"
source-file   = "packages/lararium-tldraw/src/layout.ts"
source-symbol = "FRAME_W FRAME_H AHU_W AHU_H DETAIL_FRAME_W GRAPH_FRAME_W LAYOUT_CASCADE CANVAS_TYPES"
```



<<~ ahu #head >>

# Layout Geometry

**Canvas-type-first model.** Each tldraw canvas instance carries a `canvas-type` that
governs which layout modes and zoom levels apply. The `story-river` layout hosts the
floating TW5/HUD instance — when the operator opens full TW5 mode, that floating frame
serves as the story-river surface. Other canvas types (RPG battle map, merchant/caravan UX,
docs/wiki) use independent geometry tuned to their surface.

Layout constants below apply to the `docs-wiki` canvas type (the Lararium default).
Full-text meme display at close zoom, story-river as primary reading surface.

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #canvas-types >>

## Canvas Types

```toml
# Known canvas types — each type selects its own layout geometry and zoom levels
# story-river serves as the floating TW5/HUD frame when in full TW5 mode
canvas-types = [
  "docs-wiki",       # meme graph + story-river HUD (default Lararium canvas)
  "rpg-battle-map",  # tactical battle grid; meme frames suppressed or minimized
  "rpg-company",     # caravan/merchant/company UX; card-layout not graph-layout
  "rpg-overworld",   # regional/hex map; spatial family edges drive layout
]

# story-river serves as the TW5/HUD floating overlay — present on docs-wiki; optional on others
# full-text-view is configurable per canvas type (default: true for docs-wiki only)
[canvas-type-flags]
docs-wiki.story-river-hud     = true
docs-wiki.full-text-at-close  = true   # configurable
rpg-battle-map.story-river-hud = false
rpg-company.story-river-hud   = false
```

<<~/ahu >>

<<~ ahu #schema >>

## Schema (machine-readable)

Canonical TOML form. Source of truth for geometry constants
in `packages/lararium-tldraw/src/layout.ts`.
Applies to the `docs-wiki` canvas type.

```toml
# Story-river layout (tactical zoom — default reading surface; see also the TW5/HUD host for a fully rendered HTML TW5 DOM)
[story-river]
frame-w    = 220    # meme frame width
frame-h    = 100    # meme frame height
ahu-w      = 180    # ahu socket sub-frame width
ahu-h      = 36     # ahu socket sub-frame height
ahu-pad-x  = 20     # left padding inside meme frame
ahu-pad-y  = 8      # top padding inside meme frame
ahu-gap    = 6      # vertical gap between ahu sockets
gap-x      = 80     # horizontal gap between depth columns
gap-y      = 24     # vertical gap between frames in same column
canvas-ox  = 100    # canvas origin x offset
canvas-oy  = 100    # canvas origin y offset

# Detail layout (combat zoom — meme-detail surface)
[detail]
frame-w  = 320
frame-h  = 160
gap-x    = 120
gap-y    = 40

# Graph layout (strategic/operational zoom — compact overview)
[graph]
frame-w  = 160
frame-h  = 80
gap-x    = 60
gap-y    = 16

# Animation parameters
# Source: packages/lararium-tldraw/src/nav.ts
[animation]
zoom-duration-ms = 400   # camera transition duration
zoom-inset-px    = 72    # padding inset when fitting a frame into view

# Initial view state
# Source: packages/lararium-tldraw/src/view-state.ts INITIAL_VIEW_STATE
[initial-view-state]
active-view   = "story-river"
canvas-type   = "docs-wiki"   # canvas type governs available layouts
focus-uri     = ""            # null at init
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #zoom-levels ? -> lar:///ha.ka.ba/@lararium/tw5/canvas/zoom-levels family:control role:depends >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
