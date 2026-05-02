<<~&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/modules/deserializer >>
```toml iam
uri-path = "ha.ka.ba/@lares/api/v0.1/lararium/modules/deserializer"
file-path = "packages/lares/api/v0.1/lararium/modules/deserializer.md"
type         = "text/x-memetic-wikitext"
register     = "CS"
confidence   = 0.88
mana         = 0.88
manao        = 0.85
manaoio      = 0.82
role         = "heleuma ka: TW5 tiddlerdeserializer for text/x-memetic-wikitext"
status-date  = "2026-05-01"
heleuma      = "ka"
source-file  = "packages/lararium-tw5/src/deserializer.ts"
source-symbol = "memeticWikitextDeserializer"
module-ref   = "lar:///ha.ka.ba/@lares/api/v0.1/lararium/modules/deserializer-tw5"
implements   = ["lar:///ha.ka.ba/@lares/api/v0.1/pono/heleuma/ka"]
body-sha256  = ""
```


<<~&#x0002;>>

<<~ ahu #contract >>

## Deserializer — Contract

TW5 `module-type = "tiddlerdeserializer"` module keyed to `text/x-memetic-wikitext`.

When TW5 encounters a tiddler with that content-type, it calls:

```
deserializer(text: string, fields: Record<string, unknown>) → TiddlerFields[]
```

Stream model:
- **Multi-carrier**: MemeStreamParser emits one `carrier-close` per meme; each becomes `[parent, ...children]`.
- **Partial carrier** (no ETX): `flush()` emits best-effort; no crash.
- **Bare body** (no SOH framing): treated as a single carrier with `fields.title` as URI.

Parent tiddler: `text = original carrier text`, `type = "text/x-memetic-wikitext"`.
Child tiddlers (ahu slots): `text = ahu body text`, also `type = "text/x-memetic-wikitext"`.
No AST→string reconstruction. MemeticParser owns all rendering for both levels.

Compiled artifact: `lares/ha-ka-ba/api/v0.1/lararium/modules/deserializer-tw5.md`
Build: `pnpm --filter @lararium/tw5 build:modules`

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #splits ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/carrier-split family:data role:uses >>
<<~ pranala #streams ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/meme-stream family:data role:uses >>
<<~ pranala #module ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/modules/deserializer-tw5 family:control role:compiles-to >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
