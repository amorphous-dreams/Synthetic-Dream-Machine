<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~① ? -> lar:///ha.ka.ba/api/v0.1/lararium/templates/index >>

<<~ ahu #iam >>
```toml
uri-path     = "ha.ka.ba/api/v0.1/lararium/templates/index"
file-path    = "lares/ha-ka-ba/api/v0.1/lararium/templates/index.md"
content-type = "text/x-memetic-wikitext"
role         = "namespace index — canvas render templates for tldraw meme frames; one kumu def per zoom level"
cacheable    = true
retain       = true
invariant    = false
```
<<~/ahu >>

<<~② ahu #body-open >>
TEMPLATES opens
<<~/ahu >>

<<~ ahu #system-role >>

# Canvas Render Templates

Each meme frame on the tldraw canvas is rendered according to the zoom-level template that matches its current viewport scale. Templates are kumu definitions — one per zoom level. The cascade walks the five levels in priority order; the first predicate that matches the current zoom level governs the frame's `w`, `h`, `color`, `label`, and visibility flags.

Template carriers live in `lares/templates/`. The compiler walks them as part of the boot closure and seeds them into `BootArtifact.kumuDefs`. The tldraw projection layer reads `kumuDefs` via `KumuRegistry` at seed time and stamps each meme frame shape with `meta.templateProps` for all five zoom levels. The canvas zoom listener calls `applyZoomTemplate(editor, level)` on threshold crossings, which batch-updates frame props from the stored template values — no server round-trip required.

## Cascade Predicate Contract

Each template carrier's `kumu` block carries a `cascade` TOML field — a filter predicate string. The cascade evaluates predicates in priority order (strategic → operational → tactical → combat → action) and the first match governs.

```
cascade = "zoom < 0.15"          ← strategic
cascade = "zoom < 0.35"          ← operational  (evaluated after strategic fails)
cascade = "zoom < 0.80"          ← tactical
cascade = "zoom < 1.50"          ← combat
cascade = "true"                 ← action (catch-all)
```

Future: predicates will support full wikitext-filter expressions evaluated against the meme's field context, enabling type-specific overrides (e.g. `zoom < 0.15 AND type = kapu`).

<<~/ahu >>

<<~③ ahu #body-close >>
TEMPLATES closes
<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #to-strategic  ? -> lar:///ha.ka.ba/api/v0.1/lararium/templates/meme-strategic  family:control role:owns >>
<<~ pranala #to-operational ? -> lar:///ha.ka.ba/api/v0.1/lararium/templates/meme-operational family:control role:owns >>
<<~ pranala #to-tactical   ? -> lar:///ha.ka.ba/api/v0.1/lararium/templates/meme-tactical   family:control role:owns >>
<<~ pranala #to-combat     ? -> lar:///ha.ka.ba/api/v0.1/lararium/templates/meme-combat     family:control role:owns >>
<<~ pranala #to-action     ? -> lar:///ha.ka.ba/api/v0.1/lararium/templates/meme-action     family:control role:owns >>

<<~/ahu >>

<<~④ -> ? >>
