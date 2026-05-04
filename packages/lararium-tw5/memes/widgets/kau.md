<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/kau >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/kau"
file-path = "packages/lararium-tw5/memes/widgets/kau.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: KauWidget — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/widgets/kau.ts"
source-symbol = "KauWidget"
module-ref    = "lar:///ha.ka.ba/@lararium/tw5/widgets/kau-tw5"
body-sha256 = "e1e3f511393258e6cb6285460d797c1686c34644676c435c5c02e0dd61e1dc47"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`<$kau>` places a device instance into the carrier. kau = "to place upon, set down with intention" (Hawaiian).

Each `<$kau>` creates a device instance with:
- **Instance URI**: `carrierUri#fragment` (auto-generated UUID if `fragment` absent — write-back stub fires on first commit)
- **Own execution context**: `currentTiddler` set to instance URI before transcluding the kumu def
- **Persistent addressability**: instance URI becomes UCAN resource for per-instance capability grants (Keyhive stub)

Attributes: `fragment` (optional #id), `name` (kumu definition name), `propsRaw` (key:value pairs).

Resolves kumu definition via `[all[tiddlers]tag[$:/tags/LarariumKumu]field:kumu-name[name]]`.
Renders `<div data-lar-kind="kau" data-lar-instance="uri">`. Unresolved devices show `<span data-lar-kind="hole">`.

### Keyhive stubs

Two integration boundaries stubbed for future WASM:

1. `registerKauCapabilityHook(hook)` — fires with instance URI; returns authority envelope for instance scope
2. `registerKauWriteBackHook(hook)` — fires on first render when fragment auto-generated; writes UUID back into carrier text

<<~/ahu >>

<<~ ahu #source >>

## Source

See [packages/lararium-tw5/src/widgets/kau.ts](packages/lararium-tw5/src/widgets/kau.ts)

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/kau family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/@lararium/tw5/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/kau-tw5 family:control role:module >>
<<~ pranala #to-kumu ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/kumu family:control role:depends >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
