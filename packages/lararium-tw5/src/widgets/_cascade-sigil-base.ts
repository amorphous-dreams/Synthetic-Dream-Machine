/**
 * _cascade-sigil-base — factory for TW5 widgets that resolve a render
 * template via cascade and transclude it with variable bindings.
 *
 * Five sigil widgets share the same shape: aka, kahea, loulou,
 * pranala-header, pranala. Each:
 *   1. Reads attributes from the parse tree.
 *   2. Resolves a render template through a cascade tag.
 *   3. Binds zero or more variables visible to the template.
 *   4. Optionally sets `currentTiddler` to a target URI for body access.
 *   5. Transcludes the resolved template under that wrapping.
 *
 * `makeCascadeSigilWidget(config)` returns a TW5 widget constructor with
 * its prototype properly chained off the standard Widget base. Each sigil
 * widget file collapses to a single config + export.
 *
 * Underscore-prefixed filename signals "shared helper, not a TW5 widget
 * module" — Vite inlines this into each consumer's bundle.
 */

import type {
  TW5WidgetInstance, TW5ParseTreeNode, TW5FakeElement, TW5ChangeRecord,
} from "../types/tiddlywiki.js";

declare const require: (id: string) => { widget: { prototype: object } };
const Widget = require("$:/core/modules/widgets/widget.js").widget;

export interface SigilWidgetConfig {
  /** Tag value used in the cascade filter, e.g. "$:/tags/Lar/AkaTemplate". */
  readonly cascadeTag:        string;
  /** Template URI used when the cascade returns no match. */
  readonly fallbackTemplate:  string;
  /**
   * Variable bindings visible inside the transcluded template. Returns a
   * map from variable name to value; each pair becomes a `<$set>` wrapper.
   * Wrapping order is left-to-right: the first entry's `<$set>` is the
   * outermost.
   */
  readonly buildBindings:     (widget: TW5WidgetInstance) => Record<string, string>;
  /**
   * Optional: when present, wrap the transclude in `<$tiddler tiddler=...>`
   * so the template's `currentTiddler` resolves to this URI (lets
   * `{{!!field}}` and inline transclusion read the target's fields).
   */
  readonly setCurrentTiddler?: (widget: TW5WidgetInstance) => string;
  /**
   * Optional: URI to monitor for refresh — when this tiddler changes, the
   * widget re-renders. Cascade-tag changes always trigger refresh.
   */
  readonly refreshUri?:        (widget: TW5WidgetInstance) => string;
  /**
   * Placeholder text emitted when subtree construction fails. Defaults to
   * `? <cascadeTag>`.
   */
  readonly placeholder?:       (widget: TW5WidgetInstance) => string;
}

export interface CascadeSigilWidgetCtor {
  new (parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>): TW5WidgetInstance;
  prototype: TW5WidgetInstance;
}

export function makeCascadeSigilWidget(config: SigilWidgetConfig): CascadeSigilWidgetCtor {
  const cascadeFilter =
    `[all[shadows+tiddlers]tag[${config.cascadeTag}]!is[draft]] :map:flat[subfilter{!!text}] +[first[]]`;

  function SigilWidget(
    this:          TW5WidgetInstance,
    parseTreeNode: TW5ParseTreeNode,
    options:       Record<string, unknown>,
  ) {
    this.initialise(parseTreeNode, options);
  }

  SigilWidget.prototype = Object.create(Widget.prototype) as TW5WidgetInstance;

  SigilWidget.prototype.render = function (
    this:        TW5WidgetInstance,
    parent:      TW5FakeElement,
    nextSibling: TW5FakeElement | null,
  ) {
    this.parentDomNode = parent;
    this.computeAttributes();
    this.execute();

    const cascadeMatches = this.wiki?.filterTiddlers?.(cascadeFilter, this) ?? [];
    const template       = cascadeMatches[0] || config.fallbackTemplate;

    const bindings = config.buildBindings(this);
    const targetUri = config.setCurrentTiddler ? config.setCurrentTiddler(this) : "";

    // Innermost: the transclude itself.
    let inner: TW5ParseTreeNode = {
      type: "transclude",
      attributes: {
        $tiddler: { type: "string", value: template },
      },
      children: [],
    };
    // Optional: wrap in <$tiddler tiddler=...> to set currentTiddler.
    if (config.setCurrentTiddler && targetUri) {
      inner = {
        type: "tiddler",
        attributes: {
          tiddler: { type: "string", value: targetUri },
        },
        children: [inner],
      };
    }
    // Outermost: nested <$set> wrappers, one per binding. Right-associative
    // so the first config entry is the OUTERMOST set.
    const entries = Object.entries(bindings);
    for (let i = entries.length - 1; i >= 0; i--) {
      const [name, value] = entries[i]!;
      inner = {
        type: "set",
        attributes: {
          name:  { type: "string", value: name },
          value: { type: "string", value },
        },
        children: [inner],
      };
    }

    const childWidget = this.makeChildWidget?.(inner, undefined);
    if (childWidget) {
      childWidget.render(parent, nextSibling);
      this.children = [childWidget];
      return;
    }

    const placeholderText = config.placeholder
      ? config.placeholder(this)
      : `? ${config.cascadeTag}`;
    const placeholder = this.document.createTextNode(placeholderText);
    parent.insertBefore(placeholder, nextSibling);
    this.domNodes = [placeholder as unknown as TW5FakeElement];
  };

  SigilWidget.prototype.execute = function (this: TW5WidgetInstance): void {
    // Children built in render(); no parse-tree body to walk.
  };

  SigilWidget.prototype.refresh = function (
    this:            TW5WidgetInstance,
    changedTiddlers: Record<string, TW5ChangeRecord>,
  ): boolean {
    const targetUri = config.refreshUri ? config.refreshUri(this) : "";
    if (targetUri && changedTiddlers[targetUri]) {
      this.refreshSelf();
      return true;
    }
    const tagPrefix = `lar:///config/Lar/${config.cascadeTag.replace("$:/tags/Lar/", "")}`;
    for (const t of Object.keys(changedTiddlers)) {
      if (t.startsWith(tagPrefix)) {
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

  return SigilWidget as unknown as CascadeSigilWidgetCtor;
}
