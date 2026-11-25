/**
 * keep-seat — the KEEP PAIR a house seals its keep bundle's roster to, and the slot tree its secret half rests wrapped in.
 *
 * A keep's remote crosses to another vessel, so its bundle carries the roster of one human's faces sealed. A cut runs where no
 * person stands (`rite keep --if-due`, the session-end hook), so it seals to the pair's PUBLIC half and asks for no credential.
 * The SECRET half rests nowhere in clear: a random key its own slot tree wraps (`keyslot.ts`) under the human's EXISTING routes,
 * a passphrase slot and a paper slot, derives it. The seat ({public half, wrapped tree}) travels in the bundle beside the roster,
 * so a restore needs the passphrase or the paper sheet and no file carried by hand.
 *
 * APART FROM EVERY FACE BY ITS OWN KEYS, NOT BY A WRAP DOMAIN. The seat's slots wrap under keyslot's one `slot-wrap` info, as
 * every tree's do; what keeps them apart is the seat's OWN random key, its own random slot ids, its own random passphrase salts
 * and its own stretch salt: no face tree's slot, salt or key opens it. The derivations FROM that key carry domains of their own:
 * the X25519 secret under `KEEP_PAIR_INFO`, the signing seed under `KEEP_SIGN_INFO`, the roster seal under `KEEP_ROSTER_INFO`
 * and the cut's signature under `KEEP_CUT_DOMAIN`, so none fuses with another protocol's.
 *
 * BOUNDED. A keep binds at most `KEEP_MAX_SLOTS` slots and `KEEP_MAX_PINS` pins in all; a seat read off a remote with more reads
 * `unreadable`, so a crafted seat spends no restore past what a house binds.
 *
 * THE COST OF A GUESS. The wrapped secret rides the remote, so the passphrase slot meets offline guessing: each passphrase first
 * stretches at keyslot's remote cost under the seat's own random salt (`stretchForRemote`), then derives at the custody
 * passphrase's production cost as every pin does, so a guess against the remote copy pays both, and no argument or stored field
 * lowers either. A paper slot carries its sheet's 256 bits and derives through no passphrase KDF.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { constantTimeBytesEqual, defaultCryptoProvider, hex, hexToBytes } from "./crypto.js";
import { KEEP_CUT_DOMAIN, KEEP_PAIR_INFO, KEEP_ROSTER_INFO, KEEP_SIGN_INFO } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { bindSlot, confirmHeldPaper, decodeSlotTree, encodeSlotTree, openTreeKey, stretchForRemote, type Credential, type KdfPort, type PinSpec, type SlotSpec, type SlotTree } from "./keyslot.js";
import { openFromSender, sealToRecipient, SEALED_BOX_AEAD_NONCE_LEN } from "./sealed-box.js";
import { mintTreeKey, type TreeKey } from "./tree-key.js";

/** The keep pair as it rests and travels: the public half a cut seals to, and the tree its secret half opens from. */
export interface KeepSeat {
  readonly publicKey: Uint8Array;
  /** The salt every passphrase of this seat stretches under at the remote cost, before its pin derives. */
  readonly stretchSalt: Uint8Array;
  readonly slots: SlotTree;
}

const STRETCH_SALT_LENGTH = 16;
/** The most slots a keep seat binds (a passphrase, a paper sheet, the routes a re-seat leaves room for). */
export const KEEP_MAX_SLOTS = 8;
/** The most pins a keep seat holds across all its slots. */
export const KEEP_MAX_PINS = 16;
const pinsOf = (tree: SlotTree): number => tree.slots.reduce((n, s) => n + s.pins.length, 0);

/** The seat's passphrases stretched at the remote cost; every other credential as presented. */
async function stretchedCredentials(salt: Uint8Array, credentials: readonly Credential[], kdf: KdfPort): Promise<Credential[]> {
  const out: Credential[] = [];
  for (const c of credentials) out.push(c.kind === "passphrase" && c.passphrase !== "" ? { kind: "passphrase", passphrase: await stretchForRemote(c.passphrase, salt, kdf) } : c);
  return out;
}

/** A slot spec's passphrase pins stretched at the remote cost; every other pin as given. */
async function stretchedSpec(salt: Uint8Array, spec: SlotSpec, kdf: KdfPort): Promise<SlotSpec> {
  const pins: PinSpec[] = [];
  for (const p of spec.pins) pins.push(p.kind === "passphrase" && p.passphrase !== "" ? { kind: "passphrase", passphrase: await stretchForRemote(p.passphrase, salt, kdf) } : p);
  return { t: spec.t, pins };
}

/** A fresh pair: the seat that rests and travels, and the signing seed the minting house keeps beside it, never in a bundle. */
export interface KeepMint { readonly seat: KeepSeat; readonly signingSeed: Uint8Array }

export type KeepSecretOpening =
  /** `verifyKey` checks a cut's signature; `signingSeed` lets a house that lost its local seed sign again. Zero-fill both secrets. */
  | { readonly reading: "opens"; readonly secret: Uint8Array; readonly signingSeed: Uint8Array; readonly verifyKey: Uint8Array; readonly slot: string }
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
const SIGN_INFO = new TextEncoder().encode(KEEP_SIGN_INFO);
const CUT_DOMAIN = new TextEncoder().encode(KEEP_CUT_DOMAIN);
const KEY_LENGTH = 32;

/** The keep pair's X25519 secret, derived from the key its tree wraps. */
const secretOf = (treeKey: TreeKey): Uint8Array => hkdf(sha256, treeKey, new Uint8Array(0), PAIR_INFO, KEY_LENGTH);

/** The keep's Ed25519 signing seed, derived from the same key its tree wraps. */
const signingSeedOf = (treeKey: TreeKey): Uint8Array => hkdf(sha256, treeKey, new Uint8Array(0), SIGN_INFO, KEY_LENGTH);

/** Mint a keep pair whose secret rests wrapped under `spec`'s routes alone, with the signing seed its cuts sign under. */
export async function mintKeepSeat(spec: SlotSpec, kdf: KdfPort): Promise<KeepMint> {
  const treeKey = mintTreeKey();
  const stretchSalt = defaultCryptoProvider.getRandomValues(new Uint8Array(STRETCH_SALT_LENGTH));
  try {
    const slots = await bindSlot(null, treeKey, await stretchedSpec(stretchSalt, spec, kdf), kdf);
    const secret = secretOf(treeKey);
    try { return { seat: { publicKey: x25519.getPublicKey(secret), stretchSalt, slots }, signingSeed: signingSeedOf(treeKey) }; } finally { secret.fill(0); }
  } finally { treeKey.fill(0); }
}

/**
 * Mint a keep pair under a PROVED route (the credentials a custody open named as its opener): one slot holding every pin of the
 * route at its threshold, then the self-check, opening the seat under that very route and matching its verify key to the seed.
 * A route holding a passkey, or none, mints nothing. Throws `keep-seat-unchecked` where the check fails; nothing should rest then.
 */
export async function mintKeepSeatUnder(route: readonly Credential[], kdf: KdfPort): Promise<KeepMint | null> {
  const pins: PinSpec[] = [];
  for (const c of route) {
    if (c.kind === "passphrase" && c.passphrase !== "") pins.push({ kind: "passphrase", passphrase: c.passphrase });
    else if (c.kind === "paper") pins.push({ kind: "paper", confirmed: confirmHeldPaper(c.sheets) });
    else return null;
  }
  if (pins.length === 0) return null;
  const mint = await mintKeepSeat({ t: pins.length, pins }, kdf);
  const check = await openKeepSecret(mint.seat, route, kdf);
  if (check.reading !== "opens") throw new Error(`keep-seat-unchecked: the pair minted under this route did not open under it (${check.reading})`);
  const answers = constantTimeBytesEqual(check.verifyKey, keepVerifyKeyOf(mint.signingSeed));
  check.secret.fill(0); check.signingSeed.fill(0);
  if (!answers) throw new Error("keep-seat-unchecked: the pair minted under this route opened to another signing key");
  return mint;
}

/**
 * The bytes a cut signs: the domain, the bundle id, the sealed roster's digest, and the digest of the whole manifest save its
 * signature (`manifestDigest`, 32 bytes), so no manifest field outside the hashed files (a row's override base, its family
 * bases, an omission) changes on a remote unchallenged.
 */
function cutMessage(bundleId: string, sealedRoster: Uint8Array, manifestDigest: Uint8Array): Uint8Array {
  if (manifestDigest.length !== 32) throw new Error("keep-seat: a cut signs a 32-byte manifest digest");
  const id = new TextEncoder().encode(bundleId);
  const digest = sha256(sealedRoster);
  const out = new Uint8Array(CUT_DOMAIN.length + 1 + id.length + 1 + digest.length + manifestDigest.length);
  out.set(CUT_DOMAIN, 0);
  out.set(id, CUT_DOMAIN.length + 1);
  out.set(digest, CUT_DOMAIN.length + 1 + id.length + 1);
  out.set(manifestDigest, CUT_DOMAIN.length + 1 + id.length + 1 + digest.length);
  return out;
}

/** Sign a cut: the bundle id, its sealed roster and its manifest's digest, under the keep's signing seed. Deterministic, so an
 *  unmoved cut signs alike. */
export function signKeepCut(signingSeed: Uint8Array, bundleId: string, sealedRoster: Uint8Array, manifestDigest: Uint8Array): Uint8Array {
  return ed25519.sign(cutMessage(bundleId, sealedRoster, manifestDigest), signingSeed);
}

/** The verify key a signing seed answers to. */
export function keepVerifyKeyOf(signingSeed: Uint8Array): Uint8Array {
  return ed25519.getPublicKey(signingSeed);
}

/** Whether `signature` signs this bundle id, sealed roster and manifest digest under `verifyKey`; false on any fault. */
export function verifyKeepCut(verifyKey: Uint8Array, bundleId: string, sealedRoster: Uint8Array, manifestDigest: Uint8Array, signature: Uint8Array): boolean {
  try { return verifyEd25519(signature, cutMessage(bundleId, sealedRoster, manifestDigest), verifyKey); } catch { return false; }
}

async function openTree(seat: KeepSeat, credentials: readonly Credential[], kdf: KdfPort): Promise<{ readonly treeKey: TreeKey; readonly slot: string } | Exclude<KeepSecretOpening, { reading: "opens" }>> {
  const u = await openTreeKey(seat.slots, await stretchedCredentials(seat.stretchSalt, credentials, kdf), kdf);
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
  try {
    const signingSeed = signingSeedOf(o.treeKey);
    return { reading: "opens", secret: secretOf(o.treeKey), signingSeed, verifyKey: keepVerifyKeyOf(signingSeed), slot: o.slot };
  } finally { o.treeKey.fill(0); }
}

/** Bind one more slot (a paper sheet beside the passphrase, say) over the seat's own key, opened by `openWith`. */
export async function bindKeepSlot(seat: KeepSeat, openWith: readonly Credential[], spec: SlotSpec, kdf: KdfPort): Promise<KeepSlotBinding> {
  if (seat.slots.slots.length >= KEEP_MAX_SLOTS || pinsOf(seat.slots) + spec.pins.length > KEEP_MAX_PINS) {
    throw new Error(`keep-seat: a keep binds at most ${KEEP_MAX_SLOTS} slots and ${KEEP_MAX_PINS} pins; re-seat it (\`lares vault reseat\`) to start fresh`);
  }
  const o = await openTree(seat, openWith, kdf);
  if ("reading" in o) return o;
  try { return { reading: "bound", seat: { publicKey: seat.publicKey, stretchSalt: seat.stretchSalt, slots: await bindSlot(seat.slots, o.treeKey, await stretchedSpec(seat.stretchSalt, spec, kdf), kdf) } }; }
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
  return `${JSON.stringify({ publicKey: hex(seat.publicKey), stretchSalt: hex(seat.stretchSalt), slots: JSON.parse(new TextDecoder().decode(encodeSlotTree(seat.slots))) }, null, 2)}\n`;
}

export type KeepSeatReading =
  | { readonly reading: "readable"; readonly seat: KeepSeat }
  | { readonly reading: "unreadable"; readonly why: string };

/** Read a seat back; every shape fault reads `unreadable` with its reason. */
export function decodeKeepSeat(text: string): KeepSeatReading {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { reading: "unreadable", why: "the seat holds no JSON" }; }
  if (typeof raw !== "object" || raw === null) return { reading: "unreadable", why: "the seat holds no object" };
  const { publicKey, stretchSalt, slots } = raw as { publicKey?: unknown; stretchSalt?: unknown; slots?: unknown };
  if (typeof publicKey !== "string" || !/^[0-9a-f]{64}$/.test(publicKey)) return { reading: "unreadable", why: "the seat names no 32-byte public half" };
  if (typeof stretchSalt !== "string" || !/^[0-9a-f]{32}$/.test(stretchSalt)) return { reading: "unreadable", why: "the seat names no 16-byte stretch salt" };
  const tree = decodeSlotTree(new TextEncoder().encode(JSON.stringify(slots ?? null)));
  if (tree.reading !== "readable") return { reading: "unreadable", why: tree.reading === "unreadable" ? tree.why : "the seat holds no slot tree" };
  if (tree.tree.slots.length > KEEP_MAX_SLOTS || pinsOf(tree.tree) > KEEP_MAX_PINS) return { reading: "unreadable", why: `the seat names more than the ${KEEP_MAX_SLOTS} slots or ${KEEP_MAX_PINS} pins a keep binds` };
  return { reading: "readable", seat: { publicKey: hexToBytes(publicKey), stretchSalt: hexToBytes(stretchSalt), slots: tree.tree } };
}
