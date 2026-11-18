/**
 * lei-terms — `lares lei terms kui|restring|unstring`: the one line of terms the pūlama's hand door takes.
 *
 * A vessel under a pūlama sends its lei acts to the pūlama (`pulama-main.js lei <act> '<terms>'`), which opens no document,
 * so the host hands it what the vessel knows: the face, and for a restring the line's tip as `after`. The host shim parses
 * no JSON, so this verb prints the terms whole, one stdout line, and writes nothing and asks no route. The face reads from
 * `--face`, else for a keep the keep's face (the face whose keep lei stands, else h0), else the vessel's daemon mount face.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { afterEach, beforeEach, describe, expect, vi } from "vitest";

const seam = vi.hoisted(() => ({
  calls: [] as Array<[string, Record<string, unknown>]>,
  lines: {} as Record<number, Record<string, unknown>>,
  mount: 0,
  open: [0] as number[],
  shut: [] as number[],
}));
vi.mock("../src/store-door.js", () => ({
  storeVerb: async (verb: string, args: Record<string, unknown>) => {
    seam.calls.push([verb, args]);
    return { output: { lei: seam.lines[Number(args["face"])] ?? { standing: false, refusal: "absent", after: null } }, via: "vessel" };
  },
  storeFailure: (err: unknown) => ({ code: "error", message: err instanceof Error ? err.message : String(err) }),
  StoreDoorRefusal: class extends Error {},
}));
vi.mock("../src/sealed-act-door.js", () => ({
  sealedAct: async (act: string, args: Record<string, unknown>) => { seam.calls.push([act, args]); return { face: seam.mount }; },
}));
vi.mock("../src/custody-door.js", () => ({
  houseFaces: async () => { seam.calls.push(["census", {}]); return { open: seam.open, shut: seam.shut }; },
}));

import { it, test } from "../../lararium-node/tests/support/scratch-fixture.js";
import { cmdLei, leiTerms, LeiTermsRefused, LeiUsage, type LeiTermsPorts } from "../src/commands/lei.js";
import { helpLines } from "../src/command-help.js";
import { parseArgs } from "../src/parse-args.js";

const TIP = "b".repeat(64), CID = "c".repeat(64), HEAD = "d".repeat(40);
const lineAt = (after: string | null, extra: Record<string, unknown> = {}) => ({ standing: after !== null, reach: "wide", returnsLeft: 2, after, ...extra });

/** Fake ports over the seam: the swarm-show row by face, the census, the mount. */
const ports: LeiTermsPorts = {
  show: async (rite, branch, face) => { seam.calls.push(["swarm-show", { rite, branch, face }]); return { ok: true, output: { lei: seam.lines[face] ?? { standing: false, refusal: "absent", after: null } } }; },
  houseFaces: async () => ({ open: seam.open, shut: seam.shut }),
  mountFace: async () => { seam.calls.push(["mount", {}]); return seam.mount; },
};
const terms = (...line: string[]) => leiTerms(parseArgs(["lei", "terms", ...line]), ports);
const refusal = (run: Promise<unknown>): Promise<string> => run.then(() => "no refusal", (e: unknown) =>
  e instanceof LeiTermsRefused ? e.code : e instanceof LeiUsage ? "usage" : `threw ${String(e)}`);

beforeEach(() => { seam.calls = []; seam.lines = {}; seam.mount = 0; seam.open = [0]; seam.shut = []; });
afterEach(() => { vi.restoreAllMocks(); });

describe("lares lei terms prints the pūlama's terms, one line", () => {
  test("RED: kui wide names the face, rite, branch, returns and the after it follows (null for the line's first); the face reads the daemon mount where none is named", async () => {
    seam.mount = 2;
    expect(JSON.stringify(await terms("kui", "--rite", "push", "--branch", "feature/x", "--returns", "3")))
      .toBe(`{"face":2,"rite":"push","branch":"feature/x","returns":3,"after":null}`);
    expect(seam.calls).toEqual([["mount", {}]]);
    expect(JSON.stringify(await terms("kui", "--rite", "push", "--branch", "feature/x", "--returns", "40", "--yes", "--after", CID, "--face", "1")))
      .toBe(`{"face":1,"rite":"push","branch":"feature/x","returns":40,"after":"${CID}","confirm":true}`);
    // A named face asks no mount.
    expect(seam.calls).toEqual([["mount", {}]]);
  });

  test("RED: kui head pins one head and carries its reach", async () => {
    expect(JSON.stringify(await terms("kui", "--rite", "kukulu", "--branch", "main", "--reach", "head", "--head", HEAD, "--face", "0")))
      .toBe(`{"face":0,"rite":"kukulu","branch":"main","reach":"head","head":"${HEAD}","after":null}`);
  });

  test("RED: restring fills `after` from the line's tip, read through the swarm-show row at the face", async () => {
    seam.mount = 1;
    seam.lines[1] = lineAt(TIP);
    expect(JSON.stringify(await terms("restring", "--rite", "push", "--branch", "feature/x", "--returns", "2")))
      .toBe(`{"face":1,"rite":"push","branch":"feature/x","returns":2,"after":"${TIP}"}`);
    expect(seam.calls).toEqual([["mount", {}], ["swarm-show", { rite: "push", branch: "feature/x", face: 1 }]]);
    // A spent lei still holds the line's tip, and a restring follows it.
    seam.lines[1] = { standing: false, refusal: "swarm-lei-spent", after: TIP };
    expect((await terms("restring", "--rite", "push", "--branch", "feature/x", "--reach", "head", "--head", HEAD))["after"]).toBe(TIP);
  });

  test("RED: unstring carries the lei it revokes by cid", async () => {
    expect(JSON.stringify(await terms("unstring", "--rite", "push", "--branch", "feature/x", "--lei", CID, "--face", "3")))
      .toBe(`{"face":3,"rite":"push","branch":"feature/x","lei":"${CID}"}`);
    expect(seam.calls).toEqual([]);
  });

  test("RED: a keep names the keep's face: the face whose keep lei stands (h0 first, then each open face ascending), else h0; the mount never chooses it", async () => {
    seam.mount = 2; seam.open = [0, 2, 1];
    seam.lines[1] = lineAt(TIP);
    expect(JSON.stringify(await terms("kui", "--rite", "keep", "--branch", "house-backup", "--returns", "6")))
      .toBe(`{"face":1,"rite":"keep","branch":"house-backup","returns":6,"after":null}`);
    expect(seam.calls.map(([v, a]) => `${v} ${String(a["face"] ?? "")}`)).toEqual(["swarm-show 0", "swarm-show 1"]);
    // No keep line anywhere: h0, where a house strings its first.
    seam.lines = {}; seam.calls = [];
    expect((await terms("kui", "--rite", "keep", "--branch", "house-backup", "--returns", "6"))["face"]).toBe(0);
    // A keep restring follows the tip read at the keep's face, read once.
    seam.lines[1] = lineAt(TIP); seam.calls = [];
    expect(JSON.stringify(await terms("restring", "--rite", "keep", "--branch", "house-backup", "--returns", "4")))
      .toBe(`{"face":1,"rite":"keep","branch":"house-backup","returns":4,"after":"${TIP}"}`);
    expect(seam.calls.filter(([v]) => v === "swarm-show")).toHaveLength(2);
  });

  test("RED: refusals by name: a restring with no lei on the line, a forked line, a keep lei that may stand on a shut face", async () => {
    expect(await refusal(terms("restring", "--rite", "push", "--branch", "b", "--returns", "1"))).toBe("swarm-lei-nothing-to-restring");
    seam.lines[0] = lineAt(null, { forks: [TIP, CID] });
    expect(await refusal(terms("restring", "--rite", "push", "--branch", "b", "--returns", "1"))).toBe("swarm-lei-forked");
    seam.lines = {}; seam.shut = [3];
    expect(await refusal(terms("kui", "--rite", "keep", "--branch", "w", "--returns", "1"))).toBe("keep-lei-unseen");
    // CONTROL: a named face reads past the shut one.
    expect(await refusal(terms("kui", "--rite", "keep", "--branch", "w", "--returns", "1", "--face", "0"))).toBe("no refusal");
  });

  test("RED: usage refusals: no act, an act the pūlama holds none for, a missing rite or branch or lei, a count that reads as none, and a flag the act does not take", async () => {
    for (const line of [[], ["show"], ["land"], ["kui", "--branch", "b"], ["kui", "--rite", "push"], ["unstring", "--rite", "push", "--branch", "b"],
      ["kui", "--rite", "push", "--branch", "b", "--returns", "0"], ["kui", "--rite", "push", "--branch", "b", "--face", "x"],
      ["kui", "--rite", "push", "--branch", "b", "--lei", CID], ["restring", "--rite", "push", "--branch", "b", "--after", CID],
      ["restring", "--rite", "push", "--branch", "b", "--lei", CID], ["unstring", "--rite", "push", "--branch", "b", "--lei", CID, "--returns", "2"],
      ["unstring", "--rite", "push", "--branch", "b", "--lei", CID, "--yes"], ["unstring", "--rite", "push", "--branch", "b", "--lei", CID, "--head", HEAD]]) {
      expect(await refusal(terms(...line)), line.join(" ")).toBe("usage");
    }
    // Nothing read for a usage refusal.
    expect(seam.calls).toEqual([]);
  });

  it("RED: the command prints ONE stdout line, the terms alone, through the live ports (the census, the swarm-show row, the mount)", async () => {
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => { out.push(String(line)); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    seam.mount = 1; seam.lines[1] = lineAt(TIP);
    expect(await cmdLei(parseArgs(["lei", "terms", "restring", "--rite", "push", "--branch", "feature/x", "--returns", "2"]))).toBe(0);
    expect(out).toEqual([`{"face":1,"rite":"push","branch":"feature/x","returns":2,"after":"${TIP}"}`]);
    expect(seam.calls).toEqual([["face.resolve", { worn: true }], ["swarm-show", { rite: "push", branch: "feature/x", face: 1 }]]);
    out.length = 0; seam.calls = []; seam.open = [0, 1]; seam.lines = { 1: lineAt(TIP) };
    expect(await cmdLei(parseArgs(["lei", "terms", "kui", "--rite", "keep", "--branch", "w", "--returns", "6"]))).toBe(0);
    expect(out).toEqual([`{"face":1,"rite":"keep","branch":"w","returns":6,"after":null}`]);
    expect(seam.calls[0]).toEqual(["census", {}]);
    // A refusal prints nothing on stdout and exits non-zero.
    out.length = 0; seam.lines = {};
    expect(await cmdLei(parseArgs(["lei", "terms", "restring", "--rite", "push", "--branch", "b", "--returns", "1", "--face", "0"]))).not.toBe(0);
    expect(out).toEqual([]);
    // CONTROL: an explicit --json asks the envelope.
    seam.lines = { 0: lineAt(TIP) };
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => { written.push(String(chunk)); return true; });
    expect(await cmdLei(parseArgs(["lei", "terms", "restring", "--rite", "push", "--branch", "b", "--returns", "1", "--face", "0", "--json"]))).toBe(0);
    expect(JSON.parse(written.join(""))).toEqual({ ok: true, data: { face: 0, rite: "push", branch: "b", returns: 1, after: TIP } });
  });

  test("the lei help names land and terms", () => {
    const help = helpLines("lei").join("\n");
    expect(help).toMatch(/lares lei land /);
    expect(help).toMatch(/lares lei terms kui\|restring\|unstring/);
  });
});
