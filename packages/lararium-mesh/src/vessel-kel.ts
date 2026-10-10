/**
 * vessel-kel — the vessel's own inception: the floor key revealed, the NEXT floor key committed by digest.
 *
 * KERI pre-rotation at vessel scale. At founding — the only window before the floor key ever signs — the inception
 * commits sha256 of the next key's public bytes, so a thief of the current floor key cannot rotate the vessel's
 * name: a rotation must reveal a key hashing to `n`, and the thief never saw it. The next seed rests as a COLD
 * carrier under the VK; the inception itself carries nothing secret.
 *
 * NO CLOCK, NO VERSION. The record holds `t` (the event kind), `k` (the current key), `nt` (the next threshold), `n`
 * (the commitment) and `sig` — no creation date, no version tag, no sequence counter. The current key signs the
 * canonical bytes under the `vessel-kel` domain; Ed25519 signs deterministically, so one seed pair mints one byte
 * string, which is what lets a second founding from the same seeds prove that nothing else entered.
 *
 * WHAT STANDS, NAMED: this module mints and checks the inception. No reader consults it at boot, and no verb rotates
 * the floor key: the commitment guards a rotation that no verb performs.
 */

import { ed25519 } from "@noble/curves/ed25519.js";
import { canonicalJsonBytes, sha256HexBytesSync, hex, hexToBytes, defaultCryptoProvider, type RandomProvider } from "./crypto.js";
import { VESSEL_KEL_DOMAIN } from "./custody-domain-names.js";

export interface VesselKelInception {
  readonly t:   "icp";
  /** The current floor key's public bytes, hex. */
  readonly k:   readonly string[];
  /** The next signing threshold. */
  readonly nt:  string;
  /** sha256 of each next key's public bytes, hex — the pre-rotation commitment. */
  readonly n:   readonly string[];
  /** The current key's Ed25519 signature over the signed bytes, hex. */
  readonly sig: string;
}

type Core = Omit<VesselKelInception, "sig">;

/** The bytes the current key signs: the domain, then the core fields. */
const signedBytes = (core: Core): Uint8Array => canonicalJsonBytes({ domain: VESSEL_KEL_DOMAIN, t: core.t, k: core.k, nt: core.nt, n: core.n });

function requireSeed(seed: Uint8Array, what: string): void {
  if (seed.length !== 32) throw new Error(`vessel-kel: the ${what} seed must ride 32 bytes`);
}

/** Mint the inception from the current floor seed and the next seed. Pure: the same seeds mint the same bytes. */
export function inceptVesselKel(signingSeed: Uint8Array, nextSeed: Uint8Array): { readonly inception: VesselKelInception; readonly bytes: Uint8Array } {
  requireSeed(signingSeed, "current");
  requireSeed(nextSeed, "next");
  if (signingSeed.every((b, i) => b === nextSeed[i])) throw new Error("vessel-kel: the next seed must differ from the current one");
  const core: Core = {
    t: "icp",
    k: [hex(ed25519.getPublicKey(signingSeed))],
    nt: "1",
    n: [sha256HexBytesSync(ed25519.getPublicKey(nextSeed))],
  };
  const inception: VesselKelInception = { ...core, sig: hex(ed25519.sign(signedBytes(core), signingSeed)) };
  return { inception, bytes: canonicalJsonBytes(inception) };
}

/** Mint the inception with a fresh next seed from the CSPRNG. The next seed goes to the sealed writer as cold. */
export function mintVesselKelInception(signingSeed: Uint8Array, rng: RandomProvider = defaultCryptoProvider): {
  readonly inception: VesselKelInception; readonly bytes: Uint8Array; readonly nextSeed: Uint8Array;
} {
  const nextSeed = rng.getRandomValues(new Uint8Array(32));
  return { ...inceptVesselKel(signingSeed, nextSeed), nextSeed };
}

/** Does the current key's signature hold over the inception's fields under `vessel-kel`? */
export function verifyVesselKelInception(inception: VesselKelInception): boolean {
  try {
    if (inception.t !== "icp" || inception.k.length !== 1) return false;
    return ed25519.verify(hexToBytes(inception.sig), signedBytes(inception), hexToBytes(inception.k[0]!));
  } catch {
    return false;
  }
}

/** Does the inception commit this next public key? */
export function nextKeyCommitted(inception: VesselKelInception, nextVerifyingKey: Uint8Array): boolean {
  return inception.n.includes(sha256HexBytesSync(nextVerifyingKey));
}

/** Read an inception from its bytes; anything torn, extra or missing reads `null`. */
export function decodeVesselKelInception(bytes: Uint8Array): VesselKelInception | null {
  try {
    const raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as Record<string, unknown>;
    const keys = Object.keys(raw).sort().join(",");
    if (keys !== "k,n,nt,sig,t") return null;
    const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === "string");
    if (raw.t !== "icp" || !strings(raw.k) || !strings(raw.n) || typeof raw.nt !== "string" || typeof raw.sig !== "string") return null;
    return { t: "icp", k: raw.k, nt: raw.nt, n: raw.n, sig: raw.sig };
  } catch {
    return null;
  }
}
