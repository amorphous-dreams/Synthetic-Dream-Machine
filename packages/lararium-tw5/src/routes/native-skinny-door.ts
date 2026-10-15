/*\
title: lar:///ha.ka.ba/lararium/tw5/routes/native-skinny-door
type: application/javascript
module-type: route
\*/
/**
 * GET /recipes/default/tiddlers.json — the SKINNY ANSWER, with a meme's slot children fat.
 *
 * THE GROUP HAS NO ARRIVAL. `getSkinnyTiddlers` fetches this path and the syncer walks the answer in
 * ONE synchronous stretch — `storeTiddler` per changed title, which TiddlyWiki coalesces into ONE
 * `change` dispatch — then queues a `LoadTiddlerTask` per title and fattens them one at a time,
 * chaining immediately (`syncer.js:654-696` · `:440`; the throttle at `:480` gates SAVES alone). The
 * window is therefore N HTTP round trips, N the group's size, and through it a meme ROOT stands fat
 * over children holding no text: a root whose whole body is `kahea` calls renders every section
 * header with nothing under it. It settles, so this is a window and never a corruption — but this
 * house's carriers are long, and N scales with the slot count.
 *
 * A CLIENT LAW WOULD REACH ONLY THE CLIENTS THAT CARRY IT. The adaptor implements `getSkinnyTiddlers`
 * alone (`canSyncFromServer`, `syncer.js:305-307`), the `getUpdatedTiddlers` long-poll branch is dead
 * code for it, and nothing on the inbound path is decorable without shadowing `storeTiddler` itself.
 * The server, meanwhile, makes the answer skinny on ONE line of a stock route:
 * `(state.queryParameters.exclude || "text")`. So the law stands here, where every client reaches it.
 *
 * STOCK STILL WRITES THE ANSWER. This skin sits at priority 110 on stock's own path, hands stock a
 * state whose `sendResponse` it has wrapped, and re-inflates the SLOT CHILDREN in the body stock
 * built — its filter, its `$:/config/Server/ExternalFilters` guard and its `SyncSystemTiddlersFromServer`
 * clause all unread and un-re-derived. The twin of `routes/native-door`, which reads the body and
 * hands stock what it may land; here stock writes the body and the skin edits it on the way out.
 *
 * Only children fatten: a root arrives skinny as it always did, and by the time its own load lands
 * its children already hold their text. A caller who passed an explicit `exclude` asked for a shape
 * and gets it, untouched.
 *
 * THE DIAL. `$:/config/lares/memes/fat-children` — `no` hands back stock's answer whole, for a shelf
 * whose meme bodies have grown past the payload's comfort. Absent reads `yes`.
 */

import type { TiddlerFields } from "../deserializer.js";
import type { TW5Wiki } from "../types/tiddlywiki.js";

interface SkinnyState {
  readonly wiki: TW5Wiki & { getTiddlerText(title: string, fallback?: string): string | undefined };
  readonly queryParameters: Record<string, string | undefined>;
  sendResponse(status: number, headers: Record<string, string>, body: string, encoding: string): void;
}

interface RouteHandler {
  handler(request: unknown, response: unknown, state: SkinnyState): void;
}

interface TwModules {
  modules: { execute(title: string): RouteHandler };
}

// `$tw` reaches a sandboxed module as a wrapper PARAMETER, never as a property of `globalThis`.
declare const $tw: TwModules;

export const methods = ["GET"];

/** Stock's own path, so the two skins answer the same address. */
export const path = /^\/recipes\/default\/tiddlers.json$/;

/** Above stock's 100, so the server asks this skin first. */
export const info = { priority: 110 };

const STOCK_JSON = "$:/core/modules/server/routes/get-tiddlers-json.js";

/** The dial, and the one value that turns it off. */
export const FAT_CHILDREN = "$:/config/lares/memes/fat-children";

/** A record that carries a parent is a SLOT CHILD — the listing's own reading of the group law. */
function isSlotChild(fields: TiddlerFields | undefined): boolean {
  return fields !== undefined && typeof fields["$fragment-parent"] === "string";
}

/**
 * Put each slot child's `text` back into the answer stock built. A body that is not a JSON array of
 * objects passes through untouched — stock answers an error as stock does.
 */
export function fattenChildren(body: string, read: (title: string) => TiddlerFields | undefined): string {
  let rows: unknown;
  try { rows = JSON.parse(body); } catch { return body; }
  if (!Array.isArray(rows)) return body;
  let moved = false;
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const entry = row as Record<string, unknown>;
    if (typeof entry["title"] !== "string" || entry["text"] !== undefined) continue;
    const fields = read(entry["title"]);
    if (!isSlotChild(fields)) continue;
    const text = fields!["text"];
    if (typeof text !== "string") continue;
    entry["text"] = text;
    moved = true;
  }
  return moved ? JSON.stringify(rows) : body;
}

export function handler(request: unknown, response: unknown, state: SkinnyState): void {
  const stock = $tw.modules.execute(STOCK_JSON);
  // An explicit `exclude` is the caller naming the shape they want; the dial is the operator naming
  // the payload they will carry. Either one hands stock's answer back whole.
  const asked = state.queryParameters["exclude"] !== undefined;
  const off = (state.wiki.getTiddlerText(FAT_CHILDREN, "yes") ?? "yes").trim() === "no";
  if (asked || off) {
    stock.handler(request, response, state);
    return;
  }
  const skin: SkinnyState = {
    ...state,
    sendResponse: (status, headers, body, encoding) => {
      const out = status === 200 ? fattenChildren(body, (t) => (state.wiki.getTiddler(t) as { fields?: TiddlerFields } | undefined)?.fields) : body;
      state.sendResponse(status, headers, out, encoding);
    },
  };
  stock.handler(request, response, skin);
}
