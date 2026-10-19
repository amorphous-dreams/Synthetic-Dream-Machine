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
const slot = `${root}/wikis/witness/working`;
const canon = `${root}/bags/witness`;
const act = (verb: string, options: Record<string, string>, flags: Record<string, boolean> = {}) =>
  cmdAct({ command: "act", positional: [verb], options, flags: { json: true, yes: true, ...flags } } as ParsedArgs);

afterEach(() => { calls.length = 0; vi.restoreAllMocks(); });

describe("act placement", () => {
  test("CREATE and canon-to-canon MOVE reach the daemon", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await act("CREATE", { bag: canon });
    await act("MOVE", { title: "lar:///witness/book/title", from: canon, to: `${root}/bags/other` });
    expect(calls.map((call) => call.verb)).toEqual(["CREATE", "MOVE"]);
  });

  test("slot destinations and MOVE sources reach their wiki", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await act("LOAD", { "source-uri": "https://example.invalid/book", to: slot });
    await act("COPY", { title: "lar:///witness/book/title", from: canon, to: slot });
    await act("ADD", { title: "lar:///witness/book/title", from: canon, to: slot });
    await act("MOVE", { title: "lar:///witness/book/title", from: slot, to: canon });
    expect(calls.map((call) => call.verb)).toEqual(["wiki-act", "wiki-act", "wiki-act", "wiki-act"]);
    expect(calls.every((call) => call.args["wiki"] === "witness")).toBe(true);
  });

  test("without --in-wiki, a canon LOAD and a bag CLEAR keep the daemon's reach", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await act("LOAD", { "source-uri": "https://example.invalid/book", to: canon });
    await act("CLEAR", { bag: slot });
    expect(calls.map((call) => call.verb)).toEqual(["LOAD", "CLEAR"]);
  });

  test("--in-wiki stands as the hand's explicit ask: it wraps the act for the active wiki and names no wiki", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await act("CLEAR", { bag: slot }, { "in-wiki": true });
    expect(calls.map((call) => call.verb)).toEqual(["wiki-act"]);
    expect(calls[0]!.args["wiki"]).toBeUndefined();
  });
});
