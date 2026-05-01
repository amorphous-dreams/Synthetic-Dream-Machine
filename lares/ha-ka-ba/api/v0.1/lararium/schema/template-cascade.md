<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/schema/template-cascade >>
```toml iam
uri-path      = "ha.ka.ba/api/v0.1/lararium/schema/template-cascade"
file-path     = "lares/ha-ka-ba/api/v0.1/lararium/schema/template-cascade.md"
type  = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.86
mana          = 0.86
manao         = 0.84
manaoio       = 0.82
tagspace      = "adjacent"
role          = "TemplateCascade schema: priority-ordered override entries, filter vs match, compiled form, TW5 cascade semantics"
cacheable     = true
retain        = true
status-date   = "2026-04-30"
source-file   = "packages/lararium-core/src/cascade.ts"
source-symbol = "TemplateCascade CompiledCascade MemeCascadeFrame MemeCascadePredicate CascadeEntry"
```



<<~ ahu #head >>

# Template Cascade

TW5-style priority-ordered override list. First matching entry per meme wins.
Each entry carries either a `filter` (wikitext expression, pre-resolved to URI set)
or a `match` predicate (structural, no engine required). `filter` takes precedence.

Generic over `TOverride` — tldraw specialises to `MemeTemplateProps`; React (future)
to `KumuRenderProps`. The cascade is the render-target-agnostic override layer.

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #law >>

## Law

Evaluation order per entry:
1. `filter` present → evaluate as wikitext-filter against full closure; result = URI set; O(1) lookup at apply time
2. `match` present, `filter` absent → evaluate predicate per frame at apply time
3. Both absent → entry never matches

`compileCascade` pre-resolves all filter expressions once per render pass via `Promise.all`.
Match-only entries pass through with `matchingUris: null`.
Call once per `renderAllViews` / `applyFilterCascade` — not per meme.

<<~/ahu >>

<<~ ahu #schema >>

## Schema (machine-readable)

```toml
# MemeCascadeFrame — read-only snapshot of a meme for cascade predicate evaluation
[meme-cascade-frame]
fields = ["uri: string", "rating: string", "register: string", "confidence: number", "manaoio: number", "implements: string[]"]

# MemeCascadePredicate — structural match, no filter engine required
[meme-cascade-predicate]
fields = [
  "uri?: string | RegExp",
  "rating?: string",
  "register?: string",
  "implements?: string    # require this URI in implements[]",
  "minConfidence?: number",
  "maxConfidence?: number",
]

# CascadeEntry — one authored entry; generic over TOverride
[cascade-entry]
fields = [
  "filter?: string        # wikitext filter expression; takes precedence over match",
  "match?: MemeCascadePredicate | (frame) => boolean",
  "override: Partial<TOverride>  # merged on first match",
]

# filter examples
filter-examples = [
  "[all[memes]toml:register[CS]]",
  "[all[memes]edge:control[implements]]",
  "[tag[lar:///ha.ka.ba/api/v0.1/pono/invariant]]",
]

# CompiledCascadeEntry — post-compileCascade form
[compiled-cascade-entry]
fields = [
  "matchingUris: Set<string> | null   # null = use match predicate at apply time",
  "entry: CascadeEntry",
]
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-corpus-sources ? -> lar:///ha.ka.ba/api/v0.1/lararium/schema/corpus-sources family:control role:depends >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
