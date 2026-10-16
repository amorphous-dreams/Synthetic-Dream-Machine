/**
 * chartered-classes — the four classes a Kahu act falls into, read as ONE typed table the charter sets.
 *
 * The ruling (`lar:///ha.ka.ba/lares/docs/stable-founding-road`, "Planes ~ cabal, realm, Nexus") names the
 * classes: ordinary (1-of-1); high-impact — charter, admission, trust root (3-of-5, or 2-of-3 for a small
 * body); emergency (2-of-3, a narrow pre-authorized power a later causal act reviews); revocation (the
 * threshold of the original act). Admission of a Kahu or a Lamplighter always takes the seat quorum, and
 * no ordinary single-seat class covers it (`lar:///ha.ka.ba/lararium/mesh/kahu#/seed-and-nexus`).
 *
 * HOUSE READING (the lead's, marked as one): the table DERIVES from the charter epoch's own seats and
 * threshold (`KahuQuorumSeats`), so no charter byte moves to carry it. With n distinct seated keys:
 *   · n = 1 — every class takes 1 (a household seed answers to its one holder);
 *   · n = 2 — every class takes 2: at two seats no seat signs any Kahu act alone;
 *   · n ≥ 3 — ordinary takes 1; high-impact takes max(roster threshold, a strict majority), capped at n
 *     (2-of-3, 3-of-4, 3-of-5); emergency takes 2.
 * Emergency owes a review at every n. Revocation carries no row of its own: it borrows the row of the act
 * it revokes.
 *
 * WHAT IT DECIDES: the threshold each class needs under one epoch, the class each surface needs, which
 * class covers which, and how many distinct seated keys signed some exact bytes. WHAT IT NEVER DECIDES:
 * whether an act happened, what bytes an act names, or who fills a seat; it names keys, never people.
 *
 * Pure and platform-blind: rides ./ed25519-door alone. No clock, no I/O.
 */
import { verifyEd25519 } from "./ed25519-door.js";
import type { KahuQuorumSeats, QuorumSignature } from "./kapae-antigen.js";

/** The four chartered classes. */
export type CharteredClass = "ordinary" | "high-impact" | "emergency" | "revocation";

/** One class's row: how many distinct seated signatures it takes, and whether a later causal act owes it a review. */
export interface ClassRule {
  readonly threshold:  number;
  readonly reviewOwed: boolean;
}

/** The table one charter epoch sets. Revocation carries no row: it takes the threshold of the act it revokes. */
export interface CharteredClassTable {
  readonly sealEpochCid: string;
  readonly seats:        number;
  readonly ordinary:     ClassRule;
  readonly highImpact:   ClassRule;
  readonly emergency:    ClassRule;
}

/** The surfaces whose change takes the high-impact bar: the charter, an admission, the trust root. */
export const HIGH_IMPACT_SURFACES = Object.freeze(["charter", "admission", "trust-root"] as const);

const SEAT_KEY = /^[0-9a-f]{64}$/;

/** The distinct seated keys of a roster, or null where any key reads malformed (a seat holds one spelling). */
function seatedKeys(roster: KahuQuorumSeats): Set<string> | null {
  if (!roster || !Array.isArray(roster.keys)) return null;
  const seats = new Set<string>();
  for (const k of roster.keys) {
    if (typeof k !== "string" || !SEAT_KEY.test(k)) return null;
    seats.add(k);
  }
  return seats;
}

/**
 * Derive the class table from one epoch's seats. Answers null where the roster seats nobody, names no
 * epoch, carries a threshold outside 1..n (or a fraction), or holds a malformed key: a table built on a
 * torn roster would grant what the charter never set.
 */
export function charteredClassTable(roster: KahuQuorumSeats): CharteredClassTable | null {
  const seats = seatedKeys(roster);
  if (seats === null || seats.size === 0) return null;
  if (typeof roster.sealEpochCid !== "string" || roster.sealEpochCid.length === 0) return null;
  const n = seats.size;
  const k = roster.threshold;
  if (!Number.isInteger(k) || k < 1 || k > n) return null;

  const rule = (threshold: number, reviewOwed = false): ClassRule => Object.freeze({ threshold, reviewOwed });
  const small = n <= 2;
  return Object.freeze({
    sealEpochCid: roster.sealEpochCid,
    seats:        n,
    ordinary:     rule(small ? n : 1),
    highImpact:   rule(small ? n : Math.min(n, Math.max(k, Math.floor(n / 2) + 1))),
    emergency:    rule(small ? n : 2, true),
  });
}

/**
 * The threshold a class takes under the table. Revocation answers the threshold of `revokes`, the class of
 * the act it revokes; a revocation naming no act, or naming another revocation, answers null.
 */
export function classThreshold(table: CharteredClassTable, cls: CharteredClass, revokes?: CharteredClass): number | null {
  switch (cls) {
    case "ordinary":    return table.ordinary.threshold;
    case "high-impact": return table.highImpact.threshold;
    case "emergency":   return table.emergency.threshold;
    case "revocation":
      if (revokes === undefined || revokes === "revocation") return null;
      return classThreshold(table, revokes);
    default:            return null;
  }
}

/** The class a surface needs: charter, admission and trust-root take high-impact; every other surface ordinary. */
export function requiredClassFor(surface: string): "ordinary" | "high-impact" {
  return (HIGH_IMPACT_SURFACES as readonly string[]).includes(surfaceFold(surface)) ? "high-impact" : "ordinary";
}

/** A surface's meaning, folded: trimmed, lower-cased, each run of space or `_` read as `-`. A spelling that folds
 *  onto a high-impact surface takes the high bar, so case or a separator never lowers the class. */
export function surfaceFold(surface: string): string {
  return typeof surface === "string" ? surface.trim().toLowerCase().replace(/[\s_]+/g, "-") : "";
}

/**
 * Whether an approval of class `have` covers an act needing `need`. A class covers itself, and high-impact
 * covers ordinary. Emergency covers emergency alone: its narrow pre-authorized power never stands in for
 * high-impact, nor for ordinary work outside that power.
 */
export function classCovers(have: CharteredClass, need: CharteredClass): boolean {
  if (have === need) return true;
  return need === "ordinary" && have === "high-impact";
}

/**
 * Count the DISTINCT seated keys whose ed25519 signature verifies over `bytes`. A non-seated signer (an
 * active persona included), a repeat of a counted seat and a malformed signature each count nothing. A
 * roster holding a malformed key counts nothing at all.
 */
export function countSeatedSignatures(bytes: Uint8Array, signatures: readonly QuorumSignature[], roster: KahuQuorumSeats): number {
  const seats = seatedKeys(roster);
  if (seats === null || !Array.isArray(signatures)) return 0;
  const counted = new Set<string>();
  for (const s of signatures) {
    if (!s || typeof s.signer !== "string" || typeof s.sig !== "string") continue;
    if (!seats.has(s.signer) || counted.has(s.signer)) continue;
    if (verifyEd25519(s.sig, bytes, s.signer)) counted.add(s.signer);
  }
  return counted.size;
}
