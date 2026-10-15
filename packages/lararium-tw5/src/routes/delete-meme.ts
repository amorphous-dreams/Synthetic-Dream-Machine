/*\
title: lar:///ha.ka.ba/lararium/tw5/routes/delete-meme
type: application/javascript
module-type: route
\*/
/**
 * DELETE /bags/:bag/memes/:scheme/:path — the meme's records leave: the root, its `#slot` fragments,
 * its `/path` children, through `removeMeme` (the one removal law every skin calls).
 *
 * A removal addresses a BAG, as stock's `delete-tiddler.js` addresses `/bags/default/tiddlers/`; the
 * `/recipes/` form answers 404 the same way stock's does. `default` names THE HOST'S ANCHOR; any other
 * bag answers 404 before the path is read.
 *
 * `If-Match` carries the canonical hash the writer read (the merge base, as on PUT): a base the records
 * moved past answers 412 and removes nothing.
 *
 *   204 removed  · the group tombstoned
 *   404          · no root stands under the URI, or no such bag
 *   412          · the records moved past the writer's base
 *   400          · a malformed path segment
 */

import { removeMeme, wikiMemeSink, MEME_PATH, memeUriOfParams } from "../place-meme.js";
import { containerRefusal, digestHeaders, refuseContainer } from "./plain-server.js";
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

export const methods = ["DELETE"];

export const path = MEME_PATH;

export const info = { priority: 100 };

/** Strip the entity-tag quotes and any weak marker: `W/"abc"` → `abc`. */
function baseHashOf(header: string | string[] | undefined): string | null {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  const bare = raw.trim().replace(/^W\//, "").replace(/^"(.*)"$/, "$1");
  return bare === "" || bare === "*" ? null : bare;
}

export function handler(request: RouteRequest, response: RouteResponse, state: RouteState): void {
  const refusal = containerRefusal(state.params, ["bags"]);
  if (refusal !== null) {
    refuseContainer(response, refusal);
    return;
  }
  const uri = memeUriOfParams(state.params);
  if (uri === null) {
    response.writeHead(400, { "Content-Type": "text/plain" });
    response.end("malformed meme path");
    return;
  }
  removeMeme({ uri, baseHash: baseHashOf(request.headers["if-match"]) }, wikiMemeSink(state.wiki)).then((receipt) => {
    if (receipt.decision === "absent") {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end();
      return;
    }
    if (receipt.decision === "conflict") {
      response.writeHead(412, { "Content-Type": "application/json", ...digestHeaders(receipt.canonicalHash) });
      response.end(JSON.stringify({ uri, decision: "conflict", reason: "If-Match — the records moved past the base the writer read" }));
      return;
    }
    response.writeHead(204, { "Content-Type": "text/plain" });
    response.end();
  }, (err: unknown) => {
    response.writeHead(500, { "Content-Type": "text/plain" });
    response.end(err instanceof Error ? err.message : String(err));
  });
}
