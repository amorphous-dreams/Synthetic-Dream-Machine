/**
 * projection-conflict-surfaces — THE SECOND LEG OF THE CONFLUENCE, wired.
 *
 * The disk→records leg reconciles (`@lararium/tw5`'s `ingest-gate`: noop ·
 * ingest · conflict · refuse). `projection-gate` mirrors it for the records→disk
 * leg — a pure three-way decision over the same three streams, deciding and
 * never writing. `LarDiskProjector.flush` consults it on every flush the
 * byte-identity skip does not answer, and routes a `conflict` out on the
 * ward-alert rail. These vectors pin its decision law and measure it over the
 * real corpus.
 *
 * ── THE `≈` CLAUSE IS WHAT MAKES THE WIRE SAFE ───────────────────────────────
 * The ordinary post-ingest round trip leaves ALL THREE STREAMS DIFFERENT:
 *
 *   1. the projector lands a carrier      → anchor := render, disk == anchor
 *   2. the operator edits the file        → disk moves
 *   3. `lares ingest --apply` ADOPTS it   → records move to render(parse(disk))
 *   4. the projector reconciles           → disk ≠ anchor, records ≠ anchor
 *
 * On the three byte-hashes alone that reads as a standoff, and a gate that cries
 * conflict on every adoption is the catastrophe wearing a cure's face (MEASURED:
 * wiring the gate with clauses 1-5 and 7 only turns e2e `wikis-ingest-back` WB2
 * red at `expected 1 to be +0` on the second scan). It is no standoff: step 3 IS
 * the other leg agreeing, and the write at step 4 is the round trip NORMALIZING.
 * Clause 6 reads it through the congruence — `render(parse(disk)) == records` —
 * and answers PROJECT `canonical-equivalent`.
 *
 * Its verdict is a WRITE, not a noop, and that is measured too: the ingest scan's
 * status reads `digestsEqual(diskHash, syncedHash)` and nothing else
 * (lares-cli/src/ingest-core.ts), so only a projection advances the merge base —
 * a noop leaves the carrier reporting `changed` forever, WB2 red in the same
 * place. Two independent confirmations the design intends that write:
 * `recordLandedPacks` records a pack's synced hash explicitly BECAUSE "a pack
 * file never projects back … so the projector never sets its synced hash", i.e.
 * for every other carrier the projector's write is what advances the anchor; and
 * an applied ingest advances the anchor for renames and packs only, never for a
 * plain adoption.
 *
 * The view the clause reads comes from ONE door — `canonicalizeCarrierText`
 * (`@lararium/tw5/carrier-canonical`, a PURE subpath: no barrel, no wasm),
 * injected at the composition root beside `carrierFileFn`. It reuses
 * `memeticIngestOps`, so exactly one implementation of `≈` stands in the tree,
 * and it carries the ahu-fidelity guard — a lossy round trip answers null, which
 * this gate reads as the standoff. An ABSENT view never reads as equivalence:
 * that is the fail-closed direction, and the CONTROL below holds it there.
 *
 * Every measurement here runs against a REBUILT dist; a source-only swap proves
 * nothing, because the e2e loads dist.
 */

import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { decideProjection } from "../src/projection-gate.js";
import { canonicalizeCarrierText } from "@lararium/tw5/carrier-canonical";

const hash = (s: string) => "sha256:" + createHash("sha256").update(s, "utf8").digest("hex");
const A = hash("stream A"), B = hash("stream B"), C = hash("stream C");

describe("the projection gate's decision law — clause for clause against the ingest leg", () => {
  test("1 — disk == records → noop disk-matches-records (the echo gate, riding FIRST)", () => {
    // Rides first so a STALE merge base cannot manufacture a conflict where the
    // two live streams already agree. Ingest's rule 1, read from this shore.
    expect(decideProjection({ diskHash: A, syncedHash: C, recordsHash: A }))
      .toEqual({ kind: "noop", reason: "disk-matches-records" });
  });

  test("2 — nothing coherent on disk → project absent-on-disk", () => {
    expect(decideProjection({ diskHash: null, syncedHash: C, recordsHash: A }))
      .toEqual({ kind: "project", reason: "absent-on-disk" });
  });

  test("3 — no merge base → project never-projected (ingest's fresh adoption, 4b)", () => {
    expect(decideProjection({ diskHash: A, syncedHash: null, recordsHash: B }))
      .toEqual({ kind: "project", reason: "never-projected" });
  });

  test("4 — disk == synced → project disk-unmoved (only the records moved)", () => {
    expect(decideProjection({ diskHash: A, syncedHash: A, recordsHash: B }))
      .toEqual({ kind: "project", reason: "disk-unmoved" });
  });

  test("5 — records == synced → noop records-unmoved (the INGEST leg owns that state)", () => {
    // Ingest's rule 4 answers this state with INGEST — it ADOPTS the disk edit —
    // so the projecting leg must not race it. Two legs disagreeing about one
    // state is how a round trip eats an edit.
    expect(decideProjection({ diskHash: A, syncedHash: B, recordsHash: B }))
      .toEqual({ kind: "noop", reason: "records-unmoved" });
  });

  test("6 — disk's canonical view == records → project canonical-equivalent", () => {
    // Ingest's rule 3, transposed: the two streams SAY the same thing, so the
    // write normalizes framing rather than drowning an edit. THE ORDINARY
    // post-ingest round trip lands exactly here.
    expect(decideProjection({ diskHash: A, syncedHash: B, recordsHash: C, diskCanonicalHash: C }))
      .toEqual({ kind: "project", reason: "canonical-equivalent" });
  });

  test("7 — all three differ, no canonical view → conflict both-moved", () => {
    expect(decideProjection({ diskHash: A, syncedHash: B, recordsHash: C }))
      .toEqual({ kind: "conflict", reason: "both-moved" });
  });

  test("CONTROL — a GENUINE both-moved standoff still reads conflict with the clause armed", () => {
    // Without this, clause 6 could be satisfied by answering `project` unconditionally.
    // A real semantic divergence: the disk says one thing (its canonical view is D),
    // the records say another (C). Framing is not the difference — the MEANING is.
    const D = hash("stream D");
    expect(decideProjection({ diskHash: A, syncedHash: B, recordsHash: C, diskCanonicalHash: D }))
      .toEqual({ kind: "conflict", reason: "both-moved" });
  });

  test("CONTROL — an ABSENT canonical view reads as the standoff, never as equivalence", () => {
    // The null-as-default inversion, held at the door: null folds THREE causes —
    // no canonicalizer injected, a family that has none, a parse that graded error or
    // a round trip that dropped a declared slot. All three mean "I cannot tell these
    // two states apart", whose honest verdict is the standoff. A caller that simply
    // FORGETS the field therefore gets the loud answer, not the quiet one.
    for (const absent of [null, undefined]) {
      expect(decideProjection({ diskHash: A, syncedHash: B, recordsHash: C, diskCanonicalHash: absent }))
        .toEqual({ kind: "conflict", reason: "both-moved" });
    }
  });

  test("the clause reads through digestsEqual too — a bare canonical hash still matches", () => {
    // The canonical view arrives freshly computed (tagged) while a stored value may be
    // bare; comparing literally would miss the equivalence and cry conflict on the
    // ordinary round trip — the exact catastrophe clause 6 exists to prevent.
    expect(decideProjection({ diskHash: A, syncedHash: B, recordsHash: C, diskCanonicalHash: C.slice("sha256:".length) }))
      .toEqual({ kind: "project", reason: "canonical-equivalent" });
  });

  test("the `≈` clause NEVER outranks a clause that already stood down", () => {
    // Placement is load-bearing: clause 6 rides one step ahead of the conflict, so it
    // refines the STANDOFF and nothing else. `records-unmoved` (clause 5, the state the
    // INGEST leg owns) keeps its noop even when the canonical view matches — two legs
    // disagreeing about one state is how a round trip eats an edit.
    expect(decideProjection({ diskHash: A, syncedHash: B, recordsHash: B, diskCanonicalHash: B }))
      .toEqual({ kind: "noop", reason: "records-unmoved" });
    // And the 46 anchor-less corpus carriers keep projecting as fresh adoptions.
    expect(decideProjection({ diskHash: A, syncedHash: null, recordsHash: B, diskCanonicalHash: B }))
      .toEqual({ kind: "project", reason: "never-projected" });
  });

  test("the digest tag boundary never reads as a move (bare stored vs tagged fresh)", () => {
    // A pre-agile tree holds bare hex; a fresh hash arrives tagged. Comparing
    // literally would read EVERY carrier as moved — a mass conflict storm.
    const bare = A.slice("sha256:".length);
    expect(decideProjection({ diskHash: A, syncedHash: bare, recordsHash: B }))
      .toEqual({ kind: "project", reason: "disk-unmoved" });
  });

});

describe("canonicalizeCarrierText — the ONE door the `≈` clause reads through", () => {
  // The congruence itself, not a re-derivation of it: this is `memeticIngestOps`
  // read from the projecting shore, so a change to the memetic congruence reaches
  // both legs at once.
  test("a canonical carrier is its own canonical view (the fixed point)", () => {
    const text = readFileSync(join(__dirname, "..", "..", "..", "bags", "lares", "ha.ka.ba", "lares", "api", "noosphere-boot.mem"), "utf-8");
    const uri  = "lar:///ha.ka.ba/lares/api/noosphere-boot";
    const once = canonicalizeCarrierText(uri, text);
    expect(once).not.toBeNull();
    // Idempotent: render(parse(·)) reaches its fixed point in ONE fold, which is
    // what lets the gate compare a single hash rather than chase a loop.
    expect(canonicalizeCarrierText(uri, once!)).toBe(once);
  });

  test("bytes with no memetic carrier in them answer NULL, never a guess", () => {
    // Null STATES a fact — "no trustworthy canonical view of these bytes exists" —
    // and the gate reads that fact as the standoff.
    expect(canonicalizeCarrierText("lar:///ha.ka.ba/nothing/here", "")).toBeNull();
  });
});

describe("the gate over the REAL corpus — bags/ holds 701 hand-authored carriers", () => {
  const repoBags = join(__dirname, "..", "..", "..", "bags");

  function everyMem(dir: string, out: string[] = []): string[] {
    for (const n of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, n.name);
      if (n.isDirectory()) everyMem(p, out);
      else if (n.name.endsWith(".mem")) out.push(p);
    }
    return out;
  }

  // MEASURED over the live `synced-tree.json` and the REAL renders (2026-09-13,
  // 701 carriers, walked with the tw5 deserializer + `expandMemeRefs`):
  //   noop:disk-matches-records  655   render(parse(disk)) === disk, byte for byte
  //   project:never-projected     46   the sdm bag carries no anchors — these write,
  //                                    exactly as they write today
  //   CONFLICT                     0
  // The 46 matter more than the 655: `meme-corpus-roundtrip` states that corpus
  // files stay NON-CANONICAL AT REST until a deliberate normalization commit, so
  // the render normalizes framing and rule 1 misses on them. Only their absent
  // anchor keeps them clear; once an anchor lands they read `disk-unmoved`.
  test("a stale merge base cannot manufacture a conflict where disk and records agree", () => {
    const files = everyMem(repoBags);
    expect(files.length).toBeGreaterThan(600);
    const tally: Record<string, number> = {};
    for (const f of files) {
      const disk = hash(readFileSync(f, "utf-8"));
      const d = decideProjection({ diskHash: disk, syncedHash: hash("a stale anchor"), recordsHash: disk });
      tally[`${d.kind}:${d.reason}`] = (tally[`${d.kind}:${d.reason}`] ?? 0) + 1;
    }
    expect(tally).toEqual({ "noop:disk-matches-records": files.length });
  });

  test("with the doc moved off every carrier, a LIVE anchor conflicts and an absent one projects", () => {
    const files = everyMem(repoBags);
    let conflict = 0, project = 0;
    for (const f of files) {
      const disk = hash(readFileSync(f, "utf-8"));
      const moved = hash(readFileSync(f, "utf-8") + "\nthe doc moved\n");
      if (decideProjection({ diskHash: disk, syncedHash: hash("older"), recordsHash: moved }).kind === "conflict") conflict++;
      if (decideProjection({ diskHash: disk, syncedHash: null, recordsHash: moved }).kind === "project") project++;
    }
    expect(conflict).toBe(files.length);
    expect(project).toBe(files.length);
  });
});
