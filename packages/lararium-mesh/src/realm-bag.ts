/**
 * realm-bag — a bag two operators keep THROUGH a relation, registered on the realm's shared CRDT.
 *
 * THE RULING (scale-stories-basket-one#/exit, 2026-09-11): "the shared bag registers in the realm's shared
 * CRDT, @crossroads names only that it exists, read at CONTRACT". Three planes, never fused
 * (cabal-realm#six-joints): the CABAL is the collective, the REALM its shared CRDT and resources, the NEXUS the
 * hardware. A bag two households keep is stuff held in common — it belongs to the REALM plane.
 *
 * THE REALM DOC. `REALM_DOC_URI` names the pointer namespace; each realm uses its own doc pointer there. Its id DERIVES from the charter both stewards hold: the GENESIS epoch of the seal lineage
 * (the inception, fixed across every rotation — the realm's NAME), so every member computes one address from
 * the charter alone and no registry has to be consulted to find it (`realmDocUrl`). Every vessel that stands
 * in the charter materializes it at boot and on its after-write refold; a vessel that never held the charter never
 * names it.
 *
 * THE REGISTRATION RECORD (`REALM_BAG_DOMAIN`, minted in the registry): `{ realmId, bagUri, docUrl, keptBy, readTier }`, signed by
 * EVERY steward it names (n-of-n — a steward is named only by her own hand; a record that names a steward who
 * never signed is CONSCRIPTION and never counts). Records ACCRETE under distinct keys (one per signing steward,
 * and a record still short of a seal under a key of its own, so a proposal never unseats a counted record and
 * a hostile member overwrites nothing); the FOLD adjudicates — one registration per bag stands. Counted
 * registrations that agree on the doc fold to the WIDEST consented set: the one whose `keptBy` holds every
 * other's. Two that name DIFFERENT docs, and two whose steward sets neither hold the other, EQUIVOCATE and
 * the bag stands unregistered (a tie never grants, the carriage fold's own law).
 *
 * WHO A STEWARD READS AS (`steward-seal`). A name in `keptBy` reads one of two classes and nothing else: the key
 * the steward's WORN FACE presents at the Nexus this realm stands under, for a bag one person keeps; or a quorum
 * HANDLE's prefix, for a bag the collective keeps. A persona root never stands here: the realm doc crosses to
 * every member and the announce names `keptBy` in public, so whatever key a record carries gets published.
 *
 * WHAT @CROSSROADS CARRIES: `{ bagUri, keptBy }` — that a ford stands here and who keeps it — never the doc,
 * never a tiddler, never the read cap (`crossroadsAnnounceOf`).
 *
 * THE READ CAP: CONTRACT — `{your-fleet ∪ a-cabal}` (cap-tier.ts). At the wire the `RealmBagGate` federates
 * the realm doc and each registered bag's doc to a peer the nexus-doc consult names a MEMBER, and to nobody
 * else: a stranger draws the same denial as any private plane. The gate is a pure predicate over verified
 * registrations; it holds no key and grants nothing the stewards did not sign.
 *
 * THE WRITE CAP: the named stewards' set. This module names it in the record (`keptBy`); the composite's
 * writable-layer law enforces it on the island (`meme put` to a bag the island mounts no writable layer for
 * refuses — `meme-sinks.ts`).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/realm-bag-brief
 */

import type { DocumentId, PeerId, AutomergeUrl } from "@automerge/automerge-repo";
import { REALM_BAG_DOMAIN, REALM_BAG_ANNOUNCE_DOMAIN } from "./domains.js";
import { interpretAsDocumentId } from "@automerge/automerge-repo";
import { canonicalJsonBytes } from "./crypto.js";
import { deterministicDocUrl } from "./deterministic-doc.js";
import { bagUri } from "./lar-uris.js";
import { tiddlerText, type LarDoc } from "./base-doc.js";
import {
  coerceStewardSeal, sealAsSteward, verifyStewardSeal,
  type StewardSeal, type StewardSealReading, type StewardSigner,
} from "./steward-seal.js";
import type { FederationGate, NexusMembership } from "./federation-gate.js";
import type { CapTier } from "./cap-tier.js";
import { storedLarRecord } from "./stored-record.js";

/** The realm plane's pointer namespace on a vessel's oracle plane. */
export const REALM_DOC_URI = bagUri("realm");

/** The oracle-plane tiddler carrying the realm id the pointer stands for — read off the vessel's OWN plane,
 *  never off the realm doc (a member who could rewrite the id there could make a foreign record count). */
export const REALM_ID_TIDDLER = `${REALM_DOC_URI}/realm-id`;

/** A cabal realm's id: 64 lower-case hex. The charter-derived realm wears its Nexus's AID, any other token. */
export const CABAL_REALM_RE = /^[0-9a-f]{64}$/;
/** The oracle-plane key that names one realm's shared doc. */
export function realmDocPointer(realmId: string): string { return `${REALM_DOC_URI}/doc/${encodeURIComponent(realmId)}`; }
/** The oracle-plane key that names THIS vessel's own steward in one realm. */
export function realmStewardPointer(realmId: string): string { return `${REALM_DOC_URI}/steward/${encodeURIComponent(realmId)}`; }
/** The oracle-plane key that carries one realm's STANDING registrations as this vessel's own plane folded them. */
export function realmStandingPointer(realmId: string): string { return `${REALM_DOC_URI}/standing/${encodeURIComponent(realmId)}`; }
/** Land a realm's standing registrations on the vessel's OWN plane draft: a JSON array sorted by bagUri.
 *  Returns false and writes nothing when the stored text already equals it. Call INSIDE `handle.change()`. */
export function writeRealmStanding(draft: LarDoc, realmId: string, standing: ReadonlyMap<string, RealmBagRegistration>): boolean {
  const key = realmStandingPointer(realmId);
  const text = JSON.stringify([...standing.values()].sort((a, b) => a.bagUri < b.bagUri ? -1 : a.bagUri > b.bagUri ? 1 : 0));
  if (tiddlerText(draft.tiddlers[key]) === text) return false;
  draft.tiddlers[key] = storedLarRecord(key, { text }, realmId);
  return true;
}
/** Read standing registrations back from that text: each element coerced at the registration's exact floor shape
 *  (reuse the module's own `coerceRegistration`), keyed by bagUri; a torn text, a non-array, and a torn element read as nothing. */
export function readRealmStanding(text: string | null | undefined): ReadonlyMap<string, RealmBagRegistration> {
  if (typeof text !== "string") return new Map();
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return new Map(); }
  if (!Array.isArray(parsed)) return new Map();
  const out = new Map<string, RealmBagRegistration>();
  for (const item of parsed) { const rec = coerceRegistration(item); if (rec) out.set(rec.bagUri, rec); }
  return out;
}

/**
 * The doc url a realm's STANDING registration names for `bagUri`, read off a vessel's OWN catalog: the realm id the
 * vessel stands in, its pinned realm-doc pointer (a realm the vessel left reads none), and the standing verdict the
 * vessel's own plane folded. Null where the vessel stands in no realm, holds no verdict, or no registration stands for
 * the bag. A reader that wants the live system documents asks the Kahu predicate first: this names a url, never a reach.
 */
export function realmStandingDocUrl(catalog: LarDoc | undefined | null, bagUri: string): string | null {
  const realmId = tiddlerText(catalog?.tiddlers?.[REALM_ID_TIDDLER]);
  if (!realmId) return null;
  if (tiddlerText(catalog?.tiddlers?.[realmDocPointer(realmId)]) !== realmDocUrl(realmId)) return null;
  return readRealmStanding(tiddlerText(catalog?.tiddlers?.[realmStandingPointer(realmId)])).get(bagUri)?.docUrl ?? null;
}

/** The signing / content domain of a realm-bag registration — minted in the registry (`domains.ts`). */
export { REALM_BAG_DOMAIN };

/** The tiddler prefix registrations accrete under on the realm doc. */
export const REALM_BAG_PREFIX = "lar:///ha.ka.ba/dreamnet/realm-bags/" as const;

/** The tiddler prefix the @crossroads announce rides under — `{ bagUri, keptBy }` and nothing more. */
export const REALM_BAG_ANNOUNCE_PREFIX = "lar:///ha.ka.ba/dreamnet/realm-bag-announce/" as const;

/** The steward's seal and signer, and the reading of a steward's name: the record's own vocabulary. */
export { stewardClassOf, type StewardClass, type StewardSeal, type StewardSealReading, type StewardSigner } from "./steward-seal.js";

/** The most text one stored registration may hold. A larger tiddler reads as no record: a member's write to
 *  the shared doc never buys unbounded parsing. */
export const REALM_BAG_RECORD_MAX = 256 * 1024;

/** A steward's name as a record carries it: trimmed and lower-case. */
const stewardName = (name: string): string => name.trim().toLowerCase();

// ── THE REALM'S NAME ─────────────────────────────────────────────────────────────────────────────

// A realm's id IS its Nexus AID (`nexusAidOf`, nexus-seal-seed): one name for one Nexus.

/** The realm's shared-CRDT doc URL — deterministic from the realm id, so every member resolves ONE doc. */
export function realmDocUrl(realmId: string): AutomergeUrl {
  return deterministicDocUrl(`${REALM_DOC_URI}#${realmId}`);
}

// ── THE REGISTRATION RECORD ──────────────────────────────────────────────────────────────────────

export interface RealmBagRegistration {
  readonly kind:       typeof REALM_BAG_DOMAIN;
  /** The realm this registration lives in — a record carried onto another realm's doc never counts. */
  readonly realmId:    string;
  /** The bag's lar: URI — the name both sides ask by (`meme get --bag lares`). */
  readonly bagUri:     string;
  /** The Automerge doc URL the bag's tiddlers live in — the doc the members replicate. */
  readonly docUrl:     string;
  /** The stewards' NAMES, the write set: each the key its steward's worn face presents at this realm's Nexus,
   *  or a quorum Handle's prefix (`stewardClassOf`). Never a persona root. Every one of them seals. */
  readonly keptBy:     readonly string[];
  /** The declared read tier — CONTRACT (a realm bag reads to the contracted cabal), or PUBLIC for a book the
   *  Herm carries BY HASH (the pointer travels; the doc still crosses on the realm's own lane). */
  readonly readTier:   CapTier;
  /**
   * Beside each steward nym, the CHARTER (realm id) that hand holds. OMITTED when every steward holds THIS
   * realm's charter — the single-charter realm, whose canonical bytes then read exactly as they read before
   * the field existed. A book spanning two charters is a `keptBy` with TWO charters, never a fused realm:
   * the realm leg federates it to a holder of EITHER charter, and each realm keeps its own name.
   */
  readonly charters?:  Readonly<Record<string, string>>;
  /**
   * The registration's LEASE, in ROLLS of the realm's own maintenance feed (`realmPace` — an order, never a
   * wall-clock instant). Past it the WRITE side lapses and the book reads on: a read-only book, re-keepable by
   * a fresh n-of-n. Absent → the registration stands at every pace (today's records, unmoved).
   */
  readonly expiry?:    number;
  /** One seal per steward in `keptBy`, over `realmBagBytes(record)` (`verifyStewardSeal`). */
  readonly signatures: readonly StewardSeal[];
}

/** The charter a named hand holds — the record's own `charters` entry, else the realm the record lives in. */
export function charterOfSteward(rec: Omit<RealmBagRegistration, "signatures">, nym: string): string {
  return rec.charters?.[nym.toLowerCase()] ?? rec.charters?.[nym] ?? rec.realmId;
}

/** Every charter this registration's hands hold — the realm's own, plus each hand that keeps it under another. */
export function registrationCharters(rec: Omit<RealmBagRegistration, "signatures">): ReadonlySet<string> {
  const out = new Set<string>([rec.realmId]);
  for (const steward of rec.keptBy) out.add(charterOfSteward(rec, steward));
  return out;
}

/** Does this registration stand for the WRITE at the realm's pace? An absent expiry stands at every pace; a
 *  reader that names no pace reads the lease as unexpired (it cannot judge, so it never narrows). */
export function registrationWriteStands(rec: RealmBagRegistration, pace?: number | null): boolean {
  if (rec.expiry === undefined) return true;
  if (pace === undefined || pace === null) return true;
  return pace <= rec.expiry;
}

/** The canonical bytes every steward signs — the record without its signatures. */
export function realmBagBytes(parts: Omit<RealmBagRegistration, "signatures">): Uint8Array {
  // A charter map that names THIS realm for every hand says nothing the record does not already say, so it
  // drops out of the image: a single-charter realm signs the bytes it signed before the field existed.
  const charters: Record<string, string> = {};
  for (const [nym, charter] of Object.entries(parts.charters ?? {})) {
    if (charter !== parts.realmId) charters[nym.toLowerCase()] = charter;
  }
  const foreign = Object.keys(charters).length > 0;
  return canonicalJsonBytes({
    kind:     REALM_BAG_DOMAIN,
    realmId:  parts.realmId,
    bagUri:   parts.bagUri,
    docUrl:   parts.docUrl,
    keptBy:   [...parts.keptBy].map((n) => n.toLowerCase()).sort(),
    readTier: parts.readTier,
    ...(foreign ? { charters } : {}),
    ...(parts.expiry === undefined ? {} : { expiry: parts.expiry }),
  });
}

/**
 * Seal a registration with the stewards' own signers. Each signer names its steward; the record's `keptBy`
 * reads exactly the signers' names (a steward is named by her own hand). The module holds no key. A signer
 * whose name reads neither class throws (`sealAsSteward`).
 */
export async function signRealmBagRegistration(
  parts: Pick<RealmBagRegistration, "realmId" | "bagUri" | "docUrl" | "readTier"> & Partial<Pick<RealmBagRegistration, "charters" | "expiry">>,
  signers: readonly StewardSigner[],
): Promise<RealmBagRegistration> {
  const keptBy = signers.map((s) => stewardName(s.signer)).sort();
  const unsigned = { kind: REALM_BAG_DOMAIN, ...parts, keptBy } as Omit<RealmBagRegistration, "signatures">;
  const bytes = realmBagBytes(unsigned);
  const signatures: StewardSeal[] = [];
  for (const s of signers) signatures.push(await sealAsSteward({ ...s, signer: stewardName(s.signer) }, bytes));
  return { ...unsigned, signatures };
}

/**
 * PROPOSE a registration that names a steward whose hand has not signed yet. The proposal carries the FULL
 * `keptBy` (the signers plus the proposed) and only the signers' signatures, so it does NOT count — naming a
 * second steward is n-of-n and takes two hands. It lands on the realm doc under the PROPOSER's own key,
 * where the proposed steward reads it and completes it with `coSignRealmBagRegistration` on her own next
 * present. The bytes never move between the two hands: `realmBagBytes` reads the sorted `keptBy` alone.
 */
export async function proposeRealmBagRegistration(
  parts: Pick<RealmBagRegistration, "realmId" | "bagUri" | "docUrl" | "readTier"> & Partial<Pick<RealmBagRegistration, "charters" | "expiry">>,
  signers: readonly StewardSigner[],
  proposed: readonly string[],
): Promise<RealmBagRegistration> {
  const keptBy = [...new Set([...signers.map((s) => s.signer), ...proposed].map(stewardName))].sort();
  const unsigned = { kind: REALM_BAG_DOMAIN, ...parts, keptBy } as Omit<RealmBagRegistration, "signatures">;
  const bytes = realmBagBytes(unsigned);
  const signatures: StewardSeal[] = [];
  for (const s of signers) signatures.push(await sealAsSteward({ ...s, signer: stewardName(s.signer) }, bytes));
  return { ...unsigned, signatures };
}

/**
 * ACCRETE one more steward's consent onto a standing proposal — the co-sign that rhymes with `HandleCoSig`:
 * the proposer names the message, the named hand consents to the EXACT bytes. A signer the record never
 * named adds a signature that verifies over nothing the fold counts, so the completed record still fails
 * closed. Returns a new record; the input never moves.
 */
export async function coSignRealmBagRegistration(
  rec: RealmBagRegistration,
  cosigner: StewardSigner,
): Promise<RealmBagRegistration> {
  const nym = stewardName(cosigner.signer);
  const bytes = realmBagBytes(rec);
  const signatures = [...rec.signatures.filter((s) => stewardName(s.signer) !== nym), await sealAsSteward({ ...cosigner, signer: nym }, bytes)];
  return { ...rec, signatures };
}

/** What a fold may hand the seal verifier beyond the record itself: this reader's own knowledge of a Handle
 *  steward (`StewardSealReading`). A face steward's seal reads the same with or without it. */
export type RealmBagFoldOptions = StewardSealReading & {
  /**
   * THE VESSEL'S PRIVATE DOCUMENTS, by id (lane `ralias`): true where this reader classes the document `vessel-private`
   * (its daemon document, a face's plane, its catalog). A registration naming one never counts here, whoever sealed it:
   * a seal proves who keeps a book, never that the book is theirs to register. The share guard withholds the document
   * either way; this refusal keeps the fold from seating it. A consult that throws refuses (fail closed).
   */
  readonly vesselPrivate?: (documentId: string) => boolean;
};

/**
 * Does this registration COUNT for `realmId`? Fail-closed at every shore: a foreign realm, an empty steward
 * set, a name that reads neither class or that the record spells twice, a tier this fold does not know, a
 * document this reader classes vessel-private, a steward with no verifying seal, a seal under a name the record does
 * not keep — each reads false. n-of-n and
 * nothing beside it: every named steward sealed, once, and no other hand stands on the record.
 */
export async function realmBagRegistrationCounts(
  rec: RealmBagRegistration, realmId: string, opts?: RealmBagFoldOptions,
): Promise<boolean> {
  if (rec.kind !== REALM_BAG_DOMAIN) return false;
  if (rec.realmId !== realmId) return false;
  if (rec.keptBy.length === 0) return false;
  if (rec.readTier !== "contract" && rec.readTier !== "personagroup" && rec.readTier !== "veil" && rec.readTier !== "public") return false;
  // A charter map names ONLY hands the record keeps, each under a non-empty charter — a stray name grants nothing.
  for (const [nym, charter] of Object.entries(rec.charters ?? {})) {
    if (typeof charter !== "string" || charter.length === 0) return false;
    if (!rec.keptBy.some((s) => s.toLowerCase() === nym.toLowerCase())) return false;
  }
  // A lease reads as a ROLL COUNT — a torn one reads as no lease at all, which would widen the write.
  if (rec.expiry !== undefined && (!Number.isInteger(rec.expiry) || rec.expiry < 0)) return false;
  if (!rec.bagUri.startsWith("lar:///") || !rec.docUrl.startsWith("automerge:")) return false;
  if (opts?.vesselPrivate) {
    try {
      if (opts.vesselPrivate(String(interpretAsDocumentId(rec.docUrl as AutomergeUrl)))) return false;
    } catch { return false; }
  }
  const bytes = realmBagBytes(rec);
  // EXACTLY THE KEPT NAMES, EACH ONCE, IN THEIR CANONICAL SPELLING. A name the record spells twice, a name in
  // another case (the seal's own verifier reads the name's class), and a seal under a name the record does not
  // keep each refuse: a counted record carries its stewards' seals and no other key.
  if (new Set(rec.keptBy).size !== rec.keptBy.length) return false;
  if (rec.signatures.length !== rec.keptBy.length) return false;
  for (const steward of rec.keptBy) {
    const seal = rec.signatures.find((s) => s.signer === steward);
    if (!seal) return false;
    if (!(await verifyStewardSeal(seal, steward, bytes, opts)).ok) return false;
  }
  return true;
}

/**
 * How far a record's consent stands: its KEPT names whose own seal verifies over the record's bytes. A counted
 * record reads every kept name; a proposal reads fewer; a seal under a name the record does not keep, and a
 * seal that fails, add nobody.
 */
export async function realmBagSealedBy(rec: RealmBagRegistration, opts?: RealmBagFoldOptions): Promise<readonly string[]> {
  const bytes = realmBagBytes(rec);
  const sealed: string[] = [];
  for (const steward of new Set(rec.keptBy)) {
    const seal = rec.signatures.find((s) => s.signer === steward);
    if (seal && (await verifyStewardSeal(seal, steward, bytes, opts)).ok) sealed.push(steward);
  }
  return sealed;
}

// ── THE DOC FACE ─────────────────────────────────────────────────────────────────────────────────

/** The tiddler key one registration accretes under — per bag AND per first-signing steward, so a second
 *  hand never overwrites a standing record; the fold adjudicates. */
export function realmBagKey(bagUri: string, steward: string): string {
  return `${REALM_BAG_PREFIX}${encodeURIComponent(bagUri)}/${steward.toLowerCase()}`;
}

/** The tiddler key a record STILL SHORT OF A SEAL accretes under: its own key beside the writer's counted one,
 *  so a proposal, and a co-sign that leaves a hand still owed, never unseat the record that stands. */
export function realmBagProposalKey(bagUri: string, steward: string): string {
  return `${realmBagKey(bagUri, steward)}~proposal`;
}

/** Land a signed registration on the realm doc draft under the WRITING hand's key (`by`; the first named
 *  steward when a caller names none): the counted key for a record that COUNTS, else the proposal key. A
 *  writer that verified the record says so in `counts` (`realmBagRegistrationCounts`), and a record it read
 *  short never lands over a counted one, whatever its seal count looks like. Absent, the key follows the
 *  record's shape: one seal per kept name. A co-signer's completed record accretes beside the proposal it
 *  completes rather than over it — the fold, never a write, adjudicates. Call INSIDE `handle.change()`. */
export function writeRealmBagRegistration(draft: LarDoc, rec: RealmBagRegistration, by?: string, counts?: boolean): void {
  const writer = by ?? rec.keptBy[0] ?? "";
  const whole = counts ?? (rec.signatures.length === rec.keptBy.length);
  const key = whole ? realmBagKey(rec.bagUri, writer) : realmBagProposalKey(rec.bagUri, writer);
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(rec) }, rec.realmId);
}

/** A parsed payload reads a registration only at the exact floor shape — extra fields drop, a torn one skips. */
function coerceRegistration(parsed: unknown): RealmBagRegistration | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (p["kind"] !== REALM_BAG_DOMAIN) return null;
  if (typeof p["realmId"] !== "string" || typeof p["bagUri"] !== "string" || typeof p["docUrl"] !== "string") return null;
  if (typeof p["readTier"] !== "string") return null;
  if (!Array.isArray(p["keptBy"]) || !p["keptBy"].every((n) => typeof n === "string")) return null;
  if (!Array.isArray(p["signatures"])) return null;
  const signatures: StewardSeal[] = [];
  for (const raw of p["signatures"]) {
    const sig = coerceStewardSeal(raw);
    if (sig === null) return null;
    signatures.push(sig);
  }
  const charters = p["charters"];
  const expiry   = p["expiry"];
  if (charters !== undefined && (typeof charters !== "object" || charters === null || Array.isArray(charters))) return null;
  if (charters !== undefined && !Object.values(charters as Record<string, unknown>).every((v) => typeof v === "string")) return null;
  if (expiry !== undefined && typeof expiry !== "number") return null;
  return {
    kind: REALM_BAG_DOMAIN, realmId: p["realmId"], bagUri: p["bagUri"], docUrl: p["docUrl"],
    keptBy: p["keptBy"] as string[], readTier: p["readTier"] as CapTier, signatures,
    ...(charters === undefined ? {} : { charters: charters as Record<string, string> }),
    ...(expiry   === undefined ? {} : { expiry:   expiry   as number }),
  };
}

/** A registration's bytes as a kept file or a row holds them, read at the exact floor shape; torn or foreign bytes read null. */
export function parseRealmBagRegistration(text: string): RealmBagRegistration | null {
  if (text.length > REALM_BAG_RECORD_MAX) return null;
  try { return coerceRegistration(JSON.parse(text)); } catch { return null; }
}

/** Every well-formed registration the realm doc carries (unverified — the fold decides trust). */
export function realmBagRegistrationsFromDoc(doc: LarDoc | undefined | null): RealmBagRegistration[] {
  const tiddlers = doc?.tiddlers;
  if (!tiddlers) return [];
  const out: RealmBagRegistration[] = [];
  for (const [title, record] of Object.entries(tiddlers)) {
    if (!title.startsWith(REALM_BAG_PREFIX)) continue;
    const text = tiddlerText(record);
    if (text === null || text.length > REALM_BAG_RECORD_MAX) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { continue; }
    const rec = coerceRegistration(parsed);
    if (rec) out.push(rec);
  }
  return out;
}

/**
 * Fold the realm doc into the STANDING registrations, keyed by bag URI. Only counted records participate.
 * Counted records for one bag that agree on the doc fold to the WIDEST consented set: the record whose
 * `keptBy` holds every other's (each wider record carries the narrower one's stewards' own seals, so each of
 * them consented to it). Records that name DIFFERENT docs, and records whose steward sets neither hold the
 * other, EQUIVOCATE and the bag stands UNREGISTERED (fail-closed — a tie never grants). The answer never
 * leans on the order a doc lists its tiddlers in.
 */
export async function foldRealmBags(
  doc: LarDoc | undefined | null, realmId: string, opts?: RealmBagFoldOptions,
): Promise<ReadonlyMap<string, RealmBagRegistration>> {
  const counted = new Map<string, RealmBagRegistration[]>();
  for (const rec of realmBagRegistrationsFromDoc(doc)) {
    if (!(await realmBagRegistrationCounts(rec, realmId, opts))) continue;
    (counted.get(rec.bagUri) ?? (counted.set(rec.bagUri, []), counted.get(rec.bagUri)!)).push(rec);
  }
  const standing = new Map<string, RealmBagRegistration>();
  for (const [bag, recs] of counted) {
    if (recs.some((r) => r.docUrl !== recs[0]!.docUrl)) continue;                       // two docs under one name
    const holds = (wide: RealmBagRegistration, narrow: RealmBagRegistration): boolean =>
      narrow.keptBy.every((name) => wide.keptBy.includes(name));
    const widest = recs.find((r) => recs.every((other) => holds(r, other)));
    if (widest) standing.set(bag, widest);                                              // none holds the rest → a tie
  }
  return standing;
}

/**
 * Has this steward SEALED HERE: does some record of this realm on the doc, counted or still short of a hand,
 * carry a seal under `name` that verifies over that record's own bytes? A name enters a realm record by its
 * own hand first, so a door that would write somebody else's name asks this before it writes: a key that
 * never sealed here stands unproven, whatever class its holder would read it as.
 */
export async function stewardSealedHere(
  doc: LarDoc | undefined | null, realmId: string, name: string, opts?: RealmBagFoldOptions,
): Promise<boolean> {
  for (const rec of realmBagRegistrationsFromDoc(doc)) {
    if (rec.realmId !== realmId) continue;
    const seal = rec.signatures.find((s) => s.signer === name);
    if (seal && (await verifyStewardSeal(seal, name, realmBagBytes(rec), opts)).ok) return true;
  }
  return false;
}

/**
 * THE WRITE CAP, read off the STANDING fold: exactly the stewards the counted registration names keep the
 * bag. Narrower than the read (CONTRACT reaches the whole contracted cabal) and never wider than the ruling:
 * an unregistered bag, an equivocal one, and a hand outside `keptBy` each answer false, so a caller that
 * draws false falls through to the path it walked before the realm carried anything.
 */
export function mayWriteRealmBag(
  standing: ReadonlyMap<string, RealmBagRegistration>, bagUri: string, nym: string | null | undefined,
  pace?: number | null,
): boolean {
  if (!nym) return false;
  const rec = standing.get(bagUri);
  if (!rec) return false;
  // THE LEASE, read at the realm's own pace: past its expiry the book turns read-only until a fresh n-of-n
  // re-keeps it. The read side never moves — an expired registration still names the doc every member reads.
  if (!registrationWriteStands(rec, pace)) return false;
  const want = nym.toLowerCase();
  return rec.keptBy.some((s) => s.toLowerCase() === want);
}

// ── THE @CROSSROADS ANNOUNCE ─────────────────────────────────────────────────────────────────────

/**
 * What the public plane carries about a realm bag — that it exists, who keeps it, and (for a PUBLIC-tier book
 * ALONE) the doc the book lives in.
 *
 * THE RULING (2026-09-13): "the @crossroads ANNOUNCE carries the doc url for PUBLIC-tier books only; the realm
 * doc never emits a public face; the Herm follows announces." A carrier reads the PUBLIC tier by hash, and the
 * declaration that a book reads public lives on the realm doc — which withholds from a carrier. So a carrier
 * could never learn WHICH books it may carry. The public plane closes that circle and nothing else moves: a
 * CONTRACT-tier announce carries `{ bagUri, keptBy }` exactly as before, and a public one adds only the address
 * of a book the registration already declared readable by hash to anyone.
 */
export interface RealmBagAnnounce {
  readonly kind:   typeof REALM_BAG_ANNOUNCE_DOMAIN;
  readonly bagUri: string;
  readonly keptBy: readonly string[];
  /** The book's doc url — present IFF the registration declared the PUBLIC tier. */
  readonly docUrl?: string;
}

export function realmBagAnnounceKey(bagUri: string): string {
  return `${REALM_BAG_ANNOUNCE_PREFIX}${encodeURIComponent(bagUri)}`;
}

/** The announce a registration projects onto @crossroads — the exists · kept-by pair, plus the doc for a
 *  PUBLIC-tier book alone; every tighter tier withholds the address exactly as it always did. */
export function crossroadsAnnounceOf(rec: RealmBagRegistration): RealmBagAnnounce {
  return {
    kind: REALM_BAG_ANNOUNCE_DOMAIN, bagUri: rec.bagUri, keptBy: [...rec.keptBy],
    ...(rec.readTier === "public" ? { docUrl: rec.docUrl } : {}),
  };
}

/** One PUBLIC book a carrier reads off the public plane: the bag's name and the doc it lives in. */
export interface PublicRealmBook {
  readonly bagUri: string;
  readonly docUrl: string;
}

/**
 * THE CARRIER'S FOLD — every PUBLIC book the @crossroads board announces, read off a carrier's OWN replica of
 * that board. A place that holds no charter and no realm doc learns here which books it may carry BY HASH, and
 * learns nothing else: an announce without a doc url (every tier tighter than PUBLIC) names no book, a torn
 * payload skips, and an empty board folds empty. The fold grants no read cap — the wire gate still decides
 * which documents cross, and the tier the REGISTRATION declared still decides what the shore serves.
 */
export function publicRealmBooksFromDoc(doc: LarDoc | undefined | null): PublicRealmBook[] {
  const tiddlers = doc?.tiddlers;
  if (!tiddlers) return [];
  const out: PublicRealmBook[] = [];
  for (const [title, record] of Object.entries(tiddlers)) {
    if (!title.startsWith(REALM_BAG_ANNOUNCE_PREFIX)) continue;
    const text = tiddlerText(record);
    if (text === null) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { continue; }
    if (typeof parsed !== "object" || parsed === null) continue;
    const p = parsed as Record<string, unknown>;
    if (p["kind"] !== REALM_BAG_ANNOUNCE_DOMAIN) continue;
    if (typeof p["bagUri"] !== "string" || !p["bagUri"].startsWith("lar:///")) continue;
    if (typeof p["docUrl"] !== "string" || !p["docUrl"].startsWith("automerge:")) continue;
    out.push({ bagUri: p["bagUri"], docUrl: p["docUrl"] });
  }
  return out;
}

/** Land the announce on the crossroads draft. Call INSIDE a `handle.change()` callback. */
export function writeRealmBagAnnounce(draft: LarDoc, rec: RealmBagRegistration): void {
  const key = realmBagAnnounceKey(rec.bagUri);
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(crossroadsAnnounceOf(rec)) }, "realm-bag");
}

// ── THE WIRE GATE ────────────────────────────────────────────────────────────────────────────────

/**
 * THE REALM'S OWN CONSULT — what a vessel knows, off its OWN replica, about the hand behind a wire key.
 *
 * `contractNymOfPeer` reads the vessel's ROOT MAP: a persona-root nym proven at its gate for that peer. It
 * never re-authenticates, never trusts a peer's word, and never reads the LEAF MAP the membership consult
 * reads — a leaf a socket proved is not a root, and no proof binding the two travels on the wire.
 * `holdsCharter` answers, off the vessel's OWN charter replica, whether that nym holds the named charter —
 * the CONTRACT-tier read. Neither question reaches the membership consult: that answers whether a SOCKET
 * stands, and this consult answers which DOCUMENTS the realm's own registration lets cross it.
 */
export interface RealmCharterConsult {
  /** The persona-root nym proven for this peer at the wire (the ROOT MAP), or null — fail-closed. A node that
   *  proves no root edge at its seat returns null for every peer. Never a leaf nym. */
  contractNymOfPeer(peerId: string): string | null;
  /** Does this nym hold that charter, read off this vessel's own charter replica (as of last sync)? */
  holdsCharter(nym: string, charterId: string): boolean;
  /**
   * OPTIONAL: does this peer stand on a socket THIS vessel opened to the hearth whose charter it holds? The
   * binding is the operator's own out-of-band act — the gate key this vessel dialed, plus the charter it
   * imported from that hearth — never anything the peer says about itself. It opens the realm's own registered
   * books back toward the charter's hearth (the return lane) and nothing else.
   */
  holdsCharterPeer?(peerId: string): boolean;
  /**
   * OPTIONAL: does this peer stand as a contracted CARRIER — a faceless PLACE that signed a carrier contract
   * with its own vessel key (`foldCarrierSet`)? Answered off this vessel's OWN board, never a peer's word.
   *
   * It opens EXACTLY ONE THING, and the gate below enforces the narrowing rather than this consult: a book
   * whose own standing registration declares the PUBLIC tier. Not CONTRACT, not the realm doc, not a read
   * cap — a carrier "holds the HINT, never the read-cap" (scale-stories-basket-one#/the-shared-bag), and a
   * world-readable book is bytes the world may already ask any hearth for. Absent → the gate answers exactly
   * as it answered before a carrier could contract at all.
   */
  carrierPeer?(peerId: string): boolean;
}

/**
 * RealmBagGate — a FederationGate over the realm plane: the realm doc and every STANDING registered bag's doc
 * federate on THREE lanes, each additive over a base gate (the deterministic public shelf; a doc the base
 * federates still federates):
 *
 *   · THE REALM LEG (the 2026-09-12 ruling) — the REALM's own registration decides which documents cross. A
 *     peer whose proven contract nym stands in the registration's `keptBy` reads the book it keeps (the write
 *     side), and a peer whose nym HOLDS one of the charters that registration names reads it at CONTRACT tier.
 *     Neither answer consults the members board, so a steward who contracted INTO a charter rather than
 *     admitting anybody federates the book back to the hand that keeps it with her — the return lane.
 *   · THE NEXUS LANE, unchanged — the members board stays the Nexus answer for every peer the realm's own
 *     registration does not name.
 *
 * The standing set swaps whole on `refold` (never a partial window).
 */
export class RealmBagGate implements FederationGate {
  #standing: ReadonlySet<DocumentId> = new Set<DocumentId>();
  #byDocId: ReadonlyMap<DocumentId, RealmBagRegistration> = new Map<DocumentId, RealmBagRegistration>();
  #registrations: ReadonlyMap<string, RealmBagRegistration> = new Map<string, RealmBagRegistration>();
  #realmId: string | null = null;
  readonly #realmDocId: DocumentId;
  readonly #charter: RealmCharterConsult | null;
  readonly #pace: (() => number | null) | null;
  readonly #sealReading: RealmBagFoldOptions | undefined;
  readonly #memberAside: ((peerId: string) => boolean) | null;
  readonly #stands: ((peerId: string) => boolean) | null;
  readonly #nexusLane: boolean;

  constructor(
    private readonly base: FederationGate,
    private readonly membership: NexusMembership,
    realmUrl: AutomergeUrl,
    opts?: {
      /** The realm's own consult — absent, the gate answers exactly as the Nexus lane alone answered. */
      readonly charter?: RealmCharterConsult;
      /** The realm's pace in rolls (`realmPace`) — the lease the write side reads against. */
      readonly pace?: () => number | null;
      /** What this vessel knows of a Handle that sealed (its own handle book): every refold reads a Handle
       *  steward's seal against it, so a seal under a head this vessel saw retired stops counting here. */
      readonly sealReading?: RealmBagFoldOptions;
      /**
       * THE MEMBER SHADOW (kapae#/reach): true when a shadow stands over this peer's own edge to the realm, or
       * no path of standing vouches reaches it. Every lane onto the realm's documents and bags then closes for
       * that peer — the charter's own hearth, the write side, CONTRACT, the carrier leg and the Nexus lane
       * alike — and the peer draws the same denial any private plane gives. Absent → no member reads as aside.
       */
      readonly memberAside?: (peerId: string) => boolean;
      readonly stands?: (peerId: string) => boolean;
      readonly nexusLane?: boolean;
    },
  ) {
    this.#realmDocId = interpretAsDocumentId(realmUrl) as DocumentId;
    this.#charter = opts?.charter ?? null;
    this.#pace = opts?.pace ?? null;
    this.#sealReading = opts?.sealReading;
    this.#memberAside = opts?.memberAside ?? null;
    this.#stands = opts?.stands ?? null;
    this.#nexusLane = opts?.nexusLane !== false;
  }

  /** Re-fold the standing registrations off a realm doc snapshot — the docs the realm and member lanes open for. */
  async refold(doc: LarDoc | undefined | null, realmId: string): Promise<void> {
    const next = new Set<DocumentId>();
    const byDoc = new Map<DocumentId, RealmBagRegistration>();
    this.#registrations = await foldRealmBags(doc, realmId, this.#sealReading);
    this.#realmId = realmId;
    for (const rec of this.#registrations.values()) {
      try {
        const id = interpretAsDocumentId(rec.docUrl as AutomergeUrl) as DocumentId;
        next.add(id);
        byDoc.set(id, rec);
      } catch { /* a malformed url registers nothing */ }
    }
    this.#standing = next;
    this.#byDocId = byDoc;
  }

  /** THE WRITE CAP at the holder: does this nym stand in the bag's counted `keptBy`, inside the lease? The
   *  read lane above answers CONTRACT (every charter holder); this answers the stewards' set alone. */
  mayWrite(bagUri: string, nym: string | null | undefined): boolean {
    return mayWriteRealmBag(this.#registrations, bagUri, nym, this.#pace?.() ?? null);
  }

  /** The standing registrations this gate folded, keyed by bag URI. */
  registrations(): ReadonlyMap<string, RealmBagRegistration> {
    return this.#registrations;
  }

  /** Does this document belong to the realm's own plane: the realm doc, or a standing registered bag's doc? */
  holdsDoc(documentId: DocumentId): boolean {
    return documentId === this.#realmDocId || this.#standing.has(documentId);
  }

  /** The realm doc id plus the docs of standing registrations — for a caller that lists what the lane opens. */
  standingDocIds(): ReadonlySet<DocumentId> {
    return new Set<DocumentId>([this.#realmDocId, ...this.#standing]);
  }

  async mayFederate(documentId: DocumentId, peerId?: PeerId): Promise<boolean> {
    const isRealmDoc = documentId === this.#realmDocId;
    const ofRealm = isRealmDoc || this.#standing.has(documentId);
    // THE MEMBER SHADOW reads FIRST for the realm's own documents, ahead of the base gate and every lane below:
    // a member set aside reads nothing of the realm, whichever gate would have opened it.
    if (ofRealm && peerId && this.#memberAside?.(peerId)) return false;
    if (await this.base.mayFederate(documentId, peerId)) return true;
    if (!peerId) return false;
    if (!ofRealm) return false;
    // A standing consult that throws answers NO: the gate never opens, and never rejects, on a failed reading.
    let stands = false;
    try { stands = this.#stands?.(peerId) === true; } catch { stands = false; }
    if (stands) return true;
    if (!this.#nexusLane) {
      return !isRealmDoc && this.#charter?.carrierPeer?.(peerId) === true && this.#byDocId.get(documentId)?.readTier === "public";
    }
    // THE REALM LEG — the registration's own hands and charters, ahead of any board.
    if (this.#charter?.holdsCharterPeer?.(peerId)) return true;     // the charter's own hearth — the return lane
    const nym = this.#charter?.contractNymOfPeer(peerId)?.toLowerCase() ?? null;
    if (nym && this.#charter) {
      const rec = this.#byDocId.get(documentId) ?? null;
      if (rec?.keptBy.some((s) => s.toLowerCase() === nym)) return true;                 // the write side
      const charters = rec ? registrationCharters(rec) : new Set<string>(this.#realmId ? [this.#realmId] : []);
      for (const charterId of charters) if (this.#charter.holdsCharter(nym, charterId)) return true;   // CONTRACT
    }
    // THE CARRIER LEG — a faceless PLACE reads the PUBLIC tier BY HASH and nothing else. Gated on the
    // registration's OWN declared tier, so a CONTRACT book withholds here even for a carrier the Nexus
    // contracted, and the realm doc itself (which carries the registrations) never crosses to one.
    if (!isRealmDoc && this.#charter?.carrierPeer?.(peerId)) {
      if (this.#byDocId.get(documentId)?.readTier === "public") return true;
    }
    // THE NEXUS LANE, unchanged — the members board answers for every peer the realm does not name.
    return this.membership.holdsCarriagePeer(peerId);
  }
}

/**
 * RealmBoardGate — the crossing lane of a realm's OWN boards: its vouch board and its edge board
 * (kapae#/four-edges). A removal's record stays among the parties to the relation it ends, so these two
 * documents cross to a peer that holds standing in that realm and to nobody else — never the public shelf, never
 * the Nexus lane, never a walker or a faceless carrier. A member under a standing shadow holds no standing, so
 * the boards close for that member too: the removed party reads neither the raise nor a later lift, and draws
 * the denial any private plane gives.
 *
 * `boards()` names the board documents this vessel reads and the realm each belongs to; `stands(peerId, realm)`
 * answers from the vessel's own lineage read. Both arrive from the composing vessel; this gate holds no key.
 */
export class RealmBoardGate implements FederationGate {
  constructor(
    private readonly base:   FederationGate,
    private readonly boards: () => ReadonlyMap<DocumentId, string>,
    private readonly stands: (peerId: string, realm: string) => boolean,
  ) {}

  async mayFederate(documentId: DocumentId, peerId?: PeerId): Promise<boolean> {
    // A realm's board answers to standing ALONE: no base gate opens it, whatever that gate would say.
    const realm = this.boards().get(documentId);
    if (realm !== undefined) return peerId ? this.stands(peerId, realm) : false;
    return this.base.mayFederate(documentId, peerId);
  }
}
