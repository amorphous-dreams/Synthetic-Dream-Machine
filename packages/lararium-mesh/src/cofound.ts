/**
 * cofound — the two-founder Nexus founding act, as PURE images: the offer, the join, the inception, and the
 * read-back a person checks before a seat signs (kahu#/seed-and-nexus).
 *
 * Two founders, each from their own vault, seat one key each in a FRESH joint genesis at two of two. Neither
 * household seed moves. The act crosses between the vaults as files alone, and no clock decides any step.
 *
 * ── THE THREE FILES ─────────────────────────────────────────────────────────────────────────────
 *   · THE OFFER (A → B): A's seat key, the digest of A's cold successor, the charter law the Nexus adopts and
 *     the release manifest's four addresses. It signs nothing. Its checksum names the OFFER FINGERPRINT.
 *   · THE JOIN (B → A): the offer as B read it, B's seat key, the digest of B's cold successor, and B's HALF
 *     SIGNATURE over the inception image the two seats compose. B signs only after typing A's seat
 *     fingerprint as heard.
 *   · THE INCEPTION (A → B): the same image, signed by both seats. A signs only after typing B's seat
 *     fingerprint as heard. The image's checksum names the FINAL CHARTER FINGERPRINT.
 *
 * ── THE INVARIANTS ──────────────────────────────────────────────────────────────────────────────
 *   · ONE IMAGE, ONE AID. Each side composes the inception image from the public material alone, so both
 *     derive the same Nexus AID (`genesisCharterEpoch`'s content address) and neither holds the other's signer.
 *   · TWO FINGERPRINTS, NEVER ONE FOR THE OTHER. The offer fingerprint names A's half; the final charter
 *     fingerprint names the joint image. Each digests under its own domain, so neither ever equals the other.
 *   · A JUDGE RUNS BEFORE EVERY SIGNATURE. A misheard fingerprint, a join over another offer, or a half
 *     signature that fails its bytes refuses before the signer runs.
 *   · EVERY SEATED KEY SIGNS THE INCEPTION. Zero signatures, one, or two over different images refuse.
 *   · A LABEL NEVER DECIDES. A cold card's printed fields aid the person; its key code alone answers whether
 *     it opens the seat's committed successor.
 *   · STRICT READERS. Each file reads at its exact shape, one encoding (lower-case hex), no extra field; an
 *     offer and a join never read as an inception, and none of the three reads as a charter doc.
 *
 * SPECIFIED, NEVER CALLED. No production path reaches this module, and it stays out of the package barrel. Its
 * callers stand owed: `lares nexus seal cofound open|join|seal` (`packages/lares-cli/src/commands/nexus-seal.ts`),
 * and the charter readers (`verifySealLineage`, the charter parse, import and boot), which take the inception in
 * the signed-inception commit. The inception's AID keeps `sealEpochCidOf`'s preimage until the operator rules
 * whether a charter's stable scope commits more than its seats, threshold and successors.
 *
 * Pure: no I/O, no clock, no log. Platform-blind.
 * Meme: lar:///ha.ka.ba/lararium/mesh/kahu#/seed-and-nexus
 */
import { canonicalJson, canonicalJsonBytes, cidV1Sha256FromHex, hex, sha256HexSync } from "./crypto.js";
import { CHARTER_INCEPTION_DOMAIN, COFOUND_OFFER_DOMAIN } from "./domains.js";
import { acceptEd25519Key, verifyEd25519 } from "./ed25519-door.js";
import { coldKeyFromSeed, coldKeySeedFromCode, seatNextDigest } from "./cold-key-card.js";
import type { QuorumSignature } from "./kapae-antigen.js";
import { seatFingerprint } from "./nexus-seal-seed.js";
import { genesisCharterEpoch, sealEpochCidOf, sealKeySetHash, type SealEpoch, type SealRollSigner } from "./wax-stamp.js";

/** The threshold a joint genesis seats and commits: two of two. */
export const COFOUND_THRESHOLD = 2;
/** The join envelope's own tag. It signs nothing: the half signature rides the inception image. */
export const COFOUND_JOIN_KIND = "cofound-join" as const;
/** The signed inception envelope's own tag. It signs nothing: each signature rides the image. */
export const CHARTER_INCEPTION_KIND = "charter-inception" as const;

/** A refusal this act names: what stood in the way. Nothing signed. */
export class CofoundRefusal extends Error {
  override readonly name = "CofoundRefusal";
  constructor(readonly code: CofoundRefusalCode, message: string) { super(`${code}: ${message}`); }
}
export type CofoundRefusalCode =
  | "cofound-offer-malformed" | "cofound-seat-malformed" | "cofound-same-seat" | "cofound-same-commitment"
  | "cofound-seat-is-committed" | "cofound-fingerprint-unheard" | "cofound-offer-mismatch"
  | "cofound-join-malformed" | "cofound-hand-mismatch" | "cofound-image-mismatch";

/** The four addresses a release manifest binds: the image digest and the genesis, engine and grammar CIDs. */
export interface ReleaseManifestAddresses {
  readonly image:   string;   // `sha256:` and 64 lower hex, an OCI image index digest
  readonly genesis: string;   // CIDv1 raw sha-256, base32
  readonly engine:  string;
  readonly grammar: string;
}

/** A founder's public seat material: the seat key and the digest of its cold successor. */
export interface CofoundSeat {
  readonly seat: string;
  readonly next: string;
}

/** A's public half, carried to B. */
export interface CofoundOffer extends CofoundSeat {
  readonly kind:       typeof COFOUND_OFFER_DOMAIN;
  readonly charterLaw: string;
  readonly manifest:   ReleaseManifestAddresses;
}

/** The exact image every seated key signs: the genesis's own fields, its AID, and what the founders agreed to. */
export interface CharterInceptionImage {
  readonly kind:           typeof CHARTER_INCEPTION_DOMAIN;
  readonly aid:            string;
  readonly keys:           readonly string[];   // sorted, distinct, lower hex
  readonly threshold:      number;
  readonly nextKeyDigests: readonly string[];   // positional over `keys`
  readonly nextThreshold:  number;
  readonly charterLaw:     string;
  readonly manifest:       ReleaseManifestAddresses;
}

/** B's answer, carried to A. */
export interface CofoundJoin extends CofoundSeat {
  readonly kind:      typeof COFOUND_JOIN_KIND;
  readonly offer:     CofoundOffer;
  readonly signature: QuorumSignature;
}

/** The image with its signatures, carried to B. */
export interface CharterInception {
  readonly kind:       typeof CHARTER_INCEPTION_KIND;
  readonly image:      CharterInceptionImage;
  readonly signatures: readonly QuorumSignature[];
}

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
const IMAGE_DIGEST = /^sha256:[0-9a-f]{64}$/;
const CID_SHAPE = /^b[a-z2-7]{58}$/;
const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";
/** A CIDv1 raw sha-256 in its one spelling: lower base32, the raw/sha-256 header, and a canonical re-encoding. */
function isRawSha256Cid(v: unknown): v is string {
  if (typeof v !== "string" || !CID_SHAPE.test(v)) return false;
  let bits = 0, acc = 0;
  const out: number[] = [];
  for (const c of v.slice(1)) {
    acc = (acc << 5) | BASE32.indexOf(c); bits += 5;
    if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); }
  }
  // The canonical re-encoding writes the raw/sha-256 header itself, so it refuses another header and stray padding.
  return out.length === 36 && cidV1Sha256FromHex(hex(Uint8Array.from(out.slice(4)))) === v;
}
const CHARTER_LAW = /^lar:\/\/\/[A-Za-z0-9._~\/#-]{1,500}$/;

const refuse = (code: CofoundRefusalCode, message: string): CofoundRefusal => new CofoundRefusal(code, message);
const record = (v: unknown): Record<string, unknown> | null => typeof v === "object" && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : null;
const exactKeys = (r: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(r);
  return own.length === keys.length && keys.every((k) => Object.hasOwn(r, k));
};
const isSeatKey = (v: unknown): v is string => typeof v === "string" && HEX64.test(v) && acceptEd25519Key(v).ok;
const isDigest = (v: unknown): v is string => typeof v === "string" && HEX64.test(v);

function readManifest(v: unknown): ReleaseManifestAddresses | null {
  const m = record(v);
  if (!m || !exactKeys(m, ["image", "genesis", "engine", "grammar"])) return null;
  const { image, genesis, engine, grammar } = m;
  if (typeof image !== "string" || !IMAGE_DIGEST.test(image)) return null;
  for (const cid of [genesis, engine, grammar]) if (!isRawSha256Cid(cid)) return null;
  return { image, genesis: genesis as string, engine: engine as string, grammar: grammar as string };
}

function readSeat(r: Record<string, unknown>): CofoundSeat | null {
  return isSeatKey(r["seat"]) && isDigest(r["next"]) ? { seat: r["seat"], next: r["next"] } : null;
}

// ── the offer ────────────────────────────────────────────────────────────────────────────────

/** Read an offer at its exact shape, from parsed JSON; null for anything else. */
export function readCofoundOffer(parsed: unknown): CofoundOffer | null {
  const r = record(parsed);
  if (!r || !exactKeys(r, ["kind", "seat", "next", "charterLaw", "manifest"]) || r["kind"] !== COFOUND_OFFER_DOMAIN) return null;
  const seat = readSeat(r);
  const manifest = readManifest(r["manifest"]);
  const law = r["charterLaw"];
  if (!seat || !manifest || typeof law !== "string" || !CHARTER_LAW.test(law)) return null;
  return { kind: COFOUND_OFFER_DOMAIN, seat: seat.seat, next: seat.next, charterLaw: law, manifest };
}

/** Compose A's offer; refuses material its reader would refuse. */
export function cofoundOffer(input: CofoundSeat & { readonly charterLaw: string; readonly manifest: ReleaseManifestAddresses }): CofoundOffer {
  const offer = readCofoundOffer({ kind: COFOUND_OFFER_DOMAIN, seat: input.seat, next: input.next,
    charterLaw: input.charterLaw, manifest: input.manifest });
  if (!offer) throw refuse("cofound-offer-malformed", "the offer needs a seat key the Ed25519 door accepts, a successor digest, a lar: charter law and the four release addresses, in lower-case hex");
  return offer;
}

/** The offer fingerprint: 64 lower hex over the offer's canonical bytes. */
export function offerFingerprint(offer: CofoundOffer): string {
  return sha256HexSync(canonicalJson(offer));
}

// ── the read-back a person types ─────────────────────────────────────────────────────────────

const spoken = (s: string): string => s.replace(/[\s-]/g, "").toLowerCase();

/** Whether a fingerprint typed as heard names this seat key. Spacing, dashes and case never matter. */
export function heardSeatFingerprint(typed: string, seatKey: string): boolean {
  return typeof typed === "string" && typeof seatKey === "string" && HEX64.test(seatKey) &&
    spoken(typed) === spoken(seatFingerprint(seatKey));
}

/** A 64-hex fingerprint in groups of four, for reading aloud. */
export function fingerprintGroups(fingerprint: string): string {
  if (!HEX64.test(fingerprint)) throw new TypeError("fingerprintGroups: expected 64 lower hex");
  return fingerprint.match(/.{4}/g)!.join("-");
}

// ── the inception image ──────────────────────────────────────────────────────────────────────

/** The genesis epoch an inception image seats. */
export function inceptionGenesis(image: CharterInceptionImage): SealEpoch {
  return genesisCharterEpoch(image.keys, image.threshold, { digests: image.nextKeyDigests, threshold: image.nextThreshold });
}

/**
 * Compose the joint inception image from A's offer and B's seat. Both founders run this on the same public
 * material and reach the same bytes. Refuses a seat both sides share, a successor both commit, and a seat key
 * whose own digest either side committed as a successor (its reveal would re-seat a seated key and stall the
 * Nexus at its first roll).
 */
export function composeCharterInception(offer: CofoundOffer, joiner: CofoundSeat): CharterInceptionImage {
  const own = readCofoundOffer(offer);
  if (!own) throw refuse("cofound-offer-malformed", "the offer does not read at its exact shape");
  const r = record(joiner);
  const b = r && exactKeys(r, ["seat", "next"]) ? readSeat(r) : null;
  if (!b) throw refuse("cofound-seat-malformed", "the joining seat needs a key the Ed25519 door accepts and a successor digest, in lower-case hex");
  if (b.seat === own.seat) throw refuse("cofound-same-seat", "both founders name one seat key — each seat holds its own key");
  if (b.next === own.next) throw refuse("cofound-same-commitment", "both founders commit one successor — each seat commits its own cold key");
  const committed = new Set([own.next, b.next]);
  for (const seat of [own.seat, b.seat]) {
    if (committed.has(seatNextDigest(seat))) {
      throw refuse("cofound-seat-is-committed", "a seat key equals a committed successor — its reveal would re-seat a seated key");
    }
  }
  const pairs = [own, b].map((s) => ({ seat: s.seat, next: s.next })).sort((x, y) => x.seat < y.seat ? -1 : 1);
  const keys = pairs.map((p) => p.seat);
  const nextKeyDigests = pairs.map((p) => p.next);
  const genesis = genesisCharterEpoch(keys, COFOUND_THRESHOLD, { digests: nextKeyDigests, threshold: COFOUND_THRESHOLD });
  return {
    kind: CHARTER_INCEPTION_DOMAIN, aid: genesis.epochCid, keys, threshold: COFOUND_THRESHOLD,
    nextKeyDigests, nextThreshold: COFOUND_THRESHOLD, charterLaw: own.charterLaw, manifest: own.manifest,
  };
}

/**
 * Read an inception image at its exact shape: seats sorted, distinct and accepted by the Ed25519 door, one
 * distinct successor digest per seat under the seats' own threshold, and an AID its own fields re-derive.
 */
export function readCharterInceptionImage(parsed: unknown): CharterInceptionImage | null {
  const r = record(parsed);
  if (!r || r["kind"] !== CHARTER_INCEPTION_DOMAIN || !exactKeys(r,
    ["kind", "aid", "keys", "threshold", "nextKeyDigests", "nextThreshold", "charterLaw", "manifest"])) return null;
  const { aid, keys, threshold, nextKeyDigests, nextThreshold, charterLaw } = r;
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > 256 || !keys.every(isSeatKey)) return null;
  if (keys.some((k, i) => i > 0 && !((keys[i - 1] as string) < k))) return null;
  if (typeof threshold !== "number" || !Number.isInteger(threshold) || threshold < 1 || threshold > keys.length) return null;
  if (!Array.isArray(nextKeyDigests) || nextKeyDigests.length !== keys.length || !nextKeyDigests.every(isDigest) ||
      new Set(nextKeyDigests).size !== keys.length || nextThreshold !== threshold) return null;
  if (typeof charterLaw !== "string" || !CHARTER_LAW.test(charterLaw)) return null;
  const manifest = readManifest(r["manifest"]);
  if (!manifest || typeof aid !== "string") return null;
  const seats = keys as string[], digests = nextKeyDigests as string[];
  if (aid !== sealEpochCidOf({ keySetHash: sealKeySetHash(seats, threshold), nextKeyDigests: digests, nextThreshold: threshold, prevEpochCid: null })) return null;
  return { kind: CHARTER_INCEPTION_DOMAIN, aid, keys: [...seats], threshold, nextKeyDigests: [...digests], nextThreshold: threshold, charterLaw, manifest };
}

/** The bytes every seated key signs: the image's canonical JSON. */
export function charterInceptionBytes(image: CharterInceptionImage): Uint8Array {
  return canonicalJsonBytes(image);
}

/** The final charter fingerprint: 64 lower hex over the inception image's canonical bytes. */
export function finalCharterFingerprint(image: CharterInceptionImage): string {
  return sha256HexSync(canonicalJson(image));
}

const sameImage = (a: CharterInceptionImage, b: CharterInceptionImage): boolean => canonicalJson(a) === canonicalJson(b);

function readSignature(v: unknown): QuorumSignature | null {
  const s = record(v);
  if (!s || !exactKeys(s, ["signer", "sig"])) return null;
  return typeof s["signer"] === "string" && HEX64.test(s["signer"]) && typeof s["sig"] === "string" && HEX128.test(s["sig"])
    ? { signer: s["signer"], sig: s["sig"] } : null;
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

// ── the join ─────────────────────────────────────────────────────────────────────────────────

/**
 * B joins: B types A's seat fingerprint as heard, composes the image, and half-signs it. Every refusal lands
 * before the signer runs.
 */
export async function cofoundJoin(offer: CofoundOffer, joiner: CofoundSeat, heardOfferSeat: string, hand: SealRollSigner): Promise<CofoundJoin> {
  const own = readCofoundOffer(offer);
  if (!own) throw refuse("cofound-offer-malformed", "the offer does not read at its exact shape");
  if (!heardSeatFingerprint(heardOfferSeat, own.seat)) throw refuse("cofound-fingerprint-unheard", "the fingerprint typed as heard names another seat than the offer's");
  if (typeof hand?.signer !== "string" || hand.signer.toLowerCase() !== joiner.seat) throw refuse("cofound-hand-mismatch", "the hand that signs holds another key than the joining seat");
  const image = composeCharterInception(own, joiner);
  const sig = await hand.sign(charterInceptionBytes(image));
  return { kind: COFOUND_JOIN_KIND, offer: own, seat: joiner.seat, next: joiner.next, signature: { signer: joiner.seat, sig } };
}

/** Read a join at its exact shape: the offer, B's seat, and a half signature that verifies over the image both compose. */
export function readCofoundJoin(parsed: unknown): { readonly join: CofoundJoin; readonly image: CharterInceptionImage } | null {
  const r = record(parsed);
  if (!r || r["kind"] !== COFOUND_JOIN_KIND || !exactKeys(r, ["kind", "offer", "seat", "next", "signature"])) return null;
  const offer = readCofoundOffer(r["offer"]);
  const seat = readSeat(r);
  const signature = readSignature(r["signature"]);
  if (!offer || !seat || !signature || signature.signer !== seat.seat) return null;
  let image: CharterInceptionImage;
  try { image = composeCharterInception(offer, seat); } catch { return null; }
  if (!verifyEd25519(signature.sig, charterInceptionBytes(image), seat.seat)) return null;
  return { join: { kind: COFOUND_JOIN_KIND, offer, seat: seat.seat, next: seat.next, signature }, image };
}

export type CofoundJudgement =
  | { readonly ok: true; readonly join: CofoundJoin; readonly image: CharterInceptionImage }
  | { readonly ok: false; readonly code: CofoundRefusalCode; readonly why: string };

/** A judges B's join against the offer A made and B's seat fingerprint as A heard it. */
export function judgeCofoundJoin(parsed: unknown, mine: { readonly offer: CofoundOffer; readonly heardJoinSeat: string }): CofoundJudgement {
  const read = readCofoundJoin(parsed);
  if (!read) return { ok: false, code: "cofound-join-malformed", why: "the join does not read at its exact shape, or its half signature fails the image" };
  if (offerFingerprint(read.join.offer) !== offerFingerprint(mine.offer)) {
    return { ok: false, code: "cofound-offer-mismatch", why: "the join answers another offer than the one this seat made" };
  }
  if (!heardSeatFingerprint(mine.heardJoinSeat, read.join.seat)) {
    return { ok: false, code: "cofound-fingerprint-unheard", why: "the fingerprint typed as heard names another seat than the join's" };
  }
  return { ok: true, ...read };
}

/** A seals: the judge runs first, then A's seat signs the same image B half-signed. */
export async function sealCofound(parsedJoin: unknown, mine: { readonly offer: CofoundOffer; readonly heardJoinSeat: string },
  hand: SealRollSigner): Promise<CharterInception> {
  const judged = judgeCofoundJoin(parsedJoin, mine);
  if (!judged.ok) throw refuse(judged.code, judged.why);
  if (typeof hand?.signer !== "string" || hand.signer.toLowerCase() !== mine.offer.seat) throw refuse("cofound-hand-mismatch", "the hand that signs holds another key than the offer's seat");
  const sig = await hand.sign(charterInceptionBytes(judged.image));
  const signatures = [judged.join.signature, { signer: mine.offer.seat, sig }].sort((a, b) => a.signer < b.signer ? -1 : 1);
  return { kind: CHARTER_INCEPTION_KIND, image: judged.image, signatures };
}

// ── the inception ────────────────────────────────────────────────────────────────────────────

/** Read a signed inception at its exact shape. Signatures read as shapes only; `verifyCharterInception` judges them. */
export function readCharterInception(parsed: unknown): CharterInception | null {
  const r = record(parsed);
  if (!r || r["kind"] !== CHARTER_INCEPTION_KIND || !exactKeys(r, ["kind", "image", "signatures"])) return null;
  const image = readCharterInceptionImage(r["image"]);
  const raw = r["signatures"];
  if (!image || !Array.isArray(raw) || raw.length > 256) return null;
  const signatures: QuorumSignature[] = [];
  for (const s of raw) { const read = readSignature(s); if (!read) return null; signatures.push(read); }
  return { kind: CHARTER_INCEPTION_KIND, image, signatures };
}

export type InceptionRefusal =
  | "inception-malformed" | "inception-unbound" | "inception-unsigned" | "inception-foreign-signer"
  | "inception-signature-invalid" | "inception-short-of-seats";

/**
 * Does this inception carry every seated key's signature over its one image, and nothing else, and does it bind
 * `genesis` where one stands? Null when it does; else the first refusal. An inception holds exact bytes: zero
 * signatures, a signer outside the seats or named twice, a signature that fails the image, or a seat that did
 * not sign each refuses. The law holds for any seat count (a seed's one seat signs its own inception); the
 * two-founder shape belongs to `judgeCharterInception`, which compares the image a founder composed.
 */
export function verifyCharterInception(parsed: unknown, genesis?: SealEpoch): InceptionRefusal | null {
  const inception = readCharterInception(parsed);
  if (!inception) return "inception-malformed";
  const { image } = inception;
  if (genesis !== undefined) {
    if (genesis.prevEpochCid !== null || genesis.roll !== undefined || genesis.epochCid !== image.aid ||
        canonicalJson(genesis.nextKeyDigests) !== canonicalJson(image.nextKeyDigests) || genesis.nextThreshold !== image.nextThreshold ||
        genesis.keySetHash !== sealKeySetHash(image.keys, image.threshold) || genesis.epochCid !== sealEpochCidOf(genesis)) return "inception-unbound";
  }
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

/**
 * B judges the sealed inception A carried back against the image B composed: the same bytes, every seat signed.
 */
export function judgeCharterInception(parsed: unknown, expected: CharterInceptionImage):
  { readonly ok: true; readonly inception: CharterInception } | { readonly ok: false; readonly code: CofoundRefusalCode | InceptionRefusal } {
  const inception = readCharterInception(parsed);
  if (!inception) return { ok: false, code: "inception-malformed" };
  if (!sameImage(inception.image, expected)) return { ok: false, code: "cofound-image-mismatch" };
  const code = verifyCharterInception(inception);
  return code ? { ok: false, code } : { ok: true, inception };
}

// ── the read-back ────────────────────────────────────────────────────────────────────────────

/**
 * The lines a terminal shows both founders: both fingerprints, the AID, the rule, both seat keys with the
 * fingerprint each founder reads aloud, the charter law and the release. Refuses an image the offer never fed.
 */
export function cofoundReadBack(offer: CofoundOffer, image: CharterInceptionImage): readonly string[] {
  const own = readCofoundOffer(offer), read = readCharterInceptionImage(image);
  if (!own || !read || read.keys.length !== COFOUND_THRESHOLD || read.threshold !== COFOUND_THRESHOLD ||
      seatCommitment(read, own.seat) !== own.next || read.charterLaw !== own.charterLaw ||
      canonicalJson(read.manifest) !== canonicalJson(own.manifest)) {
    throw refuse("cofound-image-mismatch", "the image does not seat two of two around the offer's seat, its successor, charter law and release");
  }
  const lines = [
    `offer fingerprint: ${fingerprintGroups(offerFingerprint(own))}`,
    `final charter fingerprint: ${fingerprintGroups(finalCharterFingerprint(read))}`,
    `nexus: ${read.aid}`,
    `rule: ${read.threshold} of ${read.keys.length}`,
  ];
  for (const key of read.keys) lines.push(`${key === own.seat ? "offer seat" : "joining seat"}: ${seatFingerprint(key)} key ${key}`);
  lines.push(`charter law: ${read.charterLaw}`,
    `release: image ${read.manifest.image} genesis ${read.manifest.genesis} engine ${read.manifest.engine} grammar ${read.manifest.grammar}`);
  return lines;
}

export type ColdCardReading = "opens" | "another-key" | "unreadable";

/**
 * Does a typed cold card open the successor `digest` commits? The key code alone decides: a card printed with
 * the right charter and generation labels and another key reads `another-key`, and so does a card from another
 * charter or generation. The seed zero-fills before the answer.
 */
export async function coldCardOpens(digest: string, code: string): Promise<ColdCardReading> {
  let seed: Uint8Array;
  try { seed = coldKeySeedFromCode(code); } catch { return "unreadable"; }
  try {
    const key = await coldKeyFromSeed(seed);
    try { return key.digest === digest ? "opens" : "another-key"; } finally { key.seed.fill(0); }
  } catch { return "unreadable"; } finally { seed.fill(0); }
}

/** The successor digest an image commits for one seat, or null where the image seats no such key. */
export function seatCommitment(image: CharterInceptionImage, seatKey: string): string | null {
  const i = image.keys.indexOf(seatKey);
  return i < 0 ? null : image.nextKeyDigests[i]!;
}
