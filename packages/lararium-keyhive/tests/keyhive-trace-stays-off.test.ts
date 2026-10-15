/**
 * keyhive-trace-stays-off — Keyhive's own tracing prints nothing unless a person asks by name.
 *
 * `setPanicHook` installs two things at once: the Rust panic translator, and a global trace dispatcher
 * at TRACE level that prints every step of Keyhive's work to the console (document ids, digests,
 * signature bytes). Around an offline act those lines bury the one answer a person asked for. So the
 * provider installs the hook only where `LAR_KEYHIVE_TRACE` asks.
 *
 * This file reads a process where NOBODY asked. `keyhive-trace-on-request.test.ts` holds the control:
 * the same probe, in a process where a person did, reads the trace.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { linesOfAnAct, TRACE_LINE } from "./keyhive-trace-probe.js";

describe("Keyhive's tracing stays off unless a person asks by name", () => {
  // Whatever the shell that runs the suite carries, this process asks for nothing.
  beforeAll(() => { delete process.env["LAR_KEYHIVE_TRACE"]; });

  test("with no toggle an act prints no Keyhive line on any console channel", async () => {
    const said = await linesOfAnAct();
    expect(said.filter((l) => TRACE_LINE.test(l))).toEqual([]);
  });

  test("a toggle that asks for nothing reads as off: empty, 0, false, and any other word", async () => {
    const { KEYHIVE_TRACE_ENV, keyhiveTraceAsked } = await import("../src/index.js");
    expect(KEYHIVE_TRACE_ENV).toBe("LAR_KEYHIVE_TRACE");
    for (const off of [{}, { LAR_KEYHIVE_TRACE: "" }, { LAR_KEYHIVE_TRACE: "0" }, { LAR_KEYHIVE_TRACE: "false" }, { LAR_KEYHIVE_TRACE: "yes" }, { LAR_KEYHIVE_TRACE: "trace" }]) {
      expect(keyhiveTraceAsked(off), JSON.stringify(off)).toBe(false);
    }
    expect(keyhiveTraceAsked({ LAR_KEYHIVE_TRACE: "1" })).toBe(true);
    expect(keyhiveTraceAsked({ LAR_KEYHIVE_TRACE: "true" })).toBe(true);
    // A realm that holds no environment (a browser) reads a global of the same name.
    const realm = globalThis as Record<string, unknown>;
    expect(keyhiveTraceAsked()).toBe(false);
    realm["LAR_KEYHIVE_TRACE"] = true;
    try { expect(keyhiveTraceAsked()).toBe(true); } finally { delete realm["LAR_KEYHIVE_TRACE"]; }
    expect(keyhiveTraceAsked()).toBe(false);
  });
});
