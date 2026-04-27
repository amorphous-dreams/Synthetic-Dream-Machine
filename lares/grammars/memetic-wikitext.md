<<~ ? -> lar:///grammars/memetic-wikitext >>

<<~ ahu #iam >>

```toml
uri-path     = "grammars/memetic-wikitext"
file-path    = "lares/grammars/memetic-wikitext.md"
content-type = "text/x-memetic-wikitext"
tagspace     = "grammar"
confidence   = 0.92
register     = "CS"
mana         = 0.88
manao        = 0.85
role         = "grammar kernel: sigil registry and parse rules for memetic-wikitext surface form"
cacheable    = true
retain       = true
```

<<~/ahu >>

<<~ ahu #meme-body-open >>
Grammar kernel opens here. All sigil patterns authoritative.
<<~/ahu >>

<<~ ahu #sigil-registry >>

## Sigil Registry

Each entry names a sigil, its surface form, and its semantic role.
The TypeScript parser reads this registry in Phase 2; until then it serves as authoritative documentation.

```toml
# Sigil registry — used by pranala-parser.ts Phase 2 rule-interpreter
# Each sigil maps name → surface-form patterns and semantic defaults

[[sigils]]
name         = "ahu"
kind         = "worksite"
open_pattern = '<<~[^>]*\bahu\s+(#[\w-]+)\s*>>'
close_pattern = '<<~\/ahu\s*>>'
description  = "worksite scope boundary; creates an addressable ahu socket"

[[sigils]]
name         = "pranala"
kind         = "edge"
block_pattern  = '<<~\s*pranala\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)\s*>>([\s\S]*?)<<~\/pranala\s*>>'
inline_pattern = '<<~\s*pranala\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+family:([\w-]+))?(?:\s+role:([\w-]+))?\s*>>'
default_family = "relation"
description    = "explicit edge sigil; declares a pranala with optional block body or inline attrs"

[[sigils]]
name          = "loulou"
kind          = "edge-sugar"
pattern       = '<<~\s*loulou\s+(\S+)\s*>>'
default_family = "relation"
description   = "sugar: bidirectional relation edge; equivalent to pranala with family=relation"

[[sigils]]
name          = "aka"
kind          = "edge-sugar"
pattern       = '<<~\s*aka\s+(\S+)\s*>>'
default_family = "observe"
description   = "sugar: shadow transclusion (observe family); read-only embed; equivalent to pranala family=observe"

[[sigils]]
name          = "kahea"
kind          = "edge-sugar"
pattern       = '<<~\s*kahea\s+(\S+)\s*>>'
default_family = "dataflow"
default_propagation = "push-forward"
description   = "sugar: live transclusion (dataflow family); push-forward propagation; equivalent to pranala family=dataflow"

[[sigils]]
name         = "iam"
kind         = "metadata"
pattern      = '<<~\s*ahu\s+#iam\s*>>([\s\S]*?)<<~\/ahu\s*>>'
description  = "carrier identity block; contains TOML metadata. Always the first ahu in a carrier."

[[sigils]]
name         = "pranala-header"
kind         = "header"
pattern      = '<<~\s*\?\s*->\s*(\S+)\s*>>'
description  = "carrier header edge — points from ? (this carrier) to its canonical URI"
```

<<~/ahu >>

<<~ ahu #family-contracts >>

## Pranala Family Contracts

Each family carries an invariant property schema.
The TypeScript validator (`validatePranaEdge`) enforces these contracts at compile time.
In Phase 2 this table replaces the hard-coded `FAMILY_CONTRACTS` map in `pranala-parser.ts`.

```toml
# Family contract definitions — enforced by validatePranaEdge()

[[families]]
name                = "control"
dag_required        = true
role_required       = false   # warning if absent, not error (sugar forms omit role)
role_recommended    = true
confidence_bounded  = false
description         = "ownership/routing edges; must form a DAG across the lares/ tree; no transclusion semantics"

[[families]]
name                = "relation"
dag_required        = false
role_required       = false
role_recommended    = false
confidence_bounded  = false
description         = "semantic relation between memes; directional or bidirectional"

[[families]]
name                = "observe"
dag_required        = false
role_required       = false
role_recommended    = false
confidence_bounded  = true    # confidence ∈ [0, 1] if set
description         = "observational/evidential link; confidence weight optional"

[[families]]
name                = "dataflow"
dag_required        = false
role_required       = false
role_recommended    = true    # warning if absent
confidence_bounded  = false
description         = "data-carrying edge; propagation direction matters; sugar: kahea (live transclusion)"

[[families]]
name                = "message"
dag_required        = false
role_required       = false
role_recommended    = true
confidence_bounded  = false
description         = "routed event or signal passage; no structural ownership stake; sugar: pending"

[[families]]
name                = "constraint"
dag_required        = false
role_required       = false
role_recommended    = false
confidence_bounded  = false
description         = "declarative rule without execution pulse; spatial, logical, or physical boundary; sugar: pending"
```

<<~/ahu >>

<<~ ahu #lifecycle-values >>

## Lifecycle Values

Pranala edges carry a `lifecycle` field that scopes their validity.

```toml
[[lifecycle_values]]
name        = "instance"
description = "default; exists for the duration of the carrier's active session"

[[lifecycle_values]]
name        = "permanent"
description = "persists across sessions and boot cycles"

[[lifecycle_values]]
name        = "ephemeral"
description = "exists only for a single render pass or computation"

[[lifecycle_values]]
name        = "boot"
description = "valid only during the boot compilation phase"
```

<<~/ahu >>

<<~ ahu #phase-2-wiring-note >>

## Phase 2 Wiring Note

The TypeScript parser at `packages/lararium-core/src/pranala-parser.ts` currently hard-codes all sigil patterns and family contracts. Phase 2 replaces this with a rule-interpreter pattern:

1. `node-host.ts` reads this carrier via `readFileSync` before calling `buildControlClosure`
2. Extracts `[[sigils]]` and `[[families]]` TOML arrays into a `GrammarRules` object
3. Passes `GrammarRules` as an optional second argument to `parsePranalaEdges`
4. Parser uses rule-provided patterns when present, falls back to built-ins for bootstrap safety

The `GrammarRules` interface is defined in `pranala-parser.ts` and exported from `@lararium/core`.
Adding a new sigil requires authoring a `[[sigils]]` entry here and promoting this carrier — no TypeScript rebuild.

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pranala-parser ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:defines >>
<<~ pranala #to-foundations ? -> lar:///lararium-node/MEME-STORE-FOUNDATIONS family:control role:implements >>

<<~/ahu >>

<<~ ? -> lar:///grammars/memetic-wikitext >>
