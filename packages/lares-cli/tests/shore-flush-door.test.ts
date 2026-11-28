/**
 * `lares shore flush` — a hand asks the vessel to flush EVERY island that mounts a disk shore (the daemon's with each lit
 * sibling's projector, and every resident wiki's), the same whole-island flush the teardown runs, through the custody door's
 * `shore-flush` frame, and reads what each island wrote, what it could not, and why.
 *
 *   D1  the door shapes `{ op: "flush" }` and asks no confirmation (a flush moves memory toward disk and takes nothing).
 *   D2  the vessel's reading crosses whole: every island it asked, each part naming its island (a resident wiki beyond the
 *       active one among them); a part that did not answer reads unanswered by name, never as written.
 *   D3  the exit reads the reading: 0 every island wrote, 4 a carrier stayed unwritten, 3 an island could not answer or no
 *       vessel answered; none of them reads as usage (2).
 *   D4  the one frame rides the custody door, and no reach caveat rides the reading: no island stands outside it.
 *   D5  `--face N` names a lit sibling's shore: list and the answers carry the face, and the act reaches the daemon island
 *       alone (where every lit face's projector stands); a flush and a settle take no face.
 */
import { describe, expect, test } from "vitest";
import { VERB_RESULT_KEY } from "@lararium/mesh/verb-tiddler";
import { askShore, askShoreFlush, shoreFlushExit } from "../src/shore-core.js";
import { cmdShore, shoreArgs, SHORE_ACTS } from "../src/commands/shore.js";
import type { CustodyDoorAnswer } from "../src/custody-door.js";
import type { SubmitResult } from "../src/verb-result.js";
import type { ParsedArgs } from "../src/parse-args.js";

const flushed = (island: string, written: string[], unwritten: Array<{ uri: string; state: string; why: string }> = []): Record<string, unknown> => ({
  island, answered: true,
  written: written.map((uri) => ({ uri, bagId: "b" })), writtenCount: written.length,
  unwritten: unwritten.map((u) => ({ ...u, bagId: "b" })), unwrittenCount: unwritten.length,
  fileWrites: written.length, drained: unwritten.length === 0,
});
const vessel = (islands: Array<Record<string, unknown>>) => {
  const sent: unknown[] = [];
  const line = async (frame: unknown): Promise<CustodyDoorAnswer | null> => {
    sent.push(frame);
    return { op: "shore-flush", reading: { islands, whole: islands.every((i) => i["answered"] === true && i["unwrittenCount"] === 0) }, standing: "hearth" };
  };
  return { line, sent };
};
const parsed = (positional: string[], options: Record<string, string> = {}): ParsedArgs => ({ positional, flags: {}, options } as unknown as ParsedArgs);

describe("lares shore flush", () => {
  test("D1 — the door shapes the op and asks no confirmation", () => {
    expect(SHORE_ACTS).toContain("flush");
    expect(shoreArgs("flush", parsed(["flush"]))).toEqual({ args: { op: "flush" } });
  });

  test("RED D2 — the vessel's reading crosses whole: every resident wiki, the daemon and its lit siblings; none that fails reads as written", async () => {
    const v = vessel([
      flushed("daemon", ["lar:///a/d"], [{ uri: "lar:///a/x", state: "failed", why: "its reconcile threw again" }]),
      flushed("wiki:home", ["lar:///a/w"]),
      flushed("wiki:notes", ["lar:///a/n"]),
      { island: "wiki:silent", answered: false, why: "the island gave no answer within 15000ms" },
    ]);
    const reading = await askShoreFlush(v.line);
    expect(reading.islands.map((i) => [i.island, i.answered])).toEqual([["daemon", true], ["wiki:home", true], ["wiki:notes", true], ["wiki:silent", false]]);
    expect(reading.islands[0]).toMatchObject({ unwritten: [{ uri: "lar:///a/x", state: "failed", why: "its reconcile threw again" }], unwrittenCount: 1 });
    expect(reading.islands[3]).toEqual({ island: "wiki:silent", answered: false, refusal: "unanswered", why: "the island gave no answer within 15000ms" });
    expect(reading.whole).toBe(false);
  });

  test("RED D3 — the exit reads the reading; no vessel, or a refusal, reads unanswered", async () => {
    expect(shoreFlushExit(await askShoreFlush(vessel([flushed("wiki:home", ["w"]), flushed("wiki:other", ["o"])]).line))).toBe(0);
    expect(shoreFlushExit(await askShoreFlush(vessel([flushed("wiki:other", [], [{ uri: "u", state: "pending", why: "w" }])]).line))).toBe(4);
    expect(shoreFlushExit(await askShoreFlush(vessel([{ island: "daemon", answered: false, why: "engine-terminated", refusal: "engine-terminated" }]).line))).toBe(3);
    const none = await askShoreFlush(async () => null);
    expect(none.islands).toEqual([{ island: "vessel", answered: false, refusal: "unanswered", why: expect.stringMatching(/no vessel answered/) }]);
    expect(shoreFlushExit(none)).toBe(3);
    const refused = await askShoreFlush(async () => ({ op: "shore-flush", status: "error", errorMessage: "no composition sits", refusal: { reason: "flush-unavailable" } }));
    expect(refused.islands).toEqual([{ island: "vessel", answered: false, refusal: "flush-unavailable", why: "no composition sits" }]);
  });

  test("RED D4 — one custody frame, and no reach caveat: no island stands outside the door", async () => {
    const v = vessel([flushed("daemon", ["d"])]);
    const reading = await askShoreFlush(v.line);
    expect(v.sent).toEqual([{ op: "shore-flush" }]);
    expect(Object.keys(reading).sort()).toEqual(["islands", "whole"]);
  });

  test("RED D5 — `--face N` names a lit sibling's shore and reaches the daemon island alone; a flush and a settle take no face", async () => {
    expect(shoreArgs("list", parsed(["list"], { face: "2" }))).toEqual({ args: { op: "list", face: 2 } });
    expect(shoreArgs("take-records", parsed(["take-records", "lar:///a/x"], { key: "k1", face: "2" }))).toEqual({ args: { op: "take-records", uri: "lar:///a/x", key: "k1", face: 2 } });
    expect(shoreArgs("restore", parsed(["restore", "lar:///a/x"], { face: "1" }))).toEqual({ args: { op: "restore", uris: ["lar:///a/x"], face: 1 } });
    expect(shoreArgs("list", parsed(["list"], { face: "h2" }))).toMatchObject({ usage: expect.stringMatching(/face= names a handle index/) });
    expect(shoreArgs("flush", parsed(["flush"], { face: "2" }))).toMatchObject({ usage: expect.stringMatching(/flush takes no face=/) });
    expect(shoreArgs("take-disk", parsed(["take-disk", "lar:///a/x"], { key: "k", face: "2" }))).toMatchObject({ usage: expect.stringMatching(/take-disk takes no face=/) });
    // The face's list reaches the daemon island alone, and each row names its island.
    const asked: string[] = [];
    const run = async (name: string, args: Record<string, unknown>): Promise<SubmitResult> => {
      asked.push(`${name} ${JSON.stringify(args)}`);
      return { status: "done", requestId: "r", results: { [VERB_RESULT_KEY]: { ok: true, output: { ok: true, op: "list", face: 2, standoffs: [{ uri: "lar:///a/s", bagId: "b", standoff: "k1" }], standoffCount: 1, pending: [], pendingCount: 0, mark: "m1", next: null } } } } as SubmitResult;
    };
    const listed = await askShore({ op: "list", face: 2 }, "did:test", run);
    expect(asked).toEqual([`shore ${JSON.stringify({ op: "list", face: 2 })}`]);
    expect(listed.output["standoffs"]).toEqual([{ uri: "lar:///a/s", bagId: "b", standoff: "k1", island: "daemon" }]);
  });

  test("RED D6 — a face's take-records reads its key at THAT face's shore: the worn face standing off over the same carrier under another key never answers for it", async () => {
    const asked: Array<Record<string, unknown>> = [];
    const list = (key: string, face?: number) => ({ ok: true, op: "list", ...(face !== undefined ? { face } : {}), standoffs: [{ uri: "lar:///a/s", bagId: "b", standoff: key }], standoffCount: 1, pending: [], pendingCount: 0, mark: `m-${key}`, next: null });
    const run = async (name: string, args: Record<string, unknown>): Promise<SubmitResult> => {
      const shore = name === "wiki-act" ? (args["args"] as Record<string, unknown>) : args;
      asked.push({ island: name === "wiki-act" ? "wiki" : "daemon", ...shore });
      const face = shore["face"] as number | undefined;
      const output = shore["op"] === "list" ? list(face === 2 ? "k-sibling" : "k-worn", face) : { ok: true, op: shore["op"], uri: shore["uri"], face };
      return { status: "done", requestId: "r", results: { [VERB_RESULT_KEY]: { ok: true, output } } } as SubmitResult;
    };
    const answer = await askShore({ op: "take-records", uri: "lar:///a/s", key: "k-sibling", face: 2 }, "did:test", run);
    expect(answer).toMatchObject({ ok: true, output: { op: "take-records", face: 2 } });
    expect(asked.every((a) => a["island"] === "daemon" && a["face"] === 2)).toBe(true);
    // CONTROL: with no face the worn face's key stands, and the sibling's key reads moved.
    expect(await askShore({ op: "take-records", uri: "lar:///a/s", key: "k-sibling" }, "did:test", run)).toMatchObject({ ok: false, refusal: "standoff-key-moved" });
  });

  test("RED D7 — take-disk settles by a person: a harness on the command's own branch refuses `hand-act-only` before anything asks the vessel", async () => {
    const out: string[] = [];
    const log = console.log, err = console.error, ow = process.stdout.write, ew = process.stderr.write;
    console.log = (l: unknown) => { out.push(String(l)); }; console.error = (l: unknown) => { out.push(String(l)); };
    process.stdout.write = ((c: unknown) => { out.push(String(c)); return true; }) as typeof process.stdout.write;
    process.stderr.write = ((c: unknown) => { out.push(String(c)); return true; }) as typeof process.stderr.write;
    try {
      const code = await cmdShore({ positional: ["take-disk", "lar:///a/s"], flags: { yes: true }, options: { key: "k" } } as unknown as ParsedArgs, () => ({ refusal: "hand-act-only" }));
      expect(code).toBe(1);
    } finally { console.log = log; console.error = err; process.stdout.write = ow; process.stderr.write = ew; }
    expect(out.join("\n")).toContain("hand-act-only");
  });
});
