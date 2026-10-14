/**
 * ingest-settles-every-row — an ingest past the outcome's audit cap still names every refused carrier and
 * pins every base.
 *
 * A durable outcome keeps every per-carrier row only under its audit cap; past it the outcome holds a
 * count, a tally, a hash, a sample, and every `refuse` and `conflict` row up to the cap
 * (`boundOutcomeOutput`, `@lararium/tw5`). The CLI reads that same outcome. A refusal a person cannot find
 * stays unfixable, so the settling gesture asks again, in waves under the cap, for every carrier whose row
 * the first answer left behind and that a person or the base still needs.
 *
 * The island here stands as a function over the wave's carriers; THE BOUND IS THE WRITER'S OWN, loaded
 * from the built module, never a hand-built twin.
 */

import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VERB_RESULT_KEY, carrierHash } from "@lararium/mesh";
import { SyncedTree, syncedTreeKey, bagsFileToUri } from "@lararium/node";
import { canonicalizeCarrierText } from "@lararium/tw5/carrier-canonical";
import { INGEST_PAGE, scanFiles, candidatesOf, listCarriers, readCarrierAnswer, settleIngest, ingestVerdict, standingAfterWave, standingAfterFault, standsClean, NO_STANDING_ASKS, type StandingAsks, type ScanRow, type SubmitIngestOpts } from "../src/ingest-core.js";
import type { SubmitResult } from "../src/verb-result.js";

const { boundOutcomeOutput, AUDIT_ARRAY_CAP } = await import(new URL("../../lararium-tw5/dist/verb-vm.js", import.meta.url).href) as {
  boundOutcomeOutput: (result: Record<string, unknown>) => Record<string, unknown>;
  AUDIT_ARRAY_CAP: number;
};

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const BAG = "lar:///ha.ka.ba/bags/x";
const uriOf = (i: number) => `lar:///ha.ka.ba/lares/api/note-${String(i).padStart(3, "0")}`;

/** A framed meme in a hand's own framing: an unsorted meta block and a wide margin. Its render differs from its bytes. */
const framed = (i: number): string =>
  `<<^ code="&#x0001;" from="?" -> to="${uriOf(i)}">>\n<<^ code="&#x0002;">>\n\n` +
  "```toml meta\nzeta = \"last\"\nalpha = \"first\"\nuri-path = \"" + uriOf(i).slice("lar:///".length) + "\"\n```\n\n\n\n" +
  `body ${i}\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

/** `n` carriers: a framed meme each, but every `plainEvery`-th one a frameless note the pure door cannot read. */
function seed(n: number, plainEvery = 0): { tree: SyncedTree; candidates: ScanRow[] } {
  root = mkdtempSync(join(tmpdir(), "settles-every-row-"));
  const dir = join(root, "bags", "@x", "ha.ka.ba", "lares", "api");
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < n; i++) {
    const plain = plainEvery > 0 && i % plainEvery === 0;
    writeFileSync(join(dir, `note-${String(i).padStart(3, "0")}.mem`), plain ? `a frameless note ${i}\n` : framed(i));
  }
  const tree = new SyncedTree(join(root, "synced.json"));
  const { rows } = scanFiles(root, listCarriers(join(root, "bags", "@x"))!, BAG, tree, bagsFileToUri);
  return { tree, candidates: candidatesOf(rows) };
}

/** The render the island's records hold for a carrier, as the fake island answers it. */
const islandRender = (c: ScanRow): string => `sha256:${"0".repeat(56)}${c.uri.slice(-3)}render`.slice(0, 71);

/** An island: decides each carrier of a wave, bounds its answer as the daemon's outcome does, and logs the wave. */
function island(decide: (c: ScanRow, wave: number) => Record<string, unknown>) {
  const waves: SubmitIngestOpts[] = [];
  const submit = async (opts: SubmitIngestOpts): Promise<SubmitResult> => {
    const wave = waves.push(opts);
    const carriers = opts.candidates.map((c) => ({ uri: c.uri, ...decide(c, wave) }));
    const output = boundOutcomeOutput({ carriers, ...(opts.deletions?.length ? { deletions: { renames: [], absent: opts.deletions.map((d) => d.uri), declined: [] } } : {}) });
    return { status: "done", requestId: `req-${wave}`, results: { [VERB_RESULT_KEY]: { ok: true, output } } } as SubmitResult;
  };
  return { waves, submit };
}
const opts = (candidates: ScanRow[]): SubmitIngestOpts => ({ source: "file:///scratch", toBag: BAG, candidates, did: "did:test" });
const refusal = (c: ScanRow) => ({ decision: "refuse", grade: "error", warnings: [`${c.uri}: torn frame refused`] });
const landed = (c: ScanRow) => ({ decision: "ingest", grade: "clean", landed: 1, canonicalHash: islandRender(c) });

describe("the weld: a page rides under the outcome's row cap", () => {
  test("INGEST_PAGE never exceeds AUDIT_ARRAY_CAP, and a full page answers with every row whole", () => {
    expect(INGEST_PAGE).toBeGreaterThan(0);
    expect(INGEST_PAGE).toBeLessThanOrEqual(AUDIT_ARRAY_CAP);
    const rows = Array.from({ length: INGEST_PAGE }, (_, i) => ({ uri: uriOf(i), decision: "refuse" }));
    expect(Array.isArray(boundOutcomeOutput({ carriers: rows })["carriers"])).toBe(true);
    // CONTROL: one row past the cap rides as a summary.
    expect(Array.isArray(boundOutcomeOutput({ carriers: [...rows, ...Array.from({ length: AUDIT_ARRAY_CAP - INGEST_PAGE + 1 }, () => ({ uri: "x", decision: "ingest" }))] })["carriers"])).toBe(false);
  });
});

describe("every refused carrier gets named, however many rows the wave holds", () => {
  test("a few refusals past the cap: the first answer names each with its refusal", async () => {
    const { tree, candidates } = seed(40);
    const bad = new Set([candidates[3]!.uri, candidates[17]!.uri, candidates[39]!.uri]);
    const isl = island((c) => (bad.has(c.uri) ? refusal(c) : landed(c)));
    const s = await settleIngest(opts(candidates), tree, isl.submit);
    // The setup took: the first answer crossed the cap and holds no row array.
    expect(readCarrierAnswer(boundOutcomeOutput({ carriers: candidates.map((c) => ({ uri: c.uri, decision: "ingest" })) })["carriers"]).bounded).not.toBeNull();
    expect(s.refused.map((r) => r.uri).sort()).toEqual([...bad].sort());
    for (const r of s.refused) {
      expect(r.why).toBe(`${r.uri}: torn frame refused`);
      expect(r.file).toMatch(/note-\d{3}\.mem$/);
    }
    expect(s.tallies).toEqual({ ingest: 37, refuse: 3 });
    // Every refusal rode the first answer, and each framed carrier's render reads through the pure door: one wave.
    expect(isl.waves.length).toBe(1);
  });

  test("more refusals than the cap: the gesture asks again in pages and names every one", async () => {
    const { tree, candidates } = seed(120);
    const bad = new Set(candidates.filter((_, i) => i % 2 === 0).map((c) => c.uri));   // 60 refusals
    const isl = island((c) => (bad.has(c.uri) ? refusal(c) : landed(c)));
    const s = await settleIngest(opts(candidates), tree, isl.submit);
    expect(s.refused.length).toBe(60);
    expect(s.refused.map((r) => r.uri).sort()).toEqual([...bad].sort());
    expect(new Set(s.refused.map((r) => r.why)).size).toBe(60);
    expect(s.tallies).toEqual({ ingest: 60, refuse: 60 });
    // The first wave named AUDIT_ARRAY_CAP refusals; the other 88 carriers went again in pages under the cap.
    expect(isl.waves.length).toBe(1 + Math.ceil((120 - AUDIT_ARRAY_CAP) / INGEST_PAGE));
    for (const wave of isl.waves.slice(1)) expect(wave.candidates.length).toBeLessThanOrEqual(INGEST_PAGE);
    const asked = isl.waves.slice(1).flatMap((w) => w.candidates.map((c) => c.uri));
    expect(new Set(asked).size).toBe(asked.length);
    expect(asked.length).toBe(120 - AUDIT_ARRAY_CAP);
    expect(s.pages.map((p) => p.requestId)).toEqual(isl.waves.slice(1).map((_, i) => `req-${i + 2}`));
    // Nothing refused got pinned; every landed carrier did.
    for (const c of candidates) expect(tree.base(syncedTreeKey(BAG, c.uri)) === null).toBe(bad.has(c.uri));
  });

  test("a conflict gets named beside the refusals and keeps its own count", async () => {
    const { tree, candidates } = seed(40);
    const isl = island((c) => (c.uri === candidates[5]!.uri ? { decision: "conflict", grade: "clean" } : c.uri === candidates[6]!.uri ? refusal(c) : landed(c)));
    const s = await settleIngest(opts(candidates), tree, isl.submit);
    expect(s.conflicts.map((r) => r.uri)).toEqual([candidates[5]!.uri]);
    expect(s.conflicts[0]!.why).toContain("both moved");
    expect(s.refused.map((r) => r.uri)).toEqual([candidates[6]!.uri]);
    expect(tree.base(syncedTreeKey(BAG, candidates[5]!.uri))).toBeNull();
  });

  test("CONTROL: under the cap one wave names every row, landed ones too", async () => {
    const { tree, candidates } = seed(8);
    const isl = island((c) => (c.uri === candidates[2]!.uri ? refusal(c) : landed(c)));
    const s = await settleIngest(opts(candidates), tree, isl.submit);
    expect(isl.waves.length).toBe(1);
    expect(s.named.size).toBe(8);
    expect(s.refused.map((r) => r.uri)).toEqual([candidates[2]!.uri]);
    expect(s.tallies).toEqual({ ingest: 7, refuse: 1 });
    expect(s.recorded).toBe(7);
  });

  test("CONTROL: a wave with nothing refused names no refusal and asks once", async () => {
    const { tree, candidates } = seed(40);
    const isl = island(landed);
    const s = await settleIngest(opts(candidates), tree, isl.submit);
    expect(s.refused).toEqual([]);
    expect(s.conflicts).toEqual([]);
    expect(isl.waves.length).toBe(1);
    expect(s.recorded).toBe(40);
  });

  test("a later wave that fails stops the gesture and says how many carriers stay unread", async () => {
    const { tree, candidates } = seed(120);
    const waves: SubmitIngestOpts[] = [];
    const inner = island((c) => refusal(c));
    const submit = async (o: SubmitIngestOpts): Promise<SubmitResult> => {
      waves.push(o);
      if (waves.length === 3) return { status: "error", requestId: "req-3", errorMessage: "the vessel recomposes — run again" } as SubmitResult;
      return inner.submit(o);
    };
    const s = await settleIngest(opts(candidates), tree, submit);
    expect(s.pageError).toEqual({ message: "the vessel recomposes — run again", unread: 120 - AUDIT_ARRAY_CAP - INGEST_PAGE });
    expect(s.refused.length).toBe(AUDIT_ARRAY_CAP + INGEST_PAGE);
    expect(waves.length).toBe(3);
  });

  test("a first wave that fails ends the gesture with nothing named and nothing pinned", async () => {
    const { tree, candidates } = seed(40);
    const s = await settleIngest(opts(candidates), tree, async () => ({ status: "error", requestId: "req-1", errorMessage: "cap-denied: admin" }) as SubmitResult);
    expect(s.first.status).toBe("error");
    expect(s.named.size).toBe(0);
    expect(s.recorded).toBe(0);
    expect(tree.size).toBe(0);
  });
});

describe("past the cap every landed carrier still pins both sides of its base", () => {
  test("a framed meme with no sidecar pins the render the pure door reads, with no second wave", async () => {
    const { tree, candidates } = seed(40);
    const isl = island(landed);
    await settleIngest(opts(candidates), tree, isl.submit);
    expect(isl.waves.length).toBe(1);
    for (const c of candidates) {
      const own = carrierHash(canonicalizeCarrierText(c.uri, c.text)!);
      expect(own).not.toBe(c.diskHash);   // the setup took: the bytes stand in another framing
      expect(tree.base(syncedTreeKey(BAG, c.uri))).toEqual({ path: c.file, disk: c.diskHash, records: own });
    }
  });

  test("a carrier the pure door cannot read goes again under the cap, and pins the render the island names", async () => {
    const { tree, candidates } = seed(80, 4);   // 20 frameless notes among 80
    const plain = candidates.filter((c) => canonicalizeCarrierText(c.uri, c.text) === null);
    expect(plain.length).toBe(20);
    const isl = island((c, wave) => (wave === 1 ? landed(c) : { decision: "noop", reason: "canonical-equivalent", canonicalHash: islandRender(c) }));
    const s = await settleIngest(opts(candidates), tree, isl.submit);
    expect(isl.waves.length).toBe(2);
    expect(isl.waves[1]!.candidates.map((c) => c.uri).sort()).toEqual(plain.map((c) => c.uri).sort());
    for (const c of plain) expect(tree.base(syncedTreeKey(BAG, c.uri))).toEqual({ path: c.file, disk: c.diskHash, records: islandRender(c) });
    expect(s.recorded).toBe(80);
    expect(s.refused).toEqual([]);
  });

  test("a carrier beside a sidecar goes again even where the pure door could read its body: the island names its render", async () => {
    const { tree, candidates: memes } = seed(40);
    // One more carrier: a body the pure door reads as a framed meme, beside a sidecar that declares its own type.
    const dir = join(root, "bags", "@x", "ha.ka.ba", "lares", "api");
    writeFileSync(join(dir, "note-900.md"), framed(900));
    writeFileSync(join(dir, "note-900.md.meta"), `title: ${uriOf(900)}\ntype: text/markdown\n`);
    const { rows } = scanFiles(root, listCarriers(join(root, "bags", "@x"))!, BAG, tree, bagsFileToUri);
    const candidates = candidatesOf(rows);
    expect(candidates.length).toBe(memes.length + 1);
    const beside = candidates.find((c) => c.uri === uriOf(900))!;
    expect(beside.meta).toBeDefined();
    expect(canonicalizeCarrierText(beside.uri, beside.text)).not.toBeNull();   // the door COULD read it
    const isl = island((c, wave) => (wave === 1 ? landed(c) : { decision: "noop", reason: "canonical-equivalent", canonicalHash: islandRender(c) }));
    await settleIngest(opts(candidates), tree, isl.submit);
    expect(isl.waves.length).toBe(2);
    expect(isl.waves[1]!.candidates.map((c) => c.uri)).toEqual([uriOf(900)]);
    expect(tree.base(syncedTreeKey(BAG, uriOf(900)))).toEqual({ path: beside.file, disk: beside.diskHash, records: islandRender(beside) });
  });

  test("a carrier the island re-homed from a vanished source rides the deletion summary: never asked again, never pinned here", async () => {
    const { tree, candidates } = seed(40);
    const moved = candidates[11]!;
    const waves: SubmitIngestOpts[] = [];
    const submit = async (o: SubmitIngestOpts): Promise<SubmitResult> => {
      waves.push(o);
      const carriers = o.candidates.map((c) => (c.uri === moved.uri ? { uri: c.uri, decision: "rename-target" } : { uri: c.uri, ...landed(c) }));
      carriers.push({ uri: moved.uri, decision: "rename" });
      const output = boundOutcomeOutput({ carriers, deletions: { renames: [{ fromUri: "lar:///ha.ka.ba/lares/api/gone", toUri: moved.uri }], absent: [], declined: [] } });
      return { status: "done", requestId: `req-${waves.length}`, results: { [VERB_RESULT_KEY]: { ok: true, output } } } as SubmitResult;
    };
    const s = await settleIngest({ ...opts(candidates), deletions: [{ uri: "lar:///ha.ka.ba/lares/api/gone", syncedHash: moved.diskHash }] }, tree, submit);
    expect(waves.length).toBe(1);
    expect(s.recorded).toBe(39);
    expect(tree.base(syncedTreeKey(BAG, moved.uri))).toBeNull();
    expect(s.deletions?.["renames"]).toHaveLength(1);
  });

  test("a tally that proves less than every unnamed carrier landed sends them all again: each row decides", async () => {
    const { tree, candidates } = seed(40);
    // The island answers one carrier short on the first wave (a row this reader cannot place).
    const waves: SubmitIngestOpts[] = [];
    const submit = async (o: SubmitIngestOpts): Promise<SubmitResult> => {
      const wave = waves.push(o);
      const rows = o.candidates.map((c) => ({ uri: c.uri, ...landed(c) }));
      const carriers = wave === 1 ? [...rows.slice(1), { uri: "lar:///elsewhere", decision: "tombstone" }] : rows;
      return { status: "done", requestId: `req-${wave}`, results: { [VERB_RESULT_KEY]: { ok: true, output: boundOutcomeOutput({ carriers }) } } } as SubmitResult;
    };
    const s = await settleIngest(opts(candidates), tree, submit);
    expect(waves.length).toBe(1 + Math.ceil(40 / INGEST_PAGE));
    expect(s.named.size).toBe(40);
    for (const c of candidates) expect(tree.base(syncedTreeKey(BAG, c.uri))).toEqual({ path: c.file, disk: c.diskHash, records: islandRender(c) });
  });

  test("deletions and the change id ride the first wave alone", async () => {
    const { tree, candidates } = seed(120);
    const isl = island((c) => refusal(c));
    await settleIngest({ ...opts(candidates), deletions: [{ uri: "lar:///gone", syncedHash: "sha256:aa" }], changeId: "chg-first" }, tree, isl.submit);
    expect(isl.waves[0]!.deletions).toEqual([{ uri: "lar:///gone", syncedHash: "sha256:aa" }]);
    expect(isl.waves[0]!.changeId).toBe("chg-first");
    expect(isl.waves.length).toBeGreaterThan(1);
    for (const wave of isl.waves.slice(1)) {
      expect(wave.deletions).toBeUndefined();
      expect(wave.changeId).toBeUndefined();
    }
  });
});

describe("a refusal never reads as applied", () => {
  test("a refused carrier fails the run and the sentence names each one", async () => {
    const { tree, candidates } = seed(40);
    const isl = island((c) => (c.uri === candidates[9]!.uri ? refusal(c) : landed(c)));
    const verdict = ingestVerdict(await settleIngest(opts(candidates), tree, isl.submit));
    expect(verdict.failed).toBe(true);
    expect(verdict.message).toBe(`INGEST refused 1 of 40 carrier(s): ${candidates[9]!.uri}`);
  });

  test("a later wave that failed fails the run and counts what stays unread", async () => {
    const { tree, candidates } = seed(120);
    let n = 0;
    const inner = island((c) => refusal(c));
    const verdict = ingestVerdict(await settleIngest(opts(candidates), tree, async (o) => (++n === 2
      ? ({ status: "error", requestId: "req-2", errorMessage: "the vessel recomposes" } as SubmitResult)
      : inner.submit(o))));
    expect(verdict.failed).toBe(true);
    expect(verdict.message).toContain(`${120 - AUDIT_ARRAY_CAP} carrier(s) stay unread`);
  });

  test("CONTROL: a clean run and a run holding a conflict alone both pass, and the conflict stays named", async () => {
    const { tree, candidates } = seed(40);
    expect(ingestVerdict(await settleIngest(opts(candidates), tree, island(landed).submit))).toEqual({ failed: false, message: null });
    const s = await settleIngest(opts(candidates), tree, island((c) => (c.uri === candidates[4]!.uri ? { decision: "conflict" } : { decision: "noop", canonicalHash: islandRender(c) })).submit);
    expect(ingestVerdict(s).failed).toBe(false);
    expect(s.conflicts.map((c) => c.uri)).toEqual([candidates[4]!.uri]);
  });
});

describe("a watcher reads what it still owes at its stop, by address", () => {
  const gone = (uri: string) => ({ uri, syncedHash: "sha256:aa" });
  /** An island that applies the wave's deletions and names each as a tombstone. */
  const applying = (decide: (c: ScanRow, wave: number) => Record<string, unknown>) => island(decide);

  test("a refused carrier stays owed until a wave lands THAT carrier", async () => {
    const { tree, candidates } = seed(8);
    const bad = candidates[2]!;
    let standing = NO_STANDING_ASKS;
    standing = standingAfterWave(standing, await settleIngest(opts(candidates), tree, island((c) => (c.uri === bad.uri ? refusal(c) : landed(c))).submit));
    expect([...standing.owed]).toEqual([[bad.uri, `${bad.uri}: torn frame refused`]]);
    // A wave over OTHER carriers lands whole and clears nothing.
    standing = standingAfterWave(standing, await settleIngest(opts(candidates.slice(4)), tree, island(landed).submit));
    expect(standing.owed.has(bad.uri)).toBe(true);
    expect(standsClean(standing)).toBe(false);
    // A hand cures the file: the wave that lands it clears the debt.
    standing = standingAfterWave(standing, await settleIngest(opts([bad]), tree, island(landed).submit));
    expect(standsClean(standing)).toBe(true);
  });

  test("a wave the island answers with an error leaves every carrier and deletion it carried owed", async () => {
    const { tree, candidates } = seed(6);
    const errored = async (): Promise<SubmitResult> => ({ status: "error", requestId: "r", errorMessage: "cap-denied: admin" }) as SubmitResult;
    let standing = standingAfterWave(NO_STANDING_ASKS, await settleIngest({ ...opts(candidates), deletions: [gone("lar:///gone")] }, tree, errored));
    expect([...standing.owed.keys()].sort()).toEqual(candidates.map((c) => c.uri).sort());
    expect([...standing.owed.values()].every((why) => why === "cap-denied: admin")).toBe(true);
    expect([...standing.owedDeletions]).toEqual([["lar:///gone", "cap-denied: admin"]]);
    // A later wave over half of them clears that half alone, and the deletion stays owed.
    standing = standingAfterWave(standing, await settleIngest(opts(candidates.slice(0, 3)), tree, island(landed).submit));
    expect([...standing.owed.keys()].sort()).toEqual(candidates.slice(3).map((c) => c.uri).sort());
    expect(standing.owedDeletions.has("lar:///gone")).toBe(true);
  });

  test("a later page that fails leaves the unread carriers owed by address", async () => {
    const { tree, candidates } = seed(120);
    let n = 0;
    const inner = island((c) => refusal(c));
    const s = await settleIngest(opts(candidates), tree, async (o) => (++n === 2 ? ({ status: "error", requestId: "r2", errorMessage: "the vessel recomposes" } as SubmitResult) : inner.submit(o)));
    const standing = standingAfterWave(NO_STANDING_ASKS, s);
    expect(standing.owed.size).toBe(120);
    expect([...standing.owed.values()].filter((why) => why === "a later wave failed (the vessel recomposes)").length).toBe(120 - AUDIT_ARRAY_CAP);
  });

  test("a fault in flight leaves the whole wave owed, and keeps what already stood", () => {
    const before: StandingAsks = { owed: new Map([["lar:///x", "why"]]), owedDeletions: new Map() };
    const after = standingAfterFault(before, { asked: ["lar:///a", "lar:///b"], askedDeletions: ["lar:///gone"] }, "socket closed");
    expect([...after.owed]).toEqual([["lar:///x", "why"], ["lar:///a", "socket closed"], ["lar:///b", "socket closed"]]);
    expect([...after.owedDeletions]).toEqual([["lar:///gone", "socket closed"]]);
  });

  test("a vanished address the island declined stays owed; a later wave over OTHER addresses clears nothing; its own re-link clears it", async () => {
    const { tree, candidates } = seed(8);
    const declining = async (o: SubmitIngestOpts): Promise<SubmitResult> => ({ status: "done", requestId: "req-d", results: { [VERB_RESULT_KEY]: { ok: true, output: { carriers: o.candidates.map((c) => ({ uri: c.uri, ...landed(c) })), deletions: { renames: [], absent: [], declined: (o.deletions ?? []).map((d) => d.uri) } } } } }) as SubmitResult;
    let standing = standingAfterWave(NO_STANDING_ASKS, await settleIngest({ ...opts(candidates.slice(0, 2)), deletions: [gone("lar:///gone-1"), gone("lar:///gone-2")] }, tree, declining));
    expect([...standing.owedDeletions.keys()]).toEqual(["lar:///gone-1", "lar:///gone-2"]);
    expect([...standing.owedDeletions.values()][0]).toContain("pending at the vessel's shore");
    // The carriers of that wave landed: a declined address holds no carrier back.
    expect(standing.owed.size).toBe(0);
    // Another address settles in a later wave: the declined ones stay owed.
    standing = standingAfterWave(standing, await settleIngest({ ...opts(candidates.slice(0, 2)), deletions: [gone("lar:///gone-3")] }, tree, applying(landed).submit));
    expect([...standing.owedDeletions.keys()]).toEqual(["lar:///gone-1", "lar:///gone-2"]);
    // The declined addresses ride again and settle: nothing stays owed.
    standing = standingAfterWave(standing, await settleIngest({ ...opts([]), deletions: [gone("lar:///gone-1"), gone("lar:///gone-2")] }, tree, applying(landed).submit));
    expect(standsClean(standing)).toBe(true);
  });

  test("a done answer that names no row for a carrier leaves that carrier owed, and the run fails", async () => {
    const { tree, candidates } = seed(6);
    // The island answers `done` and omits the rows (no `carriers` field at all).
    const hollow = async (): Promise<SubmitResult> => ({ status: "done", requestId: "r", results: { [VERB_RESULT_KEY]: { ok: true, output: {} } } }) as SubmitResult;
    const s = await settleIngest(opts(candidates), tree, hollow);
    expect(s.unanswered.sort()).toEqual(candidates.map((c) => c.uri).sort());
    expect(s.recorded).toBe(0);
    const verdict = ingestVerdict(s);
    expect(verdict.failed).toBe(true);
    expect(verdict.message).toContain("drew no answer for 6 of 6 carrier(s)");
    expect(standingAfterWave(NO_STANDING_ASKS, s).owed.size).toBe(6);
    // CONTROL: the same wave answered whole leaves nothing unanswered.
    const whole = await settleIngest(opts(candidates), tree, island(landed).submit);
    expect(whole.unanswered).toEqual([]);
    expect([...whole.landed].sort()).toEqual(candidates.map((c) => c.uri).sort());
  });

  test("a conflict stays out of the debts: the island surfaced it for a hand", async () => {
    const { tree, candidates } = seed(4);
    const s = await settleIngest(opts(candidates), tree, island((c) => (c.uri === candidates[1]!.uri ? { decision: "conflict" } : landed(c))).submit);
    expect(s.unanswered).toEqual([]);
    expect(standsClean(standingAfterWave(NO_STANDING_ASKS, s))).toBe(true);
  });
});
