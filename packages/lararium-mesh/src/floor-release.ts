/**
 * floor-release — the Nexus's ONE public answer: which floor its Kahu cabal released.
 *
 * The ruling (`lar:///ha.ka.ba/lares/docs/stable-founding-road` #/rulings, one owner per registry): the release
 * answer names the Nexus AID, the charter epoch, the release before it and the floor manifest CID. The steward
 * seals it under its own signing domain (`floor-release`), the cabal's promotion approval over the manifest's EXACT
 * BYTES rides attached, and the crossroads board carries it. A herm carries the answer and signs nothing.
 *
 * THE BODY. `canonicalJsonBytes({kind, nexus, epoch, prior, manifest})`, `kind` the signing domain itself. The
 * release's CID names the body's own canonical bytes (sha-256 hex); it keys the board row (`$:/lar/floor-release/<cid>`)
 * and a reader RE-DERIVES it from the body, refusing on a mismatch before any trust.
 *
 * THE TWO HANDS, KEPT APART. The seal authenticates the publisher: a seated Kahu key signed these body bytes under
 * the domain. The approval carries the collective's authority: the seats' signatures at the charter's threshold over
 * the manifest's exact bytes, under the surface `floor-release`, which the chartered-class registry holds at the HIGH-IMPACT
 * bar (`HIGH_IMPACT_SURFACES`: a release moves the floor of every vessel in the Nexus). Neither stands in for the other, and a seal over any
 * other shape (the body's `kind` differs) verifies as nothing here.
 *
 * THE LINEAGE RIDES THE RECORD. A reader needs the roster of the epoch a release names, and it holds no charter. The
 * record therefore carries the charter's public epoch lineage, genesis through the release's own epoch (each epoch
 * reveals its own seats). The lineage is self-certifying: the genesis epoch's address IS the Nexus AID, and every step
 * verifies under the prior roster's threshold (`readSealLineage`), so a carrier that holds the record (a herm, a
 * porch) can drop or lie but never forge. The AID itself rides the reader's own trust line (the hearth floor card).
 *
 * WHAT IT NEVER DECIDES. It holds no key, reads no clock and keeps no store; signers arrive injected, the board
 * arrives as a doc, the manifest's bytes arrive from the caller's CAS. Which release a face ACCEPTS stays a person's
 * act (road `W26`): this module answers only which releases COUNT and where the chain stands.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-slices
 */
import { FLOOR_RELEASE_DOMAIN } from "./domains.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { verifyEd25519 } from "./ed25519-door.js";
import type { KahuQuorumSeats } from "./kapae-antigen.js";
import { openPromotionApproval, readPromotionApproval, signPromotionApproval, verifyPromotionApproval, type PromotionApproval, type PromotionApprovalRefusal } from "./promotion-approval.js";
import { tiddlerText, type LarDoc } from "./base-doc.js";
import { storedLarRecord } from "./stored-record.js";
import { epochCidOf, epochSeats, readSealLineage, type SealEpoch } from "./wax-stamp.js";

export { FLOOR_RELEASE_DOMAIN };

/** The surface and purpose the cabal's promotion approval names for a release. */
export const FLOOR_RELEASE_SURFACE = "floor-release" as const;

/** The tiddler prefix a release lands under on the crossroads board, keyed by the release CID. */
export const FLOOR_RELEASE_PREFIX = "$:/lar/floor-release/" as const;

const HEX64 = /^[0-9a-f]{64}$/;

/** The body a release seals. `prior` names the release CID before it; null opens a Nexus's first. */
export interface FloorReleaseBody {
  readonly kind:     typeof FLOOR_RELEASE_DOMAIN;
  /** The Nexus AID whose cabal releases. */
  readonly nexus:    string;
  /** The charter epoch whose seats seal and approve. */
  readonly epoch:    string;
  readonly prior:    string | null;
  /** The floor manifest's CID (sha-256 hex of its canonical bytes). */
  readonly manifest: string;
}

/** The steward's seal: a seated key's signature over the body's canonical bytes. */
export interface FloorReleaseSeal { readonly signer: string; readonly sig: string }

/** One porch record: the body, its CID, the steward's seal, the cabal's approval of the manifest's exact bytes, and the
 *  charter's public epoch lineage from genesis through the release's own epoch. */
export interface FloorRelease {
  readonly body:     FloorReleaseBody;
  readonly cid:      string;
  readonly seal:     FloorReleaseSeal;
  readonly approval: PromotionApproval;
  readonly lineage:  readonly SealEpoch[];
}

export type LineageRefusal = "lineage-genesis-differs" | "lineage-refused" | "lineage-epoch-differs";

/**
 * The roster a presented lineage proves for `epoch` under the Nexus `nexus`, or the refusal by name. The genesis epoch's
 * address must BE the AID (re-derived from the genesis bytes, never taken from a field), every step must verify under the
 * prior roster's threshold, and the lineage must END at the epoch asked for. `detail` carries the lineage law's own code.
 */
export function rosterOfLineage(nexus: string, lineage: unknown, epoch: string):
  | { readonly ok: true; readonly roster: KahuQuorumSeats }
  | { readonly ok: false; readonly reason: LineageRefusal; readonly detail?: string } {
  try {
    if (!Array.isArray(lineage) || lineage.length === 0) return { ok: false, reason: "lineage-refused", detail: "lineage-empty" };
    const chain = lineage as readonly SealEpoch[];
    const genesis = chain[0]!;
    if (genesis.epochCid !== nexus || epochCidOf(genesis) !== nexus) return { ok: false, reason: "lineage-genesis-differs" };
    const code = readSealLineage(chain);
    if (code !== null) return { ok: false, reason: "lineage-refused", detail: code };
    const last = chain[chain.length - 1]!;
    if (last.epochCid !== epoch) return { ok: false, reason: "lineage-epoch-differs" };
    const seats = epochSeats(last);
    if (seats === null) return { ok: false, reason: "lineage-refused", detail: "seats-unread" };
    return { ok: true, roster: { keys: [...seats.keys], threshold: seats.threshold, sealEpochCid: last.epochCid } };
  } catch {
    return { ok: false, reason: "lineage-refused", detail: "lineage-malformed" };
  }
}

/** The canonical bytes of a body: sorted-key stable, `kind` the signing domain. */
export function floorReleaseBodyBytes(body: FloorReleaseBody): Uint8Array {
  return canonicalJsonBytes({ kind: body.kind, nexus: body.nexus, epoch: body.epoch, prior: body.prior, manifest: body.manifest });
}

/** The release's CID: sha-256 hex of the body's own canonical bytes. */
export function floorReleaseCid(body: FloorReleaseBody): string {
  return sha256HexBytesSync(floorReleaseBodyBytes(body));
}

/** Open a body. THROWS on a manifest or prior that reads as no sha-256 hex, or a blank Nexus or epoch. */
export function openFloorReleaseBody(parts: {
  readonly nexus: string; readonly epoch: string; readonly prior: string | null; readonly manifest: string;
}): FloorReleaseBody {
  if (parts.nexus.trim().length === 0) throw new Error("floor-release refused: no-nexus");
  if (parts.epoch.length === 0) throw new Error("floor-release refused: no-epoch");
  if (!HEX64.test(parts.manifest)) throw new Error("floor-release refused: manifest-unreadable");
  if (parts.prior !== null && !HEX64.test(parts.prior)) throw new Error("floor-release refused: prior-unreadable");
  return { kind: FLOOR_RELEASE_DOMAIN, nexus: parts.nexus.trim(), epoch: parts.epoch, prior: parts.prior, manifest: parts.manifest };
}

/**
 * Assemble a release: the steward's seat signs the body, and the seats sign the approval over the manifest's exact
 * bytes. The roster derives from `lineage` (the charter's epochs, genesis through the release's own); `steward` must stand
 * in it, and `approvers` are the seats held here (more may co-sign the approval elsewhere: a short approval counts nothing
 * at verification). THROWS where the lineage proves no roster for the body's epoch or a signer stands outside it.
 */
export async function assembleFloorRelease(args: {
  readonly body:          FloorReleaseBody;
  readonly lineage:       readonly SealEpoch[];
  readonly manifestBytes: Uint8Array;
  readonly steward:       { readonly signer: string; readonly sign: (bytes: Uint8Array) => Promise<string> };
  readonly approvers:     ReadonlyArray<{ readonly signer: string; readonly sign: (bytes: Uint8Array) => Promise<string> }>;
  readonly approval?:     PromotionApproval;
}): Promise<FloorRelease> {
  const { body, lineage, manifestBytes } = args;
  const proven = rosterOfLineage(body.nexus, lineage, body.epoch);
  if (!proven.ok) throw new Error(`floor-release refused: ${proven.reason}${proven.detail ? ` (${proven.detail})` : ""}`);
  const roster = proven.roster;
  if (!roster.keys.includes(args.steward.signer)) throw new Error("floor-release refused: steward-not-seated");
  if (sha256HexBytesSync(manifestBytes) !== body.manifest) throw new Error("floor-release refused: manifest-bytes-differ");
  const opened = args.approval ?? openPromotionApproval({
    bytes: manifestBytes, purpose: FLOOR_RELEASE_SURFACE, surface: FLOOR_RELEASE_SURFACE, actClass: "high-impact", roster,
  });
  const approval = await signPromotionApproval(opened, args.approvers, roster);
  const sig = await args.steward.sign(floorReleaseBodyBytes(body));
  return { body, cid: floorReleaseCid(body), seal: { signer: args.steward.signer, sig }, approval, lineage: [...lineage] };
}

/** Coerce an unknown value into a release at its exact shape, or null. Verifies nothing. */
export function readFloorRelease(value: unknown): FloorRelease | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const b = v["body"], s = v["seal"];
  if (b === null || typeof b !== "object" || Array.isArray(b) || s === null || typeof s !== "object" || Array.isArray(s)) return null;
  const body = b as Record<string, unknown>, seal = s as Record<string, unknown>;
  if (body["kind"] !== FLOOR_RELEASE_DOMAIN) return null;
  if (typeof body["nexus"] !== "string" || body["nexus"].length === 0) return null;
  if (typeof body["epoch"] !== "string" || body["epoch"].length === 0) return null;
  if (body["prior"] !== null && (typeof body["prior"] !== "string" || !HEX64.test(body["prior"]))) return null;
  if (typeof body["manifest"] !== "string" || !HEX64.test(body["manifest"])) return null;
  if (typeof v["cid"] !== "string") return null;
  if (typeof seal["signer"] !== "string" || typeof seal["sig"] !== "string") return null;
  const approval = readPromotionApproval(v["approval"]);
  if (approval === null) return null;
  if (!Array.isArray(v["lineage"])) return null;
  return {
    body: { kind: FLOOR_RELEASE_DOMAIN, nexus: body["nexus"], epoch: body["epoch"], prior: body["prior"] as string | null, manifest: body["manifest"] },
    cid: v["cid"], seal: { signer: seal["signer"], sig: seal["sig"] }, approval, lineage: v["lineage"] as SealEpoch[],
  };
}

export type FloorReleaseRefusal =
  | "malformed-release"
  | "cid-differs"
  | "foreign-nexus"
  | LineageRefusal
  | "steward-not-seated"
  | "steward-seal-fails"
  | "manifest-bytes-differ"
  | "approval-wrong-surface"
  | `approval-${PromotionApprovalRefusal}`;

export type FloorReleaseVerdict =
  | { readonly ok: true;  readonly release: FloorRelease; readonly counted: number; readonly threshold: number }
  | { readonly ok: false; readonly reason: FloorReleaseRefusal; readonly detail?: string };

/**
 * Verify a release. Never throws. The order reads cheapest trust first and refuses BEFORE any trust: the shape, the
 * CID re-derived from the body (and the board key it rode under, when given), the Nexus, the charter epoch, the
 * steward's seal over the body's bytes, then the cabal's approval over the manifest's exact bytes.
 */
export function verifyFloorRelease(args: {
  readonly record:         unknown;
  /** The board key's CID, when the record rode under one: a mismatch refuses. */
  readonly keyedBy?:       string;
  /** The Nexus AID the reader holds on its own trust line. */
  readonly nexus:          string;
  /** The manifest's bytes, resolved by the caller from its CAS: the approval binds these exact bytes. */
  readonly manifestBytes:  Uint8Array;
}): FloorReleaseVerdict {
  try {
    const release = readFloorRelease(args.record);
    if (release === null) return { ok: false, reason: "malformed-release" };
    const derived = floorReleaseCid(release.body);
    if (derived !== release.cid || (args.keyedBy !== undefined && args.keyedBy !== derived)) return { ok: false, reason: "cid-differs" };
    if (release.body.nexus !== args.nexus) return { ok: false, reason: "foreign-nexus" };
    const proven = rosterOfLineage(args.nexus, release.lineage, release.body.epoch);
    if (!proven.ok) return { ok: false, reason: proven.reason, ...(proven.detail ? { detail: proven.detail } : {}) };
    const roster = proven.roster;
    if (!roster.keys.includes(release.seal.signer)) return { ok: false, reason: "steward-not-seated" };
    if (!verifyEd25519(release.seal.sig, floorReleaseBodyBytes(release.body), release.seal.signer)) return { ok: false, reason: "steward-seal-fails" };
    if (sha256HexBytesSync(args.manifestBytes) !== release.body.manifest) return { ok: false, reason: "manifest-bytes-differ" };
    if (release.approval.surface !== FLOOR_RELEASE_SURFACE) return { ok: false, reason: "approval-wrong-surface" };
    const verdict = verifyPromotionApproval({ approval: release.approval, bytes: args.manifestBytes, roster });
    if (!verdict.ok) return { ok: false, reason: `approval-${verdict.reason}` };
    return { ok: true, release, counted: verdict.counted, threshold: verdict.threshold };
  } catch {
    return { ok: false, reason: "malformed-release" };
  }
}

// ── the board ─────────────────────────────────────────────────────────────────────────────────────────

/** Land a release on a board draft, keyed by its CID. Call INSIDE a `handle.change()` callback. */
export function writeFloorRelease(draft: LarDoc, release: FloorRelease): void {
  const key = `${FLOOR_RELEASE_PREFIX}${release.cid}`;
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(release) }, release.body.epoch);
}

/** Every record a board carries under the release prefix, as the unread JSON beside the CID its key names. A torn row drops. */
export function floorReleaseRowsFromBoard(doc: LarDoc | undefined | null): Array<{ readonly keyCid: string; readonly record: unknown }> {
  const out: Array<{ keyCid: string; record: unknown }> = [];
  for (const [title, row] of Object.entries(doc?.tiddlers ?? {})) {
    if (!title.startsWith(FLOOR_RELEASE_PREFIX)) continue;
    const text = tiddlerText(row);
    if (text === null) continue;
    try { out.push({ keyCid: title.slice(FLOOR_RELEASE_PREFIX.length), record: JSON.parse(text) as unknown }); } catch { continue; }
  }
  return out;
}

export type FloorReleaseStanding =
  | { readonly standing: "absent"; readonly head: null; readonly refused: readonly FloorReleaseRefused[] }
  | { readonly standing: "released"; readonly head: FloorRelease; readonly refused: readonly FloorReleaseRefused[] }
  | { readonly standing: "unsettled"; readonly head: null; readonly heads: readonly string[]; readonly refused: readonly FloorReleaseRefused[] };

/** A row the fold set aside, and why: a reader names the refusal rather than reading a refusal as an absence. */
export interface FloorReleaseRefused { readonly keyCid: string; readonly reason: FloorReleaseRefusal | "manifest-unavailable" | "prior-unknown"; readonly detail?: string }

/**

 * bytes resolved by `manifestBytesOf`, its lineage proving the roster of its epoch) AND it opens the chain (`prior` null)
 * or links to a release that counts. The head stands as the counted release no other counted release names; two heads
 * read `unsettled`, and a face accepts neither until the cabal settles the fork (the KERI watcher shape). Each row
 * the fold sets aside rides `refused` with its reason.
 */
export async function foldFloorReleases(args: {
  readonly rows:            ReadonlyArray<{ readonly keyCid: string; readonly record: unknown }>;
  readonly nexus:           string;
  readonly manifestBytesOf: (manifestCid: string) => Promise<Uint8Array | null> | Uint8Array | null;
}): Promise<FloorReleaseStanding> {
  const verified = new Map<string, FloorRelease>();
  const refused: FloorReleaseRefused[] = [];
  for (const row of args.rows) {
    const peek = readFloorRelease(row.record);
    if (peek === null) { refused.push({ keyCid: row.keyCid, reason: "malformed-release" }); continue; }
    const bytes = await args.manifestBytesOf(peek.body.manifest);
    if (bytes === null) { refused.push({ keyCid: row.keyCid, reason: "manifest-unavailable" }); continue; }
    const verdict = verifyFloorRelease({ record: row.record, keyedBy: row.keyCid, nexus: args.nexus, manifestBytes: bytes });
    if (verdict.ok) verified.set(verdict.release.cid, verdict.release);
    else refused.push({ keyCid: row.keyCid, reason: verdict.reason, ...(verdict.detail ? { detail: verdict.detail } : {}) });
  }
  // A release counts only through an unbroken chain to the Nexus's first (prior null).
  const counted = new Map<string, FloorRelease>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const [cid, r] of verified) {
      if (counted.has(cid)) continue;
      if (r.body.prior === null || counted.has(r.body.prior)) { counted.set(cid, r); grew = true; }
    }
  }
  for (const [cid, r] of verified) if (!counted.has(cid)) refused.push({ keyCid: cid, reason: "prior-unknown", detail: `its prior ${r.body.prior} stands in no counted release` });
  if (counted.size === 0) return { standing: "absent", head: null, refused };
  const cited = new Set([...counted.values()].map((r) => r.body.prior).filter((p): p is string => p !== null));
  const heads = [...counted.keys()].filter((cid) => !cited.has(cid)).sort();
  if (heads.length === 1) return { standing: "released", head: counted.get(heads[0]!)!, refused };
  return { standing: "unsettled", head: null, heads, refused };
}
