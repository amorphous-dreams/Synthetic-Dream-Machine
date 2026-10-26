/**
 * s-envelope — the frame of a carrier sealed under the vessel's tree key, and the readings a writer keeps apart.
 *
 * THE FRAME: `magic ‖ nonce(24) ‖ ciphertext‖tag(16)`. The magic NAMES the scheme ("lares-s-seal", the node S key) and no version
 * byte follows it. One scheme, one mode, fixed widths: nothing in the frame negotiates. A change of scheme mints a
 * new magic, the way a change of protocol mints a new domain name, because a version byte invites the shredder this
 * frame exists to end — a vessel that cannot decode version N+1 reading it as "not sealed" and writing over it.
 *
 * THE READINGS. A writer asks what stands before it replaces anything, and each answer names one fact:
 *
 *  · `absent`     — nothing stands. A write may found the carrier.
 *  · `sealed`     — the house magic over a frame long enough to hold a nonce and a tag. A tree key may be tried.
 *  · `torn`       — the house magic over a frame too short to hold them, or a file cut inside the magic itself (its
 *                   bytes a proper prefix of the magic). The bytes never framed, so no key is at fault; the route
 *                   out is a backup, never a re-typed credential.
 *  · `old-shape`  — the four bytes `LARK` lead the file. No custody of this house writes that frame and no
 *                   reader here opens it; the fresh-start runbook answers it, and no write here replaces it.
 *  · `unopenable` — a seal stands that this build cannot frame: the house magic with damaged bytes, or another
 *                   scheme of the house family (`lares-…`) at any length. No key can be judged against it, so none
 *                   may replace it.
 *  · `bare`       — nothing frames as a seal: cleartext, or bytes of no seal this house writes.
 *
 * Only `absent`, and a `sealed` carrier the current tree key OPENS, earn a write (`sealed-writer`). Pure codec: no key,
 * no crypto; `tree-key.ts` holds the AEAD.
 */

/** The magic that names the tree key seal scheme. */
export const S_SEAL_MAGIC: Uint8Array = new TextEncoder().encode("lares-s-seal");
/** The four bytes a frame of the `old-shape` reading opens with ("LARK"). The house writes no such frame and opens none. */
export const LARK_MAGIC: Uint8Array = Uint8Array.from([0x4c, 0x41, 0x52, 0x4b]);
/** The house family prefix: a magic that opens with it names a house seal scheme, known to this build or not. */
const HOUSE_FAMILY_PREFIX = new TextEncoder().encode("lares-");
/** XChaCha20-Poly1305 nonce and tag widths. */
export const S_SEAL_NONCE_LENGTH = 24;
export const S_SEAL_TAG_LENGTH = 16;
/** The shortest frame that holds a magic, a nonce and a tag (an empty plaintext). */
export const S_SEAL_MIN_LENGTH = S_SEAL_MAGIC.length + S_SEAL_NONCE_LENGTH + S_SEAL_TAG_LENGTH;
/** A damaged magic still testifies to a house seal while at most this many of its bytes differ. */
const DAMAGED_MAGIC_TOLERANCE = 3;

export type SCarrierReading = "absent" | "sealed" | "torn" | "old-shape" | "unopenable" | "bare";

const startsWith = (bytes: Uint8Array, prefix: Uint8Array): boolean =>
  bytes.length >= prefix.length && prefix.every((b, i) => bytes[i] === b);

/** Bytes that stop inside the magic: a non-empty proper prefix of it. */
const cutInsideMagic = (bytes: Uint8Array): boolean =>
  bytes.length > 0 && bytes.length < S_SEAL_MAGIC.length && bytes.every((b, i) => S_SEAL_MAGIC[i] === b);

function magicDistance(bytes: Uint8Array): number {
  let d = 0;
  for (let i = 0; i < S_SEAL_MAGIC.length; i++) if (bytes[i] !== S_SEAL_MAGIC[i]) d++;
  return d;
}

/** Read what stands at a carrier, before any key is judged against it. `null` means nothing stands. */
export function readSCarrier(bytes: Uint8Array | null): SCarrierReading {
  if (bytes === null) return "absent";
  if (startsWith(bytes, S_SEAL_MAGIC)) return bytes.length >= S_SEAL_MIN_LENGTH ? "sealed" : "torn";
  if (cutInsideMagic(bytes)) return "torn";
  if (startsWith(bytes, LARK_MAGIC)) return "old-shape";
  if (startsWith(bytes, HOUSE_FAMILY_PREFIX)) return "unopenable";
  if (bytes.length >= S_SEAL_MIN_LENGTH && magicDistance(bytes) <= DAMAGED_MAGIC_TOLERANCE) return "unopenable";
  return "bare";
}

/** The parts of a `sealed` frame. Call only on bytes `readSCarrier` reads `sealed`. */
export function splitSFrame(bytes: Uint8Array): { readonly nonce: Uint8Array; readonly ciphertext: Uint8Array } {
  if (readSCarrier(bytes) !== "sealed") throw new Error("s-envelope: these bytes do not read sealed");
  const at = S_SEAL_MAGIC.length;
  return { nonce: bytes.subarray(at, at + S_SEAL_NONCE_LENGTH), ciphertext: bytes.subarray(at + S_SEAL_NONCE_LENGTH) };
}

/** Frame a nonce and its ciphertext under the magic. */
export function joinSFrame(nonce: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  if (nonce.length !== S_SEAL_NONCE_LENGTH) throw new Error(`s-envelope: a nonce rides ${S_SEAL_NONCE_LENGTH} bytes`);
  if (ciphertext.length < S_SEAL_TAG_LENGTH) throw new Error("s-envelope: a ciphertext carries at least its tag");
  const out = new Uint8Array(S_SEAL_MAGIC.length + nonce.length + ciphertext.length);
  out.set(S_SEAL_MAGIC, 0);
  out.set(nonce, S_SEAL_MAGIC.length);
  out.set(ciphertext, S_SEAL_MAGIC.length + nonce.length);
  return out;
}
