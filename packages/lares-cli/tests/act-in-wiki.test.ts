import { afterEach, describe, expect, test, vi } from "vitest";

const calls = vi.hoisted(() => [] as Array<{ verb: string; args: Record<string, unknown> }>);
vi.mock("../src/verb-call.js", async (orig) => ({
  ...(await orig<typeof import("../src/verb-call.js")>()),
  runVerb: async (verb: string, args: Record<string, unknown>) => {
    calls.push({ verb, args });
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: {} } } };
  },
}));
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
}));

import { cmdAct } from "../src/commands/act.js";
import type { ParsedArgs } from "../src/parse-args.js";

const root = "lar:///ha.ka.ba";
const canon = `${root}/bags/witness`;
const slot = `${root}/wikis/witness/working`;
const act = (verb: string, options: Record<string, string>) =>
  cmdAct({ command: "act", positional: [verb], options, flags: { json: true, yes: true, "in-wiki": true } } as ParsedArgs);

afterEach(() => { calls.length = 0; vi.restoreAllMocks(); });

describe("the explicit in-wiki ask", () => {
  test("wraps canon LOAD and bag CLEAR for the active wiki without a wiki argument", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await act("LOAD", { "source-uri": "https://example.invalid/book", to: canon });
    await act("CLEAR", { bag: slot });
    expect(calls.map((call) => call.verb)).toEqual(["wiki-act", "wiki-act"]);
    expect(calls.map((call) => Object.keys(call.args).sort())).toEqual([["args", "verb"], ["args", "verb"]]);
    expect(calls.map((call) => call.args["verb"])).toEqual(["LOAD", "CLEAR"]);
  });

  test("keeps an explicit ask on the active wiki when the destination names a slot", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await act("LOAD", { "source-uri": "https://example.invalid/book", to: slot });
    expect(calls[0]?.verb).toBe("wiki-act");
    expect(calls[0]?.args["wiki"]).toBeUndefined();
  });
});
