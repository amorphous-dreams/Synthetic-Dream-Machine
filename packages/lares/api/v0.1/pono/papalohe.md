<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/papalohe >>
```toml iam
uri-path = "ha.ka.ba/@lares/api/v0.1/pono/papalohe"
file-path = "packages/lares/api/v0.1/pono/papalohe.md"
type = "text/x-memetic-wikitext"
confidence   = 0.84
register     = "CS"
manaoio      = 0.82
mana         = 0.86
manao        = 0.84
role         = "reaction-family edge sugar — UEFN device graph event wire; trigger at source, fn at target"
cacheable    = true
retain       = true
```



<<~ aka lar:///ha.ka.ba/@lares/api/v0.1/pono/RFC-2119#normative-language >>

<<~ ahu #head >>

# Papalohe

*pāpālohe* — Lua martial art: body-listening reflex, heightened reflexive awareness.

A reaction-family edge sugar. The wire fires only when the named source event activates it.
UEFN device graph analogue: `DeviceA.EventX -> DeviceB.FunctionY`.
`trigger` names the source event. `fn` names the optional target function.

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #ooda-ha >>

✶ sense the source event declaration at the wire mouth — notice trigger name and optional fn
⏿ orient the edge: family:reaction, renderMode:reaction-wire; bind trigger label at source end
◇ fn present → full UEFN binding; fn absent → trigger-only subscription; validate no DAG cycles
▶ emit EdgeSugarNode with sigil:papalohe, family:reaction, trigger, fn; render reaction-wire
⤴ register binding in ReactionGraph; kukali suspensions awaiting this trigger may now resolve
↺ confirm wire registered; handler slots occupied; aftermath closes to observe

<<~/ahu >>

<<~ ahu #law >>

## Law (Kānāwai)

A papalohe MUST carry a `from` socket and a `to` socket.
A papalohe MUST carry `family:reaction`.
A papalohe SHOULD carry `trigger` naming the source-side event.
A papalohe MAY carry `fn` naming the target-side function to invoke.
A papalohe MUST NOT fire unless the named trigger activates.
A papalohe MUST NOT carry `traversal:both`; reciprocal wires MUST use two parallel edges.

`trigger` — the activating event at the source (e.g. `OnEliminated`, `Button.InteractedWithEvent`).
`fn` — the function invoked at the target (e.g. `ShowScore`, `HandleDamage`). MAY be omitted.

<<~/ahu >>

<<~ ahu #syntax >>

## Syntax

```text
<<~ papalohe FROM -> TO >>
<<~ papalohe FROM -> TO trigger:EventName >>
<<~ papalohe FROM -> TO trigger:EventName fn:FunctionName >>
<<~ papalohe #fragment FROM -> TO trigger:OnEliminated fn:ShowScore >>
```

`? ->` MAY compress when enclosing pressure carries the source socket.

Regex (canonical):
```
/<<~\s*papalohe\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+trigger:([\w.-]+))?(?:\s+fn:([\w.-]+))?\s*>>/
```
Groups: `[full, #slot?, FROM, TO, trigger?, fn?]`

<<~/ahu >>

<<~ ahu #schema >>

## Schema (machine-readable)

Canonical TOML form. Source of truth for `BUILTIN_PAPALOHE_RE` and the papalohe parse case in
`packages/lararium-core/src/pranala-parser.ts` and `packages/lararium-core/src/parser.ts`.

```toml
sigil          = "papalohe"
kind           = "edge-sugar"
layer          = "both"
default-family = "reaction"
render-mode    = "reaction-wire"
alias          = []

pattern = '<<~\s*papalohe\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+trigger:([\w.-]+))?(?:\s+fn:([\w.-]+))?\s*>>'

[captures]
slot    = 1
from    = 2
to      = 3
trigger = 4
fn      = 5

canonical-roles = ["subscription", "handler", "callback"]
```

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ pranala #implements-pranala ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/pranala family:control role:implements >>
<<~ pranala #implements-invariant ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/invariant family:control role:implements >>
<<~ pranala #to-reaction-graph ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/reaction-graph family:control role:implements >>
<<~ pranala #to-kukali ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/kukali family:relation >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
