/**
 * Lararium authority primitives — Ed25519 identity, did:key, UCAN v0.10.
 *
 * Implements the UCAN spec (https://github.com/ucan-wg/spec) directly on
 * @noble/ed25519. No @ucans/ucans dependency — the JWT format is stable spec
 * and we want zero alpha-library risk in the core bundle.
 *
 * Brooklyn Zelenka / Keyhive compatibility notes:
 *   - did:key with Ed25519 is the same principal model Keyhive uses.
 *   - `att[].with` carries the Automerge doc URL as the UCAN resource.
 *   - `att[].can` is "automerge/sync" (our ability namespace).
 *   - When Keyhive WASM lands, sharePolicy plugs in here alongside verifyUcan.
 *   - The `prf` chain is empty for root operator UCANs; delegation adds entries.
 */

import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";

// Noble v3 requires sha512 to be set before any sync operations.
ed.hashes.sha512 = sha512;

// ---------------------------------------------------------------------------
// Base58btc — used by did:key encoding. Inline to avoid multiformats dep.
// ---------------------------------------------------------------------------

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58btcEncode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  const digits: number[] = [];
  while (n > 0n) {
    digits.unshift(Number(n % 58n));
    n /= 58n;
  }
  let leadingZeros = 0;
  for (const b of bytes) { if (b !== 0) break; leadingZeros++; }
  return "1".repeat(leadingZeros) + digits.map((d) => BASE58_ALPHABET[d]).join("");
}

function base58btcDecode(s: string): Uint8Array {
  let n = 0n;
  for (const c of s) {
    const idx = BASE58_ALPHABET.indexOf(c);
    if (idx < 0) throw new Error(`Invalid base58 char: ${c}`);
    n = n * 58n + BigInt(idx);
  }
  // Count only LEADING "1" characters — each represents a 0x00 byte prefix.
  let leadingZeros = 0;
  for (const c of s) { if (c !== "1") break; leadingZeros++; }
  const bytes: number[] = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  return new Uint8Array([...new Uint8Array(leadingZeros), ...bytes]);
}

// ---------------------------------------------------------------------------
// Isomorphic base64url and hex helpers — no Buffer, works in browser + Node.
// ---------------------------------------------------------------------------

function toBase64url(bytes: Uint8Array): string {
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64url(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad    = (4 - (padded.length % 4)) % 4;
  const bin    = atob(padded + "=".repeat(pad));
  return Uint8Array.from({ length: bin.length }, (_, i) => bin.charCodeAt(i));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// ---------------------------------------------------------------------------
// did:key — Ed25519 principal (same model as Keyhive / Fission)
//
// Encoding: multibase `z` (base58btc) + multicodec 0xed01 (Ed25519 pub key)
// ---------------------------------------------------------------------------

const ED25519_MULTICODEC = new Uint8Array([0xed, 0x01]);

export function encodeDidKey(publicKeyBytes: Uint8Array): string {
  const prefixed = new Uint8Array(ED25519_MULTICODEC.length + publicKeyBytes.length);
  prefixed.set(ED25519_MULTICODEC);
  prefixed.set(publicKeyBytes, ED25519_MULTICODEC.length);
  return "did:key:z" + base58btcEncode(prefixed);
}

export function decodeDidKey(did: string): Uint8Array {
  if (!did.startsWith("did:key:z")) throw new Error(`Not a did:key: ${did}`);
  const prefixed = base58btcDecode(did.slice("did:key:z".length));
  if (prefixed[0] !== 0xed || prefixed[1] !== 0x01) {
    throw new Error("did:key is not Ed25519 (expected 0xed01 multicodec)");
  }
  return prefixed.slice(2);
}

// ---------------------------------------------------------------------------
// LarOperatorIdentity — in-memory keypair + DID
// ---------------------------------------------------------------------------

export interface LarOperatorIdentity {
  readonly did:            string;        // did:key:z...
  readonly publicKeyBytes: Uint8Array;
  readonly privateKeyBytes: Uint8Array;
}

export interface LarOperatorIdentityJson {
  did:             string;
  publicKeyHex:   string;
  privateKeyHex:  string;
}

export async function generateOperatorIdentity(): Promise<LarOperatorIdentity> {
  const privateKeyBytes = ed.utils.randomSecretKey();
  const publicKeyBytes  = await ed.getPublicKeyAsync(privateKeyBytes);
  const did             = encodeDidKey(publicKeyBytes);
  return { did, publicKeyBytes, privateKeyBytes };
}

export function serializeIdentity(id: LarOperatorIdentity): LarOperatorIdentityJson {
  return {
    did:            id.did,
    publicKeyHex:  toHex(id.publicKeyBytes),
    privateKeyHex: toHex(id.privateKeyBytes),
  };
}

export function deserializeIdentity(raw: LarOperatorIdentityJson): LarOperatorIdentity {
  return {
    did:             raw.did,
    publicKeyBytes:  fromHex(raw.publicKeyHex),
    privateKeyBytes: fromHex(raw.privateKeyHex),
  };
}

// ---------------------------------------------------------------------------
// UCAN v0.10 — minimal issuance + verification
//
// Format: base64url(header).base64url(payload).base64url(signature)
//   header:  { alg: "EdDSA", typ: "JWT", ucv: "0.10.0" }
//   payload: { iss, aud, exp, att: [{ with, can }], prf: [] }
// ---------------------------------------------------------------------------

export interface LarUcanPayload {
  readonly iss:  string;                          // issuer did:key
  readonly aud:  string;                          // audience did:key
  readonly exp:  number;                          // unix seconds
  readonly nbf?: number;                          // not-before
  readonly att:  ReadonlyArray<{ with: string; can: string }>;
  readonly prf:  readonly string[];               // proof CIDs — empty for root
  readonly fct?: readonly unknown[];
}

export interface LarUcan {
  readonly token:    string;               // signed JWT string
  readonly payload:  LarUcanPayload;
}

const UCAN_HEADER_B64 = toBase64url(new TextEncoder().encode(
  JSON.stringify({ alg: "EdDSA", typ: "JWT", ucv: "0.10.0" }),
));

export async function issueUcan(opts: {
  issuer:    LarOperatorIdentity;
  audience:  string;                // did:key of recipient
  resource:  string;                // e.g. Automerge doc URL or "lararium:*"
  ability:   string;                // e.g. "automerge/sync"
  ttlSeconds?: number;              // default: 7 days
  proofs?:   string[];
}): Promise<LarUcan> {
  const now = Math.floor(Date.now() / 1000);
  const payload: LarUcanPayload = {
    iss: opts.issuer.did,
    aud: opts.audience,
    exp: now + (opts.ttlSeconds ?? 7 * 24 * 3600),
    att: [{ with: opts.resource, can: opts.ability }],
    prf: opts.proofs ?? [],
  };
  const payloadB64  = toBase64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sigInput    = new TextEncoder().encode(`${UCAN_HEADER_B64}.${payloadB64}`);
  const sigBytes    = await ed.signAsync(sigInput, opts.issuer.privateKeyBytes);
  const sigB64      = toBase64url(sigBytes);
  const token       = `${UCAN_HEADER_B64}.${payloadB64}.${sigB64}`;
  return { token, payload };
}

export interface UcanVerifyOpts {
  audience:  string;   // expected audience DID
  resource?: string;   // if set, must appear in att[].with
  ability?:  string;   // if set, must appear in att[].can
}

export type UcanVerifyResult =
  | { ok: true;  payload: LarUcanPayload }
  | { ok: false; reason: string };

export async function verifyUcan(
  token: string,
  opts:  UcanVerifyOpts,
): Promise<UcanVerifyResult> {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed-ucan-token" };
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  let payload: LarUcanPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64url(payloadB64))) as LarUcanPayload;
  } catch {
    return { ok: false, reason: "invalid-payload-json" };
  }

  // Expiry
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return { ok: false, reason: "ucan-expired" };

  // Audience
  if (payload.aud !== opts.audience) {
    return { ok: false, reason: `audience-mismatch: expected ${opts.audience} got ${payload.aud}` };
  }

  // Capability check
  if (opts.resource || opts.ability) {
    const match = payload.att.some(
      (a) =>
        (!opts.resource || a.with === opts.resource || a.with === "lararium:*") &&
        (!opts.ability  || a.can  === opts.ability  || a.can  === "*"),
    );
    if (!match) return { ok: false, reason: "capability-not-satisfied" };
  }

  // Signature verification
  try {
    const issuerPubKey = decodeDidKey(payload.iss);
    const sigInput     = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sigBytes     = fromBase64url(sigB64);
    const valid        = await ed.verifyAsync(sigBytes, sigInput, issuerPubKey);
    if (!valid) return { ok: false, reason: "signature-invalid" };
  } catch (e) {
    return { ok: false, reason: `signature-error: ${String(e)}` };
  }

  return { ok: true, payload };
}

// ---------------------------------------------------------------------------
// UcanPeerRegistry — maps Automerge peerId → verified audience DID
//
// Used in sharePolicy: server calls registerPeer() after /auth/ucan succeeds.
// sharePolicy then calls isAuthorized(peerId).
// ---------------------------------------------------------------------------

export class UcanPeerRegistry {
  private peers = new Map<string, { did: string; exp: number }>();

  registerPeer(peerId: string, did: string, expUnixSeconds: number): void {
    this.peers.set(peerId, { did, exp: expUnixSeconds });
  }

  isAuthorized(peerId: string): boolean {
    const entry = this.peers.get(peerId);
    if (!entry) return false;
    if (entry.exp < Math.floor(Date.now() / 1000)) {
      this.peers.delete(peerId);
      return false;
    }
    return true;
  }

  /** Evict expired entries (call periodically). */
  evictExpired(): void {
    const now = Math.floor(Date.now() / 1000);
    for (const [id, e] of this.peers) {
      if (e.exp < now) this.peers.delete(id);
    }
  }
}
