import type { TW5WidgetInstance, TW5ParseTreeNode, TW5FakeElement } from "../types/tiddlywiki.js";

export function KukaliWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
KukaliWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const listenable = this.getAttribute("listenable", "");
  const uri        = this.getAttribute("uri", "") || (this.getVariable?.("currentTiddler") ?? "");
  const el = this.document.createElement("span");
  el.setAttribute("data-lar-kind",       "kukali");
  el.setAttribute("data-lar-listenable", listenable);
  el.setAttribute("data-lar-uri",        uri);
  parent.appendChild(el);
  this.domNodes = [el];
  // Signal the projection bus (Verse signalable pattern).
  // ReactionEngine subscribes via TW5Engine.registerProjectionBus() — never coupled here.
  if (uri && listenable && this.wiki?.dispatchEvent) {
    this.wiki.dispatchEvent("tm-lararium-event", { uri, listenable });
  }
};
KukaliWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };
