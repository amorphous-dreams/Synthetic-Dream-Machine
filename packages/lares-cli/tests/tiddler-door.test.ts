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
vi.mock("../src/store-door.js", () => ({
  storeVerb: async (verb: string, args: Record<string, unknown>) => { h.calls.push({ verb, args }); return { output: h.reply }; },
  StoreDoorRefusal: class extends Error {},
}));
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
}));

import { normalizeMemeSource } from "@lararium/tw5/meme-normalize";
import { cmdTiddler, tiddlerPlan } from "../src/commands/tiddler.js";
import { cmdWiki, wikiFilterPlan, wikiRenderPlan } from "../src/commands/wiki.js";
import { cmdKahua } from "../src/commands/kahua.js";
import { cmdMeme } from "../src/commands/meme.js";
import { COMMANDS, unknownFlags } from "../src/bin/lares.js";
import type { ParsedArgs } from "../src/parse-args.js";

interface Row {
  tool: string;
  cli: { command: "tiddler" | "wiki" | "kahua" | "meme"; positional: string[]; options: Record<string, string>; flags: Record<string, boolean> };
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
    const exit = args.command === "wiki" ? await cmdWiki(args) : args.command === "kahua" ? await cmdKahua(args, null)
      : args.command === "meme" ? await cmdMeme(args) : await cmdTiddler(args);
    const printed = JSON.parse(chunks.join("").trim().split("\n").at(-1)!) as Record<string, unknown>;
    return { exit, printed: args.command === "kahua" ? { ok: true, data: printed } : printed };
  } finally { spy.mockRestore(); log.mockRestore(); err.mockRestore(); }
}

afterEach(() => { h.calls.length = 0; h.refuse = ""; h.replyFor = null; h.reply = {}; });

describe("verb-table-parity — the CLI half of the tiddler door's one table", () => {
  test("the table names all six verbs, and every door it names stands in the command table", () => {
    expect(new Set(TABLE.rows.map((r) => r.tool))).toEqual(new Set(["wiki", "wiki_filter", "tiddler_get", "wiki_render", "tiddler_put", "tiddler_delete", "wiki_status", "kahua_get", "meme_offer_show"]));
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
  test("wiki act narrows its flags before dispatch", () => {
    const row = COMMANDS.find((c) => c.name === "wiki")!;
    for (const flag of ["text", "target", "dry-run", "list"]) {
      const args = argv("wiki", ["act", "sidebar-layout"], { recipe: "default", expected: "fixed-fluid", resulting: "fluid-fixed", [flag]: "stray" });
      expect(unknownFlags(row, args).map((x) => x.name)).toEqual([flag]);
    }
    const withFace = argv("wiki", ["act", "sidebar-layout"], { recipe: "default", expected: "fixed-fluid", resulting: "fluid-fixed", face: "1" });
    expect(unknownFlags(row, withFace)).toEqual([]);
    expect(h.calls).toEqual([]);
  });
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
      expect(r.printed).toMatchObject({ ok: false, error: { code: "wiki-not-anchored", message: expect.stringMatching(/runs in a wiki's own engine.*tiddler get <title> --bag.*--meme.*meme list --bag.*--recipe <slug>/s) } });
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

describe("wiki residency and switch wire", () => {
  test.each([
    [{}, "pin-wiki", { slug: "works" }],
    [{ release: true }, "unpin-wiki", { slug: "works" }],
    [{ bag: true }, "pin", { url: "works" }],
    [{ bag: true, release: true }, "unpin", { url: "works" }],
    [{ rotate: true }, "wiki-hold", { slug: "works" }],
    [{ rotate: true, release: true }, "wiki-release", { slug: "works" }],
  ])("pin flags %j send %s", async (flags, verb, wireArgs) => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdWiki(argv("wiki", ["pin", "works"], {}, flags));
    expect(h.calls).toEqual([{ verb, args: wireArgs }]);
    vi.restoreAllMocks();
  });
  test.each([[{}, "wiki-switch", { slug: "works", remount: true }],
    [{ "next-boot": true }, "open-wiki", { slug: "works" }]])(
    "switch flags %j send %s", async (flags, verb, wireArgs) => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      await cmdWiki(argv("wiki", ["switch", "works"], {}, flags));
      expect(h.calls).toEqual([{ verb, args: wireArgs }]);
      vi.restoreAllMocks();
    });
  test("status surveys the vessel or reads the named engine", async () => {
    await run(argv("wiki", ["status"]));
    expect(h.calls).toEqual(["list-wikis", "wiki-active", "residency"].map(verb => ({ verb, args: {} })));
    h.calls.length = 0;
    await run(argv("wiki", ["status"], { recipe: "works" }));
    expect(h.calls).toEqual([{ verb: "wiki-status", args: { recipe: "works" } }]);
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

describe("tiddler get --meme — one door reads on a gradient", () => {
  const ROOT_LINE = "<<~ has name=`lar:///t/x` params=`recipe/default type/text/memetic-wikitext+tiddlywiki position/root slots/2 bytes/10 base/sha256:9`>>";
  const slots = [{ slot: "#/a", bytes: 4, first: "a" }, { slot: "#/b", bytes: 6, first: "b" }];
  const answer = (args: Record<string, unknown>): Record<string, unknown> => {
    const base = { recipe: "default", title: "lar:///t/x", lens: "meme" };
    if (args["grain"] !== "whole") {
      return { has: `${ROOT_LINE}\n<<~ has name=\`#/a\` params=\`bytes/4 ~ a\`>>\n<<~ has name=\`#/b\` params=\`bytes/6 ~ b\`>>`, ...base,
        meme: { uri: "lar:///t/x", canonicalHash: "sha256:9", bytes: 10, slots }, grain: { asked: null, applied: "skinny", why: "runs past one page" }, next: { grain: "whole" } };
    }
    const second = args["after"] === "1.0123456789abcdef";
    return { has: ROOT_LINE, ...base, meme: { uri: "lar:///t/x", text: second ? "BBBBBB" : "AAAA", canonicalHash: "sha256:9", bytes: 10, slots, page: { page: second ? 2 : 1, pages: 2 } },
      grain: { asked: "whole", applied: "whole", why: "the whole carrier, cut on slot boundaries" }, next: second ? null : { grain: "whole", after: "1.0123456789abcdef" } };
  };
  /** Run a human-mode get (no --json) and read stdout and stderr apart. */
  async function human(options: Record<string, string>, flags: Record<string, boolean>): Promise<{ exit: number; out: string; err: string[] }> {
    const out: string[] = []; const err: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(((chunk: unknown) => { out.push(String(chunk)); return true; }) as never);
    const e = vi.spyOn(console, "error").mockImplementation((m: unknown) => { err.push(String(m)); });
    try {
      const exit = await cmdTiddler({ command: "tiddler", positional: ["get", "lar:///t/x"], options: { recipe: "default", ...options }, flags } as unknown as ParsedArgs);
      return { exit, out: out.join(""), err };
    } finally { spy.mockRestore(); e.mockRestore(); }
  }

  test("RED: the lens and the grain ride the wire apart; --skinny and --all spell the grain with flags the line already held; both refuse before the wire", () => {
    expect(tiddlerPlan("get", argv("tiddler", ["get", "lar:///t/x"], { recipe: "default" }, { meme: true })).args).toEqual({ recipe: "default", title: "lar:///t/x", meme: true });
    expect(tiddlerPlan("get", argv("tiddler", ["get", "lar:///t/x"], { recipe: "default" }, { meme: true, all: true })).args).toEqual({ recipe: "default", title: "lar:///t/x", meme: true, grain: "whole" });
    expect(tiddlerPlan("get", argv("tiddler", ["get", "Note"], { recipe: "default" }, { all: true })).args).toEqual({ recipe: "default", title: "Note", grain: "whole" });
    expect(tiddlerPlan("get", argv("tiddler", ["get", "Note"], { recipe: "default" }, { skinny: true })).args).toEqual({ recipe: "default", title: "Note", grain: "skinny" });
    expect(() => tiddlerPlan("get", argv("tiddler", ["get", "Note"], { recipe: "default" }, { skinny: true, all: true }))).toThrow(/name one grain/);
  });

  test("RED: past a page, a pipe gets the has-stack on stdout (never a cut carrier) and stderr names the whole", async () => {
    h.replyFor = answer;
    const r = await human({}, { meme: true });
    expect(r.exit).toBe(0);
    expect(r.out).toBe(`${ROOT_LINE}\n<<~ has name=\`#/a\` params=\`bytes/4 ~ a\`>>\n<<~ has name=\`#/b\` params=\`bytes/6 ~ b\`>>\n`);
    expect(r.err).toEqual(["base: sha256:9", "size: 10 bytes", "grain: skinny (runs past one page)", expect.stringMatching(/--all reads the whole carrier/)]);
  });

  test("RED: --all follows the pages and writes the whole carrier on stdout, the root's has line on stderr; --json carries it joined", async () => {
    h.replyFor = answer;
    const r = await human({}, { meme: true, all: true });
    expect(r.out).toBe("AAAABBBBBB");
    expect(r.err[0]).toBe(ROOT_LINE);
    expect(h.calls.map((c) => c.args["after"])).toEqual([undefined, "1.0123456789abcdef"]);
    h.calls.length = 0;
    const env = await run(argv("tiddler", ["get", "lar:///t/x"], { recipe: "default" }, { meme: true, all: true }));
    expect(env.printed["data"]).toMatchObject({ has: ROOT_LINE, lens: "meme", meme: { text: "AAAABBBBBB", canonicalHash: "sha256:9" }, next: null });
    // A joined read echoes the join, never the first page's `page 1 of N`.
    expect((env.printed["data"] as { grain: { why: string } }).grain.why).toMatch(/2 pages joined/);
  });

  test("CONTROL: the record lens prints the record as a .tid reads, its has line first on stderr", async () => {
    h.replyFor = null;
    h.reply = { has: "<<~ has name=`Note` params=`recipe/default position/plain bytes/5 base/sha256-aa`>>", recipe: "default", title: "Note", lens: "record",
      tiddler: { fields: { title: "Note", text: "words" }, hash: "sha256-aa", textHash: "sha256-bb", bag: null, position: "plain" }, grain: { asked: null, applied: "fat", why: "fits one page" }, next: null };
    const out: string[] = []; const err: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(((chunk: unknown) => { out.push(String(chunk)); return true; }) as never);
    const e = vi.spyOn(console, "error").mockImplementation((m: unknown) => { err.push(String(m)); });
    try { await cmdTiddler({ command: "tiddler", positional: ["get", "Note"], options: { recipe: "default" }, flags: { json: false } } as unknown as ParsedArgs); }
    finally { spy.mockRestore(); e.mockRestore(); }
    expect(out.join("")).toBe("title: Note\n\nwords\n");
    expect(err).toEqual(["<<~ has name=`Note` params=`recipe/default position/plain bytes/5 base/sha256-aa`>>", "base: sha256-aa"]);
  });
});

/**
 * THE COMPOSITION VERDICT REACHES THE OPERATOR WHO ASKED FOR IT (moved here with `meme project --to mem`, which retired into
 * `tiddler get --meme --all`).
 *
 * `readCarrierShape` reads a fault that exists NOWHERE in the records it composes: a guest pastes a whole framed carrier into an
 * `ahu` section, the child's bytes read as a legal carrier, the root's bytes read as a legal carrier, and `expandRefs` joins them
 * into an illegal one carrying TWO text frames where only the first verifies (`child-grade-decision.mem` #/measured rows 11, 13).
 * The meme lens is where a human waits on a carrier, so the reading lands there: the door reads a carrier answered in one page
 * (its `shape`, where it faults), and the CLI reads a carrier `--all` joined from pages. IT REPORTS RATHER THAN REFUSES: the bytes
 * still land, and the fault reaches both channels with a non-zero exit.
 */
describe("tiddler get --meme reads the composition it carries", () => {
  /** A clean carrier at its full floor, minted here and stamped by the house's own normalizer (no canon read). */
  const CLEAN = normalizeMemeSource([
    `<<!DOCTYPE type=\`memetic-wikitext+tiddlywiki\` spec=\`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext\`>>`, ``,
    `<<^ code=\`&#x0001;\` namespace=\`&#x2299;\` from=\`?\` to=\`lar:///t/clean\`>>`, `<<^ code=\`&#x0002;\`>>`, ``,
    "```toml meta", `type     = "text/memetic-wikitext+tiddlywiki"`, `uri-path = "t/clean"`, "```", ``,
    "<<~ ahu slot=`#/a`>>", ``, `! a`, ``, `one clean body`, ``, "<<~/ahu>>", ``,
    `<<^ code=\`&#x0003;\`>>`, ``, `<<^ code=\`&#x0004;\` to=\`?\`>>`, ``,
  ].join("\n")).text;
  const HEAD = [
    `<<!DOCTYPE type=\`memetic-wikitext+tiddlywiki\` spec=\`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext\`>>`,
    ``,
    `<<^ code=\`&#x0001;\` namespace=\`&#x2299;\` from=\`?\` to=\`lar:///t/two-heads\`>>`,
    `<<^ code=\`&#x0002;\`>>`,
    ``,
  ].join("\n");
  const FIRST = HEAD + ["```toml meta", `type     = "text/memetic-wikitext+tiddlywiki"`, `uri-path = "t/two-heads"`, "```", ``, `body one`, ``, ``].join("\n");
  const SECOND = [`<<^ code=\`&#x0002;\`>>`, ``, `body two`, ``, `<<^ code=\`&#x0003;\` bcc=\`ni:///sha-256;AAAA\`>>`, `<<^ code=\`&#x0004;\` to=\`?\`>>`, ``].join("\n");
  const TWO_FRAMES = FIRST + SECOND;
  const TORN = FIRST;
  /** A carrier answered in pages: the door hands back each page and the cursor of the one behind. */
  const paged = (pages: readonly string[], shape?: { check: string; faults: string[] }) => (args: Record<string, unknown>): Record<string, unknown> => {
    const at = typeof args["after"] === "string" ? Number(String(args["after"]).split(".")[0]) : 0;
    const last = at + 1 >= pages.length;
    return {
      has: "<<~ has name=`lar:///t/two-heads` params=`recipe/default base/sha256:9`>>", recipe: "default", title: "lar:///t/two-heads", lens: "meme",
      meme: { uri: "lar:///t/two-heads", text: pages[at], canonicalHash: "sha256:9", bytes: 9, slots: [], ...(pages.length > 1 ? { page: { page: at + 1, pages: pages.length } } : {}) },
      grain: { asked: "whole", applied: "whole", why: "the whole carrier" }, next: last ? null : { grain: "whole", after: `${at + 1}.0123456789abcdef` },
      ...(shape ? { shape } : {}),
    };
  };
  async function human(flags: Record<string, boolean>): Promise<{ code: number; out: string; err: string }> {
    const out: string[] = []; const err: string[] = [];
    const so = vi.spyOn(process.stdout, "write").mockImplementation(((l: unknown) => { out.push(String(l)); return true; }) as never);
    const ce = vi.spyOn(console, "error").mockImplementation(((...a: unknown[]) => { err.push(a.map(String).join(" ")); }) as never);
    try {
      const code = await cmdTiddler({ command: "tiddler", positional: ["get", "lar:///t/two-heads"], options: { recipe: "default" }, flags: { meme: true, json: false, ...flags } } as unknown as ParsedArgs);
      return { code, out: out.join(""), err: err.join("\n") };
    } finally { so.mockRestore(); ce.mockRestore(); }
  }

  test("★ RED — a carrier `--all` joins from pages carrying TWO text frames reaches the operator's channel, and the bytes still land ★", async () => {
    h.replyFor = paged([FIRST, SECOND]);
    const r = await human({ all: true });
    expect(r.err).toMatch(/2 text frames stand where the grammar admits one/);
    expect(r.out).toBe(TWO_FRAMES);
    expect(r.code).not.toBe(0);
  });

  test("the fault rides the --json channel too: `ok` names the act, the exit names the reading", async () => {
    h.replyFor = paged([FIRST, SECOND]);
    const env = await run(argv("tiddler", ["get", "lar:///t/two-heads"], { recipe: "default" }, { meme: true, all: true }));
    const data = env.printed["data"] as { meme: { text: string }; shape?: { faults: string[] } };
    expect(data.shape?.faults.join(" ")).toMatch(/2 text frames stand where the grammar admits one/);
    expect(env.printed["ok"]).toBe(true);
    expect(data.meme.text).toBe(TWO_FRAMES);
    expect(env.exit).not.toBe(0);
  });

  test("a carrier answered in one page carries the door's own reading; the CLI names it and exits non-zero", async () => {
    h.replyFor = paged([TWO_FRAMES], { check: "unchecked", faults: ["2 text frames stand where the grammar admits one"] });
    const r = await human({});
    expect(r.err).toMatch(/2 text frames stand where the grammar admits one/);
    expect(r.out).toBe(TWO_FRAMES);
    expect(r.code).not.toBe(0);
  });

  test("CONTROL: a clean carrier reads silently and BYTE-IDENTICALLY; no ⚠ line rides stderr", async () => {
    const clean = CLEAN;
    h.replyFor = paged([clean]);
    const r = await human({});
    expect(r.code).toBe(0);
    expect(r.err).not.toMatch(/⚠/);
    expect(r.out).toBe(clean);
  });

  test("CONTROL: a TORN frame reads DISTINCT from a two-frame smuggle — truncated is never unchecked", async () => {
    h.replyFor = paged([TORN, ""]);
    const torn = await human({ all: true });
    expect(torn.err).toMatch(/the frame opens and never closes — STX stands without ETX/);
    expect(torn.err).not.toMatch(/2 text frames/);
    h.replyFor = paged([FIRST, SECOND]);
    const two = await human({ all: true });
    expect(two.err).not.toMatch(/opens and never closes/);
  });
});

describe("tiddler get --meme answers the carrier through a pipe (the carrier-first law)", () => {
  const reply = { has: "<<~ has name=`lar:///t/x` params=`recipe/default base/sha256:9`>>", recipe: "default", title: "lar:///t/x", lens: "meme",
    meme: { uri: "lar:///t/x", text: "<<^ code=`&#x0001;`>> body\n", canonicalHash: "sha256:9", bytes: 27, slots: [] },
    grain: { asked: null, applied: "whole", why: "fits one page" }, next: null };
  const pipe = async (flags: Record<string, boolean>): Promise<{ code: number; out: string; err: string[] }> => {
    const out: string[] = []; const err: string[] = [];
    const w = vi.spyOn(process.stdout, "write").mockImplementation((m: unknown) => { out.push(String(m)); return true; });
    const e = vi.spyOn(console, "error").mockImplementation((m: unknown) => { err.push(String(m)); });
    const tty = process.stdout.isTTY;
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
    try {
      const code = await cmdTiddler({ command: "tiddler", positional: ["get", "lar:///t/x"], options: { recipe: "default" }, flags: { meme: true, ...flags } } as unknown as ParsedArgs);
      return { code, out: out.join(""), err };
    } finally {
      Object.defineProperty(process.stdout, "isTTY", { value: tty, configurable: true });
      w.mockRestore(); e.mockRestore();
    }
  };

  test("★ through a pipe, a bare --meme get answers the CARRIER on stdout and the has line and base on stderr ★", async () => {
    h.reply = reply;
    const r = await pipe({});
    expect(r.code).toBe(0);
    expect(r.out).toBe("<<^ code=`&#x0001;`>> body\n");
    expect(r.err.slice(0, 2)).toEqual(["<<~ has name=`lar:///t/x` params=`recipe/default base/sha256:9`>>", "base: sha256:9"]);
  });

  test("CONTROL: `--json` asks for the envelope, the daemon's answer verbatim", async () => {
    h.reply = reply;
    const r = await pipe({ json: true });
    expect(JSON.parse(r.out)["data"]).toEqual(reply);
  });

  test("through a pipe, an absent meme refuses in prose on stderr and leaves stdout empty, so a redirect never saves an error as a meme", async () => {
    h.reply = { recipe: "default", title: "lar:///t/x", lens: "meme", tiddler: null };
    const r = await pipe({});
    expect(r.code).toBe(3);
    expect(r.out).toBe("");
    expect(r.err.join(" ")).toMatch(/no tiddler at lar:\/\/\/t\/x/);
  });
});
