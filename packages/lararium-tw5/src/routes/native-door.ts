/*\
title: lar:///ha.ka.ba/lararium/tw5/routes/native-door
type: application/javascript
module-type: route
\*/
/**
 * PUT /recipes/default/tiddlers/:title — the NATIVE DOOR, gated by the plugin before stock answers.
 *
 * The stock route (`$:/core/modules/server/routes/put-tiddler.js`) stays untouched; this skin stands
 * in front of it at a higher priority, reads the body once, and hands stock the body it may land.
 * Two laws ride the seam:
 *
 * THE ENVELOPE LAW. `bag` IS USER SPACE. Stock's `get-tiddler.js` stamps `bag: "default"` over the
 * JSON it serves — TiddlyWeb's envelope, the container the record came from — and a stock client
 * hands that stamp back on save. A `bag` naming THE HOST'S ANCHOR (`default`) reads as the envelope,
 * never as a field: it never lands, and the standing record's own `bag` survives the save. Any other
 * value reads as the author's and lands as written. The one value an author cannot claim through
 * this door is the container's own name.
 *
 * (The refusal of a framed meme root rides the same seam — see `nativeDoorGate`.)
 */

import { nativeDoorGate, type NativeDoorReply } from "../native-door-gate.js";
import { HOST_ANCHOR } from "./plain-server.js";
import type { TW5Wiki } from "../types/tiddlywiki.js";

interface RouteState {
  readonly wiki: TW5Wiki;
  readonly params: readonly string[];
  data: string;
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

export const methods = ["PUT"];

export const path = /^\/recipes\/default\/tiddlers\/(.+)$/;

/** Above stock's 100, so the server asks this skin first. */
export const info = { priority: 110 };

export const bodyFormat = "string";

const STOCK_PUT = "$:/core/modules/server/routes/put-tiddler.js";

export function handler(request: unknown, response: RouteResponse, state: RouteState): void {
  const title = $tw.utils.decodeURIComponentSafe(state.params[0] ?? "");
  const standing = (state.wiki.getTiddler(title) as { fields?: Record<string, unknown> } | undefined)?.fields;
  const gate: NativeDoorReply = nativeDoorGate(state.data, standing, HOST_ANCHOR);
  if (gate.kind === "refuse") {
    response.writeHead(gate.status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(gate.body));
    return;
  }
  state.data = gate.data;
  $tw.modules.execute(STOCK_PUT).handler(request, response, state);
}
