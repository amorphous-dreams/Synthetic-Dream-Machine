/**
 * nexus-promote — the door that carries a PROMOTION APPROVAL between seats on separate vessels.
 *
 * The ruling (stable-founding-road, "Planes ~ cabal, realm, Nexus"): promotion approves the EXACT BYTES
 * (hash, purpose, surface) under a threshold the charter sets, with a higher bar for charter, admission and
 * trust-root changes. The pure law reads in mesh (`promotion-approval`, `chartered-classes`); this door only
 * hands seats their pen.
 *
 * THREE ACTS.
 *   · `runPromoteOpen`  — a vessel reads the file's exact bytes, opens an approval over their hash and signs
 *     with every seat of the charter's head it holds. Short of the class threshold it answers a PARTIAL.
 *   · `runPromoteSign`  — another seat's vessel reads the approval, judges it against its OWN charter head,
 *     and adds the seats it holds. It never needs the bytes. A person confirms the WHOLE signed statement
 *     first: `confirmStatement` names the digest of the approval's signed bytes (bytes hash, purpose, surface,
 *     class and charter epoch), and a statement edited after `open` draws a different digest. Without it the
 *     call only reads.
 *   · `runPromoteCheck` — the verdict over a file's bytes against this vessel's charter head.
 *
 * A PERSON CARRIES THE APPROVAL as text, by any road. A PERSON SIGNS: each signature comes from a seat key
 * this vessel holds as a sealed row, on a person's own command; no active persona signs.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/stable-founding-road
 */
import { readFileSync } from "node:fs";
import {
  openPromotionApproval, signPromotionApproval, verifyPromotionApproval, readPromotionApproval, foundingRoster,
  charteredClassTable, classThreshold, countSeatedSignatures, classCovers, requiredClassFor, promotionApprovalBytes, exactBytesHash, verifyEd25519,
  type ApprovalClass, type KahuQuorumSeats, type PromotionApproval, type PromotionApprovalVerdict,
} from "@lararium/mesh";
import { readNexusDoc } from "../nexus-doc.js";
import { charterHomeFor, primaryNexusAid } from "../carried-set.js";
import { heldSeatSigners } from "../held-quorum.js";

export class PromoteError extends Error {
  constructor(message: string, readonly verdict?: PromotionApprovalVerdict) { super(message); }
}

const NI_SHA256 = /^ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}$/;

/** The roster of the Nexus the door names (or the primary charter's), refusing where this vessel holds no seated charter. */
function rosterOf(sealHome: string, aid?: string): KahuQuorumSeats {
  const wanted = aid ?? primaryNexusAid(sealHome);
  const home = wanted === null ? null : charterHomeFor(sealHome, wanted);
  if (home === null) throw new PromoteError(aid === undefined
    ? "this vessel holds no charter to read seats from."
    : `this vessel holds no charter for the Nexus ${aid}.`);
  const roster = foundingRoster(readNexusDoc(home));
  if (roster.keys.length === 0 || roster.sealEpochCid === "") throw new PromoteError("the charter this door reads seats no verified quorum, so no seat can sign.");
  return roster;
}

function readBytes(file: string): Uint8Array {
  try { return new Uint8Array(readFileSync(file)); }
  catch { throw new PromoteError(`cannot read ${file}.`); }
}

/**
 * The digest a person confirms before a seat signs: the `ni:///sha-256;` name of `promotionApprovalBytes`, the
 * canonical statement every seat signs. It reads in the same form as the bytes hash, so one eye reads both.
 */
export function promotionStatementDigest(approval: PromotionApproval): string {
  return exactBytesHash(promotionApprovalBytes(approval));
}

export interface PromoteOpenResult {
  readonly approval: PromotionApproval;
  /** The statement digest to carry beside the approval; the next seat's person confirms it at `sign`. */
  readonly statement: string;
  readonly verdict:  PromotionApprovalVerdict;
  /** The seats that signed here. */
  readonly signed:   readonly string[];
}

/** Open an approval over a file's exact bytes and sign it with the seats this vessel holds. Writes nothing. */
export async function runPromoteOpen(opts: {
  readonly file: string; readonly purpose: string; readonly surface: string; readonly actClass: ApprovalClass;
  readonly sealHome: string; readonly aid?: string;
}): Promise<PromoteOpenResult> {
  const roster = rosterOf(opts.sealHome, opts.aid);
  const bytes = readBytes(opts.file);
  let opened: PromotionApproval;
  try { opened = openPromotionApproval({ bytes, purpose: opts.purpose, surface: opts.surface, actClass: opts.actClass, roster }); }
  catch (err) { throw new PromoteError(`REFUSED: ${err instanceof Error ? err.message : String(err)}`); }
  const held = heldSeatSigners(roster);
  if (held.length === 0) throw new PromoteError("REFUSED: this vessel holds no seat of the charter's quorum, so it signs no part of an approval.");
  const approval = await signPromotionApproval(opened, held.map((h) => ({ signer: h.verifyingKey, sign: h.sign })), roster);
  return { approval, statement: promotionStatementDigest(approval), verdict: verifyPromotionApproval({ approval, bytes, roster }), signed: held.map((h) => h.verifyingKey) };
}

export interface PromoteSignResult {
  readonly approval: PromotionApproval;
  /** The statement digest of the approval as it stands (unchanged by signing: the signatures ride outside it). */
  readonly statement: string;
  /** The seats this vessel added in this call; empty where the call only read. */
  readonly added:    readonly string[];
  /** Distinct seated signatures that verify over the approval's bytes, and the class threshold. */
  readonly counted:  number;
  readonly threshold: number;
  readonly complete: boolean;
  /** Set where the call only READ: what a confirmed call would do. */
  readonly would?:   "sign";
}

/**
 * Read an approval; then, on a person's confirmation of its whole statement, add the seats this vessel holds.
 * The door judges the approval against THIS vessel's charter head and signs the statement it reads, never the
 * bytes. `confirmStatement` must equal the statement digest; `confirmHash`, where given, must also equal the
 * bytes hash, so a person who names the bytes they approve still has that check.
 */
export async function runPromoteSign(opts: {
  readonly approval: unknown; readonly sealHome: string; readonly aid?: string;
  readonly confirmStatement?: string; readonly confirmHash?: string;
}): Promise<PromoteSignResult> {
  const approval = readPromotionApproval(opts.approval);
  if (approval === null) throw new PromoteError("REFUSED (malformed-approval): that text reads as no approval.", { ok: false, reason: "malformed-approval" });
  if (!NI_SHA256.test(approval.bytesHash)) throw new PromoteError("REFUSED (a-cid-is-no-approval): the hash slot takes only the ni:///sha-256 name of the bytes.", { ok: false, reason: "a-cid-is-no-approval" });
  const roster = rosterOf(opts.sealHome, opts.aid);
  if (approval.sealEpochCid !== roster.sealEpochCid) {
    throw new PromoteError("REFUSED (wrong-charter-epoch): this approval names another charter epoch than this vessel's head.", { ok: false, reason: "wrong-charter-epoch" });
  }
  if (!classCovers(approval.actClass, requiredClassFor(approval.surface))) {
    throw new PromoteError("REFUSED (class-below-surface): the approval's class fails the bar its surface needs.", { ok: false, reason: "class-below-surface" });
  }
  const table = charteredClassTable(roster);
  const threshold = table === null ? null : classThreshold(table, approval.actClass);
  if (threshold === null) throw new PromoteError("REFUSED (no-class-table): the charter sets no class table.", { ok: false, reason: "no-class-table" });
  const countOf = (a: PromotionApproval): number => countSeatedSignatures(promotionApprovalBytes(a), a.signatures, roster);
  const statement = promotionStatementDigest(approval);
  if (opts.confirmHash !== undefined && opts.confirmHash.trim() !== approval.bytesHash) {
    throw new PromoteError("REFUSED: the bytes hash this approval carries differs from the hash the confirmation names — read the approval again before any seat signs.");
  }
  if (opts.confirmStatement !== undefined && opts.confirmStatement.trim() !== statement) {
    throw new PromoteError("REFUSED: the statement this approval carries (bytes, purpose, surface, class or epoch) differs from the one the confirmation names — it moved after it was opened; read it again before any seat signs.");
  }
  if (opts.confirmStatement === undefined) {
    const counted = countOf(approval);
    return { approval, statement, added: [], counted, threshold, complete: counted >= threshold, would: "sign" };
  }
  // Only a seated signature that verifies holds its seat's place: a junk mark carried under a seat never locks it out.
  const approvalBytes = promotionApprovalBytes(approval);
  const seats = new Set(roster.keys);
  const signedAlready = new Set(approval.signatures.filter((s) => seats.has(s.signer) && verifyEd25519(s.sig, approvalBytes, s.signer)).map((s) => s.signer));
  const held = heldSeatSigners(roster, signedAlready);
  if (held.length === 0) throw new PromoteError("REFUSED: every seat this vessel holds already signed this approval, or it holds none — another seat's vessel signs it.");
  const grown = await signPromotionApproval(approval, held.map((h) => ({ signer: h.verifyingKey, sign: h.sign })), roster);
  const counted = countOf(grown);
  return { approval: grown, statement, added: held.map((h) => h.verifyingKey), counted, threshold, complete: counted >= threshold };
}

/** The verdict over a file's exact bytes against this vessel's charter head. Never throws on a torn approval. */
export async function runPromoteCheck(opts: {
  readonly approval: unknown; readonly file: string; readonly sealHome: string; readonly aid?: string;
}): Promise<PromotionApprovalVerdict> {
  return verifyPromotionApproval({ approval: opts.approval, bytes: readBytes(opts.file), roster: rosterOf(opts.sealHome, opts.aid) });
}

/** Verify bytes already read by the crossing against this vessel's current charter head. */
export function runPromoteCheckBytes(opts: {
  readonly approval: unknown; readonly bytes: Uint8Array; readonly sealHome: string; readonly aid?: string;
}): PromotionApprovalVerdict {
  return verifyPromotionApproval({ approval: opts.approval, bytes: opts.bytes, roster: rosterOf(opts.sealHome, opts.aid) });
}
