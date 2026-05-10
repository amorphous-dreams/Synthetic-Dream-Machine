/**
 * LoulouWidget — TW5 widget for `<<~ loulou <uri> >>` URI-form sigil
 * (bidirectional relation edge sugar; equivalent to pranala family=relation).
 *
 * Same template-cascade architecture. Distinguished from aka/kahea by
 * semantic role: loulou names a bidirectional relation, no transclusion of
 * target body. Default html template emits a plain link annotated with the
 * relation kind.
 */

import type {
  TW5WidgetInstance, TW5ParseTreeNode, TW5FakeElement, TW5ChangeRecord,
} from "../types/tiddlywiki.js";

declare const require: (id: string) => { widget: { prototype: object } };
const Widget = require("$:/core/modules/widgets/widget.js").widget;

const CASCADE_FILTER =
  "[all[shadows+tiddlers]tag[$:/tags/Lar/LoulouTemplate]!is[draft]] :map:flat[subfilter{!!text}] +[first[]]";

const FALLBACK_TEMPLATE = "lar:///ha.ka.ba/@lararium/templates/loulou/html";

function LoulouWidget(
  this:          TW5WidgetInstance,
  parseTreeNode: TW5ParseTreeNode,
  options:       Record<string, unknown>,
) {
  this.initialise(parseTreeNode, options);
}

LoulouWidget.prototype = Object.create(Widget.prototype) as TW5WidgetInstance;

LoulouWidget.prototype.render = function (
  this:        TW5WidgetInstance,
  parent:      TW5FakeElement,
  nextSibling: TW5FakeElement | null,
) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();

  const targetUri = this.getAttribute("uri", "");

  const cascadeMatches = this.wiki?.filterTiddlers?.(CASCADE_FILTER, this) ?? [];
  const template       = cascadeMatches[0] || FALLBACK_TEMPLATE;

  const subtree: TW5ParseTreeNode = {
    type: "set",
    attributes: {
      name:  { type: "string", value: "loulou-uri" },
      value: { type: "string", value: targetUri },
    },
    children: [
      {
        type: "transclude",
        attributes: {
          $tiddler: { type: "string", value: template },
        },
        children: [],
      },
    ],
  };

  const childWidget = this.makeChildWidget?.(subtree, undefined);
  if (childWidget) {
    childWidget.render(parent, nextSibling);
    this.children = [childWidget];
    return;
  }

  const placeholder = this.document.createTextNode(`<-> loulou ${targetUri}`);
  parent.insertBefore(placeholder, nextSibling);
  this.domNodes = [placeholder as unknown as TW5FakeElement];
};

LoulouWidget.prototype.execute = function (this: TW5WidgetInstance): void {};

LoulouWidget.prototype.refresh = function (
  this:            TW5WidgetInstance,
  changedTiddlers: Record<string, TW5ChangeRecord>,
): boolean {
  for (const t of Object.keys(changedTiddlers)) {
    if (t.startsWith("lar:///config/Lar/LoulouTemplate")) {
      this.refreshSelf();
      return true;
    }
  }
  let changed = false;
  for (const child of this.children ?? []) {
    if (child.refresh(changedTiddlers)) changed = true;
  }
  return changed;
};

export { LoulouWidget as loulou };
