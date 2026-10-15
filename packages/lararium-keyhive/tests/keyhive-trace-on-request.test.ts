/**
 * keyhive-trace-on-request — the control beside `keyhive-trace-stays-off`: in a process where a person
 * asked by name (`LAR_KEYHIVE_TRACE=1`), the same probe reads Keyhive's trace. A probe that read nothing
 * here would prove nothing there.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { linesOfAnAct, TRACE_LINE } from "./keyhive-trace-probe.js";

describe("Keyhive's tracing answers a person who asks by name", () => {
  const prior = process.env["LAR_KEYHIVE_TRACE"];
  beforeAll(() => { process.env["LAR_KEYHIVE_TRACE"] = "1"; });
  afterAll(() => { if (prior === undefined) delete process.env["LAR_KEYHIVE_TRACE"]; else process.env["LAR_KEYHIVE_TRACE"] = prior; });

  test("CONTROL: with LAR_KEYHIVE_TRACE=1 the same acts print Keyhive's trace", async () => {
    const said = await linesOfAnAct();
    const traced = said.filter((l) => TRACE_LINE.test(l));
    expect(traced.length).toBeGreaterThan(0);
    expect(traced.some((l) => l.includes("We've just set panic hook"))).toBe(true);
  });
});
