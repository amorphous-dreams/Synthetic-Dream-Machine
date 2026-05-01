/**
 * tw5-widgets — native TW5 widget classes for all memetic-wikitext node types.
 *
 * createLarariumWidgets() returns plain constructor functions with no prototype
 * wiring. LarariumTW5._registerWidgets() sets up the TW5 Widget prototype chain
 * after boot, when the real Widget base class is available.
 *
 * Messaging + kumu are first-class TW5 widget citizens — not a parallel tree:
 *   ahu        → AhuWidget         <$ahu>       carrier slot — <<~ ahu #slot >> and <$ahu slot="#slot"> are equivalent
 *   edge       → EdgeWidget       <$edge>      pranala metadata
 *   papalohe   → PapaloheWidget   <$papalohe>  reaction wire metadata
 *   kukali     → KukaliWidget     <$kukali>    suspend posture
 *   kumu       → KumuWidget       <$kumu>      device instance (UEFN analogue)
 *   toml       → TomlWidget       <$toml>      data block
 *   sigil      → SigilWidget      <$sigil>     generic sigil container
 *   dynamic    → DynamicWidget    <$dynamic>   grammar-meme extension
 *   control    → ControlWidget    <$control>   phase boundary marker (no visible output)
 *   dispatch   → DispatchWidget   <$dispatch>  lele fire-and-forget
 *   ahu        → AhuWidget        <$ahu>       carrier slot — dual form of <<~ ahu #slot >>
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
// ControlWidget — SOH/STX/ETX/EOT phase boundary markers (no visible output)
// ---------------------------------------------------------------------------

function ControlWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
ControlWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.domNodes = [];
  // Phase markers carry no visible output — phase metadata lives in the AST.
};
ControlWidget.prototype.execute = function (this: TW5WidgetInstance) { /* no children */ };

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
// AhuWidget — <$ahu slot="#name"> carrier slot widget
//
// Dual surface: sigil form (<<~ ahu #slot >>) and widget form (<$ahu slot="#slot">)
// are semantically equivalent — both produce a worksite node in the parse tree.
// The widget form is TW5-native, so operators can mix TW5 and memetic grammar freely.
//
// HTML render mode: renders children (typically {{parentUri#slot}} transclusions)
// Carrier projection mode (lar-render-mode=carrier):
//   emits <<~ ahu #slot >> + live fragment body from wiki + <<~/ahu >>
//   This is the write-back projection path used by wiki.renderTiddler().
// ---------------------------------------------------------------------------

function AhuWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
AhuWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();

  const slot        = this.getAttribute("slot", "");
  const renderMode  = this.getVariable?.("lar-render-mode") ?? "";

  if (renderMode === "carrier") {
    // Carrier projection: reconstruct the <<~ ahu #slot >>...<<~/ahu >> syntax.
    // Read the live fragment body from the wiki — parentUri is currentTiddler.
    const parentUri   = this.getVariable?.("currentTiddler") ?? "";
    const fragmentUri = parentUri + slot;
    const fragFields  = this.wiki?.getTiddler?.(fragmentUri)?.fields as Record<string, unknown> | undefined;
    const body        = typeof fragFields?.["text"] === "string" ? fragFields["text"] : "";
    const open        = `<<~ ahu ${slot} >>`;
    const close       = `<<~/ahu >>`;
    const text        = this.document.createTextNode(open + body + close);
    parent.insertBefore(text, nextSibling);
    this.domNodes = [text as unknown as TW5FakeElement];
  } else {
    // HTML render: render children — the transclusion handles live slot content.
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
  const slot       = this.getAttribute("slot", "");
  const parentUri  = this.getVariable?.("currentTiddler") ?? "";
  const fragUri    = parentUri + slot;
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

// ---------------------------------------------------------------------------
// Factory — returns all widget constructors, no prototype wiring.
// Prototype chain is set by LarariumTW5._registerWidgets() after boot.
// Schema: lar:///ha.ka.ba/api/v0.1/lararium/modules/tw5-widgets
// ---------------------------------------------------------------------------

export function createLarariumWidgets(_tw: TW5Instance): Record<string, WidgetCtorWithProto> {
  return {
    "edge":       EdgeWidget      as unknown as WidgetCtorWithProto,
    "toml":       TomlWidget      as unknown as WidgetCtorWithProto,
    "sigil":      SigilWidget     as unknown as WidgetCtorWithProto,
    "dynamic":    DynamicWidget   as unknown as WidgetCtorWithProto,
    "control":    ControlWidget   as unknown as WidgetCtorWithProto,
    "dispatch":   DispatchWidget  as unknown as WidgetCtorWithProto,
    "papalohe":   PapaloheWidget  as unknown as WidgetCtorWithProto,
    "kukali":     KukaliWidget    as unknown as WidgetCtorWithProto,
    "kumu":       KumuWidget      as unknown as WidgetCtorWithProto,
    "ahu":        AhuWidget       as unknown as WidgetCtorWithProto,
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
        const v = tiddler.fields?.[`edge-out-${family}-${role}`];
        if (v !== undefined && v !== "") results.push(title);
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
