/**
 * hosting — a hearth HOSTS walkers in one Nexus: the public hosting act, the bearer invite token, the hosting
 * grant a walker carries, and the claim a newcomer redeems with. Platform-blind and pure; the hearth's store
 * (`hosting-store`, node) and its gate's sorter compose over it.
 *
 * ── THE HOSTING ACT, AND THE EPOCH IT NAMES ────────────────────────────────────────────────────────
 * A hearth that hosts in Nexus N signs a HOSTING ACT with its per-Nexus leaf: `{N, hearthLeaf, oprfPub,
 * prev, cap}` — `cap` the most invites one lineage may mint in an epoch, public so a walker reads its own
 * allowance off the act. The act's CID IS the hosting EPOCH — never a counter and never an id the hearth picks alone. The act
 * lands on N's carriage board, the per-Nexus board every carrier of N federates as public/infra, so every
 * walker reads the one act the hearth published. A hearth that showed two walkers two different epochs would
 * have to sign two acts on one replicated board; per-board fork reporting surfaces that. In a one-hearth
 * Nexus the hearth relays the board itself, so a forked act is undetectable by its own walkers (the
 * CABAL-OF-ONE equivocation bound): unlinkability holds against a semi-honest hearth and is detectable, never
 * prevented, against an equivocating one. The act grants nothing and names no one but the hearth: the board
 * stays deny-only.
 *
 * ── ONE KEY PER ACT ────────────────────────────────────────────────────────────────────────────────
 * The act's OPRF key is DERIVED, never stored: RFC 9497 POPRF `DeriveKeyPair(seed = the hearth's leaf seed,
 * keyInfo = {hosting-key, N, anchor = prev ?? "genesis"})` over ristretto255-SHA512 (`@noble/curves`). Every
 * roll re-keys with no counter. The POPRF `info` carries the epoch and the purpose — `{hosting-token, N, e}`
 * for tokens, `{hosting-grant, N, e}` for grants — so the two artifacts behave as independent PRFs under one
 * key: a blind evaluation minted under the token label never verifies as a grant tag.
 *
 * ── THE TOKEN, AND ITS CLASS ───────────────────────────────────────────────────────────────────────
 * A bearer invite `{purpose, n, y}`: `n` is 32 random bytes and `y = POPRF_{info(token, purpose, N, e)}(k_e, n)`.
 * It names no one — `n` is random and `y` is a PRF of it — so the invite carries no inviter and redemption links
 * to no minter. Its PURPOSE names its class and nothing more: `host-invite` (the hearth minted it, in process)
 * or `walker-invite` (a walker minted it, blind). The two classes evaluate under distinct `info` labels, so a
 * token of one class never verifies as the other; the label reveals the class, never which walker minted.
 * It is "Privacy-Pass-shaped" (the RFC 9576 architecture over RFC 9497 crypto), not RFC 9578 wire-conformant:
 * this house does not speak the HTTP `PrivateToken` scheme.
 *
 * ── THE GRANT ──────────────────────────────────────────────────────────────────────────────────────
 * `{N, leaf G, epoch e, lineage L, survived s, from, tag}`, where `tag = POPRF_{info(grant, N, e)}(k_e, {N, G,
 * L, s, from})` and `from` is the class of the invite the lineage opened on (`host` · `walker`). A KEYED tag, not a signature: only the hearth that holds `k_e` verifies it, so a seized phone's grant
 * proves "this hearth hosts G" to nobody else (keyed-verification credentials, the Lox and Signal Private
 * Group System line). Renewal is deterministic: a grant at the previous epoch renews to `{L, e_cur, s+1}`, the
 * same grant in yielding the same grant out, so renewal burns nothing.
 *
 * ── THE CLAIM AND THE LINEAGE ──────────────────────────────────────────────────────────────────────
 * A newcomer redeems with a CLAIM `r = H(claim-tag, its leaf seed, n)`, derived and never stored: a retry
 * after a dropped answer re-derives the same `r`, so refuse-before-destroy holds without a pending record.
 * The hearth's spent-set keeps `n → H(r, G)`, never `r` and never the leaf `G` that proved over the socket, and
 * the grant's lineage is `L = H(lineage-tag, n, r)`. A seizer of the hearth holds `n` and `H(r, G)` and so cannot
 * compute `L`; a retry carrying the same `r` under the same `G` gets the identical grant, and a different `r`, or
 * the same `r` under another leaf, gets silence.
 *
 * WHAT WAITS FOR THE RE-FOUND. The leaf seed `k_e` derives from rests cleartext on disk until the sealed
 * custody root lands, so a seized hearth can mint tokens. The vessel key still links a walker's leaves across
 * Nexuses on the wire until the per-Nexus wire key lands.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { ristretto255_oprf } from "@noble/curves/ed25519.js";
import * as ed25519 from "@noble/ed25519";
import { base64UrlDecode, base64UrlEncode, canonicalJsonBytes, hex, hexToBytes, sha256HexBytesSync, webGetRandomValues } from "./crypto.js";
import type { LarDoc } from "./base-doc.js";
import { mutableLarRecord, tiddlerText } from "./base-doc.js";
import { CARRIAGE_ENTRY_PREFIX } from "./carriage-board.js";
import {
  HOSTING_ACT_DOMAIN, HOSTING_CARRY_DOMAIN, HOSTING_GRANT_DOMAIN, HOSTING_KEY_DOMAIN, HOSTING_SPEND_DOMAIN, HOSTING_TOKEN_DOMAIN,
  WALK_CARRY_SEAL_INFO,
} from "./domains.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";

const KEY_RE   = /^[0-9a-f]{64}$/;
const SIG_RE   = /^[0-9a-f]{128}$/;
const N_RE     = /^[0-9a-f]{64}$/;
const Y_RE     = /^[0-9a-f]{128}$/;
const CID_RE   = /^[0-9a-f]{64}$/;

const normAid = (aid: string): string => aid.trim().toLowerCase();

// ── THE HOSTING ACT ────────────────────────────────────────────────────────────────────────────────

/** A hearth's public statement that it hosts in one Nexus at one epoch. Its CID names that epoch. */
export interface HostingAct {
  readonly kind:       typeof HOSTING_ACT_DOMAIN;
  /** The Nexus the hearth hosts in — its genesis AID. */
  readonly nexusAid:   string;
  /** The hearth's per-Nexus leaf verifying key (hex). Signs the act; the OPRF key derives from its seed. */
  readonly hearthLeaf: string;
  /** The act's POPRF public key (ristretto255, hex) — what a walker checks a blind evaluation against. */
  readonly oprfPub:    string;
  /** The CID of the act this one rolls from; null for the hearth's first act in this Nexus. */
  readonly prev:       string | null;
  /** The most invites one lineage may mint in this epoch. */
  readonly cap:        number;
  /** Ed25519 by `hearthLeaf` over `hostingActBytes`. */
  readonly sig:        string;
}

/** The bytes a hosting act signs over. */
export function hostingActBytes(parts: Omit<HostingAct, "sig">): Uint8Array {
  return canonicalJsonBytes({
    kind: HOSTING_ACT_DOMAIN, nexusAid: normAid(parts.nexusAid), hearthLeaf: parts.hearthLeaf.toLowerCase(),
    oprfPub: parts.oprfPub.toLowerCase(), prev: parts.prev, cap: parts.cap,
  });
}

/** The act's CID — the hosting epoch it names. */
export function hostingActCid(act: HostingAct): string {
  return sha256HexBytesSync(canonicalJsonBytes({
    kind: HOSTING_ACT_DOMAIN, nexusAid: normAid(act.nexusAid), hearthLeaf: act.hearthLeaf.toLowerCase(),
    oprfPub: act.oprfPub.toLowerCase(), prev: act.prev, cap: act.cap, sig: act.sig.toLowerCase(),
  }));
}

/** Structural guard for a hosting act. Shape only; `verifyHostingAct` reads the signature. */
export function isHostingAct(v: unknown): v is HostingAct {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const x = v as Record<string, unknown>;
  return x["kind"] === HOSTING_ACT_DOMAIN &&
    typeof x["nexusAid"] === "string" && (x["nexusAid"] as string).length > 0 &&
    typeof x["hearthLeaf"] === "string" && KEY_RE.test(x["hearthLeaf"] as string) &&
    typeof x["oprfPub"] === "string" && KEY_RE.test(x["oprfPub"] as string) &&
    (x["prev"] === null || (typeof x["prev"] === "string" && CID_RE.test(x["prev"] as string))) &&
    typeof x["cap"] === "number" && Number.isSafeInteger(x["cap"]) && (x["cap"] as number) >= 1 &&
    typeof x["sig"] === "string" && SIG_RE.test(x["sig"] as string);
}

/** Does the act's own leaf sign it? Pure; never throws. */
export async function verifyHostingAct(act: HostingAct): Promise<boolean> {
  if (!isHostingAct(act)) return false;
  try { return await ed25519.verifyAsync(hexToBytes(act.sig), hostingActBytes(act), hexToBytes(act.hearthLeaf)); }
  catch { return false; }
}

/** The OPRF key for the act that rolls from `prev` (null: the hearth's first act in N). Derived, never stored. */
export function hostingKeyPair(parts: { readonly leafSeed: Uint8Array; readonly nexusAid: string; readonly prev: string | null }): {
  readonly secretKey: Uint8Array; readonly publicKey: Uint8Array;
} {
  const keyInfo = canonicalJsonBytes({ domain: HOSTING_KEY_DOMAIN, nexusAid: normAid(parts.nexusAid), anchor: parts.prev ?? "genesis" });
  // The key does not depend on the POPRF `info`; any label reaches the same deterministic derivation.
  return ristretto255_oprf.poprf(keyInfo).deriveKeyPair(parts.leafSeed, keyInfo);
}

/** One hosting epoch as the hearth holds it: the act, its CID, and the secret key derived for it. */
export interface HostingEpoch {
  readonly act:       HostingAct;
  readonly cid:       string;
  readonly secretKey: Uint8Array;
}

/** Re-derive the epoch an act names from the hearth's leaf seed. Null when the seed derives another key. */
export function hostingEpochOf(act: HostingAct, leafSeed: Uint8Array): HostingEpoch | null {
  const kp = hostingKeyPair({ leafSeed, nexusAid: act.nexusAid, prev: act.prev });
  if (hex(kp.publicKey) !== act.oprfPub.toLowerCase()) return null;
  return { act, cid: hostingActCid(act), secretKey: kp.secretKey };
}

/** Sign the hearth's next hosting act in N, rolling from `prev` (null for the first), under allowance `cap`. */
export async function mintHostingAct(parts: {
  readonly leafSeed: Uint8Array; readonly nexusAid: string; readonly prev: string | null; readonly cap: number;
}): Promise<HostingEpoch> {
  if (!Number.isSafeInteger(parts.cap) || parts.cap < 1) throw new Error("a hosting cap is a whole number of at least 1");
  const hearthLeaf = hex(await ed25519.getPublicKeyAsync(parts.leafSeed));
  const kp = hostingKeyPair(parts);
  const unsigned = {
    kind: HOSTING_ACT_DOMAIN, nexusAid: normAid(parts.nexusAid), hearthLeaf,
    oprfPub: hex(kp.publicKey), prev: parts.prev, cap: parts.cap,
  } as Omit<HostingAct, "sig">;
  const sig = hex(await ed25519.signAsync(hostingActBytes(unsigned), parts.leafSeed));
  const act: HostingAct = { ...unsigned, sig };
  return { act, cid: hostingActCid(act), secretKey: kp.secretKey };
}

// ── ON THE BOARD ──────────────────────────────────────────────────────────────────────────────────

/** The tiddler key a hosting act rides under on N's carriage board — keyed by its CID, so acts accrete. */
export function hostingActKey(act: HostingAct): string {
  return `${CARRIAGE_ENTRY_PREFIX}hosting/${hostingActCid(act)}`;
}

/** Land a hosting act on a board draft. Call INSIDE a `handle.change()` callback. */
export function writeHostingAct(draft: LarDoc, act: HostingAct): void {
  const key = hostingActKey(act);
  draft.tiddlers[key] = mutableLarRecord(key, { text: JSON.stringify(act) }, hostingActCid(act));
}

/** Every well-formed hosting act a board carries, by `hearthLeaf` when named. Shape only; extra fields drop. */
export function hostingActsFromBoard(doc: LarDoc | undefined | null, hearthLeaf?: string): HostingAct[] {
  const tiddlers = doc?.tiddlers;
  if (!tiddlers) return [];
  const want = hearthLeaf?.toLowerCase();
  const out: HostingAct[] = [];
  for (const record of Object.values(tiddlers)) {
    const text = tiddlerText(record);
    if (text === null) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { continue; }
    if (!isHostingAct(parsed)) continue;
    if (want !== undefined && parsed.hearthLeaf.toLowerCase() !== want) continue;
    out.push({
      kind: parsed.kind, nexusAid: parsed.nexusAid, hearthLeaf: parsed.hearthLeaf,
      oprfPub: parsed.oprfPub, prev: parsed.prev, cap: parsed.cap, sig: parsed.sig,
    });
  }
  return out;
}

/**
 * A FORK in one hearth's hosting acts: two or more signed acts that roll from the same `prev`. Informational —
 * a walker that reads one surfaces it to its human, and nothing refuses on it. Only signed acts count, so a
 * forged tiddler raises nothing.
 */
export interface HostingFork {
  readonly hearthLeaf: string;
  readonly prev:       string | null;
  readonly actCids:    readonly string[];
}

export async function hostingForks(acts: readonly HostingAct[]): Promise<HostingFork[]> {
  const byPrev = new Map<string, { hearthLeaf: string; prev: string | null; cids: Set<string> }>();
  for (const act of acts) {
    if (!(await verifyHostingAct(act))) continue;
    const key = `${act.hearthLeaf.toLowerCase()}:${normAid(act.nexusAid)}:${act.prev ?? "genesis"}`;
    const slot = byPrev.get(key) ?? { hearthLeaf: act.hearthLeaf.toLowerCase(), prev: act.prev, cids: new Set<string>() };
    slot.cids.add(hostingActCid(act));
    byPrev.set(key, slot);
  }
  return [...byPrev.values()].filter((s) => s.cids.size > 1)
    .map((s) => ({ hearthLeaf: s.hearthLeaf, prev: s.prev, actCids: [...s.cids].sort() }));
}

// ── THE TOKEN ─────────────────────────────────────────────────────────────────────────────────────

/** An invite's class: minted by the hearth itself, or blind by a walker it hosts. */
export type InvitePurpose = "host-invite" | "walker-invite";

/** A bearer invite token. `n` 32 random bytes (hex); `y` the 64-byte POPRF output (hex). Names no one. */
export interface InviteToken {
  readonly purpose: InvitePurpose;
  readonly n:       string;
  readonly y:       string;
}

/** Structural guard for an invite token. */
export function isInviteToken(v: unknown): v is InviteToken {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const x = v as Record<string, unknown>;
  return (x["purpose"] === "host-invite" || x["purpose"] === "walker-invite") &&
    typeof x["n"] === "string" && N_RE.test(x["n"] as string) && typeof x["y"] === "string" && Y_RE.test(x["y"] as string);
}

/** The POPRF `info` a token of `purpose` evaluates under at epoch `epochCid` in N. */
export function tokenInfo(nexusAid: string, epochCid: string, purpose: InvitePurpose): Uint8Array {
  return canonicalJsonBytes({ domain: HOSTING_TOKEN_DOMAIN, purpose, nexusAid: normAid(nexusAid), epoch: epochCid });
}

/** The token's output for nonce `n` at `epoch` under `purpose` — the hearth's non-interactive evaluation. */
export function evaluateToken(epoch: HostingEpoch, n: string, purpose: InvitePurpose): string {
  return hex(ristretto255_oprf.poprf(tokenInfo(epoch.act.nexusAid, epoch.cid, purpose)).evaluate(epoch.secretKey, hexToBytes(n)));
}

/**
 * The HEARTH'S OWN mint: a fresh random nonce evaluated in process under `host-invite`. The operator IS the
 * hearth, so blindness against the hearth is moot; the token is the same bearer format a walker's blind mint
 * yields. Writes nothing.
 */
export function mintHostToken(epoch: HostingEpoch): InviteToken {
  const n = hex(webGetRandomValues(new Uint8Array(32)));
  return { purpose: "host-invite", n, y: evaluateToken(epoch, n, "host-invite") };
}

/** Does `token` verify at `epoch` under its own purpose? Pure; never throws. */
export function tokenVerifiesAt(epoch: HostingEpoch, token: InviteToken): boolean {
  if (!isInviteToken(token)) return false;
  try { return evaluateToken(epoch, token.n.toLowerCase(), token.purpose) === token.y.toLowerCase(); } catch { return false; }
}

// ── THE GRANT ─────────────────────────────────────────────────────────────────────────────────────

/** A walker's hosting grant — carried by the walker, stored nowhere at the hearth. */
export interface HostingGrant {
  readonly nexusAid: string;
  /** The walker's per-Nexus leaf (hex) — the key that proves over each socket the grant rides. */
  readonly leaf:     string;
  /** The epoch (hosting act CID) the grant was issued at. */
  readonly epoch:    string;
  /** The lineage `L` (hex) — opaque to anyone who holds no claim. */
  readonly lineage:  string;
  /** Hosting epochs this lineage has survived — a causal count its renewals carry, never days. */
  readonly survived: number;
  /** The class of the invite this lineage opened on. */
  readonly from:     "host" | "walker";
  /** The keyed POPRF tag (hex, 64 bytes). */
  readonly tag:      string;
}

/** Structural guard for a hosting grant. */
export function isHostingGrant(v: unknown): v is HostingGrant {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const x = v as Record<string, unknown>;
  return typeof x["nexusAid"] === "string" && (x["nexusAid"] as string).length > 0 &&
    typeof x["leaf"] === "string" && KEY_RE.test(x["leaf"] as string) &&
    typeof x["epoch"] === "string" && CID_RE.test(x["epoch"] as string) &&
    typeof x["lineage"] === "string" && CID_RE.test(x["lineage"] as string) &&
    typeof x["survived"] === "number" && Number.isSafeInteger(x["survived"]) && (x["survived"] as number) >= 0 &&
    (x["from"] === "host" || x["from"] === "walker") &&
    typeof x["tag"] === "string" && Y_RE.test(x["tag"] as string);
}

/** The POPRF `info` a grant tag evaluates under at epoch `epochCid` in N. */
export function grantInfo(nexusAid: string, epochCid: string): Uint8Array {
  return canonicalJsonBytes({ domain: HOSTING_GRANT_DOMAIN, nexusAid: normAid(nexusAid), epoch: epochCid });
}

function grantInput(parts: { nexusAid: string; leaf: string; lineage: string; survived: number; from: "host" | "walker" }): Uint8Array {
  return canonicalJsonBytes({
    domain: HOSTING_GRANT_DOMAIN, nexusAid: normAid(parts.nexusAid), leaf: parts.leaf.toLowerCase(),
    lineage: parts.lineage.toLowerCase(), survived: parts.survived, from: parts.from,
  });
}

/** Issue a grant at `epoch` — deterministic: the same fields in yield the same grant out. */
export function issueGrant(epoch: HostingEpoch, parts: {
  readonly leaf: string; readonly lineage: string; readonly survived: number; readonly from: "host" | "walker";
}): HostingGrant {
  const nexusAid = normAid(epoch.act.nexusAid);
  const fields = { nexusAid, leaf: parts.leaf.toLowerCase(), lineage: parts.lineage.toLowerCase(), survived: parts.survived, from: parts.from };
  const tag = hex(ristretto255_oprf.poprf(grantInfo(nexusAid, epoch.cid)).evaluate(epoch.secretKey, grantInput(fields)));
  return { ...fields, epoch: epoch.cid, tag };
}

/** Does `grant`'s tag verify at `epoch` (and name that epoch and its Nexus)? Pure; never throws. */
export function grantVerifiesAt(epoch: HostingEpoch, grant: HostingGrant): boolean {
  if (!isHostingGrant(grant)) return false;
  if (grant.epoch !== epoch.cid || normAid(grant.nexusAid) !== normAid(epoch.act.nexusAid)) return false;
  try { return issueGrant(epoch, grant).tag === grant.tag.toLowerCase(); } catch { return false; }
}

/** Renew a previous-epoch grant into `current`: the same lineage, one more epoch survived. Deterministic. */
export function renewGrant(current: HostingEpoch, grant: HostingGrant): HostingGrant {
  return issueGrant(current, { leaf: grant.leaf, lineage: grant.lineage, survived: grant.survived + 1, from: grant.from });
}

// ── THE CLAIM AND THE LINEAGE ─────────────────────────────────────────────────────────────────────

/** The newcomer's redeem claim for token nonce `n`, derived from its own leaf seed. Never stored. */
export function redeemClaim(leafSeed: Uint8Array, n: string): string {
  return sha256HexBytesSync(canonicalJsonBytes({ domain: HOSTING_TOKEN_DOMAIN, part: "claim", leafSeed: hex(leafSeed), n: n.toLowerCase() }));
}

/**
 * What the hearth's spent-set keeps for a redemption: a digest of the claim BOUND TO THE LEAF that proved over the
 * socket, never the claim and never the leaf. A retry is the same claim under the same leaf; the same claim under
 * any other leaf digests apart and reads as another redeemer, so a captured `{token, claim}` replayed under a
 * thief's own leaf meets silence and the victim's own retry still earns its grant.
 */
export function claimDigest(claim: string, leaf: string): string {
  return sha256HexBytesSync(canonicalJsonBytes({ domain: HOSTING_TOKEN_DOMAIN, part: "claim-digest", claim: claim.toLowerCase(), leaf: leaf.toLowerCase() }));
}

/** The lineage a redemption opens: a digest of the nonce and the claim, so only a claim holder computes it. */
export function lineageOf(n: string, claim: string): string {
  return sha256HexBytesSync(canonicalJsonBytes({ domain: HOSTING_GRANT_DOMAIN, part: "lineage", n: n.toLowerCase(), claim: claim.toLowerCase() }));
}

// ── THE INVITE A HUMAN CARRIES ────────────────────────────────────────────────────────────────────

/**
 * An invite as a human carries it — paste, QR or URL fragment, never fetched: where to dial (the relay base and
 * the gate key to pin there), the Nexus, and the bearer token. It names no inviter and is not signed: the token
 * itself is the only thing the hearth checks.
 */
export interface HostingInvite {
  readonly nexusAid:   string;
  /** The hearth's gate key — the pin the newcomer knocks with and reads the verdict under. */
  readonly gatePubKey: string;
  /** The relay route the newcomer dials (`ws(s)://host[:port]/ws`); absent when the newcomer already knows it. */
  readonly relay?:     string;
  readonly token:      InviteToken;
}

/** The scheme a carried invite opens on. */
export const INVITE_SCHEME = "lar-invite:";

/** Encode an invite as the one string a human carries. */
export function encodeInvite(invite: HostingInvite): string {
  const body = {
    nexusAid: normAid(invite.nexusAid), gatePubKey: invite.gatePubKey.toLowerCase(),
    ...(invite.relay ? { relay: invite.relay } : {}), token: invite.token,
  };
  return INVITE_SCHEME + base64UrlEncode(canonicalJsonBytes(body));
}

/** Decode a carried invite, or null for anything that is not one — a torn invite is no invite, never a throw. */
export function decodeInvite(carried: string): HostingInvite | null {
  const text = carried.trim();
  if (!text.startsWith(INVITE_SCHEME)) return null;
  try {
    const x = JSON.parse(new TextDecoder().decode(base64UrlDecode(text.slice(INVITE_SCHEME.length)))) as Record<string, unknown>;
    if (typeof x["nexusAid"] !== "string" || (x["nexusAid"] as string).length === 0) return null;
    if (typeof x["gatePubKey"] !== "string" || !KEY_RE.test(x["gatePubKey"] as string)) return null;
    if (x["relay"] !== undefined && typeof x["relay"] !== "string") return null;
    if (!isInviteToken(x["token"])) return null;
    return {
      nexusAid: x["nexusAid"] as string, gatePubKey: x["gatePubKey"] as string,
      ...(typeof x["relay"] === "string" ? { relay: x["relay"] as string } : {}),
      token: x["token"],
    };
  } catch { return null; }
}

// ── THE ALLOWANCE, AND THE WALKER'S BLIND MINT ────────────────────────────────────────────────────

/**
 * How many invites a grant's lineage may mint in its epoch, under the act's `cap`.
 *
 * The FLOOR is 1, and it VESTS by class (operator-ruled): a lineage opened on the hearth's OWN invite holds its
 * floor at once; a lineage opened on a WALKER's invite holds nothing until the hearth's next roll. So a chain of
 * walkers grows at most one hop per roll, and the roll is the household's consent to grow. Past the floor the
 * allowance grows by one for each epoch survived since vesting — a causal count the grant's renewals carry,
 * never days — up to the cap.
 */
export function allowance(grant: Pick<HostingGrant, "survived" | "from">, cap: number): number {
  const vested = grant.survived - (grant.from === "walker" ? 1 : 0);
  return vested < 0 ? 0 : Math.min(1 + vested, cap);
}

/** The marker a lineage's mint burns at epoch `epochCid` — one per lineage per epoch. Names no one. */
export function mintMarker(lineage: string, epochCid: string): string {
  return sha256HexBytesSync(canonicalJsonBytes({ domain: HOSTING_SPEND_DOMAIN, lineage: lineage.toLowerCase(), epoch: epochCid }));
}

/** The digest of a blinded batch — what a marker keeps, so a retry of the same batch burns nothing new. */
export function batchDigest(blinded: readonly string[]): string {
  return sha256HexBytesSync(canonicalJsonBytes({ domain: HOSTING_SPEND_DOMAIN, part: "batch", blinded: blinded.map((b) => b.toLowerCase()) }));
}

/** The hearth's blind evaluation of a walker's batch under `walker-invite` at `epoch`: elements and one DLEQ proof. */
export function evaluateWalkerBatch(epoch: HostingEpoch, blinded: readonly string[]): { readonly evaluated: string[]; readonly proof: string } {
  const out = ristretto255_oprf.poprf(tokenInfo(epoch.act.nexusAid, epoch.cid, "walker-invite"))
    .blindEvaluateBatch(epoch.secretKey, blinded.map((b) => hexToBytes(b)));
  return { evaluated: out.evaluated.map((e) => hex(e)), proof: hex(out.proof) };
}

/** One blinded nonce a walker keeps until its batch is evaluated: the nonce, its blind, its blinded element. */
export interface PendingMintItem {
  readonly n:       string;
  readonly blind:   string;
  readonly blinded: string;
}

/** A batch a walker sent and has not yet finalized, kept durably before it is sent. */
export interface PendingMint {
  readonly epoch:      string;
  readonly tweakedKey: string;
  readonly items:      readonly PendingMintItem[];
}

/**
 * Blind `count` fresh nonces for a `walker-invite` batch at `act`'s epoch, against the act's own public key —
 * the key every walker of this hearth reads off the same signed act, so no walker can be told apart by a key.
 */
export function blindWalkerBatch(act: HostingAct, count: number): PendingMint {
  const epoch = hostingActCid(act);
  const poprf = ristretto255_oprf.poprf(tokenInfo(act.nexusAid, epoch, "walker-invite"));
  let tweakedKey = "";
  const items: PendingMintItem[] = [];
  for (let i = 0; i < count; i++) {
    const n = webGetRandomValues(new Uint8Array(32));
    const b = poprf.blind(n, hexToBytes(act.oprfPub));
    tweakedKey = hex(b.tweakedKey);
    items.push({ n: hex(n), blind: hex(b.blind), blinded: hex(b.blinded) });
  }
  return { epoch, tweakedKey, items };
}

/**
 * Finalize a batch against the hearth's answer: the DLEQ proof must hold under the act's key, or this throws and
 * the walker keeps its pending batch. Returns the walker's bearer tokens.
 */
export function finalizeWalkerBatch(act: HostingAct, pending: PendingMint, answer: { readonly evaluated: readonly string[]; readonly proof: string }): InviteToken[] {
  if (answer.evaluated.length !== pending.items.length) throw new Error("the hearth answered another batch");
  const poprf = ristretto255_oprf.poprf(tokenInfo(act.nexusAid, pending.epoch, "walker-invite"));
  const outputs = poprf.finalizeBatch(
    pending.items.map((it, i) => ({ input: hexToBytes(it.n), blind: hexToBytes(it.blind), evaluated: hexToBytes(answer.evaluated[i]!), blinded: hexToBytes(it.blinded) })),
    hexToBytes(answer.proof), hexToBytes(pending.tweakedKey),
  );
  return pending.items.map((it, i) => ({ purpose: "walker-invite" as const, n: it.n, y: hex(outputs[i]!) }));
}

// ── W — THE HEARTH CARRIES A WALKER'S OWN DOCUMENTS, SEALED ──────────────────────────────────────

/**
 * The hearth's opaque key for one guest's carried record in N: HMAC under the hearth's own leaf seed over the
 * guest's PROVEN per-Nexus leaf `G` — the leaf every grant names and every socket's leaf proof proves. The record
 * is reached only by a socket that proves `G`, whichever lineage its grant rides, so a guest walking back in on a
 * fresh invite under the same leaf reaches its carriage by proof, and a fresh leaf is a fresh carriage. The key
 * names no leaf to anyone who holds no hearth seed; a holder of the hearth seed can test a KNOWN leaf against the
 * records (the bound canon names), which adds no linkage the hearth lacks, since it already sees `G` prove.
 */
export function carryRecordKey(hearthLeafSeed: Uint8Array, nexusAid: string, leaf: string): string {
  return hex(hmac(sha256, hearthLeafSeed, canonicalJsonBytes({ domain: HOSTING_CARRY_DOMAIN, nexusAid: normAid(nexusAid), leaf: leaf.toLowerCase() })));
}

/**
 * The walker's own seal secret for documents it hands a hearth in N to carry: derived from the walker's own leaf
 * seed, held nowhere else. The hearth carries the ciphertext and can never open it (carry ⊥ read).
 */
export function walkCarrySecret(walkerLeafSeed: Uint8Array, nexusAid: string): Uint8Array {
  return hmac(sha256, walkerLeafSeed, canonicalJsonBytes({ domain: WALK_CARRY_SEAL_INFO, nexusAid: normAid(nexusAid) }));
}

/**
 * A lapse "long FOR THIS GUEST": the epochs since the guest's last contact over its own typical gap between
 * contacts, both counted in the hearth's own epochs — so how often the hearth rolls cancels out, and the guest's
 * own rhythm, never the host's habit, sets the measure. A guest with no rhythm yet reads its gap as one epoch.
 */
export function lapseRatio(epochNow: number, lastSeen: number, typicalGap: number): number {
  return (epochNow - lastSeen) / Math.max(1, typicalGap);
}

/** Fold one observed gap between a guest's contacts into its typical gap — the guest's own rhythm. */
export function foldRhythm(typicalGap: number, gap: number): number {
  return typicalGap === 0 ? gap : Math.max(1, Math.round((typicalGap + gap) / 2));
}

/** How far past its own rhythm a guest must lapse before its carriage is reclaimable under pressure. */
export const RECLAIM_RATIO = 2;
