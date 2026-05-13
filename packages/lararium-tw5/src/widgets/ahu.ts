/*\
title: lar:///ha.ka.ba/@lararium/tw5/widgets/ahu
type: application/javascript
module-type: widget
\*/
/**
 * AhuWidget — TW5 widget for the `ahu` sigil (slot reference / definition).
 *
 * Architecture (rewrite, no legacy code):
 *   The widget owns no render-mode dispatch. It computes the slot's child
 *   tiddler URI, then transcludes it through the cascade-resolved template.
 *   Template selection is data-driven: tiddlers tagged `$:/tags/Lar/AhuTemplate`
 *   form a TW5 cascade; each entry's text is a filter expression returning
 *   the template tiddler URI when the entry applies. The variable
 *   `lar-export-scope` lets callers select disk-export vs live-UI rendering
 *   without the widget knowing which is which.
 *
 *   Default cascade entries ship as .tid files in tiddlers/:
 *     - `ahu-cascade-markdown-meme.tid` — matches when
 *       `lar-export-scope=="markdown-meme"`, returns the disk-export template.
 *     - `ahu-cascade-html.tid` — fallback, always matches, returns
 *       the live-UI template.
 *
 *   The widget is intentionally thin: ~30 lines of logic. All grammar lives
 *   in the templates (memes at `lar:///ha.ka.ba/@lararium/templates/ahu/*`).
 *   Operators can override the cascade or templates per-wiki without
 *   recompiling TS.
 *
 * Parse tree shape (from MemeticParser):
 *   { type: "ahu", attributes: { slot, uri, invocation?, projection?, delegate? } }
 *
 * The `invocation` and `projection` flags from the AST are no longer
 * read — both forms render identically through the cascade. Operator-
 * authored shape distinctions belong in cascade entries (e.g. a future
 * `$:/config/Lar/AhuTemplate/projection` entry can match
 * `<lar-export-scope>match[projection]` and emit the aka shadow ref).
 */

import type {
  TW5WidgetInstance, TW5ParseTreeNode, TW5FakeElement, TW5ChangeRecord,
} from "../types/tiddlywiki.js";

declare const require: (id: string) => { widget: { prototype: object } };
const Widget = require("$:/core/modules/widgets/widget.js").widget;

const CASCADE_FILTER =
  "[all[shadows+tiddlers]tag[$:/tags/Lar/AhuTemplate]!is[draft]] :map:flat[subfilter{!!text}] +[first[]]";

const FALLBACK_TEMPLATE = "lar:///ha.ka.ba/@lararium/templates/ahu/html";

function AhuWidget(
  this:          TW5WidgetInstance,
  parseTreeNode: TW5ParseTreeNode,
  options:       Record<string, unknown>,
) {
  this.initialise(parseTreeNode, options);
}

AhuWidget.prototype = Object.create(Widget.prototype) as TW5WidgetInstance;

AhuWidget.prototype.render = function (
  this:        TW5WidgetInstance,
  parent:      TW5FakeElement,
  nextSibling: TW5FakeElement | null,
) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();

  const slot = this.getAttribute("slot", "");
  const explicit  = this.getAttribute("uri",  "");
  const parentUri = this.getVariable?.("currentTiddler") ?? "";
  // Resolution order:
  //   1. explicit `uri` attribute, when present and not a placeholder.
  //   2. slot starting with `lar:` (URI-form sigils — MemeticParser stores
  //      the URI in `slot` when the parse tree comes from PranalaSugar's
  //      aka/kahea forms with a URI argument).
  //   3. parentUri + slot fragment (the conventional `#slot` form).
  // The parse tree's `uri` placeholder ("lar:///unknown") fires when
  // MemeticParser parsed without a tiddler-context — currentTiddler then
  // names the authoritative parent URI.
  const isUnknownPlaceholder = explicit.startsWith("lar:///unknown");
  const childUri =
    explicit && !isUnknownPlaceholder ? explicit
    : slot.startsWith("lar:")         ? slot
    : (parentUri + slot);

  // Resolve the active template via the cascade. The cascade reads
  // lar-export-scope (and any future scope variables) without the widget
  // needing to know which scopes exist.
  const cascadeMatches = this.wiki?.filterTiddlers?.(CASCADE_FILTER, this) ?? [];
  const template       = cascadeMatches[0] || FALLBACK_TEMPLATE;

  // Build a parse subtree equivalent to:
  //   <$tiddler tiddler=<<childUri>>>
  //     <$transclude $tiddler=<<template>>/>
  //   </$tiddler>
  // Rendering that subtree as a child widget plugs the slot into the
  // template's wikitext; `currentTiddler` inside the template resolves to
  // childUri so {{!!slot}} / {{!!text}} read the slot tiddler's fields.
  const subtree: TW5ParseTreeNode = {
    type: "tiddler",
    attributes: {
      tiddler: { type: "string", value: childUri },
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

  // Defensive fallback — should not fire in a healthy TW5 boot.
  const placeholder = this.document.createTextNode(`? ahu ${slot}`);
  parent.insertBefore(placeholder, nextSibling);
  this.domNodes = [placeholder as unknown as TW5FakeElement];
};

AhuWidget.prototype.execute = function (this: TW5WidgetInstance): void {
  // makeChildWidget runs the children we constructed in render(); no
  // makeChildWidgets() over the parse-tree body — body content lives in the
  // slot child tiddler, not the parent's parse tree.
};

AhuWidget.prototype.refresh = function (
  this:            TW5WidgetInstance,
  changedTiddlers: Record<string, TW5ChangeRecord>,
): boolean {
  const slot      = this.getAttribute("slot", "");
  const explicit  = this.getAttribute("uri",  "");
  const parentUri = this.getVariable?.("currentTiddler") ?? "";
  const childUri  = explicit || (parentUri + slot);

  // Re-render when the slot child changes OR when any cascade entry changes
  // (operator may have overridden the template at runtime).
  if (changedTiddlers[childUri]) {
    this.refreshSelf();
    return true;
  }
  for (const t of Object.keys(changedTiddlers)) {
    if (t.startsWith("$:/config/Lar/AhuTemplate")) {
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

export { AhuWidget as ahu };
