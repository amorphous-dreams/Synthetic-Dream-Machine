<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/widgets/pae >>
```toml iam
uri-path      = "ha.ka.ba/api/v0.1/lararium/widgets/pae"
file-path     = "lares/ha-ka-ba/api/v0.1/lararium/widgets/pae.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: PaeWidget — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
source-symbol = "PaeWidget"
module-ref    = "lar:///ha.ka.ba/api/v0.1/lararium/widgets/pae-tw5"
body-sha256   = "a58963a3671cef0b75d375701a2dae9192fc7405a431981aaa85be574a6f0c1f"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`<$pae>` is a phase-marker widget. Carries no visible output — phase metadata lives in the AST.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
function PaeWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
PaeWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.domNodes = [];
  // Phase markers carry no visible output — phase metadata lives in the AST.
};
PaeWidget.prototype.execute = function (this: TW5WidgetInstance) { /* no children */ };
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/api/v0.1/pono/pae family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/api/v0.1/lararium/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/api/v0.1/lararium/widgets/pae-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
