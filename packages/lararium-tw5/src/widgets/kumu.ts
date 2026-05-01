import type { TW5WidgetInstance, TW5ParseTreeNode, TW5FakeElement, TW5ChangeRecord } from "../types/tiddlywiki.js";

export function KumuWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
KumuWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const name = this.getAttribute("name", "");
  const args = this.getAttribute("props", "");
  // Resolve kumu def: tag $:/tags/LarariumKumu + field kumu-name matches invocation name.
  const results: string[] = this.wiki?.filterTiddlers?.(
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
    // Parse "key:value key:value" args into TW5 variables (prop-shadow rule).
    const propRe = /([\w-]+):(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = propRe.exec(args)) !== null) {
      this.setVariable(m[1]!, m[2]!);
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
