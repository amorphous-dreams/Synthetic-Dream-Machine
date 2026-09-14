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
 *   - the DISK bytes (what the operator's hands left),
 * read through a fourth input that is not a stream but a LENS on the third — the
 * canonical text those disk bytes SAY (`render(parse(disk))`, the congruence `≈`).
 * Without it the gate can only ask "same bytes?"; with it, "same thing?".
 *
 * The gate decides; it never writes. `LarDiskProjector.flush` owns every I/O
 * and every alert — it consults this gate on every flush the byte-identity skip
 * does not already answer, and routes a `conflict` out on the ward-alert rail
 * (`onConflict`), named for the mechanism that stood down. Hashes arrive as
 * opaque strings — the gate compares, never computes, so it stays isomorphic
 * and hash-agnostic (ingest-gate's law).
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
 *   6. render(parse(disk)) == records → PROJECT `canonical-equivalent`
 *      (ingest's rule 3, transposed — the `≈` clause. The disk and the records
 *       SAY THE SAME THING and differ only in framing, so the write NORMALIZES
 *       rather than drowning an edit. This is the ORDINARY post-ingest round
 *       trip: the projector lands a carrier, the operator edits the file,
 *       `lares ingest --apply` ADOPTS the edit, and all three streams now
 *       differ — which clause 7 alone would call a standoff. It is not one:
 *       the adoption IS the other leg agreeing.)
 *   7. both moved               → CONFLICT (surface, never overwrite)
 *
 * WHY CLAUSE 6 RIDES LAST, one step ahead of the conflict — placement reasoned,
 * and one candidate MEASURED AND REJECTED:
 *   - It is PRECISELY a refinement of the standoff. Riding here, it changes
 *     exactly one verdict (`conflict` → `project`) and leaves every other clause's
 *     answer byte-identical, including the 46 anchor-less `bags/sdm` carriers the
 *     corpus vectors measure at `never-projected`. The ingest leg puts its rule 3
 *     AHEAD of its clean-ingest clause because there the verdict it preempts is a
 *     RECORDS write and suppressing it is the gofmt-loop guard; there is no gofmt
 *     loop on this shore, because what the projector writes IS the canonical form,
 *     so its own output converges at clause 1 after a single write.
 *   - The verdict is PROJECT, not noop. MEASURED (2026-09-14): the noop reading —
 *     "they say the same thing, so leave the disk alone" — leaves the disk holding
 *     non-canonical bytes and the merge base pointing at the LAST projection, and
 *     the ingest scan's status reads `digestsEqual(diskHash, syncedHash)` and
 *     nothing else (lares-cli/src/ingest-core.ts). So a noop leaves the carrier
 *     reporting `changed` forever — e2e `wikis-ingest-back` WB2 red at
 *     `expected 1 to be +0`, the SAME red as leaving the clause out entirely. Only
 *     the write advances the anchor, and advancing the anchor is what closes the
 *     round trip in one cycle.
 *
 * THE AHU-FIDELITY GUARD RIDES — but inside the CANONICALIZER, not here. Ingest
 * guards its rule 3 with a structural-slot check because a lossy render makes an
 * edit inside a dropped slot read as framing-only and never land. Here the verdict
 * is a DISK WRITE, so a lossy render would not merely fail to land an edit — it
 * would replace the operator's bytes with a text that no longer carries the slot.
 * The guard therefore belongs where the text still exists: `canonicalizeCarrierText`
 * answers null on a lossy round trip, and this gate — which holds no text to scan
 * and must stay pure — reads that null as the standoff.
 *
 * The ingest leg's fourth verdict, `refuse`, has NO analogue here and rides
 * ABSENT rather than dormant: `refuse` grades a PARSE of untrusted disk bytes,
 * and the RENDER this leg writes arrives from the VM registry, whose faults
 * surface as a null `CarrierFile` before the gate is ever consulted. The parse
 * of disk bytes that clause 6 now reads through is the CALLER's, and its own
 * error grade folds into a null `diskCanonicalHash` — which surfaces as the
 * standoff, never as a refusal of the projection itself.
 */

import { digestsEqual } from "@lararium/mesh";

export type ProjectionDecision =
  | { readonly kind: "noop"; readonly reason: "disk-matches-records" | "records-unmoved" }
  | { readonly kind: "project"; readonly reason: "absent-on-disk" | "never-projected" | "disk-unmoved" | "canonical-equivalent" }
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
  /**
   * Hash of the CANONICAL TEXT THE DISK BYTES SAY — `render(parse(disk))`, computed by
   * the caller through the family's congruence (`canonicalizeCarrierText`, the ONE door),
   * folded the same way `diskHash` folds. This is the `≈` seat: it answers "do these two
   * streams SAY the same thing", where `diskHash` answers only "are they the same bytes".
   *
   * NULL/ABSENT STATES A FACT, and the fact is NOT equivalence: "no trustworthy canonical
   * view of these bytes exists". Three things fold into it — no canonicalizer was injected,
   * the family has none, or the round trip graded `error`/dropped a declared structural slot.
   * All three mean the same thing to this gate: it cannot tell the two states apart, so the
   * honest verdict is the standoff below, never a silent equivalence. A caller that simply
   * FORGETS this field therefore gets the loud answer, not the quiet one — the null-as-default
   * inversion runs the other way here by construction.
   */
  readonly diskCanonicalHash?: string | null;
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

  // 6 — the two streams SAY THE SAME THING: the write NORMALIZES, it does not overwrite.
  // Reads presence FIRST — an absent canonical view falls through to the standoff, which is
  // the whole reason the field is absent-tolerant without being fail-open.
  const { diskCanonicalHash } = input;
  if (diskCanonicalHash !== null && diskCanonicalHash !== undefined
      && digestsEqual(diskCanonicalHash, recordsHash)) {
    return { kind: "project", reason: "canonical-equivalent" };
  }

  // 7 — both moved since the merge base: surface, never overwrite.
  return { kind: "conflict", reason: "both-moved" };
}
