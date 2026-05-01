import type { TW5WidgetInstance, TW5ParseTreeNode, TW5FakeElement, TW5ChangeRecord } from "../types/tiddlywiki.js";
import { dispatchSlotRenderMode } from "./render-modes.js";

export function AhuWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}

AhuWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();

  const slot       = this.getAttribute("slot", "");
  const renderMode = this.getVariable?.("lar-render-mode") ?? "";
  const parentUri  = this.getVariable?.("currentTiddler") ?? "";
  const childUri   = this.getAttribute("uri", "") || (parentUri + slot);

  const modeResult = dispatchSlotRenderMode(renderMode, {
    sigil:    "ahu",
    slot,
    childUri,
    wiki:     this.wiki!,
    document: this.document,
  });

  if (modeResult !== null) {
    const text = this.document.createTextNode(modeResult.raw);
    parent.insertBefore(text, nextSibling);
    this.domNodes = [text as unknown as TW5FakeElement];
    return;
  }

  // ── HTML render mode ──────────────────────────────────────────────────────
  // Transclude the stored child tiddler (uri#slot) as currentTiddler.
  // This is the TW5 <$tiddler tiddler="uri#slot"><$transclude/></$tiddler> pattern:
  //   - View: renders child tiddler body (also text/x-memetic-wikitext via MemeticParser)
  //   - Edit: TW5 draft of uri#slot → memetic-wikitext slot body as editing surface
  //   - Nested ahu → nested transclusions → nested edit UX automatically
  //
  // The inline parse tree children (from carrier body) are intentionally not rendered here.
  // They are the import source that populated the child tiddler; the child tiddler is
  // authoritative at render time.

  const el = this.document.createElement("section");
  el.setAttribute("data-lar-kind", "ahu");
  el.setAttribute("data-lar-slot", slot);
  el.setAttribute("data-lar-uri",  childUri);
  parent.appendChild(el);
  this.domNodes = [el];

  if (!childUri) {
    const hole = this.document.createElement("span");
    hole.setAttribute("data-lar-kind", "hole");
    hole.textContent = `? ahu ${slot}`;
    el.appendChild(hole);
    return;
  }

  // Push child URI as currentTiddler so nested ahu transclusions have the right context.
  this.setVariable?.("currentTiddler", childUri);

  const transclude = this.wiki?.makeTranscludeWidget?.(childUri, {
    document:     this.document,
    parentWidget: this,
  });

  if (transclude) {
    transclude.render(el, null);
    this.children = [transclude];
  } else {
    const hole = this.document.createElement("span");
    hole.setAttribute("data-lar-kind", "hole");
    hole.textContent = `? ahu ${slot}`;
    el.appendChild(hole);
  }
};

AhuWidget.prototype.execute = function (this: TW5WidgetInstance) {
  // Children are managed imperatively in render; no makeChildWidgets needed.
};

AhuWidget.prototype.refresh = function (this: TW5WidgetInstance, changedTiddlers: Record<string, TW5ChangeRecord>): boolean {
  const slot      = this.getAttribute("slot", "");
  const childUri  = this.getAttribute("uri", "");
  const parentUri = this.getVariable?.("currentTiddler") ?? "";
  const fragUri   = childUri || (parentUri + slot);

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
