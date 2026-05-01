import type { TW5WidgetInstance, TW5ParseTreeNode, TW5FakeElement } from "../types/tiddlywiki.js";

export function PapaloheWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
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
