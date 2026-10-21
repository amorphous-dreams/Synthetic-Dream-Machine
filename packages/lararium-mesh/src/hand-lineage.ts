/**
 * hand-lineage — a raising hand's roster at EACH epoch it has stood, so an old link verifies under the keys of its
 * own epoch and only the head must stand at the current one.
 *
 * A hand rotates (a fleet root re-keys beneath its KEL prefix; a realm's charter rolls its seal epoch). A chain of
 * signed acts or frontiers spans that rotation: its early links hold the first roster's signatures, its later links the next roster's.
 * A reader that authorizes every link against the CURRENT roster would refuse the early links forever. The
 * lineage names the roster per epoch; a link's `epoch` field selects which roster reads it; and a chain's epochs
 * only rise, so a retired key signs nothing after its epoch closed.
 *
 * A lineage is never a bare map from a mutable doc. `makeHandLineage` checks the rosters commit to their hashes,
 * the epochs climb by one, and, where the hand is a charter, that the seal-epoch chain verifies the way the edge
 * roll lineage does and each epoch's key-set hash names exactly this roster.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/research/edge-frontier-2026
 */

import { sealKeySetHash, verifySealLineage, type SealEpoch } from "./wax-stamp.js";

export interface HandEpoch {
  readonly epoch: number;
  /** Distinct, lower-case ed25519 verifying-key hex. */
  readonly signers: readonly string[];
  /** k distinct seated signatures a link at this epoch carries; a fleet root's lineage runs k = 1. */
  readonly threshold: number;
  /** `sealKeySetHash(signers, threshold)`: the commitment a link's body names. */
  readonly rosterHash: string;
}

declare const verified: unique symbol;
/** Constructed only by `makeHandLineage`. */
export type HandLineage = readonly HandEpoch[] & { readonly [verified]: true };

/** Build a lineage, or null when it does not hold together. `charter` binds each epoch to a seal-epoch chain. */
export function makeHandLineage(
  epochs: readonly { readonly epoch: number; readonly signers: readonly string[]; readonly threshold: number }[],
  charter?: readonly SealEpoch[],
): HandLineage | null {
  if (epochs.length === 0) return null;
  const out: HandEpoch[] = [];
  for (let i = 0; i < epochs.length; i++) {
    const e = epochs[i]!;
    const signers = [...new Set(e.signers.map((s) => s.toLowerCase()))].sort();
    if (!Number.isSafeInteger(e.epoch) || e.epoch < 0) return null;
    if (i > 0 && e.epoch !== epochs[i - 1]!.epoch + 1) return null;
    if (signers.length !== e.signers.length || !Number.isSafeInteger(e.threshold) || e.threshold < 1 || e.threshold > signers.length) return null;
    out.push({ epoch: e.epoch, signers, threshold: e.threshold, rosterHash: sealKeySetHash(signers, e.threshold) });
  }
  if (charter) {
    if (charter.length !== out.length || !verifySealLineage(charter)) return null;
    for (let i = 0; i < out.length; i++) if (charter[i]!.keySetHash !== out[i]!.rosterHash) return null;
  }
  return out as unknown as HandLineage;
}

/** The roster a link at `epoch` reads under, or null for an epoch the lineage never stood at. */
export function rosterAt(lineage: HandLineage, epoch: unknown): HandEpoch | null {
  return typeof epoch === "number" ? lineage.find((e) => e.epoch === epoch) ?? null : null;
}

/** The current epoch's roster: the one a head must stand at. */
export function currentRoster(lineage: HandLineage): HandEpoch {
  return lineage[lineage.length - 1]!;
}
