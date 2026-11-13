/**
 * `lares act MOVE` carrying a tombstone: the shadow ask reaches the wire as `shadow: true`, a MOVE that
 * names no `--to` prints the bags holding the title as candidates and summons no MOVE, and `wiki resolve`
 * names the bag that hides a title.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ verb: string; args: Record<string, unknown> }>,
  replies: {} as Record<string, Record<string, unknown>>,
}));
vi.mock("../src/verb-call.js", async (orig) => ({
  ...(await orig<typeof import("../src/verb-call.js")>()),
  runVerb: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: h.replies[verb] ?? {} } } };
  },
}));
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
}));

import { cmdAct } from "../src/commands/act.js";
import { cmdWikiResolve } from "../src/commands/wiki.js";
import { parseArgs } from "../src/parse-args.js";
import type { ParsedArgs } from "../src/parse-args.js";

const actArgs = (positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ command: "act", positional, options, flags: { json: true, yes: true, ...flags } } as unknown as ParsedArgs);

afterEach(() => { h.calls.length = 0; h.replies = {}; vi.restoreAllMocks(); });

const T = "lar:///t/move/hidden";
const WORKING = "lar:///ha.ka.ba/wikis/w/working";
const CANON = "lar:///ha.ka.ba/bags/w";

describe("lares act MOVE carrying a tombstone", () => {
  test("--shadow parses as a flag in any position and reaches the wire as shadow: true", async () => {
    const parsed = parseArgs(["act", "MOVE", "--shadow", "--title", T, "--from", WORKING, "--to", CANON]);
    expect(parsed.flags["shadow"]).toBe(true);
    expect(parsed.options["title"]).toBe(T);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await cmdAct(actArgs(["MOVE"], { title: T, from: WORKING, to: CANON }, { shadow: true }));
    const move = h.calls.find((c) => c.verb === "wiki-act");
    expect(move?.args).toMatchObject({ wiki: "w", verb: "MOVE", args: { title: T, "from-bag": WORKING, "to-bag": CANON, shadow: true } });
  });

  test("CONTROL: a MOVE without the ask carries no shadow key", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await cmdAct(actArgs(["MOVE"], { title: T, from: WORKING, to: CANON }));
    const move = h.calls.find((c) => c.verb === "wiki-act");
    expect(move).toBeDefined();
    expect(move!.args["args"]).not.toHaveProperty("shadow");
  });


  test("a MOVE naming no --to prints the bags holding the title and summons no MOVE", async () => {
    h.replies["where"] = { tiddler: T, bags: [CANON, "lar:///ha.ka.ba/bags/library"] };
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => { lines.push(String(line)); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await cmdAct(actArgs(["MOVE"], { title: T, from: WORKING }))).toBe(2);
    expect(h.calls.map((c) => c.verb)).toEqual(["where"]);
    expect(lines).toEqual(["bags holding the title:", CANON, "lar:///ha.ka.ba/bags/library", "name the bag where the delete takes place with --to <bag>"]);
  });

  test("wiki resolve names the bag that hides a title and prints no winner for it", async () => {
    h.replies["resolve"] = { tiddler: T, manifestations: [{ bagId: CANON }], tombstones: [WORKING], hiddenBy: WORKING, winningBag: null };
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => { lines.push(String(line)); });
    await cmdWikiResolve({ command: "wiki", positional: [T], options: {}, flags: {} } as unknown as ParsedArgs);
    expect(lines.some((line) => line.includes(`Hidden by: ${WORKING}`))).toBe(true);
    expect(lines.some((line) => line.includes("Winning surface"))).toBe(false);
    // CONTROL: a plain live title prints its winner and no hiding bag.
    lines.length = 0;
    h.replies["resolve"] = { tiddler: T, manifestations: [{ bagId: CANON }], tombstones: [], hiddenBy: null, winningBag: CANON };
    await cmdWikiResolve({ command: "wiki", positional: [T], options: {}, flags: {} } as unknown as ParsedArgs);
    expect(lines.some((line) => line.includes(`Winning surface (origin-bag): ${CANON}`))).toBe(true);
    expect(lines.some((line) => line.includes("Hidden by"))).toBe(false);
  });

  test("CONTROL: ADD and COPY naming no --to refuse by usage and touch no wire", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await cmdAct(actArgs(["ADD"], { title: T, from: WORKING }))).toBe(2);
    expect(await cmdAct(actArgs(["COPY"], { title: T, from: WORKING }))).toBe(2);
    expect(h.calls).toEqual([]);
  });

  test("the shadow ask on ADD or COPY refuses by usage and touches no wire", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await cmdAct(actArgs(["ADD"], { title: T, from: WORKING, to: CANON }, { shadow: true }))).toBe(2);
    expect(await cmdAct(actArgs(["COPY"], { title: T, from: WORKING, to: CANON }, { shadow: true }))).toBe(2);
    expect(h.calls).toEqual([]);
  });
});
