/**
 * projection-conflict-surfaces — THE RECORDS→DISK LEG'S ONE QUESTION, pinned clause for clause.
 *
 * The disk→records leg reconciles (`@lararium/tw5`'s `ingest-gate`: noop · ingest · conflict · refuse). The records→disk
 * leg renders and never weighs two sides: `projection-gate.decideProjection` asks, before each write the byte-identity
 * skip does not answer, whether a hand moved the file since the projector last wrote it or last saw it captured. Where
 * one did, the answer reads `capture` (naming why: `no-base`, `disk-moved`, `both-moved`, `records-behind-base`), the
 * write waits, and `LarDiskProjector` hands the file to the island's capture door. These vectors pin that decision law
 * and measure it over the real corpus.
 *
 * ── THE `≈` CLAUSE KEEPS THE ROUND TRIP QUIET ────────────────────────────────
 * The ordinary post-ingest round trip leaves ALL THREE STREAMS DIFFERENT:
 *
 *   1. the projector lands a carrier      → base := render, disk == base
 *   2. the operator edits the file        → disk moves
 *   3. `lares ingest --apply` ADOPTS it   → records move to render(parse(disk))
 *   4. the projector reconciles           → disk ≠ base, records ≠ base
 *
 * On the three byte-hashes alone that reads as both moved, and a projector that captured every adoption would mint a
 * draft for words the records already hold. Clause 3 reads it through the congruence (`render(parse(disk)) == records`)
 * and answers NOOP `canonical-equivalent`; the caller pins the base at that agreement.
 *
 * The view the clause reads comes from ONE door — `canonicalizeCarrierText` (`@lararium/tw5/carrier-canonical`, a PURE
 * subpath: no barrel, no wasm), injected at the composition root beside `carrierFileFn`. It reuses `memeticIngestOps`, so
 * exactly one implementation of `≈` stands in the tree, and it carries the ahu-fidelity guard: a lossy round trip answers
 * null, which this gate reads as no equivalence. An ABSENT view never reads as equivalence: the file goes to capture,
 * the fail-closed direction, and the CONTROL below holds it there.
 */

import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { decideProjection } from "../src/projection-gate.js";
import { canonicalizeCarrierText } from "@lararium/tw5/carrier-canonical";

const hash = (s: string) => "sha256:" + createHash("sha256").update(s, "utf8").digest("hex");
const A = hash("stream A"), B = hash("stream B"), C = hash("stream C");

describe("the projection gate's decision law, clause for clause", () => {
  test("1 — disk == records → noop disk-matches-records (the echo gate, riding FIRST)", () => {
    // Rides first so a STALE base cannot send a file to capture where the two live streams already agree.
    expect(decideProjection({ diskHash: A, syncedHash: C, recordsHash: A }))
      .toEqual({ kind: "noop", reason: "disk-matches-records" });
    // The records falling behind the base changes nothing where the bytes already stand.
    expect(decideProjection({ diskHash: A, syncedHash: C, recordsHash: A, recordsBehindBase: true }))
      .toEqual({ kind: "noop", reason: "disk-matches-records" });
  });

  test("2 — no content file and no base at this path → project absent-on-disk (a first projection)", () => {
    expect(decideProjection({ diskHash: null, syncedHash: null, recordsHash: B }))
      .toEqual({ kind: "project", reason: "absent-on-disk" });
  });

  test("2 — no content file where a base stands → pending-removal vanished: nothing writes back", () => {
    expect(decideProjection({ diskHash: null, syncedHash: A, recordsHash: B }))
      .toEqual({ kind: "pending-removal", reason: "vanished" });
    // The records' side changes nothing: a later render gives no leave to write the file back.
    expect(decideProjection({ diskHash: null, syncedHash: A, syncedRecordsHash: A, recordsHash: A }))
      .toEqual({ kind: "pending-removal", reason: "vanished" });
    expect(decideProjection({ diskHash: null, syncedHash: A, recordsHash: B, recordsBehindBase: true }))
      .toEqual({ kind: "pending-removal", reason: "vanished" });
    // A person's `restore` writes it back.
    expect(decideProjection({ diskHash: null, syncedHash: A, recordsHash: B, answer: "restore" }))
      .toEqual({ kind: "project", reason: "restore-answered" });
    // CONTROL: `restore` answers a vanished file and nothing else: a standing file a hand moved still goes to capture.
    expect(decideProjection({ diskHash: A, syncedHash: null, recordsHash: B, answer: "restore" }))
      .toEqual({ kind: "capture", reason: "no-base" });
    expect(decideProjection({ diskHash: A, syncedHash: B, recordsHash: C, answer: "restore" }))
      .toEqual({ kind: "capture", reason: "both-moved" });
  });

  test("3 — disk's canonical view == records → noop canonical-equivalent (the carrier stands unchanged)", () => {
    // The two streams SAY the same thing, so nothing writes. The caller pins the base at this agreement.
    expect(decideProjection({ diskHash: A, syncedHash: B, recordsHash: C, diskCanonicalHash: C }))
      .toEqual({ kind: "noop", reason: "canonical-equivalent" });
  });

  test("3 — the equivalence rides AHEAD of the base clauses: a first seed with no base writes nothing", () => {
    expect(decideProjection({ diskHash: A, syncedHash: null, recordsHash: B, diskCanonicalHash: B }))
      .toEqual({ kind: "noop", reason: "canonical-equivalent" });
    // CONTROL: with no base and a disk that says something else, the file goes to capture.
    expect(decideProjection({ diskHash: A, syncedHash: null, recordsHash: B, diskCanonicalHash: C }))
      .toEqual({ kind: "capture", reason: "no-base" });
  });

  test("4 — disk == the base's disk side → project disk-unmoved (only the records moved)", () => {
    expect(decideProjection({ diskHash: A, syncedHash: A, recordsHash: B }))
      .toEqual({ kind: "project", reason: "disk-unmoved" });
  });

  test("4 — a base the records fell behind vouches for no write: the file holds the newer words, and goes to capture", () => {
    expect(decideProjection({ diskHash: A, syncedHash: A, recordsHash: B, recordsBehindBase: true }))
      .toEqual({ kind: "capture", reason: "records-behind-base" });
    // CONTROL: the same state with the records moved on from the base writes.
    expect(decideProjection({ diskHash: A, syncedHash: A, recordsHash: B, recordsBehindBase: false }))
      .toEqual({ kind: "project", reason: "disk-unmoved" });
  });

  test("5 — no base and a real difference → capture no-base (the projector writes nothing over a file no agreement covers)", () => {
    expect(decideProjection({ diskHash: A, syncedHash: null, recordsHash: B }))
      .toEqual({ kind: "capture", reason: "no-base" });
    // CONTROL: an empty path still takes its first projection, and equal bytes still echo.
    expect(decideProjection({ diskHash: null, syncedHash: null, recordsHash: B }))
      .toEqual({ kind: "project", reason: "absent-on-disk" });
    expect(decideProjection({ diskHash: B, syncedHash: null, recordsHash: B }))
      .toEqual({ kind: "noop", reason: "disk-matches-records" });
  });

  test("5 — records == the base's records side → capture disk-moved (the capture door lands the disk's words)", () => {
    // The disk moved alone: the projector writes nothing over it, and the capture door lands its words through the
    // ingest grade. The projecting leg never races the hand's edit.
    expect(decideProjection({ diskHash: A, syncedHash: B, recordsHash: B }))
      .toEqual({ kind: "capture", reason: "disk-moved" });
  });

  test("5 — all three differ, no canonical view → capture both-moved", () => {
    expect(decideProjection({ diskHash: A, syncedHash: B, recordsHash: C }))
      .toEqual({ kind: "capture", reason: "both-moved" });
  });

  test("the gate answers no `conflict` and no side-taking: every moved file reads `capture`", () => {
    const kinds = new Set<string>();
    for (const diskHash of [A, B, C, null]) for (const syncedHash of [A, B, C, null]) for (const recordsHash of [A, B, C]) {
      for (const recordsBehindBase of [false, true]) kinds.add(decideProjection({ diskHash, syncedHash, recordsHash, recordsBehindBase }).kind);
    }
    expect([...kinds].sort()).toEqual(["capture", "noop", "pending-removal", "project"]);
  });

  describe("a base pinned over a disk standing in another framing holds two sides", () => {
    // The agreement: the disk held bytes D, the records rendered R, and D says what R says.
    const D = hash("the disk's bytes, in their own framing");
    const R = hash("the records' render of the same carrier");
    const E = hash("the disk after a hand edit");
    const R2 = hash("the records after a wiki edit");

    test("the records moved alone: the disk side reads unmoved, and the write applies", () => {
      expect(decideProjection({ diskHash: D, syncedHash: D, syncedRecordsHash: R, recordsHash: R2, diskCanonicalHash: R }))
        .toEqual({ kind: "project", reason: "disk-unmoved" });
    });

    test("the disk moved alone: the RECORDS side reads unmoved, and the file goes to capture as disk-moved", () => {
      expect(decideProjection({ diskHash: E, syncedHash: D, syncedRecordsHash: R, recordsHash: R, diskCanonicalHash: hash("what E says") }))
        .toEqual({ kind: "capture", reason: "disk-moved" });
    });

    test("CONTROL: read against the disk side alone, the same state would read both-moved", () => {
      expect(decideProjection({ diskHash: E, syncedHash: D, recordsHash: R, diskCanonicalHash: hash("what E says") }))
        .toEqual({ kind: "capture", reason: "both-moved" });
    });

    test("both moved: the file goes to capture as both-moved", () => {
      expect(decideProjection({ diskHash: E, syncedHash: D, syncedRecordsHash: R, recordsHash: R2, diskCanonicalHash: hash("what E says") }))
        .toEqual({ kind: "capture", reason: "both-moved" });
    });

    test("nothing moved: the equivalence holds and nothing writes", () => {
      expect(decideProjection({ diskHash: D, syncedHash: D, syncedRecordsHash: R, recordsHash: R, diskCanonicalHash: R }))
        .toEqual({ kind: "noop", reason: "canonical-equivalent" });
    });
  });

  test("CONTROL — a GENUINE both-moved file still goes to capture with the clause armed", () => {
    // Without this, clause 3 could be satisfied by answering noop unconditionally. A real semantic divergence: the disk
    // says one thing (its canonical view is D), the records say another (C). The MEANING differs, never the framing alone.
    const D = hash("stream D");
    expect(decideProjection({ diskHash: A, syncedHash: B, recordsHash: C, diskCanonicalHash: D }))
      .toEqual({ kind: "capture", reason: "both-moved" });
  });

  test("CONTROL — an ABSENT canonical view sends the file to capture, never reads as equivalence", () => {
    // The null-as-default inversion, held at the door: null folds THREE causes — no canonicalizer injected, a family that
    // has none, a parse that graded error or a round trip that dropped a declared slot. All three mean "I cannot tell these
    // two states apart", so the house takes the file's words before anything writes. A caller that simply FORGETS the
    // field therefore gets the capture, never a quiet overwrite.
    for (const absent of [null, undefined]) {
      expect(decideProjection({ diskHash: A, syncedHash: B, recordsHash: C, diskCanonicalHash: absent }))
        .toEqual({ kind: "capture", reason: "both-moved" });
    }
  });

  test("the clause reads through digestsEqual — a tagged digest matches, a bare hash never does", () => {
    // CONTROL: the same tagged digest names the same digest.
    expect(decideProjection({ diskHash: A, syncedHash: B, recordsHash: C, diskCanonicalHash: C }))
      .toEqual({ kind: "noop", reason: "canonical-equivalent" });
    // A bare hex names no algorithm: no equivalence stands, and the file goes to capture.
    expect(decideProjection({ diskHash: A, syncedHash: B, recordsHash: C, diskCanonicalHash: C.slice("sha256:".length) }))
      .toEqual({ kind: "capture", reason: "both-moved" });
  });

  test("the `≈` clause rides ahead of `disk-moved` where both hold: nothing writes and nothing captures", () => {
    // The disk moved in framing alone and the records stand at the base. The equivalence answers first, and the caller
    // pins the base at the agreement the two legs share.
    expect(decideProjection({ diskHash: A, syncedHash: B, recordsHash: B, diskCanonicalHash: B }))
      .toEqual({ kind: "noop", reason: "canonical-equivalent" });
    // CONTROL: the echo gate still rides ahead of the equivalence.
    expect(decideProjection({ diskHash: B, syncedHash: A, recordsHash: B, diskCanonicalHash: B }))
      .toEqual({ kind: "noop", reason: "disk-matches-records" });
  });

  test("★ a BARE base names no agreement: the disk it names reads as moved, and the file goes to capture ★", () => {
    const bare = A.slice("sha256:".length);
    expect(decideProjection({ diskHash: A, syncedHash: bare, recordsHash: B }))
      .toEqual({ kind: "capture", reason: "both-moved" });
    // CONTROL: the same state against the TAGGED base reads the disk unmoved and projects.
    expect(decideProjection({ diskHash: A, syncedHash: A, recordsHash: B }))
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
    // and the gate reads that fact as no equivalence: the file goes to capture.
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
  //   CAPTURE                      0
  // The 46 matter more than the 655: `meme-corpus-roundtrip` states that corpus
  // files stay NON-CANONICAL AT REST until a deliberate normalization commit, so
  // the render normalizes framing and rule 1 misses on them. Only their absent
  // anchor keeps them clear; once an anchor lands they read `disk-unmoved`.
  test("a stale base cannot send a file to capture where disk and records agree", () => {
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

  test("with the doc moved off every carrier, a LIVE base sends each file to capture as both-moved, and an absent one as no-base", () => {
    const files = everyMem(repoBags);
    let bothMoved = 0, noBase = 0;
    for (const f of files) {
      const disk = hash(readFileSync(f, "utf-8"));
      const moved = hash(readFileSync(f, "utf-8") + "\nthe doc moved\n");
      const live = decideProjection({ diskHash: disk, syncedHash: hash("older"), recordsHash: moved });
      if (live.kind === "capture" && live.reason === "both-moved") bothMoved++;
      const fresh = decideProjection({ diskHash: disk, syncedHash: null, recordsHash: moved });
      if (fresh.kind === "capture" && fresh.reason === "no-base") noBase++;
    }
    expect(bothMoved).toBe(files.length);
    expect(noBase).toBe(files.length);
  });
});
