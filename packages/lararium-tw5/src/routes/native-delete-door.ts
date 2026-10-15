/*\
title: lar:///ha.ka.ba/lararium/tw5/routes/native-delete-door
type: application/javascript
module-type: route
\*/
/**
 * DELETE /bags/default/tiddlers/:title — the NATIVE DELETE DOOR, gated by the plugin before stock answers.
 *
 * THE GROUP LEAVES TOGETHER. `removeMeme` is the one removal law every skin calls: a meme's root, its
 * `#slot` fragments and its `/path` children go as ONE act, because a fragment left standing is a record
 * no door can reach — `memes.json` never lists it, `GET /memes/` answers 404 over it, and it re-cuts the
 * next founding at the same uri. The stock tiddlyweb syncadaptor deletes ONE title
 * (`tiddlywebadaptor.js` `deleteTiddler` → `DELETE /bags/<bag>/tiddlers/<title>`), so a trash-icon
 * delete of a meme root in a browser leaves its whole split behind. This skin stands in front of stock's
 * route at a higher priority and reads the standing record: a MEME ROOT (`isMemeRoot` — the listing's own
 * law) leaves through `removeMeme`; every other title reaches stock's handler untouched.
 *
 * The answer stays stock's `204` either way — the syncer reads a status, never a receipt — and the
 * client learns the group left on its next `syncFromServer`, which deletes what the server stopped
 * listing. An `If-Match` rides here as it does on `DELETE …/memes/…`: a base the records moved past
 * answers `412` and removes nothing.
 *
 *   204 · the group left, or stock removed the plain title
 *   412 · the records moved past the writer's base
 */

import { isMemeRoot, removeMeme, wikiMemeSink } from "../place-meme.js";
import { digestHeaders } from "./plain-server.js";
import type { TiddlerFields } from "../deserializer.js";
import type { TW5Wiki } from "../types/tiddlywiki.js";

interface RouteState {
  readonly wiki: TW5Wiki;
  readonly params: readonly string[];
}

interface RouteRequest {
  readonly headers: Record<string, string | string[] | undefined>;
}

interface RouteResponse {
  writeHead(status: number, headers: Record<string, string>): void;
  end(body?: string): void;
}

interface RouteHandler {
  handler(request: unknown, response: RouteResponse, state: RouteState): void;
}

interface TwModules {
  modules: { execute(title: string): RouteHandler };
  utils: { decodeURIComponentSafe(s: string): string };
}

// `$tw` reaches a sandboxed module as a wrapper PARAMETER, never as a property of `globalThis`.
declare const $tw: TwModules;

export const methods = ["DELETE"];

/** Stock's own path, so the two skins answer the same addresses. */
export const path = /^\/bags\/default\/tiddlers\/(.+)$/;

/** Above stock's 100, so the server asks this skin first. */
export const info = { priority: 110 };

const STOCK_DELETE = "$:/core/modules/server/routes/delete-tiddler.js";

/** Strip the entity-tag quotes and any weak marker: `W/"abc"` → `abc`. */
function baseHashOf(header: string | string[] | undefined): string | null {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  const bare = raw.trim().replace(/^W\//, "").replace(/^"(.*)"$/, "$1");
  return bare === "" || bare === "*" ? null : bare;
}

export function handler(request: RouteRequest, response: RouteResponse, state: RouteState): void {
  const title = $tw.utils.decodeURIComponentSafe(state.params[0] ?? "");
  const standing = (state.wiki.getTiddler(title) as { fields?: TiddlerFields } | undefined)?.fields;
  if (!isMemeRoot(title, standing)) {
    $tw.modules.execute(STOCK_DELETE).handler(request, response, state);
    return;
  }
  removeMeme({ uri: title, baseHash: baseHashOf(request.headers["if-match"]) }, wikiMemeSink(state.wiki)).then((receipt) => {
    if (receipt.decision === "conflict") {
      response.writeHead(412, { "Content-Type": "application/json", ...digestHeaders(receipt.canonicalHash) });
      response.end(JSON.stringify({ uri: title, decision: "conflict", reason: "If-Match — the records moved past the base the writer read" }));
      return;
    }
    response.writeHead(204, { "Content-Type": "text/plain" });
    response.end();
  }, (err: unknown) => {
    response.writeHead(500, { "Content-Type": "text/plain" });
    response.end(err instanceof Error ? err.message : String(err));
  });
}
