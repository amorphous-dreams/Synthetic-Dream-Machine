/**
 * PranalaWidget — TW5 widget for the pranala edge sigil.
 *
 * Two surface forms share the widget:
 *   Inline:  `<<~ pranala #name? <from> -> <to> [family:f] [role:r] >>`
 *   Block:   `<<~ pranala #name? <from> -> <to> >>body<<~/pranala >>`
 *
 * Same template-cascade architecture as the URI-form sigils. The cascade
 * `$:/tags/Lar/PranalaTemplate` selects the active render template; the
 * widget binds `pranala-from`, `pranala-to`, `pranala-slot`, `pranala-body`,
 * and any extra attributes (family / role / etc.) as variables, then
 * transcludes the cascade-resolved template.
 *
 * The presence of a non-empty `body` distinguishes block from inline at
 * render time — operators may write a single template that branches on
 * `<<pranala-body>>`, or register separate cascade entries for each form.
 */

import type {
  TW5WidgetInstance, TW5ParseTreeNode, TW5FakeElement, TW5ChangeRecord,
} from "../types/tiddlywiki.js";

declare const require: (id: string) => { widget: { prototype: object } };
const Widget = require("$:/core/modules/widgets/widget.js").widget;

const CASCADE_FILTER =
  "[all[shadows+tiddlers]tag[$:/tags/Lar/PranalaTemplate]!is[draft]] :map:flat[subfilter{!!text}] +[first[]]";

const FALLBACK_TEMPLATE = "lar:///ha.ka.ba/@lararium/templates/pranala/html";

function PranalaWidget(
  this:          TW5WidgetInstance,
  parseTreeNode: TW5ParseTreeNode,
  options:       Record<string, unknown>,
) {
  this.initialise(parseTreeNode, options);
}

PranalaWidget.prototype = Object.create(Widget.prototype) as TW5WidgetInstance;

PranalaWidget.prototype.render = function (
  this:        TW5WidgetInstance,
  parent:      TW5FakeElement,
  nextSibling: TW5FakeElement | null,
) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();

  const slot   = this.getAttribute("slot",   "");
  const from   = this.getAttribute("from",   "");
  const to     = this.getAttribute("to",     "");
  const body   = this.getAttribute("body",   "");
  const family = this.getAttribute("family", "");
  const role   = this.getAttribute("role",   "");

  const cascadeMatches = this.wiki?.filterTiddlers?.(CASCADE_FILTER, this) ?? [];
  const template       = cascadeMatches[0] || FALLBACK_TEMPLATE;

  // Wrap each variable in its own <$set> so all bindings are visible to
  // the transcluded template. Nested set widgets compose left-to-right.
  const wrap = (name: string, value: string, inner: TW5ParseTreeNode): TW5ParseTreeNode => ({
    type: "set",
    attributes: {
      name:  { type: "string", value: name },
      value: { type: "string", value },
    },
    children: [inner],
  });
  const transclude: TW5ParseTreeNode = {
    type: "transclude",
    attributes: {
      $tiddler: { type: "string", value: template },
    },
    children: [],
  };
  const subtree =
    wrap("pranala-slot",   slot,
    wrap("pranala-from",   from,
    wrap("pranala-to",     to,
    wrap("pranala-body",   body,
    wrap("pranala-family", family,
    wrap("pranala-role",   role,
      transclude
    ))))));

  const childWidget = this.makeChildWidget?.(subtree, undefined);
  if (childWidget) {
    childWidget.render(parent, nextSibling);
    this.children = [childWidget];
    return;
  }

  const placeholder = this.document.createTextNode(`pranala ${from} -> ${to}`);
  parent.insertBefore(placeholder, nextSibling);
  this.domNodes = [placeholder as unknown as TW5FakeElement];
};

PranalaWidget.prototype.execute = function (this: TW5WidgetInstance): void {};

PranalaWidget.prototype.refresh = function (
  this:            TW5WidgetInstance,
  changedTiddlers: Record<string, TW5ChangeRecord>,
): boolean {
  for (const t of Object.keys(changedTiddlers)) {
    if (t.startsWith("lar:///config/Lar/PranalaTemplate")) {
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

export { PranalaWidget as pranala };
