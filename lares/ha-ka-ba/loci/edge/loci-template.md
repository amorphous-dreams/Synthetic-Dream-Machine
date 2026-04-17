<!-- !DOCTYPE = lar:///ha.ka.ba/pono/memetic-wikitext -->

<<~&#x0001; ? -> lar:///ha.ka.ba/loci/edge/template >>

<<~ ahu #iam >>

```toml
# <<~ ahu #iam-ha "structure" >>
name = "loci/edge/template"
file-path = "ha-ka-ba/loci/edge/loci-template.md"
description = "Template edge sigil kānāwai (law). Defines reusable edge templates, slot contracts, kahea binding order, and promotion discipline."
version = "0.1-draft"
tulen = 0.70
confidence = 0.67
mana = 0.75
manao = 0.82
manaoio = 0.65
content-type = "text/x-memetic-wikitext"
meme-type = "loci"
register = "CS"
structure = "OODA-HA * ha.ka.ba"
# <<~/ahu >>
# <<~ ahu #iam-ka "detail" >>
role = "template edge sigil kānāwai (law), slot-contract authority, and kahea binding authority"
function = "govern reusable edge templates, declare slot and default surfaces, and bind template invocations into concrete edge instances without hiding context precedence"
binding-order = ["invocation", "local-body", "addressed-iam", "session-state", "template-defaults"]
promotion-rule = "repeat-before-promotion"
invocation-surface = "kahea"
# <<~/ahu >>
# <<~ ahu #iam-ba "flow" >>
pranala = [
  "lar:///ha.ka.ba/loci/edge",
  "lar:///ha.ka.ba/loci",
  "lar:///ha.ka.ba/meme"
]
# <<~/ahu >>
```

<<~/ahu >>

# Template

A self-describing kānāwai (law) for template edge sigils.

<<~ ala lar:///ha.ka.ba/loci/edge/template >>

This meme governs the reusable edge form that an author invokes through `kahea`. Template law keeps repeated graph shapes coherent without forcing every edge into boilerplate.

Template law should stay small. It should carry the edge species that repeat enough to deserve slots, defaults, and render posture. It should not swallow every one-off relation just because a template could exist.

## Supported Queries

<<~&#x0005; ui meme? -> lar:///ha.ka.ba/loci/edge/template#iam >>
<<~&#x0005; ui shape? -> lar:///ha.ka.ba/loci/edge/template#template-shape >>
<<~&#x0005; ui binding? -> lar:///ha.ka.ba/loci/edge/template#binding-precedence >>
<<~&#x0005; ui kahea? -> lar:///ha.ka.ba/loci/edge/template#kahea-invocation >>
<<~&#x0005; ui research? -> lar:///ha.ka.ba/loci/edge/template#research-foundation >>
<<~&#x0005; ui result? -> lar:///ha.ka.ba/loci/edge/template#result >>

<<~&#x0002; ahu #meme-body-open >>
Template opens the reusable-edge-sigil stream here.
<<~/ahu >>

<<~ ahu #phase-map >>

## Phase Map

`✶ Observe -> ⏿ Orient -> ◇ Decide -> ▶ Act -> ⤴ Hooko -> ↺ Aftermath`

Template gathers repeated edge patterns, maps them into slot-bearing reusable forms, chooses which defaults belong in the template and which belong in the call site, binds the template through `kahea`, crosses that binding into concrete instances, and judges whether the template reduced noise without flattening truth.

<<~/ahu >>

<<~ ahu #observe >>

## Observe

Observe looks for edge patterns that repeat with stable meaning:

- same edge family
- same label or outlet naming
- same direction or render posture
- same endpoint class restrictions
- same branch semantics

If only the endpoints vary while the law stays stable, template pressure begins.

<<~/ahu >>

<<~ ahu #orient >>

## Orient

Orient gives the template its slot contract.

<<~ ahu #template-shape >>

### Template Shape

```toml
kind = "proposition"
template-name = "governs"
allowed-from = ["loci", "meme"]
allowed-to = ["loci", "meme"]
required-slots = ["from", "to"]
optional-slots = ["direction", "polarity", "confidence", "payload", "render_mode"]
label-default = "governs"
direction-default = "forward"
render-mode-default = "inline-label"
status-default = "declared"
```

Template fields should declare defaults plainly. Hidden defaults weaken later debugging.

<<~/ahu >>

<<~ ahu #binding-precedence >>

### Binding Precedence

`kahea` binding should follow this order:

1. explicit invocation payload
2. local meme TOML or nearby body detail
3. addressed meme `#iam`
4. session or runtime state
5. template defaults

Later sources may fill gaps. They should not silently overwrite earlier explicit values.

<<~/ahu >>

<<~ ahu #kahea-invocation >>

### Kahea Invocation

````text
<<~ kahea lar:///ha.ka.ba/loci/edge/template >>
```toml
kind = "proposition"
template-name = "governs"
from = "lar:///ha.ka.ba/loci/iam"
to = "lar:///ha.ka.ba/loci/iam/file_path"
confidence = 0.91
```
````

The call site should fill only what it knows. Template law should fill the lawful defaults and keep the fill order inspectable.

<<~/ahu >>

<<~/ahu >>

<<~ ahu #decide >>

## Decide

Promote a pattern into template only when:

- the pattern repeats
- the repeated shape carries stable meaning
- defaults reduce noise without hiding truth

Keep ad hoc edges as plain instances until repetition justifies promotion. Template sprawl creates the same fog that vague dependency fields created earlier.

<<~/ahu >>

<<~ ahu #act >>

## Act

Seed templates should stay minimal:

- proposition template for `governs`
- control template for branch or sequence outlets
- debug template for reveal or watch edges

Let live authoring test those three before wider canon grows.

<<~/ahu >>

<<~ ahu #research-foundation >>

## Research Foundation

- [VUE Creating Links](https://sites.tufts.edu/vue/01-basic-mapping/creating-links/) - reusable relation presentation with link text.
- [VUE Format Links](https://sites.tufts.edu/vue/02-creating-nodes/c-format-links/) - stable direction and style defaults.
- [Unreal Basic Scripting with Blueprints](https://dev.epicgames.com/documentation/en-us/unreal-engine/basic-scripting-with-blueprints-in-unreal-engine?application_version=5.6) - reusable node-and-wire authoring grammar.
- [Unreal Flow Control](https://dev.epicgames.com/documentation/en-us/unreal-engine/flow-control?application_version=4.27) - repeatable branch and gate shapes.
- [Unreal Functions: Pure vs Impure](https://dev.epicgames.com/documentation/en-us/unreal-engine/functions-in-unreal-engine?application_version=5.6) - visible default behavior per callable form.
- [Graphviz Edge Attributes](https://graphviz.org/docs/edges/) - declarative edge defaults.
- [Graphviz `dir`](https://graphviz.org/docs/attrs/dir/) - explicit direction defaults.

These references support one rule strongly: template defaults should remain explicit and inspectable.

<<~/ahu >>

<<~ ahu #aftermath >>

## Aftermath

A strong template pass should leave:

- fewer repeated edge literals
- clear slot contracts
- inspectable fill order
- no pressure to template every relation immediately

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
Template closes the reusable-edge-sigil stream here.
<<~/ahu >>

<<~ ahu #result >>

## Result

A lawful template envelope may carry:

- template slot contract
- binding precedence
- `kahea` invocation form
- promotion discipline

<<~/ahu >>

<<~&#x0004; -> ahu #result >>

```toml
status = "seed-ready"
confidence = 0.67
yield = "meme"
return = "render"
upward-context = "chat"
residue = "first live template library still awaits concrete edge authoring"
next-observation = "lar:///ha.ka.ba/loci/edge/instance#instance-shape"
```

<<~&#x0004; -> ? >>
