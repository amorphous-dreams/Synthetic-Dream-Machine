/**
 * tw5-widgets — native TW5 widget classes for all memetic-wikitext node types.
 *
 * createLarariumWidgets() returns plain constructor functions with no prototype
 * wiring. LarariumTW5._registerWidgets() sets up the TW5 Widget prototype chain
 * after boot, when the real Widget base class is available.
 *
 * Messaging + kumu are first-class TW5 widget citizens — not a parallel tree:
 *   lararium-worksite  → WorksiteWidget   ahu socket section (<span data-lar-slot>)
 *   lararium-edge      → EdgeWidget       pranala metadata (<meta data-lar-*>)
 *   lararium-papalohe  → PapaloheWidget   reaction wire metadata (<meta data-lar-kind=papalohe>)
 *   lararium-kukali    → KukaliWidget     suspend posture (<span data-lar-kind=kukali>)
 *   lararium-kumu      → KumuWidget       device instance — looks up def via wiki variable,
 *                                          renders body; execution hook fires here
 *   lararium-toml      → TomlWidget       data block (<script type=application/toml>)
 *   lararium-sigil     → SigilWidget      generic sigil container
 *   lararium-dynamic   → DynamicWidget    grammar-meme extension
 *   lararium-header    → HeaderWidget     carrier header (<meta data-lar-uri>)
 *   lararium-dispatch  → DispatchWidget   lele fire-and-forget (<meta data-lar-target>)
 *
 * KumuWidget execution model:
 *   On render, KumuWidget reads the kumu def name from its parse tree node,
 *   emits a structural div, and records the instance in a wiki variable
 *   ("$lar-kumu-instances") for downstream KumuExecutor wiring. The actual
 *   async execution (kukali suspensions, reaction subscriptions) is driven by
 *   the ReactionGraph injected via the "lararium-reaction-graph" wiki variable.
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
// PapaloheWidget — reaction family edge (trigger label at source, fn at target)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PapaloheWidget(this: any, parseTreeNode: any, options: any) {
  this.initialise(parseTreeNode, options);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
PapaloheWidget.prototype.render = function (parent: any, _nextSibling: any) {
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
PapaloheWidget.prototype.execute = function () { this.makeChildWidgets(); };

// ---------------------------------------------------------------------------
// KukaliWidget — reactive wait posture (Verse `suspends` analogue)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function KukaliWidget(this: any, parseTreeNode: any, options: any) {
  this.initialise(parseTreeNode, options);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
KukaliWidget.prototype.render = function (parent: any, _nextSibling: any) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("span");
  el.setAttribute("data-lar-kind",    "kukali");
  el.setAttribute("data-lar-trigger", this.getAttribute("trigger", ""));
  parent.appendChild(el);
  this.domNodes = [el];
};
KukaliWidget.prototype.execute = function () { this.makeChildWidgets(); };

// ---------------------------------------------------------------------------
// KumuWidget — kumu device instance (name + resolved props + body slot)
// Equivalent to a UEFN creative_device instance in the scene.
//
// Execution model:
//   render() emits the structural div, then pushes { name, props, el } into
//   the "$lar-kumu-instances" wiki variable (an array stored on the wiki object).
//   LarariumTW5.renderMeme() reads that array after render and wires each
//   instance to a KumuExecutor bound to the injected ReactionGraph.
//
//   resolved attr: "true" when the kumu def is in the registry; "false" = typed hole.
//   Props are encoded as the raw args string from the kahea-call sigil.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function KumuWidget(this: any, parseTreeNode: any, options: any) {
  this.initialise(parseTreeNode, options);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
KumuWidget.prototype.render = function (parent: any, nextSibling: any) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const name  = this.getAttribute("name", "");
  const props = this.getAttribute("props", "");
  // Resolve kumu def from TW5 wiki — injected by LarariumTW5.injectKumuDefs().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defTiddler = (this.wiki as any)?.getTiddler?.(`lar:///kumu/${name}`);
  const resolved   = defTiddler ? "true" : "false";

  const el = this.document.createElement("div");
  el.setAttribute("data-lar-kind",     "kumu");
  el.setAttribute("data-lar-name",     name);
  el.setAttribute("data-lar-props",    props);
  el.setAttribute("data-lar-resolved", resolved);
  parent.appendChild(el);
  this.domNodes = [el];
  this.renderChildren(el, nextSibling);

  // Record this instance for KumuExecutor wiring after render completes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wiki = (this.wiki as any);
  if (wiki) {
    wiki._larKumuInstances ??= [];
    wiki._larKumuInstances.push({ name, props, el });
  }
};
KumuWidget.prototype.execute = function () { this.makeChildWidgets(); };

// ---------------------------------------------------------------------------
// Factory — returns all widget constructors, no prototype wiring.
// Prototype chain is set by LarariumTW5._registerWidgets() after boot.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLarariumWidgets(_tw: any): Record<string, WidgetCtor> {
  return {
    "lararium-worksite":  WorksiteWidget  as WidgetCtor,
    "lararium-edge":      EdgeWidget      as WidgetCtor,
    "lararium-toml":      TomlWidget      as WidgetCtor,
    "lararium-sigil":     SigilWidget     as WidgetCtor,
    "lararium-dynamic":   DynamicWidget   as WidgetCtor,
    "lararium-header":    HeaderWidget    as WidgetCtor,
    "lararium-dispatch":  DispatchWidget  as WidgetCtor,
    "lararium-papalohe":  PapaloheWidget  as WidgetCtor,
    "lararium-kukali":    KukaliWidget    as WidgetCtor,
    "lararium-kumu":      KumuWidget      as WidgetCtor,
  };
}

// ---------------------------------------------------------------------------
// Widget tiddler — lar:/// URI title; lives in the corpus graph.
// module-type: widget enables future plugin-mode distribution.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// implementors filter operator — exact-token match on a space-separated list field.
//
// Usage: [all[tiddlers]implementors[lar:///ha.ka.ba/api/v0.1/lararium/tw5-module]]
//
// TW5's built-in field: operator does substring matching, which breaks when one
// URI is a prefix of another. This operator uses $tw.utils.parseStringArray for
// exact token matching, making implements lists safe regardless of URI structure.
//
// Registered as module-type: "filteroperator" via the IIFE bundle at boot.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerImplementorsOperator(tw: any): void {
  if (!tw?.filterOperators) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tw.filterOperators["implementors"] = function (source: any, operator: any) {
    const target  = operator.operand ?? "";
    const results: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    source(function (tiddler: any, title: string) {
      if (!tiddler) return;
      const raw: string = tiddler.fields?.["implements"] ?? "";
      const tokens: string[] = tw.utils.parseStringArray(raw) ?? [];
      if (tokens.includes(target)) results.push(title);
    });
    return results;
  };
}

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
