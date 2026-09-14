/**
 * projection-conflict-surfaces — THE SECOND LEG OF THE CONFLUENCE, and the one
 * clause it still owes before it can be wired.
 *
 * The disk→records leg reconciles (`@lararium/tw5`'s `ingest-gate`: noop ·
 * ingest · conflict · refuse). `projection-gate` mirrors it for the records→disk
 * leg — a pure three-way decision over the same three streams, deciding and
 * never writing. These vectors pin its decision law and measure it over the real
 * corpus.
 *
 * ── WHY THE PROJECTOR DOES NOT YET CONSULT IT ────────────────────────────────
 * MEASURED, not reasoned: wiring `decideProjection` into `LarDiskProjector.flush`
 * turns `tests/e2e/wikis-ingest-back.test.ts` WB2 red — `expected 1 to be +0` on
 * the second scan — and removing it turns WB2 green again (both directions run
 * against a REBUILT dist; a source-only swap proves nothing, the e2e loads dist).
 *
 * The probe named the verdict: on the ordinary round trip the gate reads
 * `conflict:both-moved`.
 *
 *   1. the projector lands a carrier      → anchor := render, disk == anchor
 *   2. the operator edits the file        → disk moves
 *   3. `lares ingest --apply` ADOPTS it   → records move to render(parse(disk))
 *   4. the projector reconciles           → disk ≠ anchor, records ≠ anchor
 *
 * All three differ, so the gate calls it a standoff. It is not one: step 3 IS the
 * other leg agreeing, and the write at step 4 is the round trip NORMALIZING, not
 * one stream drowning another. Two independent confirmations that the design
 * intends that write — `recordLandedPacks` (lares-cli/src/ingest-core.ts) records
 * a pack's synced hash explicitly BECAUSE "a pack file never projects back … so
 * the projector never sets its synced hash", i.e. for every other carrier the
 * projector's write is what advances the merge base; and an applied ingest
 * advances the anchor for renames and packs only, never for a plain adoption.
 *
 * ── THE CLAUSE OWED ──────────────────────────────────────────────────────────
 * The ingest leg tells these two states apart with its rule 3 — `render(parse(disk))
 * == current render → NOOP canonical-equivalent`. The projecting leg has no view of
 * `render(parse(disk))`, so it cannot. Wiring it needs a canonicalizer injected at
 * the composition root (`island-behaviors`, beside `carrierFileFn`) and a fourth
 * gate input; `memeticWikitextDeserializer`/`expandMemeRefs` sit off the
 * `@lararium/tw5` barrel today, so that wire widens a package's public surface —
 * a design call for the operator, not a side effect of this work.
 *
 * Until then the conflict verdict would fire on the NORMAL round trip. A gate that
 * cries conflict on every adoption is the catastrophe wearing a cure's face; the
 * gate stands specified, tested and measured, and unwired.
 */

import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { decideProjection } from "../src/projection-gate.js";

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

  test("6 — all three differ → conflict both-moved", () => {
    expect(decideProjection({ diskHash: A, syncedHash: B, recordsHash: C }))
      .toEqual({ kind: "conflict", reason: "both-moved" });
  });

  test("the digest tag boundary never reads as a move (bare stored vs tagged fresh)", () => {
    // A pre-agile tree holds bare hex; a fresh hash arrives tagged. Comparing
    // literally would read EVERY carrier as moved — a mass conflict storm.
    const bare = A.slice("sha256:".length);
    expect(decideProjection({ diskHash: A, syncedHash: bare, recordsHash: B }))
      .toEqual({ kind: "project", reason: "disk-unmoved" });
  });

  // THE CLAUSE OWED (see the header). Ingest's rule 3, transposed: where the
  // records already carry the canonical render of what stands on disk, the two
  // streams SAY THE SAME THING and the write normalizes rather than overwrites.
  // Red until the projector gains a view of `render(parse(disk))`; the projector
  // stays unwired while this stands red, because without it the conflict verdict
  // fires on the ordinary post-ingest round trip (e2e WB2).
  test.skip("OWED — disk's canonical view == records → noop canonical-equivalent", () => {
    const decide = decideProjection as unknown as (i: Record<string, unknown>) => { reason: string };
    expect(decide({ diskHash: A, syncedHash: B, recordsHash: C, diskCanonicalHash: C }).reason)
      .toBe("canonical-equivalent");
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
