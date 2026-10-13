/**
 * ingest-bounded-answer — an ingest past the outcome's audit cap still reads its answer.
 *
 * A durable outcome keeps every per-carrier row only under its audit cap; past it the outcome holds
 * `{ boundedArrayCount, tallies, sha256, sample }` in the rows' place (`boundOutcomeOutput`, `@lararium/tw5`), and
 * the CLI reads that same outcome. A whole-bag seed crosses the cap. The reader names the two shapes; the
 * recorder records a bounded wave only where the tally proves every submitted carrier landed or matched.
 */

import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SyncedTree, syncedTreeKey, bagsFileToUri } from "@lararium/node";
import { scanFiles, candidatesOf, listCarriers, readCarrierAnswer, recordLandedAnswer, refusedCount } from "../src/ingest-core.js";

// THE WRITER'S OWN BOUNDING, never a hand-built twin: the vector reads the shape the daemon writes. The function
// rides no package door, so the built module loads by path.
const { boundOutcomeOutput } = await import(new URL("../../lararium-tw5/dist/verb-vm.js", import.meta.url).href) as {
  boundOutcomeOutput: (result: Record<string, unknown>) => Record<string, unknown>;
};

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const BAG = "lar:///ha.ka.ba/bags/x";
const N = 40;   // past the audit cap of 32

function seed() {
  root = mkdtempSync(join(tmpdir(), "bounded-answer-"));
  const dir = join(root, "bags", "@x", "ha.ka.ba", "lares", "api");
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < N; i++) writeFileSync(join(dir, `note-${String(i).padStart(2, "0")}.mem`), `! note ${i}\n\nbody ${i}\n`);
  const tree = new SyncedTree(join(root, "synced.json"), 0);
  const files = listCarriers(join(root, "bags", "@x"))!;
  const { rows } = scanFiles(root, files, BAG, tree, bagsFileToUri);
  return { tree, candidates: candidatesOf(rows) };
}

/** The outcome's own bounding, applied to the rows an island would answer. */
function bounded(rows: Array<Record<string, unknown>>): unknown {
  return boundOutcomeOutput({ carriers: rows })["carriers"];
}

describe("an ingest past the audit cap reads its answer", () => {
  test("★ the reader names both shapes: rows under the cap, a count and a tally past it ★", () => {
    const { candidates } = seed();
    expect(candidates.length).toBe(N);
    const rows = candidates.map((c) => ({ uri: c.uri, decision: "ingest" }));
    const past = bounded(rows);
    expect(Array.isArray(past)).toBe(false);   // the fixture crosses the cap: the outcome holds no row array
    const answer = readCarrierAnswer(past);
    expect(answer.bounded).toEqual({ count: N, tallies: { ingest: N } });
    expect(answer.rows.length).toBe(3);
    // CONTROL: under the cap the rows ride whole.
    const under = readCarrierAnswer(bounded(rows.slice(0, 5)));
    expect(under.bounded).toBeNull();
    expect(under.rows.length).toBe(5);
    // CONTROL: an absent or foreign field answers no rows and no tally.
    expect(readCarrierAnswer(undefined)).toEqual({ rows: [], bounded: null });
    expect(readCarrierAnswer({ boundedArrayCount: "40" })).toEqual({ rows: [], bounded: null });
  });

  test("★ a bounded wave of ingests and noops records every submitted carrier ★", () => {
    const { tree, candidates } = seed();
    const rows = candidates.map((c, i) => ({ uri: c.uri, decision: i % 2 === 0 ? "ingest" : "noop" }));
    expect(recordLandedAnswer(tree, BAG, candidates, readCarrierAnswer(bounded(rows)))).toBe(N);
    for (const c of candidates) expect(tree.get(syncedTreeKey(BAG, c.uri))).toBe(c.diskHash);
  });

  test("a bounded wave holding one refuse or one conflict records nothing, and the refuse still counts", () => {
    for (const odd of ["refuse", "conflict"]) {
      const { tree, candidates } = seed();
      const rows = candidates.map((c, i) => ({ uri: c.uri, decision: i === 7 ? odd : "ingest" }));
      const answer = readCarrierAnswer(bounded(rows));
      expect(recordLandedAnswer(tree, BAG, candidates, answer), odd).toBe(0);
      for (const c of candidates) expect(tree.get(syncedTreeKey(BAG, c.uri))).toBeNull();
      expect(refusedCount(answer), odd).toBe(odd === "refuse" ? 1 : 0);
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a bounded tally that counts every candidate landed AND holds a refuse this reader cannot place records nothing", () => {
    const { tree, candidates } = seed();
    const rows = [...candidates.map((c) => ({ uri: c.uri, decision: "ingest" })), { uri: "lar:///elsewhere", decision: "refuse" }];
    expect(recordLandedAnswer(tree, BAG, candidates, readCarrierAnswer(bounded(rows)))).toBe(0);
  });

  test("a bounded tally that answers fewer carriers than the wave submitted records nothing", () => {
    const { tree, candidates } = seed();
    const rows = candidates.slice(0, N - 1).map((c) => ({ uri: c.uri, decision: "ingest" }));
    expect(recordLandedAnswer(tree, BAG, candidates, readCarrierAnswer(bounded(rows)))).toBe(0);
  });

  test("CONTROL: under the cap each row decides its own carrier", () => {
    const { tree, candidates } = seed();
    const few = candidates.slice(0, 4);
    const rows = [{ uri: few[0]!.uri, decision: "ingest" }, { uri: few[1]!.uri, decision: "refuse" }, { uri: few[2]!.uri, decision: "noop" }, { uri: few[3]!.uri, decision: "conflict" }];
    const answer = readCarrierAnswer(bounded(rows));
    expect(recordLandedAnswer(tree, BAG, few, answer)).toBe(2);
    expect(refusedCount(answer)).toBe(1);
  });
});
