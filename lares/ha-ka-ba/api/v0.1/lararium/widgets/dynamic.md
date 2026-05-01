<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/widgets/dynamic >>
```toml iam
uri-path      = "ha.ka.ba/api/v0.1/lararium/widgets/dynamic"
file-path     = "lares/ha-ka-ba/api/v0.1/lararium/widgets/dynamic.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: DynamicWidget — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
source-symbol = "DynamicWidget"
module-ref    = "lar:///ha.ka.ba/api/v0.1/lararium/widgets/dynamic-tw5"
body-sha256   = "43d9e318af90ac7fc47b0fdab9897b7ac0e9b63138f0225523b7bd6768a16c17"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`<$dynamic>` renders a `<span data-lar-kind="dynamic">` element. `data-lar-sigil` is the parse-tree tag. Renders children inside the span. Used for dynamically-resolved sigil forms.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
function DynamicWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
DynamicWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("span");
  el.setAttribute("data-lar-kind",  "dynamic");
  el.setAttribute("data-lar-sigil", this.parseTreeNode?.tag ?? "");
  parent.appendChild(el);
  this.domNodes = [el];
  this.renderChildren(el, nextSibling);
};
DynamicWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/api/v0.1/pono/dynamic family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/api/v0.1/lararium/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/api/v0.1/lararium/widgets/dynamic-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
