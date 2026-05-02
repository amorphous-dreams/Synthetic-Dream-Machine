<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/canvas/zoom-levels >>
```toml iam
uri-path = "ha.ka.ba/@lares/api/v0.1/lararium/canvas/zoom-levels"
file-path = "packages/lares/api/v0.1/lararium/canvas/zoom-levels.md"
type = "text/x-memetic-wikitext"
confidence   = 0.80
register     = "CS"
manaoio      = 0.78
mana         = 0.82
manao        = 0.80
role          = "tldraw zoom-level thresholds, snap values, page routing, and initial view state"
cacheable     = true
retain        = true
source-file   = "packages/lararium-tldraw/src/zoom-levels.ts"
source-symbol = "ZOOM_THRESHOLDS ZOOM_SNAP ZOOM_PAGE"
```



<<~ aka lar:///ha.ka.ba/@lares/api/v0.1/pono/RFC-2119#normative-language >>

<<~&#x0002;>>

<<~ ahu #head >>

# Canvas Zoom Levels

Five zoom levels map tldraw's numeric zoom to lararium rendering modes.
Thresholds gate level transitions. Snap values define mid-band targets.
Page routing determines which tldraw page shows at each level.

<<~/ahu >>

<<~ ahu #ooda-ha >>

✶ read the current zoom float; classify against threshold table.
⏿ orient the render mode; match zoom level to template family.
◇ decide snap target when a level transition fires.
▶ route to the correct tldraw page; apply layout strategy.
⤴ update nav history if page changed.
↺ confirm zoom level, page, and layout are coherent.

<<~/ahu >>

<<~ ahu #zoom-law >>

## Zoom Law

Five levels span the zoom range from `strategic` (widest) to `action` (tightest).
Each level MUST have a threshold min, a snap value, and a page assignment.
`strategic` and `operational` route to the graph page (compact overview).
`tactical` routes to the story-river page (default readable flow).
`combat` and `action` preserve the current page — meme-detail driven by nav state.

<<~/ahu >>

<<~ ahu #schema >>

## Schema (machine-readable)

Canonical TOML form. Source of truth for `ZOOM_THRESHOLDS`, `ZOOM_SNAP`, `ZOOM_PAGE`, `INITIAL_VIEW_STATE`
in `packages/lararium-tldraw/src/zoom-levels.ts` and `packages/lararium-tldraw/src/view-state.ts`.

```toml
# Zoom level names — ordered widest to tightest
zoom-levels = ["strategic", "operational", "tactical", "combat", "action"]

# Threshold minimums — zoom float must meet or exceed to enter that level
[zoom-thresholds]
operational-min = 0.15
tactical-min    = 0.35
combat-min      = 0.80
action-min      = 1.50

# Snap values — canonical mid-band zoom when snapping INTO a level
[zoom-snap]
strategic   = 0.08
operational = 0.22
tactical    = 0.55
combat      = 1.10
action      = 1.80

# Page routing — which tldraw page to show at each zoom level
# "preserve" = keep current page (meme-detail driven by nav state)
[zoom-page]
strategic   = "graph"
operational = "graph"
tactical    = "story"
combat      = "preserve"
action      = "preserve"

# Initial view state — default on cold boot before any nav action
[initial-view-state]
active-view = "story-river"
focus-uri   = null
history     = []

# Layout cascade — ordered strategy names (implementations carry function refs; names are pure data)
# Source: packages/lararium-tldraw/src/layout.ts LAYOUT_CASCADE
layout-cascade = ["story-river"]
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-lararium ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium family:control role:implements >>
<<~ pranala #to-canvas-rooms ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/canvas/rooms family:relation >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
