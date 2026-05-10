/**
 * AkaWidget — TW5 widget for the `<<~ aka <uri> >>` URI sigil (shadow
 * transclusion / observe edge).
 *
 * Architecture mirrors AhuWidget: the widget owns no scope decision. The
 * cascade `$:/tags/Lar/AkaTemplate` selects the active render template;
 * the widget transcludes it with `currentTiddler` set to the aka target
 * URI. Operators override per-wiki by writing tiddlers tagged
 * `$:/tags/Lar/AkaTemplate`.
 *
 * Default cascade entries (cf. tw5-widgets.ts):
 *   - lar:///config/Lar/AkaTemplate/markdown-meme — disk-export form;
 *     emits the literal `<<~ aka {{!!aka-uri}} >>` source slice.
 *   - lar:///config/Lar/AkaTemplate/html — live-UI form; transcludes the
 *     URI's content frozen-at-render-time (TW5 transclusion already
 *     captures content at parse time per its semantics).
 *
 * Module-type: widget. Exported under tag name `aka` for the tag
 * `<$aka uri="..."/>` form.
 */

import type {
  TW5WidgetInstance, TW5ParseTreeNode, TW5FakeElement, TW5ChangeRecord,
} from "../types/tiddlywiki.js";

declare const require: (id: string) => { widget: { prototype: object } };
const Widget = require("$:/core/modules/widgets/widget.js").widget;

const CASCADE_FILTER =
  "[all[shadows+tiddlers]tag[$:/tags/Lar/AkaTemplate]!is[draft]] :map:flat[subfilter{!!text}] +[first[]]";

const FALLBACK_TEMPLATE = "lar:///ha.ka.ba/@lararium/templates/aka/html";

function AkaWidget(
  this:          TW5WidgetInstance,
  parseTreeNode: TW5ParseTreeNode,
  options:       Record<string, unknown>,
) {
  this.initialise(parseTreeNode, options);
}

AkaWidget.prototype = Object.create(Widget.prototype) as TW5WidgetInstance;

AkaWidget.prototype.render = function (
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

  // Subtree:
  //   <$set name="aka-uri" value=<<targetUri>>>
  //     <$tiddler tiddler=<<targetUri>>>
  //       <$transclude $tiddler=<<template>>/>
  //     </$tiddler>
  //   </$set>
  // The `aka-uri` variable carries the source URI verbatim so the
  // markdown-meme template can reconstruct the literal sigil source on
  // disk projection.
  const subtree: TW5ParseTreeNode = {
    type: "set",
    attributes: {
      name:  { type: "string", value: "aka-uri" },
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

  const placeholder = this.document.createTextNode(`? aka ${targetUri}`);
  parent.insertBefore(placeholder, nextSibling);
  this.domNodes = [placeholder as unknown as TW5FakeElement];
};

AkaWidget.prototype.execute = function (this: TW5WidgetInstance): void {
  // Children built in render(); no parse-tree body to walk.
};

AkaWidget.prototype.refresh = function (
  this:            TW5WidgetInstance,
  changedTiddlers: Record<string, TW5ChangeRecord>,
): boolean {
  const targetUri = this.getAttribute("uri", "");
  if (changedTiddlers[targetUri]) {
    this.refreshSelf();
    return true;
  }
  for (const t of Object.keys(changedTiddlers)) {
    if (t.startsWith("lar:///config/Lar/AkaTemplate")) {
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

export { AkaWidget as aka };
