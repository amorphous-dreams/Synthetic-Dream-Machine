/**
 * auth-wire — vessel-to-vessel pre-sync authentication protocol.
 *
 * These messages flow over a raw WebSocket BEFORE the Automerge sync handshake
 * begins. The exchange establishes the connecting vessel's Keyhive identity and
 * proves it holds cap=admin on the target document.
 *
 * Wire sequence (gate initiates, on the knock path `gate-knock` derives from the gate key the dialer pinned):
 *   Gate → Peer  : LarChallengeMsg  (fresh nonce — and nothing else; the dialer already pins the gate key)
 *   Peer → Gate  : LarAuthMsg       (Keyhive ContactCard + nonce echo + the leaf's own fresh nonce + at most one
 *                                    presentation)
 *   Gate → Peer  : LarAuthOkMsg     (the gate's SIGNED verdict — Automerge join may proceed)
 *              OR      nothing at all: the gate terminates the socket at a deadline it drew at accept, with no
 *                      close frame and no reason. Every refusal reads alike (siege-resilience#/the-active-prober).
 *
 * AUTHENTICATION BOTH WAYS. The leaf proves its key to the gate (the V3 proof); the gate proves its key to
 * the leaf by signing `lar:auth-ok` (`authOkBytes`) over the leaf's own fresh nonce, so a relay standing in
 * the middle, or a recorded verdict replayed, answers nothing the leaf will read as a pass. The leaf checks
 * the signature against the gate key IT pinned out-of-band, never one the wire names.
 *
 * V3 proof-of-possession — ENFORCED end to end. The platform-blind halves (`authProofBytes` ·
 * `buildAuthResponse` · `verifyAuthProof` · `runPeerHandshake` · `ed25519SignerFromSeed`) compose the full
 * path: the gate relays {nonce, sig} to the keyholder worker, which checks the Ed25519 proof against the card
 * key + its own key and folds the result into admission. NO CLOCK RIDES THE WIRE: the gate's single-use nonce
 * is the proof's only freshness, so neither the proof bytes nor `lar:auth` carry a timestamp. The peer
 * transport (LarWSClientAdapter) sources a real proof from the light leaf identity (bare-Ed25519 signer +
 * cached ContactCard). A node operator MAY relax to capability-only with LAR_V3_ALLOW_UNPROVEN=1. See
 * `project_verification_placement`, `operator-peer` #actor-parity.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/auth-wire
 */

import * as ed25519 from "@noble/ed25519";
import { canonicalJsonBytes, hex, hexToBytes, sha256HexBytesSync } from "./crypto.js";
import type { DeviceDelegationTiddler } from "./device-delegation.js";
import type { AuthorityEvidenceVerdict } from "./authority-verdict.js";
import { carriageEntryActCid, isRollAnchor, type CarriageEntry, type PresentedLineageAct } from "./carriage-registry.js";
import { AUTH_OK_DOMAIN, AUTH_PROOF_DOMAIN, CARRIAGE_ENTRY_DOMAIN, PRESENTED_LEAF_PROOF_DOMAIN } from "./domains.js";
import { webGetRandomValues } from "./crypto.js";

/** Gate → Peer: start of auth exchange. The gate names no key: a dialer proves to the gate key it PINNED, and
 *  an echoed key would only confirm that key to whoever replays a sniffed path. */
export interface LarChallengeMsg {
  type:    "lar:challenge";
  nonce:   string; // 32-byte hex, gate-generated per connection
}

/**
 * AuthProofWire — the V3 proof material a gate relays from the peer's `lar:auth`
 * to the keyholder worker (the only verifier). Deliberately carries NO pubkeys:
 * the worker supplies `gatePubKey` (its own verifying key) and `peerPubKey` (the
 * ContactCard-derived suffix) from TRUSTED sources, never the wire (see
 * verifyAuthProof's conservative-caller law). Only freshness/replay material crosses.
 */
export interface AuthProofWire {
  nonce: string;
  sig:   string;
}

export type DaemonProofEvidence = AuthorityEvidenceVerdict<"daemon-proof-of-possession">;

/**
 * PresentedAdmit — the subject's own quorum-signed carriage ADMIT, presented at the wire for the island it
 * dials, with the admit's causal LINEAGE: the counted acts it cites for this nym and epoch, and — for an admit
 * at an epoch the charter has since rolled past — the roll anchors that carry it to the head. A dialer
 * presents only the dialed island's admit, never its whole set.
 *
 * The admit and lineage are public bytes: every entry already stands as a signed act on the Nexus's carriage
 * board. The bundle rides OUTSIDE the V3 proof signature. It binds to THIS socket through `leafProof` — the
 * admit's own LEAF signing the gate's nonce, the gate key, the presenting vessel key and the admit's act CID
 * (`leafProofBytes`). No root signs anything in it and no root is named in it: a socket that presents a leaf
 * admit carries no root-signed edge (`isLarAuthMsg` refuses one beside the fleet `edge`, and refuses the
 * retired contract slot outright). It grants nothing on arrival — the receiver checks the proof and folds the
 * admit against its own deny board before reading any relation.
 */
export interface PresentedAdmit {
  readonly admit:      CarriageEntry;
  /** The admit's causal acts at its own epoch, and the roll anchors carrying that epoch to the head. */
  readonly lineage:    readonly PresentedLineageAct[];
  /** The leaf's Ed25519 signature (hex) over `leafProofBytes` for this socket. Absent → the admit binds to no
   *  socket and the receiver reads the presenter as a stranger. */
  readonly leafProof?: string;
}

function isQuorumSignatureShape(v: unknown): boolean {
  if (typeof v !== "object" || v === null) return false;
  const x = v as Record<string, unknown>;
  return typeof x["signer"] === "string" && typeof x["sig"] === "string";
}

function isCarriageEntryShape(v: unknown): v is CarriageEntry {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const x = v as Record<string, unknown>;
  return x["kind"] === CARRIAGE_ENTRY_DOMAIN &&
    typeof x["nym"] === "string" && /^[0-9a-fA-F]{64}$/.test(x["nym"]) &&
    (x["action"] === "admit" || x["action"] === "revoke" || x["action"] === "carry" || x["action"] === "uncarry") &&
    Array.isArray(x["parents"]) && x["parents"].every((p) => typeof p === "string") &&
    typeof x["sealEpochCid"] === "string" && x["sealEpochCid"].length > 0 &&
    Array.isArray(x["signatures"]) && x["signatures"].every(isQuorumSignatureShape) &&
    (x["contractSig"] === undefined || isQuorumSignatureShape(x["contractSig"]));
}

/**
 * Structural guard for a presented admit: an `admit` act, and a lineage of operator acts (admit/revoke) on the
 * SAME nym under the admit's OWN charter epoch, beside the roll anchors (`isRollAnchor`) that carry that epoch
 * to the head. Shape only — no signature, quorum, ancestry, anchor chain or frontier is read here.
 */
export function isPresentedAdmit(v: unknown): v is PresentedAdmit {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const x = v as Record<string, unknown>;
  const admit = x["admit"];
  const lineage = x["lineage"];
  if (!isCarriageEntryShape(admit) || admit.action !== "admit" || !Array.isArray(lineage)) return false;
  const leafProof = x["leafProof"];
  if (leafProof !== undefined && (typeof leafProof !== "string" || !/^[0-9a-fA-F]{128}$/.test(leafProof))) return false;
  const nym = admit.nym.toLowerCase();
  return lineage.every((entry) => isRollAnchor(entry) || (
    isCarriageEntryShape(entry) &&
    (entry.action === "admit" || entry.action === "revoke") &&
    entry.nym.toLowerCase() === nym &&
    entry.sealEpochCid === admit.sealEpochCid));
}

/** A presented admit as one arm of the presentation slot. */
export type PresentedAdmitArm = { readonly kind: "admit" } & PresentedAdmit;

/**
 * THE PRESENTATION SLOT — at most one per socket: what this socket stands as beyond its vessel key. Each arm
 * carries the presenting LEAF's proof over this socket (`leafProofBytes`, one domain for every arm). The gate's
 * sorter reads it before any verdict; nothing on it grants anything on arrival.
 */
export type Presented = PresentedAdmitArm;

/** A presentation before its leaf proof is signed — what a dialer carries until it holds a challenge. */
export type UnsignedPresented = Presented extends infer P ? (P extends unknown ? Omit<P, "leafProof"> : never) : never;

/** Structural guard for the presentation slot. Shape only. */
export function isPresented(v: unknown): v is Presented {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const kind = (v as Record<string, unknown>)["kind"];
  if (kind === "admit") return isPresentedAdmit(v);
  return false;
}

/** Peer → Gate: identity assertion. */
export interface LarAuthMsg {
  type:        "lar:auth";
  contactCard: string; // Keyhive ContactCard.toJson() — self-certifying identity packet
  nonce:       string; // echo of gate nonce
  /** The leaf's OWN fresh nonce (32-byte hex). The gate's signed verdict commits to it, so the leaf alone
   *  decides the verdict's freshness — a gate-chosen nonce could be one a recorded verdict already answered. */
  leafNonce:   string;
  /**
   * Ed25519 signature (hex) over authProofBytes({nonce, gatePubKey, peerPubKey, aud}) — the V3
   * proof-of-possession (project_verification_placement). buildAuthResponse produces it.
   */
  sig:         string;
  /**
   * OPTIONAL device-delegation edge. A peer the operator device-admitted carries the
   * signed root→device edge so the gate can admit it on the operator's-own-device path even
   * absent a cap=admin grant. Untrusted CRDT input — the worker verifies it against the PINNED
   * hearth root (verifyDeviceDelegation); a peer that sends none behaves exactly as before.
   */
  edge?:       DeviceDelegationTiddler;
  /**
   * OPTIONAL presentation — ONE arm, with the presenting leaf's proof over this socket. Outside the V3 proof
   * signature; the gate's sorter reads it against the nonce and gate key the gate issued before any verdict.
   * A message carrying it beside `edge` fails `isLarAuthMsg`: one socket, one face.
   *
   * NO CONTRACT SLOT. A cross-operator's own persona-root-signed edge over its vessel key never rides a
   * lar:auth: the vessel key is one key across every Nexus, so a root edge on any socket links that root to
   * every leaf the same vessel presents (membership-doctrine #/two-maps). `isLarAuthMsg` refuses a message
   * carrying a `contractEdge` field at all.
   */
  presented?:  Presented;
}

/** Gate → Peer: auth passed, Automerge join may proceed — signed by the gate's own key (`authOkBytes`). */
export interface LarAuthOkMsg {
  type:    "lar:auth-ok";
  /** The gate key's Ed25519 signature (hex) over `authOkBytes` for this exchange. */
  sig:     string;
}

/**
 * Peer ↔ Gate, AFTER a passing verdict: one message of the authenticated session, carried as a JSON text
 * frame on the SAME socket beside Automerge's binary frames. `kind` names the protocol riding the session;
 * each side routes by it and reads `body` as untrusted input. Only a socket both sides authenticated carries
 * one — the gate reads none before its verdict, and the leaf sends none before it verified the gate's.
 */
export interface LarSessionMsg {
  type: "lar:session";
  kind: string;
  body: unknown;
}

export type LarAuthWireMsg =
  | LarChallengeMsg
  | LarAuthMsg
  | LarAuthOkMsg
  | LarSessionMsg;

// ── Type guards ───────────────────────────────────────────────────────────────

export function isLarChallengeMsg(v: unknown): v is LarChallengeMsg {
  return (
    typeof v === "object" && v !== null &&
    (v as Record<string, unknown>)["type"] === "lar:challenge" &&
    typeof (v as Record<string, unknown>)["nonce"] === "string"
  );
}

export function isLarAuthMsg(v: unknown): v is LarAuthMsg {
  const ok = (
    typeof v === "object" && v !== null &&
    (v as Record<string, unknown>)["type"] === "lar:auth" &&
    typeof (v as Record<string, unknown>)["contactCard"] === "string" &&
    typeof (v as Record<string, unknown>)["nonce"] === "string" &&
    typeof (v as Record<string, unknown>)["leafNonce"] === "string" &&
    LEAF_NONCE_RE.test((v as Record<string, unknown>)["leafNonce"] as string)
  );
  if (!ok) return false;
  const x = v as Record<string, unknown>;
  // THE CONTRACT SLOT IS RETIRED. A root-signed edge over a cross-operator's vessel key binds that root to the
  // vessel key every leaf of the same vessel rides, so it travels on no socket at all. A presentation rides the
  // one slot; a field beside it under any other name is refused.
  if ("contractEdge" in x || "presentedAdmit" in x) return false;
  const presented = x["presented"];
  if (presented === undefined) return true;
  // ONE SOCKET, ONE FACE. A presented leaf travels with no root-signed edge: carrying the fleet edge beside it
  // would bind the leaf to the root on the wire.
  if (x["edge"] !== undefined) return false;
  return isPresented(presented);
}

export function isLarAuthOkMsg(v: unknown): v is LarAuthOkMsg {
  return (
    typeof v === "object" && v !== null &&
    (v as Record<string, unknown>)["type"] === "lar:auth-ok" &&
    typeof (v as Record<string, unknown>)["sig"] === "string"
  );
}

export function isLarSessionMsg(v: unknown): v is LarSessionMsg {
  return (
    typeof v === "object" && v !== null &&
    (v as Record<string, unknown>)["type"] === "lar:session" &&
    typeof (v as Record<string, unknown>)["kind"] === "string" &&
    ((v as Record<string, unknown>)["kind"] as string).length > 0 &&
    "body" in (v as Record<string, unknown>)
  );
}

// ── Constructors ──────────────────────────────────────────────────────────────

export function mkLarChallenge(nonce: string): LarChallengeMsg {
  return { type: "lar:challenge", nonce };
}

export function mkLarAuth(
  contactCard: string,
  nonce: string,
  sig: string,
  leafNonce: string,
): LarAuthMsg {
  return { type: "lar:auth", contactCard, nonce, leafNonce, sig };
}

export function mkLarAuthOk(sig: string): LarAuthOkMsg {
  return { type: "lar:auth-ok", sig };
}

/** A leaf nonce: 32 fresh bytes, lowercase hex. */
const LEAF_NONCE_RE = /^[0-9a-f]{64}$/;

/** Mint the leaf's own fresh nonce for one handshake. */
export function mintLeafNonce(): string {
  return hex(webGetRandomValues(new Uint8Array(32)));
}

// ── The gate's signed verdict ─────────────────────────────────────────────────────────────────────

/**
 * authOkBytes — the canonical bytes a GATE signs with its own gate key to say "this leaf passed": the
 * gate's challenge `nonce`, the leaf's own `leafNonce`, the gate key, the leaf's key and the audience, under
 * `AUTH_OK_DOMAIN`. The leaf's nonce carries the freshness (the leaf chose it, so no recorded verdict
 * answers it); the gate key binds the verdict to the gate the leaf pinned; the leaf key and audience bind it
 * to this leaf's ask. No clock rides it. The gate key signs it, never a root.
 */
export function authOkBytes(parts: {
  nonce:      string;
  leafNonce:  string;
  gatePubKey: string;
  peerPubKey: string;
  aud:        string;
}): Uint8Array {
  return canonicalJsonBytes({
    domain:     AUTH_OK_DOMAIN,
    nonce:      parts.nonce,
    leafNonce:  parts.leafNonce.toLowerCase(),
    gatePubKey: parts.gatePubKey.toLowerCase(),
    peerPubKey: parts.peerPubKey.toLowerCase(),
    aud:        parts.aud,
  });
}

/**
 * verifyAuthOk — did the gate the leaf PINNED sign this verdict for this exchange? Pure; never throws.
 * `gatePubKey` is the leaf's out-of-band pin, never a key the wire named; every other value is one the leaf
 * itself sent or received on this socket.
 */
export async function verifyAuthOk(parts: {
  nonce:      string;
  leafNonce:  string;
  gatePubKey: string;
  peerPubKey: string;
  aud:        string;
  sig:        string;
}): Promise<boolean> {
  if (!/^[0-9a-fA-F]{128}$/.test(parts.sig) || !/^[0-9a-fA-F]{64}$/.test(parts.gatePubKey)) return false;
  return ed25519VerifyHex(parts.sig, authOkBytes(parts), parts.gatePubKey);
}

export function mkLarSessionMsg(kind: string, body: unknown): LarSessionMsg {
  return { type: "lar:session", kind, body };
}

// ── Proof-of-possession (V3 — challenge-response) ───────────────────────────

/**
 * authProofBytes — the canonical bytes a connecting peer signs to PROVE it HOLDS
 * its identity's private key (V3, see project_verification_placement). The proof
 * binds, in one signature: the gate `nonce` (freshness — single-use, chosen by
 * the gate), the GATE's own pubkey (the GATE-BINDING — the load-bearing field;
 * signing only the nonce stays relayable, so a malicious gate could replay the
 * proof to a different gate; WebAuthn, the FIDO formal proof, and Keyhive
 * Notebook §05 all require binding the gate identity), the peer's claimed
 * pubkey, and the target bag `aud`. No clock rides it. The verifier — the
 * keyholder worker — checks the Ed25519 signature against the ContactCard's
 * verifying key.
 *
 * The bytes open on `AUTH_PROOF_DOMAIN`, so a proof never verifies as any other
 * signed thing and no other signature verifies as a proof — the name separates,
 * and no version field rides beside it.
 *
 * Canonical JSON (stable key order) so sign and verify produce identical bytes.
 * NEVER sign the nonce alone.
 *
 * This helper LOCKS the canonical what-to-sign; both halves compose over it — the
 * peer signs via buildAuthResponse (run by runPeerHandshake, live in
 * lar-ws-client-adapter) and the gate/worker verifies via verifyAuthProof
 * (daemon-auth-gate + operator-daemon-behavior). The local CLI speaks the daemon's
 * sock, gated by 0600 presence; the peer proof rides the WS relay surface.
 */
export function authProofBytes(parts: {
  nonce:       string;  // gate-issued, single-use
  gatePubKey:  string;  // the gate's verifying key (hex) — the gate-binding
  peerPubKey:  string;  // the connecting peer's claimed identity (hex)
  aud:         string;  // the target bag URI the peer seeks
}): Uint8Array {
  return canonicalJsonBytes({
    domain:     AUTH_PROOF_DOMAIN,
    nonce:      parts.nonce,
    gatePubKey: parts.gatePubKey,
    peerPubKey: parts.peerPubKey,
    aud:        parts.aud,
  });
}

/**
 * ed25519SignerFromSeed — a bare-Ed25519 signer (32-byte seed → `sign(bytes)=>hex`)
 * for the LIGHT leaf-identity path (operator-peer #actor-parity OP-AP5): a
 * short-lived leaf signs the V3 proof with NO keyhive. Pairs with
 * `buildAuthResponse`/`runPeerHandshake`'s injected `sign`. A signature this
 * produces verifies identically to one from `KH.Signer.memorySignerFromBytes(seed)`
 * against the same verifying key (the @keyhive signer wraps the same key material).
 */
export function ed25519SignerFromSeed(seed: Uint8Array): (bytes: Uint8Array) => Promise<string> {
  return async (bytes) => hex(await ed25519.signAsync(bytes, seed));
}

/** The verifying-key hex a 32-byte seed derives — the pair of `ed25519SignerFromSeed`. */
export async function ed25519VerifyingKeyFromSeed(seed: Uint8Array): Promise<string> {
  return hex(await ed25519.getPublicKeyAsync(seed));
}

/** Verify a hex Ed25519 signature over `bytes` under a hex verifying key. Malformed input reads false, never throws. */
export async function ed25519VerifyHex(sigHex: string, bytes: Uint8Array, verifyingKeyHex: string): Promise<boolean> {
  try { return await ed25519.verifyAsync(hexToBytes(sigHex), bytes, hexToBytes(verifyingKeyHex)); } catch { return false; }
}

/**
 * verifyAuthProof — the VERIFIER half of V3 proof-of-possession: the counterpart
 * to `buildAuthResponse`. Recompute the gate-bound proof (authProofBytes) and
 * check the peer's Ed25519 signature against its claimed verifying key.
 *
 * CONSERVATIVE-CALLER LAW: this helper checks a signature over the bytes handed to
 * it — it does NOT decide what to trust. The keyholder worker (the only place
 * that holds the peer's real key and the gate's own key) MUST pass TRUSTED values,
 * never wire-claimed ones: `gatePubKey` = the verifier's OWN verifying key (so the
 * proof only clears if the peer signed for THIS gate — anti-relay), `peerPubKey` =
 * the verifying-key suffix of the ContactCard-derived Identifier (so the proof only
 * clears for the card actually presented). `nonce` = the gate-issued challenge value
 * the verifier remembers. If a peer signed for a different gate or claimed a key it
 * does not hold, the recomputed bytes diverge and the signature fails. NEVER feed
 * this the `peerPubKey`/`gatePubKey` a peer asserts on the wire.
 *
 * The verifier reads no clock: the gate's single-use nonce is the freshness. Uses
 * `verifyAsync`, which needs no global hash injection (@noble/ed25519 v3).
 */
export async function verifyAuthProof(parts: {
  nonce:       string;
  gatePubKey:  string;
  peerPubKey:  string;  // raw ed25519 verifying-key hex (64 chars) — the key the sig verifies against
  aud:         string;
  sig:         string;  // ed25519 signature hex (128 chars)
}): Promise<{ ok: boolean; reason?: string }> {
  const evidence = await evaluateAuthProof(parts);
  return evidence.cryptographicallyValid
    ? { ok: true }
    : { ok: false, ...(evidence.reason ? { reason: evidence.reason } : {}) };
}

/**
 * Read daemon proof evidence. The nonce, gate binding, peer key and exact audience are covered by
 * `authProofBytes`; the gate's single-use nonce is the freshness, so a signature that verifies reads
 * `checked-valid`. This relation has no separate method/resource fields and makes no claim about them.
 */
export async function evaluateAuthProof(parts: {
  nonce: string;
  gatePubKey: string;
  peerPubKey: string;
  aud: string;
  sig: string;
}): Promise<DaemonProofEvidence> {
  const verdict = (state: DaemonProofEvidence["state"], cryptographicallyValid: boolean, reason?: string): DaemonProofEvidence => ({
    relation: "daemon-proof-of-possession",
    state,
    cryptographicallyValid,
    ...(reason ? { reason } : {}),
  });
  // Shape guards — reject malformed key/sig material before touching crypto.
  if (!/^[0-9a-fA-F]{64}$/.test(parts.peerPubKey))  return verdict("malformed", false, "peerPubKey not 32-byte hex");
  if (!/^[0-9a-fA-F]{128}$/.test(parts.sig))        return verdict("malformed", false, "sig not 64-byte hex");

  const proof = authProofBytes({
    nonce:      parts.nonce,
    gatePubKey: parts.gatePubKey,
    peerPubKey: parts.peerPubKey,
    aud:        parts.aud,
  });
  let ok = false;
  try {
    ok = await ed25519.verifyAsync(hexToBytes(parts.sig), proof, hexToBytes(parts.peerPubKey));
  } catch (err) {
    return verdict("malformed", false, err instanceof Error ? err.message : "ed25519 verify threw");
  }
  if (!ok) return verdict("rejected", false, "signature mismatch");
  return verdict("checked-valid", true);
}

// ── Leaf proof of possession over what a socket presents ──────────────────────────────────────────

/**
 * The CID of one presentation arm — what its leaf proof binds. An admit arm names its act CID; every other arm
 * names the digest of its own kind-tagged content (its leaf proof left out), so no two arms' CIDs collide.
 */
export function presentedCid(presented: UnsignedPresented | Presented): string {
  if (presented.kind === "admit") return carriageEntryActCid(presented.admit);
  const { leafProof: _omit, ...content } = presented as Presented & { leafProof?: string };
  return sha256HexBytesSync(canonicalJsonBytes(content));
}

/** The leaf that signs a presentation's proof — the key the presentation stands as. */
export function presentedSigner(presented: UnsignedPresented | Presented): string {
  if (presented.kind === "admit") return presented.admit.nym.toLowerCase();
  return "";
}

/**
 * leafProofBytes — the canonical bytes a presenting LEAF signs to bind what it presents to ONE socket:
 * `PRESENTED_LEAF_PROOF_DOMAIN`, the gate's challenge `nonce`, the gate's verifying key, the presenting VESSEL
 * key (the key the V3 proof proves on the same socket), and the presentation's CID. No clock rides it — the
 * gate's single-use nonce is the freshness — and no root rides it.
 */
export function leafProofBytes(parts: {
  nonce:        string;
  gatePubKey:   string;
  vesselKey:    string;
  presentedCid: string;
}): Uint8Array {
  return canonicalJsonBytes({
    domain:       PRESENTED_LEAF_PROOF_DOMAIN,
    nonce:        parts.nonce,
    gatePubKey:   parts.gatePubKey.toLowerCase(),
    vesselKey:    parts.vesselKey.toLowerCase(),
    presentedCid: parts.presentedCid,
  });
}

/** Sign the leaf proof for `presented` on one socket. `sign` is the presenting LEAF's own signer. */
export async function signLeafProof(parts: {
  presented:  UnsignedPresented | Presented;
  nonce:      string;
  gatePubKey: string;
  vesselKey:  string;
  sign:       (bytes: Uint8Array) => Promise<string> | string;
}): Promise<string> {
  return parts.sign(leafProofBytes({
    nonce: parts.nonce, gatePubKey: parts.gatePubKey, vesselKey: parts.vesselKey,
    presentedCid: presentedCid(parts.presented),
  }));
}

/** Attach the presenting leaf's proof over one socket to an unsigned presentation. */
export async function signPresented(parts: {
  presented:  UnsignedPresented;
  nonce:      string;
  gatePubKey: string;
  vesselKey:  string;
  sign:       (bytes: Uint8Array) => Promise<string> | string;
}): Promise<Presented> {
  return { ...parts.presented, leafProof: await signLeafProof(parts) } as Presented;
}

/**
 * verifyLeafProof — does the presenting leaf bind what it presents to THIS socket? Pure; never throws.
 *
 * The caller passes the values IT holds for the socket: the nonce its gate issued, its own gate key, and the
 * vessel key the V3 proof proved. The signature must verify under the presentation's own leaf over those
 * values and the presentation's CID, so a proof minted for another nonce, gate, vessel or presentation, or by
 * any other hand (a root included), reads false. It answers possession only; whether the presentation holds
 * is the sorter's.
 */
export async function verifyLeafProof(parts: {
  presented:  Presented;
  nonce:      string;
  gatePubKey: string;
  vesselKey:  string;
}): Promise<boolean> {
  const { presented } = parts;
  const sig = presented?.leafProof;
  if (typeof sig !== "string" || !/^[0-9a-fA-F]{128}$/.test(sig)) return false;
  if (!/^[0-9a-fA-F]{64}$/.test(parts.gatePubKey) || !/^[0-9a-fA-F]{64}$/.test(parts.vesselKey)) return false;
  if (typeof parts.nonce !== "string" || parts.nonce.length === 0) return false;
  let cid: string;
  let signer: string;
  try { cid = presentedCid(presented); signer = presentedSigner(presented); } catch { return false; }
  if (!/^[0-9a-f]{64}$/.test(signer)) return false;
  return ed25519VerifyHex(sig, leafProofBytes({
    nonce: parts.nonce, gatePubKey: parts.gatePubKey, vesselKey: parts.vesselKey, presentedCid: cid,
  }), signer);
}

/**
 * buildAuthResponse — the PEER half of V3 proof-of-possession: given the
 * challenge parts + the peer's contactCard + a `sign` fn (Ed25519 over bytes →
 * hex), produce the signed `lar:auth`. The signature commits to the GATE-BOUND
 * proof (authProofBytes), so a relay cannot replay it to a different gate.
 *
 * `sign` stays injected — no keyhive dep enters mesh. The CLI/peer sources it from
 * the operator signer (Signer.trySign / memorySignerFromBytes over the operator
 * seed). Pairs with authProofBytes (the gate's what-to-sign).
 *
 * V3 integration runs live: runPeerHandshake (lar-ws-client-adapter) boots the
 * signer and runs challenge→response before Automerge sync; the gate
 * (daemon-auth-gate) issues gatePubKey on lar:challenge and verifies this sig via
 * the worker shore (verifyAuthProof).
 */
export async function buildAuthResponse(parts: {
  contactCard: string;
  nonce:       string;
  gatePubKey:  string;
  peerPubKey:  string;
  aud:         string;
  /** The leaf's own fresh nonce the gate's signed verdict must commit to. */
  leafNonce:   string;
  sign:        (bytes: Uint8Array) => Promise<string> | string;
  /** OPTIONAL device-delegation edge ridden alongside the proof. */
  edge?:       DeviceDelegationTiddler;
  /** OPTIONAL presentation (one arm, its leaf proof signed), outside the signed proof bytes. Never beside `edge`. */
  presented?:  Presented;
}): Promise<LarAuthMsg> {
  if (parts.presented && parts.edge) {
    throw new Error("a presented leaf travels with no root-signed edge — one socket, one face");
  }
  const proof = authProofBytes({
    nonce:      parts.nonce,
    gatePubKey: parts.gatePubKey,
    peerPubKey: parts.peerPubKey,
    aud:        parts.aud,
  });
  const sig = await parts.sign(proof);
  return {
    type:        "lar:auth",
    contactCard: parts.contactCard,
    nonce:       parts.nonce,
    leafNonce:   parts.leafNonce,
    sig,
    ...(parts.edge ? { edge: parts.edge } : {}),
    ...(parts.presented ? { presented: parts.presented } : {}),
  };
}

/**
 * PeerHandshake — the shore the platform-blind handshake composes over. NOT an
 * adapter tower: a small data descriptor + injected functions. The TRANSPORT
 * (recv/send) injects per platform (node isomorphic-ws · browser WebSocket); the
 * IDENTITY (contactCard/peerPubKey/sign) injects from the isomorphic keyhive
 * provider + operator signer. One core, composed everywhere — no per-vessel fork.
 */
export interface PeerHandshake {
  /** Await the next wire message (the platform WS message, promisified). */
  recv:        () => Promise<unknown>;
  /** Send a wire message (the platform WS send + JSON encode). */
  send:        (msg: LarAuthMsg) => void;
  /** This peer's self-certifying ContactCard JSON. */
  contactCard: string;
  /** This peer's verifying-key hex (its claimed identity). */
  peerPubKey:  string;
  /** The gate's verifying-key hex (the gate-binding the proof commits to). */
  gatePubKey:  string;
  /** The target bag URI the peer seeks. */
  aud:         string;
  /** Ed25519 sign over bytes → hex (operator signer / Signer.trySign). */
  sign:        (bytes: Uint8Array) => Promise<string> | string;
  /** OPTIONAL device-delegation edge — a device-admitted leaf rides its edge to the gate. */
  edge?:       DeviceDelegationTiddler;
  /** OPTIONAL presentation — one arm, unsigned until the challenge arrives, never beside a root-signed edge. */
  presented?:  UnsignedPresented;
  /** The presenting LEAF's signer, used for the leaf proof over the challenge and nothing else. Without it a
   *  presentation binds to no socket and is not sent. */
  leafSign?:   (bytes: Uint8Array) => Promise<string> | string;
}

/**
 * runPeerHandshake — the platform-blind peer half of V3, lifted ABOVE any vessel: receive lar:challenge → sign
 * the gate-bound proof (and the presenting leaf's proof over the same challenge) → send lar:auth → await the
 * verdict. Node, browser, and the CLI all compose this one flow with their own transport + the shared keyhive
 * identity. Resolves the auth verdict; the caller proceeds to Automerge sync only on `{ ok: true }`.
 *
 * A passing verdict counts only when the PINNED gate key signed it over this leaf's own fresh nonce
 * (`verifyAuthOk`). A gate that refuses answers NOTHING, so a `recv` that yields nothing (the socket closed or
 * was cut) reads as "no challenge" before the challenge and "no answer" after the lar:auth — never a hang, and
 * never a reason the gate did not give.
 */
export async function runPeerHandshake(h: PeerHandshake): Promise<{ ok: true; nonce: string } | { ok: false; reason: string }> {
  const challenge = await h.recv();
  if (!isLarChallengeMsg(challenge)) return { ok: false, reason: "no challenge" };
  // The leaf proof binds the presentation to THIS challenge, THIS gate and THIS vessel key.
  const presented: Presented | undefined = h.presented && h.leafSign
    ? await signPresented({
        presented: h.presented, nonce: challenge.nonce, gatePubKey: h.gatePubKey, vesselKey: h.peerPubKey, sign: h.leafSign,
      })
    : undefined;
  const leafNonce = mintLeafNonce();
  const auth = await buildAuthResponse({
    contactCard: h.contactCard,
    nonce:       challenge.nonce,
    gatePubKey:  h.gatePubKey,
    peerPubKey:  h.peerPubKey,
    aud:         h.aud,
    leafNonce,
    sign:        h.sign,
    ...(h.edge ? { edge: h.edge } : {}),
    ...(presented ? { presented } : {}),
  });
  h.send(auth);
  const verdict = await h.recv();
  if (isLarAuthOkMsg(verdict)) {
    const proven = await verifyAuthOk({
      nonce: challenge.nonce, leafNonce, gatePubKey: h.gatePubKey, peerPubKey: h.peerPubKey, aud: h.aud, sig: verdict.sig,
    });
    return proven ? { ok: true, nonce: challenge.nonce } : { ok: false, reason: "the verdict carries no signature of the pinned gate key" };
  }
  return { ok: false, reason: "no answer" };
}

/**
 * LeafIdentity — the LIGHT sovereign identity a leaf actor carries to the peer gate: a cached
 * self-certifying ContactCard + a bare-Ed25519 signer (no keyhive). Platform-blind: the node loads
 * it from disk (`loadLeafIdentity`), the browser builds it from its own device seed + founding card.
 * Lifted here (from node) so both vessels — and the isomorphic LarWSClientAdapter — share one core.
 */
export interface LeafIdentity {
  /** The cached self-certifying ContactCard JSON, re-presented each handshake. */
  contactCard: string;
  /** The operator verifying-key hex — the leaf's claimed identity. */
  peerPubKey:  string;
  /** Bare-Ed25519 signer over the operator seed → hex. No keyhive. */
  sign:        (bytes: Uint8Array) => Promise<string>;
  /** OPTIONAL device-delegation edge — a device-admitted leaf presents its edge to admit. A root this vessel
   *  does NOT hold signed it (the fleet slot); a self-founded vessel's own root never signs one onto the wire. */
  edge?:       DeviceDelegationTiddler;
  /** OPTIONAL presentation for the ONE gate this identity dials — never the dialer's whole admit set, and never
   *  beside `edge`. Unsigned; the handshake signs its leaf proof over the challenge. */
  presented?:  UnsignedPresented;
  /** The presenting LEAF's signer, used for the leaf proof alone. */
  leafSign?:   (bytes: Uint8Array) => Promise<string>;
}
