/**
 * wax-stamp (CIV-5) — the guild's public-plane PROVENANCE keel: does a posted artifact trace to the
 * CURRENT charter, a PAST charter (authentic, just older), or a SPOOF? Provenance of the DATA, never
 * presence of a person — the public-plane DUAL of the private predicate-key (cabal-realm#the-wax-stamp).
 * The membership handshake answers presence, live + peer-to-peer; the wax-stamp answers provenance,
 * public + on the data. Orthogonal.
 *
 * The charter is a hash-linked, content-addressed EPOCH CHAIN: each epoch names its authorizing key-set
 * AND commits one digest per seat's COLD successor key. Every successor reveals its seated cold keys and
 * carries a ROLL signed by the revealed quorum, the seated quorum, and each added seat. It lists
 * KEYS/THRESHOLDS, never a roster. A stamp attests a PAST ("sealed under epoch N"), never present standing.
 *
 * A KEY A CHARTER SEATED NEVER RETURNS. A rolled epoch names its seats in its roll; the genesis names its own by
 * a hash alone, so the FIRST roll reveals the genesis seats (`SealRoll.genesis`), which must hash to the
 * genesis's key-set. Every later roll then reads every key the lineage ever seated, the genesis's among them.
 *
 * The honest wall, kept lit: "valid trace to lineage L" is a HARD crypto fact (decided here); "L is the
 * legitimate org" is HIGHER-ORDER social acceptance (NOT decided here — a fork yields two internally-valid
 * lineages). Duplicity — two signed inconsistent epochs rolling from one predecessor — IS algorithmically
 * detectable.
 *
 * Order rides the hash links alone: an epoch's place in the lineage rides its `predecessors`, a sorted set of one
 * epoch (a roll) or two (a reunion), and a genesis names none. No epoch carries a sequence number.
 *
 * ── EVERY GENESIS CARRIES ITS SEATS' INCEPTION ──────────────────────────────────────────────────
 * A genesis reads as a charter only with its INCEPTION: one exact image (the seats, the rule, the successor
 * commitments, and for a joint founding the offer fingerprint) signed by every seat it seats, and by nothing
 * else. The AID content-addresses that image, so it names one founding statement, never a roster: two foundings
 * by one roster commit fresh successors and mint two AIDs.
 *
 * ── A FORK STAYS A FORK ─────────────────────────────────────────────────────────────────────────
 * No clock, no longest chain and no third-party quorum picks a branch; every reader names the branch it follows.
 * Two acts resolve one: ABANDON (a branch's own quorum at its head closes that branch for every reader who holds
 * the record) and REUNION (one image both branch quorums sign at their heads). The reunion verifier stands
 * unbuilt: a two-predecessor record refuses `REUNION_UNBUILT`.
 */
import { sha256HexSync, canonicalJson, canonicalJsonBytes } from "./crypto.js";
import { CHARTER_ABANDON_DOMAIN, CHARTER_INCEPTION_DOMAIN, CHARTER_REUNION_DOMAIN, CHARTER_SEAT_ROLL_DOMAIN } from "./domains.js";
import { seatNextDigest } from "./cold-key-card.js";
import type { QuorumSignature } from "./kapae-antigen.js";
import { acceptEd25519Key, verifyEd25519, type Ed25519KeyRefusal } from "./ed25519-door.js";

/** A key-set and the quorum rule over it — the preimage `sealKeySetHash` digests. */
export interface SealKeySet { readonly keys: readonly string[]; readonly threshold: number }
/** The forward commitment an epoch carries: one digest per seated key, and the count a roll must reveal. */
export interface SealNext { readonly digests: readonly string[]; readonly threshold: number }
export const UNARMED: SealNext = Object.freeze({ digests: Object.freeze([]), threshold: 0 });
/**
 * The signed ROLL reveals the successor's seats and carries signatures over exactly that transition. The FIRST
 * roll also reveals the genesis seats (`genesis`), bound by the genesis's own key-set hash rather than by a
 * signature; every other roll carries none.
 */
export interface SealRoll {
  readonly keys: readonly string[]; readonly threshold: number; readonly signatures: readonly QuorumSignature[];
  readonly genesis?: SealKeySet;
}
/** What a joint founding adds to its inception: the fingerprint of the offer one founder made the other. */
export interface CharterFounding { readonly offer: string }
/** The exact image every seat of a genesis signs. Keys sorted, distinct and lower-case; one digest per key. */
export interface CharterInceptionImage {
  readonly kind:           typeof CHARTER_INCEPTION_DOMAIN;
  readonly keys:           readonly string[];
  readonly threshold:      number;
  readonly nextKeyDigests: readonly string[];
  readonly nextThreshold:  number;
  readonly founding:       CharterFounding | null;
}
/** A genesis's inception: its image and its seats' signatures over the image's bytes. */
export interface CharterInception {
  readonly image:      CharterInceptionImage;
  readonly signatures: readonly QuorumSignature[];
}
/** One epoch binds its seated quorum, positional cold-key commitments and predecessor links. */
export interface SealEpoch {
  readonly epochCid: string;
  readonly keySetHash: string;
  readonly nextKeyDigests: readonly string[];
  readonly nextThreshold: number;
  /** Sorted, distinct: none at a genesis, one for a roll, two for a reunion. */
  readonly predecessors: readonly string[];
  readonly roll?: SealRoll;
  /** A genesis alone carries it, and a genesis reads only with it. */
  readonly inception?: CharterInception;
}
/** A wax-stamp on posted data — inline, island-local, attests a PAST. */
export interface WaxStamp { readonly artifactHash: string; readonly epochCid: string; readonly sealedAt: string; readonly signature: string }
export type SealVerdict = "CURRENT" | "PAST_AUTHENTIC" | "SPOOF";

const normKeys = (keys: readonly string[]): string[] => [...new Set(keys.map(k => k.toLowerCase()))].sort();
const isThreshold = (t: unknown): t is number => typeof t === "number" && Number.isInteger(t) && t >= 1;
const isHex64 = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/i.test(v);
const isLowerDigest = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
const isLowerHex128 = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{128}$/.test(v);
const validNext = (n: SealNext, seats: number, threshold: number): boolean => Array.isArray(n?.digests) &&
  (n.digests.length === 0 ? n.threshold === 0 : n.digests.length === seats && n.digests.every(isLowerDigest) && new Set(n.digests).size === seats && n.threshold === threshold);
const record = (v: unknown): Record<string, unknown> | null => typeof v === "object" && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : null;
const exactKeys = (r: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(r).length === keys.length && keys.every((k) => Object.hasOwn(r, k));

/** A wax-stamp on posted data — inline, island-local, attests A PAST ("sealed under epoch N"). */
export function sealKeySetHash(keys: readonly string[], threshold: number): string {
  return sha256HexSync(canonicalJson({ keys: normKeys(keys), threshold }));
}
/** What an epoch's address commits: its seats, its successors, its predecessors, and a genesis's inception image. */
export interface SealEpochFields {
  readonly keySetHash: string;
  readonly nextKeyDigests: readonly string[];
  readonly nextThreshold: number;
  readonly predecessors: readonly string[];
  /** A genesis's inception image; its digest enters the address. Absent on every other epoch. */
  readonly inceptionImage?: CharterInceptionImage | null;
}
/**
 * A Nexus AID: `nexus-` and 64 lower hex. ONE CONSTRUCTOR MINTS IT, `sealEpochCidOf` on a genesis: the content
 * address of the charter's first epoch, which commits the inception image, so every holder derives it alike from
 * public material, it names no vessel, and no roll moves it (a roll appends; the genesis stays first).
 */
export const NEXUS_AID_PATTERN = /^nexus-[0-9a-f]{64}$/;
/** The digest an address takes of an inception image. */
export function inceptionImageDigest(image: CharterInceptionImage): string {
  return sha256HexSync(canonicalJson(image));
}
/**
 * The content-address binds the positional commitments exactly as supplied. A genesis (no predecessor) takes the
 * `nexus-` prefix and commits its inception image; its address names the Nexus. Every later epoch takes `epoch-`.
 */
export function sealEpochCidOf(fields: SealEpochFields | SealEpoch): string {
  const genesis = fields.predecessors.length === 0;
  const image = ("inceptionImage" in fields ? fields.inceptionImage : undefined) ?? ("inception" in fields ? fields.inception?.image : undefined) ?? null;
  const inception = genesis && image ? inceptionImageDigest(image) : null;
  const digest = sha256HexSync(canonicalJson({ keySetHash: fields.keySetHash, nextKeyDigests: fields.nextKeyDigests,
    nextThreshold: fields.nextThreshold, predecessors: fields.predecessors, inception }));
  return genesis ? `nexus-${digest}` : `epoch-${digest}`;
}
/** The address an epoch holds, recomputed from its own fields (a genesis reads its inception's image). */
export function epochCidOf(epoch: SealEpoch): string {
  return sealEpochCidOf(epoch);
}
/** Seal one charter epoch from its authority fields, with its optional signed roll or inception. */
export function mintCharterEpoch(fields: SealEpochFields, roll?: SealRoll, inception?: CharterInception): SealEpoch {
  const epoch: SealEpoch = { keySetHash: fields.keySetHash, nextKeyDigests: [...fields.nextKeyDigests], nextThreshold: fields.nextThreshold,
    predecessors: [...fields.predecessors],
    epochCid: sealEpochCidOf({ ...fields, inceptionImage: inception?.image ?? fields.inceptionImage ?? null }) };
  if (roll) return { ...epoch, roll };
  return inception ? { ...epoch, inception } : epoch;
}

// ── the inception ────────────────────────────────────────────────────────────────────────────────

/** The inception image a genesis of these seats, rule and successors carries. Refuses what no genesis may seat. */
export function charterInceptionImage(keys: readonly string[], threshold: number, next: SealNext = UNARMED,
  founding: CharterFounding | null = null): CharterInceptionImage {
  const weak = weakSeatOf(keys);
  if (weak) throw new Error(`charter-seats-a-weak-key — a founding seat refuses (${weak.refusal}): ${weak.key}`);
  const distinct = normKeys(keys);
  if (!isThreshold(threshold) || threshold > distinct.length || !validNext(next, distinct.length, threshold)) throw new Error("roll-malformed");
  if (founding !== null && (!record(founding) || !exactKeys(founding as unknown as Record<string, unknown>, ["offer"]) || !isLowerDigest(founding.offer))) throw new Error("roll-malformed");
  return { kind: CHARTER_INCEPTION_DOMAIN, keys: distinct, threshold, nextKeyDigests: [...next.digests], nextThreshold: next.threshold,
    founding: founding === null ? null : { offer: founding.offer } };
}
/** The bytes every seat of a genesis signs: the image's canonical JSON. */
export function charterInceptionBytes(image: CharterInceptionImage): Uint8Array {
  return canonicalJsonBytes(image);
}
/**
 * Read an inception image at its exact shape: seats sorted, distinct and accepted by the Ed25519 door; one
 * distinct successor digest per seat under the seats' own threshold, or none; no seat key whose digest a seat committed (its reveal would re-seat a seated key); a founding of
 * the offer fingerprint alone, or none.
 */
export function readCharterInceptionImage(parsed: unknown): CharterInceptionImage | null {
  const r = record(parsed);
  if (!r || r["kind"] !== CHARTER_INCEPTION_DOMAIN || !exactKeys(r, ["kind", "keys", "threshold", "nextKeyDigests", "nextThreshold", "founding"])) return null;
  const { keys, threshold, nextKeyDigests, nextThreshold, founding } = r;
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > 256 || !keys.every((k) => isLowerDigest(k) && acceptEd25519Key(k).ok)) return null;
  if (keys.some((k, i) => i > 0 && !((keys[i - 1] as string) < (k as string)))) return null;
  if (!isThreshold(threshold) || threshold > keys.length) return null;
  // Armed (one distinct digest per seat under the seats' threshold), or unarmed (none, at zero): an unarmed genesis
  // never rolls, and no production rite mints one.
  if (!Array.isArray(nextKeyDigests) || !nextKeyDigests.every(isLowerDigest) || !(nextKeyDigests.length === 0
    ? nextThreshold === 0 : nextKeyDigests.length === keys.length && new Set(nextKeyDigests).size === keys.length && nextThreshold === threshold)) return null;
  const seats = keys as string[], digests = nextKeyDigests as string[];
  if (seats.some((k) => digests.includes(seatNextDigest(k)))) return null;
  let readFounding: CharterFounding | null = null;
  if (founding !== null) {
    const f = record(founding);
    if (!f || !exactKeys(f, ["offer"]) || !isLowerDigest(f["offer"])) return null;
    readFounding = { offer: f["offer"] };
  }
  return { kind: CHARTER_INCEPTION_DOMAIN, keys: [...seats], threshold, nextKeyDigests: [...digests], nextThreshold: nextThreshold as number, founding: readFounding };
}
/** Read an inception at its exact shape; its signatures read as shapes, and `verifyInception` judges them. */
export function readCharterInception(parsed: unknown): CharterInception | null {
  const r = record(parsed);
  if (!r || !exactKeys(r, ["image", "signatures"])) return null;
  const image = readCharterInceptionImage(r["image"]);
  const raw = r["signatures"];
  if (!image || !Array.isArray(raw) || raw.length > 256) return null;
  const signatures: QuorumSignature[] = [];
  for (const s of raw) {
    const q = record(s);
    if (!q || !exactKeys(q, ["signer", "sig"]) || !isLowerDigest(q["signer"]) || !isLowerHex128(q["sig"])) return null;
    signatures.push({ signer: q["signer"], sig: q["sig"] });
  }
  return { image, signatures };
}
/** The seats whose signature verifies over the image's bytes, one per seat, sorted. */
export function inceptionSeatsSigned(image: CharterInceptionImage, signatures: readonly QuorumSignature[]): string[] {
  const bytes = charterInceptionBytes(image);
  const seats = new Set(image.keys);
  const signed = new Set<string>();
  for (const s of signatures) {
    if (!seats.has(s.signer) || signed.has(s.signer)) continue;
    if (verifyEd25519(s.sig, bytes, s.signer)) signed.add(s.signer);
  }
  return [...signed].sort();
}
export type InceptionRefusal =
  | "inception-absent" | "inception-malformed" | "inception-unbound" | "inception-unsigned" | "inception-foreign-signer"
  | "inception-signature-invalid" | "inception-short-of-seats";
/**
 * Does this genesis carry its inception: every seated key's signature over the one image its address commits, and
 * nothing else? Null when it does; else the first refusal. An inception holds exact bytes: zero signatures, a
 * signer outside the seats or named twice, a signature that fails the image, or a seat that did not sign each
 * refuses. The law holds for every genesis, a household seed's one seat and a joint founding's two alike.
 */
export function verifyInception(genesis: SealEpoch): InceptionRefusal | null {
  if (genesis.inception === undefined) return "inception-absent";
  const inception = readCharterInception(genesis.inception);
  if (!inception) return "inception-malformed";
  const { image } = inception;
  if (genesis.predecessors.length !== 0 || genesis.keySetHash !== sealKeySetHash(image.keys, image.threshold) ||
      canonicalJson(genesis.nextKeyDigests) !== canonicalJson(image.nextKeyDigests) || genesis.nextThreshold !== image.nextThreshold ||
      genesis.epochCid !== epochCidOf(genesis)) return "inception-unbound";
  if (inception.signatures.length === 0) return "inception-unsigned";
  const seats = new Set(image.keys), named = new Set<string>();
  for (const s of inception.signatures) {
    if (!seats.has(s.signer) || named.has(s.signer)) return "inception-foreign-signer";
    named.add(s.signer);
  }
  if (inceptionSeatsSigned(image, inception.signatures).length !== named.size) return "inception-signature-invalid";
  if (named.size < image.keys.length) return "inception-short-of-seats";
  return null;
}
/** The genesis an inception seats, with the signatures it carries (none verified here). */
export function genesisOfInception(image: CharterInceptionImage, signatures: readonly QuorumSignature[] = []): SealEpoch {
  return mintCharterEpoch({ keySetHash: sealKeySetHash(image.keys, image.threshold), nextKeyDigests: [...image.nextKeyDigests],
    nextThreshold: image.nextThreshold, predecessors: [] }, undefined, { image, signatures: [...signatures].sort((a, b) => a.signer < b.signer ? -1 : 1) });
}
/** An UNSIGNED genesis of these seats: its inception carries no signature, so no reader takes it as a charter. */
export function genesisCharterEpoch(keys: readonly string[], threshold: number, next: SealNext = UNARMED,
  founding: CharterFounding | null = null): SealEpoch {
  return genesisOfInception(charterInceptionImage(keys, threshold, next, founding));
}
/** Incept a genesis: each seat signs the image, and the genesis reads only where every seat signed. */
export async function inceptCharterEpoch(image: CharterInceptionImage, signers: readonly SealRollSigner[]): Promise<SealEpoch> {
  const bytes = charterInceptionBytes(image);
  const signatures: QuorumSignature[] = [];
  for (const s of signers) signatures.push({ signer: s.signer.toLowerCase(), sig: await s.sign(bytes) });
  return genesisOfInception(image, signatures);
}
export type RotateResult = { readonly ok: true; readonly epoch: SealEpoch } | { readonly ok: false; readonly code: string; readonly reason: string };
export interface SealRollSigner { readonly signer: string; readonly sign: (bytes: Uint8Array) => Promise<string> }

/** The first key that the Ed25519 door refuses. */
export function weakSeatOf(keys: readonly unknown[]): { readonly key: string; readonly refusal: Ed25519KeyRefusal } | null {
  for (const k of keys) {
    const read = acceptEd25519Key(typeof k === "string" ? k.toLowerCase() : k);
    if (!read.ok) return { key: typeof k === "string" ? k : String(typeof k), refusal: read.refusal };
  }
  return null;
}
/** The six canonical fields a roll's hands sign. A roll names its one predecessor. */
export function sealRollBytes(parts: { readonly predecessor: string; readonly keys: readonly string[]; readonly threshold: number;
  readonly nextKeyDigests: readonly string[]; readonly nextThreshold: number }): Uint8Array {
  return canonicalJsonBytes({ kind: CHARTER_SEAT_ROLL_DOMAIN, predecessors: [parts.predecessor], keys: normKeys(parts.keys),
    threshold: parts.threshold, nextKeyDigests: parts.nextKeyDigests, nextThreshold: parts.nextThreshold });
}
/** The seats an epoch seats, as its own records reveal them: a genesis's inception, or a roll's key-set. */
export function epochSeats(epoch: SealEpoch): SealKeySet | null {
  if (epoch.roll) return { keys: normKeys(epoch.roll.keys), threshold: epoch.roll.threshold };
  const image = epoch.inception ? readCharterInceptionImage(epoch.inception.image) : null;
  return image ? { keys: image.keys, threshold: image.threshold } : null;
}

/** Verify one transition in refusal order; history carries every earlier spent digest and seated key. */
export function verifySealRoll(prev: SealEpoch, epoch: SealEpoch, earlier: readonly SealEpoch[] = []): string | null {
  if (!Array.isArray(epoch.predecessors)) return "roll-malformed";
  if (epoch.predecessors.length === 2) return "REUNION_UNBUILT";
  if (epoch.predecessors.length !== 1 || epoch.predecessors[0] !== prev.epochCid) return "roll-unlinked";
  if (epoch.inception !== undefined) return "roll-malformed";
  const roll = epoch.roll;
  if (!roll || typeof roll !== "object") return "roll-unsigned";
  if (!Array.isArray(roll.keys) || !Array.isArray(roll.signatures) || !isThreshold(roll.threshold) ||
      !roll.keys.every(isHex64) || !Array.isArray(epoch.nextKeyDigests) || !isThresholdSignatureArray(roll.signatures)) return "roll-malformed";
  const keys = normKeys(roll.keys);
  if (roll.threshold > keys.length) return "roll-malformed";
  if (weakSeatOf(keys)) return "roll-holds-a-weak-key";
  if (sealKeySetHash(keys, roll.threshold) !== epoch.keySetHash) return "roll-key-set-unbound";
  if (!Array.isArray(prev.nextKeyDigests) || prev.nextKeyDigests.length === 0) return "rotation-unarmed";
  // EVERY ROLL RE-ARMS EVERY SEAT IT SEATS: a successor left unarmed would stall the chain at the head it opens.
  if (epoch.nextKeyDigests.length === 0 || !validNext({ digests: epoch.nextKeyDigests, threshold: epoch.nextThreshold }, keys.length, roll.threshold)) return "roll-unarmed-successor";
  const history = [prev, ...earlier];
  const spent = new Set(history.flatMap(e => e.nextKeyDigests).map(d => d.toLowerCase()));
  if (epoch.nextKeyDigests.some(d => spent.has(d.toLowerCase()))) return "roll-respends-a-digest";
  // THE GENESIS SEATS: the first roll reveals them against the genesis's own key-set hash, and no other roll may.
  const first = prev.predecessors.length === 0;
  if (first) {
    const g = roll.genesis;
    if (!g || typeof g !== "object" || !Array.isArray(g.keys) || !g.keys.every(isHex64) || !isThreshold(g.threshold)) return "roll-genesis-unrevealed";
    // One encoding alone: the reveal carries its keys lower-case, distinct and sorted, as the hash reads them.
    if (g.keys.join() !== normKeys(g.keys).join()) return "roll-malformed";
    if (sealKeySetHash(g.keys, g.threshold) !== prev.keySetHash) return "roll-genesis-unbound";
  } else if (roll.genesis !== undefined) return "roll-malformed";
  const priorKeys = new Set([...history.flatMap(e => [...(e.roll?.keys ?? []), ...(e.roll?.genesis?.keys ?? []), ...(e.inception?.image.keys ?? [])]),
    ...(first ? roll.genesis!.keys : [])].map(k => k.toLowerCase()));
  if (keys.some(k => priorKeys.has(k))) return "roll-reuses-a-seated-key";
  const revealed = new Set(keys.filter(k => prev.nextKeyDigests.includes(seatNextDigest(k))));
  const added = keys.filter(k => !revealed.has(k));
  const bytes = sealRollBytes({ predecessor: prev.epochCid, keys, threshold: roll.threshold,
    nextKeyDigests: epoch.nextKeyDigests, nextThreshold: epoch.nextThreshold });
  const signed = new Set<string>();
  for (const s of roll.signatures) {
    const signer = s.signer.toLowerCase();
    if (!keys.includes(signer) || signed.has(signer)) continue;
    try { if (verifyEd25519(s.sig, bytes, signer)) signed.add(signer); } catch { /* A malformed signature does not count. */ }
  }
  if ([...revealed].filter(k => signed.has(k)).length < prev.nextThreshold) return "roll-short-of-revealed-quorum";
  if ([...keys].filter(k => signed.has(k)).length < roll.threshold) return "roll-short-of-seated-quorum";
  if (added.some(k => !signed.has(k))) return "seat-change-without-proof-of-possession";
  return null;
}
function isThresholdSignatureArray(signatures: readonly QuorumSignature[]): boolean {
  return signatures.every(s => s !== null && typeof s === "object" && typeof s.signer === "string" && isHex64(s.signer.toLowerCase()) &&
    typeof s.sig === "string" && /^[0-9a-f]{128}$/i.test(s.sig));
}
/**
 * Read a complete hash-linked lineage, passing all earlier epochs to each transition: null when it verifies, else
 * the first refusal. The genesis reads only with its inception; a two-predecessor record refuses `REUNION_UNBUILT`.
 */
export function readSealLineage(chain: readonly SealEpoch[]): string | null {
  if (!Array.isArray(chain) || !chain.length) return "lineage-empty";
  const genesis = chain[0]!;
  if (!Array.isArray(genesis.predecessors) || genesis.predecessors.length !== 0 || genesis.roll !== undefined) return "genesis-malformed";
  const incepted = verifyInception(genesis);
  if (incepted !== null) return incepted;
  for (let i = 1; i < chain.length; i++) {
    const e = chain[i]!, prev = chain[i - 1]!;
    if (!Array.isArray(e.predecessors)) return "roll-malformed";
    if (e.predecessors.length === 2) return "REUNION_UNBUILT";
    if (e.epochCid !== epochCidOf(e)) return "epoch-unbound";
    const code = verifySealRoll(prev, e, chain.slice(0, i - 1));
    if (code !== null) return code;
  }
  return null;
}
/** Verify the complete hash-linked lineage (see `readSealLineage`). */
export function verifySealLineage(chain: readonly SealEpoch[]): boolean {
  return readSealLineage(chain) === null;
}
/**
 * Advance a chain by revealing the head's positional cold keys and re-arming each seat. `closing` names the head's
 * own seats; a roll off the genesis reveals them (`SealRoll.genesis`), and every other roll leaves them out, since
 * its predecessor's roll already names them.
 */
export async function rotateSealEpoch(head: SealEpoch, seat: SealKeySet, next: SealNext,
  signers: readonly SealRollSigner[], earlier: readonly SealEpoch[] = [], closing?: SealKeySet): Promise<RotateResult> {
  if (!head.nextKeyDigests.length) return { ok: false, code: "rotation-unarmed", reason: "rotation unarmed" };
  const keys = normKeys(seat.keys);
  const bytes = sealRollBytes({ predecessor: head.epochCid, keys, threshold: seat.threshold,
    nextKeyDigests: next.digests, nextThreshold: next.threshold });
  const signatures: QuorumSignature[] = [];
  for (const s of signers) signatures.push({ signer: s.signer.toLowerCase(), sig: await s.sign(bytes) });
  const genesis = head.predecessors.length === 0 && closing ? { genesis: { keys: normKeys(closing.keys), threshold: closing.threshold } } : {};
  const epoch = mintCharterEpoch({ keySetHash: sealKeySetHash(keys, seat.threshold), nextKeyDigests: [...next.digests],
    nextThreshold: next.threshold, predecessors: [head.epochCid] }, { keys, threshold: seat.threshold, signatures, ...genesis });
  const code = verifySealRoll(head, epoch, earlier);
  return code ? { ok: false, code, reason: `roll refused — ${code}` } : { ok: true, epoch };
}

// ── resolving a fork ─────────────────────────────────────────────────────────────────────────────

/** A branch's ABANDON: its own quorum, at its head, closes the branch. It erases nothing and touches no sibling. */
export interface SealAbandon {
  readonly kind:       typeof CHARTER_ABANDON_DOMAIN;
  readonly scope:      string;   // the Nexus AID
  readonly head:       string;   // the branch head it closes
  readonly signatures: readonly QuorumSignature[];
}
/** The bytes an abandon's quorum signs. */
export function sealAbandonBytes(parts: { readonly scope: string; readonly head: string }): Uint8Array {
  return canonicalJsonBytes({ kind: CHARTER_ABANDON_DOMAIN, scope: parts.scope, head: parts.head });
}
/**
 * Does `abandon` close the branch `chain` holds? Its scope names the chain's AID, it names the chain's head, and
 * the head's own seats sign it at their threshold. Null when it does; else the refusal. SPECIFIED: no reader
 * consults it yet; the fork reader that names the branch a vessel follows owes the call.
 */
export function verifySealAbandon(chain: readonly SealEpoch[], abandon: SealAbandon): string | null {
  if (readSealLineage(chain) !== null) return "abandon-lineage-unverified";
  const r = record(abandon);
  if (!r || !exactKeys(r, ["kind", "scope", "head", "signatures"]) || abandon.kind !== CHARTER_ABANDON_DOMAIN ||
      typeof abandon.scope !== "string" || typeof abandon.head !== "string" || !Array.isArray(abandon.signatures)) return "abandon-malformed";
  const head = chain[chain.length - 1]!;
  if (abandon.scope !== chain[0]!.epochCid) return "abandon-another-scope";
  if (abandon.head !== head.epochCid) return "abandon-not-the-head";
  const seats = epochSeats(head);
  if (!seats) return "abandon-seats-unread";
  const bytes = sealAbandonBytes(abandon);
  const signed = new Set<string>();
  for (const s of abandon.signatures) {
    const signer = typeof s?.signer === "string" ? s.signer.toLowerCase() : "";
    if (!seats.keys.includes(signer) || signed.has(signer)) continue;
    if (verifyEd25519(s.sig, bytes, signer)) signed.add(signer);
  }
  return signed.size >= seats.threshold ? null : "abandon-short-of-quorum";
}
/** The one image a REUNION signs: the scope AID, both held heads sorted, and the new seats and successors. */
export interface SealReunionImage {
  readonly kind:           typeof CHARTER_REUNION_DOMAIN;
  readonly scope:          string;
  readonly heads:          readonly [string, string];
  readonly keys:           readonly string[];
  readonly threshold:      number;
  readonly nextKeyDigests: readonly string[];
  readonly nextThreshold:  number;
}
/** The bytes each branch quorum signs at its head; both sign identical bytes. */
export function sealReunionBytes(image: SealReunionImage): Uint8Array {
  return canonicalJsonBytes({ ...image, keys: normKeys(image.keys), heads: [...image.heads].sort() });
}
/**
 * The reunion verifier stands UNBUILT: it must prove both heads verify inside the same AID's lineages from a
 * common ancestor and stand as the heads the reader holds. Until it lands, every reunion refuses by name.
 */
export function verifySealReunion(_branches: readonly [readonly SealEpoch[], readonly SealEpoch[]], _image: SealReunionImage,
  _signatures: readonly QuorumSignature[]): "REUNION_UNBUILT" {
  return "REUNION_UNBUILT";
}

/** Classify a wax-stamp against a verified chain. */
export function classifySeal(stamp: WaxStamp, chain: readonly SealEpoch[], verifySig: (stamp: WaxStamp, epoch: SealEpoch) => boolean): SealVerdict {
  if (!verifySealLineage(chain)) return "SPOOF";
  const idx = chain.findIndex(e => e.epochCid === stamp.epochCid);
  if (idx < 0 || !verifySig(stamp, chain[idx]!)) return "SPOOF";
  return idx === chain.length - 1 ? "CURRENT" : "PAST_AUTHENTIC";
}
/** Detect two distinct signed successors of a shared predecessor. */
export function detectDuplicity(a: readonly SealEpoch[], b: readonly SealEpoch[]): string | null {
  const byPrev = new Map<string, string>();
  for (const e of a) for (const p of e.predecessors) byPrev.set(p, e.epochCid);
  for (const e of b) for (const p of e.predecessors) if (byPrev.has(p) && byPrev.get(p) !== e.epochCid) return p;
  return null;
}
/** A wax-stamp's canonical signed bytes. */
export function waxStampProofBytes(artifactHash: string, epochCid: string, sealedAt: string): Uint8Array {
  return new TextEncoder().encode(`lar-wax-stamp/v1|${artifactHash}|${epochCid}|${sealedAt}`);
}
/** A single-key digest retained for the stamp verifier's one-seat floor. */
export function singleKeySetHash(signerKeyHex: string): string { return sha256HexSync(signerKeyHex); }
/** Mint a stamp under an authorized epoch. */
export async function mintWaxStamp(input: { readonly artifactHash: string; readonly epoch: SealEpoch; readonly sealedAt: string;
  readonly sign: (bytes: Uint8Array) => Promise<string> }): Promise<WaxStamp> {
  const signature = await input.sign(waxStampProofBytes(input.artifactHash, input.epoch.epochCid, input.sealedAt));
  return { artifactHash: input.artifactHash, epochCid: input.epoch.epochCid, sealedAt: input.sealedAt, signature };
}
/** Verify a stamp against an authorized signing key. */
export async function verifyWaxStampSig(stamp: WaxStamp, epoch: SealEpoch, signerKeyHex: string,
  keyInSet: (signerKeyHex: string, keySetHash: string) => boolean = (k, h) => singleKeySetHash(k) === h): Promise<boolean> {
  if (!keyInSet(signerKeyHex, epoch.keySetHash)) return false;
  try { return verifyEd25519(stamp.signature, waxStampProofBytes(stamp.artifactHash, stamp.epochCid, stamp.sealedAt), signerKeyHex); }
  catch { return false; }
}
