/*\
title: lar:///ha.ka.ba/lararium/tw5/widgets/action-call
type: application/javascript
module-type: widget
\*/
/**
 * action-call — one call through the house's one door, from a button: the answer lands as a tiddler.
 *
 *   <$button>Read<$action-call $word="get" title="Room 4"/></$button>
 *   <$button>Preview<$action-call $word="rite kukulu" mu="_!" $result="$:/state/lares/call/kukulu"/></$button>
 *   <$button>Run it<$action-call $word="<<~ get title=`Room 4`>>"/></$button>
 *
 * ── A CALL STANDS AS AN ACT ─────────────────────────────────────────────────────────────────────
 * The call fires when the action fires and never at render: rendering the button, or the result tiddler, calls nothing.
 * `$word` names the verb word, a skin spelling, an address or a whole call sigil; every attribute NOT starting with `$`
 * rides as a named param, exactly as the CLI's `key=value` words ride (`lares get title=…`). The call runs through
 * `$tw.lares.call` (modules/call.ts): it plans over this wiki's live carriers and dispatches through the host's seat,
 * `$tw.lares.callDoor` (the glass seats it over the record port; a wiki with no seat answers the bound plan).
 *
 * ── THE RESULT ──────────────────────────────────────────────────────────────────────────────────
 * The answer lands at `$result`, default `$:/state/lares/call/<request-id>`: `band` (answered, or `void` for a refusal),
 * `text` (the answer's human line, else its JSON), `answer` (the whole answer as JSON), `word`, `params` and `request-id`.
 * Before the reply the record stands at band `owed`, so a view of it shows the press in flight. A refusal lands band
 * `void` with its code in `refused`. `$request` pins the request id (a duplicate press rides the same record).
 */

import type { TW5Wiki } from "../types/tiddlywiki.js";

// TW5's evalGlobal injects require as a direct function parameter.
declare const require: (id: string) => Record<string, WidgetConstructor>;

/** The base widget class: a `require` installed on the global wins (a test's stub), else TW5's own parameter. */
const hostRequire =
  (globalThis as { require?: (id: string) => Record<string, WidgetConstructor> }).require ?? require;

interface WidgetBase {
  wiki: TW5Wiki;
  attributes: Record<string, string>;
  initialise(parseTreeNode: unknown, options: unknown): void;
  computeAttributes(): Record<string, boolean>;
  getAttribute(name: string, fallback?: string): string;
  execute(): void;
  refreshSelf(): void;
  refreshChildren(changedTiddlers: unknown): boolean;
}

type WidgetConstructor = new () => WidgetBase;

interface ActionCall extends WidgetBase {
  render(parent: unknown, nextSibling: unknown): void;
  invokeAction(triggeringWidget: unknown, event: unknown): boolean;
  refresh(changedTiddlers: unknown): boolean;
}

type CallFace = (word: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;

// TW5's evalGlobal injects $tw beside require; the call face rides on it (modules/call's startup publishes it).
declare const $tw: { lares?: { call?: CallFace } } | undefined;

/** The call face this wiki's engine publishes, or undefined where modules/call never stood. */
const callFaceOf = (): CallFace | undefined => (typeof $tw === "undefined" ? undefined : $tw?.lares?.call);

let requests = 0;
/** A request id unique within this page's life; `$request` pins one instead. */
const nextRequest = (): string => `${Date.now().toString(36)}-${(++requests).toString(36)}`;

/** The named params of a call: every attribute not starting with `$`, a blank value left out. */
export function callParamsOf(attributes: Readonly<Record<string, string>>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) if (!key.startsWith("$") && value !== "") params[key] = value;
  return params;
}

/** The fields one answer lands with: the human line as text, the whole answer as JSON. */
export function answerFields(answer: Record<string, unknown>): Record<string, string> {
  const human = typeof answer["human"] === "string" ? answer["human"] : "";
  return { band: typeof answer["band"] === "string" ? answer["band"] : "answered", text: human || JSON.stringify(answer, null, 2), answer: JSON.stringify(answer) };
}

const Widget = hostRequire("$:/core/modules/widgets/widget.js")["widget"]!;

const ActionCallWidget = function (this: ActionCall, parseTreeNode: unknown, options: unknown): void {
  this.initialise(parseTreeNode, options);
} as unknown as { new (parseTreeNode?: unknown, options?: unknown): ActionCall; prototype: ActionCall };

ActionCallWidget.prototype = new Widget() as ActionCall;

/** An action widget renders nothing and calls nothing. */
ActionCallWidget.prototype.render = function (this: ActionCall): void {
  this.computeAttributes();
  this.execute();
};

ActionCallWidget.prototype.execute = function (this: ActionCall): void { /* the attributes stand computed; the call reads them when it fires */ };

ActionCallWidget.prototype.refresh = function (this: ActionCall, changedTiddlers: unknown): boolean {
  if (Object.keys(this.computeAttributes()).length) { this.refreshSelf(); return true; }
  return this.refreshChildren(changedTiddlers);
};

/** Fire once: land the owed record, call, then land the answer (or the refusal) over it. */
ActionCallWidget.prototype.invokeAction = function (this: ActionCall): boolean {
  const word = this.getAttribute("$word", "").trim();
  if (word === "") return true;
  const request = this.getAttribute("$request", "") || nextRequest();
  const title = this.getAttribute("$result", "") || `$:/state/lares/call/${request}`;
  const params = callParamsOf(this.attributes);
  const base = { title, word, params: JSON.stringify(params), "request-id": request };
  const wiki = this.wiki;
  const call = callFaceOf();
  if (call === undefined) {
    wiki.addTiddler({ ...base, band: "void", refused: "call-face-absent", text: "this wiki carries no call face ($tw.lares.call)" });
    return true;
  }
  wiki.addTiddler({ ...base, band: "owed", text: "" });
  void call(word, params).then(
    (answer) => { wiki.addTiddler({ ...base, ...answerFields(answer) }); },
    (error: unknown) => {
      const reason = (error as { reason?: unknown })?.reason;
      const code = typeof reason === "string" ? reason : "call-unavailable";
      wiki.addTiddler({ ...base, band: "void", refused: code, text: error instanceof Error ? error.message : code });
    });
  return true; // Action was invoked
};

/** THE WIDGET'S NAME IS ITS EXPORTED NAME: TW5 registers widgets by walking a module's exports. */
export { ActionCallWidget as "action-call" };
