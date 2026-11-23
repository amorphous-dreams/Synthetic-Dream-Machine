/**
 * `lares shore flush` — a hand asks every island that mounts a disk shore to write what it holds in memory to its
 * mirrors now, and reads what each wrote, what it could not, and why.
 *
 *   D1  the door shapes `{ op: "flush" }` and asks no confirmation (a flush moves memory toward disk and takes nothing).
 *   D2  both islands answer as one reading, each part naming its island; an island that mounts no projection drops out;
 *       a refusing island reads unanswered by name, never as written.
 *   D3  the exit reads the reading: 0 whole, 3 a carrier stayed unwritten, 2 an island could not answer.
 */
import { describe, expect, test } from "vitest";
import { VERB_RESULT_KEY } from "@lararium/mesh";
import { askShoreFlush, shoreFlushExit } from "../src/shore-core.js";
import { shoreArgs, SHORE_ACTS } from "../src/commands/shore.js";
import type { SubmitResult } from "../src/verb-result.js";
import type { ParsedArgs } from "../src/parse-args.js";

type Island = (args: Record<string, unknown>) => Record<string, unknown> | "error";

function vessel(wiki: Island, daemon: Island) {
  const sent: Array<{ island: string; op: unknown }> = [];
  const run = async (name: string, args: Record<string, unknown>): Promise<SubmitResult> => {
    const island = name === "wiki-act" ? "wiki" : "daemon";
    const shoreArgs = island === "wiki" ? (args["args"] as Record<string, unknown>) : args;
    sent.push({ island, op: shoreArgs["op"] });
    const output = (island === "wiki" ? wiki : daemon)(shoreArgs);
    if (output === "error") return { status: "error", requestId: "req", errorMessage: "engine-terminated: this vessel's Automerge engine stopped" } as SubmitResult;
    return { status: "done", requestId: `req-${island}`, results: { [VERB_RESULT_KEY]: { ok: true, output } } } as SubmitResult;
  };
  return { run, sent };
}

const flushed = (written: string[], unwritten: Array<{ uri: string; state: string; why: string }> = []): Record<string, unknown> => ({
  ok: true, op: "flush",
  written: written.map((uri) => ({ uri, bagId: "b" })), writtenCount: written.length,
  unwritten: unwritten.map((u) => ({ ...u, bagId: "b" })), unwrittenCount: unwritten.length,
  fileWrites: written.length, drained: unwritten.length === 0,
});
const NO_SHORE = { ok: false, refusal: "no-disk-shore", why: "this island mounts no disk projection" };
const parsed = (positional: string[]): ParsedArgs => ({ positional, flags: {}, options: {} } as unknown as ParsedArgs);

describe("lares shore flush", () => {
  test("D1 — the door shapes the op and asks no confirmation", () => {
    expect(SHORE_ACTS).toContain("flush");
    expect(shoreArgs("flush", parsed(["flush"]))).toEqual({ args: { op: "flush" } });
  });

  test("D2 — both islands answer as one reading; none that fails reads as written", async () => {
    const v = vessel(() => flushed(["lar:///a/w"]), () => flushed(["lar:///a/d"], [{ uri: "lar:///a/x", state: "failed", why: "its reconcile threw again" }]));
    const reading = await askShoreFlush("did:test", v.run);
    expect(v.sent).toEqual([{ island: "wiki", op: "flush" }, { island: "daemon", op: "flush" }]);
    expect(reading.islands.map((i) => [i.island, i.answered])).toEqual([["wiki", true], ["daemon", true]]);
    expect(reading.islands[1]).toMatchObject({ unwritten: [{ uri: "lar:///a/x", state: "failed", why: "its reconcile threw again" }], unwrittenCount: 1 });
    expect(reading.whole).toBe(false);

    const quiet = vessel(() => NO_SHORE, () => "error");
    const down = await askShoreFlush("did:test", quiet.run);
    expect(down.islands).toEqual([{ island: "daemon", answered: false, refusal: "verb-error", why: expect.stringMatching(/engine-terminated/) }]);
    expect(down.whole).toBe(false);
  });

  test("D3 — the exit reads the reading", async () => {
    expect(shoreFlushExit(await askShoreFlush("did:test", vessel(() => flushed(["w"]), () => NO_SHORE).run))).toBe(0);
    expect(shoreFlushExit(await askShoreFlush("did:test", vessel(() => flushed([], [{ uri: "u", state: "pending", why: "w" }]), () => NO_SHORE).run))).toBe(3);
    expect(shoreFlushExit(await askShoreFlush("did:test", vessel(() => "error", () => flushed(["d"])).run))).toBe(2);
  });
});
