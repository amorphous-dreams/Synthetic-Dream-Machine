<<~&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/widgets/kukali >>
```toml iam
uri-path = "ha.ka.ba/@lares/api/v0.1/lararium/widgets/kukali"
file-path = "packages/lararium-tw5/memes/widgets/kukali.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: KukaliWidget — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/widgets/kukali.ts"
source-symbol = "KukaliWidget"
module-ref    = "lar:///ha.ka.ba/@lares/api/v0.1/lararium/widgets/kukali-tw5"
body-sha256 = "8ac9495db8e12d378b9c388eacf8a8b968d08ce0220ae4bf22a6c871b93f3e0c"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`<$kukali>` renders a `<span data-lar-kind="kukali">` element and wires a reactive hook via `wiki._larKukaliHook`. The hook cancel function is stored on the DOM node. Attribute: `trigger`.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
function KukaliWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
KukaliWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const trigger = this.getAttribute("trigger", "");
  const el = this.document.createElement("span");
  el.setAttribute("data-lar-kind",    "kukali");
  el.setAttribute("data-lar-trigger", trigger);
  parent.appendChild(el);
  this.domNodes = [el];
  const hook = this.wiki?._larKukaliHook;
  const uri  = this.getVariable?.("currentTiddler") ?? "";
  if (hook && uri && trigger) {
    const cancel = hook(uri, trigger);
    if (typeof cancel === "function") (el as unknown as Record<string, unknown>)["_larKukaliCancel"] = cancel;
  }
};
KukaliWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/kukali family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/widgets/kukali-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
