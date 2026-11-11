/**
 * canon-offer — THE OFFERING DOOR into house canon: a face offers records from its own working layer toward a house-canon bag,
 * the Kahu steward reviews and promotes them, and a release after the promotion carries them to every face's floor.
 *
 * The loop (offering#/the-canon-offer): OFFER → PROMOTE → RELEASE → ACCEPT → READ. This module holds the first two whole and
 * the decisions they turn on; the release (`floor-release`) and the accept (`floor-pin`) stand as they stood, and
 * `cutCanonFloor` (`floor-manifest`) cuts the floor a release names from the canon documents the promotion wrote.
 *
 * "A gift announces itself; the receiver ratchets." An OFFER is a signed, immutable record keyed by its CID (sha-256 hex of the
 * body's canonical bytes): the offering face's atom signs `{kind, nexus, bag, face, offerer, records}`, each record naming its
 * fields, its carrier digest (`carrierHashOf`, the identity every carrier already carries) and its FORK BASE: the carrier digest
 * of the canon record the working copy forked from (`overrideBase`), or null for a title canon did not hold. No clock, counter
 * or arrival order rides it; the same offer twice keys the same row, so a replay lands nothing.
 *
 * THE OFFER TABLE (`canonOfferDocUrl`): one board per Nexus, beside the Kahu realm and never in it. Appending a self-certifying
 * row grants nothing, so a face outside the Kahu cabal offers WITHOUT any write to canon: canon moves only under the steward's
 * promotion, which clears `requireKahuReach` BEFORE it reads a single row.
 *
 * FRESHNESS WARNS, NEVER REFUSES A READ. A record whose base no longer names canon's current carrier reads "canon is fresher"
 * in every listing; a promotion over it takes the steward's explicit choice (`overFresher`), never an auto-merge. Once canon carries
 * the bytes, a RETIRE sealed by a seat of the Nexus's charter (its lineage riding the record, as a release's does) retires the
 * offer, keyed to the offer's CID (`$:/lar/canon-offer-retired/<offer cid>/<retire cid>`), never by deletion: the offer row stays,
 * and a replayed promotion meets the retire and lands nothing. A retire no seat sealed reads `retire-unauthorised` and retires nothing.
 *
 * ONE DECISION, BOTH HOSTS. `openCanonOffer`, `verifyCanonOffer`, `foldCanonOffers`, `offerFreshness`, `offerDiff` and
 * `decideCanonPromote` hold the whole logic; `offerCanonRecords`, `readCanonOffers`, `showCanonOffer` and `promoteCanonOffer`
 * compose them over capability-named ports (the board, the source layer, canon's read, canon's write, the reach), which the
 * daemon island binds on node and browser alike.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/offering#/the-canon-offer
 */
import { CANON_OFFER_DOMAIN, CANON_OFFER_RETIRE_DOMAIN } from "./domains.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { tiddlerText, type LarDoc } from "./base-doc.js";
import { storedLarRecord } from "./stored-record.js";
import { carrierHashOf } from "./carrier-form.js";
import { digestsEqual } from "./agile-digest.js";
import { overrideBaseOf } from "./override-base.js";
import { isHouseCanonBag } from "./kahu-canon-reach.js";
import { projectionWithheld, resolvedTitlePath } from "./projection-filter.js";
import { bagUri, CONTROL_HOME_ID, SECRET_HOME_ID } from "./lar-uris.js";
import type { LarTiddlerRecord } from "./tiddler-store.js";
import { cutCanonFloor, floorSlugs, readFloorManifest } from "./floor-manifest.js";
import { rosterOfLineage } from "./floor-release.js";
import type { SealEpoch } from "./wax-stamp.js";

export { CANON_OFFER_DOMAIN, CANON_OFFER_RETIRE_DOMAIN };

/** The board row prefix an offer lands under, keyed by its CID. */
export const CANON_OFFER_PREFIX = "$:/lar/canon-offer/" as const;
/** The board row prefix a retire lands under, keyed by the CID of the offer it retires. */
export const CANON_OFFER_RETIRED_PREFIX = "$:/lar/canon-offer-retired/" as const;
/** The most records one offer carries: a gift a person reviews, never a bulk import. */
export const CANON_OFFER_MAX_RECORDS = 64;
/** The most text one board row holds; a larger row reads as no record (a write to a shared board never buys unbounded parsing). */
export const CANON_OFFER_ROW_MAX = 1024 * 1024;

const HEX64 = /^[0-9a-f]{64}$/;

/** Why an offer, a promotion or a read refuses, by name. */
export type CanonOfferRefusal =
  | "offer-not-canon"          // the bag names no house-canon bag
  | "offer-empty"              // no record named
  | "offer-too-many"           // past CANON_OFFER_MAX_RECORDS
  | "offer-withheld-title"     // a withheld or `cap/**` title never leaves its home
  | "offer-title-doubled"      // one title named twice
  | "offer-not-in-source"      // the source layer holds no live record of the title
  | "offer-no-nexus"           // no Nexus stands to offer toward
  | "offer-foreign-nexus"      // the caller named a Nexus other than the one this vessel's charter stands in
  | "offer-unknown"            // no offer under that CID counts on the board
  | "offer-base-moved"         // canon moved under a record and the steward made no explicit choice
  | "offer-retire-unseated"    // the retiring key stands no seat of the Nexus's charter
  | "offer-not-landed";        // a retire asked before canon carries every offered digest

export class CanonOfferRefused extends Error {
  override readonly name = "CanonOfferRefused";
  constructor(readonly refusal: CanonOfferRefusal, detail: string) { super(`${refusal}: ${detail}`); }
}

// ── THE SHAPES ────────────────────────────────────────────────────────────────────────────────────────

/** A field value an offer carries: JSON-plain, the shapes a TW5 field holds once read. */
export type OfferedValue = string | readonly string[];

/** One offered record: the fields, the carrier digest over them, and the fork base (null for a title canon did not hold). */
export interface CanonOfferedRecord {
  readonly title:  string;
  readonly fields: Readonly<Record<string, OfferedValue>>;
  readonly digest: string;
  readonly base:   string | null;
}

/** The body an offer seals. `face` names the offering face (its PersonaGroup) as the face claims it; `offerer` the atom key that signs. */
export interface CanonOfferBody {
  readonly kind:    typeof CANON_OFFER_DOMAIN;
  readonly nexus:   string;
  readonly bag:     string;
  readonly face:    string;
  readonly offerer: string;
  readonly records: readonly CanonOfferedRecord[];
}

export interface CanonOffer { readonly body: CanonOfferBody; readonly cid: string; readonly sig: string }

/**
 * The steward's retire: which offer, the canon digests the promotion landed, the fresher canon digests it chose to override,
 * and the charter seat that seals it at `epoch`. A retire carries the charter's public epoch lineage (genesis through `epoch`),
 * the way a floor release does, so every reader proves the seat itself: the genesis epoch's address IS the Nexus AID.
 */
export interface CanonOfferRetireBody {
  readonly kind:    typeof CANON_OFFER_RETIRE_DOMAIN;
  readonly nexus:   string;
  readonly offer:   string;
  readonly steward: string;
  readonly epoch:   string;
  readonly landed:  ReadonlyArray<{ readonly title: string; readonly digest: string }>;
  readonly over:    ReadonlyArray<{ readonly title: string; readonly canon: string | null }>;
}

export interface CanonOfferRetire { readonly body: CanonOfferRetireBody; readonly cid: string; readonly sig: string; readonly lineage: readonly SealEpoch[] }

/** The steward's hand a retire seals under: a seat of the Nexus's charter, its epoch, and the lineage that proves it. */
export interface OfferSteward extends OfferSigner { readonly epoch: string; readonly lineage: readonly SealEpoch[] }

/** A signer the door hands in: an ed25519 verifying key (hex) and its signature over bytes (hex). */
export interface OfferSigner { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> }

// ── THE TITLE LAW ─────────────────────────────────────────────────────────────────────────────────────

const HOME_PREFIXES = [CONTROL_HOME_ID, SECRET_HOME_ID];
const CAP_PATH = /^lar:\/\/\/ha\.ka\.ba\/bags\/[^/]+\/cap(?:\/|$)/;

/**
 * Whether a title stays home: the projection filter's base (TW5's temp and state namespaces), the control and secret homes,
 * and every `cap/**` row under a bag home (`bags/<home>/cap/…`), read on the title's resolved path so no spelling slips past.
 */
export function offerWithheldTitle(title: string): boolean {
  if (projectionWithheld(title)) return true;
  const path = resolvedTitlePath(title);
  if (HOME_PREFIXES.some((home) => path === home || path.startsWith(`${home}/`))) return true;
  return CAP_PATH.test(path);
}

// ── FIELDS AND DIGESTS ────────────────────────────────────────────────────────────────────────────────

const pad = (n: number, l = 2): string => String(n).padStart(l, "0");
const dateString = (d: Date): string =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}${pad(d.getUTCMilliseconds(), 3)}`;

/** A record's fields as an offer carries them: residency stamps out, null and undefined skipped, a date as TW5 writes it. */
export function offeredFieldsOf(record: LarTiddlerRecord): Record<string, OfferedValue> {
  const out: Record<string, OfferedValue> = {};
  for (const [k, v] of Object.entries(record.tiddler as Record<string, unknown>)) {
    if (v === undefined || v === null || k === "bag" || k === "$origin-bag") continue;
    if (Array.isArray(v)) out[k] = v.map((x) => String(x));
    else if (Object.prototype.toString.call(v) === "[object Date]") out[k] = dateString(v as Date);
    else out[k] = String(v);
  }
  return out;
}

/** The record canon takes from an offered record: its fields, no meta. */
export function canonRecordOf(r: CanonOfferedRecord): LarTiddlerRecord {
  return { tiddler: { ...(r.fields as Record<string, unknown>), title: r.title } as LarTiddlerRecord["tiddler"] };
}

/** The carrier digest of a record a store holds, or null where it holds none (absent, or a tombstone). */
export function canonDigestOf(record: LarTiddlerRecord | null | undefined): string | null {
  if (!record || record.meta?.deleted === true) return null;
  return carrierHashOf(record.tiddler as Record<string, unknown>);
}

const sameDigest = (a: string | null, b: string | null): boolean => (a === null || b === null ? a === b : digestsEqual(a, b));

// ── OPEN · SIGN · VERIFY ──────────────────────────────────────────────────────────────────────────────

/** The canonical bytes of an offer body. */
export function canonOfferBodyBytes(body: CanonOfferBody): Uint8Array {
  return canonicalJsonBytes({
    kind: body.kind, nexus: body.nexus, bag: body.bag, face: body.face, offerer: body.offerer,
    records: body.records.map((r) => ({ title: r.title, fields: r.fields, digest: r.digest, base: r.base })),
  });
}

export function canonOfferCid(body: CanonOfferBody): string { return sha256HexBytesSync(canonOfferBodyBytes(body)); }

const bagOf = (bag: string): string => (bag.startsWith("lar:") ? bag : bagUri(bag));

/**
 * Open an offer body over records a source layer holds. THROWS `CanonOfferRefused` on a bag outside house canon, no record, too
 * many, a doubled title or a withheld one. Records sort by title, so one set of records opens one body whatever the order named.
 */
export function openCanonOffer(parts: {
  readonly nexus:   string;
  readonly bag:     string;
  readonly face:    string;
  readonly offerer: string;
  readonly records: ReadonlyArray<{ readonly record: LarTiddlerRecord; readonly base: string | null }>;
}): CanonOfferBody {
  const bag = bagOf(parts.bag);
  if (!isHouseCanonBag(bag)) throw new CanonOfferRefused("offer-not-canon", `${bag} names no house-canon bag; an offer goes toward house canon alone`);
  if (parts.nexus.trim() === "") throw new CanonOfferRefused("offer-no-nexus", "no Nexus stands to offer toward");
  if (parts.records.length === 0) throw new CanonOfferRefused("offer-empty", "name at least one record to offer");
  if (parts.records.length > CANON_OFFER_MAX_RECORDS) throw new CanonOfferRefused("offer-too-many", `one offer carries at most ${CANON_OFFER_MAX_RECORDS} records`);
  const seen = new Set<string>();
  const records: CanonOfferedRecord[] = [];
  for (const { record, base } of parts.records) {
    const title = String(record.tiddler.title);
    if (offerWithheldTitle(title)) throw new CanonOfferRefused("offer-withheld-title", `"${title}" stays home (a withheld or cap/** title never leaves it)`);
    if (seen.has(title)) throw new CanonOfferRefused("offer-title-doubled", `"${title}" named twice`);
    seen.add(title);
    const fields = offeredFieldsOf(record);
    fields["title"] = title;
    records.push({ title, fields, digest: carrierHashOf(fields), base });
  }
  records.sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
  return { kind: CANON_OFFER_DOMAIN, nexus: parts.nexus.trim(), bag, face: parts.face.trim().toLowerCase(), offerer: parts.offerer, records };
}

export async function signCanonOffer(body: CanonOfferBody, signer: OfferSigner): Promise<CanonOffer> {
  if (signer.key !== body.offerer) throw new Error("canon-offer: the signer's key differs from the body's offerer");
  return { body, cid: canonOfferCid(body), sig: await signer.sign(canonOfferBodyBytes(body)) };
}

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

function readOfferedRecord(v: unknown): CanonOfferedRecord | null {
  if (!isRecord(v) || typeof v["title"] !== "string" || typeof v["digest"] !== "string" || !isRecord(v["fields"])) return null;
  if (v["base"] !== null && typeof v["base"] !== "string") return null;
  const fields: Record<string, OfferedValue> = {};
  for (const [k, f] of Object.entries(v["fields"])) {
    if (typeof f === "string") fields[k] = f;
    else if (Array.isArray(f) && f.every((x) => typeof x === "string")) fields[k] = f as string[];
    else return null;
  }
  return { title: v["title"], fields, digest: v["digest"], base: v["base"] as string | null };
}

/** Coerce a value into an offer at its exact shape, or null. Verifies nothing. */
export function readCanonOffer(value: unknown): CanonOffer | null {
  if (!isRecord(value) || !isRecord(value["body"]) || typeof value["cid"] !== "string" || typeof value["sig"] !== "string") return null;
  const b = value["body"];
  if (b["kind"] !== CANON_OFFER_DOMAIN) return null;
  for (const k of ["nexus", "bag", "face", "offerer"] as const) if (typeof b[k] !== "string") return null;
  if (!Array.isArray(b["records"])) return null;
  const records: CanonOfferedRecord[] = [];
  for (const r of b["records"]) { const read = readOfferedRecord(r); if (read === null) return null; records.push(read); }
  return {
    body: { kind: CANON_OFFER_DOMAIN, nexus: b["nexus"] as string, bag: b["bag"] as string, face: b["face"] as string, offerer: b["offerer"] as string, records },
    cid: value["cid"], sig: value["sig"],
  };
}

export type CanonOfferVerdict =
  | { readonly ok: true; readonly offer: CanonOffer }
  | { readonly ok: false; readonly reason: "malformed-offer" | "cid-differs" | "foreign-nexus" | "digest-differs" | "withheld-title" | "title-differs" | "not-canon" | "sig-fails" };

/**
 * Verify an offer. Never throws. Cheapest trust first: the shape, the CID re-derived (and the board key, when given), the Nexus,
 * the bag, every title outside the withheld set, every digest re-derived from its fields, then the offerer's signature.
 */
export function verifyCanonOffer(args: { readonly record: unknown; readonly keyedBy?: string; readonly nexus?: string }): CanonOfferVerdict {
  try {
    const offer = readCanonOffer(args.record);
    if (offer === null) return { ok: false, reason: "malformed-offer" };
    const cid = canonOfferCid(offer.body);
    if (cid !== offer.cid || (args.keyedBy !== undefined && args.keyedBy !== cid)) return { ok: false, reason: "cid-differs" };
    if (args.nexus !== undefined && offer.body.nexus !== args.nexus) return { ok: false, reason: "foreign-nexus" };
    if (!isHouseCanonBag(offer.body.bag)) return { ok: false, reason: "not-canon" };
    for (const r of offer.body.records) {
      if (offerWithheldTitle(r.title)) return { ok: false, reason: "withheld-title" };
      if (r.fields["title"] !== r.title) return { ok: false, reason: "title-differs" };
      if (carrierHashOf(r.fields) !== r.digest) return { ok: false, reason: "digest-differs" };
    }
    if (!verifyEd25519(offer.sig, canonOfferBodyBytes(offer.body), offer.body.offerer)) return { ok: false, reason: "sig-fails" };
    return { ok: true, offer };
  } catch {
    return { ok: false, reason: "malformed-offer" };
  }
}

// ── RETIRE ────────────────────────────────────────────────────────────────────────────────────────────

export function canonOfferRetireBodyBytes(body: CanonOfferRetireBody): Uint8Array {
  return canonicalJsonBytes({ kind: body.kind, nexus: body.nexus, offer: body.offer, steward: body.steward, epoch: body.epoch, landed: body.landed, over: body.over });
}

export async function signCanonOfferRetire(body: CanonOfferRetireBody, steward: OfferSteward): Promise<CanonOfferRetire> {
  if (steward.key !== body.steward || steward.epoch !== body.epoch) throw new Error("canon-offer: the steward's seat differs from the retire's");
  const bytes = canonOfferRetireBodyBytes(body);
  return { body, cid: sha256HexBytesSync(bytes), sig: await steward.sign(bytes), lineage: [...steward.lineage] };
}

/** Why a retire row counts nothing. `retire-unauthorised`: no seat of the Nexus's charter sealed it. */
export type CanonOfferRetireRefusal = "retire-malformed" | "retire-foreign" | "retire-unauthorised";

/**
 * Verify a retire row. Never throws. The shape, the CID, the offer it keys, the Nexus; then THE STEWARD'S HAND: the lineage it
 * carries must prove the roster of its epoch under this Nexus (`rosterOfLineage`: genesis = the AID, every step under the prior
 * threshold), the signer must stand a seat of that roster, and its signature must verify. A retire any other key sealed reads
 * `retire-unauthorised` and retires nothing.
 */
export function verifyCanonOfferRetire(value: unknown, args: { readonly nexus: string; readonly offer?: string; readonly keyedBy?: string }):
  | { readonly ok: true; readonly retire: CanonOfferRetire }
  | { readonly ok: false; readonly reason: CanonOfferRetireRefusal; readonly steward?: string } {
  try {
    if (!isRecord(value) || !isRecord(value["body"]) || typeof value["cid"] !== "string" || typeof value["sig"] !== "string" || !Array.isArray(value["lineage"])) return { ok: false, reason: "retire-malformed" };
    const b = value["body"];
    if (b["kind"] !== CANON_OFFER_RETIRE_DOMAIN) return { ok: false, reason: "retire-malformed" };
    for (const k of ["nexus", "offer", "steward", "epoch"] as const) if (typeof b[k] !== "string") return { ok: false, reason: "retire-malformed" };
    if (!Array.isArray(b["landed"]) || !Array.isArray(b["over"])) return { ok: false, reason: "retire-malformed" };
    const body = b as unknown as CanonOfferRetireBody;
    const bytes = canonOfferRetireBodyBytes(body);
    if (sha256HexBytesSync(bytes) !== value["cid"]) return { ok: false, reason: "retire-malformed" };
    if ((args.keyedBy !== undefined && args.keyedBy !== `${body.offer}/${value["cid"]}`) || (args.offer !== undefined && args.offer !== body.offer)) return { ok: false, reason: "retire-malformed" };
    if (body.nexus !== args.nexus) return { ok: false, reason: "retire-foreign" };
    const proven = rosterOfLineage(args.nexus, value["lineage"], body.epoch);
    if (!proven.ok || !proven.roster.keys.includes(body.steward) || !verifyEd25519(value["sig"], bytes, body.steward)) {
      return { ok: false, reason: "retire-unauthorised", steward: body.steward };
    }
    return { ok: true, retire: { body, cid: value["cid"], sig: value["sig"], lineage: value["lineage"] as SealEpoch[] } };
  } catch {
    return { ok: false, reason: "retire-malformed" };
  }
}

// ── THE BOARD ─────────────────────────────────────────────────────────────────────────────────────────

/** The offer table as a door holds it: a document and its change. */
export interface CanonOfferBoard { doc(): LarDoc | undefined; change(fn: (draft: LarDoc) => void): void }

/** Land an offer row. Call INSIDE `change()`. Answers false where the row already stands (a replay lands nothing). */
export function writeCanonOffer(draft: LarDoc, offer: CanonOffer): boolean {
  const key = `${CANON_OFFER_PREFIX}${offer.cid}`;
  if (Object.hasOwn(draft.tiddlers, key)) return false;
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(offer) }, "canon-offer");
  return true;
}

/**
 * Land a retire row, keyed to its offer and then to its own CID (`<prefix><offer cid>/<retire cid>`), so no forged row written
 * first can take the key a steward's retire needs. Call INSIDE `change()`. Answers false where that very retire already stands.
 */
export function writeCanonOfferRetire(draft: LarDoc, retire: CanonOfferRetire): boolean {
  const key = `${CANON_OFFER_RETIRED_PREFIX}${retire.body.offer}/${retire.cid}`;
  if (Object.hasOwn(draft.tiddlers, key)) return false;
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(retire) }, "canon-offer");
  return true;
}

/** One offer the board counts, beside the steward's retire where one stands, and every retire it refused (each by its signer). */
export interface CanonOfferStanding {
  readonly offer:   CanonOffer;
  readonly retired: CanonOfferRetire | null;
  readonly refusedRetires: ReadonlyArray<{ readonly retire: string; readonly reason: CanonOfferRetireRefusal; readonly steward?: string }>;
}

/** A row the fold set aside, and why. */
export interface CanonOfferSetAside { readonly key: string; readonly reason: string }

function rowsUnder(doc: LarDoc | undefined, prefix: string): Array<{ key: string; value: unknown }> {
  const out: Array<{ key: string; value: unknown }> = [];
  for (const [title, row] of Object.entries(doc?.tiddlers ?? {})) {
    if (!title.startsWith(prefix)) continue;
    const text = tiddlerText(row);
    if (text === null || text.length > CANON_OFFER_ROW_MAX) { out.push({ key: title.slice(prefix.length), value: undefined }); continue; }
    try { out.push({ key: title.slice(prefix.length), value: JSON.parse(text) as unknown }); } catch { out.push({ key: title.slice(prefix.length), value: undefined }); }
  }
  return out;
}

/** Fold the board: every offer that verifies for `nexus`, CID-sorted, each beside the retire that verifies for it. */
export function foldCanonOffers(doc: LarDoc | undefined, nexus: string): { readonly offers: readonly CanonOfferStanding[]; readonly setAside: readonly CanonOfferSetAside[] } {
  const setAside: CanonOfferSetAside[] = [];
  const retires = new Map<string, CanonOfferRetire>();
  const refusedRetires = new Map<string, Array<{ retire: string; reason: CanonOfferRetireRefusal; steward?: string }>>();
  for (const { key, value } of rowsUnder(doc, CANON_OFFER_RETIRED_PREFIX)) {
    const [offerCid, retireCid] = key.split("/");
    const v = verifyCanonOfferRetire(value, { nexus, keyedBy: key });
    if (!v.ok) {
      setAside.push({ key, reason: v.reason });
      if (offerCid && HEX64.test(offerCid)) refusedRetires.set(offerCid, [...(refusedRetires.get(offerCid) ?? []), { retire: retireCid ?? "", reason: v.reason, ...(v.steward ? { steward: v.steward } : {}) }]);
      continue;
    }
    // Two seats may each retire one offer: either one retires it; the lower CID names it, so every reader names the same one.
    const held = retires.get(v.retire.body.offer);
    if (!held || v.retire.cid < held.cid) retires.set(v.retire.body.offer, v.retire);
  }
  const offers: CanonOfferStanding[] = [];
  for (const { key, value } of rowsUnder(doc, CANON_OFFER_PREFIX)) {
    if (!HEX64.test(key)) { setAside.push({ key, reason: "malformed-offer" }); continue; }
    const v = verifyCanonOffer({ record: value, keyedBy: key, nexus });
    if (!v.ok) { setAside.push({ key, reason: v.reason }); continue; }
    offers.push({ offer: v.offer, retired: retires.get(key) ?? null, refusedRetires: refusedRetires.get(key) ?? [] });
  }
  offers.sort((a, b) => (a.offer.cid < b.offer.cid ? -1 : 1));
  return { offers, setAside };
}

// ── FRESHNESS · DIFF · THE PROMOTE DECISION ───────────────────────────────────────────────────────────

/**
 * Where one offered record stands against canon NOW:
 *   · `landed`           — canon already carries the offered digest;
 *   · `new`              — canon holds no such title, and the offer named no base;
 *   · `base-holds`       — canon's carrier still names the record's base;
 *   · `canon-is-fresher` — canon moved since the fork (a new carrier, a title canon took meanwhile, or one canon dropped).
 */
export type OfferFreshness = "landed" | "new" | "base-holds" | "canon-is-fresher";

export function offerFreshness(record: CanonOfferedRecord, canonDigest: string | null): OfferFreshness {
  if (canonDigest !== null && sameDigest(canonDigest, record.digest)) return "landed";
  if (record.base === null) return canonDigest === null ? "new" : "canon-is-fresher";
  return canonDigest !== null && sameDigest(canonDigest, record.base) ? "base-holds" : "canon-is-fresher";
}

/** The warning a listing names for a record canon moved under. */
export const CANON_IS_FRESHER = "canon is fresher" as const;

const fieldString = (v: OfferedValue | unknown): string | null =>
  v === undefined || v === null ? null : Array.isArray(v) ? v.join(" ") : String(v);

/** One field that differs between canon and the offer. */
export interface OfferFieldDiff { readonly field: string; readonly canon: string | null; readonly offered: string | null }

/** The fields an offered record moves against canon's record (absent canon: every field reads added), field-name sorted. */
export function offerDiff(record: CanonOfferedRecord, canon: LarTiddlerRecord | null): OfferFieldDiff[] {
  const canonFields: Record<string, unknown> = canon && canon.meta?.deleted !== true ? offeredFieldsOf(canon) : {};
  const names = new Set([...Object.keys(canonFields), ...Object.keys(record.fields)]);
  const out: OfferFieldDiff[] = [];
  for (const field of [...names].sort()) {
    const c = fieldString(canonFields[field]), o = fieldString(record.fields[field]);
    if (c !== o) out.push({ field, canon: c, offered: o });
  }
  return out;
}

export type CanonPromoteDecision =
  | { readonly act: "held"; readonly retire: CanonOfferRetire }
  | { readonly act: "refuse"; readonly refusal: "offer-base-moved"; readonly fresher: readonly string[] }
  | { readonly act: "land"; readonly writes: readonly CanonOfferedRecord[]; readonly landed: readonly CanonOfferedRecord[]; readonly over: ReadonlyArray<{ readonly title: string; readonly canon: string | null }> };

/**
 * THE PROMOTE DECISION. A retired offer holds (a replay lands nothing). A record canon moved under refuses `offer-base-moved`
 * unless the steward chose `overFresher`; with the choice, the fresher canon digests it overrides ride the retire. A record canon
 * already carries writes nothing. Everything else writes the offered bytes.
 */
export function decideCanonPromote(args: {
  readonly standing:    CanonOfferStanding;
  readonly canonDigest: (title: string) => string | null;
  readonly overFresher: boolean;
}): CanonPromoteDecision {
  if (args.standing.retired !== null) return { act: "held", retire: args.standing.retired };
  const writes: CanonOfferedRecord[] = [], landed: CanonOfferedRecord[] = [];
  const over: Array<{ title: string; canon: string | null }> = [];
  for (const r of args.standing.offer.body.records) {
    const canon = args.canonDigest(r.title);
    const fresh = offerFreshness(r, canon);
    if (fresh === "landed") { landed.push(r); continue; }
    if (fresh === "canon-is-fresher") over.push({ title: r.title, canon });
    writes.push(r);
  }
  if (over.length > 0 && !args.overFresher) return { act: "refuse", refusal: "offer-base-moved", fresher: over.map((o) => o.title) };
  return { act: "land", writes, landed, over };
}

// ── THE COMPOSITIONS OVER PORTS ───────────────────────────────────────────────────────────────────────

/** A store a door reads records from (a working layer, canon). */
export interface OfferRecordReader { get(title: string): Promise<LarTiddlerRecord | null> }
/** A store a door writes canon records into. */
export interface OfferRecordWriter { put(record: LarTiddlerRecord): Promise<void> }

/** The ports every offer door reads: the Nexus, the board, and canon's read by bag. */
export interface CanonOfferPorts {
  readonly nexus: string;
  readonly board: CanonOfferBoard;
  readonly canon: (bag: string) => Promise<OfferRecordReader | null>;
}

/** The outcome of an offer: the offer and whether this act landed its row. */
export interface CanonOfferOutcome { readonly offer: CanonOffer; readonly landed: boolean }

/**
 * OFFER: read each named title off the face's own source layer (its workbench), take each record's fork base off its
 * `overrideBase` (null where it names none), seal the offer under the face's atom and append it to the board. It writes nothing
 * else: no canon read gates it and no canon document moves.
 */
export async function offerCanonRecords(ports: CanonOfferPorts & {
  readonly source: OfferRecordReader;
  readonly signer: OfferSigner;
  readonly face:   string;
}, args: { readonly bag: string; readonly titles: readonly string[] }): Promise<CanonOfferOutcome> {
  const bag = bagOf(args.bag);
  if (!isHouseCanonBag(bag)) throw new CanonOfferRefused("offer-not-canon", `${bag} names no house-canon bag; an offer goes toward house canon alone`);
  for (const title of args.titles) if (offerWithheldTitle(title)) throw new CanonOfferRefused("offer-withheld-title", `"${title}" stays home (a withheld or cap/** title never leaves it)`);
  const records: Array<{ record: LarTiddlerRecord; base: string | null }> = [];
  for (const title of args.titles) {
    const record = await ports.source.get(title);
    if (!record || record.meta?.deleted === true) throw new CanonOfferRefused("offer-not-in-source", `the working layer holds no live record of "${title}"`);
    records.push({ record, base: overrideBaseOf(record) });
  }
  const body = openCanonOffer({ nexus: ports.nexus, bag, face: ports.face, offerer: ports.signer.key, records });
  const offer = await signCanonOffer(body, ports.signer);
  let landed = false;
  ports.board.change((draft) => { landed = writeCanonOffer(draft, offer); });
  return { offer, landed };
}

/** One row of a listing: the offer, its retire, and each record's freshness against canon now. */
export interface CanonOfferListing {
  readonly cid:      string;
  readonly bag:      string;
  readonly face:     string;
  readonly offerer:  string;
  readonly retired:  { readonly steward: string; readonly retire: string } | null;
  /** Retires the table carries for this offer that count nothing (`retire-unauthorised`: no charter seat sealed them). */
  readonly refusedRetires: CanonOfferStanding["refusedRetires"];
  readonly records:  ReadonlyArray<{ readonly title: string; readonly digest: string; readonly base: string | null; readonly freshness: OfferFreshness }>;
  /** True where any record reads `canon-is-fresher`: a warning, never a refusal. */
  readonly fresher:  boolean;
}

async function freshnessRows(ports: CanonOfferPorts, offer: CanonOffer) {
  const canon = await ports.canon(offer.body.bag);
  const rows = [];
  for (const r of offer.body.records) {
    const record = canon ? await canon.get(r.title) : null;
    rows.push({ r, record, freshness: offerFreshness(r, canonDigestOf(record)) });
  }
  return rows;
}

/** LIST: every offer the board counts (open ones alone unless `all`), optionally for one bag, each record's freshness read now. */
export async function readCanonOffers(ports: CanonOfferPorts, args: { readonly bag?: string; readonly all?: boolean } = {}):
  Promise<{ readonly offers: readonly CanonOfferListing[]; readonly setAside: readonly CanonOfferSetAside[] }> {
  const want = args.bag === undefined ? null : bagOf(args.bag);
  const folded = foldCanonOffers(ports.board.doc(), ports.nexus);
  const offers: CanonOfferListing[] = [];
  for (const s of folded.offers) {
    if (want !== null && s.offer.body.bag !== want) continue;
    if (s.retired !== null && args.all !== true) continue;
    const rows = await freshnessRows(ports, s.offer);
    offers.push({
      cid: s.offer.cid, bag: s.offer.body.bag, face: s.offer.body.face, offerer: s.offer.body.offerer,
      retired: s.retired ? { steward: s.retired.body.steward, retire: s.retired.cid } : null,
      refusedRetires: s.refusedRetires,
      records: rows.map(({ r, freshness }) => ({ title: r.title, digest: r.digest, base: r.base, freshness })),
      fresher: rows.some((x) => x.freshness === "canon-is-fresher"),
    });
  }
  return { offers, setAside: folded.setAside };
}

function standingOf(ports: CanonOfferPorts, cid: string): CanonOfferStanding {
  const s = foldCanonOffers(ports.board.doc(), ports.nexus).offers.find((o) => o.offer.cid === cid.trim().toLowerCase());
  if (!s) throw new CanonOfferRefused("offer-unknown", `no offer under ${cid.slice(0, 16)}… counts on this Nexus's offer table`);
  return s;
}

/** SHOW: one offer, each record's freshness and its field diff against canon now. */
export async function showCanonOffer(ports: CanonOfferPorts, cid: string): Promise<CanonOfferListing & {
  readonly diffs: ReadonlyArray<{ readonly title: string; readonly fields: readonly OfferFieldDiff[] }>;
}> {
  const s = standingOf(ports, cid);
  const rows = await freshnessRows(ports, s.offer);
  return {
    cid: s.offer.cid, bag: s.offer.body.bag, face: s.offer.body.face, offerer: s.offer.body.offerer,
    retired: s.retired ? { steward: s.retired.body.steward, retire: s.retired.cid } : null,
    refusedRetires: s.refusedRetires,
    records: rows.map(({ r, freshness }) => ({ title: r.title, digest: r.digest, base: r.base, freshness })),
    fresher: rows.some((x) => x.freshness === "canon-is-fresher"),
    diffs: rows.map(({ r, record }) => ({ title: r.title, fields: offerDiff(r, record) })),
  };
}

export type CanonPromoteOutcome =
  | { readonly moved: false; readonly cid: string; readonly retire: string; readonly why: "retired" }
  | { readonly moved: true; readonly cid: string; readonly bag: string; readonly wrote: readonly string[]; readonly already: readonly string[]; readonly over: ReadonlyArray<{ readonly title: string; readonly canon: string | null }> };

/**
 * PROMOTE (the steward's Kahu hand): clear the Kahu reach on the offer's bag FIRST (a non-steward face refuses `kahu-reach` before
 * a single canon read decides anything), decide, and write the offered bytes into canon. It writes no retire: the RETIRE seals
 * under a seat of the Nexus's charter (`retireCanonOffer`), which the steward's vessel holds where the canon write's island does
 * not. Until the retire lands the offer reads open, and a replayed promotion writes nothing (every record reads `landed`).
 */
export async function promoteCanonOffer(ports: CanonOfferPorts & {
  /** The Kahu reach for one bag (`requireKahuReach` over the vessel's source): throws for a hand outside the cabal. */
  readonly requireReach: (bag: string) => Promise<void>;
  readonly canonWrite:   (bag: string) => Promise<OfferRecordWriter | null>;
}, args: { readonly cid: string; readonly overFresher?: boolean }): Promise<CanonPromoteOutcome> {
  // The bag the reach clears comes off the board's row; a row that fails verification names no bag, and so reaches no canon.
  const s = standingOf(ports, args.cid);
  await ports.requireReach(s.offer.body.bag);
  const canon = await ports.canon(s.offer.body.bag);
  const digests = new Map<string, string | null>();
  for (const r of s.offer.body.records) digests.set(r.title, canonDigestOf(canon ? await canon.get(r.title) : null));
  const decision = decideCanonPromote({ standing: s, canonDigest: (t) => digests.get(t) ?? null, overFresher: args.overFresher === true });
  if (decision.act === "held") return { moved: false, cid: s.offer.cid, retire: decision.retire.cid, why: "retired" };
  if (decision.act === "refuse") {
    throw new CanonOfferRefused("offer-base-moved", `${CANON_IS_FRESHER} under ${decision.fresher.join(", ")}: read the diff (\`lares meme offer show\`), then promote with an explicit choice (--over-fresher) or leave the offer open`);
  }
  if (decision.writes.length > 0) {
    const writer = await ports.canonWrite(s.offer.body.bag);
    if (!writer) throw new Error(`canon-offer: ${s.offer.body.bag} reaches no writable canon store here`);
    for (const r of decision.writes) await writer.put(canonRecordOf(r));
  }
  return { moved: true, cid: s.offer.cid, bag: s.offer.body.bag, wrote: decision.writes.map((r) => r.title), already: decision.landed.map((r) => r.title), over: decision.over };
}

export type CanonRetireOutcome =
  | { readonly retired: false; readonly cid: string; readonly retire: string; readonly why: "retired" }
  | { readonly retired: true; readonly cid: string; readonly retire: string };

/**
 * RETIRE (the steward's seat): only once canon carries every offered digest (`offer-not-landed` otherwise: a retire never runs
 * ahead of the canon write it records), seal a retire under a seat of the Nexus's charter, proven by the lineage it carries, and
 * land it keyed to the offer's CID and its own. A seat the lineage does not prove refuses `offer-retire-unseated` before it signs.
 * A replay meets the standing retire and lands nothing.
 */
export async function retireCanonOffer(ports: CanonOfferPorts & { readonly steward: OfferSteward },
  args: { readonly cid: string; readonly over?: ReadonlyArray<{ readonly title: string; readonly canon: string | null }> }): Promise<CanonRetireOutcome> {
  const s = standingOf(ports, args.cid);
  if (s.retired !== null) return { retired: false, cid: s.offer.cid, retire: s.retired.cid, why: "retired" };
  const proven = rosterOfLineage(ports.nexus, ports.steward.lineage, ports.steward.epoch);
  if (!proven.ok || !proven.roster.keys.includes(ports.steward.key)) {
    throw new CanonOfferRefused("offer-retire-unseated", `the key ${ports.steward.key.slice(0, 16)}… stands no seat of this Nexus's charter at that epoch, so it retires nothing`);
  }
  const canon = await ports.canon(s.offer.body.bag);
  const unlanded: string[] = [];
  for (const r of s.offer.body.records) if (!sameDigest(canonDigestOf(canon ? await canon.get(r.title) : null), r.digest)) unlanded.push(r.title);
  if (unlanded.length > 0) throw new CanonOfferRefused("offer-not-landed", `canon does not yet carry ${unlanded.join(", ")}; promote first, then retire`);
  const retire = await signCanonOfferRetire({
    kind: CANON_OFFER_RETIRE_DOMAIN, nexus: ports.nexus, offer: s.offer.cid, steward: ports.steward.key, epoch: ports.steward.epoch,
    landed: s.offer.body.records.map((r) => ({ title: r.title, digest: r.digest })), over: [...(args.over ?? [])],
  }, ports.steward);
  ports.board.change((draft) => { writeCanonOfferRetire(draft, retire); });
  return { retired: true, cid: s.offer.cid, retire: retire.cid };
}

// ── THE RELEASE WIRING ────────────────────────────────────────────────────────────────────────────────

/** The ports a floor cut reads: the floor the chain stands on, each house-canon slug's live rows, and the CAS the release reads. */
export interface ReleaseFloorPorts {
  /** The floor the next release builds over: the chain head's manifest where one counts, else the vessel's pinned floor. */
  readonly prior:     () => Promise<{ readonly manifestCid: string; readonly bytes: Uint8Array } | null>;
  /** One house-canon slug's live rows off its canon document, or null where this vessel reaches no such document. */
  readonly canonRows: (slug: string) => Promise<Readonly<Record<string, LarTiddlerRecord>> | null>;
  /** Stage the cut's blobs (the manifest and each fresh snapshot) where the release door and the porch read them. */
  readonly stage:     (blobs: ReadonlyArray<{ readonly cid: string; readonly bytes: Uint8Array }>) => Promise<void>;
}

/**
 * CUT THE FLOOR A RELEASE NAMES, from live canon (a promotion's writes among it): every slug the prior floor names re-cuts off its
 * canon document, a slug this vessel reaches no document for keeps the prior snapshot (named in `kept`), and the blobs stage
 * BEFORE the manifest answers, so `nexus release` finds the floor whole. Cutting an unmoved canon answers the prior's own CID.
 */
export async function cutReleaseFloor(ports: ReleaseFloorPorts): Promise<{
  readonly manifestCid: string; readonly manifestBytes: Uint8Array; readonly prior: string;
  readonly cut: readonly string[]; readonly kept: readonly string[]; readonly moved: readonly string[];
}> {
  const prior = await ports.prior();
  if (prior === null) throw new Error("floor-cut refused: no prior floor stands here (no genesis floor and no release), so a cut has no engine to carry");
  const opened = readFloorManifest(prior.bytes);
  if ("refusal" in opened) throw new Error(`floor-cut refused: the prior floor reads unread (${opened.refusal})`);
  const canon: Record<string, Readonly<Record<string, LarTiddlerRecord>>> = {};
  const kept: string[] = [];
  for (const slug of floorSlugs(opened.manifest)) {
    const rows = await ports.canonRows(slug);
    if (rows === null) kept.push(slug); else canon[slug] = rows;
  }
  const cut = cutCanonFloor({ prior: opened.manifest, canon });
  await ports.stage([...Object.values(cut.snapshots).map((s) => ({ cid: s.cid, bytes: s.bytes })), { cid: cut.manifestCid, bytes: cut.manifestBytes }]);
  const moved = Object.keys(canon).filter((slug) => cut.manifest.snapshots[slug] !== opened.manifest.snapshots[slug]).sort();
  return { manifestCid: cut.manifestCid, manifestBytes: cut.manifestBytes, prior: prior.manifestCid, cut: Object.keys(canon).sort(), kept, moved };
}
