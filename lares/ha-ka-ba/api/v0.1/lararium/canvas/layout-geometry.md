<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/canvas/layout-geometry >>

<<~ ahu #iam >>
```toml
uri-path      = "ha.ka.ba/api/v0.1/lararium/canvas/layout-geometry"
file-path     = "lares/ha-ka-ba/api/v0.1/lararium/canvas/layout-geometry.md"
content-type  = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.84
mana          = 0.84
manao         = 0.82
manaoio       = 0.80
tagspace      = "adjacent"
role          = "tldraw canvas layout geometry constants: meme frame, ahu socket, detail, and graph layout dimensions"
cacheable     = true
retain        = true
status-date   = "2026-04-30"
source-file   = "packages/lararium-tldraw/src/layout.ts"
source-symbol = "FRAME_W FRAME_H AHU_W AHU_H DETAIL_FRAME_W GRAPH_FRAME_W LAYOUT_CASCADE"
```
<<~/ahu >>

<<~ ahu #head >>

# Layout Geometry

Three layout modes share a common coordinate system:
story-river (tactical), detail (combat), graph (strategic/operational).
Each mode carries frame dimensions, gap spacing, and canvas origin offsets.

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #schema >>

## Schema (machine-readable)

Canonical TOML form. Source of truth for geometry constants
in `packages/lararium-tldraw/src/layout.ts`.

```toml
# Story-river layout (tactical zoom — default reading surface)
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
active-view = "story-river"
focus-uri   = ""          # null at init
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #zoom-levels ? -> lar:///ha.ka.ba/api/v0.1/lararium/canvas/zoom-levels family:control role:depends >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
