/**
 * realm-bag — a bag two operators keep THROUGH a relation, registered on the realm's shared CRDT.
 *
 * THE RULING (scale-stories-basket-one#/exit, 2026-09-11): "the shared bag registers in the realm's shared
 * CRDT, @crossroads names only that it exists, read at CONTRACT". Three planes, never fused
 * (cabal-realm#six-joints): the CABAL is the collective, the REALM its shared CRDT and resources, the NEXUS the
 * hardware. A bag two households keep is stuff held in common — it belongs to the REALM plane.
 *
 * THE REALM DOC. Its id DERIVES from the charter both stewards hold: the GENESIS epoch of the seal lineage
 * (the inception, fixed across every rotation — the realm's NAME), so every member computes one address from
 * the charter alone and no registry has to be consulted to find it (`realmDocUrl`). Every vessel that stands
 * in the charter materializes it at boot and on `nexus refresh`; a vessel that never held the charter never
 * names it.
 *
 * THE REGISTRATION RECORD (`REALM_BAG_DOMAIN`, minted in the registry): `{ realmId, bagUri, docUrl, keptBy, readTier }`, signed by
 * EVERY steward it names (n-of-n — a steward is named only by her own hand; a record that names a steward who
 * never signed is CONSCRIPTION and never counts). Records ACCRETE under distinct keys (one per signing steward),
 * so a hostile member overwrites nothing; the FOLD adjudicates — exactly one counted registration per bag
 * stands, and two counted registrations naming DIFFERENT docs for one bag EQUIVOCATE and neither stands
 * (a tie never grants, the carriage fold's own law).
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
import * as ed25519 from "@noble/ed25519";
import { canonicalJsonBytes, hexToBytes } from "./crypto.js";
import { deterministicDocUrl } from "./deterministic-doc.js";
import { bagUri } from "./lar-uris.js";
import { mutableLarRecord, tiddlerText, type LarDoc } from "./base-doc.js";
import type { QuorumSignature } from "./kapae-antigen.js";
import type { NexusDoc } from "./nexus-seal-seed.js";
import type { FederationGate, NexusMembership } from "./federation-gate.js";
import type { CapTier } from "./cap-tier.js";

/** The realm plane's registry name on a vessel's oracle plane — the pointer a boot writes to the realm doc. */
export const REALM_DOC_URI = bagUri("realm");

/** The oracle-plane tiddler carrying the realm id the pointer stands for — read off the vessel's OWN plane,
 *  never off the realm doc (a member who could rewrite the id there could make a foreign record count). */
export const REALM_ID_TIDDLER = `${REALM_DOC_URI}/realm-id`;

/** The oracle-plane tiddler carrying THIS vessel's own steward nym — pinned the moment its own hand signs a
 *  registration (a proposal, or a co-sign of one). The write path reads stewardship off this pin, never off
 *  the realm doc's `keptBy` alone: a member who could rewrite a nym there could route a foreign put. */
export const REALM_STEWARD_TIDDLER = `${REALM_DOC_URI}/steward-nym`;

/** The signing / content domain of a realm-bag registration — minted in the registry (`domains.ts`). */
export { REALM_BAG_DOMAIN };

/** The tiddler prefix registrations accrete under on the realm doc. */
export const REALM_BAG_PREFIX = "lar:///ha.ka.ba/dreamnet/realm-bags/" as const;

/** The tiddler prefix the @crossroads announce rides under — `{ bagUri, keptBy }` and nothing more. */
export const REALM_BAG_ANNOUNCE_PREFIX = "lar:///ha.ka.ba/dreamnet/realm-bag-announce/" as const;

/** A steward nym reads clean only at the exact ed25519 verifying-key length. */
const NYM_RE = /^[0-9a-f]{64}$/;

// ── THE REALM'S NAME ─────────────────────────────────────────────────────────────────────────────

/**
 * The realm id a charter names: the GENESIS epoch cid of the seal lineage (inception — fixed across every
 * rotation), else the head epoch on the legacy single-epoch path. Null when no epoch stands: an unseated
 * charter names no realm, so nothing materializes.
 */
export function realmIdOfCharter(doc: NexusDoc | null | undefined): string | null {
  if (!doc) return null;
  const genesis = doc.sealLineage?.[0]?.epochCid;
  if (typeof genesis === "string" && genesis.length > 0) return genesis;
  return typeof doc.sealEpochCid === "string" && doc.sealEpochCid.length > 0 ? doc.sealEpochCid : null;
}

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
  /** The stewards' persona-root nyms — the write set. Every one of them signs. */
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
  /** One signature per steward in `keptBy`, over `realmBagBytes(record)`. */
  readonly signatures: readonly QuorumSignature[];
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
 * Sign a registration with the stewards' own signers. Each signer names its nym; the record's `keptBy`
 * reads exactly the signers' nyms (a steward is named by her own hand). The module holds no key.
 */
export async function signRealmBagRegistration(
  parts: Pick<RealmBagRegistration, "realmId" | "bagUri" | "docUrl" | "readTier"> & Partial<Pick<RealmBagRegistration, "charters" | "expiry">>,
  signers: ReadonlyArray<{ readonly signer: string; readonly sign: (bytes: Uint8Array) => Promise<string> }>,
): Promise<RealmBagRegistration> {
  const keptBy = signers.map((s) => s.signer.toLowerCase()).sort();
  const unsigned = { kind: REALM_BAG_DOMAIN, ...parts, keptBy } as Omit<RealmBagRegistration, "signatures">;
  const bytes = realmBagBytes(unsigned);
  const signatures: QuorumSignature[] = [];
  for (const s of signers) signatures.push({ signer: s.signer.toLowerCase(), sig: await s.sign(bytes) });
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
  signers: ReadonlyArray<{ readonly signer: string; readonly sign: (bytes: Uint8Array) => Promise<string> }>,
  proposed: readonly string[],
): Promise<RealmBagRegistration> {
  const keptBy = [...new Set([...signers.map((s) => s.signer), ...proposed].map((n) => n.toLowerCase()))].sort();
  const unsigned = { kind: REALM_BAG_DOMAIN, ...parts, keptBy } as Omit<RealmBagRegistration, "signatures">;
  const bytes = realmBagBytes(unsigned);
  const signatures: QuorumSignature[] = [];
  for (const s of signers) signatures.push({ signer: s.signer.toLowerCase(), sig: await s.sign(bytes) });
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
  cosigner: { readonly signer: string; readonly sign: (bytes: Uint8Array) => Promise<string> },
): Promise<RealmBagRegistration> {
  const nym = cosigner.signer.toLowerCase();
  const bytes = realmBagBytes(rec);
  const signatures = [...rec.signatures.filter((s) => s.signer.toLowerCase() !== nym), { signer: nym, sig: await cosigner.sign(bytes) }];
  return { ...rec, signatures };
}

/**
 * Does this registration COUNT for `realmId`? Fail-closed at every shore: a foreign realm, an empty steward
 * set, a malformed nym, a tier wider than CONTRACT, a steward with no verifying signature — each reads false.
 * n-of-n: every named steward signed, so the record conscripts nobody.
 */
export async function realmBagRegistrationCounts(rec: RealmBagRegistration, realmId: string): Promise<boolean> {
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
  const bytes = realmBagBytes(rec);
  for (const steward of rec.keptBy) {
    const nym = steward.toLowerCase();
    if (!NYM_RE.test(nym)) return false;
    const sig = rec.signatures.find((s) => s.signer.toLowerCase() === nym);
    if (!sig) return false;
    let ok = false;
    try { ok = await ed25519.verifyAsync(hexToBytes(sig.sig), bytes, hexToBytes(nym)); } catch { ok = false; }
    if (!ok) return false;
  }
  return true;
}

// ── THE DOC FACE ─────────────────────────────────────────────────────────────────────────────────

/** The tiddler key one registration accretes under — per bag AND per first-signing steward, so a second
 *  hand never overwrites a standing record; the fold adjudicates. */
export function realmBagKey(bagUri: string, steward: string): string {
  return `${REALM_BAG_PREFIX}${encodeURIComponent(bagUri)}/${steward.toLowerCase()}`;
}

/** Land a signed registration on the realm doc draft under the WRITING hand's key (`by`; the first named
 *  steward when a caller names none). A co-signer's completed record accretes beside the proposal it
 *  completes rather than over it — the fold, never a write, adjudicates. Call INSIDE `handle.change()`. */
export function writeRealmBagRegistration(draft: LarDoc, rec: RealmBagRegistration, by?: string): void {
  const key = realmBagKey(rec.bagUri, by ?? rec.keptBy[0] ?? "");
  draft.tiddlers[key] = mutableLarRecord(key, { text: JSON.stringify(rec) }, rec.realmId);
}

function coerceSignature(raw: unknown): QuorumSignature | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Record<string, unknown>;
  if (typeof s["signer"] !== "string" || typeof s["sig"] !== "string") return null;
  return { signer: s["signer"], sig: s["sig"] };
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
  const signatures: QuorumSignature[] = [];
  for (const raw of p["signatures"]) {
    const sig = coerceSignature(raw);
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

/** Every well-formed registration the realm doc carries (unverified — the fold decides trust). */
export function realmBagRegistrationsFromDoc(doc: LarDoc | undefined | null): RealmBagRegistration[] {
  const tiddlers = doc?.tiddlers;
  if (!tiddlers) return [];
  const out: RealmBagRegistration[] = [];
  for (const [title, record] of Object.entries(tiddlers)) {
    if (!title.startsWith(REALM_BAG_PREFIX)) continue;
    const text = tiddlerText(record);
    if (text === null) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { continue; }
    const rec = coerceRegistration(parsed);
    if (rec) out.push(rec);
  }
  return out;
}

/**
 * Fold the realm doc into the STANDING registrations, keyed by bag URI. Only counted records participate.
 * Two counted records for one bag that agree on the doc fold to one; two that name DIFFERENT docs
 * EQUIVOCATE and the bag stands UNREGISTERED (fail-closed — a tie never grants).
 */
export async function foldRealmBags(
  doc: LarDoc | undefined | null, realmId: string,
): Promise<ReadonlyMap<string, RealmBagRegistration>> {
  const standing = new Map<string, RealmBagRegistration>();
  const equivocal = new Set<string>();
  for (const rec of realmBagRegistrationsFromDoc(doc)) {
    if (!(await realmBagRegistrationCounts(rec, realmId))) continue;
    const prior = standing.get(rec.bagUri);
    if (prior && prior.docUrl !== rec.docUrl) { equivocal.add(rec.bagUri); continue; }
    if (!prior) standing.set(rec.bagUri, rec);
  }
  for (const bag of equivocal) standing.delete(bag);
  return standing;
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

/** What the public plane carries about a realm bag — that it exists and who keeps it. NEVER the doc. */
export interface RealmBagAnnounce {
  readonly kind:   typeof REALM_BAG_ANNOUNCE_DOMAIN;
  readonly bagUri: string;
  readonly keptBy: readonly string[];
}

export function realmBagAnnounceKey(bagUri: string): string {
  return `${REALM_BAG_ANNOUNCE_PREFIX}${encodeURIComponent(bagUri)}`;
}

/** The announce a registration projects onto @crossroads — the exists · kept-by pair, the doc withheld. */
export function crossroadsAnnounceOf(rec: RealmBagRegistration): RealmBagAnnounce {
  return { kind: REALM_BAG_ANNOUNCE_DOMAIN, bagUri: rec.bagUri, keptBy: [...rec.keptBy] };
}

/** Land the announce on the crossroads draft. Call INSIDE a `handle.change()` callback. */
export function writeRealmBagAnnounce(draft: LarDoc, rec: RealmBagRegistration): void {
  const key = realmBagAnnounceKey(rec.bagUri);
  draft.tiddlers[key] = mutableLarRecord(key, { text: JSON.stringify(crossroadsAnnounceOf(rec)) }, "realm-bag");
}

// ── THE WIRE GATE ────────────────────────────────────────────────────────────────────────────────

/**
 * THE REALM'S OWN CONSULT — what a vessel knows, off its OWN replica, about the hand behind a wire key.
 *
 * `contractNymOfPeer` surfaces the persona-root nym the peer PROVED at this vessel's gate (the contract edge,
 * verified offline — `peerContractNymMap`); it never re-authenticates and never trusts a peer's word.
 * `holdsCharter` answers, off the vessel's OWN charter replica, whether that nym holds the named charter —
 * the CONTRACT-tier read. Neither question reaches the Nexus members board: the board answers whether a
 * SOCKET stands, and this consult answers which DOCUMENTS the realm's own registration lets cross it.
 */
export interface RealmCharterConsult {
  /** The persona-root nym this peer proved at the wire, or null for a peer that proved none (fail-closed). */
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

  constructor(
    private readonly base: FederationGate,
    private readonly membership: NexusMembership,
    realmUrl: AutomergeUrl,
    opts?: {
      /** The realm's own consult — absent, the gate answers exactly as the Nexus lane alone answered. */
      readonly charter?: RealmCharterConsult;
      /** The realm's pace in rolls (`realmPace`) — the lease the write side reads against. */
      readonly pace?: () => number | null;
    },
  ) {
    this.#realmDocId = interpretAsDocumentId(realmUrl) as DocumentId;
    this.#charter = opts?.charter ?? null;
    this.#pace = opts?.pace ?? null;
  }

  /** Re-fold the standing registrations off a realm doc snapshot — the docs the realm and member lanes open for. */
  async refold(doc: LarDoc | undefined | null, realmId: string): Promise<void> {
    const next = new Set<DocumentId>();
    const byDoc = new Map<DocumentId, RealmBagRegistration>();
    this.#registrations = await foldRealmBags(doc, realmId);
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

  /** The realm doc id plus the docs of standing registrations — for a caller that lists what the lane opens. */
  standingDocIds(): ReadonlySet<DocumentId> {
    return new Set<DocumentId>([this.#realmDocId, ...this.#standing]);
  }

  async mayFederate(documentId: DocumentId, peerId?: PeerId): Promise<boolean> {
    if (await this.base.mayFederate(documentId, peerId)) return true;
    if (!peerId) return false;
    const isRealmDoc = documentId === this.#realmDocId;
    if (!isRealmDoc && !this.#standing.has(documentId)) return false;
    // THE REALM LEG — the registration's own hands and charters, ahead of any board.
    if (this.#charter?.holdsCharterPeer?.(peerId)) return true;     // the charter's own hearth — the return lane
    const nym = this.#charter?.contractNymOfPeer(peerId)?.toLowerCase() ?? null;
    if (nym && this.#charter) {
      const rec = this.#byDocId.get(documentId) ?? null;
      if (rec?.keptBy.some((s) => s.toLowerCase() === nym)) return true;                 // the write side
      const charters = rec ? registrationCharters(rec) : new Set<string>(this.#realmId ? [this.#realmId] : []);
      for (const charterId of charters) if (this.#charter.holdsCharter(nym, charterId)) return true;   // CONTRACT
    }
    // THE NEXUS LANE, unchanged — the members board answers for every peer the realm does not name.
    return this.membership.holdsCarriagePeer(peerId);
  }
}
