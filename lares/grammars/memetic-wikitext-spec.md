<<~ ? -> lar:///grammars/memetic-wikitext-spec >>

<<~ ahu #iam >>
```toml
uri-path     = "grammars/memetic-wikitext-spec"
file-path    = "lares/grammars/memetic-wikitext-spec.md"
content-type = "text/x-memetic-wikitext"
tagspace     = "grammar"
confidence   = 0.90
register     = "CS"
mana         = 0.90
manao        = 0.88
role         = "holistic grammar specification — outer delimiter system, full sigil registry, TW5 parity map, dual-layer model, six families, recursion guard, gaps and tensions"
cacheable    = true
retain       = true
invariant    = false
```
<<~/ahu >>

<<~ ahu #meme-body-open >>
MEMETIC-WIKITEXT-SPEC opens.
<<~/ahu >>

<<~ ahu #ooda-ha >>
✶ read pranala invariant law first — `aka` is shadow transclusion, `kahea` is live transclusion; the six families carry this.
⏿ orient around the dual-layer model: every sigil carries both compile-time graph structure AND render-time semantics; these are not separate.
◇ design the missing sigils (definition, conditional, iteration, context-focus) — these close the TW5 parity gap that the edge primitives cannot cover.
▶ write the holistic spec: outer-delimiter dispatch, full sigil + family registry, dual-layer model, recursion guard, tensions table.
⤴ verify every TW5 concept has a named Lararium equivalent or an explicit deferral with rationale.
↺ name conflicts precisely; a gap left implicit will silently corrupt authoring practice.
<<~/ahu >>

<<~ ahu #purpose >>

# Memetic-Wikitext Grammar Specification

This carrier is the holistic grammar spec for `text/x-memetic-wikitext`.

**Not** the grammar kernel (`lar:///grammars/memetic-wikitext` holds the live TOML registry).
**Not** the invariant law (`lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext` holds the root).
**Not** the pranala edge law (`lar:///ha.ka.ba/api/v0.1/pono/pranala` holds the edge contract).

This carrier holds: the full design space, the outer-delimiter dispatch table, the complete sigil
inventory against TW5, and the explicit gaps and tensions that authors and parsers must navigate.

TiddlyWiki5 is the **~0.95 confidence core model**. Where a TW5 construct has no Lararium equivalent,
the gap is named and either a new sigil is proposed or deferral is stated with rationale.

**Key correction vs. naive TW5 mapping:** `aka` and `kahea` are NOT purely compile-time graph edges.
The pranala invariant law defines them as bearing transclusion pressure:
- `aka` = shadow transclusion (`family:observe`)
- `kahea` = live transclusion (`family:dataflow`)
Every edge sigil carries BOTH a compile-time graph record AND a render-time semantic directive.
The missing TW5 features are definition, context-focus, and conditional/iteration — not transclusion.

<<~/ahu >>

<<~ ahu #outer-delimiter-system >>

## Outer Delimiter System

The `<<` `>>` angle-bracket pair is the outer delimiter family for all active sigils.

### Dispatch table

| Prefix | Mode | Examples |
|--------|------|---------|
| `<<~` | Lararium sharktooth — primary sigil mode | `<<~ ahu #id >>`, `<<~ aka lar:///uri >>` |
| `<<~/` | Sharktooth close — ends a block sigil | `<<~/ahu >>`, `<<~/define >>` |
| `<<~!` | Pragma mode — definition sigils (`\define` / `\procedure` / `\function` equivalents) | `<<~! define name(params) >>` |
| `<<~?` | Unresolved-pressure mode | `<<~? #fragment >>` (open question worksite) |
| `<<~&#x0001;` | Document header control character | file-level header edge |
| `<<~&#x0004;` | Document footer control character | file-level footer edge |
| `<<` *(bare)* | **Reserved.** Not currently valid Lararium syntax. TW5 macro-call compat deferred. | — |

### The sharktooth mark

`~` is the sharktooth. It marks the Lararium sigil namespace inside the `<<` family.
All Lararium-authored content uses `<<~`. Bare `<<name>>` is not valid syntax today.

### Block vs. inline sigils

- **Inline** (self-closing): `<<~ loulou lar:///uri >>`
- **Block** (with close): `<<~ ahu #id >>` ... `<<~/ahu >>`
- **Pragma block** (`<<~!` mode, with close): `<<~! define name >>` ... `<<~/define >>`

### Fragment notation

`#fragment-id` after a sigil name creates an addressable anchor. Ahu blocks always carry one.
Edge sigils carrying a `#fragment` name the outgoing slot on the enclosing ahu.

<<~/ahu >>

<<~ ahu #dual-layer-model >>

## Dual-Layer Model — The Central Architecture

Every sigil in memetic-wikitext operates on **both layers simultaneously**.
This is the correct model. "Compile-time graph structure" and "render-time semantics" are not
separate layers with separate sigil sets — they are two readings of the same surface.

```
┌──────────────────────────────────────────────────────────────────────┐
│ COMPILE-TIME READING  (graph, boot closure, index)                   │
│                                                                      │
│  Every sigil produces graph artifacts:                               │
│  ahu → worksite node / fragment anchor                               │
│  pranala/loulou/aka/kahea → PranaEdge records                        │
│  iam → carrier metadata                                              │
│  ? -> → DAG socket edge                                              │
│                                                                      │
│  Output: MemeGraph, BootArtifact, boot receipt                       │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ same sigils, second reading
┌────────────────────────────▼─────────────────────────────────────────┐
│ RENDER-TIME READING  (content projection, embedding, evaluation)     │
│                                                                      │
│  Edge sigils carry render directives:                                │
│  aka   → shadow transclusion: pull target content as shadow embed    │
│  kahea → live transclusion: embed target content inline              │
│  loulou → relation link: render as navigable reference              │
│  hana  → guest grammar execution block                               │
│  ui    → query: render filter result as meme list                   │
│                                                                      │
│  Definition sigils (pragma mode) add:                                │
│  define, function → named snippet / filter shorthand                 │
│  call  → invoke defined name                                         │
│  focus → context binding (<$tiddler> equivalent)                    │
│  if, for → conditional / iterative rendering                         │
│                                                                      │
│  Output: rendered views (canvas shapes, HTML, chat, etc.)            │
└──────────────────────────────────────────────────────────────────────┘
```

**The important rule:** `aka` and `kahea` carry transclusion pressure. They are not "just graph edges."
When a renderer encounters `<<~ kahea lar:///uri >>`, it SHOULD embed that meme's content inline
(live transclusion). When it encounters `<<~ aka lar:///uri >>`, it MAY pull in a shadow copy
(read-only, lower fidelity, like a TW5 shadow tiddler or footnote reference).

<<~/ahu >>

<<~ ahu #six-families >>

## Six Pranala Families

The pranala invariant (`lar:///ha.ka.ba/api/v0.1/pono/pranala`) defines six families.
The grammar meme currently only registers four. **`message` and `constraint` are missing.**

| Family | Sigil sugar | Render semantic | Compile semantic |
|--------|-------------|-----------------|------------------|
| `relation` | `loulou` | navigable link, no auto-embed | semantic / ontological edge |
| `control` | (none — explicit pranala only) | structural ownership | DAG must hold |
| `dataflow` | `kahea` | **live transclusion** | typed value / geometry transport |
| `observe` | `aka` | **shadow transclusion** | live inspection / reveal |
| `message` | (none yet) | event / notification routing | signal passage, no ownership |
| `constraint` | (none yet) | declarative rule rendering | constraint assertion, no exec pulse |

**Gap:** `message` and `constraint` have no sugar sigil form and are not in the grammar meme's
`[[families]]` TOML array. They must be added.

### Shadow vs. Live Transclusion

`aka` (shadow, observe family):
- Read-only embed of target content
- Shown at lower fidelity or as a locked/quoted section
- Target can be overridden locally without breaking the source
- TW5 analog: shadow tiddler reference; `$:/` core content rendered in a journal entry

`kahea` (live, dataflow family):
- Inline embed; target content rendered as-is at the call site
- Changes to target propagate live to all `kahea` sites
- Like TW5's `{{Title}}` inline transclusion
- Push-forward propagation: changes at source push forward to all `kahea` dependents

### Recursion guard applies to both

Both `aka` and `kahea` at render time add the target URI to the render stack.
The recursion guard model (see `#recursion-guard`) applies equally to both.

<<~/ahu >>

<<~ ahu #structural-sigils >>

## Structural Sigils

### `ahu` — worksite scope boundary

```
<<~ ahu #fragment-id >>
  ... body ...
<<~/ahu >>
```

Creates an addressable scope. All other sigils that carry a `#fragment` name the outgoing slot
on the enclosing ahu. `ahu #iam` is the special identity block — always the first ahu in a carrier.

### `iam` — carrier identity block

Special form of `ahu`. Contains TOML metadata. Must be first. Not repeated.

### Header / footer edge (`? ->`)

```
<<~&#x0001; ? -> lar:///canonical-uri >>   ← file header
<<~&#x0004; -> ?                        >>   ← file footer
```

Document-level DAG sockets. Required in well-formed carriers.

<<~/ahu >>

<<~ ahu #edge-sigils >>

## Edge Sigils — Graph + Render Dual-Layer

All edge sigils produce compile-time `PranaEdge` records AND carry render-time directives.

### `pranala` — full edge declaration

```
<<~ pranala #slot ? -> lar:///uri family:control role:implements >>
```

Full form. Use when sugar forms do not carry enough precision.
Six families available. Block form carries TOML payload.

### `loulou` — relation link (`family:relation`)

```
<<~ loulou lar:///uri >>
```

Outgoing semantic link. No auto-embed. Renders as a navigable reference.

### `aka` — shadow transclusion (`family:observe`)

```
<<~ aka lar:///uri >>
```

Shadow transclusion. Renderer pulls in target content as a read-only shadow embed.
TW5 analog: shadow tiddler inclusion; cited/quoted content; locked reference block.
**Not** a pure graph edge — carries transclusion pressure at render time.

### `kahea` — live transclusion (`family:dataflow`)

```
<<~ kahea lar:///uri >>
```

Live transclusion. Renderer embeds target content inline, push-forward propagation.
TW5 analog: `{{Title}}` inline transclusion.
**Not** a pure graph edge — carries live transclusion pressure at render time.

### `kapu` — qualification and boundary posture

```
<<~ kapu confidence:0.7 >>
<<~ kapu invocation -> bounded|? >>
```

Qualifies the current worksite: confidence, restriction, boundary, or unresolved posture.
`kapu` in Hawaiian marks what is bounded and what requires ceremony to cross.
Does not replace the act it qualifies — it marks the act's threshold.

### `message` and `constraint` sugars (proposed)

No sugar forms exist yet for `message` and `constraint` families.
Proposed:

```
<<~ pono #slot ? -> lar:///uri >>   ← constraint (pono = rightness / rule)
<<~ hau #slot ? -> lar:///uri >>    ← message (hau = gift / reciprocal signal)
```

These names are provisional. The families are fully defined in pranala invariant law
but lack sugar forms in the sigil registry.

<<~/ahu >>

<<~ ahu #definition-sigils >>

## Definition Sigils — Pragma Mode `<<~!` (Proposed, TW5 Parity)

These sigils define reusable named content. They live in `<<~!` pragma mode.
The boot compiler **ignores** `<<~!` blocks — they are render-time definitions only.
No compile-time graph artifact is produced.

### `define` — wikitext snippet (procedure/macro)

TW5 analogs: `\define`, `\procedure`

```
<<~! define greeting(name "World") >>
Hello, <<~ call name >>!
<<~/define >>
```

Named wikitext snippet with optional parameters (name + optional default).
Parameters substituted via `<<~ call param-name >>` inside the body — explicit, not text-substitution.
Body is memetic-wikitext; rendered when called via `<<~ call greeting(name:"Operator") >>`.

### `function` — filter expression shorthand

TW5 analog: `\function`

```
<<~! function taggedAs(tag) = [tag<tag>sort[title]] >>
```

Named filter expression fragment. Body is TW5 filter syntax (guest grammar `x-tiddlywiki-filter`).
Returns a URI list when evaluated. Called via `<<~ call taggedAs(tag:"invariant") >>`.

**Distinction from `define`:** `function` produces a list (URIs); `define` produces wikitext.

### `call` — invoke a defined name

```
<<~ call greeting(name:"Operator") >>
<<~ call taggedAs(tag:"invariant") >>
```

Invokes a `define` or `function`. If definition not found: emits a stub and logs a warning.
Arguments use `key:"value"` notation. Positional args follow parameter order.

### Scope model (open question)

`define` / `function` in a carrier are **carrier-local** by default.
A definition in an invariant meme (depth 0) MAY be treated as boot-closure-global.
Explicit cross-carrier scoping: `<<~ aka lar:///define-carrier >>` imports the carrier's definitions
(observe edge at compile time + shadow embed at render time makes definitions available).
This is unresolved — see `#open-questions`.

<<~/ahu >>

<<~ ahu #context-conditional-sigils >>

## Context and Conditional Sigils — Render-Time (Proposed, TW5 Parity)

### `focus` — rendering context setter

TW5 analog: `<$tiddler tiddler="Title">`

```
<<~ focus lar:///uri >>
  Content rendered with lar:///uri as the current meme context.
<<~/focus >>
```

Sets the implicit rendering context for the block body. Inside `<<~/focus >>`, references to
"the current meme" resolve to `uri`. Enables templates that take a meme as input without
hard-coding the URI inside the template.

### `if` — conditional rendering

TW5 analogs: `<$list filter="..." limit="1">`, `<$reveal>`

```
<<~ if [tag[lar:///ha.ka.ba/api/v0.1/pono/invariant]] >>
  Renders only when the current meme carries the invariant tag.
<<~/if >>

<<~ if [field:depth[0]] else >>
  Renders when depth is NOT 0.
<<~/if >>
```

Filter expression evaluated against the current rendering context.
Non-empty result: render body. Empty: skip (or render `else` body if present).
Filter syntax: TW5 guest grammar (`x-tiddlywiki-filter`).

### `for` — iteration over filter results

TW5 analog: `<$list filter="...">`

```
<<~ for [tag[invariant]sort[title]] as item >>
  <<~ kahea <<~ call item >> >>
<<~/for >>
```

Iterates over URIs returned by the filter. Loop variable bound to `item`.
Implicit recursion guard: same URI not yielded twice in one chain.

<<~/ahu >>

<<~ ahu #guest-grammar-sigils >>

## Guest Grammar Sigils

### `hana` — bounded guest grammar block

```
<<~ hana x-tiddlywiki-filter >>
[tag[invariant]sort[title]]
<<~/hana >>
```

Admits a foreign grammar into a bounded worksite. `grammar-key` identifies the interpreter.
Guest grammar MUST NOT redefine host primitives. Malformed guest work degrades locally.

Currently registered grammar keys: `x-tiddlywiki-filter` (TiddlyWiki5 filter notation).

`if`, `for`, and `ui` accept filter expressions inline as guest grammar arguments — shorthand
for a `hana x-tiddlywiki-filter` block used as a gate or iteration driver.

### `ui` — query surface

```
<<~ ui [tag[invariant]sort[title]] >>
```

Evaluates filter expression and renders result as a navigable meme list.
Shorthand: `hana x-tiddlywiki-filter` → evaluate → render as `loulou` list.
Rendering mode (links, card tiles, frame clusters) determined by the active renderer.

<<~/ahu >>

<<~ ahu #recursion-guard >>

## Recursion Guard Model

### Render stack

Every renderer maintains a **render stack** per chain. When `aka` or `kahea` is evaluated:

1. URI already on render stack → **recursion detected**
2. `len(render_stack) >= 8` (default limit) → **depth exceeded**
3. Either condition: emit recursion-break stub: `[⬡ ∞ lar:///uri]`
4. Otherwise: push URI, render, pop.

### Compile-time DAG ≠ render-time recursion

- **Compile-time:** `MemeGraph.detectCycles` guards the control DAG. Prevents circular boot closure.
- **Render-time:** render stack guard prevents infinite transclusion loops.
These are orthogonal. A cycle-free DAG can still have mutual `kahea` transclusion chains.
Both guards must be present.

### Graceful degradation contract

Recursion-break stubs MUST be:
- **Visible** (not silently empty)
- **Non-crashing** (renderer continues)
- **Traceable** (stub identifies the URI that triggered recursion)

<<~/ahu >>

<<~ ahu #tw5-parity-map >>

## TW5 → Lararium Parity Map

| TW5 construct | Syntax | Lararium analog | Status |
|---|---|---|---|
| Tiddler identity | title field | `ahu #iam` TOML + `lar:` URI | ✓ current |
| Tag | `tags: [[X]]` | `pranala family:control role:implements` | ✓ current |
| Link | `[[Title]]` | `<<~ loulou lar:///uri >>` | ✓ current |
| Shadow tiddler reference | (implicit) | `<<~ aka lar:///uri >>` (observe family) | ✓ current |
| Inline transclusion | `{{Title}}` | `<<~ kahea lar:///uri >>` (dataflow family) | ✓ current |
| Template transclusion | `{{Title\|\|Template}}` | `<<~ focus lar:///uri >>` + `<<~ kahea >>` | ◎ proposed |
| Section transclusion | `{{Title##section}}` | `<<~ kahea lar:///uri#section-id >>` | ◎ proposed (fragment form) |
| Macro/procedure definition | `\define name(p) body` | `<<~! define name(p) >> body <<~/define >>` | ◎ proposed |
| Function definition | `\function name(p) = expr` | `<<~! function name(p) = filter-expr >>` | ◎ proposed |
| Macro/procedure call | `<<macroName params>>` | `<<~ call name(key:val) >>` | ◎ proposed |
| Context-set | `<$tiddler tiddler="X">` | `<<~ focus lar:///X >>` ... `<<~/focus >>` | ◎ proposed |
| Conditional | `<$list filter="..." limit="1">` | `<<~ if filter >> ... <<~/if >>` | ◎ proposed |
| Iteration | `<$list filter="...">` | `<<~ for filter as item >> ... <<~/for >>` | ◎ proposed |
| Variable set | `<$set name="v" value="x">` | `<<~! define v = "x" >>` (no-param define) | ◎ proposed |
| Filter notation | `[tag[X]sort[title]]` | `<<~ hana x-tiddlywiki-filter >> ... <<~/hana >>` | ✓ current |
| Filter in widgets | inline `filter="..."` | inline filter arg in `if`/`for`/`ui` | ◎ proposed |
| Recursion guard | depth 8 | render stack `len >= 8` → stub | ◎ proposed |
| Import | `\import [[FilterExpr]]` | `<<~ aka lar:///carrier >>` (shadow include) | ✓ current |
| Widget definition | `\widget $name` | deferred — no widget layer yet | ⚠ deferred |
| HTML widgets | `<$widget ...>` | deferred — renderer-specific | ⚠ deferred |
| Message family | (via `sendMessage`) | `<<~ pranala family:message >>` (no sugar) | ⚠ sugar pending |
| Constraint family | (via rules) | `<<~ pranala family:constraint >>` (no sugar) | ⚠ sugar pending |

Legend: ✓ = current, ◎ = proposed, ⚠ = deferred or pending

<<~/ahu >>

<<~ ahu #gaps-tensions-conflicts >>

## Gaps, Tensions, and Conflicts

### Gap 1: `message` and `constraint` families unregistered in grammar meme

**Problem:** The pranala invariant law defines six families. The grammar meme `[[families]]` array
only defines four (`control`, `relation`, `observe`, `dataflow`). `message` and `constraint` are
invisible to the Phase 2 rule-interpreter.

**Resolution:** Add `[[families]]` entries for `message` and `constraint` to
`lares/grammars/memetic-wikitext.md`. Properties: `message` → `dag_required=false`,
`role_recommended=true`, `confidence_bounded=false`. `constraint` → `dag_required=false`,
`role_required=false`, `role_recommended=false`, `confidence_bounded=false`.

**Also needed:** Sugar sigil names for `message` and `constraint` families.
`hau` and `pono` are candidates (Hawaiian: hau=gift/reciprocal; pono=rightness/rule).
These names need invariant loci before being registered.

### Gap 2: `hana`, `kapu`, `ui`, `?` not registered in grammar meme

**Problem:** Four primitives named in the invariant law have no `[[sigils]]` entries.

**Resolution:** Add entries (patterns listed in `#unregistered-sigil-additions` section below).

### Gap 3: No `layer` field in sigil registry

**Problem:** Grammar meme does not distinguish compile-time from render-time sigils.
A na•ve parser might try to extract `define`/`if`/`for` as graph edges at boot time.

**Resolution:** Add `layer = "compile"` | `layer = "render"` | `layer = "both"` to each
`[[sigils]]` entry. Edge sigils (`aka`, `kahea`, etc.) get `layer = "both"`.
Definition/conditional sigils get `layer = "render"`. `ahu`, `iam`, `? ->` get `layer = "compile"`.

### Gap 4: Pragma `<<~!` dispatch mode undefined in parser

The current parser does not handle `<<~!`. Pragma blocks (define/function) are invisible.

**Resolution:** Boot compiler IGNORES `<<~!` blocks — they produce no compile-time artifacts.
No parser change needed at the compile layer. Render-time interpreters handle them.
This is correct by the dual-layer model: pragma blocks are render-only.

### Tension 1: `aka` drift — "passive inclusion" vs. "shadow transclusion"

**Problem:** The docs primitive guide warns "avoid treating `aka` as implying live invocation."
This warning is correct but incomplete. `aka` IS shadow transclusion — it is not purely passive.
It carries observe-family pressure with render-time embedding semantics.

**Resolution:** The warning should be: do not treat `aka` as LIVE transclusion. `aka` = shadow
(read-only, non-propagating). `kahea` = live (propagating). The distinction is propagation direction
and fidelity, not presence/absence of transclusion.

### Tension 2: Compile-time cycle detection vs. render-time recursion guard

Both must exist. The compile-time DAG guard (control cycles) does not prevent render-time
recursion via `aka`/`kahea`. A cycle-free graph can contain mutual live transclusion.

### Tension 3: `<<~!` pragma scope — carrier-local vs. global

`define` and `function` in a carrier are local by default. Invariant meme definitions may need
global visibility. Mechanism: `<<~ aka lar:///carrier >>` imports the carrier's definitions
(shadow transclusion brings in the definition namespace). This is unresolved in the boot model —
does the compiler parse define blocks inside `aka`-referenced carriers to build a definition index?

### Tension 4: `call` vs. `kahea` similarity of intent

`kahea` = compile-time dataflow edge + render-time live transclusion of the whole meme.
`call` = render-time invocation of a named definition (snippet or function) with arguments.

These are distinct: `kahea` targets whole memes; `call` targets named definitions.
A meme might use both: `<<~ kahea lar:///util >>` (structural edge) + `<<~ call util.formatDate >>` (call).

### Tension 5: TW5 filter inline vs. `hana` block syntax

`if`/`for`/`ui` accept filter expressions inline. `hana` requires a block.
Both forms must parse to the same semantics. Authors who need complex multi-line filters
use `hana`. Simple one-liner filters use the inline sigil form.

### Conflict 1: Bare `<<name>>` form

TW5 macro calls use `<<macroName>>`. This is not valid Lararium syntax.
Authors migrating TW5 content MUST convert `<<macro>>` → `<<~ call macro >>`.
There is no TW5-compat bare-bracket pass planned.

### Conflict 2: TW5 `{{Title||Template}}` mapping

Simple transclusion `{{Title}}` maps cleanly to `<<~ kahea lar:///uri >>`.
Template transclusion `{{Title||Template}}` has no direct sigil form — requires:
1. `<<~ focus lar:///uri >>` to bind the target meme as context
2. `<<~ kahea lar:///template >>` to render the template with that context

This is a two-sigil composition, not a single sigil. Authors should prefer explicit `focus`+`kahea`
over a hypothetical `<<~ kahea lar:///uri via lar:///template >>` form.
The single-form version is not ruled out but adds parser complexity without clear gain.

<<~/ahu >>

<<~ ahu #unregistered-sigil-additions >>

## Additions Needed in `lares/grammars/memetic-wikitext.md`

Missing `[[sigils]]` entries for the grammar meme:

```toml
# --- Missing from current registry (compile-time) ---

[[sigils]]
name         = "kapu"
kind         = "qualifier"
layer        = "compile"
pattern      = '<<~\s*kapu\s+([^\n>]*)\s*>>'
description  = "qualification and boundary posture; marks confidence, restriction, or unresolved threshold"

# --- Missing (both layers) ---

[[sigils]]
name         = "hana"
kind         = "guest-grammar"
layer        = "both"
open_pattern  = '<<~\s*hana\s+([\w-]+)\s*>>'
close_pattern = '<<~\/hana\s*>>'
description  = "bounded guest grammar block; grammar-key selects the interpreter"

[[sigils]]
name         = "ui"
kind         = "query"
layer        = "render"
pattern      = '<<~\s*ui\s+([^\n>]+?)\s*>>'
description  = "query surface; evaluates filter expression and renders result as meme list"

# --- Proposed new sigils (render-time, TW5 parity) ---

[[sigils]]
name         = "focus"
kind         = "context"
layer        = "render"
open_pattern  = '<<~\s*focus\s+(\S+)\s*>>'
close_pattern = '<<~\/focus\s*>>'
description  = "sets the current meme context for the block body; TW5 <$tiddler> equivalent"

[[sigils]]
name         = "if"
kind         = "conditional"
layer        = "render"
open_pattern  = '<<~\s*if\s+([^\n>]+?)\s*>>'
close_pattern = '<<~\/if\s*>>'
description  = "conditional rendering; renders body when filter result is non-empty"

[[sigils]]
name         = "for"
kind         = "iteration"
layer        = "render"
open_pattern  = '<<~\s*for\s+([^\n>]+?)\s+as\s+([\w-]+)\s*>>'
close_pattern = '<<~\/for\s*>>'
description  = "iterative rendering; renders body once per URI in filter result"

[[sigils]]
name         = "call"
kind         = "invocation"
layer        = "render"
pattern      = '<<~\s*call\s+([\w-]+(?:\.([\w-]+))?)(?:\((.*?)\))?\s*>>'
description  = "invokes a named definition (define or function) with optional arguments"

# --- Pragma sigils (<<~! mode, render-time only) ---

[[sigils]]
name         = "define"
kind         = "pragma"
layer        = "render"
open_pattern  = '<<~!\s*define\s+([\w-]+)(?:\(([^)]*)\))?\s*>>'
close_pattern = '<<~\/define\s*>>'
description  = "defines a named wikitext snippet with parameters; TW5 \\procedure equivalent"

[[sigils]]
name         = "function"
kind         = "pragma"
layer        = "render"
pattern      = '<<~!\s*function\s+([\w-]+)(?:\(([^)]*)\))?\s*=\s*([^\n>]+?)\s*>>'
description  = "defines a named filter expression; TW5 \\function equivalent"
```

Missing `[[families]]` entries:

```toml
[[families]]
name                = "message"
dag_required        = false
role_required       = false
role_recommended    = true
confidence_bounded  = false
description         = "routed event or signal passage; carries notification without structural ownership"

[[families]]
name                = "constraint"
dag_required        = false
role_required       = false
role_recommended    = false
confidence_bounded  = false
description         = "declarative rule without execution pulse; spatial, logical, or physical boundary"
```

Also: add `layer` field to all existing `[[sigils]]` entries.

<<~/ahu >>

<<~ ahu #open-questions >>

## Open Questions

1. **`define` scope model.** Carrier-local vs. boot-closure-global for invariant meme defines.
   Does `<<~ aka lar:///carrier >>` import that carrier's definitions into the current namespace?

2. **Sugar sigils for `message` and `constraint` families.** `hau` and `pono` are candidates.
   Both need invariant loci before registration. Which names fit the design ethos?

3. **`<<~?` unresolved-pressure mode syntax.** Block form?
   `<<~? #fragment >> ... <<~/? >>` — marks a worksite as explicitly unresolved.
   Currently the `?` token appears only in `? ->` edge notation and as a `kapu` qualifier.
   Should `<<~?` be a first-class open/close block sigil?

4. **Template cascade.** TW5's `$:/tags/ViewTemplate` cascade — walk a priority-ordered template
   list and pick first match — maps to `lares/templates/` for tldraw projection.
   Does the same cascade apply to `focus`+`kahea` text rendering? Or is template selection always
   explicit (`<<~ focus uri >> <<~ kahea template >>`) rather than implicit cascade?

5. **`call` parameter naming inside `define` body.** TW5 text substitution is fragile (positional
   parameter names appear verbatim). Lararium `call param-name` inside a define body should be
   an explicit sigil call, not bare text substitution. Formal grammar rule needed.

<<~/ahu >>

<<~ ahu #meme-body-close >>
MEMETIC-WIKITEXT-SPEC closes.
<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ pranala #defines-grammar ? -> lar:///grammars/memetic-wikitext family:control role:extends >>
<<~ pranala #pranala-law ? -> lar:///ha.ka.ba/api/v0.1/pono/pranala family:control role:governed-by >>
<<~ pranala #mwt-law ? -> lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext family:control role:governed-by >>
<<~ pranala #tw5-filter ? -> lar:///ha.ka.ba/api/v0.1/grammars/x-tiddlywiki-filter family:observe role:references >>
<<~ pranala #to-foundations ? -> lar:///lararium-node/MEME-STORE-FOUNDATIONS family:observe role:informs >>
<<~ pranala #to-roadmap ? -> lar:///lararium-node/ROADMAP family:observe role:informs >>
<<~ loulou lar:///ha.ka.ba/docs/pono/memetic-wikitext >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/pono/guest-grammar >>

<<~/ahu >>

<<~ ? -> lar:///grammars/memetic-wikitext-spec >>
