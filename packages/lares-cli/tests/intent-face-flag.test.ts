import { beforeEach, describe, expect, test, vi } from "vitest";

const seam = vi.hoisted(() => ({ calls: [] as Array<[string, Record<string, unknown>]>, output: { id: "intent-1", rows: [] } as Record<string, unknown> }));
vi.mock("../src/store-door.js", () => ({
  storeVerb: async (verb: string, args: Record<string, unknown>) => {
    seam.calls.push([verb, args]);
    return { output: seam.output };
  },
  StoreDoorRefusal: class extends Error {},
}));

import { cmdIntent } from "../src/commands/intent.js";
import { parseArgs } from "../src/parse-args.js";

const run = (...argv: string[]) => cmdIntent(parseArgs(["intent", ...argv]));

describe("intent CLI face", () => {
  beforeEach(() => { seam.calls = []; seam.output = { id: "intent-1", rows: [] }; vi.spyOn(console, "log").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {}); });

  test("control: explicit h1 reaches issue; absent face reaches resolver for a sole-face positive", async () => {
    expect(await run("issue", "face-join", "--face", "1", "--to", "a".repeat(64))).toBe(0);
    expect(seam.calls[0]).toEqual(["intent-issue", expect.objectContaining({ face: 1 })]);
    expect(await run("show")).toBe(0);
    expect(seam.calls[1]).toEqual(["intent-show", expect.not.objectContaining({ face: expect.anything() })]);
  });

  test("bare, negated and malformed face refuse before the store door", async () => {
    for (const arg of ["--face", "--no-face", "--face=1.5", "--face=-1"]) {
      expect(await run("show", arg)).toBe(1);
    }
    expect(seam.calls).toEqual([]);
  });

  test("show prints a duplicate and unknown outcome count; control prints a proven zero", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => { lines.push(String(line)); });
    seam.output = { rows: [{ id: "one", status: "unknown-frontier", winner: null, duplicates: ["duplicate-cid"], voidAfterAct: ["late-cid"], outcomeCount: "unknown" }], standing: "unknown", strayAnswers: ["stray-cid"], refused: [] };
    expect(await run("show", "--face", "0")).toBe(0);
    expect(lines.join("\n")).toMatch(/duplicate-cid.*late-cid.*outcomes=unknown/);
    lines.length = 0;
    seam.output = { rows: [{ id: "one", status: "open", winner: null, duplicates: [], voidAfterAct: [], outcomeCount: 0 }], standing: "stands", strayAnswers: [], refused: [] };
    expect(await run("show", "--face", "0")).toBe(0);
    expect(lines.join("\n")).toMatch(/outcomes=0/);
  });
});
