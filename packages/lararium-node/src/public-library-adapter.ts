/**
 * Public-library byte shore.
 *
 * This adapter projects a prepared Herm/Lararium public-library snapshot. It
 * does not discover a filesystem root, inspect private bags, mint identity,
 * answer oracle routes, or mutate a vessel. The caller supplies the exact
 * exact prepared bytes and route names that the held public projection permits.
 *
 * `/ws`, `/oracle`, and `/bulb` remain other read faces. A static byte shore
 * cannot become their authority by falling through to it.
 */

import type { IncomingMessage, Server, ServerResponse } from "node:http";

export interface PublicLibraryFile {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export interface PublicLibraryProjection {
  readonly index: PublicLibraryFile;
  /** Exact `/assets/<vite-name>` routes, including worker assets. */
  readonly assets: ReadonlyMap<string, PublicLibraryFile>;
  readonly genesisSeed: PublicLibraryFile;
  /** Exact seed-named public CAS members, keyed by their 64-hex CID. */
  readonly cas: ReadonlyMap<string, PublicLibraryFile>;
}

export interface PublicLibraryMount {
  dispose(): void;
}

const INDEX_ROUTE = "/";
const ASSET_ROUTE = /^\/assets\/([A-Za-z0-9._-]+)$/;
const SEED_ROUTE = "/genesis/seed.json";
const RETIRED_MANIFEST_ROUTE = "/genesis/manifest.json";
const CAS_ROUTE = /^\/genesis\/cas\/([0-9a-f]{64})$/;

function refuse(res: ServerResponse, message = "public library member unavailable"): void {
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  res.end(message);
}

function serve(res: ServerResponse, file: PublicLibraryFile, method: string, cacheControl: string): void {
  res.writeHead(200, {
    "content-type": file.contentType,
    "cache-control": cacheControl,
  });
  if (method === "HEAD") res.end();
  else res.end(Buffer.from(file.bytes));
}

/**
 * Build the request listener without installing it. A false result means the
 * request belongs to another face; an accepted route always terminates with a
 * strict 200/404/405 response.
 */
export function publicLibraryRequestHandler(
  projection: PublicLibraryProjection,
): (req: IncomingMessage, res: ServerResponse) => boolean {
  return (req, res): boolean => {
    const rawUrl = req.url ?? "/";
    // Reject encoded or literal traversal before URL pathname normalization can
    // turn an attempted private read into a public-looking path.
    if (/%2e|%2f|%5c|%25/i.test(rawUrl) || rawUrl.includes("..")) {
      if (rawUrl === "/ws" || rawUrl.startsWith("/oracle") || rawUrl.startsWith("/bulb")) return false;
      refuse(res, "public library path refused");
      return true;
    }
    const pathname = new URL(rawUrl, "http://localhost").pathname;
    const owns = pathname === INDEX_ROUTE || pathname === SEED_ROUTE || pathname === RETIRED_MANIFEST_ROUTE ||
      pathname.startsWith("/assets/") || pathname.startsWith("/genesis/cas/");
    if (!owns) return false;
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "content-type": "text/plain; charset=utf-8", allow: "GET, HEAD" });
      res.end("method not allowed");
      return true;
    }
    if (pathname === INDEX_ROUTE) { serve(res, projection.index, req.method, "no-store"); return true; }
    if (pathname === SEED_ROUTE) { serve(res, projection.genesisSeed, req.method, "no-store"); return true; }
    if (pathname === RETIRED_MANIFEST_ROUTE) { refuse(res, "retired genesis manifest route"); return true; }
    const asset = pathname.match(ASSET_ROUTE);
    if (asset) {
      const file = projection.assets.get(`/assets/${asset[1]}`);
      if (file) serve(res, file, req.method, "public, immutable, max-age=31536000"); else refuse(res);
      return true;
    }
    const cas = pathname.match(CAS_ROUTE);
    if (cas) {
      const file = projection.cas.get(cas[1]!);
      if (file) serve(res, file, req.method, "public, immutable, max-age=31536000"); else refuse(res);
      return true;
    }
    refuse(res);
    return true;
  };
}

/** Install the adapter on the existing Node read-face server. */
export function mountPublicLibraryReadFace(
  httpServer: Server,
  projection: PublicLibraryProjection,
): PublicLibraryMount {
  const onRequest = publicLibraryRequestHandler(projection);
  const listener = (req: IncomingMessage, res: ServerResponse): void => {
    void onRequest(req, res);
  };
  httpServer.on("request", listener);
  return { dispose: () => httpServer.off("request", listener) };
}
