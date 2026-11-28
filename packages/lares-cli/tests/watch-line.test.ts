/**
 * watch-line — `lares watch` LOOPS HELD CALLS (lar:///engine.filter.watches, comms-ux-enacts landing 16): each call carries the
 * last answer's `id` and `as-of`, the line prints one answer per change, and it ends when the watch ends, leaves, or is unasked.
 * A fake asker stands in for the vessel; nothing here polls on a timer.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { watchLine, type WatchAsk } from "../src/commands/watch-line.js";
import { isCallHead } from "../src/commands/call.js";
import type { ParsedArgs } from "../src/parse-args.js";
import type { SubmitResult } from "../src/verb-result.js";

const args: ParsedArgs = { command: "watch", positional: [], options: {}, flags: { json: true } };
const plan = (params: Record<string, string>) => ({ verb: "call", args: { verb: "watch", params, surface: "cli" } });
const answer = (output: Record<string, unknown>, requestId = "r"): SubmitResult =>
  ({ status: "done", requestId, results: { summary: { ok: true, output } } }) as unknown as SubmitResult;

/** An asker that answers in turn and records each call's params and wait. */
function scripted(answers: readonly SubmitResult[]): { ask: WatchAsk; calls: Array<{ params: Record<string, unknown>; timeoutMs: number }> } {
  const calls: Array<{ params: Record<string, unknown>; timeoutMs: number }> = [];
  let i = 0;
  return {
    calls,
    ask: async (callArgs, timeoutMs) => {
      calls.push({ params: { ...(callArgs["params"] as Record<string, unknown>) }, timeoutMs });
      const next = answers[i++];
      if (next === undefined) throw new Error("the line asked past the script");
      return next;
    },
  };
}

afterEach(() => { vi.restoreAllMocks(); });

describe("lares watch holds its calls in a loop", () => {
  test("RED: watch reads as a call head beside get, put, delete and rename", () => {
    expect(isCallHead("watch")).toBe(true);
  });

  test("RED: each call carries the last id and as-of; one line prints per change; ended ends the line", async () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { out.push(String(chunk)); return true; });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const asker = scripted([
      answer({ band: "unchanged", id: "w1", asOf: "d0", filter: "[tag[memory]]" }),
      answer({ band: "changed", id: "w1", asOf: "d1", has: "<<~ has name=`lar:///engine.filter.watches` params=`band/changed`>>" }),
      answer({ band: "ended", id: "w1", asOf: "d2" }),
    ]);
    expect(await watchLine(args, plan({ filter: "[tag[memory]]", hold: "2000" }), asker)).toBe(0);
    expect(asker.calls.map((c) => [c.params["id"], c.params["as-of"]])).toEqual([[undefined, undefined], ["w1", "d0"], ["w1", "d1"]]);
    expect(asker.calls.every((c) => c.timeoutMs > 2000)).toBe(true);
    const bands = out.map((line) => (JSON.parse(line) as { data: { band: string } }).data.band);
    expect(bands).toEqual(["changed", "ended"]);
  });

  test("RED: an unask answers once and ends; CONTROL: a refusal prints the vessel's words and exits non-zero", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const unask = scripted([answer({ band: "removed", id: "w1" })]);
    expect(await watchLine(args, plan({ id: "w1", mu: "unask" }), unask)).toBe(0);
    expect(unask.calls).toHaveLength(1);
    const refused = scripted([{ status: "error", requestId: "r", errorMessage: "watch-withdrawn: the caller left" } as SubmitResult]);
    expect(await watchLine(args, plan({ filter: "[tag[memory]]" }), refused)).not.toBe(0);
  });
});
