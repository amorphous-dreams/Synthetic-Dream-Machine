import type { TW5WidgetInstance, TW5ParseTreeNode, TW5FakeElement } from "../types/tiddlywiki.js";

export function LeleWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
LeleWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("meta");
  el.setAttribute("data-lar-kind",   "lele");
  el.setAttribute("data-lar-target", this.getAttribute("target", ""));
  parent.appendChild(el);
  this.domNodes = [el];
};
LeleWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };
