/**
 * tiddler-door.test.ts — `lares tiddler get|put|delete` and `lares wiki filter|render|status`, the CLI skin of the
 * tiddler door (lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout #/a-lean).
 *
 * VERB-TABLE PARITY: one table (`lararium-sensorium/scripts/fixtures/tiddler-door-answers.json`) drives this skin and
 * the MCP seat's (`test_tiddler_tools.py`). For each row the CLI must put the row's `{verb, args}` on the daemon wire
 * and hand the row's `output` back verbatim as `--json` `data`: the same wire and the same body the MCP tool answers.
 * Beside it: the argument law with no daemon in reach, the exit classes a receipt maps to, and that a field patch
 * never reads stdin.
 */
import { afterEach, describe, test, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ verb: string; args: Record<string, unknown> }>,
  reply: {} as Record<string, unknown>,
  refuse: "" as string,
  replyFor: null as null | ((args: Record<string, unknown>) => Record<string, unknown>),
}));
vi.mock("../src/verb-call.js", () => ({
  DaemonUnreachable: class extends Error {},
  verbFailure: (err: unknown) => ({ code: "error", message: err instanceof Error ? err.message : String(err) }),
  runVerb: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    if (h.refuse) return { status: "error", requestId: "r", errorMessage: h.refuse };
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: h.replyFor ? h.replyFor(args) : h.reply } } };
  },
  runVerbAsFace: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: h.replyFor ? h.replyFor(args) : h.reply } } };
  },
}));
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
}));

import { cmdTiddler, tiddlerPlan } from "../src/commands/tiddler.js";
import { cmdWiki, wikiFilterPlan, wikiRenderPlan } from "../src/commands/wiki.js";
import { COMMANDS } from "../src/bin/lares.js";
import type { ParsedArgs } from "../src/parse-args.js";

interface Row {
  tool: string;
  cli: { command: "tiddler" | "wiki"; positional: string[]; options: Record<string, string>; flags: Record<string, boolean> };
  wire: { verb: string; args: Record<string, unknown> };
  output: Record<string, unknown>;
}
const TABLE = JSON.parse(readFileSync(new URL("../../lararium-sensorium/scripts/fixtures/tiddler-door-answers.json", import.meta.url), "utf8")) as { rows: Row[] };

const argv = (command: string, positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ command, positional, options, flags: { json: true, ...flags } } as unknown as ParsedArgs);

/** Run a command and read the one JSON object it printed. */
async function run(args: ParsedArgs): Promise<{ exit: number; printed: Record<string, unknown> }> {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation(((chunk: unknown) => { chunks.push(String(chunk)); return true; }) as never);
  const log = vi.spyOn(console, "log").mockImplementation((...parts: unknown[]) => { chunks.push(parts.join(" ") + "\n"); });
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const exit = args.command === "wiki" ? await cmdWiki(args) : await cmdTiddler(args);
    return { exit, printed: JSON.parse(chunks.join("")) as Record<string, unknown> };
  } finally { spy.mockRestore(); log.mockRestore(); err.mockRestore(); }
}

afterEach(() => { h.calls.length = 0; h.refuse = ""; h.replyFor = null; h.reply = {}; });

describe("verb-table-parity — the CLI half of the tiddler door's one table", () => {
  test("the table names all six verbs, and every door it names stands in the command table", () => {
    expect(new Set(TABLE.rows.map((r) => r.tool))).toEqual(new Set(["wiki_filter", "tiddler_get", "wiki_render", "tiddler_put", "tiddler_delete", "wiki_status"]));
    const names = new Set(COMMANDS.map((c) => c.name));
    for (const row of TABLE.rows) expect(names.has(row.cli.command)).toBe(true);
  });

  for (const row of TABLE.rows) {
    test(`${row.tool} (${row.cli.command} ${row.cli.positional.join(" ")}): the row's wire rides the socket and the row's output comes back verbatim`, async () => {
      h.reply = row.output;
      const { exit, printed } = await run(argv(row.cli.command, row.cli.positional, row.cli.options, row.cli.flags));
      expect(h.calls).toEqual([row.wire]);
      expect(exit).toBe(0);
      expect(printed).toMatchObject({ ok: true });
      expect(printed["data"]).toEqual(row.output);
    });

    test(`${row.tool}: every option and flag the row spells stands in its command's accepts row`, () => {
      const accepts = new Set(COMMANDS.find((c) => c.name === row.cli.command)!.accepts);
      for (const name of [...Object.keys(row.cli.options), ...Object.keys(row.cli.flags)]) expect(accepts.has(name), `${row.cli.command} accepts --${name}`).toBe(true);
    });
  }
});

describe("the argument law, no daemon", () => {
  test("a tiddler verb names its container and its title before anything rides the wire", async () => {
    expect(() => tiddlerPlan("get", argv("tiddler", ["get", "T"]))).toThrow(/no-container/);
    expect(() => tiddlerPlan("get", argv("tiddler", ["get"], { recipe: "default" }))).toThrow(/title is required/);
    expect((await run(argv("tiddler", ["get", "T"]))).exit).toBe(2);
    expect((await run(argv("wiki", ["filter", "[tag[x]]"]))).exit).toBe(2);
    expect(h.calls).toEqual([]);
  });

  test("put: --fields reads a JSON object, a count reads digits, a render names one source", () => {
    expect(() => tiddlerPlan("put", argv("tiddler", ["put", "T"], { recipe: "default", fields: "status=done" }))).toThrow(/JSON object/);
    expect(() => wikiFilterPlan(argv("wiki", ["[tag[x]]"], { recipe: "default", limit: "many" }))).toThrow(/count/);
    expect(() => wikiRenderPlan(argv("wiki", ["T"], { recipe: "default", text: "span" }))).toThrow(/one source/);
    expect(() => wikiRenderPlan(argv("wiki", [], { recipe: "default" }))).toThrow(/one source/);
    expect(tiddlerPlan("put", argv("tiddler", ["put", "T"], { recipe: "default" }, { create: true })).args).toEqual({ recipe: "default", title: "T", create: true });
  });

  test("a write naming --target refuses at the CLI by name (writes across faces wait on the rusuban rite); nothing rides the wire", async () => {
    for (const sub of ["put", "delete"] as const) expect(() => tiddlerPlan(sub, argv("tiddler", [sub, "T"], { recipe: "default", target: "h1" })), sub).toThrow(/cross-face-write-refused/);
    expect(tiddlerPlan("get", argv("tiddler", ["get", "T"], { recipe: "default", target: "h1" })).args).toEqual({ recipe: "default", title: "T", target: "h1" });
    expect((await run(argv("tiddler", ["put", "T"], { recipe: "default", target: "h1", text: "x" }))).exit).toBe(2);
    expect(h.calls).toEqual([]);
  });

  test("a visit from a sibling's session names the face it read: the island's `face` stands over the session's --face", async () => {
    h.reply = { recipe: "default", title: "T", tiddler: { fields: { title: "T", text: "w" }, hash: "h", textHash: "t", bag: "b", position: "plain" }, face: 0, worn: 1, visit: true };
    const { printed } = await run(argv("tiddler", ["get", "T"], { recipe: "default", face: "1", target: "0" }));
    expect(printed["data"]).toMatchObject({ face: 0, worn: 1, visit: true });
    h.reply = { recipe: "default", working: "w", layers: [] };
    expect((await run(argv("wiki", ["status"], { recipe: "default", face: "1" }))).printed["data"], "an answer naming no face takes the session's").toMatchObject({ face: 1 });
  });

  test("a field patch carries no text and never waits on stdin; --text carries the words", async () => {
    h.reply = { decision: "put", changed: ["status"], hash: "sha256-x" };
    await run(argv("tiddler", ["put", "T"], { recipe: "default", fields: "{\"status\":\"done\"}" }));
    expect(h.calls[0]!.args).not.toHaveProperty("text");
    await run(argv("tiddler", ["put", "T"], { recipe: "default", text: "new words" }));
    expect(h.calls[1]!.args).toMatchObject({ text: "new words" });
  });
});

describe("a bag names one store and no wiki", () => {
  test("RED: the engine verbs and the writes refuse --bag before the wire and name the right door; CONTROL: tiddler get --bag rides the wire", async () => {
    for (const [cmd, positional] of [["wiki", ["filter", "[tag[x]]"]], ["wiki", ["render", "T"]], ["wiki", ["status"]]] as const) {
      const r = await run(argv(cmd, [...positional], { bag: "lares" }));
      expect(r.exit).toBe(2);
      expect(r.printed).toMatchObject({ ok: false, error: { code: "wiki-not-anchored", message: expect.stringMatching(/runs in a wiki's own engine.*tiddler get <title> --bag.*meme list --bag.*meme get <uri> --bag.*--recipe <slug>/s) } });
    }
    for (const sub of ["put", "delete"]) {
      const r = await run(argv("tiddler", [sub, "T"], { bag: "lares", text: "x" }));
      expect(r.exit).toBe(2);
      expect(r.printed).toMatchObject({ ok: false, error: { code: "wiki-not-anchored", message: expect.stringMatching(/meme put --bag.*meme delete --bag/s) } });
    }
    expect(h.calls).toEqual([]);
    expect(tiddlerPlan("get", argv("tiddler", ["get", "T"], { bag: "lares" })).args).toEqual({ bag: "lares", title: "T" });
    h.reply = { bag: "lar:///ha.ka.ba/bags/lares", title: "T", tiddler: { fields: { title: "T", text: "words" }, hash: "sha256-x", textHash: "sha256-y", bag: "lar:///ha.ka.ba/bags/lares", position: "plain" } };
    expect(await run(argv("tiddler", ["get", "T"], { bag: "lares" }))).toMatchObject({ exit: 0, printed: { ok: true } });
    expect(h.calls).toEqual([{ verb: "tiddler-get", args: { bag: "lares", title: "T" } }]);
  });

  test("a wiki verb with no container still says no-container, and names the wiki to give", async () => {
    const r = await run(argv("wiki", ["filter", "[tag[x]]"]));
    expect(r.exit).toBe(2);
    expect(r.printed).toMatchObject({ error: { code: "no-container", message: expect.stringMatching(/name the wiki: --recipe <slug>/) } });
  });
});

describe("the exit classes a receipt maps to", () => {
  test("an absent tiddler exits not-found; a stale base and an existing title exit conflict; a family delete carries its refusal name", async () => {
    h.reply = { recipe: "default", title: "T", tiddler: null };
    expect(await run(argv("tiddler", ["get", "T"], { recipe: "default" }))).toMatchObject({ exit: 3, printed: { ok: false, error: { code: "not-found" } } });
    h.reply = { decision: "conflict", hash: "sha256-live", changed: [] };
    const conflict = await run(argv("tiddler", ["put", "T"], { recipe: "default", fields: "{\"a\":\"b\"}", base: "sha256-old" }));
    expect(conflict).toMatchObject({ exit: 4, printed: { ok: false, error: { code: "conflict" }, data: { hash: "sha256-live" } } });
    h.reply = { decision: "exists", hash: "sha256-live", changed: [] };
    expect((await run(argv("tiddler", ["put", "T"], { recipe: "default", text: "x" }, { create: true }))).exit).toBe(4);
    h.reply = { decision: "absent", tombstoned: [] };
    expect((await run(argv("tiddler", ["delete", "T"], { recipe: "default" }))).exit).toBe(3);
    // The family law answers a refusal as a receipt, so the consequence it read rides `data` beside the refusal's name.
    h.reply = { recipe: "default", title: "lar:///t/x", decision: "refused", refusal: "tiddler-delete-in-a-family", why: "tiddler-delete-in-a-family: \"lar:///t/x\" stands as a meme root of lar:///t/x", tombstoned: [],
      consequence: { position: "root", family: "lar:///t/x", acts: [{ title: "lar:///t/x", act: "tombstone" }, { title: "lar:///t/x#/b", act: "tombstone" }], leaves: [], orphans: [], refusals: [] } };
    const family = await run(argv("tiddler", ["delete", "lar:///t/x"], { recipe: "default" }));
    expect(family).toMatchObject({ exit: 4, printed: { ok: false, error: { code: "verb-error", hint: "refusal: tiddler-delete-in-a-family", message: expect.stringContaining("tiddler-delete-in-a-family:") },
      data: { decision: "refused", consequence: { position: "root", acts: [{ title: "lar:///t/x" }, { title: "lar:///t/x#/b" }] } } } });
    expect(h.calls.at(-1)!.args).not.toHaveProperty("family");
    h.reply = { recipe: "default", title: "lar:///t/x", decision: "removed", tombstoned: ["lar:///t/x", "lar:///t/x#/b"] };
    expect(await run(argv("tiddler", ["delete", "lar:///t/x"], { recipe: "default" }, { family: true }))).toMatchObject({ exit: 0, printed: { ok: true, data: { tombstoned: ["lar:///t/x", "lar:///t/x#/b"] } } });
    expect(h.calls.at(-1)!.args).toMatchObject({ family: true });
    h.refuse = "tiddler-put-in-a-family: use the meme door. \"lar:///t/x\" stands as a meme root and this put moves `text`";
    expect(await run(argv("tiddler", ["put", "lar:///t/x"], { recipe: "default", text: "x" }))).toMatchObject({ exit: 4, printed: { ok: false, error: { code: "verb-error", hint: "refusal: tiddler-put-in-a-family" } } });
    h.refuse = "filter-malformed: Missing ] in filter expression (in \"[tag[x\")";
    expect(await run(argv("wiki", ["filter", "[tag[x"], { recipe: "default" }))).toMatchObject({ exit: 4, printed: { error: { hint: "refusal: filter-malformed" } } });
    h.refuse = "cap-denied: read on lar:///ha.ka.ba/wikis/daemon/working required (no-grant)";
    expect(await run(argv("wiki", ["status"], { recipe: "default" }))).toMatchObject({ exit: 5, printed: { error: { code: "cap-denied" } } });
  });

  test("wiki filter --all follows the cursor to the end and joins the pages; a bare call asks one page", async () => {
    const pages: Record<string, Record<string, unknown>> = {
      "": { recipe: "default", filter: "[tag[x]]", titles: ["a", "b"], total: 5, next: "2.aaaaaaaaaaaaaaaa", asOf: "aaaaaaaaaaaaaaaa" },
      "2.aaaaaaaaaaaaaaaa": { recipe: "default", filter: "[tag[x]]", titles: ["c", "d"], total: 5, next: "4.aaaaaaaaaaaaaaaa", asOf: "aaaaaaaaaaaaaaaa" },
      "4.aaaaaaaaaaaaaaaa": { recipe: "default", filter: "[tag[x]]", titles: ["e"], total: 5, next: null, asOf: "aaaaaaaaaaaaaaaa" },
    };
    h.replyFor = (args) => pages[String(args["after"] ?? "")]!;
    const all = await run(argv("wiki", ["filter", "[tag[x]]"], { recipe: "default" }, { all: true }));
    expect(h.calls.map((c) => c.args["after"])).toEqual([undefined, "2.aaaaaaaaaaaaaaaa", "4.aaaaaaaaaaaaaaaa"]);
    expect(all.printed["data"]).toMatchObject({ titles: ["a", "b", "c", "d", "e"], total: 5, next: null, pages: 3 });
    h.calls.length = 0;
    const one = await run(argv("wiki", ["filter", "[tag[x]]"], { recipe: "default" }));
    expect(h.calls).toHaveLength(1);
    expect(one.printed["data"]).toEqual(pages[""]);
  });
});
