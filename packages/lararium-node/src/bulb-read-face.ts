/**
 * bulb-read-face — serve the HELD bulb by CID over the node's PUBLIC read-face (the oracle-substrate floor).
 *
 * Routes (GET-only, on the SAME HTTP server the FLOW-map read-face uses, under a distinct `/bulb/` prefix):
 *   GET /bulb/manifest    → the bulb manifest (cid index, JSON)
 *   GET /bulb/pointer     → a signed monotone pointer over the manifest cid (corm-lease freshness / anti-rollback)
 *   GET /bulb/<cid>.bin   → a content-addressed bulb blob (seed · bootstrap · cas-manifest · each engine/plugin blob)
 *   GET /cas/<cid>        → a PUBLIC-tier blob this Herm holds in its cleartext `cid/` (the Herm re-share, below)
 *
 * THE HERM RE-SHARE (basket-one #/the-fetch-door: "a public blob travels to a Herm before any hearth serves
 * it"). A fleet peer stages a public blob and goes dark; its bytes reached this Herm over Socket B and landed
 * write-through in `cid/`. A stranger fetches them here by cid — IFF a pointer in a PUBLIC-tier bag names the
 * cid (`publicCasShore`: the derived reference count → the bag → its declared tier). A cid named only from a
 * private or contract tier, or named by nothing, draws the SAME 404 the bulb answers, so a withholding never
 * says which gate refused. The bulb route itself stays the boot CAS alone.
 *
 * PUBLIC-FLOOR ONLY. The bulb carries ALL-PUBLIC boot material, so it rides THIS floor exclusively — NEVER the cad
 * carriage (Socket B). Write-refusal holds by construction: only GET, bytes named by their own hash, no sync session.
 * The signed pointer is the corm-lease: served FROZEN offline (the static blob), the pointer's freshness lease
 * re-issues on the Ea breath so a live Herm advances it online (anti-rollback = the oracle-substrate max-register).
 *
 * SERVE FIRE, NEVER KEY. The bulb carries no signing key; the pointer's signer is the Herm's OWN publish key (it
 * signs WHERE-the-current-bulb-is, never the kindled hearth's identity — that key is minted on the cold device).
 *
 * Meme: lar:///ha.ka.ba/lararium/node/bulb-read-face
 */

import type { Server, IncomingMessage, ServerResponse } from "node:http";
import { BULB_ROUTE_PREFIX, CAS_ROUTE_PREFIX, BULB_MANIFEST_ROUTE, BULB_POINTER_ROUTE, BULB_BLOB_RE, CAS_BLOB_RE } from "./bulb-routes.js";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  buildOraclePointer, oraclePointerId, sha256HexBytesSync, utf8Bytes, casReferences, publicRealmBooksFromDoc,
  type OraclePointer, type CasReferenceEntry, type CapTier, type LarDoc,
} from "@lararium/mesh";
import { readCasBlobFromFs } from "./node-cas.js";
import { atomicWriteFileSync } from "./fs-atomic.js";
import { buildBulb, type BulbArtifact, type BulbBlob, type BulbManifest } from "./bulb.js";
import type { OracleReadFace } from "./oracle-read-face.js";

/** The bulb pointer freshness lease (read against the puller's LOCAL clock). */
const BULB_POINTER_TTL_MS = 5 * 60_000;
/** Persists the monotone pointer version so it never regresses across a reboot (a reset would read as rollback). */
const BULB_STATE_FILE = "bulb-pointer-state.json";

interface PersistedBulbPointerState {
  readonly version:       number;
  readonly lastPointerId: string | null;
  readonly prevId:        string | null;
  readonly cid:           string | null;   // the last published manifest cid (a real bulb change vs a reboot)
}

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

/**
 * Mount the bulb read-face. Content-addresses the bulb ONCE (the held snapshot is immutable), signs a monotone
 * pointer over the manifest cid, and re-issues the freshness lease on the Ea breath. Returns a disposable face.
 */
export async function mountBulbReadFace(args: {
  readonly httpServer: Server;
  readonly bulb:       BulbArtifact;
  readonly signerSeed: Uint8Array;
  readonly storageDir: string;
  readonly onLog?:     (line: string) => void;
  /** The Herm re-share shore; absent, `/cas/<cid>` answers the bulb's 404 for every cid. */
  readonly publicCas?: PublicCasShore;
}): Promise<OracleReadFace> {
  const { httpServer, bulb, signerSeed, storageDir, onLog, publicCas } = args;
  const { manifest, blobs } = buildBulb(bulb);
  const manifestBytes = utf8Bytes(JSON.stringify(manifest));
  const manifestCid   = sha256HexBytesSync(manifestBytes);
  const blobByCid = new Map<string, Uint8Array>(blobs.map((b: BulbBlob) => [b.cid, b.bytes]));

  const statePath = join(storageDir, BULB_STATE_FILE);
  let persisted: PersistedBulbPointerState = { version: 0, lastPointerId: null, prevId: null, cid: null };
  try {
    const raw = JSON.parse(readFileSync(statePath, "utf8")) as PersistedBulbPointerState;
    if (Number.isInteger(raw.version) && raw.version >= 0) persisted = raw;
  } catch { /* first boot — start at 0 */ }

  let pointer: OraclePointer | null = null;

  // Re-publish the pointer. A manifest-cid CHANGE (a re-baked bulb) bumps the version + advances the lineage; an Ea
  // breath (no change) renews the freshness lease on the SAME version — the pointer is a LEASE, so a static bulb
  // must keep breathing or a puller rejects it stale (the corm-lease: frozen offline, advanced online).
  async function reissue(): Promise<void> {
    const changed = manifestCid !== persisted.cid;
    const version = changed ? persisted.version + 1 : persisted.version;
    const prev    = changed ? persisted.lastPointerId : persisted.prevId;
    const expiry  = Date.now() + BULB_POINTER_TTL_MS;
    // The pointer's snapshot names the manifest cid + heads = [] (the bulb is a flat content-address, no CRDT heads).
    const ptr = await buildOraclePointer({ snapshot: { cid: manifestCid, heads: [], bytes: manifestBytes }, version, prev, expiry, signerSeed });
    pointer = ptr;
    if (changed) {
      const id = await oraclePointerId(ptr);
      persisted = { version, lastPointerId: id, prevId: prev, cid: manifestCid };
      try { mkdirSync(storageDir, { recursive: true }); atomicWriteFileSync(statePath, JSON.stringify(persisted)); }
      catch { /* quota — the in-memory pointer still serves this run */ }
      onLog?.(`bulb read-face: v${version} manifest=${manifestCid.slice(0, 12)}… blobs=${blobs.length}`);
    }
  }
  await reissue();
  const ea = setInterval(() => { void reissue(); }, Math.floor(BULB_POINTER_TTL_MS / 2));
  ea.unref();

  const CORS: Record<string, string> = {
    "access-control-allow-origin":  "*",
    "access-control-allow-methods": "GET, HEAD, OPTIONS",
    "access-control-allow-headers": "*",
  };
  const refuse = (res: ServerResponse): void => {
    res.writeHead(404, { ...CORS, "content-type": "text/plain" }); res.end("unknown or stale bulb cid");
  };
  const onRequest = (req: IncomingMessage, res: ServerResponse): void => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    if (!pathname.startsWith(BULB_ROUTE_PREFIX) && !pathname.startsWith(CAS_ROUTE_PREFIX)) return;   // not ours — leave for other handlers
    if (req.method === "OPTIONS") { res.writeHead(204, CORS); res.end(); return; }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { ...CORS, "content-type": "text/plain" }); res.end("method not allowed"); return;
    }
    const cas = pathname.match(CAS_BLOB_RE);
    if (pathname.startsWith(CAS_ROUTE_PREFIX)) {
      if (!cas || !publicCas) { refuse(res); return; }
      const cid = cas[1]!;
      void publicCas.isPublic(cid).then((isPublic) => {
        const bytes = isPublic ? publicCas.read(cid) : null;
        if (!bytes) { refuse(res); return; }
        res.writeHead(200, { ...CORS, "content-type": "application/octet-stream", "cache-control": "public, immutable, max-age=31536000" });
        res.end(Buffer.from(bytes));
      }).catch(() => refuse(res));   // a torn reference read withholds — never serves on a guess
      return;
    }
    if (pathname === BULB_MANIFEST_ROUTE) {
      res.writeHead(200, { ...CORS, "content-type": "application/json", "cache-control": "no-store" });
      res.end(Buffer.from(manifestBytes)); return;
    }
    if (pathname === BULB_POINTER_ROUTE) {
      if (!pointer) { res.writeHead(503, CORS); res.end("no pointer yet"); return; }
      res.writeHead(200, { ...CORS, "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(pointer)); return;
    }
    const m = pathname.match(BULB_BLOB_RE);
    const bytes = m ? blobByCid.get(m[1]!) : undefined;
    if (bytes) {
      res.writeHead(200, { ...CORS, "content-type": "application/octet-stream", "cache-control": "public, immutable, max-age=31536000" });
      res.end(Buffer.from(bytes)); return;
    }
    refuse(res);
  };
  httpServer.on("request", onRequest);

  return { dispose: () => { clearInterval(ea); httpServer.off("request", onRequest); } };
}

/** The bulb manifest a puller GETs first (re-exported so the kindle transport speaks the same type). */
export type { BulbManifest };
