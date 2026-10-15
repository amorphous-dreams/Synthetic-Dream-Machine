/**
 * cadence-lineage — the ENGINE CADENCE's own inception: the hearth keys that bear a Nexus's reboots, their rule and
 * their pre-rotated next keys (kahu#/contract, the cadence lineage).
 *
 * The cadence keeps its own lineage and threshold, apart from every seat key: the kahu quorum never offers an engine,
 * and the cadence threshold never admits anyone. A founding act commits ONE cadence inception and cites it once (the
 * charter inception image's `founding.cadence`); from there the lineage governs itself.
 *
 * ── WHO HOLDS IT ────────────────────────────────────────────────────────────────────────────────
 * Each founder's HEARTH, the device that bears the reboot, holds one cadence key. The hearth mints it at random on
 * the device, never derived from serving or floor material, and keeps it with its next key as a `cold` row under
 * the vessel key that unwraps per act. No card prints at the founding; a holder may later rotate onto a cold card
 * by its own choice.
 *
 * ── THE INVARIANTS ──────────────────────────────────────────────────────────────────────────────
 *   · ONE IMAGE: the holders' keys sorted and distinct, one next-key digest per holder (positional over the sorted
 *     keys, distinct, under the holders' own threshold), and no holder key whose digest a holder committed.
 *   · EVERY HOLDER SIGNS IT, and nothing else does (the inception law every genesis meets, held for this joint too).
 *   · A CITATION NAMES THE BYTES: `cadenceInceptionDigest` digests the image's canonical bytes, and a charter that
 *     cites it carries the image and its signatures beside its own inception.
 *
 * Pure: no I/O, no clock, no log. Platform-blind.
 * Meme: lar:///ha.ka.ba/lararium/mesh/kahu#/contract
 */
import { canonicalJson, canonicalJsonBytes, sha256HexSync } from "./crypto.js";
import { CADENCE_INCEPTION_DOMAIN, CADENCE_NEXT_KEY_DOMAIN } from "./domains.js";
import { acceptEd25519Key, verifyEd25519 } from "./ed25519-door.js";
import type { QuorumSignature } from "./kapae-antigen.js";

/** One hearth's public cadence material: its key, and the digest of its next key. */
export interface CadenceHolder {
  readonly key:  string;
  readonly next: string;
}

/** The exact image every cadence holder signs. Keys sorted, distinct and lower-case; one digest per key. */
export interface CadenceInceptionImage {
  readonly kind:           typeof CADENCE_INCEPTION_DOMAIN;
  readonly keys:           readonly string[];
  readonly threshold:      number;
  readonly nextKeyDigests: readonly string[];
  readonly nextThreshold:  number;
}

/** A cadence inception: its image and its holders' signatures over the image's bytes. */
export interface CadenceInception {
  readonly image:      CadenceInceptionImage;
  readonly signatures: readonly QuorumSignature[];
}

export type CadenceRefusal =
  | "cadence-malformed" | "cadence-unsigned" | "cadence-foreign-signer" | "cadence-signature-invalid" | "cadence-short-of-holders";

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
const MAX_HOLDERS = 256;
const record = (v: unknown): Record<string, unknown> | null => typeof v === "object" && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : null;
const exactKeys = (r: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(r).length === keys.length && keys.every((k) => Object.hasOwn(r, k));
const isKey = (v: unknown): v is string => typeof v === "string" && HEX64.test(v) && acceptEd25519Key(v).ok;
const isDigest = (v: unknown): v is string => typeof v === "string" && HEX64.test(v);
const isThreshold = (t: unknown): t is number => typeof t === "number" && Number.isInteger(t) && t >= 1;

/** The digest a cadence image commits for one holder's next key. Refuses a key the Ed25519 door refuses. */
export function cadenceNextDigest(nextKey: string): string {
  if (!isKey(nextKey)) throw new TypeError("cadence-next-key: expected a 64 lower hex key the Ed25519 door accepts");
  return sha256HexSync(canonicalJson({ kind: CADENCE_NEXT_KEY_DOMAIN, key: nextKey }));
}

/** Read one holder's public material at its exact shape; null for anything else. */
export function readCadenceHolder(parsed: unknown): CadenceHolder | null {
  const r = record(parsed);
  if (!r || !exactKeys(r, ["key", "next"]) || !isKey(r["key"]) || !isDigest(r["next"])) return null;
  return { key: r["key"], next: r["next"] };
}

/**
 * Read a cadence inception image at its exact shape: holders sorted, distinct and accepted by the Ed25519 door; one
 * distinct next-key digest per holder under the holders' own threshold; no holder key whose digest a holder
 * committed (its reveal would re-seat a seated key).
 */
export function readCadenceInceptionImage(parsed: unknown): CadenceInceptionImage | null {
  const r = record(parsed);
  if (!r || r["kind"] !== CADENCE_INCEPTION_DOMAIN || !exactKeys(r, ["kind", "keys", "threshold", "nextKeyDigests", "nextThreshold"])) return null;
  const { keys, threshold, nextKeyDigests, nextThreshold } = r;
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > MAX_HOLDERS || !keys.every(isKey)) return null;
  if (keys.some((k, i) => i > 0 && !((keys[i - 1] as string) < (k as string)))) return null;
  if (!isThreshold(threshold) || threshold > keys.length) return null;
  if (!Array.isArray(nextKeyDigests) || nextKeyDigests.length !== keys.length || !nextKeyDigests.every(isDigest) ||
      new Set(nextKeyDigests).size !== keys.length || nextThreshold !== threshold) return null;
  const held = keys as string[], digests = nextKeyDigests as string[];
  if (held.some((k) => digests.includes(cadenceNextDigest(k)))) return null;
  return { kind: CADENCE_INCEPTION_DOMAIN, keys: [...held], threshold, nextKeyDigests: [...digests], nextThreshold: threshold };
}

/** Compose the image these holders sign under `threshold`; refuses what its reader would refuse. */
export function cadenceInceptionImage(holders: readonly CadenceHolder[], threshold: number): CadenceInceptionImage {
  const read = holders.map(readCadenceHolder);
  if (read.some((h) => h === null)) throw new TypeError("cadence-malformed: each holder needs a key the Ed25519 door accepts and a next-key digest, in lower-case hex");
  const sorted = (read as CadenceHolder[]).slice().sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  const image = readCadenceInceptionImage({ kind: CADENCE_INCEPTION_DOMAIN, keys: sorted.map((h) => h.key), threshold,
    nextKeyDigests: sorted.map((h) => h.next), nextThreshold: threshold });
  if (!image) throw new TypeError("cadence-malformed: the holders repeat a key or a next-key digest, commit a holder's own key, or the rule sits outside them");
  return image;
}

/** The bytes every cadence holder signs: the image's canonical JSON. */
export function cadenceInceptionBytes(image: CadenceInceptionImage): Uint8Array {
  return canonicalJsonBytes(image);
}

/** The citation a founding carries: 64 lower hex over the image's canonical bytes. */
export function cadenceInceptionDigest(image: CadenceInceptionImage): string {
  return sha256HexSync(canonicalJson(image));
}

/** Read a cadence inception at its exact shape; its signatures read as shapes, and `verifyCadenceInception` judges them. */
export function readCadenceInception(parsed: unknown): CadenceInception | null {
  const r = record(parsed);
  if (!r || !exactKeys(r, ["image", "signatures"])) return null;
  const image = readCadenceInceptionImage(r["image"]);
  const raw = r["signatures"];
  if (!image || !Array.isArray(raw) || raw.length > MAX_HOLDERS) return null;
  const signatures: QuorumSignature[] = [];
  for (const s of raw) {
    const q = record(s);
    if (!q || !exactKeys(q, ["signer", "sig"]) || !isDigest(q["signer"]) || typeof q["sig"] !== "string" || !HEX128.test(q["sig"])) return null;
    signatures.push({ signer: q["signer"], sig: q["sig"] });
  }
  return { image, signatures };
}

/**
 * Does this cadence inception carry every holder's signature over its one image, and nothing else? Null when it
 * does; else the first refusal. Zero signatures, a signer outside the holders or named twice, a signature that
 * fails the image, or a holder that did not sign each refuses.
 */
export function verifyCadenceInception(parsed: unknown): CadenceRefusal | null {
  const inception = readCadenceInception(parsed);
  if (!inception) return "cadence-malformed";
  const { image, signatures } = inception;
  if (signatures.length === 0) return "cadence-unsigned";
  const holders = new Set(image.keys), named = new Set<string>();
  for (const s of signatures) {
    if (!holders.has(s.signer) || named.has(s.signer)) return "cadence-foreign-signer";
    named.add(s.signer);
  }
  const bytes = cadenceInceptionBytes(image);
  if (!signatures.every((s) => verifyEd25519(s.sig, bytes, s.signer))) return "cadence-signature-invalid";
  if (named.size < image.keys.length) return "cadence-short-of-holders";
  return null;
}
