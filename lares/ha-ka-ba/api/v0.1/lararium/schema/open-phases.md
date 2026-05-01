<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/schema/open-phases >>

<<~ ahu #iam >>
```toml
uri-path      = "ha.ka.ba/api/v0.1/lararium/schema/open-phases"
file-path     = "lares/ha-ka-ba/api/v0.1/lararium/schema/open-phases.md"
content-type  = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.86
mana          = 0.86
manao         = 0.84
manaoio       = 0.82
tagspace      = "adjacent"
role          = "lararium boot open-phase sequence, authority envelope modes, keyhive promotion seam"
cacheable     = true
retain        = true
status-date   = "2026-04-30"
source-file   = "packages/lararium-core/src/live-protocol.ts"
source-symbol = "LarariumOpenPhase LarariumAuthorityEnvelope"
```
<<~/ahu >>

<<~ ahu #head >>

# Open Phases

The open-phase sequence tracks boot progress from host open through TW5 hydration
to live delta stream. An authority envelope wraps every live session — currently
`local-dev` only; `keyhive` remains a type socket pending encrypted group sync.

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #schema >>

## Schema (machine-readable)

```toml
# LarariumOpenPhase — discriminated union, ordered boot sequence
# Each phase carries a kind tag plus phase-specific fields
[[open-phases]]
kind   = "host-opening"
fields = ["hostId: string"]

[[open-phases]]
kind   = "authority-opening"
fields = ["hostId: string"]

[[open-phases]]
kind   = "authority-ready"
fields = ["receipt: string"]

[[open-phases]]
kind   = "store-opening"
fields = ["recipeUri: string"]

[[open-phases]]
kind   = "store-ready"
fields = ["titleCount: number"]

[[open-phases]]
kind   = "tw5-opening"
fields = ["hostId: string"]

[[open-phases]]
kind   = "tw5-hydrating"
fields = ["loaded: number", "total: number"]

[[open-phases]]
kind   = "tw5-ready"
fields = ["hostId: string"]

[[open-phases]]
kind   = "live"
fields = ["offset: number"]

[[open-phases]]
kind   = "error"
fields = ["message: string"]

# LarariumAuthorityEnvelope — session envelope for live protocol seams
# Only local-dev executes today; keyhive is a type-only socket
[[authority-modes]]
mode   = "local-dev"
fields = ["roomId: string", "receiptHash: string", "issuedAt: string"]
status = "active"

[[authority-modes]]
mode   = "keyhive"
fields = ["graph: unknown", "peer?: string", "group?: string", "document?: string"]
status = "stub — pending encrypted group sync (Brooklyn/Beelay)"

# Keyhive promotion seam law:
# Canon crossing must NOT mutate lares/ directly from a live edit path.
# Submit proposal → Keyhive membership/capability check → review/signature receipt
# → projection/write-back worker materializes canon.
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-causal-islands ? -> lar:///ha.ka.ba/api/v0.1/pono/causal-islands family:control role:depends >>
<<~ pranala #to-node-host ? -> lar:///ha.ka.ba/api/v0.1/lararium/modules/node-host family:control role:depends >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
