import type { TW5WidgetInstance, TW5ParseTreeNode, TW5FakeElement } from "../types/tiddlywiki.js";

export function KukaliWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
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
  // Bridge to reactionGraph.subscribeOnce() via hook registered on $tw.wiki.
  const hook = this.wiki?._larKukaliHook;
  const uri  = this.getVariable?.("currentTiddler") ?? "";
  if (hook && uri && trigger) {
    const cancel = hook(uri, trigger);
    if (typeof cancel === "function") (el as unknown as Record<string, unknown>)["_larKukaliCancel"] = cancel;
  }
};
KukaliWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };
