/**
 * projection-gate — THE CONFLUENCE, SECOND LEG: the pure three-way decision at
 * the heart of records→disk projection, where the same three streams
 * (records · last-synced · disk) meet and reconcile — a conflict SURFACES
 * rather than one stream drowning another (Unison's law: surface, never
 * overwrite). The mirror of `@lararium/tw5`'s `ingest-gate`, which decides the
 * disk→records leg; BOTH legs of the round trip now reconcile, neither
 * overwrites (the operator's ruling: "conflict-surfacing in BOTH legs").
 *
 * Three states meet per carrier — the SAME triangle the ingest leg reads, seen
 * from the other shore:
 *   - the RECORDS' canonical render (what the doc would write; the merge seat),
 *   - the SYNCED hash (last-projected canonical bytes — the merge base),
 *   - the DISK bytes (what the operator's hands left).
 *
 * The gate decides; it never writes. `LarDiskProjector.flush` owns every I/O
 * and every alert. Hashes arrive as opaque strings — the gate compares, never
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
 *   3. no synced anchor         → PROJECT `never-projected`
 *      (ingest's rule 4b: a carrier with no merge base reads as a fresh
 *       adoption — the same answer from either shore.)
 *   4. disk == synced           → PROJECT `disk-unmoved`
 *      (the operator's hands never touched the file since the last projection;
 *       only the records moved, so the write applies cleanly. Ingest's rule 4
 *       `current render == synced → INGEST`, transposed.)
 *   5. records == synced        → NOOP `records-unmoved`
 *      (the disk moved ALONE. The ingest leg's answer for this exact state is
 *       INGEST — it ADOPTS the disk edit — so the projecting leg MUST stand
 *       down rather than race it. Deciding otherwise would make the two legs
 *       disagree about one state, which is how a round trip eats an edit.)
 *   6. both moved               → CONFLICT (surface, never overwrite)
 *
 * The ingest leg's fourth verdict, `refuse`, has NO analogue here and rides
 * ABSENT rather than dormant: `refuse` grades a PARSE of untrusted disk bytes,
 * and this leg parses nothing — the render arrives from the VM registry, whose
 * faults surface as a null `CarrierFile` before the gate is ever consulted.
 */

import { digestsEqual } from "@lararium/mesh";

export type ProjectionDecision =
  | { readonly kind: "noop"; readonly reason: "disk-matches-records" | "records-unmoved" }
  | { readonly kind: "project"; readonly reason: "absent-on-disk" | "never-projected" | "disk-unmoved" }
  | { readonly kind: "conflict"; readonly reason: "both-moved" };

export interface ProjectionGateInput {
  /**
   * Whole-carrier hash of the bytes STANDING on disk (body + `.meta`, folded the
   * same way the Synced-tree observation folds them — `carrierHash`), computed by
   * the caller. Null names an absent or incomplete on-disk carrier.
   */
  readonly diskHash: string | null;
  /** Whole-carrier hash of the last-projected bytes (the Synced tree); null = never projected. */
  readonly syncedHash: string | null;
  /** Whole-carrier hash of the render the projector would write — the merge seat's present view. */
  readonly recordsHash: string;
}

/**
 * Decide ONE carrier's projection. Pure: no I/O, no clock, no hashing.
 *
 * Digest comparison rides `digestsEqual` throughout, for the same reason the
 * ingest gate does: a freshly computed hash arrives tagged (`sha256:hex`) while a
 * `syncedHash` resting in the tree may still be a pre-agile bare value — the same
 * content MUST read equal across both forms, or every carrier reads as moved.
 */
export function decideProjection(input: ProjectionGateInput): ProjectionDecision {
  const { diskHash, syncedHash, recordsHash } = input;

  // 1 — the echo gate: the disk already holds exactly what we would write.
  if (diskHash !== null && digestsEqual(diskHash, recordsHash)) {
    return { kind: "noop", reason: "disk-matches-records" };
  }

  // 2 — nothing coherent stands on disk: no operator edit can be lost here.
  if (diskHash === null) {
    return { kind: "project", reason: "absent-on-disk" };
  }

  // 3 — no merge base: a fresh adoption, from either shore.
  if (syncedHash === null) {
    return { kind: "project", reason: "never-projected" };
  }

  // 4 — the disk stands where the last projection left it; only the records moved.
  if (digestsEqual(diskHash, syncedHash)) {
    return { kind: "project", reason: "disk-unmoved" };
  }

  // 5 — the records stand where the last projection left them; the disk moved
  // alone. The ingest leg owns this state (it adopts the disk edit); this leg
  // stands down. No write, no observation — the anchor must keep pointing at the
  // last projection so the ingest leg can still SEE the disk edit.
  if (digestsEqual(recordsHash, syncedHash)) {
    return { kind: "noop", reason: "records-unmoved" };
  }

  // 6 — both moved since the merge base: surface, never overwrite.
  return { kind: "conflict", reason: "both-moved" };
}
