/**
 * sealed-box — the ONE X25519-ECDH → HKDF-SHA256 → XChaCha20-Poly1305 seal-to-a-recipient primitive.
 *
 * ONE ASSEMBLY, MANY PROTOCOLS. A protocol that seals to a recipient (the fleet-join address secret among
 * them) composes this module and hand-rolls none of it. What differs between two protocols, their salt and their
 * domain, rides as required parameters, so composing here can never quietly erase a difference that carries meaning.
 *
 * THE DOMAIN RIDES REQUIRED AND UN-DEFAULTED (`info`). The HKDF `info` keeps two protocols' keys from
 * deriving IDENTICALLY out of one ECDH output, and two protocols may run between the same device pair, so that
 * separation carries real weight. A defaulted or optional `info` would invite a call
 * site to omit it and fuse two protocols' key material; this signature refuses to let that happen silently.
 *
 * THE SALT IS A SUPERSET, NEVER A REPLACEMENT. It binds `senderPub ‖ recipientPub` ALWAYS, then appends whatever
 * session challenges the caller carries. That strictly dominates both prior salts: the pubkey pair pins the
 * derivation to this exact pairing, and `extraSalt` pins it to this exact session (so a repeated ephemeral key still
 * derives a fresh key). Nothing a caller previously bound gets dropped.
 *
 * SEAL THROWS, OPEN WITHHOLDS. Sealing to a malformed recipient THROWS — a caller must never believe it delivered
 * something to nobody. Opening returns `null` on ANY failure (wrong key, tampered ciphertext, malformed frame) —
 * withhold, never forge, and never leak WHICH check failed.
 *
 * THIS IS NOT THE SEALED VALUE. A sealed value (`sealed-chunk`) seals under a symmetric content key a bag's readers
 * share, binds a bag, a key version, a role and a reference, and takes an address over its ciphertext. This
 * primitive seals to ONE recipient's public key under a fresh ephemeral and a fresh AEAD nonce, and binds a
 * protocol domain and a session. Both draw fresh randomness on every call (semantic security); they differ in who
 * may open and in what they bind, so neither stands in for the other and no flag folds them into one seal.
 *
 * BYTES IN, BYTES OUT. No hex, no base64url, no JSON — every carriage encoding stays caller-side, so the wire shapes
 * (`SealedGrant` first among them) keep their own guards and never fuse.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-box
 */

import { x25519 } from "@noble/curves/ed25519.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { webGetRandomValues } from "./crypto.js";

/** XChaCha20-Poly1305's nonce width. */
export const SEALED_BOX_AEAD_NONCE_LEN = 24;

/** The sealed carriage this primitive mints — the caller encodes these bytes into its own wire shape. */
export interface SealedBox {
  /** The sender's FRESH ephemeral X25519 pubkey — the recipient completes the ECDH against it. */
  readonly senderEphemeralPub: Uint8Array;
  /** The 24-byte AEAD nonce, fresh every seal. */
  readonly aeadNonce:          Uint8Array;
  /** The AEAD ciphertext (tag included). */
  readonly ciphertext:         Uint8Array;
}

/**
 * Derive the seal key. Salt binds the pubkey pair ALWAYS, then the caller's session challenges — a strict superset
 * of what either hand-roll bound. `info` carries the protocol domain and never defaults.
 */
function deriveSealedBoxKey(
  shared: Uint8Array,
  senderPub: Uint8Array,
  recipientPub: Uint8Array,
  info: Uint8Array,
  extraSalt: readonly Uint8Array[],
): Uint8Array {
  let width = senderPub.length + recipientPub.length;
  for (const part of extraSalt) width += part.length;
  const salt = new Uint8Array(width);
  salt.set(senderPub, 0);
  salt.set(recipientPub, senderPub.length);
  let at = senderPub.length + recipientPub.length;
  for (const part of extraSalt) { salt.set(part, at); at += part.length; }
  return hkdf(sha256, shared, salt, info, 32);
}

/**
 * SEAL to a recipient's X25519 pubkey with a fresh sender ephemeral. THROWS on a malformed recipient — addressing
 * nobody must never read as success.
 */
export function sealToRecipient(args: {
  readonly recipientPub: Uint8Array;
  readonly plaintext:    Uint8Array;
  /** REQUIRED protocol domain — the cross-protocol key separation. */
  readonly info:         Uint8Array;
  /** Session challenges appended AFTER the pubkey pair (order is the caller's, and it must match on open). */
  readonly extraSalt?:   readonly Uint8Array[];
}): SealedBox {
  if (args.recipientPub.length !== 32) throw new Error("sealed-box: recipient X25519 pubkey must ride 32 bytes");
  if (args.info.length === 0) throw new Error("sealed-box: an empty HKDF info would fuse this seal with another protocol's");

  const senderSecret = x25519.utils.randomSecretKey();
  const senderEphemeralPub = x25519.getPublicKey(senderSecret);
  const shared = x25519.getSharedSecret(senderSecret, args.recipientPub);
  const key = deriveSealedBoxKey(shared, senderEphemeralPub, args.recipientPub, args.info, args.extraSalt ?? []);
  const aeadNonce = webGetRandomValues(new Uint8Array(SEALED_BOX_AEAD_NONCE_LEN));
  const ciphertext = xchacha20poly1305(key, aeadNonce).encrypt(args.plaintext);
  return { senderEphemeralPub, aeadNonce, ciphertext };
}

/**
 * OPEN a sealed box with the recipient's X25519 secret. Returns `null` on ANY failure — a wrong key, a tampered
 * ciphertext, a mismatched salt, a malformed frame all draw the SAME null, so the caller learns nothing about which
 * check refused. `info` and `extraSalt` MUST match the seal exactly.
 */
export function openFromSender(args: {
  readonly recipientSecret:    Uint8Array;
  readonly senderEphemeralPub: Uint8Array;
  readonly aeadNonce:          Uint8Array;
  readonly ciphertext:         Uint8Array;
  readonly info:               Uint8Array;
  readonly extraSalt?:         readonly Uint8Array[];
}): Uint8Array | null {
  try {
    if (args.senderEphemeralPub.length !== 32) return null;
    const recipientPub = x25519.getPublicKey(args.recipientSecret);
    const shared = x25519.getSharedSecret(args.recipientSecret, args.senderEphemeralPub);
    const key = deriveSealedBoxKey(shared, args.senderEphemeralPub, recipientPub, args.info, args.extraSalt ?? []);
    return xchacha20poly1305(key, args.aeadNonce).decrypt(args.ciphertext);
  } catch {
    return null;   // withhold, never forge — and never name which gate refused
  }
}
