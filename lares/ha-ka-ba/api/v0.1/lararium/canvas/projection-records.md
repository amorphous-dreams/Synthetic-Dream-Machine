<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/canvas/projection-records >>

<<~ ahu #iam >>
```toml
uri-path      = "ha.ka.ba/api/v0.1/lararium/canvas/projection-records"
file-path     = "lares/ha-ka-ba/api/v0.1/lararium/canvas/projection-records.md"
content-type  = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.86
mana          = 0.86
manao         = 0.84
manaoio       = 0.82
tagspace      = "adjacent"
role          = "tldraw projection record types: LarTLPage, LarTLFrame, LarTLSocket, LarTLArrow, LarTLNote, stable ID functions"
cacheable     = true
retain        = true
status-date   = "2026-04-30"
source-file   = "packages/lararium-tldraw/src/records.ts"
source-symbol = "LarTLPage LarTLFrame LarTLSocket LarTLArrow LarTLNote LarProjectionId memeFrameId ahuFrameId edgeArrowId pageId"
```
<<~/ahu >>

<<~ ahu #head >>

# Projection Records

Five record types form the tldraw emission layer — the projection from meme graph
to canvas shapes. All IDs follow the `shape:*` prefix rule (tldraw requirement).
Sockets carry stable IDs so arrows bind permanently; zoom repositions without rebinding.

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #law >>

## Law

All shape record IDs MUST start with `shape:` regardless of shape type.
The shape type (frame/arrow/note) lives in the `type` field, not the ID prefix.

`LarTLSocket` carries stable IDs. Arrows bind to sockets permanently.
`applyZoomTemplate` repositions sockets but does not rebind arrows:
- low zoom (`includeAhu:false`) → cluster to meme center (centerX, centerY)
- high zoom (`includeAhu:true`) → spread to ahu frame position (spreadX, spreadY)

Stage band on `LarTLFrame` is a UX annotation only — NOT an epistemic gate.

<<~/ahu >>

<<~ ahu #schema >>

## Schema (machine-readable)

```toml
# Projection scope values
projection-scopes = ["document", "session", "presence"]

# LarProjectionId — branded string `${prefix}:${artifact}`
# ID constructor functions
[id-functions]
meme-frame-id  = "shape:frame_{uri_escaped}"
ahu-frame-id   = "shape:ahu_{uri_escaped}_{socket_suffix}"
socket-id      = "shape:sock_{uri_escaped}_{slot_suffix}"
edge-arrow-id  = "shape:arrow_{from_escaped}__{to_escaped}"
owns-arrow-id  = "shape:owns_{from_escaped}__{to_escaped}"
page-id        = "page:{artifact_type}"

# LarTLPage — one per boot artifact view
[LarTLPage]
type        = "page"
fields      = ["id", "scope=document", "name", "compiledAt: ISO string", "memeCount: number"]

# LarTLFrame — one per meme carrier; also one per ahu socket (frameKind=ahu)
[LarTLFrame]
type      = "frame"
fields    = [
  "id", "scope=document", "pageId", "parentId: null | meme-frame-id",
  "uri", "name", "depth: number", "frameKind: meme|ahu",
  "rating: kapu|ano|meme|data|noise",
  "confidence: number", "register: string", "manaoio: number",
  "stage: GR|OS|US|CS|DS  # UX annotation only",
  "implements: string[]",
]

# LarTLSocket — stable arrow binding target; child of meme frame
[LarTLSocket]
type   = "socket"
fields = ["id", "scope=document", "pageId", "parentId: meme-frame-id", "memeUri", "slotId", "ahuIdx: number"]

# LarTLArrow — one per PranaEdge
[LarTLArrow]
type   = "arrow"
fields = [
  "id", "scope=document", "pageId",
  "fromFrameId", "toFrameId",
  "family", "role: string|null", "label",
  "isOwnership?: bool  # true for control:owns skeleton arrows",
  "trigger?: string|null  # reaction wire: source event",
  "fn?: string|null       # reaction wire: target function",
]

# LarTLNote — IAM block metadata summary inside a meme frame
[LarTLNote]
type   = "note"
fields = ["id", "scope=document", "pageId", "parentFrameId", "text"]
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-layout-geometry ? -> lar:///ha.ka.ba/api/v0.1/lararium/canvas/layout-geometry family:control role:depends >>
<<~ pranala #to-pranala-families ? -> lar:///ha.ka.ba/api/v0.1/pono/pranala-families family:control role:depends >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
