/**
 * Pronaos bootstrap byte shore.
 *
 * This adapter projects a prepared Herm/Lararium Pronaos snapshot. It
 * does not discover a filesystem root, inspect private bags, mint identity,
 * answer oracle routes, or mutate a vessel. The caller supplies the exact
 * exact prepared bytes and route names that the held public projection permits.
 *
 * `/ws`, `/oracle`, and `/bulb` remain other read faces. A static byte shore
 * cannot become their authority by falling through to it.
 */

import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { HttpFaceDispatcher } from "./http-face-dispatcher.js";

import {
  DEFAULT_PRONAOS_REFUSALS,
  deliverPublicArtifact,
  niUriSha256FromHex,
  sha256HexBytesSync,
  validatePublicArtifactPublication,
  type PublicArtifactPublication,
  validatePronaosRouteInventory,
  type PronaosRoute,
  type PronaosRouteInventory,
} from "@lararium/mesh";

export interface PronaosFile {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export interface PronaosPreparedProjection {
  readonly index: PronaosFile;
  /** Exact `/assets/<vite-name>` routes, including worker assets. */
  readonly assets: ReadonlyMap<string, PronaosFile>;
  /** Optional exact PWA install projection; absent means the route remains unowned. */
  readonly manifest?: PronaosFile;
  readonly genesisSeed: PronaosFile;
  /** Exact seed-named public CAS members, keyed by their 64-hex CID. */
  readonly cas: ReadonlyMap<string, PronaosFile>;
}

export interface PronaosProjection extends PronaosPreparedProjection {
  /** The finite receipt derived from this exact prepared projection. */
  readonly routeInventory: PronaosRouteInventory;
}

export interface PronaosMount {
  dispose(): void;
}

const INDEX_ROUTE = "/";
const ASSET_ROUTE = /^\/assets\/([A-Za-z0-9._-]+)$/;
const MANIFEST_ROUTE = "/manifest.webmanifest";
const SEED_ROUTE = "/genesis/seed.json";
const CAS_ROUTE = /^\/genesis\/cas\/([0-9a-f]{64})$/;
// The finite Pronaos projection owns its whole public projection surface.
// A separately mounted artifact carrier cannot safely overlap that surface;
// sharing this dispatcher key makes the composition refuse before order can
// choose a winner.
const PRONAOS_PROJECTION_ROUTE_KEY = "pronaos:projection";

function refuse(res: ServerResponse, message = "Pronaos member unavailable"): void {
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  res.end(message);
}

function serve(res: ServerResponse, file: PronaosFile, method: string, cacheControl: string): void {
  res.writeHead(200, {
    "content-type": file.contentType,
    "cache-control": cacheControl,
  });
  if (method === "HEAD") res.end();
  else res.end(Buffer.from(file.bytes));
}

function cacheControlForPublication(cache: PublicArtifactPublication["route"]["cache"]): string {
  if (cache === "immutable") return "public, immutable, max-age=31536000";
  if (cache === "revalidate") return "public, max-age=0, must-revalidate";
  return "no-store";
}

/**
 * Build the optional Herm public-artifact carrier face.
 *
 * The caller supplies one already-published byte buffer.  The handler never
 * resolves a path, opens CAS, or consults a document/persona store: every
 * response passes through the mesh publication's exact route and digest.
 */
export function pronaosPublicArtifactRequestHandler(
  publication: PublicArtifactPublication,
  bytes: Uint8Array,
): (req: IncomingMessage, res: ServerResponse) => boolean {
  validatePublicArtifactPublication(publication);
  const route = publication.route.path;
  return (req, res): boolean => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    if (pathname !== route) return false;
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "content-type": "text/plain; charset=utf-8", allow: "GET, HEAD" });
      res.end("method not allowed");
      return true;
    }
    const delivered = deliverPublicArtifact(
      publication,
      { path: pathname, artifactCid: publication.artifactCid },
      bytes,
    );
    serve(res, { bytes: delivered.bytes, contentType: delivered.contentType }, req.method,
      cacheControlForPublication(publication.route.cache));
    return true;
  };
}

/** Install the optional, exact public-artifact face on an existing Node server. */
export function mountPronaosPublicArtifact(
  httpServer: Server,
  publication: PublicArtifactPublication,
  bytes: Uint8Array,
  dispatcher?: HttpFaceDispatcher,
): PronaosMount {
  const onRequest = pronaosPublicArtifactRequestHandler(publication, bytes);
  const listener = (req: IncomingMessage, res: ServerResponse): void => {
    try { onRequest(req, res); }
    catch { refuse(res, "Pronaos artifact unavailable"); }
  };
  const unregister = dispatcher?.register({
    name: "pronaos-public-artifact",
    routeKeys: [PRONAOS_PROJECTION_ROUTE_KEY],
    owns: (req) => {
      try { return new URL(req.url ?? "/", "http://localhost").pathname === publication.route.path; }
      catch { return false; }
    },
    handle: listener,
  });
  if (!unregister) httpServer.on("request", listener);
  return { dispose: () => unregister ? unregister() : httpServer.off("request", listener) };
}

/**
 * Build the request listener without installing it. A false result means the
 * request belongs to another face; an accepted route always terminates with a
 * strict 200/404/405 response.
 */
function routeForProjection(path: string, file: PronaosFile, cache: PronaosRoute["cache"]): PronaosRoute {
  const hex = sha256HexBytesSync(file.bytes);
  return {
    kind: "web-artifact", path, artifactCid: hex,
    integrity: niUriSha256FromHex(hex), cache, refusal: "integrity",
  };
}

/** Derive and validate the finite route receipt from the prepared bytes. */
export function pronaosRouteInventoryForProjection(
  projection: PronaosPreparedProjection,
): PronaosRouteInventory {
  const routes: PronaosRoute[] = [
    routeForProjection("/", projection.index, "no-store"),
    {
      kind: "genesis-seed", path: "/genesis/seed.json",
      seedCid: sha256HexBytesSync(projection.genesisSeed.bytes),
      integrity: niUriSha256FromHex(sha256HexBytesSync(projection.genesisSeed.bytes)),
      cache: "no-store", refusal: "integrity",
    },
  ];
  if (projection.manifest) routes.splice(1, 0, routeForProjection(MANIFEST_ROUTE, projection.manifest, "no-store"));
  for (const [path, file] of [...projection.assets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (!ASSET_ROUTE.test(path)) throw new Error(`[pronaos] noncanonical asset route: ${path}`);
    routes.push(routeForProjection(path, file, "immutable"));
  }
  for (const [cid, file] of [...projection.cas.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const actual = sha256HexBytesSync(file.bytes);
    if (actual !== cid) throw new Error(`[pronaos] CAS bytes do not match route CID ${cid}`);
    routes.push({ kind: "genesis-member", path: `/genesis/cas/${cid}`, cid, cache: "immutable", refusal: "integrity" });
  }
  const inventory: PronaosRouteInventory = { routes, refusals: DEFAULT_PRONAOS_REFUSALS };
  validatePronaosRouteInventory(inventory);
  return inventory;
}

function routeFingerprint(route: PronaosRoute): string {
  return JSON.stringify(route);
}

function validateProjection(projection: PronaosProjection): void {
  validatePronaosRouteInventory(projection.routeInventory);
  const derived = pronaosRouteInventoryForProjection(projection);
  const supplied = projection.routeInventory.routes.map(routeFingerprint).sort();
  const expected = derived.routes.map(routeFingerprint).sort();
  if (JSON.stringify(supplied) !== JSON.stringify(expected)) {
    throw new Error("[pronaos] route inventory does not match prepared projection bytes");
  }
}

export function pronaosRequestHandler(
  projection: PronaosProjection,
): (req: IncomingMessage, res: ServerResponse) => boolean {
  validateProjection(projection);
  return (req, res): boolean => {
    const rawUrl = req.url ?? "/";
    // Reject encoded or literal traversal before URL pathname normalization can
    // turn an attempted private read into a public-looking path.
    if (/%2e|%2f|%5c|%25/i.test(rawUrl) || rawUrl.includes("..")) {
      if (rawUrl === "/ws" || rawUrl.startsWith("/oracle") || rawUrl.startsWith("/bulb")) return false;
      refuse(res, "Pronaos path refused");
      return true;
    }
    const pathname = new URL(rawUrl, "http://localhost").pathname;
    const owns = pathname === INDEX_ROUTE || pathname === MANIFEST_ROUTE || pathname === SEED_ROUTE ||
      pathname.startsWith("/assets/") || pathname.startsWith("/genesis/cas/");
    if (!owns) return false;
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "content-type": "text/plain; charset=utf-8", allow: "GET, HEAD" });
      res.end("method not allowed");
      return true;
    }
    if (pathname === INDEX_ROUTE) { serve(res, projection.index, req.method, "no-store"); return true; }
    if (pathname === MANIFEST_ROUTE && projection.manifest) { serve(res, projection.manifest, req.method, "no-store"); return true; }
    if (pathname === SEED_ROUTE) { serve(res, projection.genesisSeed, req.method, "no-store"); return true; }
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
export function mountPronaosReadFace(
  httpServer: Server,
  projection: PronaosProjection,
  dispatcher?: HttpFaceDispatcher,
): PronaosMount {
  const onRequest = pronaosRequestHandler(projection);
  const listener = (req: IncomingMessage, res: ServerResponse): void => {
    void onRequest(req, res);
  };
  const owns = (req: IncomingMessage): boolean => {
    const rawUrl = req.url ?? "/";
    if (/%2e|%2f|%5c|%25/i.test(rawUrl) || rawUrl.includes("..")) {
      return !(rawUrl === "/ws" || rawUrl.startsWith("/oracle") || rawUrl.startsWith("/bulb"));
    }
    const pathname = new URL(rawUrl, "http://localhost").pathname;
    return pathname === "/" || pathname === "/manifest.webmanifest" ||
      pathname === "/genesis/seed.json" || pathname.startsWith("/assets/") ||
      pathname.startsWith("/genesis/cas/");
  };
  const unregister = dispatcher?.register({
    name: "pronaos",
    routeKeys: [PRONAOS_PROJECTION_ROUTE_KEY],
    owns,
    handle: listener,
  });
  if (!unregister) httpServer.on("request", listener);
  return { dispose: () => unregister ? unregister() : httpServer.off("request", listener) };
}
