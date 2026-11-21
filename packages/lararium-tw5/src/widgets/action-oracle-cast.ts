/*\
title: lar:///ha.ka.ba/lararium/tw5/widgets/action-oracle-cast
type: application/javascript
module-type: widget
\*/
/**
 * action-oracle-cast — the I Ching's three-coin cast inside a wiki: a button casts, and the cast lands as a tiddler.
 *
 *   <$button>Cast<$action-oracle-cast/></$button>
 *   <$button>Cast my coins<$action-oracle-cast coins={{!!coins}} caster="operator" result="$:/temp/oracle/last"/></$button>
 *
 * ── A CAST STANDS AS AN ACT ─────────────────────────────────────────────────────────────────────
 * The cast happens when the action fires and never at render: rendering the button, or the cast tiddler, or any
 * wikitext that names either, casts nothing, so the record holds the throw. The tiddler it writes sits under the
 * `casts/` prefix with its facts as fields (method, entropy, lines, changing, primary, relating, caster, cast-at,
 * readings), from the one core the CLI and the daemon verb share (`@lararium/mesh/oracle-cast`). A title already
 * standing stays as it stands: a cast never writes over another.
 *
 * ── ONE DOOR FOR CHANCE, ONE CLOCK READ ─────────────────────────────────────────────────────────
 * With no `coins` the eighteen coins draw through the platform's entropy door (`crypto.getRandomValues`), named in the
 * `entropy` field. Six `coins` (6, 7, 8 or 9, bottom line first: "7,8,9,6,7,7") stand as the operator's own throw,
 * named `operator:three-coins`; a value that reads otherwise casts nothing. THE CLOCK SEAM sits at this edge: the
 * widget reads the time once when it fires and hands it to the core, which reads no clock.
 *
 * `caster` names who cast (default `wiki`). `result` names a tiddler whose text receives the cast's title, so a button
 * can open what it cast. The oracle widens attention and never decides.
 */

import { castFields, castFromCoins, castThreeCoins, parseCoins, type OracleCast } from "@lararium/mesh/oracle-cast";
import { PLATFORM_ENTROPY } from "@lararium/mesh/entropy-door";
import type { TW5Wiki } from "../types/tiddlywiki.js";

// TW5's evalGlobal injects require as a direct function parameter.
declare const require: (id: string) => Record<string, WidgetConstructor>;

/** The base widget class: a `require` installed on the global wins (a test's stub), else TW5's own parameter. */
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

interface ActionOracleCast extends WidgetBase {
  castCoins: string;
  castCaster: string;
  castResult: string;
  render(parent: unknown, nextSibling: unknown): void;
  invokeAction(triggeringWidget: unknown, event: unknown): boolean;
  refresh(changedTiddlers: unknown): boolean;
}

/** The cast an action names: the operator's typed coins, or a house cast through the platform door; null where coins read wrong. */
export function oracleCastFor(coins: string, caster: string, at: string): OracleCast | null {
  const who = caster.trim() || "wiki";
  if (coins.trim() === "") return castThreeCoins(PLATFORM_ENTROPY, { caster: who, at });
  const lines = parseCoins(coins);
  return lines === null ? null : castFromCoins(lines, { caster: who, at });
}

const Widget = hostRequire("$:/core/modules/widgets/widget.js")["widget"]!;

const ActionOracleCastWidget = function (this: ActionOracleCast, parseTreeNode: unknown, options: unknown): void {
  this.initialise(parseTreeNode, options);
} as unknown as { new (parseTreeNode?: unknown, options?: unknown): ActionOracleCast; prototype: ActionOracleCast };

ActionOracleCastWidget.prototype = new Widget() as ActionOracleCast;

/** Render this widget into the DOM: an action widget renders nothing and casts nothing. */
ActionOracleCastWidget.prototype.render = function (this: ActionOracleCast): void {
  this.computeAttributes();
  this.execute();
};

/** Compute the internal state of the widget. */
ActionOracleCastWidget.prototype.execute = function (this: ActionOracleCast): void {
  this.castCoins = this.getAttribute("coins", "");
  this.castCaster = this.getAttribute("caster", "wiki");
  this.castResult = this.getAttribute("result", "");
};

/** Refresh the widget by ensuring our attributes are up to date. */
ActionOracleCastWidget.prototype.refresh = function (this: ActionOracleCast, changedTiddlers: unknown): boolean {
  const changedAttributes = this.computeAttributes();
  if (changedAttributes["coins"] || changedAttributes["caster"] || changedAttributes["result"]) {
    this.refreshSelf();
    return true;
  }
  return this.refreshChildren(changedTiddlers);
};

/** Invoke the action: cast once, write the cast tiddler, hand its title to `result`. */
ActionOracleCastWidget.prototype.invokeAction = function (this: ActionOracleCast): boolean {
  const cast = oracleCastFor(this.castCoins, this.castCaster, new Date().toISOString());
  if (cast === null) return true;
  const fields = castFields(cast);
  const title = fields["title"]!;
  if (!this.wiki.tiddlerExists(title)) this.wiki.addTiddler(fields);
  if (this.castResult) this.wiki.addTiddler({ title: this.castResult, text: title });
  return true; // Action was invoked
};

/** THE WIDGET'S NAME IS ITS EXPORTED NAME: TW5 registers widgets by walking a module's exports. */
export { ActionOracleCastWidget as "action-oracle-cast" };
