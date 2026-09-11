/*\
title: lar:///ha.ka.ba/lararium/tw5/routes/get-meme
type: application/javascript
module-type: route
\*/
/**
 * GET /bags/:bag/memes/:scheme/:path — the whole meme as text, children recomposed inline.
 * `recipes` reads the same (the native read/write pair); the path grammar lives in `MEME_PATH`.
 *
 * The read half of the PUT contract: the `ETag` carries the canonical hash of what the records
 * render now, and a writer hands it back as `If-Match` so the gate can tell an edit over a stale
 * read from a clean one. 404 when the wiki holds no record under the URI.
 *
 * `:bag` names a container the server resolves. `default` names THE HOST'S ANCHOR — the one wiki on a
 * plain server; @daemon on a lares island. Any other recipe or bag answers 404 with a one-line body.
 */

import { readMeme, wikiMemeSink, MEME_PATH, memeUriOfParams } from "../place-meme.js";
import { containerRefusal, refuseContainer } from "./plain-server.js";
import type { TW5Wiki } from "../types/tiddlywiki.js";

interface RouteState {
  readonly wiki: TW5Wiki;
  readonly params: readonly string[];
}

interface RouteResponse {
  writeHead(status: number, headers: Record<string, string>): void;
  end(body?: string): void;
}

export const methods = ["GET"];

export const path = MEME_PATH;

export const info = { priority: 100 };

export function handler(_request: unknown, response: RouteResponse, state: RouteState): void {
  const refusal = containerRefusal(state.params);
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
  readMeme(uri, wikiMemeSink(state.wiki)).then((meme) => {
    if (!meme) {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": "text/memetic-wikitext+tiddlywiki; charset=utf-8",
      "ETag": `"${meme.canonicalHash}"`,
    });
    response.end(meme.text);
  }, (err: unknown) => {
    response.writeHead(500, { "Content-Type": "text/plain" });
    response.end(err instanceof Error ? err.message : String(err));
  });
}
