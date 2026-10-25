/**
 * The settle word, the gesture's half: `lares ingest --apply` names each carrier whose records it moved,
 * with the hash its records render, and asks the vessel to say when the projection those records cause
 * has run (`settle`, `@lararium/node` `shore-verb.ts`). The run then ends where a scan that follows reads
 * what the projection left, and no caller naps for it.
 *
 * The island stands as a function over the wave's carriers; the bound on its answer comes from the
 * writer's own built module.
 *
 * Controls: a carrier the gate left alone (`noop`) or refused names no render to wait on; an island's
 * refusal reads as no word, under its own name.
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VERB_RESULT_KEY, carrierHash } from "@lararium/mesh";
import { SyncedTree, bagsFileToUri } from "@lararium/node";
import { canonicalizeCarrierText } from "@lararium/tw5/carrier-canonical";
import { scanFiles, candidatesOf, listCarriers, settleIngest, type ScanRow, type SubmitIngestOpts } from "../src/ingest-core.js";
import { askSettle, type ShoreAnswer } from "../src/shore-core.js";
import type { SubmitResult } from "../src/verb-result.js";

const { boundOutcomeOutput } = await import(new URL("../../lararium-tw5/dist/verb-vm.js", import.meta.url).href) as {
  boundOutcomeOutput: (result: Record<string, unknown>) => Record<string, unknown>;
};

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const BAG = "lar:///ha.ka.ba/bags/x";
const uriOf = (i: number) => `lar:///ha.ka.ba/lares/api/settle-${String(i).padStart(3, "0")}`;
const framed = (i: number): string =>
  `<<^ code="&#x0001;" from="?" -> to="${uriOf(i)}">>\n<<^ code="&#x0002;">>\n\n` +
  "```toml meta\nzeta = \"last\"\nalpha = \"first\"\nuri-path = \"" + uriOf(i).slice("lar:///".length) + "\"\n```\n\n\n\n" +
  `body ${i}\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

function seed(n: number): ScanRow[] {
  root = mkdtempSync(join(tmpdir(), "ingest-settle-"));
  const dir = join(root, "bags", "@x", "ha.ka.ba", "lares", "api");
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < n; i++) writeFileSync(join(dir, `settle-${String(i).padStart(3, "0")}.mem`), framed(i));
  const tree = new SyncedTree(join(root, "synced"));
  return candidatesOf(scanFiles(root, listCarriers(join(root, "bags", "@x"))!, BAG, tree, bagsFileToUri).rows);
}

const islandRender = (c: ScanRow): string => `sha256:${"a".repeat(60)}${c.uri.slice(-3)}r`;
function island(decide: (c: ScanRow) => Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return async (opts: SubmitIngestOpts): Promise<SubmitResult> => {
    const carriers = opts.candidates.map((c) => ({ uri: c.uri, ...decide(c) }));
    return { status: "done", requestId: "req-1", results: { [VERB_RESULT_KEY]: { ok: true, output: boundOutcomeOutput({ carriers, ...extra }) } } } as SubmitResult;
  };
}
const HEAD_A = "a".repeat(64);
const HEAD_W = "b".repeat(64);
const opts = (candidates: ScanRow[]): SubmitIngestOpts => ({ source: "file:///scratch", toBag: BAG, candidates, did: "did:test" });

describe("the gesture names what its records moved", () => {
  test("under the cap: each landed carrier with the render the island named; a noop and a refusal name none", async () => {
    const candidates = seed(4);
    const tree = new SyncedTree(join(root, "synced"));
    // The noop row names a render too: the records never moved, so nothing waits on it.
    const settled = await settleIngest(opts(candidates), tree, island((c) =>
      c.uri === uriOf(2) ? { decision: "noop", canonicalHash: islandRender(c) } : c.uri === uriOf(3) ? { decision: "refuse", warnings: ["torn"] } : { decision: "ingest", canonicalHash: islandRender(c) }));
    expect(settled.rendered).toEqual([0, 1].map((i) => ({ uri: uriOf(i), records: islandRender(candidates.find((c) => c.uri === uriOf(i))!) })));
  });

  test("past the cap: each landed carrier no row named carries the render the pure door reads", async () => {
    const candidates = seed(40);
    const tree = new SyncedTree(join(root, "synced"));
    const settled = await settleIngest(opts(candidates), tree, island(() => ({ decision: "ingest" })));
    expect(settled.rendered).toHaveLength(40);
    const one = candidates.find((c) => c.uri === uriOf(7))!;
    expect(settled.rendered.find((r) => r.uri === uriOf(7))?.records).toBe(carrierHash(canonicalizeCarrierText(one.uri, one.text)!));
  });
});

describe("the gesture names the heads that carried its records (G36)", () => {
  test("under the cap: a row's own heads ride its rendered entry; a row that names none rides the wave's heads; a store with no history names none", async () => {
    const candidates = seed(3);
    const tree = new SyncedTree(join(root, "synced"));
    const settled = await settleIngest(opts(candidates), tree, island((c) =>
      c.uri === uriOf(0) ? { decision: "ingest", canonicalHash: islandRender(c), heads: [HEAD_A] } : { decision: "ingest", canonicalHash: islandRender(c) }, { heads: [HEAD_W] }));
    expect(settled.rendered.find((r) => r.uri === uriOf(0))?.heads).toEqual([HEAD_A]);
    expect(settled.rendered.find((r) => r.uri === uriOf(1))?.heads).toEqual([HEAD_W]);
    const bare = await settleIngest(opts(candidates), new SyncedTree(join(root, "synced-2")), island((c) => ({ decision: "ingest", canonicalHash: islandRender(c) })));
    expect(bare.rendered.every((r) => r.heads === undefined)).toBe(true);
  });

  test("past the cap: a carrier no row named rides the wave's heads", async () => {
    const candidates = seed(40);
    const tree = new SyncedTree(join(root, "synced"));
    const settled = await settleIngest(opts(candidates), tree, island(() => ({ decision: "ingest" }), { heads: [HEAD_W] }));
    expect(settled.rendered).toHaveLength(40);
    expect(settled.rendered.every((r) => r.heads?.[0] === HEAD_W)).toBe(true);
  });
});

describe("a carrier asked again names the render its first wave landed", () => {
  test("past the cap, a carrier the pure door cannot read gets asked again, answers `noop` over what the first wave landed, and still names its render", async () => {
    const candidates = seed(40);
    // One carrier the pure door cannot read: a frameless note.
    const plain = candidates[5]!;
    const plainCand: ScanRow = { ...plain, text: "a frameless note\n" };
    const all = candidates.map((c) => (c.uri === plain.uri ? plainCand : c));
    const tree = new SyncedTree(join(root, "synced"));
    let wave = 0;
    const submit = async (o: SubmitIngestOpts): Promise<SubmitResult> => {
      wave++;
      // The first wave lands every carrier; a later wave reads against what it left: `noop`, with the render.
      const carriers = o.candidates.map((c) => (wave === 1 ? { uri: c.uri, decision: "ingest" } : { uri: c.uri, decision: "noop", canonicalHash: islandRender(c) }));
      return { status: "done", requestId: `req-${wave}`, results: { [VERB_RESULT_KEY]: { ok: true, output: boundOutcomeOutput({ carriers }) } } } as SubmitResult;
    };
    const settled = await settleIngest(opts(all), tree, submit);
    expect(wave).toBe(2);
    expect(settled.rendered).toHaveLength(40);
    expect(settled.rendered.find((r) => r.uri === plain.uri)).toEqual({ uri: plain.uri, records: islandRender(plainCand) });
  });
});

describe("the gesture asks the settle word", () => {
  const answer = (ok: boolean, output: Record<string, unknown>): ShoreAnswer =>
    ({ ok, output, refusal: ok ? null : String(output["refusal"]), why: ok ? null : String(output["why"]) });

  test("it sends the bag and each carrier's render, and reads the island's counts", async () => {
    const sent: Array<Readonly<Record<string, unknown>>> = [];
    const read = await askSettle(async (a) => { sent.push(a); return answer(true, { ok: true, op: "settle", mirrored: true, settledCount: 2, elsewhereCount: 1 }); },
      BAG, [{ uri: "u1", records: "h1" }, { uri: "u2", records: "h2" }]);
    expect(sent).toEqual([{ op: "settle", bag: BAG, carriers: [{ uri: "u1", records: "h1" }, { uri: "u2", records: "h2" }] }]);
    expect(read).toEqual({ settled: true, shore: true, mirrored: true, settledCount: 2, elsewhereCount: 1, supersededCount: 0 });
  });

  test("it sends the heads a carrier named, and none for a carrier that named none", async () => {
    const sent: Array<Readonly<Record<string, unknown>>> = [];
    await askSettle(async (a) => { sent.push(a); return answer(true, { ok: true, op: "settle", mirrored: true, settledCount: 2 }); },
      BAG, [{ uri: "u1", records: "h1", heads: [HEAD_A] }, { uri: "u2", records: "h2" }]);
    expect(sent[0]!["carriers"]).toEqual([{ uri: "u1", records: "h1", heads: [HEAD_A] }, { uri: "u2", records: "h2" }]);
  });

  test("a far side that closed reads as no word, under its own name", async () => {
    expect(await askSettle(async () => answer(false, { ok: false, refusal: "far-side-closed", why: "the far side closed" }), BAG, [{ uri: "u", records: "h", heads: [HEAD_A] }]))
      .toMatchObject({ settled: false, refusal: "far-side-closed" });
  });

  test("CONTROL: an island's refusal reads as no word, under its own name; a bag no mirror holds reads as settled with nothing to wait on", async () => {
    expect(await askSettle(async () => answer(false, { ok: false, refusal: "projector-stopped", why: "stopped" }), BAG, [{ uri: "u", records: "h" }]))
      .toMatchObject({ settled: false, refusal: "projector-stopped" });
    expect(await askSettle(async () => answer(true, { ok: true, mirrored: false, settledCount: 0, elsewhereCount: 0 }), BAG, [{ uri: "u", records: "h" }]))
      .toMatchObject({ settled: true, mirrored: false });
  });

  test("a carrier a later word took reads as superseded, claimed as no projection", async () => {
    expect(await askSettle(async () => answer(true, { ok: true, mirrored: true, settledCount: 1, elsewhereCount: 0, supersededCount: 2, superseded: ["a", "b"] }), BAG, [{ uri: "u", records: "h" }]))
      .toEqual({ settled: true, shore: true, mirrored: true, settledCount: 1, elsewhereCount: 0, supersededCount: 2 });
  });
});
