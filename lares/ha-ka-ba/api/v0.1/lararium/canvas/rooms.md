<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/canvas/rooms >>

<<~ ahu #iam >>

```toml
uri-path     = "ha.ka.ba/api/v0.1/lararium/canvas/rooms"
file-path    = "lares/ha-ka-ba/api/v0.1/lararium/canvas/rooms.md"
content-type = "text/x-memetic-wikitext"
confidence   = 0.80
register     = "CS"
manaoio      = 0.78
mana         = 0.82
manao        = 0.80
role         = "lararium canvas room registry — default rooms, portals, layout types"
cacheable    = true
retain       = true
```

<<~/ahu >>

<<~ aka lar:///ha.ka.ba/api/v0.1/pono/RFC-2119#normative-language >>

<<~&#x0002;>>

<<~ ahu #meme-header >>

# Lararium Canvas Rooms

Four built-in rooms form the default lararium canvas.
Each room has an id, a TiddlyWiki filter expression, a tldraw page, and a layout strategy.
Portals connect rooms as directed edges.

<<~/ahu >>

<<~ ahu #ooda-ha >>

✶ count rooms; name layout strategy for each.
⏿ orient portals against room topology; check directionality.
◇ decide whether default list covers session need.
▶ emit room registry with portals; bind tldraw page ids.
⤴ verify each portal references valid room ids.
↺ confirm room nav closes back to system view.

<<~/ahu >>

<<~ ahu #room-law >>

## Room Law

A room MUST carry `id`, `name`, `filter`, and `layout`.
A room SHOULD carry `tlPageId` when a dedicated tldraw page is allocated.
A portal MUST carry `id`, `fromRoomId`, `toRoomId`, and `label`.
Portal ids SHOULD follow the convention `portal:{from}→{to}`.

Layout strategies are ordered. The cascade selects first match.
`story-river` is the catch-all default and MUST appear last.

<<~/ahu >>

<<~ ahu #vocab >>

## Vocabulary (machine-readable)

Canonical TOML form. Source of truth for `ROOM_SYSTEM`, `ROOM_INVARIANTS`, `ROOM_ENTRY`, `ROOM_GRAPH`,
`DEFAULT_ROOMS`, `DEFAULT_PORTALS` in `packages/lararium-tldraw/src/room.ts`.

```toml
# Named room constants — scanner aliases; data repeated in [[default-rooms]] below
room-system     = "system"
room-invariants = "invariants"
room-graph      = "graph"
room-entry      = "entry"

# Named list constants — scanner aliases; full data in [[default-rooms]] / [[default-portals]] below
default-rooms   = ["system", "invariants", "graph", "entry"]
default-portals = ["portal:system→graph", "portal:graph→system", "portal:system→invariants", "portal:invariants→system"]

# Built-in room presets — ordered for side-panel nav
[[default-rooms]]
id       = "system"
name     = "System View"
filter   = "[all[memes]sort[depth]]"
tl-page  = "boot"
layout   = "story-river"

[[default-rooms]]
id       = "invariants"
name     = "Invariants"
filter   = "[all[memes]tag[lar:///ha.ka.ba/api/v0.1/pono/invariant]]"
tl-page  = "invariants"
layout   = "story-river"

[[default-rooms]]
id       = "graph"
name     = "Graph Overview"
filter   = "[all[memes]sort[depth]]"
tl-page  = "graph"
layout   = "graph"

[[default-rooms]]
id       = "entry"
name     = "Entry Point"
filter   = "[entry[]]"
tl-page  = "entry"
layout   = "meme-detail"

# Built-in portals — directed edges between default rooms
[[default-portals]]
id         = "portal:system→graph"
from-room  = "system"
to-room    = "graph"
label      = "Graph →"

[[default-portals]]
id         = "portal:graph→system"
from-room  = "graph"
to-room    = "system"
label      = "← System"

[[default-portals]]
id         = "portal:system→invariants"
from-room  = "system"
to-room    = "invariants"
label      = "Invariants →"

[[default-portals]]
id         = "portal:invariants→system"
from-room  = "invariants"
to-room    = "system"
label      = "← System"
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-lararium ? -> lar:///ha.ka.ba/api/v0.1/lararium family:control role:implements >>
<<~ pranala #to-canvas-zoom ? -> lar:///ha.ka.ba/api/v0.1/lararium/canvas/zoom-levels family:relation >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
