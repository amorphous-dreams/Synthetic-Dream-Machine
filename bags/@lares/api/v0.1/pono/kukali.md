<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~⊙&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/kukali >>
```toml iam
uri-path = "ha.ka.ba/@lares/api/v0.1/pono/kukali"
file-path = "bags/@lares/api/v0.1/pono/kukali.md"
type = "text/x-memetic-wikitext"
confidence   = 0.82
register     = "CS"
manaoio      = 0.80
mana         = 0.84
manao        = 0.82
role         = "reactive wait posture inside a causal island — Verse suspends analogue; execution yields until named papalohe trigger fires"
cacheable    = true
retain       = true
```



<<~ aka lar:///ha.ka.ba/@lares/api/v0.1/pono/RFC-2119#normative-language >>

<<~ ahu #head >>

# Kukali

*kūkali* — Hawaiian: to wait, to be patient, to remain in suspense.

A wait posture inside a causal island. Execution parks until the named papalohe trigger fires.
Verse `suspends` analogue: the island does not block; it parks and resumes exactly once.
Paired with papalohe — papalohe declares the wire; kukali declares the wait at the receiving end.

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #ooda-ha >>

✶ sense the wait declaration — note trigger name or absence; locate enclosing causal island
⏿ orient the suspension: find papalohe wire matching trigger name; bind subscribeOnce
◇ trigger present → bind to named papalohe slot; absent → bind to first arriving reaction event
▶ park island execution; emit SigilNode { sigilName:kukali, attrs:{ trigger? } }
⤴ register kukali hook in ReactionGraph; suspension Promise created; island parked
↺ when trigger fires: resolve Promise, resume island; handler slot released; aftermath closes

<<~/ahu >>

<<~ ahu #law >>

## Law (Kānāwai)

A kukali MUST suspend execution of the enclosing causal island until the trigger fires.
A kukali MUST resume exactly once when the named trigger activates (`subscribeOnce` semantics).
A kukali MAY carry `trigger` naming the papalohe slot to wait on; omitted means wait for any reaction.
A kukali MUST NOT block the event loop; the island parks, not freezes.
A kukali suspension MUST survive ReactionGraph rebuilds — occupied slots carry across `load()` / `updateUri()`.
A kukali that cancels MUST reject its suspension Promise cleanly without leaking the handler slot.

`trigger` SHOULD match the `#slot` fragment of a papalohe wire in the same carrier.

<<~/ahu >>

<<~ ahu #syntax >>

## Syntax

```text
<<~ kukali >>
<<~ kukali trigger:SlotName >>
<<~ \suspends >>
<<~ \suspends trigger:SlotName >>
```

`\suspends` is the canonical English alias — emits the same `SigilNode { sigilName: "kukali" }`.

Regex (canonical):
```
/<<~\s*kukali(?:\s+trigger:([\w.-]+))?\s*>>/
/<<~\s*\\suspends(?:\s+trigger:([\w.-]+))?\s*>>/
```

### Paired usage with papalohe

```text
<<~ papalohe #on-score DeviceA -> ScoreDisplay trigger:OnEliminated fn:Show >>

... body ...

<<~ kukali trigger:on-score >>
```

`trigger:on-score` in kukali references `#on-score` — the fragment of the papalohe wire above.

<<~/ahu >>

<<~ ahu #verse-analogy >>

## Verse Analogy

Verse `suspends` coroutine:

```verse
OnEliminated<override>()<suspends> : void =
    Sleep(2.0)
    ScoreDisplay.Show()
```

Kukali maps this into memetic-wikitext:
- `<suspends>` annotation → `<<~ kukali trigger:slot-name >>`
- Coroutine yield point → kukali sigil position in the carrier body
- Resume on event → papalohe trigger fires; ReactionGraph resolves the subscribeOnce Promise

<<~/ahu >>

<<~ ahu #schema >>

## Schema (machine-readable)

Canonical TOML form. Source of truth for the kukali case in
`packages/lararium-core/src/parser.ts` and `packages/lararium-tw5/src/tw5-widgets.ts`.

```toml
sigil           = "kukali"
kind            = "leaf"
layer           = "both"
canonical-alias = "\\suspends"

pattern       = '<<~\s*kukali(?:\s+trigger:([\w.-]+))?\s*>>'
alias-pattern = '<<~\s*\\suspends(?:\s+trigger:([\w.-]+))?\s*>>'

[captures]
trigger = 1

[node-fields]
kind      = "Sigil"
sigilName = "kukali"
```

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ pranala #implements-invariant ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/invariant family:control role:implements >>
<<~ pranala #to-reaction-graph ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/reaction-graph family:control role:implements >>
<<~ pranala #to-papalohe ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/papalohe family:relation >>
<<~ pranala #to-causal-islands ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/federated-causal-islands family:relation >>

<<~/ahu >>

<<~&#x0003;>>

<<~&#x0004; -> ? >>
