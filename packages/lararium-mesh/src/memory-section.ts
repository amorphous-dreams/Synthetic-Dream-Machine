/**
 * memory-section — the content keys a face's backup bundle carries, as one sealed section, and the two small
 * boxes that move its opener between a vessel's main thread and its key island.
 *
 * WHAT A SECTION HOLDS. One entry per bag and key version: the bag's id, the bag's locator, the key version id
 * and the content key. The key version id commits the key and the bag (`keyVersionIdOf`), so a reader that
 * holds an entry recomputes the id; this module reads an entry's SHAPE and judges no relation inside it. The
 * content-key holder judges each entry at its import door.
 *
 * WHO SEALS IT, AND TO WHOM. The content-key holder seals a section inside itself, to the public half of a key
 * pair the bundle key alone derives (`face-bundle`). No secret crosses the island's port at a cut: a public key
 * goes in and ciphertext comes out. The bundle key's holder alone derives the secret half.
 *
 * HOW THE SECRET HALF REACHES AN IMPORT. The island that imports names a fresh public key for that one import
 * (`mintMemoryKeypair`). The vessel's main thread seals the section pair's secret half to it (`sealMemorySecret`),
 * and the island opens it inside itself (`openMemorySecret`). The secret crosses the port sealed.
 *
 * WHO MAY ASK. A vessel's main thread signs each ask of its own island with the vessel key (`signMemoryAsk`), over
 * the request id and a digest of what it hands in. The island refuses an ask that carries no such signature
 * (`memoryAskRefusal`), so no other island, no session and no peer draws a section or lands one.
 *
 * BYTES IN, BYTES OUT. A sealed section rides as `sender's ephemeral key ‖ nonce ‖ ciphertext`.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store · lar:///ha.ka.ba/lararium/mesh/custody#/the-bundle
 */
import { x25519 } from "@noble/curves/ed25519.js";
import { canonicalJson, canonicalJsonBytes, hexToBytes, sha256HexSync, utf8Bytes } from "./crypto.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { MEMORY_ASK_DOMAIN, SEALED_MEMORY_BOX_INFO, SEALED_MEMORY_DOOR_INFO, SEALED_MEMORY_SECTION_DOMAIN } from "./domains.js";
import { SEALED_BOX_AEAD_NONCE_LEN, openFromSender, sealToRecipient } from "./sealed-box.js";
import { CONTENT_KEY_LEN, isWellFormedText, readSealedImage, sealedImage } from "./sealed-chunk.js";

/** One entry as a section carries it. `key` reads as 32 bytes and nothing more: the import door judges it. */
export interface MemoryEntry {
  readonly bagId:      string;
  /** The bag's opaque locator, 64 lower hex. */
  readonly locator:    string;
  /** The key version id the entry names, 64 lower hex. */
  readonly keyVersion: string;
  readonly key:        Uint8Array;
}

/** An X25519 key pair: a section's own pair, or the pair an island names for one import. */
export interface MemoryKeypair { readonly secret: Uint8Array; readonly public: Uint8Array }

const HEX64 = /^[0-9a-f]{64}$/;
const PUB_LEN = 32;
const BOX_HEAD = PUB_LEN + SEALED_BOX_AEAD_NONCE_LEN;
const BOX_INFO = utf8Bytes(SEALED_MEMORY_BOX_INFO);
const DOOR_INFO = utf8Bytes(SEALED_MEMORY_DOOR_INFO);

/** A fresh pair from the platform's own randomness. */
export function mintMemoryKeypair(): MemoryKeypair {
  const secret = x25519.utils.randomSecretKey();
  return { secret, public: x25519.getPublicKey(secret) };
}
/** The pair one 32-byte secret names. The bundle derives a section's secret from its own key and calls this. */
export function memoryKeypairOf(secret: Uint8Array): MemoryKeypair {
  if (!(secret instanceof Uint8Array) || secret.length !== 32) throw new TypeError("memory-section: a pair's secret half rides 32 bytes");
  return { secret: Uint8Array.from(secret), public: x25519.getPublicKey(secret) };
}

function box(recipientPub: Uint8Array, plaintext: Uint8Array, info: Uint8Array): Uint8Array {
  const sealed = sealToRecipient({ recipientPub, plaintext, info });
  const out = new Uint8Array(BOX_HEAD + sealed.ciphertext.length);
  out.set(sealed.senderEphemeralPub, 0);
  out.set(sealed.aeadNonce, PUB_LEN);
  out.set(sealed.ciphertext, BOX_HEAD);
  return out;
}
function unbox(bytes: unknown, recipientSecret: unknown, info: Uint8Array): Uint8Array | null {
  if (!(bytes instanceof Uint8Array) || bytes.length < BOX_HEAD + 16) return null;
  if (!(recipientSecret instanceof Uint8Array) || recipientSecret.length !== 32) return null;
  return openFromSender({
    recipientSecret, senderEphemeralPub: bytes.subarray(0, PUB_LEN), aeadNonce: bytes.subarray(PUB_LEN, BOX_HEAD),
    ciphertext: bytes.subarray(BOX_HEAD), info,
  });
}

/** Read a list: an image with an empty name and any count of members. Null where the bytes hold another shape,
 *  and then every member it cut zero-fills before it returns. */
function readList(bytes: Uint8Array): Uint8Array[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [];
  const refuse = (): null => { for (const part of parts) part.fill(0); return null; };
  let at = 0;
  while (at < bytes.length) {
    if (at + 4 > bytes.length) return refuse();
    const size = view.getUint32(at, false);
    if (at + 4 + size > bytes.length) return refuse();
    parts.push(bytes.slice(at + 4, at + 4 + size));
    at += 4 + size;
  }
  return parts.length >= 1 && parts[0]!.length === 0 ? parts.slice(1) : refuse();
}

/**
 * Seal `entries` as one section to `to`, a section pair's public half. The caller owns the entries' keys; the
 * plaintext image this function builds zero-fills before it returns. Throws on an entry that reads malformed
 * and on a recipient that reads as no key: a cut never believes it sealed what it did not.
 */
export function sealMemorySection(entries: readonly MemoryEntry[], to: Uint8Array): Uint8Array {
  if (!(to instanceof Uint8Array) || to.length !== PUB_LEN) throw new TypeError("memory-section: a section seals to a 32-byte public key");
  const images = entries.map((entry) => {
    if (!isWellFormedText(entry.bagId) || !HEX64.test(entry.locator) || !HEX64.test(entry.keyVersion) || !(entry.key instanceof Uint8Array) || entry.key.length !== CONTENT_KEY_LEN) {
      throw new TypeError("memory-section: an entry names a bag, a locator, a key version and a 32-byte key");
    }
    return sealedImage("", utf8Bytes(entry.bagId), hexToBytes(entry.locator), hexToBytes(entry.keyVersion), entry.key);
  });
  const list = sealedImage("", ...images);
  const plaintext = sealedImage(SEALED_MEMORY_SECTION_DOMAIN, list);
  try { return box(to, plaintext, BOX_INFO); }
  finally { plaintext.fill(0); list.fill(0); for (const image of images) image.fill(0); }
}

/**
 * Open a section with its pair's secret half. Answers the entries, each read for shape alone, or null where the
 * section does not open or opens to another shape. The caller owns the keys it gets back and zero-fills them.
 */
export function openMemorySection(section: unknown, secret: unknown): MemoryEntry[] | null {
  const plaintext = unbox(section, secret, BOX_INFO);
  if (plaintext === null) return null;
  // EVERY COPY OF THE PLAINTEXT LEAVES WITH THIS CALL. Each read below cuts fresh buffers out of the one before it;
  // all of them enter `scrub`, and the one `finally` zero-fills them on every exit, a malformed section included.
  const scrub: Uint8Array[] = [plaintext];
  try {
    const fields = readSealedImage(SEALED_MEMORY_SECTION_DOMAIN, plaintext, 1);
    if (fields !== null) scrub.push(...fields);
    const images = fields === null ? null : readList(fields[0]!);
    if (images === null) return null;
    scrub.push(...images);
    const out: MemoryEntry[] = [];
    for (const image of images) {
      const entry = readSealedImage("", image, 4);
      if (entry !== null) scrub.push(...entry);
      if (entry === null || entry[1]!.length !== 32 || entry[2]!.length !== 32 || entry[3]!.length !== CONTENT_KEY_LEN) return wipe(out);
      let bagId: string;
      try { bagId = new TextDecoder("utf-8", { fatal: true }).decode(entry[0]!); } catch { return wipe(out); }
      if (!isWellFormedText(bagId)) return wipe(out);
      out.push({ bagId, locator: hexOf(entry[1]!), keyVersion: hexOf(entry[2]!), key: Uint8Array.from(entry[3]!) });
    }
    return out;
  } finally { for (const bytes of scrub) bytes.fill(0); }
}
function wipe(entries: MemoryEntry[]): null { for (const entry of entries) entry.key.fill(0); return null; }
function hexOf(bytes: Uint8Array): string { let s = ""; for (const b of bytes) s += b.toString(16).padStart(2, "0"); return s; }

/** Seal a section pair's secret half to the public key one island named for one import. */
export function sealMemorySecret(secret: Uint8Array, door: Uint8Array): Uint8Array {
  if (!(secret instanceof Uint8Array) || secret.length !== 32) throw new TypeError("memory-section: a pair's secret half rides 32 bytes");
  if (!(door instanceof Uint8Array) || door.length !== PUB_LEN) throw new TypeError("memory-section: an import's door reads as a 32-byte public key");
  return box(door, secret, DOOR_INFO);
}
/** Open a sealed secret half with the door pair's own secret. Null where it does not open. */
export function openMemorySecret(sealed: unknown, doorSecret: unknown): Uint8Array | null {
  const secret = unbox(sealed, doorSecret, DOOR_INFO);
  if (secret === null) return null;
  if (secret.length !== 32) { secret.fill(0); return null; }
  return secret;
}

// ── The vessel's own ask ────────────────────────────────────────────────────────────────────────
export const MEMORY_ACTS = ["cut", "door", "import"] as const;
/**
 * What a cut's ask says where the vessel's main thread already read its own edge's shadow, at the entry of the
 * act the cut belongs to, and read none. The word rides inside the facts the vessel signs.
 */
export const MEMORY_CUT_SHADOW_READ = "read-clear";
export type MemoryAct = (typeof MEMORY_ACTS)[number];

/** The bytes a vessel signs for one ask of its island: the act, this request's own id, and a digest of what it hands in. */
function memoryAskImage(parts: { readonly requestId: string; readonly act: MemoryAct; readonly facts: unknown }): Uint8Array {
  return canonicalJsonBytes({ domain: MEMORY_ASK_DOMAIN, requestId: parts.requestId, act: parts.act, facts: sha256HexSync(canonicalJson(parts.facts)) });
}
/** Sign one ask as the vessel. `sign` answers the vessel key's signature, as lower hex, over the bytes handed in. */
export async function signMemoryAsk(parts: {
  readonly requestId: string; readonly act: MemoryAct; readonly facts: unknown; readonly sign: (bytes: Uint8Array) => Promise<string>;
}): Promise<string> {
  return parts.sign(memoryAskImage(parts));
}
/** Why the island refuses one ask, or null where the vessel's own key signed exactly this request. */
export function memoryAskRefusal(parts: {
  readonly requestId: unknown; readonly act: MemoryAct; readonly facts: unknown; readonly ask: unknown; readonly vesselVerifyingKey: string;
}): string | null {
  const refusal = "this island answers a memory ask from its own vessel's main thread alone: the ask carries the vessel key's signature over its own request";
  if (typeof parts.requestId !== "string" || parts.requestId.length === 0 || typeof parts.ask !== "string") return refusal;
  let image: Uint8Array;
  try { image = memoryAskImage({ requestId: parts.requestId, act: parts.act, facts: parts.facts }); } catch { return refusal; }
  let holds = false;
  try { holds = verifyEd25519(parts.ask, image, parts.vesselVerifyingKey.replace(/^0x/, "").toLowerCase()); } catch { holds = false; }
  return holds ? null : refusal;
}
