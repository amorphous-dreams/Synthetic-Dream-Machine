/**
 * KaheaWidget — TW5 widget for `<<~ kahea <uri> >>` URI-form sigil (live
 * transclusion / dataflow family).
 *
 * Same template-cascade architecture as AhuWidget / AkaWidget. The cascade
 * `$:/tags/Lar/KaheaTemplate` selects the active render template; the
 * widget binds `kahea-uri` to the source URI and transcludes.
 *
 * Distinguished from aka semantically — kahea = live transclusion (tracks
 * target edits), aka = frozen-at-projection-time. Both use TW5 transclusion
 * at render-time so the HTML output looks similar; the projection boundary
 * (kahea→aka substitution at disk-export time) is what makes them distinct
 * across the causal-island boundary.
 */

import type {
  TW5WidgetInstance, TW5ParseTreeNode, TW5FakeElement, TW5ChangeRecord,
} from "../types/tiddlywiki.js";

declare const require: (id: string) => { widget: { prototype: object } };
const Widget = require("$:/core/modules/widgets/widget.js").widget;

const CASCADE_FILTER =
  "[all[shadows+tiddlers]tag[$:/tags/Lar/KaheaTemplate]!is[draft]] :map:flat[subfilter{!!text}] +[first[]]";

const FALLBACK_TEMPLATE = "lar:///ha.ka.ba/@lararium/templates/kahea/html";

function KaheaWidget(
  this:          TW5WidgetInstance,
  parseTreeNode: TW5ParseTreeNode,
  options:       Record<string, unknown>,
) {
  this.initialise(parseTreeNode, options);
}

KaheaWidget.prototype = Object.create(Widget.prototype) as TW5WidgetInstance;

KaheaWidget.prototype.render = function (
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
      name:  { type: "string", value: "kahea-uri" },
      value: { type: "string", value: targetUri },
    },
    children: [
      {
        type: "tiddler",
        attributes: {
          tiddler: { type: "string", value: targetUri },
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
      },
    ],
  };

  const childWidget = this.makeChildWidget?.(subtree, undefined);
  if (childWidget) {
    childWidget.render(parent, nextSibling);
    this.children = [childWidget];
    return;
  }

  const placeholder = this.document.createTextNode(`! kahea ${targetUri}`);
  parent.insertBefore(placeholder, nextSibling);
  this.domNodes = [placeholder as unknown as TW5FakeElement];
};

KaheaWidget.prototype.execute = function (this: TW5WidgetInstance): void {};

KaheaWidget.prototype.refresh = function (
  this:            TW5WidgetInstance,
  changedTiddlers: Record<string, TW5ChangeRecord>,
): boolean {
  const targetUri = this.getAttribute("uri", "");
  if (changedTiddlers[targetUri]) {
    this.refreshSelf();
    return true;
  }
  for (const t of Object.keys(changedTiddlers)) {
    if (t.startsWith("lar:///config/Lar/KaheaTemplate")) {
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

export { KaheaWidget as kahea };
