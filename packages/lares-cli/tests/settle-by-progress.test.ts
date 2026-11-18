/**
 * SETTLE BY PROGRESS. A settle over many carriers asks the islands a page at a time; a projector still working
 * through a large bag answers some pages after this caller's own per-page wait ran out (`LocalWaitExpired`).
 * Such a page goes back on a retry queue and the settle keeps asking while pages keep settling; it stops only
 * where no page newly settled for the stall window (`SETTLE_STALL_MS`), names what still waits, and leaves a
 * resumable record under the house's run dir that `lares shore settle --bag <bag> --pending` picks up.
 *
 * The islands stand as functions over the pages they get; the clock comes injected, so no test waits out a
 * real window.
 *
 * Controls: a fault that names no expired wait still throws; a settle that completes clears the record.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VERB_RESULT_KEY } from "@lararium/mesh";
import type { SubmitResult } from "../src/verb-result.js";
import type { ParsedArgs } from "../src/parse-args.js";

type RunVerb = (name: string, args: Record<string, unknown>, did: string, opts: { timeoutMs: number }) => Promise<SubmitResult>;

// `lares shore settle --pending` reaches the vessel through `runVerb`; the test hands it a fake vessel.
const hoisted = vi.hoisted(() => ({ run: null as null | RunVerb }));
vi.mock("../src/verb-call.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/verb-call.js")>();
  return { ...real, runVerb: (...a: Parameters<RunVerb>) => hoisted.run!(...a) };
});
vi.mock("../src/env.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/env.js")>();
  return { ...real, vesselDid: async () => "did:test" };
});

const { askShore, askSettle, SETTLE_PAGE, SETTLE_STALL_MS, readSettlePending, settlePendingPath } = await import("../src/shore-core.js");
const { LocalWaitExpired } = await import("../src/local-connector.js");
const { cmdShore } = await import("../src/commands/shore.js");

const BAG = "lar:///ha.ka.ba/bags/seed";
const NO_SHORE: Record<string, unknown> = { ok: false, refusal: "no-disk-shore", why: "this island mounts no disk projection" };
const uriOf = (i: number) => `lar:///ha.ka.ba/seed/c${String(i).padStart(3, "0")}`;
const carriersOf = (n: number) => Array.from({ length: n }, (_, i) => ({ uri: uriOf(i), records: `h${i}`, heads: ["a".repeat(64)] }));

/** One island's answer to a settle page: every carrier of the page settled. */
const settledPage = (shoreArgs: Record<string, unknown>): Record<string, unknown> => {
  const page = (shoreArgs["carriers"] as Array<{ uri: string }>).map((c) => c.uri);
  return { ok: true, op: "settle", mirrored: true, settled: page, settledCount: page.length, elsewhere: [], elsewhereCount: 0, superseded: [], supersededCount: 0 };
};

/**
 * A vessel whose active wiki's island mirrors the bag and whose daemon island mounts no shore. `answer`
 * decides each wiki ask: "settle" answers the page, "wait" throws the caller's own expired wait. Each ask
 * moves the fake clock by `stepMs`.
 */
function vessel(answer: (firstUri: string, askNo: number) => "settle" | "wait", stepMs: number) {
  let t = 0;
  const asks = new Map<string, number>();
  const run: RunVerb = async (name, args, _did, opts) => {
    t += stepMs;
    const island = name === "wiki-act" ? "wiki" : "daemon";
    const shoreArgs = island === "wiki" ? (args["args"] as Record<string, unknown>) : args;
    const done = (output: Record<string, unknown>): SubmitResult =>
      ({ status: "done", requestId: `req-${island}`, results: { [VERB_RESULT_KEY]: { ok: true, output } } }) as SubmitResult;
    if (island === "daemon") return done(NO_SHORE);
    const first = String((shoreArgs["carriers"] as Array<{ uri: string }>)[0]?.uri);
    const n = (asks.get(first) ?? 0) + 1;
    asks.set(first, n);
    if (answer(first, n) === "wait") throw new LocalWaitExpired(name, opts.timeoutMs, `req-${first}-${n}`);
    return done(settledPage(shoreArgs));
  };
  return { run, now: () => t, asks };
}

let root = "";
let savedRoot: string | undefined;
beforeEach(() => {
  savedRoot = process.env["LAR_ROOT"];
  root = mkdtempSync(join(tmpdir(), "settle-progress-"));
  process.env["LAR_ROOT"] = root;
});
afterEach(() => {
  if (savedRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = savedRoot;
  rmSync(root, { recursive: true, force: true });
  hoisted.run = null;
  vi.restoreAllMocks();
});

const parsed = (positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ positional, options, flags: { json: false, ...flags } }) as unknown as ParsedArgs;

describe("settle keeps waiting while the projector makes progress", () => {
  test("(a) a 468-carrier settle whose slow pages time out once settles whole: 468 settled, 0 pending, 0 stalled", async () => {
    const carriers = carriersOf(468);
    expect(Math.ceil(carriers.length / SETTLE_PAGE)).toBe(15);
    // Every third page answers after the caller's own wait ran out, then settles on the retry; each ask
    // costs a page's worth of real wait (36.4 s), so a settle that stopped at the first expiry would stop here.
    const slow = new Set(Array.from({ length: 15 }, (_, p) => uriOf(p * SETTLE_PAGE)).filter((_, p) => p % 3 === 0));
    const v = vessel((first, n) => (slow.has(first) && n === 1 ? "wait" : "settle"), 36_400);
    const ask = (a: Readonly<Record<string, unknown>>) => askShore(a, "did:test", v.run, { now: v.now, sleep: async () => {} });
    const out = (await ask({ op: "settle", bag: BAG, carriers })).output;
    expect(out).toMatchObject({ ok: true, settledCount: 468, pendingCount: 0, stalledCount: 0, stalled: false });
    const read = await askSettle(ask, BAG, carriers, { record: true });
    expect(read).toMatchObject({ settled: true, stalled: false, settledCount: 468, pendingCount: 0, stalledCount: 0 });
    expect(existsSync(settlePendingPath(BAG))).toBe(false);
    expect(SETTLE_STALL_MS).toBe(120_000);
  });

  test("(b) a projector that stops progressing ends after the stall window, names what waits, and leaves a resumable record", async () => {
    const carriers = carriersOf(468);
    // Five pages settle, then nothing more ever answers.
    const settles = new Set(Array.from({ length: 5 }, (_, p) => uriOf(p * SETTLE_PAGE)));
    const v = vessel((first) => (settles.has(first) ? "settle" : "wait"), 10);
    const ask = (a: Readonly<Record<string, unknown>>) => askShore(a, "did:test", v.run, { stallMs: 100, now: v.now, sleep: async () => {} });
    const read = await askSettle(ask, BAG, carriers, { record: true });
    expect(read).toMatchObject({ settled: false, stalled: true, settledCount: 5 * SETTLE_PAGE, pendingCount: 468 - 5 * SETTLE_PAGE, refusal: "settle-stalled" });
    expect(read.stalledCount).toBeGreaterThan(0);
    expect(read.stalledCount).toBeLessThanOrEqual(read.pendingCount);
    expect(read.pendingUris).toContain(uriOf(5 * SETTLE_PAGE));
    expect(read.pendingUris).not.toContain(uriOf(0));
    // The record names every carrier still waiting, with what a resumed word sends.
    expect(read.recordPath).toBe(settlePendingPath(BAG));
    expect(read.recordPath!.startsWith(join(root, "run"))).toBe(true);
    const record = readSettlePending(BAG);
    expect(record?.bag).toBe(BAG);
    expect(record?.carriers).toHaveLength(468 - 5 * SETTLE_PAGE);
    expect(record?.carriers[0]).toEqual({ uri: uriOf(5 * SETTLE_PAGE), records: `h${5 * SETTLE_PAGE}`, heads: ["a".repeat(64)] });
    expect(JSON.parse(readFileSync(read.recordPath!, "utf8")).carriers).toHaveLength(468 - 5 * SETTLE_PAGE);
    // The window held: no ask ran past it by more than one page's wait.
    expect(v.now()).toBeLessThan(10 * 20 + 100 + 10);
  });

  test("CONTROL: a fault that names no expired wait still throws, and stops the settle", async () => {
    const run: RunVerb = async () => { throw new Error("no lares daemon at /x"); };
    await expect(askShore({ op: "settle", bag: BAG, carriers: carriersOf(3) }, "did:test", run, { sleep: async () => {} })).rejects.toThrow(/no lares daemon/);
  });
});

describe("(c) lares shore settle --pending resumes from the record", () => {
  test("a resumed settle that completes prints the counts and clears the record", async () => {
    const carriers = carriersOf(100);
    const stuck = vessel((first) => (first === uriOf(0) ? "settle" : "wait"), 10);
    await askSettle((a) => askShore(a, "did:test", stuck.run, { stallMs: 50, now: stuck.now, sleep: async () => {} }), BAG, carriers, { record: true });
    expect(readSettlePending(BAG)?.carriers).toHaveLength(100 - SETTLE_PAGE);

    const healed = vessel(() => "settle", 1);
    hoisted.run = healed.run;
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { lines.push(a.join(" ")); });
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { lines.push(a.join(" ")); });
    expect(await cmdShore(parsed(["settle"], { bag: BAG }, { pending: true }))).toBe(0);
    const said = lines.join("\n");
    expect(said).toMatch(new RegExp(`settled ${100 - SETTLE_PAGE}`));
    expect(said).toMatch(/0 pending/);
    expect(said).not.toMatch(/⚠/);
    expect(readSettlePending(BAG)).toBeNull();
    // The resumed word asked only what waited.
    expect([...healed.asks.keys()]).not.toContain(uriOf(0));
  });

  test("no record stands: it says so and exits 0", async () => {
    hoisted.run = async () => { throw new Error("no ask expected"); };
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { lines.push(a.join(" ")); });
    expect(await cmdShore(parsed(["settle"], { bag: BAG }, { pending: true }))).toBe(0);
    expect(lines.join("\n")).toMatch(/no settle record/);
  });
});
