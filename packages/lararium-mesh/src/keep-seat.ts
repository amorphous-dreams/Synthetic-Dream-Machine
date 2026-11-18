/**
 * keep-seat — the KEEP PAIR a house seals its keep bundle's roster to, and the slot tree its secret half rests wrapped in.
 *
 * A keep's remote crosses to another vessel, so its bundle carries the roster of one human's faces sealed. A cut runs where no
 * person stands (`rite keep --if-due`, the session-end hook), so it seals to the pair's PUBLIC half and asks for no credential.
 * The SECRET half rests nowhere in clear: a random key its own slot tree wraps (`keyslot.ts`) under the human's EXISTING routes,
 * a passphrase slot and a paper slot, derives it. The seat ({public half, wrapped tree}) travels in the bundle beside the roster,
 * so a restore needs the passphrase or the paper sheet and no file carried by hand.
 *
 * DOMAIN-SEPARATED FROM EVERY FACE. The seat's tree wraps its OWN random key, under its own random slot ids and its own random
 * passphrase salts: no face tree's slot, salt or key opens it. The X25519 secret derives from that key under `KEEP_PAIR_INFO`,
 * and the roster seals under `KEEP_ROSTER_INFO`, so neither fuses with another protocol's derivation.
 *
 * THE COST OF A GUESS. The wrapped secret rides the remote, so the passphrase slot meets offline guessing: it derives through
 * keyslot's one scrypt constant, the custody passphrase's production cost, which no argument or stored field lowers. A paper
 * slot carries its sheet's 256 bits and derives through no passphrase KDF.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { constantTimeBytesEqual, hex, hexToBytes } from "./crypto.js";
import { KEEP_PAIR_INFO, KEEP_ROSTER_INFO } from "./domains.js";
import { bindSlot, decodeSlotTree, encodeSlotTree, openTreeKey, type Credential, type KdfPort, type SlotSpec, type SlotTree } from "./keyslot.js";
import { openFromSender, sealToRecipient, SEALED_BOX_AEAD_NONCE_LEN } from "./sealed-box.js";
import { mintTreeKey, type TreeKey } from "./tree-key.js";

/** The keep pair as it rests and travels: the public half a cut seals to, and the tree its secret half opens from. */
export interface KeepSeat {
  readonly publicKey: Uint8Array;
  readonly slots: SlotTree;
}

export type KeepSecretOpening =
  | { readonly reading: "opens"; readonly secret: Uint8Array; readonly slot: string }
  /** No slot opens under what was presented; `notes` never quotes a credential. */
  | { readonly reading: "no-slot-opens"; readonly notes: readonly string[] }
  /** A slot opened, and the secret it derives answers another public half: a seat spliced from two pairs. */
  | { readonly reading: "seat-torn" };

export type KeepSlotBinding =
  | { readonly reading: "bound"; readonly seat: KeepSeat }
  | { readonly reading: "no-slot-opens"; readonly notes: readonly string[] }
  | { readonly reading: "seat-torn" };

const PAIR_INFO = new TextEncoder().encode(KEEP_PAIR_INFO);
const ROSTER_INFO = new TextEncoder().encode(KEEP_ROSTER_INFO);
const KEY_LENGTH = 32;

/** The keep pair's X25519 secret, derived from the key its tree wraps. */
const secretOf = (treeKey: TreeKey): Uint8Array => hkdf(sha256, treeKey, new Uint8Array(0), PAIR_INFO, KEY_LENGTH);

/** Mint a keep pair whose secret rests wrapped under `spec`'s routes alone. */
export async function mintKeepSeat(spec: SlotSpec, kdf: KdfPort): Promise<KeepSeat> {
  const treeKey = mintTreeKey();
  try {
    const slots = await bindSlot(null, treeKey, spec, kdf);
    const secret = secretOf(treeKey);
    try { return { publicKey: x25519.getPublicKey(secret), slots }; } finally { secret.fill(0); }
  } finally { treeKey.fill(0); }
}

async function openTree(seat: KeepSeat, credentials: readonly Credential[], kdf: KdfPort): Promise<{ readonly treeKey: TreeKey; readonly slot: string } | Exclude<KeepSecretOpening, { reading: "opens" }>> {
  const u = await openTreeKey(seat.slots, credentials, kdf);
  if (u.reading !== "opens") return { reading: "no-slot-opens", notes: u.notes };
  const secret = secretOf(u.treeKey);
  const answers = constantTimeBytesEqual(x25519.getPublicKey(secret), seat.publicKey);
  secret.fill(0);
  if (!answers) { u.treeKey.fill(0); return { reading: "seat-torn" }; }
  return { treeKey: u.treeKey, slot: u.slot };
}

/** Open the keep secret under what the human presents: a passphrase, or a paper sheet. */
export async function openKeepSecret(seat: KeepSeat, credentials: readonly Credential[], kdf: KdfPort): Promise<KeepSecretOpening> {
  const o = await openTree(seat, credentials, kdf);
  if ("reading" in o) return o;
  try { return { reading: "opens", secret: secretOf(o.treeKey), slot: o.slot }; } finally { o.treeKey.fill(0); }
}

/** Bind one more slot (a paper sheet beside the passphrase, say) over the seat's own key, opened by `openWith`. */
export async function bindKeepSlot(seat: KeepSeat, openWith: readonly Credential[], spec: SlotSpec, kdf: KdfPort): Promise<KeepSlotBinding> {
  const o = await openTree(seat, openWith, kdf);
  if ("reading" in o) return o;
  try { return { reading: "bound", seat: { publicKey: seat.publicKey, slots: await bindSlot(seat.slots, o.treeKey, spec, kdf) } }; }
  finally { o.treeKey.fill(0); }
}

/** Seal `plaintext` to the keep pair's public half, binding the file it rests as. Asks for no credential. */
export function sealToKeep(publicKey: Uint8Array, plaintext: Uint8Array, logicalRef: string): Uint8Array {
  const box = sealToRecipient({ recipientPub: publicKey, plaintext, info: ROSTER_INFO, extraSalt: [new TextEncoder().encode(logicalRef)] });
  const out = new Uint8Array(KEY_LENGTH + SEALED_BOX_AEAD_NONCE_LEN + box.ciphertext.length);
  out.set(box.senderEphemeralPub, 0);
  out.set(box.aeadNonce, KEY_LENGTH);
  out.set(box.ciphertext, KEY_LENGTH + SEALED_BOX_AEAD_NONCE_LEN);
  return out;
}

/** Open what {@link sealToKeep} sealed, under the keep secret; null on any fault (a wrong secret, a torn frame, another file). */
export function openFromKeep(secret: Uint8Array, sealed: Uint8Array, logicalRef: string): Uint8Array | null {
  if (sealed.length <= KEY_LENGTH + SEALED_BOX_AEAD_NONCE_LEN) return null;
  return openFromSender({
    recipientSecret: secret,
    senderEphemeralPub: sealed.subarray(0, KEY_LENGTH),
    aeadNonce: sealed.subarray(KEY_LENGTH, KEY_LENGTH + SEALED_BOX_AEAD_NONCE_LEN),
    ciphertext: sealed.subarray(KEY_LENGTH + SEALED_BOX_AEAD_NONCE_LEN),
    info: ROSTER_INFO,
    extraSalt: [new TextEncoder().encode(logicalRef)],
  });
}

/** The seat as plain JSON: the public half in hex and the slot tree as keyslot encodes it. Nothing secret without a route. */
export function encodeKeepSeat(seat: KeepSeat): string {
  return `${JSON.stringify({ publicKey: hex(seat.publicKey), slots: JSON.parse(new TextDecoder().decode(encodeSlotTree(seat.slots))) }, null, 2)}\n`;
}

export type KeepSeatReading = { readonly reading: "readable"; readonly seat: KeepSeat } | { readonly reading: "unreadable"; readonly why: string };

/** Read a seat back; every shape fault reads `unreadable` with its reason. */
export function decodeKeepSeat(text: string): KeepSeatReading {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { reading: "unreadable", why: "the seat holds no JSON" }; }
  if (typeof raw !== "object" || raw === null) return { reading: "unreadable", why: "the seat holds no object" };
  const { publicKey, slots } = raw as { publicKey?: unknown; slots?: unknown };
  if (typeof publicKey !== "string" || !/^[0-9a-f]{64}$/.test(publicKey)) return { reading: "unreadable", why: "the seat names no 32-byte public half" };
  const tree = decodeSlotTree(new TextEncoder().encode(JSON.stringify(slots ?? null)));
  if (tree.reading !== "readable") return { reading: "unreadable", why: tree.reading === "unreadable" ? tree.why : "the seat holds no slot tree" };
  return { reading: "readable", seat: { publicKey: hexToBytes(publicKey), slots: tree.tree } };
}
