/**
 * THE INGEST SETTLE CRESTS ITS FIRST PASS AS A NALU.
 *
 * The 2026-11-22 lay handed the daemon one INGEST of 194 lares carriers and the shared Automerge engine died applying it.
 * The settle now crests its first pass the way the landing queue slices (`wave-crest`): whole families (a renamed carrier
 * with the deletion of the file it left), bounded by carriers, encoded bytes and estimated objects at once; a page the
 * daemon refuses as over budget comes back smaller (backpressure); a slow wave shrinks the next one (the servo); and a
 * gesture that stops names every wave it sent and every carrier it still owes. A stub gives every island answer: no engine runs.
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { INGEST_WAVE_LIMITS, VERB_RESULT_KEY, ingestWaveRefusal } from "@lararium/mesh";
import { SyncedTree } from "../src/synced-tree.js";
import { ingestVerdict, ingestWaveArgs, settleIngest, type IngestSubmitResult, type ScanRow, type SubmitIngestOpts } from "../src/ingest-scan.js";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });
const freshTree = (): SyncedTree => { root = mkdtempSync(join(tmpdir(), "ingest-pages-")); return new SyncedTree(join(root, "tree")); };

const BAG = "lar:///ha.ka.ba/bags/lares";
/** A carrier shaped like the lares holding's average: 18 KB and six ahu slots. */
const row = (i: number, extra: Partial<ScanRow> = {}): ScanRow => ({
  file: `/bags/lares/c${i}.mem`, uri: `lar:///ha.ka.ba/lares/c${String(i).padStart(3, "0")}`,
  text: "<<~ ahu slot=`#/s`>>\n".repeat(6) + "x".repeat(18_000), diskHash: `sha256:${i}`, syncedHash: null, status: "new", ext: ".mem", ...extra,
});
const opts = (candidates: ScanRow[], more: Partial<SubmitIngestOpts> = {}): SubmitIngestOpts => ({ source: "/bags/lares", toBag: BAG, candidates, did: "did:key:test", ...more });

/** A stub island: lands every carrier it receives, unless `answer` says otherwise; records each wave. */
function island(answer?: (wave: SubmitIngestOpts, n: number) => IngestSubmitResult | Error | null) {
  const waves: SubmitIngestOpts[] = [];
  const submit = async (o: SubmitIngestOpts): Promise<IngestSubmitResult> => {
    waves.push(o);
    const requestId = `req-${waves.length}`;
    const told = answer?.(o, waves.length);
    if (told instanceof Error) throw told;
    if (told) return { ...told, requestId };
    const renames = (o.deletions ?? []).flatMap((d) => o.candidates.filter((c) => c.renameFrom === d.uri).map((c) => ({ fromUri: d.uri, toUri: c.uri })));
    return { status: "done", requestId, results: { [VERB_RESULT_KEY]: { ok: true, output: {
      carriers: o.candidates.map((c) => ({ uri: c.uri, decision: c.renameFrom ? "rename-target" : "ingest" })),
      ...(renames.length > 0 ? { deletions: { renames } } : {}),
    } } } };
  };
  return { waves, submit };
}

describe("settleIngest — the first pass crests in bounded waves", () => {
  test("the lares holding (533 carriers) crests in waves that each fit the daemon's budget, and every carrier lands", async () => {
    const candidates = Array.from({ length: 533 }, (_, i) => row(i));
    const isl = island();
    const s = await settleIngest(opts(candidates), freshTree(), isl.submit);
    expect(isl.waves.length).toBeGreaterThan(5);
    for (const w of isl.waves) expect(ingestWaveRefusal("INGEST", ingestWaveArgs(w))).toBeNull();
    expect(s.landed.size).toBe(533);
    expect(s.unanswered).toEqual([]);
    expect(s.waves?.map((w) => w.requestId)).toEqual(isl.waves.map((_, i) => `req-${i + 1}`));
    expect(s.waves?.reduce((n, w) => n + w.carriers, 0)).toBe(533);
    expect(ingestVerdict(s).failed).toBe(false);
  });

  test("a rename rides the same wave as the deletion of the file it left; kāpae ride the first wave alone", async () => {
    const candidates = Array.from({ length: 120 }, (_, i) => row(i));
    const moved = [7, 60, 110].map((i) => ({ ...candidates[i]!, status: "renamed" as const, renameFrom: `lar:///gone/${i}` }));
    for (const m of moved) candidates[candidates.findIndex((c) => c.uri === m.uri)] = m;
    const deletions = moved.map((m) => ({ uri: m.renameFrom!, syncedHash: m.diskHash }));
    const isl = island();
    const s = await settleIngest(opts(candidates, { deletions, kapae: ["lar:///shadowed"] }), freshTree(), isl.submit);
    expect(isl.waves.length).toBeGreaterThan(1);
    for (const m of moved) {
      const wave = isl.waves.find((w) => w.candidates.some((c) => c.uri === m.uri))!;
      expect(wave.deletions?.map((d) => d.uri)).toContain(m.renameFrom);
    }
    expect(isl.waves.filter((w) => (w.kapae ?? []).length > 0)).toHaveLength(1);
    expect(isl.waves[0]!.kapae).toEqual(["lar:///shadowed"]);
    expect(s.landed.size).toBe(120);
  });

  test("a wave that fails stops the gesture and names its request id, the waves that landed and the debt by address", async () => {
    const candidates = Array.from({ length: 200 }, (_, i) => row(i));
    const isl = island((_w, n) => (n === 3 ? { status: "error", requestId: "", errorMessage: "the island refused the wave" } : null));
    const s = await settleIngest(opts(candidates), freshTree(), isl.submit);
    expect(isl.waves).toHaveLength(3);
    const sentBefore = isl.waves[0]!.candidates.length + isl.waves[1]!.candidates.length;
    expect(s.landed.size).toBe(sentBefore);
    expect(s.pageError?.requestId).toBe("req-3");
    expect(s.pageError?.unread).toBe(200 - sentBefore);
    expect(s.debt?.carriers).toHaveLength(200 - sentBefore);
    expect(s.waves?.map((w) => w.status)).toEqual(["done", "done", "error"]);
    expect(ingestVerdict(s).failed).toBe(true);
    expect(ingestVerdict(s).message).toMatch(/req-3/);
  });

  test("BACKPRESSURE: a page the daemon refuses as over budget comes back smaller, and nothing goes missing", async () => {
    const candidates = Array.from({ length: 100 }, (_, i) => row(i));
    const isl = island((w) => (w.candidates.length > 10 ? { status: "error", requestId: "", errorMessage: "ingest-wave-over-budget: too heavy", refusal: { reason: "ingest-wave-over-budget" } } : null));
    const s = await settleIngest(opts(candidates), freshTree(), isl.submit);
    expect(s.landed.size).toBe(100);
    expect(s.pageError).toBeUndefined();
    const landedWaves = isl.waves.filter((w) => w.candidates.length <= 10);
    expect(landedWaves.flatMap((w) => w.candidates.map((c) => c.uri)).sort()).toEqual(candidates.map((c) => c.uri).sort());
  });

  test("THE SERVO: a wave slower than its target shrinks the waves after it", async () => {
    const candidates = Array.from({ length: 300 }, (_, i) => row(i));
    let t = 0;
    const isl = island(() => { t += 60_000; return null; });
    await settleIngest(opts(candidates), freshTree(), isl.submit, { now: () => t, targetMs: 10_000 });
    const sizes = isl.waves.map((w) => w.candidates.length);
    expect(sizes[0]).toBeLessThanOrEqual(INGEST_WAVE_LIMITS.count);
    expect(sizes[2]!).toBeLessThan(sizes[0]!);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(300);
  });

  test("a wave whose wait ended reads committed, by its request id, never as failed", async () => {
    const candidates = Array.from({ length: 120 }, (_, i) => row(i));
    const waitEnded = Object.assign(new Error("stopped waiting; the vessel holds request req-w committed"), { requestId: "req-w", receiptState: "committed" });
    const isl = island((_w, n) => (n === 2 ? waitEnded : null));
    const s = await settleIngest(opts(candidates), freshTree(), isl.submit);
    expect(s.pageError?.outcome).toBe("committed");
    expect(s.pageError?.requestId).toBe("req-w");
    expect(s.waves?.at(-1)?.status).toBe("committed");
    expect(ingestVerdict(s).message).toMatch(/committed/);
    expect(ingestVerdict(s).message).not.toMatch(/failed/);
  });

  test("HOLE: a mass delete and a mass kāpae spread across waves that each fit the budget", async () => {
    const candidates = Array.from({ length: 3 }, (_, i) => row(i));
    const deletions = Array.from({ length: 900 }, (_, i) => ({ uri: `lar:///gone/${i}`, syncedHash: "sha256:g" }));
    const kapae = Array.from({ length: 900 }, (_, i) => `lar:///shade/${i}`);
    const isl = island();
    await settleIngest(opts(candidates, { deletions, kapae }), freshTree(), isl.submit);
    expect(isl.waves.length).toBeGreaterThan(2);
    for (const w of isl.waves) expect(ingestWaveRefusal("INGEST", ingestWaveArgs(w))).toBeNull();
    expect(isl.waves.flatMap((w) => (w.deletions ?? []).map((d) => d.uri)).sort()).toEqual(deletions.map((d) => d.uri).sort());
    expect(isl.waves.flatMap((w) => w.kapae ?? []).sort()).toEqual([...kapae].sort());
  });

  test("CONTROL: a light gesture still rides one wave, as before", async () => {
    const candidates = Array.from({ length: 8 }, (_, i) => row(i));
    const isl = island();
    const s = await settleIngest(opts(candidates), freshTree(), isl.submit);
    expect(isl.waves).toHaveLength(1);
    expect(s.landed.size).toBe(8);
  });
});
