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
description   = "sugar: live transclusion (dataflow family) + definition invocation; dispatch: lar:/// prefix → meme transclusion; plain name → wehe/helu lookup; [SC]"

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

# --- English alias sigils (\ prefix marks English namespace; same semantics as Hawaiian canonical) ---
# Parser maps alias → canonical before evaluation. No semantic difference.

[[sigils]]
name          = "\\procedure"
kind          = "pragma-alias"
layer         = "render"
alias_for     = "wehe"
open_pattern  = '<<~!\s*\\procedure\s+([\w-]+)(?:\(([^)]*)\))?\s*>>'
close_pattern = '<<~\/\\procedure\s*>>'
description   = "English alias for wehe; TW5 \\procedure equivalent; parser maps to wehe before evaluation"

[[sigils]]
name          = "\\function"
kind          = "pragma-alias"
layer         = "render"
alias_for     = "helu"
pattern       = '<<~!\s*\\function\s+([\w-]+)(?:\(([^)]*)\))?\s*=\s*([^\n>]+?)\s*>>'
description   = "English alias for helu; TW5 \\function equivalent; parser maps to helu before evaluation"

[[sigils]]
name          = "\\define"
kind          = "pragma-alias"
layer         = "render"
alias_for     = "wehe"
open_pattern  = '<<~!\s*\\define\s+([\w-]+)(?:\(([^)]*)\))?\s*>>'
close_pattern = '<<~\/\\define\s*>>'
description   = "English alias for wehe; TW5 \\define legacy form; parser maps to wehe before evaluation"

[[sigils]]
name          = "\\link"
kind          = "edge-alias"
layer         = "both"
alias_for     = "loulou"
pattern       = '<<~\s*\\link\s+(\S+)\s*>>'
description   = "English alias for loulou; HTML/TW5 anchor equivalent; parser maps to loulou before evaluation"

[[sigils]]
name          = "\\shadow"
kind          = "edge-alias"
layer         = "both"
alias_for     = "aka"
pattern       = '<<~\s*\\shadow\s+(\S+)\s*>>'
description   = "English alias for aka; TW5 shadow tiddler equivalent; parser maps to aka before evaluation"

[[sigils]]
name          = "\\if"
kind          = "conditional-alias"
layer         = "render"
alias_for     = "wai"
open_pattern  = '<<~\s*\\if\s+([^\n>]+?)\s*>>'
close_pattern = '<<~\/\\if\s*>>'
description   = "English alias for wai; parser maps to wai before evaluation"

[[sigils]]
name          = "\\else"
kind          = "conditional-alias"
layer         = "render"
alias_for     = "mukuwai"
pattern       = '<<~\s*\\else\s*>>'
description   = "English alias for mukuwai; parser maps to mukuwai before evaluation"

[[sigils]]
name          = "\\elif"
kind          = "conditional-alias"
layer         = "render"
alias_for     = "kahawai"
pattern       = '<<~\s*\\elif\s+([^\n>]+?)\s*>>'
description   = "English alias for kahawai; parser maps to kahawai before evaluation"

[[sigils]]
name          = "\\for"
kind          = "iteration-alias"
layer         = "render"
alias_for     = "huli"
open_pattern  = '<<~\s*\\for\s+([^\n>]+?)\s+as\s+([\w-]+)\s*>>'
close_pattern = '<<~\/\\for\s*>>'
description   = "English alias for huli; for-each iteration; parser maps to huli before evaluation"

[[sigils]]
name          = "\\sync"
kind          = "concurrency-alias"
layer         = "render"
alias_for     = "hui"
open_pattern  = '<<~\s*\\sync\s*>>'
close_pattern = '<<~\/\\sync\s*>>'
description   = "English alias for hui; Verse sync keyword; parser maps to hui before evaluation"

[[sigils]]
name          = "\\race"
kind          = "concurrency-alias"
layer         = "render"
alias_for     = "heihei"
open_pattern  = '<<~\s*\\race\s*>>'
close_pattern = '<<~\/\\race\s*>>'
description   = "English alias for heihei; Verse race keyword; parser maps to heihei before evaluation"

[[sigils]]
name          = "\\rush"
kind          = "concurrency-alias"
layer         = "render"
alias_for     = "puka"
open_pattern  = '<<~\s*\\rush\s*>>'
close_pattern = '<<~\/\\rush\s*>>'
description   = "English alias for puka; Verse rush keyword; parser maps to puka before evaluation"

[[sigils]]
name          = "\\branch"
kind          = "concurrency-alias"
layer         = "both"
alias_for     = "lele"
pattern       = '<<~\s*\\branch\s+(\S+)\s*>>'
description   = "English alias for lele; Verse branch keyword; parser maps to lele before evaluation"

[[sigils]]
name          = "\\tiddler"
kind          = "context-alias"
layer         = "render"
alias_for     = "meme"
open_pattern  = '<<~\s*\\tiddler\s+(\S+)\s*>>'
close_pattern = '<<~\/\\tiddler\s*>>'
description   = "English alias for meme; TW5 <$tiddler> equivalent; parser maps to meme before evaluation"

[[sigils]]
name          = "\\transclude"
kind          = "edge-alias"
layer         = "both"
alias_for     = "kahea"
pattern       = '<<~\s*\\transclude\s+(\S+)(?:\s+key:([\w-]+))?\s*>>'
description   = "English alias for kahea; TW5 transclusion equivalent; parser maps to kahea before evaluation"

# --- Concurrency sigils ---

[[sigils]]
name          = "hui"
kind          = "concurrency"
layer         = "render"
open_pattern  = '<<~\s*hui\s*>>'
close_pattern = '<<~\/hui\s*>>'
description   = "wait for all parallel flows; Verse sync equivalent; [SC]"

[[sigils]]
name          = "heihei"
kind          = "concurrency"
layer         = "render"
open_pattern  = '<<~\s*heihei\s*>>'
close_pattern = '<<~\/heihei\s*>>'
description   = "first-to-finish wins, rest continue; Verse race equivalent; [SC]"

[[sigils]]
name          = "puka"
kind          = "concurrency"
layer         = "render"
open_pattern  = '<<~\s*puka\s*>>'
close_pattern = '<<~\/puka\s*>>'
description   = "first-to-finish wins, rest cancelled; Verse rush equivalent; [SC]"

[[sigils]]
name           = "lele"
kind           = "concurrency"
layer          = "both"
pattern        = '<<~\s*lele\s+(\S+)\s*>>'
default_family = "message"
description    = "fire and forget dispatch; Verse branch equivalent; compile: pranala family:message; [SC]"

# --- Render-time edge sugar ---

[[sigils]]
name          = "\\guard"
kind          = "edge-alias"
layer         = "compile"
alias_for     = "kapu"
pattern       = '<<~\s*\\guard\s+([^\n>]*)\s*>>'
description   = "English alias for kapu; provisional; parser maps to kapu before evaluation"

[[sigils]]
name          = "\\task"
kind          = "guest-grammar-alias"
layer         = "both"
alias_for     = "hana"
open_pattern  = '<<~\s*\\task\s+([^\n>]+?)\s*>>'
close_pattern = '<<~\/\\task\s*>>'
description   = "English alias for hana; bounded guest grammar / work block; parser maps to hana before evaluation"

[[sigils]]
name          = "\\query"
kind          = "query-alias"
layer         = "render"
alias_for     = "ui"
pattern       = '<<~\s*\\query\s+([^\n>]+?)\s*>>'
description   = "English alias for ui; query surface / filter result render; parser maps to ui before evaluation"

[[sigils]]
name          = "kapu"
kind          = "edge-sugar"
layer         = "compile"
pattern       = '<<~\s*kapu\s+([^\n>]*)\s*>>'
open_pattern  = '<<~\s*kapu\s+([^\n>]*)\s*>>'
close_pattern = '<<~\/kapu\s*>>'
description   = "qualification and boundary posture; marks confidence, restriction, or unresolved threshold; inline (no body) or block (wraps a region); [SC]"

[[sigils]]
name          = "hana"
kind          = "guest-grammar"
layer         = "both"
open_pattern  = '<<~\s*hana\s+([^\n>]+?)\s*>>'
close_pattern = '<<~\/hana\s*>>'
description   = "bounded guest grammar block; grammar-key selects the interpreter; [SC]"

[[sigils]]
name          = "ui"
kind          = "query"
layer         = "render"
pattern       = '<<~\s*ui\s+([^\n>]+?)\s*>>'
description   = "query surface; evaluates filter expression and renders result as meme list; [SC]"

# --- Context sigil ---

[[sigils]]
name          = "meme"
kind          = "context"
layer         = "render"
open_pattern  = '<<~\s*meme\s+(\S+)\s*>>'
close_pattern = '<<~\/meme\s*>>'
description   = "sets current meme as rendering context for block body; lexical scope; TW5 <$tiddler> equivalent; [SC]"

# --- Conditional sigils ---

[[sigils]]
name          = "wai"
kind          = "conditional"
layer         = "render"
open_pattern  = '<<~\s*wai\s+([^\n>]+?)\s*>>'
close_pattern = '<<~\/wai\s*>>'
description   = "conditional source; renders body when filter result non-empty; [C] operator-ratified"

[[sigils]]
name          = "mukuwai"
kind          = "conditional-else"
layer         = "render"
pattern       = '<<~\s*mukuwai\s*>>'
description   = "alternate outflow; fallback body in a wai block; [C] operator-ratified"

[[sigils]]
name          = "kahawai"
kind          = "conditional-branch"
layer         = "render"
pattern       = '<<~\s*kahawai\s+([^\n>]+?)\s*>>'
description   = "branch-channel; else-if form in a wai block; [C] operator-ratified"

# --- Iteration ---

[[sigils]]
name          = "huli"
kind          = "iteration"
layer         = "render"
open_pattern  = '<<~\s*huli\s+([^\n>]+?)\s+as\s+([\w-]+)\s*>>'
close_pattern = '<<~\/huli\s*>>'
description   = "iterative rendering over filter results; body renders once per yielded URI; [SC]"

# --- Definition sigils (<<~! pragma mode) ---

[[sigils]]
name          = "wehe"
kind          = "pragma"
layer         = "render"
open_pattern  = '<<~!\s*wehe\s+([\w-]+)(?:\(([^)]*)\))?\s*>>'
close_pattern = '<<~\/wehe\s*>>'
description   = "opens a named wikitext form with parameters; TW5 \\procedure equivalent; summoned via kahea; [SC]"

[[sigils]]
name          = "helu"
kind          = "pragma"
layer         = "render"
pattern       = '<<~!\s*helu\s+([\w-]+)(?:\(([^)]*)\))?\s*=\s*([^\n>]+?)\s*>>'
description   = "defines a named filter-expression function; yields URI list; TW5 \\function equivalent; summoned via kahea; [SC]"

[[sigils]]
name           = "pono"
kind           = "edge-sugar"
layer          = "compile"
pattern        = '<<~\s*pono\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+role:([\w-]+))?\s*>>'
default_family = "constraint"
description    = "constraint family edge sugar; inline-pranala-style (#slot? FROM -> TO role:R?); declares structural rule or invariant; no execution pulse; [SC]"

# --- Variable binding sigil ---

[[sigils]]
name          = "kau"
kind          = "pragma"
layer         = "both"
pragma_pattern = '<<~!\s*kau\s+([\w-]+)\s*=\s*([^\n>]+?)\s*>>'
open_pattern  = '<<~\s*kau\s+([\w-]+)\s*=\s*([^\n>]+?)\s*>>'
close_pattern = '<<~\/kau\s*>>'
description   = "variable binding; <<~! kau name = val >> = carrier-scoped (hoisted pragma); <<~ kau name = val >>...<<~/kau >> = block-scoped; ! carries scope elevation promise; [SC]"

# English aliases for kau
[[sigils]]
name          = "\\const"
kind          = "pragma-alias"
layer         = "both"
alias_for     = "kau"
pattern       = '<<~!\s*\\const\s+([\w-]+)\s*=\s*([^\n>]+?)\s*>>'
description   = "English alias for kau pragma form (carrier-scoped immutable binding); parser maps to kau before evaluation"

[[sigils]]
name          = "\\let"
kind          = "pragma-alias"
layer         = "both"
alias_for     = "kau"
open_pattern  = '<<~\s*\\let\s+([\w-]+)\s*=\s*([^\n>]+?)\s*>>'
close_pattern = '<<~\/\\let\s*>>'
description   = "English alias for kau block form (block-scoped binding); parser maps to kau before evaluation"

[[sigils]]
name          = "\\var"
kind          = "pragma-alias"
layer         = "both"
alias_for     = "kau"
open_pattern  = '<<~\s*\\var\s+([\w-]+)\s*=\s*([^\n>]+?)\s*>>'
close_pattern = '<<~\/\\var\s*>>'
description   = "English alias for kau block form (mutable variant); parser maps to kau before evaluation"

# --- Element type definition sigil ---

[[sigils]]
name          = "kumu"
kind          = "pragma"
layer         = "both"
open_pattern  = '<<~!\s*kumu\s+([\w-]+)(?:\(([^)]*)\))?\s*>>'
close_pattern = '<<~\/kumu\s*>>'
description   = "element type definition; declares a new grammar node type (not a text template — that is wehe); self-hosting primitive; TW5 \\widget equivalent; [SC]"

# English aliases for kumu
[[sigils]]
name          = "\\widget"
kind          = "pragma-alias"
layer         = "both"
alias_for     = "kumu"
open_pattern  = '<<~!\s*\\widget\s+([\w-]+)(?:\(([^)]*)\))?\s*>>'
close_pattern = '<<~\/\\widget\s*>>'
description   = "English alias for kumu; TW5 \\widget equivalent; parser maps to kumu before evaluation"

[[sigils]]
name          = "\\type"
kind          = "pragma-alias"
layer         = "both"
alias_for     = "kumu"
open_pattern  = '<<~!\s*\\type\s+([\w-]+)(?:\(([^)]*)\))?\s*>>'
close_pattern = '<<~\/\\type\s*>>'
description   = "English alias for kumu (structural declaration emphasis); parser maps to kumu before evaluation"

[[sigils]]
name          = "\\typos"
kind          = "pragma-alias"
layer         = "both"
alias_for     = "kumu"
open_pattern  = '<<~!\s*\\typos\s+([\w-]+)(?:\(([^)]*)\))?\s*>>'
close_pattern = '<<~\/\\typos\s*>>'
description   = "English alias for kumu (Greek: typos = impression/type); parser maps to kumu before evaluation"

# --- Additional edge/invocation aliases ---

[[sigils]]
name          = "\\import"
kind          = "edge-alias"
layer         = "both"
alias_for     = "kahea"
pattern       = '<<~\s*\\import\s+(\S+)(?:\s+key:([\w-]+))?\s*>>'
description   = "English alias for kahea (import emphasis); parser maps to kahea before evaluation"

[[sigils]]
name          = "\\constraint"
kind          = "edge-alias"
layer         = "compile"
alias_for     = "pono"
pattern       = '<<~\s*\\constraint\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+role:([\w-]+))?\s*>>'
description   = "English alias for pono; declarative structural constraint; parser maps to pono before evaluation"

# --- Reaction family sugar sigil (TALK STORY: name TBD — candidate: ala) ---

[[sigils]]
name           = "papalohe"
kind           = "edge-sugar"
layer          = "both"
pattern        = '<<~\s*papalohe\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+trigger:([\w-]+))?\s*>>'
default_family = "reaction"
description    = "reaction family edge sugar; Lua: pāpālohe — warrior body-listening reflex, fires only when source activates it; UEFN device graph event wire; trigger property carries event name; compile: pranala family:reaction; [SC]"
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
description         = "data-carrying edge; routes root-downward (push-forward to owned subtree); sugar: kahea (live transclusion + definition invocation)"

[[families]]
name                = "message"
dag_required        = false
role_required       = false
role_recommended    = true
confidence_bounded  = false
description         = "routed event or signal passage; routes leaf-upward toward control root; no structural ownership stake; sugar: pending"

[[families]]
name                = "constraint"
dag_required        = false
role_required       = false
role_recommended    = false
confidence_bounded  = false
description         = "declarative rule without execution pulse; spatial, logical, or physical boundary; sugar: pono"

[[families]]
name                = "reaction"
dag_required        = false
role_required       = false
role_recommended    = true    # trigger property recommended; warning if absent
confidence_bounded  = false
description         = "triggered response subscription; pāpālohe — body-listening reflex; 'when source fires event, target awakens'; UEFN device graph event wire; carries trigger property naming the activating event; sugar: papalohe"
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

<<~ ahu #guest-grammars >>

## Registered Guest Grammars

```toml
[[guest_grammars]]
key         = "x-tiddlywiki-filter"
uri         = "lar:///ha.ka.ba/api/v0.1/grammars/x-tiddlywiki-filter"
status      = "legacy/import"
description = "TW5 filter dialect; deprecated for new authoring; use wikitext-filter"

[[guest_grammars]]
key         = "wikitext-filter"
uri         = "lar:///grammars/wikitext-filter"
status      = "active"
description = "native lararium filter dialect; drops !!field/##index; uses toml:/edge:/self[] operators; [SC]"
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
