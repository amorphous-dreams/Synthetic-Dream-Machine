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
  const propsRaw   = this.getAttribute("propsRaw", "");
  const carrierUri = this.getVariable?.("currentTiddler") ?? "";

  // Instance URI: carrierUri#fragment (auto-generate UUID stub if no fragment)
  const instanceFrag = fragment || `inst-${Math.random().toString(36).slice(2, 10)}`;
  const instanceUri  = carrierUri ? `${carrierUri}#${instanceFrag}` : `#${instanceFrag}`;

  // UUID write-back stub — fires hook on first render when fragment was absent
  if (!fragment && _kauWriteBackHook && carrierUri) {
    _kauWriteBackHook(carrierUri, instanceFrag);
  }

  // Keyhive capability stub — establishes instance-scoped authority
  if (_kauCapabilityHook) {
    _kauCapabilityHook(instanceUri);
  }

  // Resolve kumu definition
  const results: string[] = this.wiki?.filterTiddlers?.(
    `[all[tiddlers]tag[$:/tags/LarariumKumu]field:kumu-name[${name}]]`
  ) ?? [];
  const defUri = results[0] ?? "";

  const el = this.document.createElement("div");
  el.setAttribute("data-lar-kind",     "kau");
  el.setAttribute("data-lar-name",     name);
  el.setAttribute("data-lar-instance", instanceUri);
  el.setAttribute("data-lar-resolved", defUri ? "true" : "false");
  parent.appendChild(el);
  this.domNodes = [el];

  if (defUri) {
    // Parse "key:value key:value" props into TW5 variables
    const propRe = /([\w-]+):(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = propRe.exec(propsRaw)) !== null) {
      this.setVariable(m[1]!, m[2]!);
    }
    // Inject instance URI as currentTiddler so kumu body sees its own address
    this.setVariable("currentTiddler", instanceUri);
    const transclude = this.wiki?.makeTranscludeWidget(defUri, {
      document:     this.document,
      parentWidget: this,
    });
    if (transclude) {
      transclude.render(el, null);
      this.children = [transclude];
    }
  } else {
    const hole = this.document.createElement("span");
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
