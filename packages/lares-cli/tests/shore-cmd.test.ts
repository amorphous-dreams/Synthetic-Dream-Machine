/**
 * `lares shore` — the door's own reading of an act and of the island's answer.
 *
 * The command sends one `wiki-act` line and reads the island's answer back. These vectors pin the two
 * pure halves: which args an act sends, and how an outcome reads. Control: a refusal the island named
 * keeps its name, and a failed verb never reads as an answer.
 */
import { describe, test, expect } from "vitest";
import { VERB_RESULT_KEY } from "@lararium/mesh";
import { SHORE_ACTS, shoreArgs } from "../src/commands/shore.js";
import { SHORE_VERB, askShore, readShoreAnswer } from "../src/shore-core.js";
import type { ParsedArgs } from "../src/parse-args.js";
import type { SubmitResult } from "../src/verb-result.js";
import { COMMANDS } from "../src/bin/lares.js";

const parsed = (positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ positional, options, flags }) as unknown as ParsedArgs;
const done = (output: Record<string, unknown>): SubmitResult =>
  ({ status: "done", requestId: "req-1", results: { [VERB_RESULT_KEY]: { ok: true, output } } });

describe("lares shore reads an act", () => {
  test("list sends the list act", () => {
    expect(shoreArgs("list", parsed([]))).toEqual({ args: { op: "list" } });
  });
  test("take-records sends the carrier, the key and the bag a person named", () => {
    expect(shoreArgs("take-records", parsed(["take-records", "lar:///a.b.c/x"], { key: "abc123" })))
      .toEqual({ args: { op: "take-records", uri: "lar:///a.b.c/x", key: "abc123" } });
    expect(shoreArgs("take-records", parsed(["take-records", "lar:///a.b.c/x"], { key: "abc123", bag: "lar:///ha.ka.ba/bags/lares" })))
      .toEqual({ args: { op: "take-records", uri: "lar:///a.b.c/x", key: "abc123", bag: "lar:///ha.ka.ba/bags/lares" } });
  });
  test("CONTROL: take-records with no key, or no carrier, names its usage and sends nothing", () => {
    expect(shoreArgs("take-records", parsed(["take-records", "lar:///a.b.c/x"]))).toHaveProperty("usage");
    expect(shoreArgs("take-records", parsed(["take-records"], { key: "abc123" }))).toHaveProperty("usage");
  });
});

describe("lares shore reads an answer to a pending removal", () => {
  test("one carrier names itself; the bag rides where a person named it", () => {
    expect(shoreArgs("restore", parsed(["restore", "lar:///a.b.c/x"]))).toEqual({ args: { op: "restore", uris: ["lar:///a.b.c/x"] } });
    expect(shoreArgs("remove", parsed(["remove", "lar:///a.b.c/x"], { bag: "lar:///ha.ka.ba/bags/lares" })))
      .toEqual({ args: { op: "remove", uris: ["lar:///a.b.c/x"], bag: "lar:///ha.ka.ba/bags/lares" } });
  });
  test("an answer over many carries the count its giver read", () => {
    expect(shoreArgs("restore", parsed(["restore"], { count: "7" }, { all: true }))).toEqual({ args: { op: "restore", all: true, count: 7 } });
    expect(shoreArgs("remove", parsed(["remove", "lar:///a.b.c/x", "lar:///a.b.c/y"], { count: "2" })))
      .toEqual({ args: { op: "remove", uris: ["lar:///a.b.c/x", "lar:///a.b.c/y"], count: 2 } });
  });
  test("CONTROL: many with no count, all beside a name, no name at all and a count that names no number each stop at usage", () => {
    expect(shoreArgs("remove", parsed(["remove"], {}, { all: true }))).toHaveProperty("usage");
    expect(shoreArgs("remove", parsed(["remove", "lar:///a.b.c/x", "lar:///a.b.c/y"]))).toHaveProperty("usage");
    expect(shoreArgs("restore", parsed(["restore", "lar:///a.b.c/x"], { count: "1" }, { all: true }))).toHaveProperty("usage");
    expect(shoreArgs("restore", parsed(["restore"]))).toHaveProperty("usage");
    expect(shoreArgs("restore", parsed(["restore"], { count: "some" }, { all: true }))).toHaveProperty("usage");
  });
});

describe("one line carries every shore act", () => {
  test("askShore wraps the act in `wiki-act` under the shore verb and reads the island's answer", async () => {
    const sent: Array<{ name: string; args: Record<string, unknown> }> = [];
    const answer = await askShore({ op: "sense", uris: ["lar:///a.b.c/x"] }, "did:test", async (name, args) => {
      sent.push({ name, args });
      return done({ ok: true, op: "sense", pendingCount: 1 });
    });
    expect(sent).toEqual([{ name: "wiki-act", args: { verb: "shore", args: { op: "sense", uris: ["lar:///a.b.c/x"] } } }]);
    expect(answer).toMatchObject({ ok: true, output: { pendingCount: 1 } });
  });
});

describe("lares shore reads the island's answer", () => {
  test("an act that ran reads ok with its output", () => {
    const a = readShoreAnswer(done({ ok: true, op: "list", standoffs: [] }));
    expect(a).toMatchObject({ ok: true, refusal: null, why: null, requestId: "req-1" });
    expect(a.output["standoffs"]).toEqual([]);
  });
  test("a refusal keeps the island's name and reason", () => {
    expect(readShoreAnswer(done({ ok: false, refusal: "standoff-key-moved", why: "the key moved" })))
      .toMatchObject({ ok: false, refusal: "standoff-key-moved", why: "the key moved" });
  });
  test("CONTROL: a failed verb and an unreadable answer never read as ok", () => {
    expect(readShoreAnswer({ status: "error", requestId: "req-2", errorMessage: "no handler" })).toMatchObject({ ok: false, refusal: "verb-error", why: "no handler" });
    expect(readShoreAnswer(done({ standoffs: [] }))).toMatchObject({ ok: false, refusal: "shore-answer-unread" });
  });
});

describe("the door stands in the command table", () => {
  test("`shore` names its handler, and the verb it sends reads `shore`", () => {
    expect(COMMANDS.find((c) => c.name === "shore")).toBeDefined();
    expect(SHORE_VERB).toBe("shore");
    expect(SHORE_ACTS).toContain("take-records");
  });
});
