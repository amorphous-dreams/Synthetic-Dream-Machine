import type { TW5WidgetInstance, TW5ParseTreeNode, TW5FakeElement, TW5ChangeRecord } from "../types/tiddlywiki.js";

// Keyhive stub: when WASM lands, this hook accepts the instance URI as a UCAN
// resource string and returns a capability envelope for the instance scope.
// Document-scoped authority used until then.
type KauCapabilityHook = (instanceUri: string) => unknown;
let _kauCapabilityHook: KauCapabilityHook | null = null;
export function registerKauCapabilityHook(hook: KauCapabilityHook): void {
  _kauCapabilityHook = hook;
}

// Keyhive stub: UUID write-back. On first placement commit, write the generated
// #fragment back into the carrier text so the instance has a stable URI.
// Only fires on the placement path (attrs.fragment present or auto-generated).
type KauWriteBackHook = (carrierUri: string, fragment: string) => void;
let _kauWriteBackHook: KauWriteBackHook | null = null;
export function registerKauWriteBackHook(hook: KauWriteBackHook): void {
  _kauWriteBackHook = hook;
}

export function KauWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}

KauWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();

  const fragment   = this.getAttribute("fragment", "");
  const name       = this.getAttribute("name", "");
  const args       = this.getAttribute("args", "");
  const propsRaw   = this.getAttribute("propsRaw", "");
  const carrierUri = this.getVariable?.("currentTiddler") ?? "";

  // Disambiguate by #fragment presence — same split the parser makes.
  //
  // Invocation path (no fragment): <<~ kau name(args) >>
  //   Equivalent to TW5's <$tiddler tiddler="name"><$transclude/></$tiddler>
  //   Renders the kumu def in caller's currentTiddler context (name-shifted, not instance-shifted).
  //   No UUID, no write-back, no capability hook.
  //
  // Placement path (#fragment present or auto-generated): <<~ kau #frag Name props >>
  //   Equivalent to <$tiddler tiddler="carrierUri#frag"><$transclude tiddler="name-def"/></$tiddler>
  //   Renders the kumu def in the INSTANCE's identity (carrierUri#frag as currentTiddler).
  //   UUID write-back fires if fragment was auto-generated.
  //   Keyhive capability hook fires with instance URI as UCAN resource.

  if (!fragment) {
    // ── Invocation path ──────────────────────────────────────────────────────
    // Equivalent to TW5's <$tiddler tiddler="name"><$transclude/></$tiddler>
    // currentTiddler stays as the CALLER's context — no new identity, no UUID.
    renderInvocation(this, parent, name, args);
    return;
  }

  // ── Placement path ───────────────────────────────────────────────────────
  const instanceFrag = fragment || `inst-${Math.random().toString(36).slice(2, 10)}`;
  const instanceUri  = carrierUri ? `${carrierUri}#${instanceFrag}` : `#${instanceFrag}`;

  // UUID write-back: fires only when fragment was auto-generated (no explicit #frag in source)
  if (!fragment && _kauWriteBackHook && carrierUri) {
    _kauWriteBackHook(carrierUri, instanceFrag);
  }

  // Keyhive capability stub — instance URI becomes UCAN resource for per-instance grants
  if (_kauCapabilityHook) {
    _kauCapabilityHook(instanceUri);
  }

  renderPlacement(this, parent, name, propsRaw, instanceUri);
};

function renderInvocation(
  widget: TW5WidgetInstance,
  parent: TW5FakeElement,
  name: string,
  args: string,
) {
  const results: string[] = widget.wiki?.filterTiddlers?.(
    `[all[tiddlers]tag[$:/tags/LarariumKumu]field:kumu-name[${name}]]`
  ) ?? [];
  const defUri = results[0] ?? "";

  const el = widget.document.createElement("div");
  el.setAttribute("data-lar-kind", "kau-invoke");
  el.setAttribute("data-lar-name", name);
  parent.appendChild(el);
  widget.domNodes = [el];

  if (defUri) {
    // Parse "key:value" args — shadow into caller's context (not a new scope)
    const argRe = /([\w-]+):(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = argRe.exec(args)) !== null) {
      widget.setVariable(m[1]!, m[2]!);
    }
    // currentTiddler stays as the CALLER's — this is the invocation-in-caller-context path
    const transclude = widget.wiki?.makeTranscludeWidget(defUri, {
      document:     widget.document,
      parentWidget: widget,
    });
    if (transclude) {
      transclude.render(el, null);
      widget.children = [transclude];
    }
  } else {
    const hole = widget.document.createElement("span");
    hole.setAttribute("data-lar-kind", "hole");
    hole.textContent = `? kau ${name}`;
    el.appendChild(hole);
  }
}

function renderPlacement(
  widget: TW5WidgetInstance,
  parent: TW5FakeElement,
  name: string,
  propsRaw: string,
  instanceUri: string,
) {
  const results: string[] = widget.wiki?.filterTiddlers?.(
    `[all[tiddlers]tag[$:/tags/LarariumKumu]field:kumu-name[${name}]]`
  ) ?? [];
  const defUri = results[0] ?? "";

  const el = widget.document.createElement("div");
  el.setAttribute("data-lar-kind",     "kau-place");
  el.setAttribute("data-lar-name",     name);
  el.setAttribute("data-lar-instance", instanceUri);
  el.setAttribute("data-lar-resolved", defUri ? "true" : "false");
  parent.appendChild(el);
  widget.domNodes = [el];

  if (defUri) {
    // Parse "key:value" props — static wiring, equivalent to UEFN @editable panel
    const propRe = /([\w-]+):(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = propRe.exec(propsRaw)) !== null) {
      widget.setVariable(m[1]!, m[2]!);
    }
    // Push instance URI as currentTiddler — the placement context shift.
    // This is the <$tiddler tiddler="instanceUri"> wrapper in TW5 terms.
    widget.setVariable("currentTiddler", instanceUri);
    const transclude = widget.wiki?.makeTranscludeWidget(defUri, {
      document:     widget.document,
      parentWidget: widget,
    });
    if (transclude) {
      transclude.render(el, null);
      widget.children = [transclude];
    }
  } else {
    const hole = widget.document.createElement("span");
    hole.setAttribute("data-lar-kind", "hole");
    hole.textContent = `? kau ${name}`;
    el.appendChild(hole);
  }
};

KauWidget.prototype.execute = function (this: TW5WidgetInstance) { /* children managed in render */ };

KauWidget.prototype.refresh = function (this: TW5WidgetInstance, changedTiddlers: Record<string, TW5ChangeRecord>): boolean {
  let changed = false;
  for (const child of (this.children ?? [])) {
    if (child.refresh(changedTiddlers)) changed = true;
  }
  return changed;
};
