/**
 * ward-slots — THE WARD: a face's root seed rests under a key that stays sealed while the face's custody stands unlocked.
 *
 * Users keep full caps over their own wikis; the daemon and kahua wikis, and every act that changes who belongs to a face or what it
 * trusts, are bound by the ward (operator, 2026-11-04). A ward act opens the WARD KEY fresh from a human route, through the minted
 * KDF port, signs that one act and zeroes the key. No unlocked custody, no session and no script holding either reaches it.
 *
 *   · THE TREE. The ward key rests in its own slot tree (`faces/<fcid>/ward-slots.bin` on a node), a keyslot tree like any other,
 *     beside and apart from the face custody key's tree: the face's FCK never wraps it and it never wraps the FCK.
 *   · HUMAN ROUTES ALONE. A passkey is a web2.5 registry route (an authenticator vendor's PRF, never pono web3), so the ward binds
 *     none, opens no tree that carries one (a hand-edited tree too), and reads no passkey credential: `ward-passkey-refused`.
 *   · ITS OWN FRAME. A warded row seals under `lares-ward-seal` with its own domain (`CUSTODY_WARD_DOMAIN`), so a census tells a warded
 *     row from a face-sealed one by its first bytes, and an FCK-framed row standing where a warded row belongs reads as a fault.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-ward
 */
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { defaultCryptoProvider, type RandomProvider } from "./crypto.js";
import { CUSTODY_WARD_DOMAIN } from "./domains.js";
import { encodeCarrierContext } from "./custody-carrier-context.js";
import { FCK_SEAL_MAGIC } from "./fck-envelope.js";
import { S_SEAL_MAGIC } from "./s-envelope.js";
import type { FaceCarrier } from "./fck.js";
import { bindSlot, openTreeKey, type Credential, type KdfPort, type SlotSpec, type SlotTree, type TreeKeyUnlock } from "./keyslot.js";
import { mintTreeKey, type TreeKey } from "./tree-key.js";

/** The key a face's root seed rests under. Sealed at rest; opened for one act, then zeroed. */
export type WardKey = TreeKey;
export const mintWardKey = (rng: RandomProvider = defaultCryptoProvider): WardKey => mintTreeKey(rng);

/** The store namespace a warded row's context binds: never the face store a face-sealed row binds. */
export const WARD_STORE = "lares-ward";

export const WARD_SEAL_MAGIC = new TextEncoder().encode("lares-ward-seal");
const NONCE_LENGTH = 24;
const TAG_LENGTH = 16;
const MIN_LENGTH = WARD_SEAL_MAGIC.length + NONCE_LENGTH + TAG_LENGTH;

/** A ward act the ward itself refuses. `reading` names why; no message quotes a credential. */
export class WardRefused extends Error {
  override readonly name = "WardRefused";
  constructor(readonly reading: string, detail: string) { super(`${reading}: ${detail}`); }
}

const passkeyRefused = (where: string): WardRefused =>
  new WardRefused("ward-passkey-refused", `${where}: the ward binds and opens human routes alone (a passphrase, a paper sheet); a passkey rides an authenticator vendor's registry`);

/** Bind one slot of the ward tree over `wardKey` (`null` founds the tree). A passkey pin refuses by name before anything derives. */
export async function bindWardSlot(tree: SlotTree | null, wardKey: WardKey, spec: SlotSpec, kdf: KdfPort, rng: RandomProvider = defaultCryptoProvider): Promise<SlotTree> {
  if (spec.pins.some((p) => (p as { kind: unknown }).kind === "passkey")) throw passkeyRefused("bind");
  if (tree !== null) refusePasskeyTree(tree);
  return bindSlot(tree, wardKey, spec, kdf, rng);
}

/** Refuse a ward tree that carries a passkey pin anywhere: the ward never stands on a tree a hand could have widened that way. */
export function refusePasskeyTree(tree: SlotTree): void {
  if (tree.slots.some((s) => s.pins.some((p) => p.kind === "passkey"))) throw passkeyRefused("open");
}

/** Open the ward key with human routes alone. A tree carrying a passkey pin, or a passkey credential, refuses before any derivation. */
export async function openWardKey(tree: SlotTree, credentials: readonly Credential[], kdf: KdfPort): Promise<TreeKeyUnlock> {
  refusePasskeyTree(tree);
  if (credentials.some((c) => (c as { kind: unknown }).kind === "passkey")) throw passkeyRefused("credential");
  return openTreeKey(tree, credentials, kdf);
}

// ── the warded frame ───────────────────────────────────────────────────────────────────────────────

export type WardCarrierReading = "absent" | "sealed" | "torn" | "unopenable" | "bare";

const starts = (b: Uint8Array, p: Uint8Array): boolean => b.length >= p.length && p.every((v, i) => b[i] === v);
const family = new TextEncoder().encode("lares-");

/** What stands in a warded row's bytes: the ward's own frame, a torn one, another house seal (an FCK or S seal: `unopenable`), or bare. */
export function readWardCarrier(bytes: Uint8Array | null): WardCarrierReading {
  if (bytes === null) return "absent";
  if (starts(bytes, WARD_SEAL_MAGIC)) return bytes.length >= MIN_LENGTH ? "sealed" : "torn";
  if (bytes.length > 0 && bytes.length < WARD_SEAL_MAGIC.length && bytes.every((v, i) => WARD_SEAL_MAGIC[i] === v)) return "torn";
  if (starts(bytes, FCK_SEAL_MAGIC) || starts(bytes, S_SEAL_MAGIC) || starts(bytes, family)) return "unopenable";
  return "bare";
}

function aadFor(c: FaceCarrier): Uint8Array {
  const context = encodeCarrierContext({ domain: CUSTODY_WARD_DOMAIN, store: WARD_STORE, owner: c.owner, row: c.name, kind: c.kind, ref: c.ref });
  const aad = new Uint8Array(WARD_SEAL_MAGIC.length + context.length);
  aad.set(WARD_SEAL_MAGIC);
  aad.set(context, WARD_SEAL_MAGIC.length);
  return aad;
}

/** Seal `plaintext` as one warded row: the ward frame, a fresh nonce, and the AEAD over the row's context. */
export function sealUnderWard(wardKey: WardKey, c: FaceCarrier, plaintext: Uint8Array, rng: RandomProvider = defaultCryptoProvider): Uint8Array {
  const nonce = rng.getRandomValues(new Uint8Array(NONCE_LENGTH));
  const ciphertext = xchacha20poly1305(wardKey, nonce, aadFor(c)).encrypt(plaintext);
  const out = new Uint8Array(WARD_SEAL_MAGIC.length + NONCE_LENGTH + ciphertext.length);
  out.set(WARD_SEAL_MAGIC);
  out.set(nonce, WARD_SEAL_MAGIC.length);
  out.set(ciphertext, WARD_SEAL_MAGIC.length + NONCE_LENGTH);
  return out;
}

export type WardOpening =
  | { readonly reading: "opens"; readonly plaintext: Uint8Array }
  | { readonly reading: "key-fails" }
  | { readonly reading: Exclude<WardCarrierReading, "sealed"> };

/** Open one warded row under the ward key; a frame of any other kind answers its reading and never decrypts. */
export function openUnderWard(wardKey: WardKey, c: FaceCarrier, bytes: Uint8Array | null): WardOpening {
  const reading = readWardCarrier(bytes);
  if (reading !== "sealed") return { reading };
  const at = WARD_SEAL_MAGIC.length;
  try { return { reading: "opens", plaintext: xchacha20poly1305(wardKey, bytes!.subarray(at, at + NONCE_LENGTH), aadFor(c)).decrypt(bytes!.subarray(at + NONCE_LENGTH)) }; }
  catch { return { reading: "key-fails" }; }
}
