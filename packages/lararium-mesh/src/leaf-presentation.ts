/**
 * leaf-presentation — the shapes a dial presents and carries: the presentation slot a sealed first flight holds
 * (an admit with its lineage, a hosting grant, or an invite token being redeemed), the session message a sealed
 * channel's `session` frame carries, and the light leaf identity a leaf dials with.
 *
 * Nothing here proves a socket. Possession is the gate's (`face-dial`, `face-gate`: a Noise IK first flight, a signed
 * finish and a signed verdict); these are shapes, read structurally, and every arm grants nothing on arrival.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/face-proof
 */

import type { DeviceDelegationTiddler } from "./device-delegation.js";
import { isRollAnchor, type CarriageEntry, type PresentedLineageAct } from "./carriage-registry.js";
import { isHostingGrant, isInviteToken, type HostingGrant, type InviteToken } from "./hosting.js";
import { CARRIAGE_ENTRY_DOMAIN } from "./domains.js";

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
