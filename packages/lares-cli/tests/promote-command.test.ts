/**
 * `lares trust` and `lares kapae` — the operator's doors onto a wiki's promoted rites and onto the face-wide brake.
 *
 * Each act reaches the store door's matching row (`promote-list|prepare|commit|drop|orphan`, `kapae-raise|lower|flag`) with the arguments
 * the row reads (a wiki, a digest, a reason) and prints the row's answer as JSON. A malformed ask refuses before the door. The wiki
 * rides `--wiki` (absent: the daemon wiki). Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const seam = vi.hoisted(() => ({ calls: [] as Array<[string, Record<string, unknown>]>, output: {} as Record<string, unknown> }));
vi.mock("../src/store-door.js", () => ({
  storeVerb: async (verb: string, args: Record<string, unknown>) => { seam.calls.push([verb, args]); return { output: seam.output }; },
  StoreDoorRefusal: class extends Error {},
}));

import { cmdPromote } from "../src/commands/promote.js";
import { cmdKapae } from "../src/commands/kapae.js";
import { parseArgs } from "../src/parse-args.js";

const promote = (...argv: string[]) => cmdPromote(parseArgs(["promote", ...argv]));
const kapae = (...argv: string[]) => cmdKapae(parseArgs(["kapae", ...argv]));
const D = "d".repeat(64);

describe("lares trust", () => {
  let lines: string[];
  beforeEach(() => {
    seam.calls = []; seam.output = { ok: true }; lines = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => { lines.push(String(line)); });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  test("RED: list, prepare, commit and drop reach their rows with the wiki, digest and reason, and print the row's answer as JSON", async () => {
    expect(await promote("list", "wiki=garden", "face=1")).toBe(0);
    expect(await promote("prepare", D, "why=opens the field-notes macro")).toBe(0);
    expect(await promote("commit", D, "wiki=garden")).toBe(0);
    expect(await promote("drop", D)).toBe(0);
    expect(seam.calls).toEqual([
      ["promote-list", { wiki: "garden", face: 1 }],
      ["promote-prepare", { digest: D, why: "opens the field-notes macro" }],
      ["promote-commit", { digest: D, wiki: "garden" }],
      ["promote-drop", { digest: D }],
    ]);
    expect(JSON.parse(lines[0]!)).toEqual({ ok: true });
  });

  test("RED: orphan names `--keep` or `--drop`; CONTROL: neither, both, a malformed digest, a missing reason refuse (1) and a bare or unknown act is a usage refusal (2), all before the door", async () => {
    expect(await promote("orphan", D, "keep=true")).toBe(0);
    expect(await promote("orphan", D, "drop=true")).toBe(0);
    expect(seam.calls).toEqual([["promote-orphan", { digest: D, decision: "keep" }], ["promote-orphan", { digest: D, decision: "drop" }]]);
    seam.calls = [];
    expect(await promote("orphan", D)).toBe(1);
    expect(await promote("orphan", D, "keep=true", "drop=true")).toBe(1);
    expect(await promote("commit", "nope")).toBe(1);
    expect(await promote("prepare", D)).toBe(1);
    expect(await promote()).toBe(2);
    expect(await promote("teleport", D)).toBe(2);
    expect(seam.calls).toEqual([]);
  });
});

describe("lares kapae", () => {
  beforeEach(() => {
    seam.calls = []; seam.output = { ok: true };
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  test("RED: raise, lower and flag reach their rows with the wiki, digest and reason; CONTROL: a flag without a reason, a bad digest refuse (1) and a bare or unknown act is a usage refusal (2), all before the door", async () => {
    expect(await kapae("raise", D, "wiki=garden")).toBe(0);
    expect(await kapae("lower", D)).toBe(0);
    expect(await kapae("flag", D, "why=the macro leaks the field notes")).toBe(0);
    expect(seam.calls).toEqual([
      ["kapae-raise", { digest: D, wiki: "garden" }],
      ["kapae-lower", { digest: D }],
      ["kapae-flag", { digest: D, why: "the macro leaks the field notes" }],
    ]);
    seam.calls = [];
    expect(await kapae("flag", D)).toBe(1);
    expect(await kapae("raise", "nope")).toBe(1);
    expect(await kapae()).toBe(2);
    expect(seam.calls).toEqual([]);
  });
});

test("the staged-code door exposes trust in place of promote", async () => {
  const { COMMAND_NAMES } = await import("../src/bin/lares.js");
  expect(COMMAND_NAMES).toContain("trust");
  expect(COMMAND_NAMES).not.toContain("promote");
});

test("an old spelling meets the plain refusal, which names lares help", async () => {
  const { dispatch } = await import("../src/bin/lares.js");
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  for (const args of [["promote", "list", "unexpected=true"], ["nexus", "promote", "open", "unexpected=true"], ["sense", "promote", "memory", "unexpected=true"]]) {
    expect(await dispatch(args)).toBe(2);
    expect(err.mock.calls.at(-1)?.join(" ")).toContain("lares help");
  }
  err.mockRestore();
});

test("trust dispatches the existing wire verb and narrowed paths refuse unrelated flags", async () => {
  const { dispatch } = await import("../src/bin/lares.js");
  seam.calls = [];
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await dispatch(["trust", "list"])).toBe(0);
  expect(seam.calls.at(-1)?.[0]).toBe("promote-list");
  expect(await dispatch(["nexus", "approve", "check", "a", "b", "purpose=x"])).toBe(2);
  expect(await dispatch(["sense", "harden", "x", "wing=x"])).toBe(2);
  expect(err.mock.calls.flat().join(" ")).toContain("unknown param");
  err.mockRestore();
});
