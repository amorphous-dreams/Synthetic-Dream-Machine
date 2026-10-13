/**
 * projection-gate — THE CONFLUENCE, SECOND LEG: the pure three-way decision at
 * the heart of records→disk projection, where the same three streams
 * (records · the last agreement · disk) meet and reconcile — a conflict SURFACES
 * rather than one stream drowning another (Unison's law: surface, never
 * overwrite). The mirror of `@lararium/tw5`'s `ingest-gate`, which decides the
 * disk→records leg; BOTH legs of the round trip reconcile, neither
 * overwrites (the operator's ruling: "conflict-surfacing in BOTH legs").
 *
 * Three states meet per carrier — the SAME triangle the ingest leg reads, seen
 * from the other shore:
 *   - the RECORDS' canonical render (what the doc would write; the merge seat),
 *   - the BASE (the last agreement: what the disk held and what the records rendered),
 *   - the DISK bytes (what the operator's hands left),
 * read through a fourth input that is not a stream but a LENS on the third — the
 * canonical text those disk bytes SAY (`render(parse(disk))`, the congruence `≈`).
 * Without it the gate can only ask "same bytes?"; with it, "same thing?".
 *
 * DISK AND RECORDS CO-PROJECT, AND NEITHER STANDS AS CANON. A carrier whose disk
 * bytes and whose records say the same thing stands UNCHANGED, whatever framing the
 * bytes wear, and a projection of an unchanged carrier writes nothing. So the base
 * holds TWO hashes: the disk side and the records side. They read equal where the
 * disk holds the canonical render, and differ where the disk stands in another
 * framing. "The disk stands where the base left it" reads the disk side; "the
 * records stand where the base left them" reads the records side.
 *
 * The gate decides; it never writes. `LarDiskProjector.flush` owns every I/O
 * and every alert — it consults this gate on every flush the byte-identity skip
 * does not already answer, pins the base on an equivalence, and routes a
 * `conflict` out on the ward-alert rail (`onConflict`), named for the mechanism
 * that stood down. Hashes arrive as opaque strings — the gate compares, never
 * computes, so it stays isomorphic and hash-agnostic (ingest-gate's law).
 *
 * Decision law (in order — each clause mirrors the ingest leg's):
 *   1. disk == records          → NOOP `disk-matches-records`
 *      (the bytes already stand there; ingest's rule 1 `disk-matches-synced`,
 *       read from the projecting side — the echo gate. RIDES FIRST, so a
 *       corpus whose anchors went stale but whose disk and doc agree projects
 *       nothing and conflicts on nothing.)
 *   2. disk absent/incomplete   → PROJECT `absent-on-disk`
 *      (no coherent carrier stands there to lose — a missing content file, or a
 *       missing `.meta` beside a filetype that declares one. Restoring a
 *       sidecar the operator's hands never wrote loses no edit.)
 *   3. render(parse(disk)) == records → NOOP `canonical-equivalent`
 *      (ingest's rule 3, transposed — the `≈` clause. The disk and the records
 *       SAY THE SAME THING and differ only in framing: the carrier stands
 *       unchanged, so nothing writes. The caller PINS THE BASE at this agreement
 *       — the disk's bytes on one side, the records' render on the other — which
 *       lets the ingest scan read the file `unchanged` and lets both gates still
 *       tell a later disk edit from a later record edit. RIDES AHEAD OF THE BASE
 *       CLAUSES: a first seed holds no base, and a fresh adoption that rewrote
 *       every file standing in another framing would dirty a person's working
 *       tree with edits no person made.)
 *   4. no base                  → PROJECT `never-projected`
 *      (ingest's rule 4b: a carrier with no merge base reads as a fresh
 *       adoption — the same answer from either shore.)
 *   5. disk == base's disk side → PROJECT `disk-unmoved`
 *      (the operator's hands never touched the file since the last agreement;
 *       only the records moved, so the write applies cleanly, and it writes the
 *       canonical render: a real change normalizes the framing as it lands.
 *       Ingest's rule 4 `current render == base → INGEST`, transposed.)
 *   6. records == base's records side → NOOP `records-unmoved`
 *      (the disk moved ALONE. The ingest leg's answer for this exact state is
 *       INGEST — it ADOPTS the disk edit — so the projecting leg MUST stand
 *       down rather than race it. Deciding otherwise would make the two legs
 *       disagree about one state, which is how a round trip eats an edit.)
 *   7. both moved               → CONFLICT (surface, never overwrite)
 *
 * THE AHU-FIDELITY GUARD RIDES — inside the CANONICALIZER, not here. Ingest
 * guards its rule 3 with a structural-slot check because a lossy render makes an
 * edit inside a dropped slot read as framing-only and never land. Here an
 * equivalence pins a base, and a base pinned over a lossy round trip would let a
 * later write replace the operator's bytes with a text that no longer carries the
 * slot. The guard therefore belongs where the text still exists:
 * `canonicalizeCarrierText` answers null on a lossy round trip, and this gate —
 * which holds no text to scan and must stay pure — reads that null as "no
 * equivalence stands" and falls through to the base clauses.
 *
 * The ingest leg's fourth verdict, `refuse`, has NO analogue here and rides
 * ABSENT rather than dormant: `refuse` grades a PARSE of untrusted disk bytes,
 * and the RENDER this leg writes arrives from the VM registry, whose faults
 * surface as a null `CarrierFile` before the gate is ever consulted. The parse
 * of disk bytes that clause 3 reads through is the CALLER's, and its own
 * error grade folds into a null `diskCanonicalHash` — which never reads as an
 * equivalence.
 */

import { digestsEqual } from "@lararium/mesh";

export type ProjectionDecision =
  | { readonly kind: "noop"; readonly reason: "disk-matches-records" | "canonical-equivalent" | "records-unmoved" }
  | { readonly kind: "project"; readonly reason: "absent-on-disk" | "never-projected" | "disk-unmoved" }
  | { readonly kind: "conflict"; readonly reason: "both-moved" };

export interface ProjectionGateInput {
  /**
   * Whole-carrier hash of the bytes STANDING on disk (body + `.meta`, folded the
   * same way the Synced-tree observation folds them — `carrierHash`), computed by
   * the caller. Null names an absent or incomplete on-disk carrier.
   */
  readonly diskHash: string | null;
  /** THE BASE'S DISK SIDE: whole-carrier hash of the bytes the disk held at the last agreement; null = never agreed. */
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

  // 2 — nothing coherent stands on disk: no operator edit can be lost here.
  if (diskHash === null) {
    return { kind: "project", reason: "absent-on-disk" };
  }

  // 3 — the two streams SAY THE SAME THING: the carrier stands unchanged and nothing writes.
  // Reads presence FIRST — an absent canonical view never reads as an equivalence.
  if (diskCanonicalHash !== null && diskCanonicalHash !== undefined
      && digestsEqual(diskCanonicalHash, recordsHash)) {
    return { kind: "noop", reason: "canonical-equivalent" };
  }

  // 4 — no merge base: a fresh adoption, from either shore.
  if (syncedHash === null) {
    return { kind: "project", reason: "never-projected" };
  }

  // 5 — the disk stands where the last agreement left it; only the records moved.
  if (digestsEqual(diskHash, syncedHash)) {
    return { kind: "project", reason: "disk-unmoved" };
  }

  // 6 — the records stand where the last agreement left them; the disk moved
  // alone. The ingest leg owns this state (it adopts the disk edit); this leg
  // stands down. No write, no observation — the base must keep naming the
  // last agreement so the ingest leg can still SEE the disk edit.
  if (digestsEqual(recordsHash, input.syncedRecordsHash ?? syncedHash)) {
    return { kind: "noop", reason: "records-unmoved" };
  }

  // 7 — both moved since the merge base: surface, never overwrite.
  return { kind: "conflict", reason: "both-moved" };
}
