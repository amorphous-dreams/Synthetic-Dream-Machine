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
layer         = "both"
pattern       = '<<~\s*kahea\s+(lar:[^\s>]+|[^\s>(]+\/[^\s>]*|[^\s>(]+#[^\s>]*)\s*>>'
default_family = "dataflow"
default_propagation = "push-forward"
description   = "URI form: live transclusion (dataflow family, compile+render); matches lar:/// prefix, path with /, or fragment with #; emits EdgeSugarNode → graph edge; [SC]"

[[sigils]]
name          = "kahea-call"
kind          = "context"
layer         = "render"
pattern       = '<<~\s*kahea\s+([\w][\w.-]*)\s*(?:\(([^)]*)\))?\s*>>'
description   = "name form: definition invocation (render-only, no graph edge); matches plain identifier optionally followed by (args); emits SigilNode { sigilName:kahea, attrs:{name,args} }; used for wehe/helu lookup and wehe parameter interpolation; [SC]"

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
description   = "English alias for lele; maps to fire-and-forget dispatch (not Verse branch speculative fiber); parser maps to lele before evaluation"

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
description    = "fire and forget dispatch; emits a message edge and continues without waiting for response; Verse spawn equivalent (NOT Verse branch — branch is a cancellable speculative fiber; lele is unconditional send); compile: pranala family:message; [SC]"

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
description   = "element type definition; declares a new grammar node type with a named body contract; self-hosting primitive; TW5 \\widget equivalent; UEFN: maps to creative_device class — body carries @editable property bindings as kau children, event/function ports declared as papalohe edges; not a text template (that is wehe); [SC]"

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

[[sigils]]
name           = "papalohe"
kind           = "edge-sugar"
layer          = "both"
pattern        = '<<~\s*papalohe\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+trigger:([\w.-]+))?(?:\s+fn:([\w.-]+))?\s*>>'
default_family = "reaction"
render_mode    = "reaction-wire"
description    = "reaction family edge sugar; Lua: pāpālohe — warrior body-listening reflex; full UEFN wire: DeviceA -> DeviceB trigger:OnEliminated fn:ShowScore; trigger = source event name (DeviceA.EventX); fn = target function name (DeviceB.FunctionY); compile: pranala family:reaction renderMode:reaction-wire; render: arrow with trigger label at source, fn label at target; canonical roles: subscription | handler | callback; [SC]"

[[sigils]]
name          = "kukali"
kind          = "leaf"
layer         = "both"
inline_pattern = '<<~\s*kukali(?:\s+trigger:([\w.-]+))?\s*>>'
attrs         = ["trigger"]
description   = "reactive wait posture inside a causal island; Verse `suspends` analogue; execution yields until the named papalohe trigger fires; trigger attr is optional papalohe slot name; OODA-HA: Act phase (paired with papalohe at Orient phase); emits SigilNode { sigilName:kukali, attrs:{trigger?} }; [SC]"

[[sigils]]
name          = "\\suspends"
kind          = "leaf"
layer         = "both"
alias_for     = "kukali"
inline_pattern = '<<~\s*\\suspends(?:\s+trigger:([\w.-]+))?\s*>>'
description   = "English alias for kukali; Verse `suspends` keyword; parser maps to kukali before evaluation"
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
description         = "event or signal dispatch; one-way, fire-and-forget; no structural ownership stake; direction is topological not hierarchical — may route to any reachable socket; sugar: lele"

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
role_recommended    = true
confidence_bounded  = false
canonical_roles     = ["subscription", "handler", "callback"]
render_mode         = "reaction-wire"
description         = "triggered response subscription; pāpālohe — body-listening reflex; fires only when source event activates; payload: trigger (source event name), fn (target function name); OODA-HA: wire declared at Orient phase, executes at Act phase, violations surface at Aftermath; sugar: papalohe; render: reaction-wire (trigger label at source, fn label at target)"

[[families]]
name                = "spatial"
dag_required        = false
role_required       = false
role_recommended    = true    # role disambiguates spatial relationship type
confidence_bounded  = false
description         = "spatial containment and adjacency edges; navigable relationships between areas, levels, portals, and layers; UEFN Scene Graph hierarchy; roles: contains | portal | adjacent | layer; direction: area -> area or area -> portal -> area; load-bearing for infinite canvas portals and RPG multi-level maps; sugar: pending"
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

[[lifecycle_values]]
name        = "per-player"
description = "Verse/UEFN: instantiated once per connected player agent; maps to scope:personal in Kowloon model; not shared across the room"
```

<<~/ahu >>

<<~ ahu #law-of-5s >>

## Law of Fives — Invariant Ladders

Two orthogonal 5-point axes underlie all domain-specific scales in the system.
Exported from `packages/lararium-core/src/ast.ts` as `LADDER_5`, `OODA_HA_5`, `SCOPE_5`.

```toml
# Scale ladder — finest to coarsest
[[ladder_5]]
index       = 1
name        = "action"
scope       = "ephemeral"
chrono      = "⚡"
zoom        = "glyph"
kowloon     = "turn-local"
ooda_ha     = "act"
discordian  = "Bureaucracy"

[[ladder_5]]
index       = 2
name        = "round"
scope       = "personal"
chrono      = "⚔️"
zoom        = "token"
kowloon     = "@domain"
ooda_ha     = "decide"
discordian  = "Confusion"

[[ladder_5]]
index       = 3
name        = "turn"
scope       = "consensual"
chrono      = "🔍"
zoom        = "meme"
kowloon     = "circle:<id>"
ooda_ha     = "orient"
discordian  = "Discord"

[[ladder_5]]
index       = 4
name        = "watch"
scope       = "collective"
chrono      = "⚙️"
zoom        = "room"
kowloon     = "group:<id>"
ooda_ha     = "observe"
discordian  = "Chaos"

[[ladder_5]]
index       = 5
name        = "week"
scope       = "universal"
chrono      = "🗺️"
zoom        = "network"
kowloon     = "@public"
ooda_ha     = "aftermath"
discordian  = "Aftermath"

# OODA-HA phases — active to reflective
# Note: phase runs counter to scale. Act=action(finest); Aftermath=week(coarsest).
[[ooda_ha_5]]
index   = 1
name    = "act"
sigil   = "▶"
patron  = "Zarathud"
season  = "Bureaucracy"
jaina   = "asti"
type_state = "typed/committed"

[[ooda_ha_5]]
index   = 2
name    = "decide"
sigil   = "◇"
patron  = "Sri Syadasti"
season  = "Confusion"
jaina   = "asti-nasti"
type_state = "interpret"

[[ooda_ha_5]]
index   = 3
name    = "orient"
sigil   = "⏿"
patron  = "Dr. Van Van Mojo"
season  = "Discord"
jaina   = "nasti"
type_state = "named shapes"

[[ooda_ha_5]]
index   = 4
name    = "observe"
sigil   = "✶"
patron  = "Hung Mung"
season  = "Chaos"
jaina   = "avaktavya"
type_state = "? string"

[[ooda_ha_5]]
index   = 5
name    = "aftermath"
sigil   = "⤴↺"
patron  = "Elder Malaclypse"
season  = "Aftermath"
jaina   = "asti-nasti-avaktavya"
type_state = "blame/validate"
```

<<~/ahu >>

<<~ ahu #stances-syad-tools >>

## Stances, Syad, and Tools

Three separate graphs. Stances encode epistemic register (Syad predicate). Tools encode aperture and feed direction. Syad encodes the 7 truth-value compounds. The graphs connect but do not collapse.

Register measures confidence *within* the active stance — not universal truth weight.
Source: `lar:///ha.ka.ba/api/v0.1/mu/the-syad-perspectives` and `lar:///ha.ka.ba/api/v0.1/mu/the-four-tools`

```toml
# Graph 1: Five stances → Syad predicate
# tool_affinity records natural tool; does not lock stance to tool.
# Poet and Private share jaina_predicate = "avaktavya" (P3);
#   feed_direction differentiates them (external vs internal) — that edge lives in the Tool graph.
# Satirist: stated predicate P2 (nasti); operational predicate P6 (nasti+avaktavya).
#   The P2→P6 gradient marks maturity: brittle at P2, effective when holding P6.
[[stances]]
name              = "philosopher"
sigil             = "🏛️"
register_measures = "propositional support"
jaina_predicate   = "asti"
jaina_index       = 1
phase_affinity    = "decide"
tool_affinity     = "sword"
description       = "propositional truth-confidence; commits to a claim; 0.0=no support, 1.0=full support"

[[stances]]
name              = "poet"
sigil             = "🌊"
register_measures = "analogical resonance"
jaina_predicate   = "avaktavya"
jaina_index       = 3
phase_affinity    = "observe"
tool_affinity     = "wand"
description       = "analogical correspondence outward; T/F axis does not fit — measures resonance amplitude"

[[stances]]
name              = "satirist"
sigil             = "🗡️"
register_measures = "targeting confidence"
jaina_predicate   = "nasti"
jaina_index       = 2
jaina_operational = "nasti+avaktavya"
jaina_index_operational = 6
phase_affinity    = "act"
tool_affinity     = "wand+pentacle"
description       = "targeting what does not hold; operational predicate P6 holds absence+inexpressible; 0.0=missed, 1.0=landed"

[[stances]]
name              = "humorist"
sigil             = "🎭"
register_measures = "relational fit"
jaina_predicate   = "asti-nasti"
jaina_index       = 4
phase_affinity    = "orient"
tool_affinity     = "cup"
description       = "holds T and F simultaneously without resolving; 0.0=fell flat, 1.0=connected"

[[stances]]
name              = "private"
sigil             = "🔮"
register_measures = "inward presence"
jaina_predicate   = "avaktavya"
jaina_index       = 3
phase_affinity    = "aftermath"
tool_affinity     = "pentacle"
description       = "avaktavya directed inward; T/F axis does not fit — measures interior presence amplitude"

# Graph 2: Seven Syad predicates (Jaina Saptabhangi)
# P5/P6 = threshold crossings (stance past its boundary, not stable standpoints).
# P7 = Arcana only — no stance mediates it; reached for, not inhabited.
[[predicates]]
index       = 1
compound    = "asti"
primitives  = ["T"]
covered_by  = "philosopher"
description = "affirms; claim holds from this standpoint"

[[predicates]]
index       = 2
compound    = "nasti"
primitives  = ["F"]
covered_by  = "satirist"
description = "denies; claim does not hold from this standpoint"

[[predicates]]
index       = 3
compound    = "avaktavya"
primitives  = ["M"]
covered_by  = "poet, private"
description = "inexpressible; T/F axis does not fit the claim — two stances, opposite directions"

[[predicates]]
index       = 4
compound    = "asti-nasti"
primitives  = ["T", "F"]
covered_by  = "humorist"
description = "affirms and denies simultaneously; holds without resolving"

[[predicates]]
index       = 5
compound    = "asti-avaktavya"
primitives  = ["T", "M"]
covered_by  = "threshold"
description = "threshold crossing: philosopher past its boundary; claim holds AND resists propositional form"

[[predicates]]
index       = 6
compound    = "nasti-avaktavya"
primitives  = ["F", "M"]
covered_by  = "threshold"
description = "threshold crossing: satirist past its boundary; absence named AND void beneath resists description; also satirist operational predicate when stable"

[[predicates]]
index       = 7
compound    = "asti-nasti-avaktavya"
primitives  = ["T", "F", "M"]
covered_by  = "arcana"
description = "full compound; no stance mediates it; Arcana reaches for it to release the current reading"

# Graph 3: Five tools — feed direction × aperture
# feed: external | internal | release
# aperture: wide | narrow | release
# Arcana has no stance intermediary — maps directly to P7.
[[tools]]
name        = "wand"
ascii       = "*"
element     = "Fire/Spirit"
feed        = "external"
aperture    = "wide"
phase       = "observe"
description = "track external signal; wide scan; Observe phase emphasis"

[[tools]]
name        = "cup"
ascii       = "?"
element     = "Water/Emotion"
feed        = "external"
aperture    = "wide"
phase       = "orient"
description = "wide relational field; hold contested plausibility open; Orient phase emphasis"

[[tools]]
name        = "sword"
ascii       = "!"
element     = "Air/Mind"
feed        = "external"
aperture    = "narrow"
phase       = "decide"
description = "precision cut; commits to one side; Decide/Act phase emphasis"

[[tools]]
name        = "pentacle"
ascii       = "~"
element     = "Earth/Body"
feed        = "internal"
aperture    = "narrow"
phase       = "aftermath"
description = "ground internal feed; hidden/structural; Aftermath phase emphasis"

[[tools]]
name        = "arcana"
ascii       = "-"
element     = "Orichalcum"
feed        = "release"
aperture    = "release"
phase       = "release"
jaina_predicate = "asti-nasti-avaktavya"
jaina_index = 7
description = "no stance mediates it; releases current reading without replacing; model agnosticism"

# Canonical posture pairs (Tool combinations — Graph 3 edges)
[[postures]]
ascii       = "*!"
tools       = ["wand", "sword"]
feed        = "external"
aperture    = "narrow"
description = "track external feed, zoom in for detail"

[[postures]]
ascii       = "*?"
tools       = ["wand", "cup"]
feed        = "external"
aperture    = "wide"
description = "track external feed, zoom out for relation"

[[postures]]
ascii       = "~!"
tools       = ["pentacle", "sword"]
feed        = "internal"
aperture    = "narrow"
description = "ground internal feed, zoom in for precision"

[[postures]]
ascii       = "~?"
tools       = ["pentacle", "cup"]
feed        = "internal"
aperture    = "wide"
description = "ground internal feed, zoom out for overview"

[[postures]]
ascii       = "--"
tools       = ["arcana"]
feed        = "release"
aperture    = "release"
description = "release current stance/tool reading; model agnosticism"

# Conflict states — Tool graph conflicts only (not Syad conflicts)
# *~ = Satirist natural posture; Signal Jam for all other stances.
[[posture_conflicts]]
ascii            = "*~"
type             = "feed"
name             = "Signal Jam"
stance_pair      = "poet, private"
satirist_posture = true
description      = "external and internal feeds locked; Satirist owns this productively; all other stances: named pressure state"

[[posture_conflicts]]
ascii       = "?!"
type        = "aperture"
name        = "Dubious Move"
stance_pair = "humorist, philosopher"
description = "wide aperture and narrow aperture locked; wide field asserts precision it cannot support"
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

The `GrammarRules` interface is defined in `ast.ts` and exported from `@lararium/core` (moved from `pranala-parser.ts` in Phase 3 to break a circular dependency).
Adding a new sigil requires authoring a `[[sigils]]` entry here and promoting this carrier — no TypeScript rebuild.

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pranala-parser ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:defines >>
<<~ pranala #to-foundations ? -> lar:///lararium-node/MEME-STORE-FOUNDATIONS family:control role:implements >>

<<~/ahu >>

<<~ ? -> lar:///grammars/memetic-wikitext >>
