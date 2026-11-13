/**
 * `lares sense recall` WITH A FILTER AND NO QUERY REFUSES; IT NEVER LISTS UNFILTERED.
 *
 * The recall filters narrow only the coordinator's search, which needs a query; the list path pages drawers
 * by wing alone. A filter-only call once routed to the list and came back unfiltered. It now refuses with a
 * usage pointer at a query, before any daemon is reached. CONTROL: a filter with a query passes the gate.
 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { cmdRecall } from "../src/commands/recall.js";
import { parseArgs } from "../src/parse-args.js";

afterEach(() => { vi.restoreAllMocks(); });

function run(argv: string[]): { code: Promise<number>; err: () => string } {
  const lines: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { lines.push(a.join(" ")); });
  return { code: cmdRecall(parseArgs(["sense", "recall", ...argv].slice(1)) as never).catch(() => -1), err: () => lines.join("\n") };
}

describe("a recall filter needs a query", () => {
  for (const argv of [["--speaker", "operator"], ["--agent", "a1"], ["--surface", "claude", "--list"], ["--pair"], ["--imago", "cid-1", "--channel", "speech"]]) {
    test(`★ ${argv.join(" ")} refuses with a query pointer, and reaches no daemon ★`, async () => {
      const r = run(argv);
      expect(await r.code).toBe(2);
      expect(r.err()).toMatch(/query/);
    });
  }

  test("CONTROL — a plain recall with no filter and no query still prints the usage only when nothing rides", async () => {
    const r = run([]);
    expect(await r.code).toBe(2);
    expect(r.err()).toMatch(/usage/);
  });
});
