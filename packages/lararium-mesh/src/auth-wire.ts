/**
 * auth-wire — what survives of the retired pre-sync handshake: the shapes a presentation is read in, the session
 * message a sealed channel carries, the bare Ed25519 helpers and the light leaf identity.
 *
 * THE HANDSHAKE IS GONE. The challenge, the auth and auth-ok frames, the V3 proof, the leaf proof over a socket's
 * nonce and the gate that spoke them retired at the socket cutover (`face-dial`, `face-gate`: a Noise IK first
 * flight, a signed finish and a signed verdict). Nothing here proves a socket; possession is the gate's, and
 * `tests/gate-cutover-reach.test.ts` (NO_OLD_WIRE_PRODUCTION_CALLER) reads red if a source speaks one frame of it again.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/auth-wire
 */

import * as ed25519 from "@noble/ed25519";
import { hex } from "./crypto.js";
import type { DeviceDelegationTiddler } from "./device-delegation.js";
import { isRollAnchor, type CarriageEntry, type PresentedLineageAct } from "./carriage-registry.js";
import { isHostingGrant, isInviteToken, type HostingGrant, type InviteToken } from "./hosting.js";
import { CARRIAGE_ENTRY_DOMAIN } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";

/**
 * PresentedAdmit — the subject's own quorum-signed carriage ADMIT with the admit's causal LINEAGE: the counted
 * acts it cites for this nym and epoch, and — for an admit at an epoch the charter has since rolled past — the roll
 * anchors that carry it to the head. The admit and lineage are public bytes: every entry already stands as a signed
 * act on the Nexus's carriage board. It grants nothing on arrival — the receiver folds the admit against its own
 * deny board before reading any relation.
 */
export interface PresentedAdmit {
  readonly admit:      CarriageEntry;
  /** The admit's causal acts at its own epoch, and the roll anchors carrying that epoch to the head. */
  readonly lineage:    readonly PresentedLineageAct[];
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
    (x["contractSig"] === undefined || isQuorumSignatureShape(x["contractSig"])) &&
    (x["carriageCommit"] === undefined || (x["action"] === "admit" && typeof x["carriageCommit"] === "string" && /^[0-9a-f]{64}$/.test(x["carriageCommit"])));
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
  const nym = admit.nym.toLowerCase();
  return lineage.every((entry) => isRollAnchor(entry) || (
    isCarriageEntryShape(entry) &&
    (entry.action === "admit" || entry.action === "revoke") &&
    entry.nym.toLowerCase() === nym &&
    entry.sealEpochCid === admit.sealEpochCid));
}

/** A presented admit as one arm of the presentation slot. */
export type PresentedAdmitArm = { readonly kind: "admit" } & PresentedAdmit;

/** A WALKER's arm: the hosting grant this hearth issued it. */
export interface PresentedGrantArm {
  readonly kind:       "grant";
  readonly grant:      HostingGrant;
}

/**
 * A NEWCOMER's arm: an invite token redeemed at this hearth's gate, the claim the newcomer derived for it, and
 * the per-Nexus leaf the grant will name. The Nexus rides beside the token because the token names none.
 */
export interface PresentedTokenArm {
  readonly kind:       "token";
  readonly nexusAid:   string;
  readonly token:      InviteToken;
  readonly claim:      string;
  readonly leaf:       string;
}

/** THE PRESENTATION SLOT — at most one per socket: an admit, a hosting grant, or a token being redeemed. */
export type Presented = PresentedAdmitArm | PresentedGrantArm | PresentedTokenArm;

/** A presentation before a dial holds what it rides on. The arms carry no proof of their own, so it is the presentation itself. */
export type UnsignedPresented = Presented;

const KEY_HEX_RE    = /^[0-9a-f]{64}$/;

/** Structural guard for the presentation slot. Shape only. */
export function isPresented(v: unknown): v is Presented {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const x = v as Record<string, unknown>;
  switch (x["kind"]) {
    case "admit": return isPresentedAdmit(v);
    case "grant": return isHostingGrant(x["grant"]);
    case "token":
      return typeof x["nexusAid"] === "string" && (x["nexusAid"] as string).length > 0 && isInviteToken(x["token"]) &&
        typeof x["claim"] === "string" && KEY_HEX_RE.test(x["claim"] as string) &&
        typeof x["leaf"] === "string" && KEY_HEX_RE.test(x["leaf"] as string);
    default: return false;
  }
}

/**
 * One message of the authenticated session, carried as JSON bytes in a sealed channel's `session` frame. `kind`
 * names the protocol riding the session; each side routes by it and reads `body` as untrusted input.
 */
export interface LarSessionMsg {
  type: "lar:session";
  kind: string;
  body: unknown;
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

export function mkLarSessionMsg(kind: string, body: unknown): LarSessionMsg {
  return { type: "lar:session", kind, body };
}

/** A bare-Ed25519 signer (32-byte seed → `sign(bytes)=>hex`) for the light leaf-identity path: no keyhive. */
export function ed25519SignerFromSeed(seed: Uint8Array): (bytes: Uint8Array) => Promise<string> {
  return async (bytes) => hex(await ed25519.signAsync(bytes, seed));
}

/** The verifying-key hex a 32-byte seed derives — the pair of `ed25519SignerFromSeed`. */
export async function ed25519VerifyingKeyFromSeed(seed: Uint8Array): Promise<string> {
  return hex(await ed25519.getPublicKeyAsync(seed));
}

/** Verify a hex Ed25519 signature over `bytes` under a hex verifying key. Malformed input reads false, never throws. */
export async function ed25519VerifyHex(sigHex: string, bytes: Uint8Array, verifyingKeyHex: string): Promise<boolean> {
  try { return verifyEd25519(sigHex, bytes, verifyingKeyHex); } catch { return false; }
}

/**
 * LeafIdentity — the LIGHT sovereign identity a leaf actor carries: a cached self-certifying ContactCard + a
 * bare-Ed25519 signer (no keyhive). Platform-blind: the node loads it from disk (`loadLeafIdentity`), the browser
 * builds it from its own device seed + founding card.
 */
export interface LeafIdentity {
  /** The cached self-certifying ContactCard JSON. */
  contactCard: string;
  /** The operator verifying-key hex — the leaf's claimed identity. */
  peerPubKey:  string;
  /** Bare-Ed25519 signer over the operator seed → hex. No keyhive. */
  sign:        (bytes: Uint8Array) => Promise<string>;
  /** OPTIONAL device-delegation edge — a device-admitted leaf presents its edge to admit. */
  edge?:       DeviceDelegationTiddler;
  /** OPTIONAL presentation for the ONE gate this identity dials — never the dialer's whole admit set, and never beside `edge`. */
  presented?:  UnsignedPresented;
  /** The presenting LEAF's signer. */
  leafSign?:   (bytes: Uint8Array) => Promise<string>;
}
