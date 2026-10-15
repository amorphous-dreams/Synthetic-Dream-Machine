/**
 * cofound — the two-founder Nexus founding act, as PURE images: the offer, the join, the inception, and the
 * read-back a person checks before a seat signs (kahu#/seed-and-nexus).
 *
 * Two founders, each from their own vault, seat one key each in a FRESH joint genesis at two of two. Neither
 * household seed moves. The act crosses between the vaults as files alone, and no clock decides any step.
 *
 * ── THE THREE FILES ─────────────────────────────────────────────────────────────────────────────
 *   · THE OFFER (A → B): A's seat key, the digest of A's cold successor, A's hearth's cadence key and its next
 *     key's digest, the charter law the Nexus adopts and the release manifest's four addresses. It signs
 *     nothing. Its checksum names the OFFER FINGERPRINT.
 *   · THE JOIN (B → A): the offer as B read it, B's seat key, the digest of B's cold successor, B's hearth's
 *     cadence material, B's HALF SIGNATURE over the inception image the two seats compose, and B's cadence
 *     signature over the cadence inception that image cites. B signs only after typing A's seat fingerprint
 *     as heard.
 *   · THE INCEPTION (A → B): the offer and the same image, signed by both seats, with the cadence inception
 *     signed by both hearths. A signs only after typing B's seat fingerprint as heard. The image's checksum
 *     names the FINAL CHARTER FINGERPRINT.
 *
 * ── THE INVARIANTS ──────────────────────────────────────────────────────────────────────────────
 *   · ONE IMAGE, ONE AID. The inception image (wax-stamp's) commits the offer fingerprint, both founders' fresh
 *     successor commitments and the one cadence inception the founding seats, and the AID content-addresses it: each side composes it from the public material
 *     alone and derives one AID, neither holds the other's signer, and two foundings by one roster never alias.
 *   · TWO FINGERPRINTS, NEVER ONE FOR THE OTHER. The offer fingerprint names A's half; the final charter
 *     fingerprint names the joint image. Each digests under its own domain, so neither ever equals the other.
 *   · A JUDGE RUNS BEFORE EVERY SIGNATURE. A misheard fingerprint, a join over another offer, or a half
 *     signature that fails its bytes refuses before the signer runs.
 *   · EVERY SEATED KEY SIGNS THE INCEPTION (`verifyInception` in wax-stamp, the law every genesis meets), and
 *     every cadence holder signs the cadence inception it cites (`cadence-lineage`).
 *   · TWO JOINTS, NEVER ONE. The cadence names each founder's HEARTH at two of two, apart from the seats: a
 *     cadence key that equals a seat key refuses, so the cadence never fuses with the kahu quorum.
 *   · A LABEL NEVER DECIDES. A cold card's printed fields aid the person; its key code alone answers whether
 *     it opens the seat's committed successor.
 *   · STRICT READERS. Each file reads at its exact shape, one encoding (lower-case hex), no extra field; an
 *     offer and a join never read as an inception, and none of the three reads as a charter doc.
 *
 * Callers: the cofound ceremony behind the custody door (`packages/lararium-node/src/cofound-ceremony.ts`), which
 * `lares nexus seal cofound open|join|seal` drives (`packages/lares-cli/src/commands/nexus-seal.ts`).
 *
 * Pure: no I/O, no clock, no log. Platform-blind.
 * Meme: lar:///ha.ka.ba/lararium/mesh/kahu#/seed-and-nexus
 */
import { canonicalJson, cidV1Sha256FromHex, hex, sha256HexSync } from "./crypto.js";
import { COFOUND_OFFER_DOMAIN } from "./domains.js";
import { acceptEd25519Key, verifyEd25519 } from "./ed25519-door.js";
import { coldKeyFromSeed, coldKeySeedFromCode, seatNextDigest } from "./cold-key-card.js";
import type { QuorumSignature } from "./kapae-antigen.js";
import { NEXUS_DOC_DOMAIN, seatFingerprint, type NexusDoc } from "./nexus-seal-seed.js";
import {
  cadenceInceptionBytes, cadenceInceptionDigest, cadenceInceptionImage, readCadenceHolder,
  type CadenceHolder, type CadenceInception, type CadenceInceptionImage,
} from "./cadence-lineage.js";
import {
  charterInceptionBytes, charterInceptionImage, genesisOfInception, inceptionImageDigest, readCharterInception,
  readCharterInceptionImage, verifyInception,
  type CharterInceptionImage, type InceptionRefusal, type SealEpoch, type SealRollSigner,
} from "./wax-stamp.js";

export { charterInceptionBytes, readCharterInceptionImage, type CharterInceptionImage, type InceptionRefusal };

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
  | "cofound-join-malformed" | "cofound-hand-mismatch" | "cofound-image-mismatch" | "cofound-cadence-malformed"
  | "cofound-cadence-is-a-seat";

/** The four addresses a release manifest binds: the image digest and the genesis, engine and grammar CIDs. */
export interface ReleaseManifestAddresses {
  readonly image:   string;   // `sha256:` and 64 lower hex, an OCI image index digest
  readonly genesis: string;   // CIDv1 raw sha-256, base32
  readonly engine:  string;
  readonly grammar: string;
}

/** A founder's public material: the seat key, the digest of its cold successor, and its hearth's cadence key. */
export interface CofoundSeat {
  readonly seat:    string;
  readonly next:    string;
  readonly cadence: CadenceHolder;
}

/** A's public half, carried to B. */
export interface CofoundOffer extends CofoundSeat {
  readonly kind:       typeof COFOUND_OFFER_DOMAIN;
  readonly charterLaw: string;
  readonly manifest:   ReleaseManifestAddresses;
}

/** B's answer, carried to A: B's half signature over the charter image and B's hearth's over the cadence image. */
export interface CofoundJoin extends CofoundSeat {
  readonly kind:             typeof COFOUND_JOIN_KIND;
  readonly offer:            CofoundOffer;
  readonly signature:        QuorumSignature;
  readonly cadenceSignature: QuorumSignature;
}

/** The offer, the image and its signatures, and the cadence inception the image cites, carried to B. */
export interface CofoundInception {
  readonly kind:       typeof CHARTER_INCEPTION_KIND;
  readonly offer:      CofoundOffer;
  readonly image:      CharterInceptionImage;
  readonly signatures: readonly QuorumSignature[];
  readonly cadence:    CadenceInception;
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
  const cadence = readCadenceHolder(r["cadence"]);
  return isSeatKey(r["seat"]) && isDigest(r["next"]) && cadence ? { seat: r["seat"], next: r["next"], cadence } : null;
}

// ── the offer ────────────────────────────────────────────────────────────────────────────────

/** Read an offer at its exact shape, from parsed JSON; null for anything else. */
export function readCofoundOffer(parsed: unknown): CofoundOffer | null {
  const r = record(parsed);
  if (!r || !exactKeys(r, ["kind", "seat", "next", "cadence", "charterLaw", "manifest"]) || r["kind"] !== COFOUND_OFFER_DOMAIN) return null;
  const seat = readSeat(r);
  const manifest = readManifest(r["manifest"]);
  const law = r["charterLaw"];
  if (!seat || !manifest || typeof law !== "string" || !CHARTER_LAW.test(law) || seat.cadence.key === seat.seat) return null;
  return { kind: COFOUND_OFFER_DOMAIN, seat: seat.seat, next: seat.next, cadence: seat.cadence, charterLaw: law, manifest };
}

/** Compose A's offer; refuses material its reader would refuse. */
export function cofoundOffer(input: CofoundSeat & { readonly charterLaw: string; readonly manifest: ReleaseManifestAddresses }): CofoundOffer {
  const offer = readCofoundOffer({ kind: COFOUND_OFFER_DOMAIN, seat: input.seat, next: input.next, cadence: input.cadence,
    charterLaw: input.charterLaw, manifest: input.manifest });
  if (!offer) throw refuse("cofound-offer-malformed", "the offer needs a seat key the Ed25519 door accepts, a successor digest, a hearth cadence key apart from the seat with its next key's digest, a lar: charter law and the four release addresses, in lower-case hex");
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

/** The Nexus AID an inception image names: its genesis's content address. */
export function inceptionAid(image: CharterInceptionImage): string {
  return genesisOfInception(image).epochCid;
}

/**
 * The cadence inception a joint founding seats: both founders' hearths, at two of two. Refuses a cadence key that
 * equals any seat key (the two joints never fuse), and holders that repeat a key or a next-key digest.
 */
export function composeCadenceInception(offer: CofoundOffer, joiner: CofoundSeat): CadenceInceptionImage {
  const seats = new Set([offer.seat, joiner.seat]);
  if (seats.has(offer.cadence.key) || seats.has(joiner.cadence.key)) {
    throw refuse("cofound-cadence-is-a-seat", "a cadence key equals a seat key — the cadence keeps its own keys, apart from the kahu quorum");
  }
  try { return cadenceInceptionImage([offer.cadence, joiner.cadence], COFOUND_THRESHOLD); }
  catch { throw refuse("cofound-cadence-malformed", "both hearths name one cadence key or one next-key digest, or a cadence key equals a committed next key"); }
}

/**
 * Compose the joint inception image from A's offer and B's seat. Both founders run this on the same public
 * material and reach the same bytes. It commits the offer fingerprint, both successors and the cadence inception's
 * digest. Refuses a seat both sides share, a successor both commit, a seat key whose own digest either side
 * committed as a successor (its reveal would re-seat a seated key and stall the Nexus at its first roll), and a
 * cadence the two hearths cannot seat.
 */
export function composeCharterInception(offer: CofoundOffer, joiner: CofoundSeat): CharterInceptionImage {
  const own = readCofoundOffer(offer);
  if (!own) throw refuse("cofound-offer-malformed", "the offer does not read at its exact shape");
  const r = record(joiner);
  const b = r && exactKeys(r, ["seat", "next", "cadence"]) ? readSeat(r) : null;
  if (!b) throw refuse("cofound-seat-malformed", "the joining seat needs a key the Ed25519 door accepts, a successor digest and a hearth cadence key with its next key's digest, in lower-case hex");
  if (b.seat === own.seat) throw refuse("cofound-same-seat", "both founders name one seat key — each seat holds its own key");
  if (b.next === own.next) throw refuse("cofound-same-commitment", "both founders commit one successor — each seat commits its own cold key");
  const committed = new Set([own.next, b.next]);
  for (const seat of [own.seat, b.seat]) {
    if (committed.has(seatNextDigest(seat))) {
      throw refuse("cofound-seat-is-committed", "a seat key equals a committed successor — its reveal would re-seat a seated key");
    }
  }
  const cadence = composeCadenceInception(own, b);
  const pairs = [own, b].map((s) => ({ seat: s.seat, next: s.next })).sort((x, y) => x.seat < y.seat ? -1 : 1);
  return charterInceptionImage(pairs.map((p) => p.seat), COFOUND_THRESHOLD,
    { digests: pairs.map((p) => p.next), threshold: COFOUND_THRESHOLD },
    { offer: offerFingerprint(own), cadence: cadenceInceptionDigest(cadence) });
}

/** The final charter fingerprint: 64 lower hex over the inception image's canonical bytes. */
export function finalCharterFingerprint(image: CharterInceptionImage): string {
  return inceptionImageDigest(image);
}

const sameImage = (a: CharterInceptionImage, b: CharterInceptionImage): boolean => canonicalJson(a) === canonicalJson(b);

function readSignature(v: unknown): QuorumSignature | null {
  const s = record(v);
  if (!s || !exactKeys(s, ["signer", "sig"])) return null;
  return typeof s["signer"] === "string" && HEX64.test(s["signer"]) && typeof s["sig"] === "string" && HEX128.test(s["sig"])
    ? { signer: s["signer"], sig: s["sig"] } : null;
}

// ── the join ─────────────────────────────────────────────────────────────────────────────────

/**
 * B joins: B types A's seat fingerprint as heard, composes the image, half-signs it with the seat, and signs the
 * cadence inception it cites with the hearth's cadence key. Every refusal lands before either signer runs.
 */
export async function cofoundJoin(offer: CofoundOffer, joiner: CofoundSeat, heardOfferSeat: string, hand: SealRollSigner,
  cadenceHand: SealRollSigner): Promise<CofoundJoin> {
  const own = readCofoundOffer(offer);
  if (!own) throw refuse("cofound-offer-malformed", "the offer does not read at its exact shape");
  if (!heardSeatFingerprint(heardOfferSeat, own.seat)) throw refuse("cofound-fingerprint-unheard", "the fingerprint typed as heard names another seat than the offer's");
  if (typeof hand?.signer !== "string" || hand.signer.toLowerCase() !== joiner.seat) throw refuse("cofound-hand-mismatch", "the hand that signs holds another key than the joining seat");
  if (typeof cadenceHand?.signer !== "string" || cadenceHand.signer.toLowerCase() !== joiner.cadence?.key) throw refuse("cofound-hand-mismatch", "the hearth's hand holds another key than the joining cadence key");
  const image = composeCharterInception(own, joiner);
  const cadence = composeCadenceInception(own, joiner);
  const sig = await hand.sign(charterInceptionBytes(image));
  const cadenceSig = await cadenceHand.sign(cadenceInceptionBytes(cadence));
  return { kind: COFOUND_JOIN_KIND, offer: own, seat: joiner.seat, next: joiner.next, cadence: { ...joiner.cadence },
    signature: { signer: joiner.seat, sig }, cadenceSignature: { signer: joiner.cadence.key, sig: cadenceSig } };
}

/**
 * Read a join at its exact shape: the offer, B's seat and hearth, a half signature that verifies over the image both
 * compose, and B's hearth's signature over the cadence image it cites.
 */
export function readCofoundJoin(parsed: unknown): { readonly join: CofoundJoin; readonly image: CharterInceptionImage; readonly cadence: CadenceInceptionImage } | null {
  const r = record(parsed);
  if (!r || r["kind"] !== COFOUND_JOIN_KIND || !exactKeys(r, ["kind", "offer", "seat", "next", "cadence", "signature", "cadenceSignature"])) return null;
  const offer = readCofoundOffer(r["offer"]);
  const seat = readSeat(r);
  const signature = readSignature(r["signature"]);
  const cadenceSignature = readSignature(r["cadenceSignature"]);
  if (!offer || !seat || !signature || !cadenceSignature || signature.signer !== seat.seat || cadenceSignature.signer !== seat.cadence.key) return null;
  let image: CharterInceptionImage, cadence: CadenceInceptionImage;
  try { image = composeCharterInception(offer, seat); cadence = composeCadenceInception(offer, seat); } catch { return null; }
  if (!verifyEd25519(signature.sig, charterInceptionBytes(image), seat.seat)) return null;
  if (!verifyEd25519(cadenceSignature.sig, cadenceInceptionBytes(cadence), seat.cadence.key)) return null;
  return { join: { kind: COFOUND_JOIN_KIND, offer, seat: seat.seat, next: seat.next, cadence: seat.cadence, signature, cadenceSignature }, image, cadence };
}

export type CofoundJudgement =
  | { readonly ok: true; readonly join: CofoundJoin; readonly image: CharterInceptionImage; readonly cadence: CadenceInceptionImage }
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

const bySigner = (a: QuorumSignature, b: QuorumSignature): number => a.signer < b.signer ? -1 : 1;

/** A seals: the judge runs first, then A's seat signs the same image B half-signed, and A's hearth the cadence image. */
export async function sealCofound(parsedJoin: unknown, mine: { readonly offer: CofoundOffer; readonly heardJoinSeat: string },
  hand: SealRollSigner, cadenceHand: SealRollSigner): Promise<CofoundInception> {
  const judged = judgeCofoundJoin(parsedJoin, mine);
  if (!judged.ok) throw refuse(judged.code, judged.why);
  if (typeof hand?.signer !== "string" || hand.signer.toLowerCase() !== mine.offer.seat) throw refuse("cofound-hand-mismatch", "the hand that signs holds another key than the offer's seat");
  if (typeof cadenceHand?.signer !== "string" || cadenceHand.signer.toLowerCase() !== mine.offer.cadence.key) throw refuse("cofound-hand-mismatch", "the hearth's hand holds another key than the offer's cadence key");
  const sig = await hand.sign(charterInceptionBytes(judged.image));
  const cadenceSig = await cadenceHand.sign(cadenceInceptionBytes(judged.cadence));
  const signatures = [judged.join.signature, { signer: mine.offer.seat, sig }].sort(bySigner);
  const cadenceSignatures = [judged.join.cadenceSignature, { signer: mine.offer.cadence.key, sig: cadenceSig }].sort(bySigner);
  return { kind: CHARTER_INCEPTION_KIND, offer: judged.join.offer, image: judged.image, signatures,
    cadence: { image: judged.cadence, signatures: cadenceSignatures } };
}

// ── the inception ────────────────────────────────────────────────────────────────────────────

/**
 * Read a signed inception file at its exact shape: the offer, an image whose founding names that offer, a cadence
 * inception that seats the offer's hearth, and signatures read as shapes (`verifyCharterInception` judges them).
 */
export function readCofoundInception(parsed: unknown): CofoundInception | null {
  const r = record(parsed);
  if (!r || r["kind"] !== CHARTER_INCEPTION_KIND || !exactKeys(r, ["kind", "offer", "image", "signatures", "cadence"])) return null;
  const offer = readCofoundOffer(r["offer"]);
  const read = readCharterInception({ image: r["image"], signatures: r["signatures"], cadence: r["cadence"] });
  if (!offer || !read || !read.cadence || read.image.founding?.offer !== offerFingerprint(offer)) return null;
  const at = read.cadence.image.keys.indexOf(offer.cadence.key);
  if (at < 0 || read.cadence.image.nextKeyDigests[at] !== offer.cadence.next) return null;
  return { kind: CHARTER_INCEPTION_KIND, offer, image: read.image, signatures: read.signatures, cadence: read.cadence };
}

/** The genesis an inception file seats, signatures and cadence inception and all (`verifyInception` judges it). */
export function cofoundGenesis(inception: CofoundInception): SealEpoch {
  return genesisOfInception(inception.image, inception.signatures, inception.cadence);
}

/**
 * The charter doc a verified joint inception founds: its genesis alone, at two of two, each chair named by its seat's
 * fingerprint (the export convention: no private label crosses). Both founders write the same bytes from the same
 * inception, filed under the joint AID beside each seed, which stays as it stands.
 */
export function cofoundCharterDoc(inception: CofoundInception): NexusDoc {
  const genesis = cofoundGenesis(inception);
  return {
    kind: NEXUS_DOC_DOMAIN, threshold: inception.image.threshold, sealEpochCid: genesis.epochCid, sealLineage: [genesis],
    kahu: inception.image.keys.map((key) => ({ chairLabel: seatFingerprint(key), verifyingKey: key })),
  };
}

/**
 * Does this inception file carry every seated key's signature over its one image, and nothing else? Null when it
 * does; else the first refusal (wax-stamp's `verifyInception`, the one law every genesis meets).
 */
export function verifyCharterInception(parsed: unknown): InceptionRefusal | null {
  const inception = readCofoundInception(parsed);
  return inception ? verifyInception(cofoundGenesis(inception)) : "inception-malformed";
}

/** B judges the sealed inception A carried back against the image B composed: the same bytes, every seat signed. */
export function judgeCharterInception(parsed: unknown, expected: CharterInceptionImage):
  { readonly ok: true; readonly inception: CofoundInception } | { readonly ok: false; readonly code: CofoundRefusalCode | InceptionRefusal } {
  const inception = readCofoundInception(parsed);
  if (!inception) return { ok: false, code: "inception-malformed" };
  if (!sameImage(inception.image, expected)) return { ok: false, code: "cofound-image-mismatch" };
  const code = verifyInception(cofoundGenesis(inception));
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
      seatCommitment(read, own.seat) !== own.next || read.founding?.offer !== offerFingerprint(own)) {
    throw refuse("cofound-image-mismatch", "the image does not seat two of two around the offer's seat and successor, under the offer's fingerprint");
  }
  const lines = [
    `offer fingerprint: ${fingerprintGroups(offerFingerprint(own))}`,
    `final charter fingerprint: ${fingerprintGroups(finalCharterFingerprint(read))}`,
    `nexus: ${inceptionAid(read)}`,
    `rule: ${read.threshold} of ${read.keys.length}`,
    `cadence: ${COFOUND_THRESHOLD} of ${COFOUND_THRESHOLD} hearths, inception ${fingerprintGroups(read.founding!.cadence)}`,
  ];
  for (const key of read.keys) lines.push(`${key === own.seat ? "offer seat" : "joining seat"}: ${seatFingerprint(key)} key ${key}`);
  lines.push(`offer hearth cadence key: ${own.cadence.key}`, `charter law: ${own.charterLaw}`,
    `release: image ${own.manifest.image} genesis ${own.manifest.genesis} engine ${own.manifest.engine} grammar ${own.manifest.grammar}`);
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
