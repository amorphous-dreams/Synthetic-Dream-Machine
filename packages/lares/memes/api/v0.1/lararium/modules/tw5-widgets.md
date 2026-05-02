<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/modules/tw5-widgets >>
```toml iam
uri-path = "ha.ka.ba/@lares/api/v0.1/lararium/modules/tw5-widgets"
file-path = "packages/lares/api/v0.1/lararium/modules/tw5-widgets.md"
type  = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.86
mana          = 0.86
manao         = 0.84
manaoio       = 0.82
tagspace      = "adjacent"
role          = "TW5 widget registry: ten lararium widget types, widget tiddler registration, TW5ParseNode shape"
cacheable     = true
retain        = true
status-date   = "2026-04-30"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts packages/lararium-tw5/src/memetic-parser.ts"
source-symbol = "LARARIUM_WIDGETS_TIDDLER WorksiteWidget EdgeWidget TomlWidget SigilWidget DynamicWidget HeaderWidget DispatchWidget PapaloheWidget KukaliWidget KumuWidget TW5ParseNode"
```



<<~ ahu #head >>

# TW5 Widgets

Ten widget types form the lararium widget vocabulary for TW5.
Registered via `LarariumTW5._registerWidgets()` after boot.
The widget module tiddler ships as `lar:///lararium-node/tw5/widgets`.

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #schema >>

## Schema (machine-readable)

```toml
# Ten lararium widget types — registered to TW5 Widget prototype chain at boot
widget-types = [
  "lararium-worksite",   # ahu slot renderer — the primary content frame
  "lararium-edge",       # pranala edge renderer
  "lararium-toml",       # TOML fence renderer
  "lararium-sigil",      # kernel/operator sigil renderer
  "lararium-dynamic",    # dynamic (runtime-resolved) content
  "lararium-header",     # carrier header (CarrierHeader AST node)
  "lararium-dispatch",   # reaction dispatch surface
  "lararium-papalohe",   # papalohe async channel widget
  "lararium-kukali",     # kukali suspension widget
  "lararium-kumu",       # kumu device widget (UEFN analogue)
]

# Widget module tiddler — injected at boot
[widget-tiddler]
title       = "lar:///lararium-node/tw5/widgets"
type        = "application/javascript"
module-type = "widget"
tags        = ["$:/tags/Global"]
role        = "tw5-widget-module"
cacheable   = "true"
hydrate     = "true"

# TW5ParseNode — parse tree node shape (MemeAstNode → TW5 bridge)
[TW5ParseNode]
fields = [
  "type: string",
  "children?: TW5ParseNode[]",
  "text?: string",
  "attributes?: Record<string, {type: string|indirect, value: string}>",
  "tag?: string",
  "_ast?: MemeAstNode   # original AST node for round-trip access",
]
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-node-host ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/modules/node-host family:control role:depends >>
<<~ pranala #to-carrier-sigils ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/carrier-sigils family:control role:depends >>
<<~ pranala #to-papalohe ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/papalohe family:control role:implements >>
<<~ pranala #to-kukali ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/kukali family:control role:implements >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
