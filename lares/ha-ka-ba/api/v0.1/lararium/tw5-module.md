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
| `mana` | MUST be ≥ 0.90 to pass gate layer 1 (threshold) |
| `manao` | MUST be ≥ 0.85 to pass gate layer 1 (threshold) |
| `manaoio` | MUST be ≥ 0.85 to pass gate layer 1 (threshold) |
| `confidence` | MUST be ≥ 0.90 to pass gate layer 1 (threshold) |
| `body-sha256` | SHA-256 hex digest of the body text; MUST match at inject time (gate layer 2 — content integrity); written by `scripts/write-module-meme.ts` at build time |
| `promoted-at` | ISO 8601 timestamp written by `/admin/promote` ceremony; MUST be present (gate layer 3 — operator authorization); memes without this field are never injected regardless of threshold or hash |

### Body

The meme body (between `<<~&#x0002;>>` and `<<~&#x0003;>>`) MUST be a self-contained IIFE JS bundle
with no unresolved external imports. `tiddlywiki` MAY be referenced as the global `$tw` — the host
TW5 instance provides it at injection time.

### Capability Model

The kernel holds the `$tw.wiki` reference. Injecting a module meme into TW5 hands that reference
to the bundle's execution context. Three gate layers must all pass before the kernel hands `$tw.wiki`
to any meme body:

1. **Threshold** (`mana` ≥ 0.90, `manao` ≥ 0.85, `manaoio` ≥ 0.85, `confidence` ≥ 0.90) — declared intent
2. **Content hash** (`body-sha256` matches `sha256(text)`) — body integrity; set at build time by `pnpm bundle`, verified at inject time; a tampered or stale body fails here
3. **Ceremony stamp** (`promoted-at` present) — operator authorization; written only by `/admin/promote` on localhost; peer-synced memes without this field are never injected

A meme that fails any layer falls through to the imperative fallback path and is not executed.
The build process (`pnpm bundle`) is the trust anchor for layers 1–2; the operator is the trust
anchor for layer 3.

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
