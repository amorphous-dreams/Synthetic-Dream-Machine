import type { TW5WidgetInstance, TW5ParseTreeNode, TW5FakeElement } from "../types/tiddlywiki.js";

export function PranalaWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
PranalaWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("meta");
  el.setAttribute("data-lar-kind",   "pranala");
  el.setAttribute("data-lar-from",   this.getAttribute("from", ""));
  el.setAttribute("data-lar-to",     this.getAttribute("to", ""));
  el.setAttribute("data-lar-family", this.getAttribute("family", ""));
  el.setAttribute("data-lar-role",   this.getAttribute("role", ""));
  parent.appendChild(el);
  this.domNodes = [el];
};
PranalaWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };
