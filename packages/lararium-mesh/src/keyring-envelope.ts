/**
 * keyring-envelope — STAGE 2 (A1-①): deliver the per-Nexus convergence keyring to a newly-admitted device via a
 * SEALED ENVELOPE, reusing the persona-admit ceremony's sealed-box shape (NOT BeeKEM — ruling A1-①=sealed-envelope).
 *
 * THE READ-KEY RIDES THE PRIVATE LANE, NEVER THE RELAY. The cad seal producer message-locks a carrier body's
 * ciphertext to the per-Nexus convergence secret; a member needs the secret named by that body's
 * (Nexus AID, `epochCid`) to READ a sealed body it blind-transits. This envelope hands the keyring to a joinee at admission: an X25519 static-recipient
 * sealed box (an ephemeral sender ECDH → HKDF-SHA256 → XChaCha20-Poly1305 AEAD, the SAME construction the
 * persona-admit grant rides). The joinee mints an X25519 recipient keypair at admit and keeps its SECRET
 * on-device; the founder seals the keyring to the recipient pubkey. Only the live recipient opens it.
 *
 * CARRY ⊥ READ, made concrete: a NON-admitted peer carries a sealed body's ciphertext (verify-cap secret-free)
 * but has no keyring, so it reads NOTHING. An admitted device opens THIS envelope, holds the keyring, and reads.
 * Delivering the keyring is exactly what turns a carry-only member into a read-capable one — and it happens ONLY
 * at a consented admission, never on the open wire.
 *
 * TRACK-CONTRACTS-NEVER-IDENTITIES: the envelope carries key-material (the salt secrets), each entry named by the
 * Nexus AID and the charter epoch CID it salts — no counter, no persona, no identity. A receiver joins a delivery
 * by that scoped name, so an entry for one Nexus never lands under another. WITHHOLD-not-forge: a garbled / wrong-recipient envelope opens to `null`, never a throw.
 *
 * CRYPTO: @noble X25519 + XChaCha20-Poly1305 + HKDF-SHA256 — pure-JS, offline, no wasm, no node-gyp.
 * Meme: lar:///ha.ka.ba/lararium/mesh/keyring-envelope
 */

import { KEYRING_ENVELOPE_DOMAIN, KEYRING_ENVELOPE_SEAL_INFO } from "./domains.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { hex, hexToBytes, utf8Bytes, canonicalJsonBytes, base64UrlEncode, base64UrlDecode } from "./crypto.js";
import { sealToRecipient, openFromSender } from "./sealed-box.js";

export { KEYRING_ENVELOPE_DOMAIN } from "./domains.js";
/** The HKDF `info` — domain-separates THIS delivery's key-derivation from every other X25519 use, and
 *  above all from the persona-admit grant seal: both protocols run between the same device pair at
 *  admission, so one shared `info` would let their key material fuse. It carries its OWN registry name
 *  rather than a version digit — this once rode `/v2` beside the signing domain's `/v1`, which let a
 *  version number do a domain's job, and a naive reset to v1 would have fused exactly what it separates. */
const HKDF_INFO = utf8Bytes(KEYRING_ENVELOPE_SEAL_INFO);

/** One epoch's secret in the delivered set: the Nexus AID and the charter epoch CID that name it, and its 32-byte salt as hex. */
export interface KeyringEntryWire {
  readonly nexusAid:  string;
  readonly epochCid:  string;
  readonly secretHex: string;
}

/** A name part that carries one printable token: no whitespace, no control byte, and never empty. */
const NAME_PART = /^[\x21-\x7e]{1,256}$/;

/**
 * The canonical wire spelling of one entry, or `null` when a part reads malformed. Both name parts fold to lower
 * case: a charter spells an epoch CID as a lower-case tag and digest, and the Nexus AID repeats its genesis CID, so
 * a case variant names the same secret and never a second one.
 */
export function canonicalKeyringEntry(raw: { readonly nexusAid?: unknown; readonly epochCid?: unknown; readonly secretHex?: unknown }): KeyringEntryWire | null {
  if (typeof raw.nexusAid !== "string" || typeof raw.epochCid !== "string" || typeof raw.secretHex !== "string") return null;
  const nexusAid = raw.nexusAid.trim().toLowerCase();
  const epochCid = raw.epochCid.trim().toLowerCase();
  const secretHex = raw.secretHex.toLowerCase();
  if (!NAME_PART.test(nexusAid) || !NAME_PART.test(epochCid) || !/^[0-9a-f]{64}$/.test(secretHex)) return null;
  return { nexusAid, epochCid, secretHex };
}

/** The scoped name one entry answers to: its Nexus AID and its epoch CID, joined by a byte neither part may carry. */
export function keyringEntryName(e: { readonly nexusAid: string; readonly epochCid: string }): string {
  return `${e.nexusAid.trim().toLowerCase()}\n${e.epochCid.trim().toLowerCase()}`;
}

/** The sealed keyring envelope a founder hands a joinee at admission (a QR / paste / the admit payload). */
export interface KeyringEnvelope {
  readonly kind:                  typeof KEYRING_ENVELOPE_DOMAIN;
  /** The ephemeral X25519 sender pubkey (hex) — the recipient completes the ECDH with it. */
  readonly senderEphemeralPubkey: string;
  /** The XChaCha20-Poly1305 nonce (hex, 24 bytes). */
  readonly aeadNonce:             string;
  /** base64url of the sealed `{ entries: KeyringEntryWire[] }`. */
  readonly ciphertext:            string;
}

/**
 * Seal a set of named secrets to a joinee's X25519 recipient pubkey — an ephemeral-sender sealed box.
 * Only the holder of the matching recipient SECRET opens it; a photograph / a non-recipient reads nothing.
 * THROWS on a malformed recipient (the shared primitive's law) — sealing to nobody must never read as delivery —
 * and on a malformed entry or one scoped name carried twice, so no sender seals a set a receiver must refuse.
 */
export function sealKeyringEnvelope(entries: readonly KeyringEntryWire[], recipientX25519Pubkey: string): KeyringEnvelope {
  const canonical = entries.map((e) => {
    const c = canonicalKeyringEntry(e);
    if (!c) throw new TypeError("sealKeyringEnvelope: a keyring entry reads malformed (a Nexus AID, an epoch CID and a 32-byte secret name each one)");
    return c;
  });
  if (new Set(canonical.map(keyringEntryName)).size !== canonical.length) {
    throw new TypeError("sealKeyringEnvelope: one (Nexus AID, epoch CID) name rides twice in this delivery");
  }
  const box = sealToRecipient({
    recipientPub: hexToBytes(recipientX25519Pubkey),
    plaintext:    canonicalJsonBytes({ entries: canonical }),
    info:         HKDF_INFO,
  });
  return {
    kind: KEYRING_ENVELOPE_DOMAIN,
    senderEphemeralPubkey: hex(box.senderEphemeralPub),
    aeadNonce: hex(box.aeadNonce),
    ciphertext: base64UrlEncode(box.ciphertext),
  };
}

/**
 * Open a sealed keyring envelope with the recipient's X25519 SECRET → the named entries, or `null`
 * (a wrong recipient / tamper / a photograph without the secret). FAIL-CLOSED: a malformed entry set reads null,
 * and so does a set that carries one scoped name twice.
 */
export function openKeyringEnvelope(envelope: KeyringEnvelope, recipientX25519Secret: Uint8Array): KeyringEntryWire[] | null {
  if (envelope?.kind !== KEYRING_ENVELOPE_DOMAIN) return null;
  try {
    // The shared primitive salts with pubkey BYTES and derives the recipient pubkey from the secret itself, so a
    // hex-case difference in the carried sender key can no longer reach the derivation.
    const plaintext = openFromSender({
      recipientSecret:    recipientX25519Secret,
      senderEphemeralPub: hexToBytes(envelope.senderEphemeralPubkey),
      aeadNonce:          hexToBytes(envelope.aeadNonce),
      ciphertext:         base64UrlDecode(envelope.ciphertext),
      info:               HKDF_INFO,
    });
    if (!plaintext) return null;   // wrong recipient / tampered / no secret → the keyring DID NOT ARRIVE
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as { entries?: unknown };
    if (!Array.isArray(parsed.entries)) return null;
    const out: KeyringEntryWire[] = [];
    const names = new Set<string>();
    for (const raw of parsed.entries) {
      if (typeof raw !== "object" || raw === null) return null;
      const entry = canonicalKeyringEntry(raw as Record<string, unknown>);
      if (!entry) return null;
      const name = keyringEntryName(entry);
      if (names.has(name)) return null;
      names.add(name);
      out.push(entry);
    }
    return out;
  } catch {
    return null;   // wrong recipient / tampered / no secret → the keyring DID NOT ARRIVE
  }
}

/** Mint a fresh X25519 recipient keypair for a joinee — the secret stays on-device; the pubkey rides the admit. */
export function mintKeyringRecipient(): { recipientSecret: Uint8Array; recipientPubkey: string } {
  const recipientSecret = x25519.utils.randomSecretKey();
  return { recipientSecret, recipientPubkey: hex(x25519.getPublicKey(recipientSecret)) };
}
