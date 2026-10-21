/**
 * face-anchor — the sealed identity anchor: what ONE face's pins read as on ONE device, written by founding,
 * admission and recovery and never by sync (stable-founding-road#/rulings, sync carries; verification decides).
 *
 * The anchor holds the PersonaGroup, the persona-KEL prefix, a commitment to the persona root, the digest of
 * the device edge, and a KNOWN FRONTIER that never falls. A boot reads the anchor from the face's own custody
 * row (a D row keyed by its PersonaGroup) and checks every pin it was handed against it; a pin read from a
 * mutable doc that disagrees refuses by name, and a face with no anchor refuses to boot at all. Platform-blind:
 * the node's and the browser's custody rows hand the parsed anchor here; this module seals and persists nothing.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/research/identity-invariants-2026
 */

import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { FACE_ANCHOR_EDGE_DOMAIN, FACE_ANCHOR_ROOT_DOMAIN } from "./domains.js";

/** What a device knows of a face's moving edge: it only rises. */
export interface FaceFrontier {
  /** The highest lease epoch this device accepted for the face. */
  readonly leaseEpoch: number;
  /** The face's `@persona` log: the highest seq this device accepted, or -1 before any. */
  readonly actSeq: number;
  /** The cid of the act at `actSeq`, or null before any. */
  readonly actCid: string | null;
}

export interface FaceAnchor {
  readonly personaGroup: string;
  readonly personaKelPrefix: string;
  /** `faceRootCommitment(personaRootDid)`. */
  readonly rootCommitment: string;
  /** `faceEdgeDigest(edge)`. */
  readonly edgeDigest: string;
  readonly frontier: FaceFrontier;
}

/** The pins a boot was handed, wherever it read them from. */
export interface FacePins {
  readonly personaGroup?: string | undefined;
  readonly personaKelPrefix?: string | undefined;
  readonly personaRootDid?: string | undefined;
  readonly edge?: unknown;
}

export type AnchorRefusal =
  | "anchor-missing" | "group" | "kel-prefix" | "root" | "edge" | "frontier-falls";

const norm = (did: string): string => did.trim().toLowerCase().replace(/^0x/, "");

export function faceRootCommitment(personaRootDid: string): string {
  return sha256HexBytesSync(canonicalJsonBytes({ kind: FACE_ANCHOR_ROOT_DOMAIN, root: norm(personaRootDid) }));
}

export function faceEdgeDigest(edge: unknown): string {
  return sha256HexBytesSync(canonicalJsonBytes({ kind: FACE_ANCHOR_EDGE_DOMAIN, edge }));
}

/** Parse a custody row's JSON into an anchor, or null when it holds not exactly the anchor's shape. */
export function readFaceAnchor(raw: unknown): FaceAnchor | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const f = r["frontier"] as Record<string, unknown> | undefined;
  if (typeof r["personaGroup"] !== "string" || r["personaGroup"] === "") return null;
  if (typeof r["personaKelPrefix"] !== "string" || r["personaKelPrefix"] === "") return null;
  if (typeof r["rootCommitment"] !== "string" || typeof r["edgeDigest"] !== "string") return null;
  if (typeof f !== "object" || f === null) return null;
  if (!Number.isSafeInteger(f["leaseEpoch"]) || (f["leaseEpoch"] as number) < 0) return null;
  if (!Number.isSafeInteger(f["actSeq"]) || (f["actSeq"] as number) < -1) return null;
  if (f["actCid"] !== null && typeof f["actCid"] !== "string") return null;
  if ((f["actSeq"] === -1) !== (f["actCid"] === null)) return null;
  return {
    personaGroup: r["personaGroup"], personaKelPrefix: r["personaKelPrefix"],
    rootCommitment: r["rootCommitment"], edgeDigest: r["edgeDigest"],
    frontier: { leaseEpoch: f["leaseEpoch"] as number, actSeq: f["actSeq"] as number, actCid: f["actCid"] as string | null },
  };
}

/** Mint an anchor at a founding, an admission or a recovery rite: the only three writers. */
export function mintFaceAnchor(parts: {
  personaGroup: string; personaKelPrefix: string; personaRootDid: string; edge: unknown; leaseEpoch: number;
}): FaceAnchor {
  return {
    personaGroup: parts.personaGroup, personaKelPrefix: parts.personaKelPrefix,
    rootCommitment: faceRootCommitment(parts.personaRootDid), edgeDigest: faceEdgeDigest(parts.edge),
    frontier: { leaseEpoch: parts.leaseEpoch, actSeq: -1, actCid: null },
  };
}

/** Check every pin a boot read against the anchor. A pin left undefined stays unchecked; the caller names which
 *  pins its path must present. Order of refusal: missing, group, prefix, root, edge. */
export function checkFacePins(anchor: FaceAnchor | null, pins: FacePins): { readonly ok: true } | { readonly ok: false; readonly refusal: AnchorRefusal } {
  if (anchor === null) return { ok: false, refusal: "anchor-missing" };
  if (pins.personaGroup !== undefined && pins.personaGroup !== anchor.personaGroup) return { ok: false, refusal: "group" };
  if (pins.personaKelPrefix !== undefined && pins.personaKelPrefix !== anchor.personaKelPrefix) return { ok: false, refusal: "kel-prefix" };
  if (pins.personaRootDid !== undefined && faceRootCommitment(pins.personaRootDid) !== anchor.rootCommitment) return { ok: false, refusal: "root" };
  if (pins.edge !== undefined && faceEdgeDigest(pins.edge) !== anchor.edgeDigest) return { ok: false, refusal: "edge" };
  return { ok: true };
}

/** Raise the known frontier by what a verified read observed. The result never falls below the anchor's:
 *  a deleted, replayed or stale observation returns the same anchor. */
export function raiseFaceFrontier(anchor: FaceAnchor, seen: Partial<FaceFrontier>): FaceAnchor {
  const f = anchor.frontier;
  const leaseEpoch = Math.max(f.leaseEpoch, seen.leaseEpoch ?? f.leaseEpoch);
  const higherAct = seen.actSeq !== undefined && seen.actSeq > f.actSeq && seen.actCid !== undefined && seen.actCid !== null;
  if (leaseEpoch === f.leaseEpoch && !higherAct) return anchor;
  return {
    ...anchor,
    frontier: {
      leaseEpoch,
      actSeq: higherAct ? seen.actSeq! : f.actSeq,
      actCid: higherAct ? seen.actCid! : f.actCid,
    },
  };
}

/** The lease epoch a gate acts under: the observed epoch never lowers what the anchor knows. A stale observation
 *  reads `frontier-falls` so the caller can name it, and the gate uses the anchor's higher bound. */
export function leaseEpochUnderAnchor(anchor: FaceAnchor, observed: number): { readonly epoch: number; readonly refusal: AnchorRefusal | null } {
  return observed < anchor.frontier.leaseEpoch
    ? { epoch: anchor.frontier.leaseEpoch, refusal: "frontier-falls" }
    : { epoch: observed, refusal: null };
}
