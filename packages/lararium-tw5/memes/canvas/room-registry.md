<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/canvas/room-registry >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/canvas/room-registry"
file-path = "packages/lararium-tw5/memes/canvas/room-registry.md"
type  = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.86
mana          = 0.86
manao         = 0.84
manaoio       = 0.82
tagspace      = "adjacent"
role          = "tldraw room and portal registry: four default rooms, four default portals, view-state shape, nav actions"
cacheable     = true
retain        = true
status-date   = "2026-04-30"
source-file   = "packages/dreamdeck-tldraw/src/room.ts packages/dreamdeck-tldraw/src/view-state.ts"
source-symbol = "DEFAULT_ROOMS DEFAULT_PORTALS ROOM_SYSTEM ROOM_INVARIANTS ROOM_ENTRY ROOM_GRAPH INITIAL_VIEW_STATE LarViewAction"
```



<<~ ahu #head >>

# Room Registry

A room = one tldraw page driven by a TW5 filter expression.
Portals = navigation arrows between rooms (spatial family edge, rendered as tldraw shape).
Four default rooms ship with the docs-wiki canvas type.
View-state functions as a pure reducer — nav history stack enables back-navigation.

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #schema >>

## Schema (machine-readable)

```toml
# Default rooms — ordered for side-panel nav
[[default-rooms]]
id       = "system"
name     = "System View"
filter   = "[all[memes]sort[depth]]"
tl-page  = "page:lararium:boot"
layout   = "story-river"

[[default-rooms]]
id       = "invariants"
name     = "Invariants"
filter   = "[all[memes]tag[lar:///ha.ka.ba/@lares/api/v0.1/pono/invariant]]"
tl-page  = "page:lararium:invariants"
layout   = "story-river"

[[default-rooms]]
id       = "graph"
name     = "Graph Overview"
filter   = "[all[memes]sort[depth]]"
tl-page  = "page:lararium:graph"
layout   = "graph"

[[default-rooms]]
id       = "entry"
name     = "Entry Point"
filter   = "[entry[]]"
tl-page  = "page:lararium:entry"
layout   = "meme-detail"

# Default portals — bidirectional nav arrows
[[default-portals]]
id           = "portal:system→graph"
from-room-id = "system"
to-room-id   = "graph"
label        = "Graph →"

[[default-portals]]
id           = "portal:graph→system"
from-room-id = "graph"
to-room-id   = "system"
label        = "← System"

[[default-portals]]
id           = "portal:system→invariants"
from-room-id = "system"
to-room-id   = "invariants"
label        = "Invariants →"

[[default-portals]]
id           = "portal:invariants→system"
from-room-id = "invariants"
to-room-id   = "system"
label        = "← System"

# LarViewKind — four navigation states
view-kinds = ["story-river", "meme-detail", "graph", "room"]

# LarViewAction — pure reducer actions
view-actions = [
  "ZOOM_IN     { uri, fromRect? }    -- enter meme-detail, push history",
  "OPEN_GRAPH  {}                    -- enter graph view, push history",
  "CLOSE_GRAPH {}                    -- pop to previous view (story-river)",
  "NAVIGATE_BACK {}                  -- pop history stack",
  "GO_TO_ROOM  { roomId }            -- switch page, push history",
]

# LarNavFrame — one history entry
[nav-frame]
fields = ["view: LarViewKind", "focusUri: string | null", "fromRect: {x,y,w,h} | null"]

# INITIAL_VIEW_STATE
[initial-view-state]
active-view = "story-river"
focus-uri   = ""       # null at init
history     = []
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-layout-geometry ? -> lar:///ha.ka.ba/@lararium/tw5/canvas/layout-geometry family:control role:depends >>
<<~ pranala #to-zoom-levels ? -> lar:///ha.ka.ba/@lararium/tw5/canvas/zoom-levels family:control role:depends >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
