/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/meme-door-charm
type: application/javascript
module-type: startup
\*/
/**
 * meme-door-charm — a stock client's save of a FRAMED MEME ROOT rides the `/memes/` door.
 *
 * THE TWO DOORS. The tiddlyweb syncadaptor speaks `PUT /recipes/<recipe>/tiddlers/<title>` for every
 * record, and the server's native door refuses a framed root there (422 — see `routes/native-door`),
 * because landed whole it never splits. The syncer offers no hook before `saveTiddler` runs, so this
 * module decorates the LIVE ADAPTOR INSTANCE once at startup (after core's `startup` module minted
 * it): a record `framedRootOf` names rides `PUT /recipes/<recipe>/memes/<scheme>/<path>` with the meme
 * text as the body; every other record rides the adaptor's own save, untouched. The adaptor's file
 * stays as upstream ships it.
 *
 * The callback keeps the adaptor's contract — `(err, adaptorInfo, revision)` — with the route's
 * `ETag` (the canonical hash) as the revision. The server now holds the root SPLIT while the client
 * still holds it whole; the next sync from the server reads the root's changed revision and loads the
 * split records down, which is the shape the door exists to produce.
 *
 * Browser only: a node server and an island carry no tiddlyweb adaptor, and the module leaves them as
 * they stand.
 */

import { framedRootOf, memePathOf } from "../place-meme.js";

interface HttpRequestOptions {
  url: string;
  type?: string;
  headers?: Record<string, string>;
  data?: string;
  callback: (err: unknown, data?: string, request?: { getResponseHeader(name: string): string | null }) => void;
}

interface SaveCallback {
  (err: unknown, adaptorInfo?: unknown, revision?: string): void;
}

interface TiddlyWebAdaptor {
  name?: string;
  host?: string;
  recipe?: string;
  isReadOnly?: boolean;
  saveTiddler(tiddler: { fields: Record<string, unknown> }, callback: SaveCallback, options?: unknown): void;
}

interface TwCharm {
  syncadaptor?: TiddlyWebAdaptor;
  utils: { httpRequest(options: HttpRequestOptions): unknown };
}

// `$tw` reaches a sandboxed module as a wrapper PARAMETER and a browser module as a global.
declare const $tw: TwCharm | undefined;

export const name = "lararium-meme-door-charm";
export const platforms = ["browser"];
export const after = ["startup"];
export const synchronous = true;

const CHARMED = Symbol.for("lararium.meme-door-charm");

/** Strip the entity-tag quotes and any weak marker: `W/"abc"` → `abc`. */
function revisionOf(etag: string | null): string | undefined {
  if (!etag) return undefined;
  return etag.trim().replace(/^W\//, "").replace(/^"(.*)"$/, "$1");
}

/** Decorate one adaptor instance; a second call finds the charm already laid and leaves it. */
export function charmAdaptor(adaptor: TiddlyWebAdaptor, httpRequest: TwCharm["utils"]["httpRequest"]): void {
  const holder = adaptor as TiddlyWebAdaptor & { [CHARMED]?: true };
  if (holder[CHARMED]) return;
  holder[CHARMED] = true;
  const native = adaptor.saveTiddler;
  adaptor.saveTiddler = function (this: TiddlyWebAdaptor, tiddler, callback, options) {
    const uri = framedRootOf(tiddler.fields);
    const door = uri === null ? null : memePathOf(uri, { kind: "recipes", name: this.recipe ?? "default" });
    if (door === null) {
      native.call(this, tiddler, callback, options);
      return;
    }
    if (this.isReadOnly) {
      callback(null);
      return;
    }
    const host = this.host ?? "";
    httpRequest({
      url: host.replace(/\/$/, "") + door,
      type: "PUT",
      headers: { "Content-type": "text/memetic-wikitext+tiddlywiki; charset=utf-8" },
      data: String(tiddler.fields["text"] ?? ""),
      callback: (err, _data, request) => {
        if (err) {
          callback(err);
          return;
        }
        callback(null, { bag: "default" }, revisionOf(request?.getResponseHeader("Etag") ?? null));
      },
    });
  };
}

export function startup(): void {
  if (typeof $tw === "undefined" || !$tw) return;
  const adaptor = $tw.syncadaptor;
  if (!adaptor || adaptor.name !== "tiddlyweb" || typeof adaptor.saveTiddler !== "function") return;
  charmAdaptor(adaptor, (options) => $tw.utils.httpRequest(options));
}
