/**
 * projection-gate — the pure decision at the heart of records→disk projection: what the projector does with one carrier
 * before a single byte writes. Three states meet per carrier:
 *   - the RECORDS' canonical render (what the doc would write),
 *   - the BASE (the last agreement AT THIS PATH: the bytes this projector last wrote there or last saw captured, and the
 *     render the records carried then),
 *   - the DISK bytes (what stands there now),
 * read through a fourth input that serves as a LENS on the third: the canonical text those disk bytes SAY
 * (`render(parse(disk))`, the congruence `≈`). Without it the gate can only ask "same bytes?"; with it, "same thing?".
 *
 * THE PROJECTOR RENDERS; THE CRDT MERGES. Merge authority routes through the CRDT alone, so this gate never weighs two
 * sides against each other and never holds a carrier for a person. It asks one question before a write: did a hand move
 * the file since the projector last wrote it or last saw it captured? Where it did, the write waits and the file goes to
 * the capture door (`capture`): its words enter the records through the ingest grade (or stand as parallel drafts where
 * the records moved too), the base moves to those bytes, and the next reconcile projects whatever the records then say.
 * No bytes a hand left on disk get overwritten before the house holds them.
 *
 * Decision law (in order):
 *   1. disk == records                 → NOOP `disk-matches-records` (the echo gate: the bytes already stand there)
 *   2. no content file on disk:
 *        a base stands at this path    → PENDING-REMOVAL `vanished` (the file left where an agreement stood; nothing writes
 *                                        back and nothing tombstones until a person answers; `answer: "restore"` → PROJECT)
 *        no base at this path          → PROJECT `absent-on-disk` (no file stands there to lose)
 *      A content file whose declared `.meta` left reads as a disk state of its own (the caller hashes the body alone and
 *      hands in no canonical view), so the base clauses decide it.
 *   3. render(parse(disk)) == records  → NOOP `canonical-equivalent` (the two say the same thing in two framings; the caller
 *                                        pins the base at this agreement, so a first seed of an unchanged corpus writes
 *                                        nothing and dirties no working tree)
 *   4. disk == base's disk side, and the records still hold the history that base read
 *                                      → PROJECT `disk-unmoved` (the file stands as the projector last wrote or last saw it
 *                                        captured: nothing a hand left rests there, and the canonical render writes)
 *   5. anything else                   → CAPTURE, naming why: `no-base` (a file no agreement covers), `disk-moved` (only the
 *                                        disk moved), `both-moved`, or `records-behind-base` (the document read back without
 *                                        the write the base saw, so the file holds the newer words)
 *
 * THE AHU-FIDELITY GUARD RIDES INSIDE THE CANONICALIZER: `canonicalizeCarrierText` answers null on a lossy round trip, and
 * this gate reads that null as "no equivalence stands". Hashes arrive as opaque strings: the gate compares and never
 * computes, so it stays isomorphic and hash-agnostic.
 */

import { digestsEqual } from "@lararium/mesh/agile-digest";

export type ProjectionDecision =
  | { readonly kind: "noop"; readonly reason: "disk-matches-records" | "canonical-equivalent" }
  | { readonly kind: "project"; readonly reason: "absent-on-disk" | "disk-unmoved" | "restore-answered" }
  | { readonly kind: "pending-removal"; readonly reason: "vanished" }
  | { readonly kind: "capture"; readonly reason: "no-base" | "disk-moved" | "both-moved" | "records-behind-base" };
export interface ProjectionGateInput {
  /**
   * Whole-carrier hash of the bytes STANDING on disk (body + `.meta`, folded the
   * same way the Synced-tree observation folds them — `carrierHash`), computed by
   * the caller. Null names a path that holds no content file.
   */
  readonly diskHash: string | null;
  /** THE BASE'S DISK SIDE: whole-carrier hash of the bytes the disk held at the last agreement AT THIS PATH;
   *  null = no agreement ever stood here (an agreement reached at another path names no base at this one). */
  readonly syncedHash: string | null;
  /** THE BASE'S RECORDS SIDE: whole-carrier hash of the render the records carried at that agreement.
   *  Null/absent beside a standing `syncedHash` = that one hash names both sides. */
  readonly syncedRecordsHash?: string | null;
  /** Whole-carrier hash of the render the projector would write — the merge seat's present view. */
  readonly recordsHash: string;
  /**
   * Hash of the CANONICAL TEXT THE DISK BYTES SAY — `render(parse(disk))`, computed by
   * the caller through the family's congruence (`canonicalizeCarrierText`, the ONE door),
   * folded the same way `diskHash` folds. This is the `≈` seat: it answers "do these two
   * streams SAY the same thing", where `diskHash` answers only "are they the same bytes".
   *
   * NULL/ABSENT STATES A FACT, and the fact is NOT equivalence: "no trustworthy canonical
   * view of these bytes exists". Three things fold into it — no canonicalizer was injected,
   * the family has none, or the round trip graded `error`/dropped a declared structural slot.
   * All three mean the same thing to this gate: it cannot tell the two states apart, so no
   * equivalence stands and the base clauses decide. A caller that simply FORGETS this field
   * therefore never gains a quiet equivalence.
   */
  readonly diskCanonicalHash?: string | null;
  /**
   * THE RECORDS FELL BEHIND THE BASE: the base names the heads its document stood at, and the document the caller
   * reads now lacks them (it read back without the write the agreement saw). True sends the file to capture where
   * clause 4 would write; absent or false reads as records that moved on from the agreement.
   */
  readonly recordsBehindBase?: boolean;
  /** A person's answer to a pending removal (`restore`). Absent = no person answered. */
  readonly answer?: "restore";
}

/**
 * Decide ONE carrier's projection. Pure: no I/O, no clock, no hashing.
 *
 * Digest comparison rides `digestsEqual` throughout, as the ingest gate's does: every
 * tagged spelling of one digest reads equal, and a base hash resting bare in the tree
 * names no algorithm and matches nothing — the carrier reads as moved, and the write
 * (or the byte-skip's re-observation) records the tagged base.
 */
export function decideProjection(input: ProjectionGateInput): ProjectionDecision {
  const { diskHash, syncedHash, recordsHash, diskCanonicalHash } = input;

  // 1 — the echo gate: the disk already holds exactly what we would write.
  if (diskHash !== null && digestsEqual(diskHash, recordsHash)) {
    return { kind: "noop", reason: "disk-matches-records" };
  }

  // 2 — no content file stands at this path. Where an agreement stood here, the file vanished: a person
  // answers. Where none did, nothing stands there to lose and the first projection writes.
  if (diskHash === null) {
    if (syncedHash === null) return { kind: "project", reason: "absent-on-disk" };
    return input.answer === "restore" ? { kind: "project", reason: "restore-answered" } : { kind: "pending-removal", reason: "vanished" };
  }

  // 3 — the two streams SAY THE SAME THING: the carrier stands unchanged and nothing writes.
  // Reads presence FIRST — an absent canonical view never reads as an equivalence.
  if (diskCanonicalHash !== null && diskCanonicalHash !== undefined
      && digestsEqual(diskCanonicalHash, recordsHash)) {
    return { kind: "noop", reason: "canonical-equivalent" };
  }

  // 4 — the file stands as the projector last wrote it or last saw it captured: the write applies cleanly.
  if (syncedHash !== null && digestsEqual(diskHash, syncedHash) && input.recordsBehindBase !== true) {
    return { kind: "project", reason: "disk-unmoved" };
  }

  // 5 — a hand moved the file (or no agreement covers it, or the records lost the history the base read): the file goes
  // to capture, and nothing writes over it.
  if (syncedHash === null) return { kind: "capture", reason: "no-base" };
  if (input.recordsBehindBase === true) return { kind: "capture", reason: "records-behind-base" };
  return digestsEqual(recordsHash, input.syncedRecordsHash ?? syncedHash)
    ? { kind: "capture", reason: "disk-moved" }
    : { kind: "capture", reason: "both-moved" };
}
