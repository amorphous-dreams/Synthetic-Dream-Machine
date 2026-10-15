/*\
title: lar:///ha.ka.ba/lararium/tw5/widgets/action-meme-place
type: application/javascript
module-type: widget
\*/
/**
 * action-meme-place — the placement law's door inside a wiki.
 *
 * ── WHY A WIDGET ────────────────────────────────────────────────────────────────────────────────
 * `$tw.lares.meme.place` stands published by the meme-face startup, and until now only a script
 * reached it: a button in a wiki could render a meme, project it, link to it — and never place one.
 * Every other skin over `placeMeme` (the HTTP routes, the CLI, the daemon reactors, the MCP twin)
 * had a door an author could type. The wiki, which holds the author, had none.
 *
 * ── THE SAME LAW, NO SECOND COPY ────────────────────────────────────────────────────────────────
 * This calls the FACE, never `placeMeme` directly: one gate, one grade, one canonical hash, whichever
 * skin fired. A widget reaching past the face would be a second placement path to keep aligned, and
 * the alignment is exactly what the face exists to hold.
 *
 *   <$action-meme-place uri="lar:///t/x" text=<<carrier>>/>
 *   <$action-meme-place uri={{!!uri}} text={{!!text}} bag="default"/>
 *
 * ── THE RECEIPT LANDS IN `$:/temp` ──────────────────────────────────────────────────────────────
 * `$:/temp/lares/meme-place/<uri>` carries the receipt: the whole reply as JSON in the body, and the
 * decision, grade and canonical hash flat as fields so a filter reads them without parsing. `$:/temp`
 * never persists and never syncs — the receipt belongs to the session that fired the action, and a
 * receipt that outlived it would read as a standing claim about records that have since moved.
 *
 * The placement is ASYNCHRONOUS and an action widget answers synchronously, so `invokeAction` returns
 * the moment the placement is under way and the receipt lands when it resolves. A caller waits by
 * watching the receipt tiddler, which is what a wiki watches anyway.
 *
 * ── WHAT IT REFUSES ─────────────────────────────────────────────────────────────────────────────
 * An empty `uri` or an empty `text` places NOTHING and writes no receipt. A button wired to a field
 * an author has not filled fires on every click, and a placement over empty text would found a meme
 * at whatever address happened to be bound.
 *
 * `bag` and `recipe` name the container the receipt records — a wiki holds ONE store and the face
 * writes to it, so the name travels as provenance, never as routing. Naming both at once names no
 * container and the receipt records none.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/modules/meme-face
 */

import type { PlaceMemeReceipt } from "../place-meme.js";
import type { LaresMemeFace, LaresTw5Extension } from "../types/lares-globals.js";
import type { TW5Instance, TW5Wiki } from "../types/tiddlywiki.js";

/** The receipt's home — a `$:/temp` prefix, so nothing here persists or syncs. */
export const MEME_PLACE_RECEIPT_PREFIX = "$:/temp/lares/meme-place/";

/** Where the receipt for one placement lands. */
export function memePlaceReceiptTitle(uri: string): string {
  return MEME_PLACE_RECEIPT_PREFIX + uri;
}

/** The fields a receipt carries: the whole reply as JSON, the decision flat beside it. */
export function memePlaceReceiptFields(
  uri: string,
  container: string,
  receipt: PlaceMemeReceipt,
): Record<string, string> {
  const fields: Record<string, string> = {
    title: memePlaceReceiptTitle(uri),
    type: "application/json",
    uri,
    decision: receipt.decision,
    grade: receipt.grade,
    text: JSON.stringify(receipt, null, 2),
  };
  if (receipt.canonicalHash) fields["canonical-hash"] = receipt.canonicalHash;
  if (container) fields["container"] = container;
  return fields;
}

/** The fields a placement that THREW carries — the reason an author can read, no invented decision. */
export function memePlaceErrorFields(uri: string, container: string, reason: string): Record<string, string> {
  const fields: Record<string, string> = {
    title: memePlaceReceiptTitle(uri),
    type: "application/json",
    uri,
    error: reason,
    text: JSON.stringify({ uri, error: reason }, null, 2),
  };
  if (container) fields["container"] = container;
  return fields;
}

// TW5's evalGlobal injects $tw and require as direct function parameters.
declare const $tw: (Partial<TW5Instance> & LaresTw5Extension) | undefined;
declare const require: (id: string) => Record<string, WidgetConstructor>;

/**
 * The base widget class, from whichever `require` the host stands.
 *
 * TW5 hands a module its `require` as a call parameter, and a module bundler hands its own — so a
 * reader outside a wiki (a unit driving this widget over a stubbed base) gets the bundler's, which
 * resolves no `$:/` title and throws at load. A `require` installed ON THE GLOBAL wins, because a
 * host that installs one is saying which module table it means; TW5 installs none, so a real wiki
 * reads the parameter unchanged.
 */
const hostRequire =
  (globalThis as { require?: (id: string) => Record<string, WidgetConstructor> }).require ?? require;

interface WidgetBase {
  wiki: TW5Wiki;
  initialise(parseTreeNode: unknown, options: unknown): void;
  computeAttributes(): Record<string, boolean>;
  getAttribute(name: string, fallback?: string): string;
  execute(): void;
  refreshSelf(): void;
  refreshChildren(changedTiddlers: unknown): boolean;
}

type WidgetConstructor = new () => WidgetBase;

interface ActionMemePlace extends WidgetBase {
  placeUri: string;
  placeText: string;
  container: string;
  render(parent: unknown, nextSibling: unknown): void;
  invokeAction(triggeringWidget: unknown, event: unknown): boolean;
  refresh(changedTiddlers: unknown): boolean;
}

const Widget = hostRequire("$:/core/modules/widgets/widget.js")["widget"]!;

const ActionMemePlaceWidget = function (this: ActionMemePlace, parseTreeNode: unknown, options: unknown): void {
  this.initialise(parseTreeNode, options);
} as unknown as { new (parseTreeNode?: unknown, options?: unknown): ActionMemePlace; prototype: ActionMemePlace };

ActionMemePlaceWidget.prototype = new Widget() as ActionMemePlace;

/** Render this widget into the DOM. */
ActionMemePlaceWidget.prototype.render = function (this: ActionMemePlace): void {
  this.computeAttributes();
  this.execute();
};

/** Compute the internal state of the widget. */
ActionMemePlaceWidget.prototype.execute = function (this: ActionMemePlace): void {
  this.placeUri = this.getAttribute("uri", "");
  this.placeText = this.getAttribute("text", "");
  const bag = this.getAttribute("bag", "");
  const recipe = this.getAttribute("recipe", "");
  // Either-or: naming both names no container.
  this.container = bag && recipe ? "" : bag ? `bags/${bag}` : recipe ? `recipes/${recipe}` : "";
};

/** Refresh the widget by ensuring our attributes are up to date. */
ActionMemePlaceWidget.prototype.refresh = function (this: ActionMemePlace, changedTiddlers: unknown): boolean {
  const changedAttributes = this.computeAttributes();
  if (changedAttributes["uri"] || changedAttributes["text"] || changedAttributes["bag"] || changedAttributes["recipe"]) {
    this.refreshSelf();
    return true;
  }
  return this.refreshChildren(changedTiddlers);
};

/** Invoke the action associated with this widget. */
ActionMemePlaceWidget.prototype.invokeAction = function (this: ActionMemePlace): boolean {
  const uri = this.placeUri;
  const text = this.placeText;
  const face = $tw?.lares?.meme as LaresMemeFace | undefined;
  // An unfilled address or an empty body places nothing and leaves no receipt.
  if (!uri || !text || !face) return true;
  const wiki = this.wiki;
  const container = this.container;
  void Promise.resolve(face.place(uri, text))
    .then((receipt) => { wiki.addTiddler(memePlaceReceiptFields(uri, container, receipt)); })
    .catch((err: unknown) => { wiki.addTiddler(memePlaceErrorFields(uri, container, String(err))); });
  return true; // Action was invoked
};

/**
 * THE WIDGET'S NAME IS ITS EXPORTED NAME (the `lar-uri` filter carries the same law).
 *
 * TW5 registers widgets by walking a module's exports, so the binding name IS the element an author
 * types. `action-meme-place` carries hyphens and cannot be an identifier: a plain
 * `export ActionMemePlaceWidget` would register that spelling and `<$action-meme-place>` would resolve
 * to nothing — no throw, an element that renders as text.
 */
export { ActionMemePlaceWidget as "action-meme-place" };
