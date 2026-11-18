/**
 * promotion-approval — the seats' approval of ONE promotion: the EXACT BYTES (their hash), the purpose and
 * the surface, signed under the chartered class that surface needs.
 *
 * The ruling (`lar:///ha.ka.ba/lares/docs/stable-founding-road`, "Planes ~ cabal, realm, Nexus"): Kahu
 * drafts in the realm, and publishing to `@crossroads` stands as a separate, recorded promotion act.
 * //Promotion approves the EXACT BYTES (hash, purpose, surface) under a threshold the charter sets, with a
 * higher bar for charter, admission and trust-root changes. A CID, a clerk's edit or an active persona never
 * stands in for collective approval.// The seats and their classes read at
 * `lar:///ha.ka.ba/lararium/mesh/kahu#/seed-and-nexus` and ./chartered-classes.
 *
 * Each clause of that ruling meets one refusal here:
 *   · a CID never stands in — the hash slot takes only the `ni:///sha-256;…` of the bytes themselves, and a
 *     bare hex digest, a `bafy…` CID or an automerge url refuses `a-cid-is-no-approval`;
 *   · a clerk's edit never stands in — verification re-hashes the presented bytes, and one moved byte
 *     refuses `bytes-differ`;
 *   · an active persona never stands in — only a key seated under the approval's charter epoch signs or
 *     counts (`signer-not-seated` at signing; zero at counting);
 *   · the higher bar holds — an approval whose class fails the surface's need refuses
 *     `class-below-surface`, at opening and again at verification.
 *
 * WHAT IT DECIDES: whether a set of seat signatures carries the collective's authority for these exact
 * bytes, this purpose and this surface under one charter epoch. WHAT IT NEVER DECIDES: what crossed, from
 * where, or by whose hand; the promotion receipt (`lares-cli/src/promotion-receipt.ts`) records that, and
 * this module touches it not at all. It holds no key, reads no clock and keeps no store: each signer arrives
 * injected. No promotion rides the emergency power (a house reading: emergency covers its own narrow acts
 * alone), so an emergency approval refuses `class-below-surface` on every surface a promotion names.
 */
import { PROMOTION_APPROVAL_DOMAIN } from "./domains.js";
import { canonicalJsonBytes, niUriSha256FromHex, sha256HexBytesSync } from "./crypto.js";
import type { KahuQuorumSeats, QuorumSignature } from "./kapae-antigen.js";
import { charteredClassTable, classCovers, classThreshold, countSeatedSignatures, requiredClassFor } from "./chartered-classes.js";
import { verifyEd25519 } from "./ed25519-door.js";

/** The classes an approval may carry. Revocation rides its own act, never a promotion. */
export type ApprovalClass = "ordinary" | "high-impact" | "emergency";

/** One promotion approval. The signatures ride OUTSIDE the signed bytes. */
export interface PromotionApproval {
  readonly kind:         typeof PROMOTION_APPROVAL_DOMAIN;
  /** `ni:///sha-256;…` of the exact bytes approved. */
  readonly bytesHash:    string;
  readonly purpose:      string;
  readonly surface:      string;
  readonly actClass:     ApprovalClass;
  /** The charter epoch whose seats sign. */
  readonly sealEpochCid: string;
  readonly signatures:   readonly QuorumSignature[];
}

export type PromotionApprovalVerdict =
  | { readonly ok: true;  readonly counted: number; readonly threshold: number; readonly reviewOwed: boolean }
  | { readonly ok: false; readonly reason: PromotionApprovalRefusal; readonly counted?: number; readonly threshold?: number };

export type PromotionApprovalRefusal =
  | "malformed-approval"
  | "a-cid-is-no-approval"
  | "bytes-differ"
  | "class-below-surface"
  | "wrong-charter-epoch"
  | "no-class-table"
  | "below-class-threshold";

/** Purpose and surface each carry at most this many characters. */
export const PROMOTION_FIELD_CAP = 512;

const APPROVAL_CLASSES: readonly ApprovalClass[] = ["ordinary", "high-impact", "emergency"];
const NI_SHA256 = /^ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}$/;

/** The `ni:///sha-256;…` name of the exact bytes. */
export function exactBytesHash(bytes: Uint8Array): string {
  return niUriSha256FromHex(sha256HexBytesSync(bytes));
}

/** The canonical bytes the seats sign: every field but the signatures, sorted-key stable. */
export function promotionApprovalBytes(unsigned: Omit<PromotionApproval, "signatures"> | PromotionApproval): Uint8Array {
  const { kind, bytesHash, purpose, surface, actClass, sealEpochCid } = unsigned;
  return canonicalJsonBytes({ kind, bytesHash, purpose, surface, actClass, sealEpochCid });
}

const fieldHolds = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= PROMOTION_FIELD_CAP;

/**
 * Open an unsigned approval over `bytes`. Throws `class-below-surface` when the class fails the surface's
 * need, and throws on a blank or over-long purpose or surface, an unknown class, or a roster that sets no
 * class table (house reading: an approval opened under a torn roster names an epoch nobody can verify).
 */
export function openPromotionApproval(args: {
  readonly bytes: Uint8Array; readonly purpose: string; readonly surface: string;
  readonly actClass: ApprovalClass; readonly roster: KahuQuorumSeats;
}): PromotionApproval {
  const { bytes, purpose, surface, actClass, roster } = args;
  if (!(bytes instanceof Uint8Array))           throw new TypeError("promotion-approval: bytes-required");
  if (!fieldHolds(purpose))                     throw new TypeError(`promotion-approval: purpose-blank-or-over-${PROMOTION_FIELD_CAP}`);
  if (!fieldHolds(surface))                     throw new TypeError(`promotion-approval: surface-blank-or-over-${PROMOTION_FIELD_CAP}`);
  if (!APPROVAL_CLASSES.includes(actClass))     throw new TypeError("promotion-approval: unknown-class");
  if (!classCovers(actClass, requiredClassFor(surface))) throw new Error("promotion-approval: class-below-surface");
  if (charteredClassTable(roster) === null)     throw new Error("promotion-approval: no-class-table");
  return {
    kind: PROMOTION_APPROVAL_DOMAIN, bytesHash: exactBytesHash(bytes), purpose, surface, actClass,
    sealEpochCid: roster.sealEpochCid, signatures: [],
  };
}

/**
 * Add seat signatures, de-duplicated by signer (a seat whose carried signature verifies keeps it; a carried
 * signature that fails, or names no seat, drops). Throws
 * `signer-not-seated` for a signer outside the roster: an active persona never signs an approval. Throws
 * `wrong-charter-epoch` when the roster names another epoch than the approval.
 */
export async function signPromotionApproval(
  approval: PromotionApproval,
  signers: ReadonlyArray<{ readonly signer: string; readonly sign: (bytes: Uint8Array) => Promise<string> }>,
  roster: KahuQuorumSeats,
): Promise<PromotionApproval> {
  if (approval.sealEpochCid !== roster.sealEpochCid) throw new Error("promotion-approval: wrong-charter-epoch");
  const seats = new Set(roster.keys);
  for (const s of signers) if (!seats.has(s.signer)) throw new Error("promotion-approval: signer-not-seated");
  const bytes = promotionApprovalBytes(approval);
  // Only a signature that verifies holds its seat's place: a forged or torn one carried in drops, so no carrier
  // wedges a seat out of its own approval.
  const signatures: QuorumSignature[] = approval.signatures.filter((s) => seats.has(s.signer) && verifyEd25519(s.sig, bytes, s.signer));
  const signed = new Set(signatures.map((s) => s.signer));
  for (const s of signers) {
    if (signed.has(s.signer)) continue;
    signed.add(s.signer);
    signatures.push({ signer: s.signer, sig: await s.sign(bytes) });
  }
  return { ...approval, signatures };
}

/** Coerce an unknown value into an approval, keeping its known fields alone; null on a torn shape. */
export function readPromotionApproval(value: unknown): PromotionApproval | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.kind !== PROMOTION_APPROVAL_DOMAIN) return null;
  if (typeof v.bytesHash !== "string" || v.bytesHash.length === 0) return null;
  if (!fieldHolds(v.purpose) || !fieldHolds(v.surface)) return null;
  if (typeof v.actClass !== "string" || !APPROVAL_CLASSES.includes(v.actClass as ApprovalClass)) return null;
  if (typeof v.sealEpochCid !== "string" || v.sealEpochCid.length === 0) return null;
  if (!Array.isArray(v.signatures)) return null;
  const signatures: QuorumSignature[] = [];
  for (const s of v.signatures as unknown[]) {
    if (s === null || typeof s !== "object") return null;
    const { signer, sig } = s as Record<string, unknown>;
    if (typeof signer !== "string" || typeof sig !== "string") return null;
    signatures.push({ signer, sig });
  }
  return {
    kind: PROMOTION_APPROVAL_DOMAIN, bytesHash: v.bytesHash, purpose: v.purpose, surface: v.surface,
    actClass: v.actClass as ApprovalClass, sealEpochCid: v.sealEpochCid, signatures,
  };
}

/**
 * Verify an approval against the bytes presented and the epoch's seats. Never throws. Refusals read in
 * order: a torn shape, a CID in the hash slot, bytes that hash elsewhere, a class below the surface, another
 * epoch's roster, a roster setting no table, and too few distinct seated signatures (carrying
 * counted/threshold, so a partial reads its progress).
 */
export function verifyPromotionApproval(args: {
  readonly approval: unknown; readonly bytes: Uint8Array; readonly roster: KahuQuorumSeats;
}): PromotionApprovalVerdict {
  try {
    const approval = readPromotionApproval(args.approval);
    if (approval === null) return { ok: false, reason: "malformed-approval" };
    if (!NI_SHA256.test(approval.bytesHash)) return { ok: false, reason: "a-cid-is-no-approval" };
    if (!(args.bytes instanceof Uint8Array) || exactBytesHash(args.bytes) !== approval.bytesHash) {
      return { ok: false, reason: "bytes-differ" };
    }
    if (!classCovers(approval.actClass, requiredClassFor(approval.surface))) return { ok: false, reason: "class-below-surface" };
    const roster = args.roster;
    if (!roster || roster.sealEpochCid !== approval.sealEpochCid) return { ok: false, reason: "wrong-charter-epoch" };
    const table = charteredClassTable(roster);
    if (table === null) return { ok: false, reason: "no-class-table" };
    const threshold = classThreshold(table, approval.actClass);
    if (threshold === null) return { ok: false, reason: "no-class-table" };
    const counted = countSeatedSignatures(promotionApprovalBytes(approval), approval.signatures, roster);
    if (counted < threshold) return { ok: false, reason: "below-class-threshold", counted, threshold };
    return { ok: true, counted, threshold, reviewOwed: approval.actClass === "emergency" ? table.emergency.reviewOwed : false };
  } catch {
    return { ok: false, reason: "malformed-approval" };
  }
}
