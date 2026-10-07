/**
 * bulb-read-face — hand over the BULB by CID over the node's PUBLIC read-face (the oracle-substrate floor).
 *
 * Routes (GET/HEAD-only, on the SAME HTTP server the FLOW-map read-face uses, under a distinct `/bulb/` prefix):
 *   GET /bulb/<cid>.bin   → the genesis seed (under the bulb CID) or one seed-named engine/plugin CAS blob
 *   GET /cas/<cid>        → a PUBLIC-tier blob this Herm holds in its cleartext `cid/` (the Herm re-share, below)
 *
 * THE SILENT RUNG (pronaos#/the-rung-ladder). A herm answers a stranger only by a name the stranger brings. The
 * bulb — the genesis seed plus the CAS blobs it names — re-derives from the published build, so a traveler arrives
 * already knowing the bulb CID (the seed's own) and pulls the rest off the seed. No route lists or describes what
 * the face holds, and every unknown, withheld or refused request draws the one CLOSED DOOR (`bulb-routes.ts`),
 * byte-identical to the dispatcher's terminal refusal.
 *
 * THE WAYMARK RUNG (opt-in, `herm.waymark` in the node config). A herm that chooses to be found serves one
 * minimal UNSIGNED descriptor at `/.well-known/lar`: its format, its route shapes, and its bulb CID. It names no
 * kindle pointer, mirror or Nexus, and a herm signs nothing public.
 *
 * THE HERM RE-SHARE (basket-one #/the-fetch-door: "a public blob travels to a Herm before any hearth serves
 * it"). A fleet peer stages a public blob and goes dark; its bytes reached this Herm over Socket B and landed
 * write-through in `cid/`. A stranger fetches them here by cid — IFF a pointer in a PUBLIC-tier bag names the
 * cid (`publicCasShore`: the derived reference count → the bag → its declared tier). A cid named only from a
 * private or contract tier, or named by nothing, draws the closed door, so a withholding never says which gate
 * refused. The bulb route itself stays the bulb alone.
 *
 * PUBLIC-FLOOR ONLY. The bulb carries ALL-PUBLIC boot material, so it rides THIS floor exclusively — NEVER the cad
 * carriage (Socket B). Write-refusal holds by construction: only GET, bytes named by their own hash, no sync session.
 * SERVE FIRE, NEVER KEY. The bulb carries only public boot material; the kindled hearth's identity key is minted
 * on the cold device.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/bulb-read-face
 */

import type { Server, IncomingMessage, ServerResponse } from "node:http";
import { BULB_ROUTE_PREFIX, CAS_ROUTE_PREFIX, BULB_BLOB_RE, CAS_BLOB_RE, answerClosedDoor, bulbBlobRoute } from "./bulb-routes.js";
import {
  canonicalJsonBytes, casReferences, publicRealmBooksFromDoc,
  type CasReferenceEntry, type CapTier, type LarDoc,
} from "@lararium/mesh";
import { readCasBlobFromFs } from "./node-cas.js";
import { buildBulb, type BulbArtifact } from "./bulb.js";
import { ARRIVAL_WELL_KNOWN_ROUTE, WELL_KNOWN_LAR_ROUTE_KEY } from "./pronaos-adapter.js";
import type { OracleReadFace } from "./oracle-read-face.js";
import type { HttpFaceDispatcher } from "./http-face-dispatcher.js";

/** The public-CAS shore the read-face re-shares from: the bytes a cid names, and whether a PUBLIC pointer names it. */
export interface PublicCasShore {
  readonly read:     (cid: string) => Uint8Array | null;
  /** True IFF at least one pointer in a bag whose declared tier reads PUBLIC names the cid. */
  readonly isPublic: (cid: string) => Promise<boolean>;
}

/** One realm-registered book this Herm serves: the bag the realm's registration names, the tier that
 *  registration DECLARED, and the pointers the book carries as of this Herm's last sync. */
export interface RealmShoreBook {
  readonly bagUri:   string;
  readonly readTier: CapTier;
  readonly entries:  Iterable<CasReferenceEntry>;
}

/**
 * THE CARRIER'S OWN LANE — the books a Herm folds off its @crossroads replica.
 *
 * A Herm holds no charter, so it stands in no realm and folds no registration: the realm lane above named
 * nothing on the one vessel it was built for (measured — `nexus realm-bags` on the Herm read `bags: []` while
 * the founder's carried the registration). The 2026-09-13 ruling closes the circle on the public plane the
 * Herm already replicates: a PUBLIC-tier announce carries its book's doc url, so a place reads which books it
 * may carry BY HASH and nothing else. A tighter tier announces no address, its book is never asked for, and a
 * book this carrier never replicated answers nothing — a rejected find withholds, never serves.
 */
export async function announcedRealmBooks(opts: {
  readonly crossroadsDoc: () => LarDoc | null | undefined;
  readonly findBook:      (docUrl: string) => Promise<LarDoc | null>;
  /** Fired once per ask with what the board named and what this carrier could actually read — the one place
   *  an operator sees WHY a public body draws a 404 (no announce · an unreplicated book · an empty book). */
  readonly onLog?:        (line: string) => void;
}): Promise<RealmShoreBook[]> {
  const books: RealmShoreBook[] = [];
  const announcements = publicRealmBooksFromDoc(opts.crossroadsDoc());
  opts.onLog?.(`announce lane: ${announcements.length} PUBLIC book(s) on the board`);
  for (const announced of announcements) {
    const doc = await opts.findBook(announced.docUrl).catch(() => null);
    opts.onLog?.(`announce lane: ${announced.bagUri} → ${announced.docUrl} · read ${doc ? `${Object.keys(doc.tiddlers ?? {}).length} record(s)` : "NOTHING (never replicated here)"}`);
    if (!doc) continue;
    books.push({
      bagUri: announced.bagUri, readTier: "public",
      entries: Object.entries(doc.tiddlers ?? {}).map(([title, record]) => ({
        title, bagId: announced.bagUri, record: record as { tiddler: Record<string, unknown> },
      })),
    });
  }
  return books;
}

/**
 * THE HERM'S WHOLE REALM LANE — the two roads a carrier walks to learn which books it may serve, folded into
 * the one list `publicCasShore.realmReferences` reads. The vessel wires this; the test welds it.
 *
 *   · THE REGISTRATION ROAD — every registration this vessel's realm plane carries, at the tier the
 *     registration DECLARED. A vessel that stands in no realm folds nothing here.
 *   · THE ANNOUNCE ROAD — the PUBLIC books the @crossroads board names (`announcedRealmBooks`).
 *
 * THE REGISTRATION WINS THE COLLISION. A bag the registration road already named never takes a second entry
 * off the board, so a stale PUBLIC announce can never re-tier a book whose registration reads CONTRACT here.
 * The de-dup drops the announce copy alone; it never drops or loosens a declared tier.
 */
export async function hermRealmShoreBooks(opts: {
  readonly realmStanding: () => Promise<ReadonlyMap<string, { bagUri: string; docUrl: string; readTier: CapTier }>>;
  readonly findDoc:       (docUrl: string) => Promise<LarDoc | null>;
  readonly crossroadsDoc: () => LarDoc | null | undefined;
  readonly onLog?:        (line: string) => void;
}): Promise<RealmShoreBook[]> {
  const books: RealmShoreBook[] = [];
  const standing = await opts.realmStanding();
  for (const rec of standing.values()) {
    // A book this Herm never replicated answers nothing — a rejected find withholds, never serves.
    const doc = await opts.findDoc(rec.docUrl).catch(() => null);
    if (!doc) continue;
    books.push({
      bagUri: rec.bagUri, readTier: rec.readTier,
      entries: Object.entries(doc.tiddlers ?? {})
        .map(([title, record]) => ({ title, bagId: rec.bagUri, record: record as { tiddler: Record<string, unknown> } })),
    });
  }
  const announced = await announcedRealmBooks({
    crossroadsDoc: opts.crossroadsDoc,
    findBook:      opts.findDoc,
    ...(opts.onLog ? { onLog: opts.onLog } : {}),
  });
  for (const book of announced) if (!books.some((b) => b.bagUri === book.bagUri)) books.push(book);
  return books;
}

/**
 * The shore over a vessel's cleartext `cid/` + the records it can read: a cid reads PUBLIC when a pointer names
 * it from a book that declares the `public` tier. TWO lanes answer that, and a Herm needs both:
 *
 *   · ITS OWN planes — `references` × `bagTier` (the same tier reader the crossing gate uses; a null tier reads
 *     VEIL, the tightest, so an undeclared bag never leaks).
 *   · THE REALM LANE — for each realm/fleet this Herm serves, the PUBLIC-tier registrations the realm's own
 *     shared CRDT carries (`realmReferences`). A pointer a peer lands in a public bag reaches the shore through
 *     the realm's registration, never through the Herm's own crossroads: the Herm serves books it never
 *     authored, so reading its own board alone withheld every one of them.
 *
 * THE HERM HOLDS THE HINT, NEVER THE READ-CAP: both lanes answer over pointers and declared tiers alone. The
 * reference count derives at each ask — never cached — so a DROP or a re-tiering answers on the next fetch.
 */
export function publicCasShore(opts: {
  readonly casDir:     string;
  readonly references: () => Promise<Iterable<CasReferenceEntry>> | Iterable<CasReferenceEntry>;
  readonly bagTier:    (bagUrl: string) => CapTier | null;
  /** The realm lane — absent, the shore answers exactly as its own planes answer. */
  readonly realmReferences?: () => Promise<Iterable<RealmShoreBook>> | Iterable<RealmShoreBook>;
}): PublicCasShore {
  return {
    read: (cid) => readCasBlobFromFs(cid, opts.casDir),
    isPublic: async (cid) => {
      const own   = [...(await opts.references())];
      const books = opts.realmReferences ? [...(await opts.realmReferences())] : [];
      const realm = books.flatMap((b) => [...b.entries].map((e) => ({ book: b, entry: e })));
      const names = casReferences([...own, ...realm.map((r) => r.entry)]).get(cid);
      if (!names || names.size === 0) return false;
      for (const e of own) {
        if (!e.bagId) continue;
        if (names.has(`${e.bagId} ${e.title}`) && opts.bagTier(e.bagId) === "public") return true;
      }
      for (const { book, entry } of realm) {
        if (book.readTier !== "public") continue;          // a CONTRACT book rides the realm's own lane, never the shore
        const address = entry.bagId ? `${entry.bagId} ${entry.title}` : entry.title;
        if (names.has(address)) return true;
      }
      return false;
    },
  };
}

/** Mount the bulb read-face: the seed under the bulb CID and every seed-named CAS blob under its own. */
export async function mountBulbReadFace(args: {
  readonly httpServer: Server;
  readonly bulb:       BulbArtifact;
  readonly onLog?:     (line: string) => void;
  /** The vessel's one request listener. Present, the face CLAIMS `/bulb` and `/cas` before its asynchronous
   *  public-tier read, so the dispatcher's terminal refusal never answers a request this face then answers too. */
  readonly dispatcher?: HttpFaceDispatcher;
  /** The Herm re-share shore; absent, `/cas/<cid>` answers the closed door for every cid. */
  readonly publicCas?: PublicCasShore;
}): Promise<OracleReadFace> {
  const { httpServer, bulb, onLog, publicCas, dispatcher } = args;
  const { cid, blobs } = buildBulb(bulb);
  const blobByCid = new Map<string, Uint8Array>(blobs.map((b) => [b.cid, b.bytes]));

  onLog?.(`bulb read-face: bulb=${cid} blobs=${blobs.length}`);
  const SERVED: Record<string, string> = {
    "access-control-allow-origin": "*",
    "content-type":                "application/octet-stream",
    "cache-control":               "public, immutable, max-age=31536000",
  };
  const serve = (req: IncomingMessage, res: ServerResponse, bytes: Uint8Array): void => {
    if (res.headersSent || res.writableEnded) return;
    res.writeHead(200, SERVED);
    if (req.method === "HEAD") res.end(); else res.end(Buffer.from(bytes));
  };
  const onRequest = (req: IncomingMessage, res: ServerResponse): void => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    if (!pathname.startsWith(BULB_ROUTE_PREFIX) && !pathname.startsWith(CAS_ROUTE_PREFIX)) return;   // not ours — leave for other handlers
    if (req.method !== "GET" && req.method !== "HEAD") { answerClosedDoor(res); return; }
    if (pathname.startsWith(CAS_ROUTE_PREFIX)) {
      const cas = pathname.match(CAS_BLOB_RE);
      if (!cas || !publicCas) { answerClosedDoor(res); return; }
      const cid = cas[1]!;
      void publicCas.isPublic(cid).then((isPublic) => {
        const bytes = isPublic ? publicCas.read(cid) : null;
        if (bytes) serve(req, res, bytes); else answerClosedDoor(res);
      }).catch(() => answerClosedDoor(res));   // a torn reference read withholds — never serves on a guess
      return;
    }
    const m = pathname.match(BULB_BLOB_RE);
    const bytes = m ? blobByCid.get(m[1]!) : undefined;
    if (bytes) serve(req, res, bytes); else answerClosedDoor(res);
  };
  const unregister = dispatcher?.register({
    name: "bulb",
    routeKeys: [`bulb:${BULB_ROUTE_PREFIX}`, `cas:${CAS_ROUTE_PREFIX}`],
    owns: (req) => {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      return pathname.startsWith(BULB_ROUTE_PREFIX) || pathname.startsWith(CAS_ROUTE_PREFIX);
    },
    handle: onRequest,
  });
  if (!unregister) httpServer.on("request", onRequest);

  return { dispose: () => { if (unregister) unregister(); else httpServer.off("request", onRequest); } };
}

/** The waymark's format tag — a name, never a version; a reader refuses any other. */
export const WAYMARK_FORMAT = "lar-waymark";

/** What a waymark herm says of itself, and nothing more: the format, its route shapes, its bulb CID. */
export interface HermWaymark {
  readonly format: typeof WAYMARK_FORMAT;
  /** The route shapes, `<cid>` standing for a CID the client names. */
  readonly routes: readonly string[];
  /** The bulb CID this herm serves — the genesis seed's own CID. */
  readonly bulb:   string;
}

/** The waymark's exact bytes: canonical JSON, UNSIGNED — a herm signs nothing public. */
export function hermWaymarkBytes(bulbCid: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/.test(bulbCid)) throw new Error(`[waymark] bulb CID must be 64 hex: ${bulbCid}`);
  const waymark: HermWaymark = {
    format: WAYMARK_FORMAT,
    routes: [bulbBlobRoute("<cid>"), `${CAS_ROUTE_PREFIX}<cid>`],
    bulb:   bulbCid,
  };
  return canonicalJsonBytes(waymark);
}

/**
 * Mount the WAYMARK rung: `/.well-known/lar` answers the waymark bytes to GET/HEAD and the closed door to every
 * other method. It shares the arrival descriptor's route key, so a vessel can never mount a waymark beside a
 * Pronaos — the temple's descriptor and the waymark never both answer one name.
 */
export function mountHermWaymark(args: {
  readonly httpServer:  Server;
  readonly bulbCid:     string;
  readonly dispatcher?: HttpFaceDispatcher;
}): OracleReadFace {
  const bytes = hermWaymarkBytes(args.bulbCid);
  const owns = (req: IncomingMessage): boolean => new URL(req.url ?? "/", "http://localhost").pathname === ARRIVAL_WELL_KNOWN_ROUTE;
  const onRequest = (req: IncomingMessage, res: ServerResponse): void => {
    if (!owns(req)) return;
    if (req.method !== "GET" && req.method !== "HEAD") { answerClosedDoor(res); return; }
    res.writeHead(200, { "access-control-allow-origin": "*", "content-type": "application/json", "cache-control": "no-store" });
    if (req.method === "HEAD") res.end(); else res.end(Buffer.from(bytes));
  };
  const unregister = args.dispatcher?.register({
    name: "herm-waymark", routeKeys: [WELL_KNOWN_LAR_ROUTE_KEY], owns, handle: onRequest,
  });
  if (!unregister) args.httpServer.on("request", onRequest);
  return { dispose: () => { if (unregister) unregister(); else args.httpServer.off("request", onRequest); } };
}
