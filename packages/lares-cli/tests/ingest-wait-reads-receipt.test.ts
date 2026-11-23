/**
 * A WAIT THAT ENDS READS THE RECEIPT BEFORE IT SPEAKS.
 *
 * The 2026-11-22 lay's INGEST committed (`lares vessel request sha256:b1eeeca1…` read committed), but the CLI's 87.6 s wait
 * ran out first and the lay printed ✗ "ingest failed". Now, when a wave's wait ends, the gesture reads that same request's
 * receipt: an outcome that landed reads as the outcome, `committed` reads committed, and anything else stays unknown with
 * its request id. The wait itself scales with the carriers and bytes the wave sends, capped. Stubs stand in for every door here.
 */
import { describe, expect, test } from "vitest";
import { VERB_RESULT_KEY } from "@lararium/mesh";
import { INGEST_WAIT_CAP_MS, type ScanRow } from "@lararium/node";
import { submitIngest, WaveWaitEnded, type IngestDoors } from "../src/ingest-core.js";
import { LocalWaitExpired, type ReceiptAnswer } from "../src/local-connector.js";
import { verbFailure } from "../src/verb-call.js";
import { layHoldingLine, type LayHolding } from "../src/commands/lay.js";
import { ingestRunReading } from "../src/commands/ingest.js";
import type { IngestSettlement } from "../src/ingest-core.js";

const row = (i: number, bytes = 200): ScanRow => ({ file: `/b/c${i}.mem`, uri: `lar:///ha.ka.ba/t/c${i}`, text: "x".repeat(bytes), diskHash: `sha256:${i}`, syncedHash: null, status: "new", ext: ".mem" });
const opts = (n: number, bytes?: number) => ({ source: "/b", toBag: "lar:///ha.ka.ba/bags/t", candidates: Array.from({ length: n }, (_, i) => row(i, bytes)), did: "did:key:test" });

/** Doors whose verb wait always ends; the receipt answers `answer`. Records the wait each wave asked for. */
function doors(answer: (requestId: string) => ReceiptAnswer | Error): IngestDoors & { asked: number[]; reads: string[] } {
  const asked: number[] = [];
  const reads: string[] = [];
  return {
    asked, reads,
    run: async (verb, _args, _by, o = {}) => { asked.push(o.timeoutMs ?? 0); throw new LocalWaitExpired(verb, o.timeoutMs ?? 0, o.requestId ?? "req-x"); },
    receipt: async (requestId) => { reads.push(requestId); const a = answer(requestId); if (a instanceof Error) throw a; return a; },
  };
}

describe("submitIngest — the receipt speaks after the wait", () => {
  test("an outcome that landed reads as the wave's own answer, from the same request id", async () => {
    const d = doors((requestId) => ({ requestId, state: "done", results: { [VERB_RESULT_KEY]: { ok: true, output: { carriers: [] } } } }));
    const r = await submitIngest(opts(3), d);
    expect(r.status).toBe("done");
    expect(d.reads).toEqual([r.requestId]);
    expect(r.results?.[VERB_RESULT_KEY]?.ok).toBe(true);
  });

  test("committed reads committed, by its id, and never as failed", async () => {
    const d = doors((requestId) => ({ requestId, state: "committed" }));
    const err = await submitIngest(opts(3), d).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WaveWaitEnded);
    expect((err as WaveWaitEnded).receiptState).toBe("committed");
    const f = verbFailure(err);
    expect(f.code).toBe("outcome-committed");
    expect(f.requestId).toBe((err as WaveWaitEnded).requestId);
    expect(f.message).toMatch(/committed/);
    expect(f.message).not.toMatch(/fail/);
  });

  test("a receipt that cannot answer keeps the outcome unknown with its id", async () => {
    for (const answer of [
      (requestId: string): ReceiptAnswer => ({ requestId, state: "unanswered" }),
      (requestId: string): ReceiptAnswer => ({ requestId, state: "unknown" }),
      (): Error => new Error("socket gone"),
    ]) {
      const err = await submitIngest(opts(2), doors(answer)).catch((e: unknown) => e);
      expect((err as WaveWaitEnded).receiptState).toBe("unknown");
      expect(verbFailure(err).code).toBe("outcome-unknown");
      expect(verbFailure(err).requestId).toBeTruthy();
    }
  });

  test("a dead engine's refusal on the receipt read gives no verdict on the wave: it stays unknown and names the engine", async () => {
    const d = doors((requestId) => ({ requestId, state: "error", errorMessage: "engine-terminated: this vessel's Automerge engine stopped", refusal: { reason: "engine-terminated" } }));
    const err = await submitIngest(opts(2), d).catch((e: unknown) => e);
    expect((err as WaveWaitEnded).receiptState).toBe("unknown");
    expect(verbFailure(err).message).toMatch(/engine-terminated/);
  });

  test("committed on a fallen vessel names the fall: the outcome lands only after the hand restarts it", async () => {
    const d = doors((requestId) => ({ requestId, state: "committed", engine: { status: "engine-terminated", cause: "module-terminated" } } as ReceiptAnswer));
    const err = await submitIngest(opts(2), d).catch((e: unknown) => e);
    expect((err as WaveWaitEnded).receiptState).toBe("committed");
    const f = verbFailure(err);
    expect(f.code).toBe("outcome-committed");
    expect(f.message).toMatch(/committed, but the engine stopped \(module-terminated\)/);
    expect(f.message).toMatch(/will not land until the hand restarts the vessel/);
  });

  test("the wait scales with the carriers and the bytes a wave sends, and stops at its cap", async () => {
    const small = doors((requestId) => ({ requestId, state: "committed" }));
    await submitIngest(opts(2), small).catch(() => {});
    const heavy = doors((requestId) => ({ requestId, state: "committed" }));
    await submitIngest(opts(2, 900_000), heavy).catch(() => {});
    const many = doors((requestId) => ({ requestId, state: "committed" }));
    await submitIngest(opts(48), many).catch(() => {});
    const huge = doors((requestId) => ({ requestId, state: "committed" }));
    await submitIngest(opts(4_000), huge).catch(() => {});
    expect(heavy.asked[0]!).toBeGreaterThan(small.asked[0]!);
    expect(many.asked[0]!).toBeGreaterThan(small.asked[0]!);
    expect(huge.asked[0]!).toBe(INGEST_WAIT_CAP_MS);
  });
});

describe("the lay's holding line tells committed from failed", () => {
  const h = { holding: "lares", source: "/b/lares", toBag: "lar:///ha.ka.ba/bags/lares", gesture: "ingest" as const };
  test("a committed wave prints committed with its request id and the read-back command, never ✗", () => {
    const row: LayHolding = { ...h, exitCode: 6, outcome: { state: "committed", requestId: "sha256:b1eeeca1" } };
    const line = layHoldingLine(row, 533, "1m27s");
    expect(line).not.toMatch(/✗/);
    expect(line).toMatch(/committed/);
    expect(line).toContain("lares vessel request sha256:b1eeeca1");
  });

  test("an unknown outcome prints unknown with its id; a real failure still prints ✗; a clean one ✓", () => {
    expect(layHoldingLine({ ...h, exitCode: 6, outcome: { state: "unknown", requestId: "req-u" } }, 5, "3s")).toMatch(/unknown.*req-u/);
    expect(layHoldingLine({ ...h, exitCode: 4 }, 5, "3s")).toMatch(/^✗/);
    expect(layHoldingLine({ ...h, exitCode: 0 }, 5, "3s")).toMatch(/^✓/);
  });
});

describe("lares ingest — a committed later wave reads committed in the envelope and the exit", () => {
  /** A settlement whose first wave landed and whose second wave's wait ended with its receipt read back. */
  const stopped = (outcome: "committed" | "unknown"): IngestSettlement => ({
    first: { status: "done", requestId: "req-first-wave" }, pages: [], submitted: 96, asked: [], askedDeletions: [],
    landed: new Set(Array.from({ length: 48 }, (_, i) => `lar:///t/c${i}`)), unanswered: [], named: new Map(), refused: [], conflicts: [], derived: [],
    tallies: { ingest: 48 }, deletions: undefined, recorded: 48, rendered: [],
    pageError: { message: "stopped waiting", unread: 48, requestId: "req-second-wave", outcome },
    waves: [{ requestId: "req-first-wave", carriers: 48, deletions: 0, status: "done" }, { requestId: "req-second-wave", carriers: 48, deletions: 0, status: outcome }],
  });

  test("committed: code outcome-committed, exit 6, a ◐ headline naming the wave's id; never ✗ or verb-error", () => {
    const r = ingestRunReading(stopped("committed"), { candidates: 96, requestId: "req-first-wave", kapaeFault: null });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("outcome-committed");
    expect(r.exit).toBe(6);
    expect(r.headline).toMatch(/^INGEST ◐/);
    expect(r.headline).toContain("req-second-wave");
    expect(r.headline).not.toMatch(/✗|failed/);
  });

  test("unknown: code outcome-unknown, exit 6, ◐ with the id", () => {
    const r = ingestRunReading(stopped("unknown"), { candidates: 96, requestId: "req-first-wave", kapaeFault: null });
    expect(r.code).toBe("outcome-unknown");
    expect(r.exit).toBe(6);
    expect(r.headline).toMatch(/^INGEST ◐.*unknown.*req-second-wave/);
  });

  test("CONTROL: a later wave the island refused still fails as verb-error with ✗", () => {
    const s = { ...stopped("committed"), pageError: { message: "the island refused", unread: 48, requestId: "req-second-wave" } };
    const r = ingestRunReading(s, { candidates: 96, requestId: "req-first-wave", kapaeFault: null });
    expect(r.code).toBe("verb-error");
    expect(r.exit).toBe(4);
    expect(r.headline).toMatch(/^INGEST ✗/);
  });
});

