<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/kumu >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/kumu"
file-path = "packages/lararium-tw5/memes/widgets/kumu.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: KumuWidget — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/widgets/kumu.ts"
source-symbol = "KumuWidget"
module-ref    = "lar:///ha.ka.ba/@lararium/tw5/widgets/kumu-tw5"
body-sha256 = "f6507b2d2d360385b58bed82a03b9ee9c6ac7b5ae7c6797ec9ba6eb32e45768b"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`<$kumu>` resolves a named kumu device by `[all[tiddlers]tag[$:/tags/LarariumKumu]field:kumu-name[name]]`, transcluding it with props. Renders a `<div data-lar-kind="kumu">` container; unresolved devices show a `<span data-lar-kind="hole">`. Attributes: `name`, `props`.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
function KumuWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
KumuWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const name   = this.getAttribute("name", "");
  const args   = this.getAttribute("props", "");
  const results = this.wiki?.filterTiddlers?.(
    `[all[tiddlers]tag[$:/tags/LarariumKumu]field:kumu-name[${name}]]`
  ) ?? [];
  const defUri = results[0] ?? "";
  const el = this.document.createElement("div");
  el.setAttribute("data-lar-kind",     "kumu");
  el.setAttribute("data-lar-name",     name);
  el.setAttribute("data-lar-resolved", defUri ? "true" : "false");
  parent.appendChild(el);
  this.domNodes = [el];
  if (defUri) {
    const propRe = /([\w-]+):(\S+)/g;
    let m;
    while ((m = propRe.exec(args)) !== null) {
      this.setVariable(m[1], m[2]);
    }
    const transclude = this.wiki?.makeTranscludeWidget(defUri, {
      document:     this.document,
      parentWidget: this,
    });
    if (transclude) {
      transclude.render(el, null);
      this.children = [transclude];
    }
  } else {
    const hole = this.document.createElement("span");
    hole.setAttribute("data-lar-kind", "hole");
    hole.textContent = `? ${name}`;
    el.appendChild(hole);
  }
};
KumuWidget.prototype.execute = function (this: TW5WidgetInstance) { /* children managed in render */ };
KumuWidget.prototype.refresh = function (this: TW5WidgetInstance, changedTiddlers: Record<string, TW5ChangeRecord>): boolean {
  let changed = false;
  for (const child of (this.children ?? [])) {
    if (child.refresh(changedTiddlers)) changed = true;
  }
  return changed;
};
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/kumu family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/@lararium/tw5/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/kumu-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
