/**
 * seed-wrap-prf — THE PERSONA-ROOT SEED WRAPPED AT REST UNDER A PASSKEY PRF, OPT-IN, BESIDE THE CLEARTEXT
 * FINDING (basket-one #/the-phone-seat, ruled 2026-09-11: "PRF wraps beside and never mints, a synced passkey
 * counts as a cloud, every key names its class").
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────────────────────────
 * The persona-root seed sits CLEARTEXT on disk in every engine (project_browser_key_custody: persona roots
 * cannot go opaque — SLIP-0010 wants the parent key as bytes). WebAuthn PRF hands the page 32 bytes bound to
 * a credential and gated on presence (Safari 26.4+ · Chrome 132+ · Firefox 139+, device-capabilities-2026).
 * Those bytes never become a key of the house — they WRAP the seed: HKDF-SHA256(prf, salt, info) → AES-256-GCM.
 * Unwrapping needs the passkey present again. The mint stays the mint; the wrap rides beside it.
 *
 * ── THE CLASS THE RECORD NAMES ───────────────────────────────────────────────────────────────────
 * A synced passkey (iCloud Keychain, Google Password Manager) returns IDENTICAL PRF output on every device the
 * vendor syncs to — a seed-class secret wearing a device-class name. The wrap record therefore CARRIES the
 * credential's key class (`key-class.ts`: `cloud-synced` when the passkey syncs, `device-minted` for a
 * hardware-bound one), so `vault status` and the phone-seat line say which cloud, if any, can open the seed.
 *
 * ── THE INFO IS ITS OWN ──────────────────────────────────────────────────────────────────────────
 * `SEED_WRAP_HKDF_INFO` is a NEW separated string (the crypto-spine ruling: the HKDF infos ARE the separation;
 * never reuse `PERSONA_ADMIT_SEAL_INFO` or `KEYRING_ENVELOPE_SEAL_INFO`). It mints in the mesh domain
 * registry (`domains.ts`) beside every other separation, so one file names them all and the distinctness
 * witness there reads it.
 *
 * ── THE FLOOR ────────────────────────────────────────────────────────────────────────────────────
 * No PRF on the host → `detectPrf` reads `{ available: false, why }` and nothing wraps. The cleartext path
 * stays exactly as it stands. A refusal removes a cap from the declaration; it never becomes a throw.
 *
 * Pure: every platform reading rides in as `PrfHost`; the crypto is WebCrypto (`crypto.subtle`), isomorphic.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/device-capabilities-2026#/pattern-integrity-rhymes
 */

import { SEED_WRAP_PRF_INFO, type KeyClass } from "@lararium/mesh";

/** The HKDF `info` for the seed wrap — minted once in the registry, never built at a call site, never another seal's. */
export const SEED_WRAP_HKDF_INFO = SEED_WRAP_PRF_INFO;

/** The key class the wrapping credential holds — the closed vocabulary of `key-class.ts` (node). */
/** The credential's class — the one vocabulary (mesh `key-class`) less `seed`: a passkey never IS the seed. */
export type SeedWrapKeyClass = Exclude<KeyClass, "seed">;

/** The WebAuthn surface `detectPrf` reads — injected so a test drives a host with none. */
export interface PrfHost {
  readonly isSecureContext?: boolean;
  readonly PublicKeyCredential?: {
    /** WebAuthn L3 `getClientCapabilities()` — carries `"extension:prf": true` where the client offers PRF. */
    getClientCapabilities?(): Promise<Record<string, boolean>>;
  };
}

export interface PrfDetection {
  readonly available: boolean;
  /** Names the floor when `available` reads false. */
  readonly why?: string;
}

/** Read the ambient WebAuthn surface, or nothing where the engine offers none. */
export function ambientPrfHost(): PrfHost {
  const g = globalThis as unknown as { isSecureContext?: boolean; PublicKeyCredential?: PrfHost["PublicKeyCredential"] };
  return {
    ...(g.isSecureContext !== undefined ? { isSecureContext: g.isSecureContext } : {}),
    ...(g.PublicKeyCredential ? { PublicKeyCredential: g.PublicKeyCredential } : {}),
  };
}

/**
 * Does this host offer WebAuthn PRF? A reading, never a throw: an absent API, an insecure context, a
 * capabilities call that faults, or capabilities that omit `extension:prf` each read as the floor with a why.
 */
export async function detectPrf(host: PrfHost = ambientPrfHost()): Promise<PrfDetection> {
  if (host.isSecureContext !== true) {
    return { available: false, why: "not a secure context — WebAuthn withholds credentials off one; nothing wraps" };
  }
  const pkc = host.PublicKeyCredential;
  if (!pkc || typeof pkc.getClientCapabilities !== "function") {
    return { available: false, why: "this engine offers no PublicKeyCredential.getClientCapabilities — PRF cannot be read; nothing wraps" };
  }
  let caps: Record<string, boolean>;
  try { caps = await pkc.getClientCapabilities(); } catch (e) {
    return { available: false, why: `getClientCapabilities faulted (${e instanceof Error ? e.message : String(e)}); nothing wraps` };
  }
  if (caps["extension:prf"] !== true) {
    return { available: false, why: "this client reports no WebAuthn prf extension; nothing wraps" };
  }
  return { available: true };
}

/** The at-rest record — every field hex or a name; the seed appears nowhere in the clear. */
export interface SeedWrapRecord {
  readonly v:            1;
  readonly alg:          "HKDF-SHA256+AES-256-GCM";
  readonly info:         typeof SEED_WRAP_HKDF_INFO;
  /** The credential whose PRF opens this wrap. */
  readonly credentialId: string;
  /** The class of that credential — `cloud-synced` when the passkey syncs through a vendor. */
  readonly keyClass:     SeedWrapKeyClass;
  readonly salt:         string;
  readonly iv:           string;
  readonly ct:           string;
}

/** The named refusal — a wrong PRF output, a tampered record, a malformed input. Never a wrong seed. */
export class SeedWrapRefused extends Error {
  override readonly name = "SeedWrapRefused";
  constructor(detail: string) { super(`[seed-wrap-prf] ${detail}`); }
}

const PRF_LEN  = 32;
const SEED_LEN = 32;

function subtle(): SubtleCrypto {
  const s = (globalThis as unknown as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (!s) throw new SeedWrapRefused("no WebCrypto subtle on this host");
  return s;
}

const hex   = (b: Uint8Array): string => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string): Uint8Array => {
  if (!/^(?:[0-9a-f]{2})*$/i.test(s)) throw new SeedWrapRefused("a record field is not hex");
  return new Uint8Array((s.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)));
};
const utf8  = (s: string): Uint8Array => new TextEncoder().encode(s);
const buf   = (b: Uint8Array): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

/** HKDF-SHA256 over the PRF output → one AES-256-GCM key, under THIS module's info alone. */
async function wrapKeyFromPrf(prfOutput: Uint8Array, salt: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  if (!(prfOutput instanceof Uint8Array) || prfOutput.length !== PRF_LEN) {
    throw new SeedWrapRefused(`a PRF output is ${PRF_LEN} bytes (got ${prfOutput instanceof Uint8Array ? prfOutput.length : typeof prfOutput})`);
  }
  const s   = subtle();
  const ikm = await s.importKey("raw", buf(prfOutput), "HKDF", false, ["deriveKey"]);
  return s.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: buf(salt), info: buf(utf8(SEED_WRAP_HKDF_INFO)) },
    ikm, { name: "AES-GCM", length: 256 }, false, [usage],
  );
}

/** Wrap a 32-byte seed under a PRF output. Fresh salt + iv per wrap; the record names the credential and its class. */
export async function wrapSeed(
  seed: Uint8Array,
  prfOutput: Uint8Array,
  by: { readonly credentialId: string; readonly keyClass: SeedWrapKeyClass },
): Promise<SeedWrapRecord> {
  if (!(seed instanceof Uint8Array) || seed.length !== SEED_LEN) throw new SeedWrapRefused(`a seed is ${SEED_LEN} bytes`);
  if (!by.credentialId) throw new SeedWrapRefused("a wrap names the credential that opens it");
  const salt = new Uint8Array(32); globalThis.crypto.getRandomValues(salt);
  const iv   = new Uint8Array(12); globalThis.crypto.getRandomValues(iv);
  const key  = await wrapKeyFromPrf(prfOutput, salt, "encrypt");
  const ct   = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv: buf(iv), additionalData: buf(utf8(by.credentialId)) }, key, buf(seed)));
  return { v: 1, alg: "HKDF-SHA256+AES-256-GCM", info: SEED_WRAP_HKDF_INFO, credentialId: by.credentialId, keyClass: by.keyClass, salt: hex(salt), iv: hex(iv), ct: hex(ct) };
}

/** Open a wrap under a PRF output. A different output, a tampered record, or a foreign info refuses, named. */
export async function unwrapSeed(rec: SeedWrapRecord, prfOutput: Uint8Array): Promise<Uint8Array> {
  if (rec.v !== 1 || rec.info !== SEED_WRAP_HKDF_INFO) throw new SeedWrapRefused("the record carries another version or another info");
  const key = await wrapKeyFromPrf(prfOutput, unhex(rec.salt), "decrypt");
  let plain: ArrayBuffer;
  try {
    plain = await subtle().decrypt({ name: "AES-GCM", iv: buf(unhex(rec.iv)), additionalData: buf(utf8(rec.credentialId)) }, key, buf(unhex(rec.ct)));
  } catch {
    throw new SeedWrapRefused("the PRF output does not open this wrap (a different credential, or a tampered record)");
  }
  const seed = new Uint8Array(plain);
  if (seed.length !== SEED_LEN) throw new SeedWrapRefused("the opened bytes are not a seed");
  return seed;
}
