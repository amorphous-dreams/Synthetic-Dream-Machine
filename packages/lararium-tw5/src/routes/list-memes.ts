/*\
title: lar:///ha.ka.ba/lararium/tw5/routes/list-memes
type: application/javascript
module-type: route
\*/
/**
 * GET /{recipes|bags}/:name/memes.json — every meme ROOT the container holds, with the canonical hash
 * a writer hands back as `If-Match`; `?tree=1` nests each root's slot tree beneath it.
 *
 * The listing skin of `listMemes`, a sibling of stock's `get-tiddlers-json.js` (`tiddlers.json`): the
 * same container law (`default` names THE HOST'S ANCHOR; any other name answers 404 with a one-line
 * body), the same `$:/` posture (a system-titled root rides only while
 * `$:/config/SyncSystemTiddlersFromServer` reads `yes`), a JSON array in title order.
 *
 *   [ { "uri": "lar:///…", "canonicalHash": "sha256:…" }, … ]                        by default
 *   [ { "uri", "canonicalHash", "slots": [ { "slot": "#/a", "uri": "lar:///…#/a", "slots": [] } ] } ]   ?tree=1
 *
 * A slot child, a carriage part and a plain tiddler never list as roots.
 */

import { listMemes, wikiMemeSink } from "../place-meme.js";
import { containerRefusal, refuseContainer } from "./plain-server.js";
import type { TW5Wiki } from "../types/tiddlywiki.js";

interface RouteState {
  readonly wiki: TW5Wiki & { getTiddlerText?(title: string, fallback?: string): string };
  readonly params: readonly string[];
  readonly queryParameters?: Record<string, string | undefined>;
}

interface RouteResponse {
  writeHead(status: number, headers: Record<string, string>): void;
  end(body?: string): void;
}

export const methods = ["GET"];

export const path = /^\/(recipes|bags)\/([^/]+)\/memes\.json$/;

export const info = { priority: 100 };

const SYNC_SYSTEM = "$:/config/SyncSystemTiddlersFromServer";

/** `?tree=1` — any value but an empty one, `0` or `false` asks for the tree. */
function wantsTree(query: Record<string, string | undefined> | undefined): boolean {
  const raw = query?.["tree"];
  return raw !== undefined && raw !== "" && raw !== "0" && raw !== "false";
}

/** Stock's posture: a `$:/` title leaves the answer unless the sync switch reads yes. */
function systemTitlesRide(wiki: RouteState["wiki"]): boolean {
  const configured = wiki.getTiddlerText?.(SYNC_SYSTEM, "")
    ?? ((wiki.getTiddler(SYNC_SYSTEM) as { fields?: { text?: unknown } } | undefined)?.fields?.text ?? "");
  return String(configured).trim() === "yes";
}

export function handler(_request: unknown, response: RouteResponse, state: RouteState): void {
  const refusal = containerRefusal(state.params);
  if (refusal !== null) {
    refuseContainer(response, refusal);
    return;
  }
  const system = systemTitlesRide(state.wiki);
  listMemes(wikiMemeSink(state.wiki), { tree: wantsTree(state.queryParameters) }).then((roots) => {
    const listed = system ? roots : roots.filter((r) => !r.uri.startsWith("$:/"));
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(listed));
  }, (err: unknown) => {
    response.writeHead(500, { "Content-Type": "text/plain" });
    response.end(err instanceof Error ? err.message : String(err));
  });
}
