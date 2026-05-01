import type { TW5WidgetInstance, TW5ParseTreeNode, TW5FakeElement, TW5ChangeRecord } from "../types/tiddlywiki.js";

export function AhuWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
AhuWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();

  const slot       = this.getAttribute("slot", "");
  const renderMode = this.getVariable?.("lar-render-mode") ?? "";

  if (renderMode === "carrier") {
    // Carrier projection: reconstruct <<~ ahu #slot >>...<<~/ahu >> syntax.
    const parentUri   = this.getVariable?.("currentTiddler") ?? "";
    const fragmentUri = parentUri + slot;
    const fragFields  = this.wiki?.getTiddler?.(fragmentUri)?.fields as Record<string, unknown> | undefined;
    const body        = typeof fragFields?.["text"] === "string" ? fragFields["text"] : "";
    const text        = this.document.createTextNode(`<<~ ahu ${slot} >>${body}<<~/ahu >>`);
    parent.insertBefore(text, nextSibling);
    this.domNodes = [text as unknown as TW5FakeElement];
  } else {
    // HTML render: children handle live slot content via transclusion.
    const el = this.document.createElement("section");
    el.setAttribute("data-lar-kind", "ahu");
    el.setAttribute("data-lar-slot", slot);
    parent.appendChild(el);
    this.domNodes = [el];
    this.renderChildren(el, null);
  }
};
AhuWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };
AhuWidget.prototype.refresh = function (this: TW5WidgetInstance, changedTiddlers: Record<string, TW5ChangeRecord>): boolean {
  const slot      = this.getAttribute("slot", "");
  const parentUri = this.getVariable?.("currentTiddler") ?? "";
  const fragUri   = parentUri + slot;
  if (changedTiddlers[fragUri]) {
    this.refreshSelf();
    return true;
  }
  let changed = false;
  for (const child of (this.children ?? [])) {
    if (child.refresh(changedTiddlers)) changed = true;
  }
  return changed;
};
