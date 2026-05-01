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
 * KumuWidget execution model (local-first Zelenka):
 *   On render, KumuWidget filters the wiki for tiddlers tagged $:/tags/LarariumKumu
 *   with field kumu-name matching the invocation name. Sets props as TW5 variables,
 *   then calls makeTranscludeWidget to render the def body inline. No external
 *   executor, no synthetic namespace. TW5 is the runtime — kumu execution IS
 *   TW5 transclusion. Kumu defs live as first-class memes in the tagspace.
 */

import type {
  TW5Instance,
  TW5WidgetInstance,
  TW5ParseTreeNode,
  TW5FakeElement,
  TW5FilterSource,
  TW5FilterOperator,
  TW5ChangeRecord,
} from "./types/tiddlywiki.js";

type WidgetCtor = (this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) => void;
type WidgetCtorWithProto = WidgetCtor & { prototype: Partial<TW5WidgetInstance> };

// ---------------------------------------------------------------------------
// WorksiteWidget — <<~ ahu #slot >> container
//
// Rendering policy: WorksiteWidget is a pure structural metadata anchor.
// Parent tiddler text = `{{||lar:///ha.ka.ba/.../templates/meme}}` — the template
// drives all slot rendering via $transclude on child tiddlers. WorksiteWidget
// emits only a data-attr span so CSS/JS can query slot boundaries; no children
// are rendered inline. This prevents double-render with the meme template.
// ---------------------------------------------------------------------------

function WorksiteWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
WorksiteWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("span");
  el.setAttribute("data-lar-kind", "worksite");
  el.setAttribute("data-lar-slot", this.getAttribute("slot", ""));
  el.setAttribute("data-lar-uri",  this.getAttribute("uri", ""));
  parent.appendChild(el);
  this.domNodes = [el];
  // No renderChildren — template handles all slot content.
};
WorksiteWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };

// ---------------------------------------------------------------------------
// EdgeWidget — pranala / edge-sugar (metadata; no visible output)
// ---------------------------------------------------------------------------

function EdgeWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
EdgeWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
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
EdgeWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };

// ---------------------------------------------------------------------------
// TomlWidget — iam / toml data block (metadata; no visible output)
// ---------------------------------------------------------------------------

function TomlWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
TomlWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
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
TomlWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };

// ---------------------------------------------------------------------------
// SigilWidget — generic canonical sigil (renders children)
// ---------------------------------------------------------------------------

function SigilWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
SigilWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, nextSibling: TW5FakeElement | null) {
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
SigilWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };

// ---------------------------------------------------------------------------
// DynamicWidget — grammar-meme extension (renders children)
// ---------------------------------------------------------------------------

function DynamicWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
DynamicWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, nextSibling: TW5FakeElement | null) {
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
DynamicWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };

// ---------------------------------------------------------------------------
// HeaderWidget — <<~ ? -> lar:///URI >> (no visible output)
// ---------------------------------------------------------------------------

function HeaderWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
HeaderWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("meta");
  el.setAttribute("data-lar-kind", "header");
  el.setAttribute("data-lar-uri",  this.getAttribute("uri", ""));
  parent.appendChild(el);
  this.domNodes = [el];
};
HeaderWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };

// ---------------------------------------------------------------------------
// DispatchWidget — lele fire-and-forget (no visible output)
// ---------------------------------------------------------------------------

function DispatchWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
DispatchWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("meta");
  el.setAttribute("data-lar-kind",   "dispatch");
  el.setAttribute("data-lar-target", this.getAttribute("target", ""));
  parent.appendChild(el);
  this.domNodes = [el];
};
DispatchWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };

// ---------------------------------------------------------------------------
// PapaloheWidget — reaction family edge (trigger label at source, fn at target)
// ---------------------------------------------------------------------------

function PapaloheWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
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

// ---------------------------------------------------------------------------
// KukaliWidget — reactive wait posture (Verse `suspends` analogue)
// ---------------------------------------------------------------------------

function KukaliWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
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

  // Call the kukali hook if registered — bridges to reactionGraph.subscribeOnce().
  // Hook is stored on $tw.wiki (same object as this.wiki in widget context)
  // by LarariumTW5.registerKukaliHook(), keeping the bridge import-free.
  const hook = this.wiki?._larKukaliHook;
  const uri  = this.getVariable?.("currentTiddler") ?? "";
  if (hook && uri && trigger) {
    const cancel = hook(uri, trigger);
    // Store cancel ref on element for potential future cleanup.
    if (typeof cancel === "function") (el as unknown as Record<string, unknown>)["_larKukaliCancel"] = cancel;
  }
};
KukaliWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };

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

function KumuWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
KumuWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const name   = this.getAttribute("name", "");
  const args   = this.getAttribute("props", "");
  // Resolve kumu def by name from the meme tagspace — any three-word-root space
  // with tag $:/tags/LarariumKumu and field kumu-name matching the invoked name.
  // Stable defs live at lar:///ha.ka.ba/...; drafts in chapel-perilous-opens/...
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
    // Parse "key:value key:value" args string into TW5 variables.
    // Prop names shadow any kumu-name collision per prop-shadow rule.
    const propRe = /([\w-]+):(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = propRe.exec(args)) !== null) {
      this.setVariable(m[1]!, m[2]!);
    }
    // Transclude the kumu def tiddler — TW5 renders its body as child widgets.
    const transclude = this.wiki?.makeTranscludeWidget(defUri, {
      document:     this.document,
      parentWidget: this,
    });
    if (transclude) {
      transclude.render(el, null);
      this.children = [transclude];
    }
  } else {
    // Typed hole — render label (unresolved kumu def).
    const hole = this.document.createElement("span");
    hole.setAttribute("data-lar-kind", "hole");
    hole.textContent = `? ${name}`;
    el.appendChild(hole);
  }
};
KumuWidget.prototype.execute = function (this: TW5WidgetInstance) { /* children managed in render */ };
KumuWidget.prototype.refresh = function (this: TW5WidgetInstance, changedTiddlers: Record<string, TW5ChangeRecord>): boolean {
  // Delegate refresh to the transclude child so def tiddler edits propagate.
  let changed = false;
  for (const child of (this.children ?? [])) {
    if (child.refresh(changedTiddlers)) changed = true;
  }
  return changed;
};

// ---------------------------------------------------------------------------
// Factory — returns all widget constructors, no prototype wiring.
// Prototype chain is set by LarariumTW5._registerWidgets() after boot.
// ---------------------------------------------------------------------------

export function createLarariumWidgets(_tw: TW5Instance): Record<string, WidgetCtorWithProto> {
  return {
    "lararium-worksite":  WorksiteWidget  as unknown as WidgetCtorWithProto,
    "lararium-edge":      EdgeWidget      as unknown as WidgetCtorWithProto,
    "lararium-toml":      TomlWidget      as unknown as WidgetCtorWithProto,
    "lararium-sigil":     SigilWidget     as unknown as WidgetCtorWithProto,
    "lararium-dynamic":   DynamicWidget   as unknown as WidgetCtorWithProto,
    "lararium-header":    HeaderWidget    as unknown as WidgetCtorWithProto,
    "lararium-dispatch":  DispatchWidget  as unknown as WidgetCtorWithProto,
    "lararium-papalohe":  PapaloheWidget  as unknown as WidgetCtorWithProto,
    "lararium-kukali":    KukaliWidget    as unknown as WidgetCtorWithProto,
    "lararium-kumu":      KumuWidget      as unknown as WidgetCtorWithProto,
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

export function registerImplementorsOperator(tw: TW5Instance): void {
  if (!tw?.filterOperators) return;

  // implementors[uri] — exact-token match on space-separated implements field
  tw.filterOperators["implementors"] = function (source: TW5FilterSource, operator: TW5FilterOperator) {
    const target  = operator.operand ?? "";
    const results: string[] = [];
    source(function (tiddler, title: string) {
      if (!tiddler) return;
      const raw: string = String(tiddler.fields?.["implements"] ?? "");
      const tokens: string[] = tw.utils.parseStringArray(raw) ?? [];
      if (tokens.includes(target)) results.push(title);
    });
    return results;
  };

  // edge:family[role] — filter tiddlers that have an edge-out field for family+role.
  // Translates the memetic-wikitext edge: filter syntax into a TW5-native operator.
  // edge:control[owns] → has[edge-out-control-owns]
  // edge:control[]     → any tiddler with any edge-out-control-* field
  tw.filterOperators["edge"] = function (source: TW5FilterSource, operator: TW5FilterOperator) {
    const family = operator.suffix ?? "";
    const role   = operator.operand ?? "";
    const results: string[] = [];
    source(function (tiddler, title: string) {
      if (!tiddler) return;
      if (role) {
        if (tiddler.fields?.[`edge-out-${family}-${role}`] !== undefined) results.push(title);
      } else {
        const prefix = `edge-out-${family}-`;
        if (Object.keys(tiddler.fields ?? {}).some((k) => k.startsWith(prefix))) results.push(title);
      }
    });
    return results;
  };

  // toml:key[val] — sugar for field:key[val]; lets memetic-wikitext filters use TOML
  // field names directly without renaming them or going through the preprocessor.
  // toml:register[CS] → tiddlers where the "register" field equals "CS"
  tw.filterOperators["toml"] = function (source: TW5FilterSource, operator: TW5FilterOperator) {
    const fieldName = operator.suffix ?? "";
    const value     = operator.operand ?? "";
    const results: string[] = [];
    source(function (tiddler, title: string) {
      if (!tiddler) return;
      const fv: string = String(tiddler.fields?.[fieldName] ?? "");
      if (fv === value) results.push(title);
    });
    return results;
  };

  // all[memes] — alias for all[tiddlers]; registers via TW5's allfilteroperator module type.
  // TW5's all.js uses applyMethods("allfilteroperator") lazily — inject before first use.
  if (tw?.modules?.types) {
    tw.modules.types["allfilteroperator"] = tw.modules.types["allfilteroperator"] ?? {};
    if (!tw.modules.types["allfilteroperator"]["memes"]) {
      tw.modules.types["allfilteroperator"]["memes"] = { moduleType: "allfilteroperator", definition: null, exports: { memes: function(_source: TW5FilterSource, _prefix: string, options: { wiki: { each: unknown } }) { return options.wiki.each; } } };
    }
  }
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
