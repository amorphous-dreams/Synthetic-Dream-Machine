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
 *
 * THE ARRIVAL DESCRIPTOR (pronaos#/the-first-arrival). The same face answers one RFC 8615 well-known name,
 * `/.well-known/lar`, with a descriptor derived from the route receipt alone: the arrival page, the seed and
 * its CID, every worker asset and seed-named CAS member, and any hash-pinned MIRRORS by CID. A request for `/`
 * that names the descriptor's media type reaches the SAME bytes; that negotiated door adds a way in and never
 * a second source of truth. The descriptor reads nothing of the vessel's standing or archive, so a house at
 * its waking floor answers it exactly as a raised hearth does.
 */

import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { HttpFaceDispatcher } from "./http-face-dispatcher.js";
import { genesisSeedCid } from "./genesis-artifact.js";

import {
  canonicalJsonBytes,
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

/** The arrival descriptor's RFC 8615 well-known name. `lar` names the namespace, so every vessel shares it. */
export const ARRIVAL_WELL_KNOWN_ROUTE = "/.well-known/lar";
/**
 * The dispatcher key every face answering `/.well-known/lar` holds — the temple's arrival descriptor here, a
 * waymark herm's descriptor in `bulb-read-face.ts`. One key, so the two can never both mount on one vessel.
 */
export const WELL_KNOWN_LAR_ROUTE_KEY = "well-known:lar";
/** The descriptor's media type; a request for `/` naming it negotiates onto the same descriptor bytes. */
export const ARRIVAL_MEDIA_TYPE = "application/vnd.lar.arrival+json";
/** The descriptor format tag — a name, never a version; a reader refuses any other. */
export const ARRIVAL_FORMAT = "lar-arrival";

/**
 * One hash-pinned copy of one receipt CID, standing on an origin of its own. A mirror serves a vessel that
 * has already kindled and can verify the bytes; it never kindles one.
 */
export interface ArrivalMirror {
  readonly cid: string;
  readonly origin: string;
}

/** What the house declares at its well-known name. Every field derives from the route receipt or the mirror list. */
export interface ArrivalDescriptor {
  readonly format: typeof ARRIVAL_FORMAT;
  /** The arrival page's path on the house's own origin. */
  readonly arrival: "/";
  /** The exact route receipt the Pronaos serves. */
  readonly routes: readonly PronaosRoute[];
  /** Hash-pinned mirrors by CID, each on an origin no other mirror and no house face shares. */
  readonly mirrors: readonly ArrivalMirror[];
}

/** Deployment inputs the descriptor reads beside the prepared projection. */
export interface ArrivalOptions {
  /** Every origin the house itself answers on (Web, relay, oracle, each reach face). A mirror may hold none of them. */
  readonly houseOrigins: readonly string[];
  readonly mirrors?: readonly ArrivalMirror[];
}

function exactOrigin(value: string, label: string): string {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error(`[pronaos] mirror ${label} is not a URL: ${value}`); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`[pronaos] mirror ${label} must be http(s): ${value}`);
  if (url.origin !== value) throw new Error(`[pronaos] mirror ${label} must be an exact origin, without path or slash: ${value}`);
  return url.origin;
}

function receiptCids(routes: readonly PronaosRoute[]): ReadonlySet<string> {
  const cids = new Set<string>();
  for (const route of routes) {
    if (route.kind === "web-artifact") cids.add(route.artifactCid);
    else if (route.kind === "genesis-seed") cids.add(route.seedCid);
    else if (route.kind === "genesis-member") cids.add(route.cid);
  }
  return cids;
}

/**
 * Validate the mirror list against the receipt and the house. Each mirror names a CID the receipt names, and
 * stands on an exact origin that no house face holds and no other mirror entry holds, so one origin carries one
 * CID's copy and nothing a mirror serves can speak with the house's authority.
 */
export function validateArrivalMirrors(
  routes: readonly PronaosRoute[],
  options: ArrivalOptions,
): readonly ArrivalMirror[] {
  const house = new Set(options.houseOrigins.map((origin) => {
    try { return new URL(origin).origin; } catch { return origin; }
  }));
  const named = receiptCids(routes);
  const taken = new Set<string>();
  const mirrors: ArrivalMirror[] = [];
  for (const mirror of options.mirrors ?? []) {
    if (!named.has(mirror.cid)) throw new Error(`[pronaos] mirror names a CID the route receipt does not: ${mirror.cid}`);
    if (house.has(mirror.origin) || house.has(mirror.origin.replace(/\/+$/, ""))) {
      throw new Error(`[pronaos] mirror origin is the house's own: ${mirror.origin}`);
    }
    const origin = exactOrigin(mirror.origin, "origin");
    if (taken.has(origin)) throw new Error(`[pronaos] mirror origin carries a second copy: ${origin}`);
    taken.add(origin);
    mirrors.push({ cid: mirror.cid, origin });
  }
  return mirrors.sort((a, b) => a.cid.localeCompare(b.cid) || a.origin.localeCompare(b.origin));
}

/**
 * Every origin a house answers on: each reach face's origin, whatever its standing, plus each composed Web,
 * relay and oracle origin where the standing composes them. The reach faces feed in unconditionally, so a mirror
 * on the house's own origin refuses on every standing.
 */
export function houseOriginsOf(
  reachFaces: readonly { readonly origin: string }[],
  compositions: readonly { readonly webOrigin?: string; readonly relayOrigin: string; readonly oracleOrigin: string }[] | null,
): string[] {
  return [...new Set([
    ...reachFaces.map((face) => face.origin),
    ...(compositions ?? []).flatMap((c) => [c.webOrigin, c.relayOrigin, c.oracleOrigin]
      .filter((origin): origin is string => typeof origin === "string")),
  ])];
}

/** The descriptor's exact bytes: canonical JSON over the receipt and the validated mirrors. */
export function arrivalDescriptorBytes(projection: PronaosProjection, options: ArrivalOptions): Uint8Array {
  const descriptor: ArrivalDescriptor = {
    format: ARRIVAL_FORMAT,
    arrival: "/",
    routes: projection.routeInventory.routes,
    mirrors: validateArrivalMirrors(projection.routeInventory.routes, options),
  };
  return canonicalJsonBytes(descriptor);
}

/**
 * Whether a request's Accept header names the descriptor's media type itself. A wildcard never does, so an
 * ordinary navigation keeps reading the arrival page.
 */
function acceptsDescriptor(req: IncomingMessage): boolean {
  const accept = req.headers.accept;
  if (typeof accept !== "string") return false;
  return accept.split(",").some((range) => {
    const [type, ...params] = range.split(";").map((part) => part.trim().toLowerCase());
    if (type !== ARRIVAL_MEDIA_TYPE) return false;
    const q = params.find((param) => param.startsWith("q="));
    return q === undefined || Number(q.slice(2)) > 0;
  });
}

function refuse(res: ServerResponse, message = "Pronaos member unavailable"): void {
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  res.end(message);
}

function serve(
  res: ServerResponse, file: PronaosFile, method: string, cacheControl: string,
  extra: Readonly<Record<string, string>> = {},
): void {
  res.writeHead(200, {
    ...extra,
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
      seedCid: genesisSeedCid(projection.genesisSeed.bytes),
      integrity: niUriSha256FromHex(genesisSeedCid(projection.genesisSeed.bytes)),
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

/** The exact paths this face claims: the receipt's own routes and the one well-known name. */
function ownsPath(pathname: string): boolean {
  return pathname === INDEX_ROUTE || pathname === MANIFEST_ROUTE || pathname === SEED_ROUTE ||
    pathname === ARRIVAL_WELL_KNOWN_ROUTE || pathname.startsWith("/assets/") || pathname.startsWith("/genesis/cas/");
}

export function pronaosRequestHandler(
  projection: PronaosProjection,
  arrival: ArrivalOptions = { houseOrigins: [] },
): (req: IncomingMessage, res: ServerResponse) => boolean {
  validateProjection(projection);
  const descriptor: PronaosFile = { bytes: arrivalDescriptorBytes(projection, arrival), contentType: ARRIVAL_MEDIA_TYPE };
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
    if (!ownsPath(pathname)) return false;
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "content-type": "text/plain; charset=utf-8", allow: "GET, HEAD" });
      res.end("method not allowed");
      return true;
    }
    if (pathname === ARRIVAL_WELL_KNOWN_ROUTE) { serve(res, descriptor, req.method, "no-store"); return true; }
    if (pathname === INDEX_ROUTE) {
      // The negotiated door: the same descriptor bytes, reached by media type; the page stays the default.
      serve(res, acceptsDescriptor(req) ? descriptor : projection.index, req.method, "no-store", { vary: "accept" });
      return true;
    }
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
  arrival?: ArrivalOptions,
): PronaosMount {
  const onRequest = pronaosRequestHandler(projection, arrival);
  const listener = (req: IncomingMessage, res: ServerResponse): void => {
    void onRequest(req, res);
  };
  const owns = (req: IncomingMessage): boolean => {
    const rawUrl = req.url ?? "/";
    if (/%2e|%2f|%5c|%25/i.test(rawUrl) || rawUrl.includes("..")) {
      return !(rawUrl === "/ws" || rawUrl.startsWith("/oracle") || rawUrl.startsWith("/bulb"));
    }
    return ownsPath(new URL(rawUrl, "http://localhost").pathname);
  };
  const unregister = dispatcher?.register({
    name: "pronaos",
    routeKeys: [PRONAOS_PROJECTION_ROUTE_KEY, WELL_KNOWN_LAR_ROUTE_KEY],
    owns,
    handle: listener,
  });
  if (!unregister) httpServer.on("request", listener);
  return { dispose: () => unregister ? unregister() : httpServer.off("request", listener) };
}
