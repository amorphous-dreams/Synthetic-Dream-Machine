/**
 * tw5-widgets — TW5 widget constructor functions for memetic-wikitext node types.
 *
 * createLarariumWidgets() returns plain constructor functions with no prototype
 * wiring. LarariumTW5._registerWidgets() sets up the TW5 Widget prototype chain
 * after boot, when the real Widget base class is available.
 *
 * Node type → Widget:
 *   lararium-worksite → WorksiteWidget   renders children inside data-lar-slot span
 *   lararium-edge     → EdgeWidget       metadata only; emits <meta data-lar-*>
 *   lararium-toml     → TomlWidget       data block; emits <script type=toml>
 *   lararium-sigil    → SigilWidget      generic sigil container; renders children
 *   lararium-dynamic  → DynamicWidget    extension sigil; renders children
 *   lararium-header   → HeaderWidget     carrier header; emits <meta data-lar-uri>
 *   lararium-dispatch → DispatchWidget   lele fire; emits <meta data-lar-target>
 *
 * Design rule: structural nodes (Worksite/Sigil/Dynamic) emit a <span> wrapper
 * with data-lar-* attributes so canvas overlays can locate worksite boundaries
 * in the VDomNode tree. Metadata nodes (Edge/Toml/Header/Dispatch) emit <meta>
 * or <script> with no visible content.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
type WidgetCtor = AnyFn & { prototype: object };

// ---------------------------------------------------------------------------
// WorksiteWidget — <<~ ahu #slot >> container
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WorksiteWidget(this: any, parseTreeNode: any, options: any) {
  this.initialise(parseTreeNode, options);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
WorksiteWidget.prototype.render = function (parent: any, nextSibling: any) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("span");
  el.setAttribute("data-lar-kind", "worksite");
  el.setAttribute("data-lar-slot", this.getAttribute("slot", ""));
  el.setAttribute("data-lar-uri",  this.getAttribute("uri", ""));
  parent.appendChild(el);
  this.domNodes = [el];
  this.renderChildren(el, nextSibling);
};
WorksiteWidget.prototype.execute = function () { this.makeChildWidgets(); };

// ---------------------------------------------------------------------------
// EdgeWidget — pranala / edge-sugar (metadata; no visible output)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EdgeWidget(this: any, parseTreeNode: any, options: any) {
  this.initialise(parseTreeNode, options);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
EdgeWidget.prototype.render = function (parent: any, _nextSibling: any) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("meta");
  el.setAttribute("data-lar-kind",   "edge");
  el.setAttribute("data-lar-from",   this.getAttribute("from", ""));
  el.setAttribute("data-lar-to",     this.getAttribute("to", ""));
  el.setAttribute("data-lar-family", this.getAttribute("family", ""));
  el.setAttribute("data-lar-role",   this.getAttribute("role", ""));
  parent.appendChild(el);
  this.domNodes = [el];
};
EdgeWidget.prototype.execute = function () { this.makeChildWidgets(); };

// ---------------------------------------------------------------------------
// TomlWidget — iam / toml data block (metadata; no visible output)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TomlWidget(this: any, parseTreeNode: any, options: any) {
  this.initialise(parseTreeNode, options);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
TomlWidget.prototype.render = function (parent: any, _nextSibling: any) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("script");
  el.setAttribute("type",          "application/toml");
  el.setAttribute("data-lar-kind", "toml");
  el.textContent = this.getAttribute("content", "");
  parent.appendChild(el);
  this.domNodes = [el];
};
TomlWidget.prototype.execute = function () { this.makeChildWidgets(); };

// ---------------------------------------------------------------------------
// SigilWidget — generic canonical sigil (renders children)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SigilWidget(this: any, parseTreeNode: any, options: any) {
  this.initialise(parseTreeNode, options);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
SigilWidget.prototype.render = function (parent: any, nextSibling: any) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("span");
  el.setAttribute("data-lar-kind",  "sigil");
  el.setAttribute("data-lar-sigil", this.parseTreeNode?.tag ?? "");
  parent.appendChild(el);
  this.domNodes = [el];
  this.renderChildren(el, nextSibling);
};
SigilWidget.prototype.execute = function () { this.makeChildWidgets(); };

// ---------------------------------------------------------------------------
// DynamicWidget — grammar-meme extension (renders children)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DynamicWidget(this: any, parseTreeNode: any, options: any) {
  this.initialise(parseTreeNode, options);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
DynamicWidget.prototype.render = function (parent: any, nextSibling: any) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("span");
  el.setAttribute("data-lar-kind",  "dynamic");
  el.setAttribute("data-lar-sigil", this.parseTreeNode?.tag ?? "");
  parent.appendChild(el);
  this.domNodes = [el];
  this.renderChildren(el, nextSibling);
};
DynamicWidget.prototype.execute = function () { this.makeChildWidgets(); };

// ---------------------------------------------------------------------------
// HeaderWidget — <<~ ? -> lar:///URI >> (no visible output)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function HeaderWidget(this: any, parseTreeNode: any, options: any) {
  this.initialise(parseTreeNode, options);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
HeaderWidget.prototype.render = function (parent: any, _nextSibling: any) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("meta");
  el.setAttribute("data-lar-kind", "header");
  el.setAttribute("data-lar-uri",  this.getAttribute("uri", ""));
  parent.appendChild(el);
  this.domNodes = [el];
};
HeaderWidget.prototype.execute = function () { this.makeChildWidgets(); };

// ---------------------------------------------------------------------------
// DispatchWidget — lele fire-and-forget (no visible output)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DispatchWidget(this: any, parseTreeNode: any, options: any) {
  this.initialise(parseTreeNode, options);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
DispatchWidget.prototype.render = function (parent: any, _nextSibling: any) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("meta");
  el.setAttribute("data-lar-kind",   "dispatch");
  el.setAttribute("data-lar-target", this.getAttribute("target", ""));
  parent.appendChild(el);
  this.domNodes = [el];
};
DispatchWidget.prototype.execute = function () { this.makeChildWidgets(); };

// ---------------------------------------------------------------------------
// Factory — returns all widget constructors, no prototype wiring.
// Prototype chain is set by LarariumTW5._registerWidgets() after boot.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLarariumWidgets(_tw: any): Record<string, WidgetCtor> {
  return {
    "lararium-worksite": WorksiteWidget as WidgetCtor,
    "lararium-edge":     EdgeWidget     as WidgetCtor,
    "lararium-toml":     TomlWidget     as WidgetCtor,
    "lararium-sigil":    SigilWidget    as WidgetCtor,
    "lararium-dynamic":  DynamicWidget  as WidgetCtor,
    "lararium-header":   HeaderWidget   as WidgetCtor,
    "lararium-dispatch": DispatchWidget as WidgetCtor,
  };
}

// ---------------------------------------------------------------------------
// Widget tiddler — lar:/// URI title; lives in the corpus graph.
// module-type: widget enables future plugin-mode distribution.
// ---------------------------------------------------------------------------

export const LARARIUM_WIDGETS_TIDDLER = {
  title:         "lar:///lararium-node/tw5/widgets",
  type:          "application/javascript",
  "module-type": "widget",
  tags:          ["$:/tags/Global"],
  text:          "// Lararium widget bindings — registered via LarariumTW5._registerWidgets()",
  role:          "tw5-widget-module",
  cacheable:     "true",
  hydrate:       "true",
} as const;
