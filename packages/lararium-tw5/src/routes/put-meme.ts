/*\
title: lar:///ha.ka.ba/lararium/tw5/routes/put-meme
type: application/javascript
module-type: route
\*/
/**
 * PUT /bags/:bag/memes/:scheme/:path — a meme arrives as text and lands as its records.
 *
 * The plain TW5 server skin over `placeMeme`, a sibling of the native `/bags/:bag/tiddlers/:title`
 * collection. The meme's URI projects onto the path with the scheme as its own segment, so
 * `lar:///ha.ka.ba/x` reads `/bags/default/memes/lar/ha.ka.ba/x` — typable, no percent-encoding,
 * and a second URI grammar gets a door without a second route. Authority-less URIs only: a
 * session-form authority IS the HTTP authority and never rides the path. Writes address a BAG (one
 * layer), as the island's INGEST verb does.
 *
 * The body carries the whole meme; the `If-Match` header carries the canonical hash the writer read
 * (the merge base — see GET). `If-None-Match: *` makes the PUT create-only (RFC 9110 §13.1.2): a URI
 * any record already stands under answers 412 before the gate runs, so a writer who means to found a
 * meme never overwrites one. The server's own writer authorization and CSRF check
 * (`x-requested-with: TiddlyWiki`, or `csrf-disable`) stand in front of this route unchanged.
 *
 * `:bag` names a container the server resolves. `default` names THE HOST'S ANCHOR — the one wiki on a
 * plain server (TiddlyWeb's stub, where `recipes/default` reads the same); @daemon on a lares island.
 * Any other name answers 404 before the body is read — a bag the server cannot name swallows nothing.
 *
 * Responses, by the gate's decision — the receipt rides as JSON on every one:
 *   200 ingest   · records landed, stale children tombstoned; `ETag` = the new canonical hash
 *   200 noop     · the records already carry this text; `ETag` = the standing hash
 *   412 conflict · the records moved past the writer's base (a failed `If-Match`, RFC 9110), or a
 *                  record stands where `If-None-Match: *` asked for none; nothing landed
 *   422 refuse   · the meme grades `error` (a carrier that stopped round-tripping); nothing landed
 *   404          · no such bag or recipe; nothing landed
 *   400          · a malformed path segment
 *
 * Beside the `ETag`, every response carrying a canonical hash carries it again as `Repr-Digest`
 * (RFC 9530, `sha-256=:<base64>:`) — one digest in the standard field, so a client verifies the
 * body without learning the house's tag grammar.
 */

import { placeMeme, readMeme, wikiMemeSink, MEME_PATH, memeUriOfParams } from "../place-meme.js";
import { containerRefusal, digestHeaders, refuseContainer } from "./plain-server.js";
import type { TW5Wiki } from "../types/tiddlywiki.js";

interface RouteState {
  readonly wiki: TW5Wiki;
  readonly params: readonly string[];
  readonly data: string;
}

interface RouteRequest {
  readonly headers: Record<string, string | string[] | undefined>;
}

interface RouteResponse {
  writeHead(status: number, headers: Record<string, string>): void;
  end(body?: string): void;
}

export const methods = ["PUT"];

export const path = MEME_PATH;

export const info = { priority: 100 };

export const bodyFormat = "string";

const STATUS = { ingest: 200, noop: 200, conflict: 412, refuse: 422 } as const;

/** Strip the entity-tag quotes and any weak marker: `W/"abc"` → `abc`. */
function baseHashOf(header: string | string[] | undefined): string | null {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  const bare = raw.trim().replace(/^W\//, "").replace(/^"(.*)"$/, "$1");
  return bare === "" || bare === "*" ? null : bare;
}

/** `If-None-Match: *` — the one form this route honours; a tag list reads as no precondition. */
function createOnly(header: string | string[] | undefined): boolean {
  const raw = Array.isArray(header) ? header[0] : header;
  return raw?.trim() === "*";
}

export function handler(request: RouteRequest, response: RouteResponse, state: RouteState): void {
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
  const baseHash = baseHashOf(request.headers["if-match"]);
  const sink = wikiMemeSink(state.wiki);
  const place = async () => {
    if (createOnly(request.headers["if-none-match"])) {
      const standing = await readMeme(uri, sink);
      if (standing) {
        return {
          uri, decision: "conflict" as const, grade: "clean" as const, landed: [], tombstoned: [], warnings: [],
          reason: "If-None-Match: * — a record already stands under this uri", canonicalHash: standing.canonicalHash,
        };
      }
    }
    return placeMeme({ uri, text: state.data, baseHash }, sink);
  };
  place().then((receipt) => {
    response.writeHead(STATUS[receipt.decision], { "Content-Type": "application/json", ...digestHeaders(receipt.canonicalHash) });
    response.end(JSON.stringify(receipt));
  }, (err: unknown) => {
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ uri, error: err instanceof Error ? err.message : String(err) }));
  });
}
