<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/tw5-module >>

<<~ ahu #iam >>

```toml
uri-path     = "ha.ka.ba/api/v0.1/lararium/tw5-module"
file-path    = "lares/ha-ka-ba/api/v0.1/lararium/tw5-module.md"
content-type = "text/x-memetic-wikitext"
register     = "CS"
confidence   = 0.90
mana         = 0.90
manao        = 0.88
manaoio      = 0.85
role         = "interface bundle: kernel-injectable TW5 module meme; capability gate for corpus-carried executable code"
cacheable    = true
retain       = true
```

<<~/ahu >>

<<~&#x0002;>>

## TW5 Module Interface

A carrier that implements `lar:///ha.ka.ba/api/v0.1/lararium/tw5-module` declares itself as a
kernel-injectable TW5 module. The kernel's `_bootModules()` gate queries for all implementors,
evaluates the capability threshold, and injects passing memes as TW5 shadow tiddlers after
corpus load.

### Required `#iam` Fields

| field | meaning |
|---|---|
| `content-type` | MUST be `"application/javascript"` |
| `module-type` | MUST be one of `"parser"`, `"widget"`, `"library"`, `"startup"` |
| `tw5-module-name` | The string key TW5 registers the module under (e.g. `"text/x-memetic-wikitext"` for parsers) |
| `mana` | MUST be ≥ 0.90 to pass the injection gate |
| `manaoio` | MUST be ≥ 0.85 to pass the injection gate |
| `confidence` | MUST be ≥ 0.90 to pass the injection gate |

### Body

The meme body (between `<<~&#x0002;>>` and `<<~&#x0003;>>`) MUST be a self-contained IIFE JS bundle
with no unresolved external imports. `tiddlywiki` MAY be referenced as the global `$tw` — the host
TW5 instance provides it at injection time.

### Capability Model

The kernel holds the `$tw.wiki` reference. Injecting a module meme into TW5 hands that reference
to the bundle's execution context. The threshold fields (`mana`, `manaoio`, `confidence`) are the
UCAN-style capability attenuation gate — a meme that fails the threshold is never handed the wiki
reference, regardless of what its body claims.

The kernel MUST NOT inject a module meme promoted from a lower-trust peer without operator
confirmation via the `/admin/promote` ceremony.

### Fallback

If no module memes pass the threshold at boot, the kernel falls back to imperative registration
(the compiled-in `_registerMemeticParser()` / `_registerWidgets()` path). This ensures the system
boots correctly in offline or cold-start conditions before the corpus is loaded.

<<~ ahu #edges >>

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #implements-kapu ? -> lar:///ha.ka.ba/api/v0.1/pono/kapu family:control role:implements >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/lararium/modules/tw5-modules >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
