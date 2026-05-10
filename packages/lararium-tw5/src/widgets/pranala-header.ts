/**
 * PranalaHeaderWidget — TW5 widget for `<<~ ? -> uri >>`, the carrier-to-
 * canonical edge declared at the top of a meme.
 *
 * Same template-cascade architecture as AhuWidget / AkaWidget. The cascade
 * `$:/tags/Lar/PranalaHeaderTemplate` selects the active render template;
 * the widget binds `pranala-header-uri` to the source URI and transcludes.
 *
 * Default cascade entries:
 *   - lar:///config/Lar/PranalaHeaderTemplate/markdown-meme — emits
 *     `<<~ ? -> <<pranala-header-uri>> >>` for disk round-trip.
 *   - lar:///config/Lar/PranalaHeaderTemplate/html — renders a small
 *     `.lar-pranala-header` anchor pointing at the canonical URI.
 */

import type {
  TW5WidgetInstance, TW5ParseTreeNode, TW5FakeElement, TW5ChangeRecord,
} from "../types/tiddlywiki.js";

declare const require: (id: string) => { widget: { prototype: object } };
const Widget = require("$:/core/modules/widgets/widget.js").widget;

const CASCADE_FILTER =
  "[all[shadows+tiddlers]tag[$:/tags/Lar/PranalaHeaderTemplate]!is[draft]] :map:flat[subfilter{!!text}] +[first[]]";

const FALLBACK_TEMPLATE = "lar:///ha.ka.ba/@lararium/templates/pranala-header/html";

function PranalaHeaderWidget(
  this:          TW5WidgetInstance,
  parseTreeNode: TW5ParseTreeNode,
  options:       Record<string, unknown>,
) {
  this.initialise(parseTreeNode, options);
}

PranalaHeaderWidget.prototype = Object.create(Widget.prototype) as TW5WidgetInstance;

PranalaHeaderWidget.prototype.render = function (
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
      name:  { type: "string", value: "pranala-header-uri" },
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

  const placeholder = this.document.createTextNode(`? -> ${targetUri}`);
  parent.insertBefore(placeholder, nextSibling);
  this.domNodes = [placeholder as unknown as TW5FakeElement];
};

PranalaHeaderWidget.prototype.execute = function (this: TW5WidgetInstance): void {
  // Cascade-resolved children built in render().
};

PranalaHeaderWidget.prototype.refresh = function (
  this:            TW5WidgetInstance,
  changedTiddlers: Record<string, TW5ChangeRecord>,
): boolean {
  for (const t of Object.keys(changedTiddlers)) {
    if (t.startsWith("lar:///config/Lar/PranalaHeaderTemplate")) {
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

export { PranalaHeaderWidget as "pranala-header" };
