<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/widgets/papalohe >>
```toml iam
uri-path      = "ha.ka.ba/api/v0.1/lararium/widgets/papalohe"
file-path     = "lares/ha-ka-ba/api/v0.1/lararium/widgets/papalohe.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: PapaloheWidget — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/widgets/papalohe.ts"
source-symbol = "PapaloheWidget"
module-ref    = "lar:///ha.ka.ba/api/v0.1/lararium/widgets/papalohe-tw5"
body-sha256 = "63ce59d60fc63fd7d7e4c5d8e599198bd18cefaaa939798bfb91a96a0ecd9319"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`<$papalohe>` renders a `<meta data-lar-kind="papalohe">` element. Encodes a trigger-fn-slot binding for reactive pipeline hooks. Attributes: `from`, `to`, `trigger`, `fn`, `slot`.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
function PapaloheWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
PapaloheWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("meta");
  el.setAttribute("data-lar-kind",    "papalohe");
  el.setAttribute("data-lar-from",    this.getAttribute("from", ""));
  el.setAttribute("data-lar-to",      this.getAttribute("to", ""));
  el.setAttribute("data-lar-trigger", this.getAttribute("trigger", ""));
  el.setAttribute("data-lar-fn",      this.getAttribute("fn", ""));
  el.setAttribute("data-lar-slot",    this.getAttribute("slot", ""));
  parent.appendChild(el);
  this.domNodes = [el];
};
PapaloheWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/api/v0.1/pono/papalohe family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/api/v0.1/lararium/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/api/v0.1/lararium/widgets/papalohe-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
