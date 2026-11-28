/**
 * tiddler-door.test.ts — the CLI skin of the tiddler door: `lares get · put · delete · rename name=value…`, `lares lar:///<address>`,
 * `lares -` (the call shape, comms-ux-enacts landing 8), and `lares wiki render|status|act`.
 *
 * ONE SPLIT, AND EVERYTHING ELSE IN THE VM. The call door splits its line by one token rule and sends `{verb, params, surface:
 * "cli"}` to the vessel's `call` verb; the route, the `#/takes` binding and the value conversion run in the VM (census-tests#2
 * holds that side). So this half asserts the plan the door sends, the host crossings it folds in, and the answer it prints by
 * the carrier that shaped it.
 *
 * VERB-TABLE PARITY: one table (`lararium-sensorium/scripts/fixtures/tiddler-door-answers.json`) drives this skin and the MCP
 * seat's (`test_tiddler_tools.py`). A call-shape row names the `{verb, params}` the CLI sends (`call`); every other row the
 * daemon wire itself. Either way the row's `output` comes back verbatim as `json=true` `data`.
 */
import { afterEach, describe, test, expect, vi } from "vitest";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ verb: string; args: Record<string, unknown> }>,
  reply: {} as Record<string, unknown>,
  refuse: "" as string,
  replyFor: null as null | ((args: Record<string, unknown>) => Record<string, unknown>),
  rest: null as null | Record<string, unknown>,
}));
vi.mock("../src/verb-call.js", () => ({
  DaemonUnreachable: class extends Error {},
  verbFailure: (err: unknown) => ({ code: "error", message: err instanceof Error ? err.message : String(err) }),
  runVerb: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    if (h.refuse) return { status: "error", requestId: "r", errorMessage: h.refuse };
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: h.replyFor ? h.replyFor(args) : h.reply } }, ...(h.rest ? { rest: h.rest } : {}) };
  },
  runVerbAsFace: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: h.replyFor ? h.replyFor(args) : h.reply } }, ...(h.rest ? { rest: h.rest } : {}) };
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
import { cmdCall, callPlan, type CallSources } from "../src/commands/call.js";
import { actArgsOf } from "../src/commands/act.js";
import { DoorUsage } from "../src/commands/door-call.js";
import { cmdWiki, wikiRenderPlan } from "../src/commands/wiki.js";
import { cmdKahua } from "../src/commands/kahua.js";
import { cmdMeme } from "../src/commands/meme.js";
import { COMMANDS, dispatch, unknownParams, doorTakes } from "../src/bin/lares.js";
import { parseArgs, isCallWord, type ParsedArgs } from "../src/parse-args.js";

interface Row {
  tool: string;
  cli: { command: string; positional: string[]; options: Record<string, string>; flags: Record<string, boolean> };
  call?: { verb: string; params: Record<string, string> };
  wire: { verb: string; args: Record<string, unknown> };
  output: Record<string, unknown>;
}
const TABLE = JSON.parse(readFileSync(new URL("../../lararium-sensorium/scripts/fixtures/tiddler-door-answers.json", import.meta.url), "utf8")) as { rows: Row[] };
const fixture = (value: string): string =>
  value.startsWith("@fixture/") ? new URL(`../../lararium-sensorium/scripts/fixtures/${value.slice(9)}`, import.meta.url).pathname : value;

const argv = (command: string, positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ command, positional, options, flags: { json: true, ...flags } } as unknown as ParsedArgs);
/** A call line as a terminal types it, parsed by the CLI's own parser; `json=true` asks the envelope unless the line names `json=false`. */
const line = (...tokens: string[]): ParsedArgs => {
  const parsed = parseArgs(tokens);
  return parsed.flags["json"] === undefined ? { ...parsed, flags: { ...parsed.flags, json: true } } : parsed;
};
/** The carrier stamp a call's answer carries (the VM's `call` names the carrier that shaped it). */
const by = (address: string): Record<string, unknown> => ({ carrier: { carrier: `lar:///ha.ka.ba/lares/afford/${address}`, hash: "sha256:c" } });
/** No host crossing reached: a test that names none reads neither a file nor stdin. */
const NO_SOURCES: CallSources = { read: () => { throw new Error("no file read"); }, stdin: async () => { throw new Error("no stdin read"); } };

/** Run a command and read the one JSON object it printed. */
async function run(args: ParsedArgs): Promise<{ exit: number; printed: Record<string, unknown> }> {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation(((chunk: unknown) => { chunks.push(String(chunk)); return true; }) as never);
  const log = vi.spyOn(console, "log").mockImplementation((...parts: unknown[]) => { chunks.push(parts.join(" ") + "\n"); });
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const exit = args.command === "wiki" ? await cmdWiki(args) : args.command === "kahua" ? await cmdKahua(args, null)
      : args.command === "meme" ? await cmdMeme(args) : await cmdCall(args);
    const printed = JSON.parse(chunks.join("").trim().split("\n").at(-1)!) as Record<string, unknown>;
    return { exit, printed: args.command === "kahua" ? { ok: true, data: printed } : printed };
  } finally { spy.mockRestore(); log.mockRestore(); err.mockRestore(); }
}

/** Run a call in prose (no `json=true`) and read stdout, stderr and the exit apart; `pipe` reads stdout as no terminal. */
async function prose(args: ParsedArgs, pipe = false): Promise<{ exit: number; out: string; err: string[] }> {
  const out: string[] = []; const err: string[] = [];
  const w = vi.spyOn(process.stdout, "write").mockImplementation(((chunk: unknown) => { out.push(String(chunk)); return true; }) as never);
  const l = vi.spyOn(console, "log").mockImplementation((...parts: unknown[]) => { out.push(parts.map(String).join(" ") + "\n"); });
  const e = vi.spyOn(console, "error").mockImplementation((...parts: unknown[]) => { err.push(parts.map(String).join(" ")); });
  const tty = process.stdout.isTTY;
  if (pipe) Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
  try {
    const exit = await cmdCall(args);
    return { exit, out: out.join(""), err };
  } finally {
    if (pipe) Object.defineProperty(process.stdout, "isTTY", { value: tty, configurable: true });
    w.mockRestore(); l.mockRestore(); e.mockRestore();
  }
}
/** A prose call line: the tokens parsed, `json=true` left unasked (`json=false` where a terminal is not assumed). */
const said = (...tokens: string[]): ParsedArgs => parseArgs([...tokens, "json=false"]);
const piped = (...tokens: string[]): ParsedArgs => parseArgs(tokens);

/** The plan a call line sends, every param it names, the surface `cli`. */
const call = (verb: string, params: Record<string, unknown>) => ({ verb: "call", args: { verb, params, surface: "cli" } });

afterEach(() => { h.calls.length = 0; h.refuse = ""; h.replyFor = null; h.reply = {}; h.rest = null; });

describe("verb-table-parity — the CLI half of the tiddler door's one table", () => {
  test("the table names all its tools, and every door it names stands in the command table", () => {
    expect(new Set(TABLE.rows.map((r) => r.tool))).toEqual(new Set(["act", "get", "put", "delete", "wiki_render", "wiki_status", "kahua_get", "meme_offer_show"]));
    const names = new Set(COMMANDS.map((c) => c.name));
    for (const row of TABLE.rows) expect(names.has(row.cli.command) || isCallWord(row.cli.command), row.cli.command).toBe(true);
  });

  test("every record, filter and act row speaks the call shape: its line is params alone, and it names the call it sends", () => {
    const calls = TABLE.rows.filter((r) => ["get", "put", "delete", "rename", "act"].includes(r.tool));
    expect(calls.length).toBeGreaterThan(10);
    for (const row of calls) {
      expect(row.call, row.tool).toBeDefined();
      expect(isCallWord(row.cli.command), row.tool).toBe(true);
      expect(row.cli.options, row.tool).toEqual({});
      expect(row.cli.flags, row.tool).toEqual({});
    }
  });

  for (const row of TABLE.rows) {
    test(`${row.tool} (${row.cli.command} ${row.cli.positional.join(" ")}): the row's ${row.call ? "call" : "wire"} rides the socket and the row's output comes back verbatim`, async () => {
      h.reply = row.output;
      const options = Object.fromEntries(Object.entries(row.cli.options).map(([key, value]) => [key, fixture(value)]));
      const positional = row.call ? row.cli.positional.map((tok) => tok.replace(/^([a-z][a-z0-9-]*=)(@fixture\/.*)$/, (_m, head: string, value: string) => head + fixture(value))) : row.cli.positional;
      const { exit, printed } = await run(argv(row.cli.command, positional, options, row.cli.flags));
      expect(h.calls).toEqual([row.call ? call(row.call.verb, row.call.params) : row.wire]);
      expect(exit).toBe(0);
      expect(printed).toMatchObject({ ok: true });
      expect(printed["data"]).toEqual(row.output);
    });

    test(`${row.tool}: every option and flag the row spells stands in its command's accepts row`, () => {
      const accepts = new Set(doorTakes(row.cli.command));
      for (const name of [...Object.keys(row.cli.options), ...Object.keys(row.cli.flags)]) expect(accepts.has(name), `${row.cli.command} accepts --${name}`).toBe(true);
    });
  }
});

describe("the call door plans one call: {verb, params, surface: cli}", () => {
  test("★ each verb word sends its params as written, past every flag table ★", async () => {
    const plans: Array<[string[], ReturnType<typeof call>]> = [
      [["get", "title=lar:///t/x", "aperture=measure"], call("get", { title: "lar:///t/x", aperture: "measure" })],
      [["get", "title=Room 4", "recipe=kahu", "form=text"], call("get", { title: "Room 4", recipe: "kahu", form: "text" })],
      [["put", "title=T", "text=new words"], call("put", { title: "T", text: "new words" })],
      [["put", "title=T", "replace= the cat ", "with="], call("put", { title: "T", replace: " the cat ", with: "" })],
      [["put", "title=T", "tag-add=a", "tag-add=[[b c]]"], call("put", { title: "T", "tag-add": "a [[b c]]" })],
      [["delete", "title=lar:///t/x", "family=true"], call("delete", { title: "lar:///t/x", family: "true" })],
      [["rename", "title=Old", "to=New", "base=sha256-x"], call("rename", { title: "Old", to: "New", base: "sha256-x" })],
      [["get", "filter=[tag[x]]", "limit=5"], call("get", { filter: "[tag[x]]", limit: "5" })],
      [["get", "meme=true", "tree=true", "bag=lares"], call("get", { meme: "true", tree: "true", bag: "lares" })],
    ];
    for (const [tokens, plan] of plans) expect((await callPlan(parseArgs(tokens), NO_SOURCES)).plan, tokens.join(" ")).toEqual(plan);
  });

  test("★ an address names its own verb: `lares lar:///engine.record.reads title=x` sends the call; `act` heads no call ★", async () => {
    const plan = call("lar:///engine.record.reads", { title: "x" });
    expect((await callPlan(parseArgs(["lar:///engine.record.reads", "title=x"]), NO_SOURCES)).plan).toEqual(plan);
    expect(isCallWord("lar:///engine.record.reads")).toBe(true);
    expect(isCallWord("act")).toBe(false);
    expect(isCallWord("tiddler")).toBe(false);
  });

  test("★ `lares -` reads one call sigil from stdin and sends it whole; params beside the `-` ride as params ★", async () => {
    const sigil = "<<~ get title=`Room 4`>>";
    const stdin = (bytes: string): CallSources => ({ read: () => { throw new Error("no file read"); }, stdin: async () => Buffer.from(bytes) });
    expect((await callPlan(parseArgs(["-"]), stdin(`${sigil}\n`))).plan).toEqual({ verb: "call", args: { sigil, params: {}, surface: "cli" } });
    expect((await callPlan(parseArgs(["-", "recipe=kahu"]), stdin(sigil))).plan).toEqual({ verb: "call", args: { sigil, params: { recipe: "kahu" }, surface: "cli" } });
    await expect(callPlan(parseArgs(["-"]), stdin("  \n"))).rejects.toThrow(/read no call sigil on stdin/);
    await expect(callPlan(parseArgs(["-", "extra"]), stdin(sigil))).rejects.toThrow(DoorUsage);
  });

  test("RED: a msg naming no stream writes as the instance a summons started (LARES_SUMMONED); a named stream wins; other verbs never take one", async () => {
    const summoned: CallSources = { ...NO_SOURCES, summoned: () => "braid#1" };
    expect((await callPlan(parseArgs(["msg", "note=built"]), summoned)).plan).toEqual(call("msg", { note: "built", stream: "braid#1" }));
    expect((await callPlan(parseArgs(["lar:///engine.msg.lands", "mu=?0"]), summoned)).plan).toEqual(call("lar:///engine.msg.lands", { mu: "?0", stream: "braid#1" }));
    expect((await callPlan(parseArgs(["msg", "stream=tern#2", "note=built"]), summoned)).plan).toEqual(call("msg", { stream: "tern#2", note: "built" }));
    expect((await callPlan(parseArgs(["get", "title=T"]), summoned)).plan).toEqual(call("get", { title: "T" }));
    expect((await callPlan(parseArgs(["msg", "note=built"]), NO_SOURCES)).plan).toEqual(call("msg", { note: "built" }));
  });

  test("`face=N` names the session the call rides and leaves the params", async () => {
    const { plan, face } = await callPlan(parseArgs(["get", "title=T", "face=1"]), NO_SOURCES);
    expect(plan).toEqual(call("get", { title: "T" }));
    expect(face).toBe("1");
    expect((await callPlan(parseArgs(["get", "title=T"]), NO_SOURCES)).face).toBeNull();
  });

  test("a word after a param refuses as usage before anything rides the wire; so does a line naming no verb", async () => {
    await expect(callPlan(parseArgs(["get", "title=x", "stray"]), NO_SOURCES)).rejects.toThrow(DoorUsage);
    const r = await run(line("get", "title=x", "stray"));
    expect(r).toMatchObject({ exit: 2, printed: { ok: false, error: { code: "usage", message: expect.stringContaining("\"stray\" stands after a param") } } });
    expect(h.calls).toEqual([]);
  });

  test("★ the dispatcher rides an address straight to the call door; a dash flag beside it refuses, and `act` answers unknown command ★", async () => {
    h.reply = { has: "<<~ has name=`x`>>", title: "x" };
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await dispatch(["lar:///engine.record.reads", "title=x", "json=true"])).toBe(0);
      expect(h.calls).toEqual([call("lar:///engine.record.reads", { title: "x" })]);
      h.calls.length = 0;
      expect(await dispatch(["act", "lar:///engine.record.reads", "title=x", "json=true"])).toBe(2);
      expect(err.mock.calls.flat().join(" ")).toContain('unknown command "act"');
      expect(await dispatch(["lar:///engine.record.reads", "title=x", "--meme"])).toBe(2);
      expect(err.mock.calls.flat().join(" ")).toContain("dash-flag-burned: dash flags burned; params ride as name=value (lares help lar:///engine.record.reads)");
      expect(h.calls).toEqual([]);
    } finally { out.mockRestore(); err.mockRestore(); }
  });

  test("★ the one act: a residency act rides by its address, the vessel binds it and answers handler/host, and the terminal's door submits the bound act; mu=pentacle reaches it as the island's preview ★", async () => {
    const ADDS = "lar:///carriage.record.adds";
    const bound = { title: "T", from: "lar:///a", to: "lar:///b", yes: true };
    h.replyFor = (args) => (h.calls.length === 1
      ? { has: "<<~ has name=`" + ADDS + "`>>", handler: "host", address: ADDS, params: bound, ...(String((args["params"] as Record<string, unknown>)["mu"] ?? "") === "pentacle" ? { mu: { asked: "pentacle", carry: "_0" } } : {}) }
      : { verb: "ADD" });
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await dispatch([ADDS, "title=T", "from=lar:///a", "to=lar:///b", "yes=true", "json=true"])).toBe(0);
      expect(h.calls[0]).toEqual(call(ADDS, { title: "T", from: "lar:///a", to: "lar:///b", yes: "true" }));
      expect(h.calls[1]).toMatchObject({ verb: "ADD", args: { title: "T", "from-bag": "lar:///a", "to-bag": "lar:///b" } });
      expect(h.calls[1]!.args["dry-run"]).toBeUndefined();
      h.calls.length = 0;
      expect(await dispatch([ADDS, "title=T", "from=lar:///a", "to=lar:///b", "mu=pentacle", "json=true"])).toBe(0);
      expect(h.calls[1]).toMatchObject({ verb: "ADD", args: { title: "T", "dry-run": true } });
      h.calls.length = 0;
      // CONTROL: a verb word no door answers meets the unknown-command refusal and sends nothing.
      expect(await dispatch(["ADD", "title=T", "json=true"])).toBe(2);
      expect(h.calls).toEqual([]);
    } finally { h.refuse = ""; h.replyFor = null; out.mockRestore(); err.mockRestore(); }
  });

  test("★ whether a host door previews is a fact of its code: a layer that claims dry/walks for the repack or the draft pull makes the dry call refuse mu-cell-empty before anything runs ★", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = vi.spyOn(process.stdout, "write").mockImplementation((() => true) as never);
    try {
      for (const [address, params] of [["lar:///carriage.bundle.repacks", { source: "x.json", from: "lar:///b" }], ["lar:///carriage.draft.pulls", { uri: "lar:///t" }]] as const) {
        h.calls.length = 0;
        h.replyFor = () => ({ has: "<<~ has name=`" + address + "`>>", handler: "host", address, params, mu: { asked: "pentacle", carry: "_0" } });
        const exit = await dispatch([address, ...Object.entries(params).map(([k, v]) => `${k}=${v}`), "mu=pentacle", "json=true"]);
        expect(exit, address).not.toBe(0);
        expect(h.calls, address).toHaveLength(1);   // the vessel's call alone: no REPACK, no where, no draft ever rides
        expect(out.mock.calls.flat().join(" "), address).toContain("mu-cell-empty");
        out.mockClear();
      }
    } finally { h.replyFor = null; err.mockRestore(); out.mockRestore(); }
  });

  test("★ a preview rides the mu carry alone: a bound dry-run param (a row a layer added) never becomes the runner's flag; CONTROL: a _ carry does ★", () => {
    const line = argv("act", [], {}, {});
    expect(actArgsOf(line, null, { uri: "lar:///t", "dry-run": true }, null).flags["dry-run"]).toBeUndefined();
    expect(actArgsOf(line, "ADD", { title: "T", "dry-run": true }, null).flags["dry-run"]).toBeUndefined();
    expect(actArgsOf(line, "ADD", { title: "T" }, "_0").flags["dry-run"]).toBe(true);
  });

  test("★ a dash flag on a call verb refuses `dash-flag-burned` before anything runs; the `tiddler` word answers unknown command ★", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const tokens of [["get", "title=T", "--skinny"], ["put", "title=T", "--text", "w"], ["delete", "title=T", "--family"], ["put", "title=T", "--create"]] as const) {
        err.mockClear();
        expect(await dispatch([...tokens]), tokens.join(" ")).toBe(2);
        expect(err.mock.calls.flat().join(" "), tokens.join(" ")).toContain(`dash-flag-burned: dash flags burned; params ride as name=value (lares help ${tokens[0]})`);
      }
      err.mockClear();
      expect(await dispatch(["tiddler", "get", "lar:///t/x", "recipe=default"])).toBe(2);
      expect(err.mock.calls.flat().join(" ")).toContain('unknown command "tiddler"');
      expect(h.calls).toEqual([]);
    } finally { err.mockRestore(); }
  });

  test("each call verb's row reads no param of its own: the call door binds them in the VM, beside the global params", () => {
    for (const name of ["get", "put", "delete", "rename", "watch"]) {
      const row = COMMANDS.find((c) => c.name === name)!;
      expect(row.handler, name).toBe(cmdCall);
      expect(unknownParams(row, line(name, "title=T", "yes=true"))).toEqual([]);
      // A call head keeps its params as written: this side folds none, so none refuses here; the carrier's #/takes binds them.
      const parsed = parseArgs([name, "title=T", "face=1"]);
      expect(parsed.positional, name).toEqual(["title=T", "face=1"]);
      expect(parsed.options, name).toEqual({});
      expect(unknownParams(row, parsed), name).toEqual([]);
    }
  });
});

describe("the wiki door keeps its engine verbs; a filter pages through `get filter=`", () => {
  test("`wiki filter` left the wiki door whole: it answers as an unknown wiki verb and nothing rides the wire", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try { expect(await cmdWiki(argv("wiki", ["filter", "[tag[x]]"], { recipe: "default" }, { json: false }))).toBe(2); }
    finally { err.mockRestore(); }
    expect(h.calls).toEqual([]);
  });
  test("wiki render output takes a distinct effectful route", () => {
    const plan = wikiRenderPlan(argv("wiki", ["[tag[export]]"], {
      recipe: "default", output: "workbench", filename: "[addsuffix[.html]]", type: "text/html",
    }));
    expect(plan).toMatchObject({ verb: "wiki-render-out", args: {
      recipe: "default", filter: "[tag[export]]", output: "workbench", filename: "[addsuffix[.html]]", type: "text/html",
    } });
  });
  test("a wiki render naming no container reads the worn face's daemon wiki (recipe default)", () => {
    expect(wikiRenderPlan(argv("wiki", ["T"])).args).toMatchObject({ recipe: "default", title: "T" });
  });
  test("wiki render output flags reach only the output path", () => {
    const row = COMMANDS.find((c) => c.name === "wiki")!;
    const output = argv("wiki", ["render", "[tag[export]]"], { recipe: "default", output: "workbench", filename: "[addsuffix[.html]]", type: "text/html" });
    expect(unknownParams(row, output)).toEqual([]);
    for (const sub of ["status"]) {
      expect(unknownParams(row, argv("wiki", [sub], { output: "workbench" })).map((x) => x.name)).toEqual(["output"]);
    }
  });
  test("the normal CLI entry refuses output on a read path before dispatch", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await dispatch(["wiki", "status", "recipe=default", "output=workbench"])).toBe(2);
      expect(error.mock.calls.flat().join(" ")).toContain("unknown param output=");
      expect(h.calls).toEqual([]);
    } finally { error.mockRestore(); }
  });
  test("wiki render output carries the node manifest and refuses a cross-face visit before dispatch", async () => {
    h.reply = { has: "<<~ has name=`wiki-render-out` params=`outcome/written files/1`>>", outcome: "written", files: [{ name: "a.html", bytes: 1, digest: "sha256-x" }], skipped: [] };
    const output = await run(argv("wiki", ["render", "[tag[export]]"], { recipe: "notes", output: "workbench", filename: "[is[tiddler]addsuffix[.html]]", variables: '{"label":"sent"}' }));
    expect(output).toMatchObject({ exit: 0, printed: { data: { outcome: "written", files: [{ name: "a.html" }] } } });
    expect(h.calls).toEqual([{ verb: "wiki-render-out", args: { recipe: "notes", filter: "[tag[export]]", output: "workbench", filename: "[is[tiddler]addsuffix[.html]]", variables: { label: "sent" } } }]);
    h.reply = { has: "<<~ has name=`wiki-render-out` params=`outcome/partial files/1`>>", outcome: "partial", files: [{ name: "a.html", bytes: 1, digest: "sha256-x" }], skipped: [], refusal: "interrupted" };
    const partial = await run(argv("wiki", ["render", "[tag[export]]"], { recipe: "notes", output: "workbench" }));
    expect(partial).toMatchObject({ exit: 4, printed: { ok: false, data: { outcome: "partial", files: [{ name: "a.html" }] }, error: { code: "render-partial" } } });
    h.calls.length = 0;
    expect((await run(argv("wiki", ["render", "[tag[export]]"], { recipe: "notes", output: "workbench", target: "h1" }))).exit).toBe(2);
    expect(h.calls).toEqual([]);
  });
  test("a render names one source", () => {
    expect(() => wikiRenderPlan(argv("wiki", ["T"], { recipe: "default", text: "span" }))).toThrow(/one source/);
    expect(() => wikiRenderPlan(argv("wiki", [], { recipe: "default" }))).toThrow(/one source/);
  });
});

describe("a bag names one store and no wiki", () => {
  test("RED: the engine verbs refuse bag= before the wire and name the call that reads a bag; CONTROL: get, put and delete bag= ride the call", async () => {
    for (const positional of [["render", "T"], ["status"]]) {
      const r = await run(argv("wiki", [...positional], { bag: "lares" }));
      expect(r.exit).toBe(2);
      expect(r.printed).toMatchObject({ ok: false, error: { code: "wiki-not-anchored", message: expect.stringMatching(/runs in a wiki's own engine.*lares get title=<title> bag=<slug>.*aperture=arc.*lares get meme=true bag=<slug>.*recipe=<slug>/s) } });
    }
    expect(h.calls).toEqual([]);
    h.reply = { bag: "lar:///ha.ka.ba/bags/lares", title: "T", tiddler: { fields: { title: "T", text: "words" }, hash: "sha256-x", textHash: "sha256-y", bag: "lar:///ha.ka.ba/bags/lares", position: "plain" }, ...by("engine.record.reads") };
    expect(await run(line("get", "title=T", "bag=lares"))).toMatchObject({ exit: 0, printed: { ok: true } });
    expect(h.calls).toEqual([call("get", { title: "T", bag: "lares" })]);
    expect((await callPlan(parseArgs(["put", "title=T", "bag=lares", "text=x"]), NO_SOURCES)).plan).toEqual(call("put", { title: "T", bag: "lares", text: "x" }));
    expect((await callPlan(parseArgs(["delete", "title=T", "bag=lares", "family=true"]), NO_SOURCES)).plan).toEqual(call("delete", { title: "T", bag: "lares", family: "true" }));
  });
});

describe("wiki keep and switch wire", () => {
  test.each([
    ["keep", "wiki-keep", { slug: "works" }],
    ["unkeep", "wiki-unkeep", { slug: "works" }],
  ])("wiki %s sends %s", async (sub, verb, wireArgs) => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdWiki(argv("wiki", [sub, "works"], {}, {}));
    expect(h.calls).toEqual([{ verb, args: wireArgs }]);
    vi.restoreAllMocks();
  });
  test.each([[{}, "wiki-switch", { slug: "works", remount: true }]])(
    "switch flags %j send %s", async (flags, verb, wireArgs) => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      await cmdWiki(argv("wiki", ["switch", "works"], {}, flags));
      expect(h.calls).toEqual([{ verb, args: wireArgs }]);
      vi.restoreAllMocks();
    });
  test("status refuses a target without a recipe and a recipe without a value before the wire", async () => {
    for (const [options, flags, code] of [
      [{ target: "h1" }, {}, "usage"], [{}, { recipe: true }, "no-container"],
      [{ recipe: "default", bag: "x" }, {}, "wiki-not-anchored"],
      [{ recipe: "default", realm: "x" }, {}, "no-container"],
    ] as const) {
      const r = await run(argv("wiki", ["status"], options, flags));
      expect(r.exit).toBe(2);
      expect(r.printed).toMatchObject({ ok: false, error: { code } });
      expect(h.calls).toEqual([]);
    }
  });
  test("status renders the three human views", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await cmdWiki(argv("wiki", ["status"], {}, { json: false }))).toBe(0);
    expect(h.calls.map(c => c.verb)).toEqual(["list-wikis", "wiki-active", "residency"]);
    expect(log.mock.calls.flat().join(" ")).toContain("active wikis");
    expect(log.mock.calls.flat().join(" ")).toContain("held (");
    log.mockRestore();
  });
  test("status surveys the vessel or reads the named engine", async () => {
    await run(argv("wiki", ["status"]));
    expect(h.calls).toEqual(["list-wikis", "wiki-active", "residency"].map(verb => ({ verb, args: {} })));
    h.calls.length = 0;
    await run(argv("wiki", ["status"], { recipe: "works" }));
    expect(h.calls).toEqual([{ verb: "wiki-status", args: { recipe: "works" } }]);
  });
});

describe("the answer prints by the carrier that shaped it: a receipt names its exit", () => {
  test("a put's receipt: put 0, conflict and exists 4; a put's has line and its layer print in prose", async () => {
    h.reply = { has: "<<~ has name=`T` params=`decision/put`>>", title: "T", decision: "put", created: true, changed: ["text"], hash: "sha256:2", bag: "lar:///ha.ka.ba/wikis/daemon/working", ...by("engine.record.puts") };
    const landed = await prose(said("put", "title=T", "text=x"));
    expect(landed.exit).toBe(0);
    expect(landed.out).toContain("<<~ has name=`T` params=`decision/put`>>\nput: T\n  created text\n  in lar:///ha.ka.ba/wikis/daemon/working");
    expect(landed.out).toContain("  base: sha256:2 (record: hand it back on a put to T)");
    h.reply = { decision: "conflict", hash: "sha256-live", changed: [], ...by("engine.record.puts") };
    const conflict = await run(line("put", "title=T", "fields={\"a\":\"b\"}", "base=sha256-old"));
    expect(conflict).toMatchObject({ exit: 4, printed: { ok: false, error: { code: "conflict", message: expect.stringContaining("moved past sha256-old") }, data: { hash: "sha256-live" } } });
    h.reply = { decision: "exists", hash: "sha256-live", changed: [], ...by("engine.record.puts") };
    const exists = await run(line("put", "title=Room 4", "text=x", "create=true"));
    expect(exists).toMatchObject({ exit: 4, printed: { error: { code: "conflict", message: expect.stringContaining("`lares get title='Room 4' aperture=measure`") } } });
    h.reply = { title: "Ledger", decision: "conflict", hash: "sha256:3", ...by("engine.record.puts") };
    expect(await run(line("put", "title=Ledger", "append=a dated note"))).toMatchObject({ exit: 4, printed: { error: { message: expect.stringContaining("kept moving under the append") } } });
  });

  test("a delete's receipt: removed 0, absent 3, a family refusal 4 with its name and the consequence it read", async () => {
    h.reply = { title: "lar:///t/x", decision: "removed", tombstoned: ["lar:///t/x", "lar:///t/x#/b"], ...by("engine.record.removes") };
    expect(await run(line("delete", "title=lar:///t/x", "family=true"))).toMatchObject({ exit: 0, printed: { ok: true, data: { tombstoned: ["lar:///t/x", "lar:///t/x#/b"] } } });
    h.reply = { decision: "absent", tombstoned: [], ...by("engine.record.removes") };
    expect((await run(line("delete", "title=T"))).exit).toBe(3);
    h.reply = { title: "lar:///t/x", decision: "refused", refusal: "tiddler-delete-in-a-family", why: "tiddler-delete-in-a-family: \"lar:///t/x\" stands as a meme root of lar:///t/x", tombstoned: [],
      consequence: { position: "root", family: "lar:///t/x", acts: [{ title: "lar:///t/x", act: "tombstone" }, { title: "lar:///t/x#/b", act: "tombstone" }], leaves: [], orphans: [], refusals: [] }, ...by("engine.record.removes") };
    expect(await run(line("delete", "title=lar:///t/x"))).toMatchObject({ exit: 4, printed: { ok: false, error: { code: "verb-error", hint: "refusal: tiddler-delete-in-a-family", message: expect.stringContaining("tiddler-delete-in-a-family:") },
      data: { decision: "refused", consequence: { position: "root", acts: [{ title: "lar:///t/x" }, { title: "lar:///t/x#/b" }] } } } });
    h.reply = { decision: "conflict", hash: "sha256:2", tombstoned: [], ...by("engine.record.removes") };
    expect((await run(line("delete", "title=lar:///t/x", "base=sha256:1", "family=true"))).exit).toBe(4);
  });

  test("a rename's receipt: renamed 0 with its relinks, absent 3, conflict 4, a refusal 4 with its name", async () => {
    h.reply = { title: "Old", to: "New", decision: "renamed", relinked: ["Child"], forwarder: "Old", ...by("engine.record.renames") };
    expect(await run(line("rename", "title=Old", "to=New"))).toMatchObject({ exit: 0, printed: { ok: true, data: { relinked: ["Child"] } } });
    const said_ = await prose(said("rename", "title=Old", "to=New"));
    expect(said_.out).toBe("renamed: Old -> New\n  forwarder stands at Old\n  relinked Child\n");
    h.reply = { decision: "absent", ...by("engine.record.renames") };
    expect((await run(line("rename", "title=Old", "to=New"))).exit).toBe(3);
    h.reply = { decision: "conflict", hash: "sha256-live", ...by("engine.record.renames") };
    expect((await run(line("rename", "title=Old", "to=New", "base=sha256-old"))).exit).toBe(4);
    h.reply = { decision: "refused", refusal: "rename-target-stands", why: "rename-target-stands: \"New\" already stands; run `lares delete title=New` first", ...by("engine.record.renames") };
    expect(await run(line("rename", "title=Old", "to=New"))).toMatchObject({ exit: 4, printed: { ok: false, error: { code: "verb-error", hint: "refusal: rename-target-stands", message: expect.stringContaining("lares delete title=New") } } });
  });

  test("a dry answer prints whole: nothing landed, every key reads", async () => {
    h.reply = { has: "<<~ has name=`T` params=`dry/true`>>", dry: true, title: "T", decision: "put", bag: "lar:///ha.ka.ba/wikis/daemon/working", ...by("engine.record.puts") };
    const r = await prose(said("put", "title=T", "text=x", "mu=pentacle"));
    expect(r.exit).toBe(0);
    expect(r.out.split("\n")[0]).toBe("<<~ has name=`T` params=`dry/true`>>");
    expect(r.out).toContain("dry: true\n");
    expect(r.out).toContain("decision: put\n");
  });

  test("an answer from a carrier with no printer of its own prints its has line, then its data one key per line", async () => {
    h.reply = { has: "<<~ has name=`cast`>>", title: "lar:///ha.ka.ba/x", count: 2, carrier: { carrier: "lar:///ha.ka.ba/lares/afford/oracle.cast.draws" } };
    const r = await prose(said("lar:///oracle.cast.draws", "query=q"));
    expect(r.exit).toBe(0);
    expect(r.out.split("\n").slice(0, 3)).toEqual(["<<~ has name=`cast`>>", "title: lar:///ha.ka.ba/x", "count: 2"]);
  });

  test("a vessel refusal names itself: its code leads the hint, and the exit names its class", async () => {
    h.refuse = "family-carriage-derives: \"lar:///t/x\" stands as a meme root and this put moves `type`";
    expect(await run(line("put", "title=lar:///t/x", "text=x"))).toMatchObject({ exit: 4, printed: { ok: false, error: { code: "verb-error", hint: "refusal: family-carriage-derives" } } });
    h.refuse = "filter-malformed: Missing ] in filter expression (in \"[tag[x\")";
    expect(await run(line("get", "filter=[tag[x"))).toMatchObject({ exit: 4, printed: { error: { hint: "refusal: filter-malformed" } } });
    h.refuse = "cap-denied: read on lar:///ha.ka.ba/wikis/daemon/working required (no-grant)";
    expect(await run(line("get", "title=T"))).toMatchObject({ exit: 5, printed: { error: { code: "cap-denied" } } });
  });

  test("a visit from a sibling's session names the face it read: the island's `face` stands over the session's face=", async () => {
    h.reply = { title: "T", tiddler: { fields: { title: "T", text: "w" }, hash: "h", textHash: "t", bag: "b", position: "plain" }, face: 0, worn: 1, visit: true, ...by("engine.record.reads") };
    const { printed } = await run(line("get", "title=T", "face=1", "target=0"));
    expect(printed["data"]).toMatchObject({ face: 0, worn: 1, visit: true });
    expect(h.calls).toEqual([call("get", { title: "T", target: "0" })]);
    h.reply = { recipe: "default", working: "w", layers: [] };
    expect((await run(argv("wiki", ["status"], { recipe: "default", face: "1" }))).printed["data"], "an answer naming no face takes the session's").toMatchObject({ face: 1 });
  });
});

describe("no silent loss: a write whose save cannot seal answers owed, never a bare ok", () => {
  // The live house (2026-11-25): face 1's put answered ok while its save refused `signer-refused` and evaporated at the
  // next down. The vessel's door now stamps `rest: { band: "owed" }` on a write whose document still waits unsealed.
  const owed = { band: "owed", documents: [{ documentId: "2hUgpNYoRGAkCcCXTgZGecaQBXsp", refusal: "save-unsealed", error: "record-refused", cause: "signer-refused:signer-refused" }] };
  test("a put the vessel answers owed exits owed, carries the band in data and names the waiting document", async () => {
    h.reply = { decision: "put", hash: "sha256-new", changed: ["text"], bag: "lar:///ha.ka.ba/wikis/lares/working", ...by("engine.record.puts") };
    h.rest = owed;
    const put = await run(line("put", "title=T", "recipe=lares", "text=x", "face=1"));
    expect(put).toMatchObject({ exit: 6, printed: { ok: false, error: { code: "owed", message: expect.stringContaining("2hUgpNYoRGAk") }, data: { decision: "put", rest: owed } } });
  });
  test("one path for every door: readVerbOutcome reads an owed answer as a refusal by code owed, the receipt kept beside it", async () => {
    const { readVerbOutcome } = await import("../src/verb-result.js");
    const read = readVerbOutcome({ status: "done", requestId: "r", results: { summary: { ok: true, output: { decision: "put" } } }, rest: owed as never });
    expect(read).toMatchObject({ ok: false, code: "owed", output: { decision: "put", rest: owed }, error: expect.stringMatching(/^owed: .*2hUgpNYoRGAk/) });
    expect(readVerbOutcome({ status: "done", requestId: "r", results: { summary: { ok: true, output: { decision: "noop" } } } })).toMatchObject({ ok: true });
  });
  test("a delete the vessel answers owed exits owed too; a put with no band stays ok", async () => {
    h.reply = { decision: "removed", tombstoned: ["T"], ...by("engine.record.removes") };
    h.rest = owed;
    expect(await run(line("delete", "title=T", "recipe=lares"))).toMatchObject({ exit: 6, printed: { ok: false, error: { code: "owed" } } });
    h.rest = null;
    h.reply = { decision: "put", hash: "sha256-new", changed: ["text"], ...by("engine.record.puts") };
    expect(await run(line("put", "title=T", "recipe=lares", "text=x"))).toMatchObject({ exit: 0, printed: { ok: true } });
  });
});

describe("a get by filter answers in pages", () => {
  test("all=true follows the cursor to the end and joins the pages; a bare call asks one page", async () => {
    const pages: Record<string, Record<string, unknown>> = {
      "": { recipe: "default", filter: "[tag[x]]", titles: ["a", "b"], total: 5, next: "2.aaaaaaaaaaaaaaaa", asOf: "aaaaaaaaaaaaaaaa", ...by("engine.filter.pages") },
      "2.aaaaaaaaaaaaaaaa": { recipe: "default", filter: "[tag[x]]", titles: ["c", "d"], total: 5, next: "4.aaaaaaaaaaaaaaaa", asOf: "aaaaaaaaaaaaaaaa", ...by("engine.filter.pages") },
      "4.aaaaaaaaaaaaaaaa": { recipe: "default", filter: "[tag[x]]", titles: ["e"], total: 5, next: null, asOf: "aaaaaaaaaaaaaaaa", ...by("engine.filter.pages") },
    };
    const after = (args: Record<string, unknown>): unknown => (args["params"] as Record<string, unknown>)["after"];
    h.replyFor = (args) => pages[String(after(args) ?? "")]!;
    const all = await run(line("get", "filter=[tag[x]]", "all=true"));
    expect(h.calls.map((c) => after(c.args))).toEqual([undefined, "2.aaaaaaaaaaaaaaaa", "4.aaaaaaaaaaaaaaaa"]);
    expect(h.calls.every((c) => c.verb === "call" && (c.args["params"] as Record<string, unknown>)["filter"] === "[tag[x]]")).toBe(true);
    expect(all.printed["data"]).toMatchObject({ titles: ["a", "b", "c", "d", "e"], total: 5, next: null, pages: 3 });
    h.calls.length = 0;
    const one = await run(line("get", "filter=[tag[x]]"));
    expect(h.calls).toHaveLength(1);
    expect(one.printed["data"]).toEqual(pages[""]);
  });

  test("the lines lens prints grep-shaped: each matching line under its full title, the page count on stderr", async () => {
    const title = "lar:///ha.ka.ba/kahua/memory/state/handoff";
    h.reply = { recipe: "default", filter: "[tag[x]]", rows: [{ title, fields: {}, lines: [{ n: 4, text: "The floor is green." }, { n: 9, text: "x".repeat(8), cut: true }], matches: 2 }], total: 1, next: null, asOf: "0123456789abcdef", ...by("engine.filter.pages") };
    const r = await prose(said("get", "filter=[tag[x]]", "match= is "));
    expect(r.exit).toBe(0);
    expect(h.calls).toEqual([call("get", { filter: "[tag[x]]", match: " is " })]);
    expect(r.out).toBe(`${title}\tmatches=2\n  4:\tThe floor is green.\n  9:\t${"x".repeat(8)}…\n`);
    expect(r.err).toEqual(["1 of 1"]);
  });
});

describe("a get by title answers on a gradient", () => {
  const ROOT_LINE = "<<~ has name=`lar:///t/x` params=`recipe/default type/text/memetic-wikitext+tiddlywiki position/root slots/2 bytes/10 base/sha256:9`>>";
  const slots = [{ slot: "#/a", bytes: 4, first: "a" }, { slot: "#/b", bytes: 6, first: "b" }];
  const paramsOf = (args: Record<string, unknown>): Record<string, unknown> => (args["params"] as Record<string, unknown>) ?? {};
  const answer = (args: Record<string, unknown>): Record<string, unknown> => {
    const params = paramsOf(args);
    const base = { recipe: "default", title: "lar:///t/x", lens: "meme", ...by("engine.record.reads") };
    if (params["aperture"] !== "arc") {
      return { has: `${ROOT_LINE}\n<<~ has name=\`#/a\` params=\`bytes/4 ~ a\`>>\n<<~ has name=\`#/b\` params=\`bytes/6 ~ b\`>>`, ...base,
        meme: { uri: "lar:///t/x", canonicalHash: "sha256:9", bytes: 10, slots }, grain: { asked: null, applied: "skinny", why: "runs past one page" }, next: { grain: "whole" } };
    }
    const second = params["after"] === "1.0123456789abcdef";
    return { has: ROOT_LINE, ...base, meme: { uri: "lar:///t/x", text: second ? "BBBBBB" : "AAAA", canonicalHash: "sha256:9", bytes: 10, slots, page: { page: second ? 2 : 1, pages: 2 } },
      grain: { asked: "whole", applied: "whole", why: "the whole carrier, cut on slot boundaries" }, next: second ? null : { grain: "whole", after: "1.0123456789abcdef" } };
  };

  test("RED: past a page, a get with no aperture writes the has-stack on stdout (never a cut carrier) and stderr names aperture=arc", async () => {
    h.replyFor = answer;
    const r = await prose(said("get", "title=lar:///t/x"));
    expect(r.exit).toBe(0);
    expect(r.out).toBe(`${ROOT_LINE}\n<<~ has name=\`#/a\` params=\`bytes/4 ~ a\`>>\n<<~ has name=\`#/b\` params=\`bytes/6 ~ b\`>>\n`);
    expect(r.err).toEqual(["base: sha256:9", "size: 10 bytes", "grain: skinny (runs past one page)", expect.stringMatching(/aperture=arc reads the whole carrier/)]);
  });

  test("RED: aperture=arc follows the pages and writes the whole carrier on stdout, the root's has line on stderr; json=true carries it joined", async () => {
    h.replyFor = answer;
    const r = await prose(said("get", "title=lar:///t/x", "aperture=arc"));
    expect(r.out).toBe("AAAABBBBBB");
    expect(r.err[0]).toBe(ROOT_LINE);
    expect(h.calls.map((c) => paramsOf(c.args)["after"])).toEqual([undefined, "1.0123456789abcdef"]);
    expect(h.calls.map((c) => c.verb)).toEqual(["call", "call"]);
    h.calls.length = 0;
    const env = await run(line("get", "title=lar:///t/x", "aperture=arc"));
    expect(env.printed["data"]).toMatchObject({ has: ROOT_LINE, lens: "meme", meme: { text: "AAAABBBBBB", canonicalHash: "sha256:9" }, next: null });
    // A joined read echoes the join, never the first page's `page 1 of N`.
    expect((env.printed["data"] as { grain: { why: string } }).grain.why).toMatch(/2 pages joined/);
  });

  test("CONTROL: a record prints as a .tid reads, its has line first on stderr", async () => {
    h.reply = { has: "<<~ has name=`Note` params=`recipe/default position/plain bytes/5 base/sha256-aa`>>", recipe: "default", title: "Note", lens: "record",
      tiddler: { fields: { title: "Note", text: "words" }, hash: "sha256-aa", textHash: "sha256-bb", bag: null, position: "plain" }, grain: { asked: null, applied: "fat", why: "fits one page" }, next: null, ...by("engine.record.reads") };
    const r = await prose(said("get", "title=Note"));
    expect(r.out).toBe("title: Note\n\nwords\n");
    expect(r.err).toEqual(["<<~ has name=`Note` params=`recipe/default position/plain bytes/5 base/sha256-aa`>>", "base: sha256-aa"]);
  });

  test("an absent record exits not-found, and the family listing (meme=true, no title) answers its roots", async () => {
    h.reply = { recipe: "default", title: "T", tiddler: null, ...by("engine.record.reads") };
    expect(await run(line("get", "title=T"))).toMatchObject({ exit: 3, printed: { ok: false, error: { code: "not-found" } } });
    h.reply = { recipe: "default", roots: [{ uri: "lar:///t/x", canonicalHash: "sha256:9" }], ...by("engine.record.reads") };
    expect(await run(line("get", "meme=true"))).toMatchObject({ exit: 0, printed: { ok: true, data: { roots: [{ uri: "lar:///t/x" }] } } });
    expect(h.calls.at(-1)).toEqual(call("get", { meme: "true" }));
  });
});

/**
 * THE COMPOSITION VERDICT REACHES THE OPERATOR WHO ASKED FOR IT.
 *
 * `readCarrierShape` reads a fault that exists NOWHERE in the records it composes: a guest pastes a whole framed carrier into an
 * `ahu` section, the child's bytes read as a legal carrier, the root's bytes read as a legal carrier, and `expandRefs` joins them
 * into an illegal one carrying TWO text frames where only the first verifies (`child-grade-decision.mem` #/measured rows 11, 13).
 * The door reads a carrier answered in one page (its `shape`, where it faults), and the CLI reads a carrier `aperture=arc` joined
 * from pages. IT REPORTS RATHER THAN REFUSES: the bytes still land, and the fault reaches both channels with a non-zero exit.
 */
describe("a get aperture=arc reads the composition it carries", () => {
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
    const after = (args["params"] as Record<string, unknown>)["after"];
    const at = typeof after === "string" ? Number(after.split(".")[0]) : 0;
    const last = at + 1 >= pages.length;
    return {
      has: "<<~ has name=`lar:///t/two-heads` params=`recipe/default base/sha256:9`>>", recipe: "default", title: "lar:///t/two-heads", lens: "meme",
      meme: { uri: "lar:///t/two-heads", text: pages[at], canonicalHash: "sha256:9", bytes: 9, slots: [], ...(pages.length > 1 ? { page: { page: at + 1, pages: pages.length } } : {}) },
      grain: { asked: "whole", applied: "whole", why: "the whole carrier" }, next: last ? null : { grain: "whole", after: `${at + 1}.0123456789abcdef` },
      ...(shape ? { shape } : {}), ...by("engine.record.reads"),
    };
  };
  const read = async (): Promise<{ code: number; out: string; err: string }> => {
    const r = await prose(said("get", "title=lar:///t/two-heads", "aperture=arc"));
    return { code: r.exit, out: r.out, err: r.err.join("\n") };
  };

  test("★ RED — a carrier aperture=arc joins from pages carrying TWO text frames reaches the operator's channel, and the bytes still land ★", async () => {
    h.replyFor = paged([FIRST, SECOND]);
    const r = await read();
    expect(r.err).toMatch(/2 text frames stand where the grammar admits one/);
    expect(r.out).toBe(TWO_FRAMES);
    expect(r.code).not.toBe(0);
  });

  test("the fault rides the json=true channel too: `ok` names the act, the exit names the reading", async () => {
    h.replyFor = paged([FIRST, SECOND]);
    const env = await run(line("get", "title=lar:///t/two-heads", "aperture=arc"));
    const data = env.printed["data"] as { meme: { text: string }; shape?: { faults: string[] } };
    expect(data.shape?.faults.join(" ")).toMatch(/2 text frames stand where the grammar admits one/);
    expect(env.printed["ok"]).toBe(true);
    expect(data.meme.text).toBe(TWO_FRAMES);
    expect(env.exit).not.toBe(0);
  });

  test("whole pages join to the framed carrier's UTF-8 bytes", async () => {
    const cut = Math.floor(CLEAN.length / 2);
    h.replyFor = paged([CLEAN.slice(0, cut), CLEAN.slice(cut)]);
    const result = await read();
    expect(Buffer.from(result.out, "utf8")).toEqual(Buffer.from(CLEAN, "utf8"));
    expect(result.code).toBe(0);
  });

  test("a carrier answered in one page carries the door's own reading; the CLI names it and exits non-zero", async () => {
    h.replyFor = paged([TWO_FRAMES], { check: "unchecked", faults: ["2 text frames stand where the grammar admits one"] });
    const r = await read();
    expect(r.err).toMatch(/2 text frames stand where the grammar admits one/);
    expect(r.out).toBe(TWO_FRAMES);
    expect(r.code).not.toBe(0);
  });

  test("CONTROL: a clean carrier reads silently and BYTE-IDENTICALLY; no ⚠ line rides stderr", async () => {
    h.replyFor = paged([CLEAN]);
    const r = await read();
    expect(r.code).toBe(0);
    expect(r.err).not.toMatch(/⚠/);
    expect(r.out).toBe(CLEAN);
  });

  test("CONTROL: a TORN frame reads DISTINCT from a two-frame smuggle — truncated is never unchecked", async () => {
    h.replyFor = paged([TORN, ""]);
    const torn = await read();
    expect(torn.err).toMatch(/the frame opens and never closes — STX stands without ETX/);
    expect(torn.err).not.toMatch(/2 text frames/);
    h.replyFor = paged([FIRST, SECOND]);
    const two = await read();
    expect(two.err).not.toMatch(/opens and never closes/);
  });
});

describe("a get aperture=arc answers the carrier through a pipe (the carrier-first law)", () => {
  const reply = { has: "<<~ has name=`lar:///t/x` params=`recipe/default base/sha256:9`>>", recipe: "default", title: "lar:///t/x", lens: "meme",
    meme: { uri: "lar:///t/x", text: "<<^ code=`&#x0001;`>> body\n", canonicalHash: "sha256:9", bytes: 27, slots: [] },
    grain: { asked: null, applied: "whole", why: "fits one page" }, next: null, ...by("engine.record.reads") };

  test("★ through a pipe, a aperture=arc get answers the CARRIER on stdout and the has line and base on stderr ★", async () => {
    h.reply = reply;
    const r = await prose(piped("get", "title=lar:///t/x", "aperture=arc"), true);
    expect(r.exit).toBe(0);
    expect(r.out).toBe("<<^ code=`&#x0001;`>> body\n");
    expect(r.err.slice(0, 2)).toEqual(["<<~ has name=`lar:///t/x` params=`recipe/default base/sha256:9`>>", "base: sha256:9"]);
  });

  test("CONTROL: `json=true` asks for the envelope, the daemon's answer verbatim; a get with no mu answers a pipe in the envelope", async () => {
    h.reply = reply;
    expect(JSON.parse((await prose(piped("get", "title=lar:///t/x", "aperture=arc", "json=true"), true)).out)["data"]).toEqual(reply);
    expect(JSON.parse((await prose(piped("get", "title=lar:///t/x"), true)).out)["data"]).toEqual(reply);
  });

  test("through a pipe, an absent meme refuses in prose on stderr and leaves stdout empty, so a redirect never saves an error as a meme", async () => {
    h.reply = { recipe: "default", title: "lar:///t/x", lens: "meme", tiddler: null, ...by("engine.record.reads") };
    const r = await prose(piped("get", "title=lar:///t/x", "aperture=arc"), true);
    expect(r.exit).toBe(3);
    expect(r.out).toBe("");
    expect(r.err.join(" ")).toMatch(/no tiddler at lar:\/\/\/t\/x/);
  });
});

/**
 * TEXT ALONE (lar:///ha.ka.ba/kahua/memory/course/ai-surface-gestures #/stories): `lares get title=<title> form=text` answers the
 * text's own bytes on stdout and nothing else, a terminal or a pipe alike, the has line and base on stderr; `aperture=arc form=text`
 * keeps the carrier contract (the whole carrier, its pages joined), a slot answers its span, and an answer carrying no text
 * refuses by name.
 */
describe("a get form=text answers the text alone", () => {
  const NOTE_LINE = "<<~ has name=`Note` params=`recipe/default position/plain bytes/5 base/sha256-aa`>>";
  const record = { has: NOTE_LINE, recipe: "default", title: "Note", lens: "record",
    tiddler: { fields: { title: "Note", tags: "memory", text: "words" }, hash: "sha256-aa", textHash: "sha256-bb", bag: "lar:///ha.ka.ba/wikis/daemon/working", position: "plain" },
    grain: { asked: "whole", applied: "fat", why: "asked: the record with its text" }, next: null, ...by("engine.record.reads") };

  test("★ RED: through a pipe, a record's text alone rides stdout, byte for byte with no added newline; the has line and base ride stderr ★", async () => {
    h.reply = record;
    const r = await prose(piped("get", "title=Note", "form=text"), true);
    expect(r.exit).toBe(0);
    expect(r.out).toBe("words");
    expect(r.err.slice(0, 2)).toEqual([NOTE_LINE, "base: sha256-aa"]);
    expect(h.calls.at(-1)).toEqual(call("get", { title: "Note", form: "text" }));
  });

  test("RED: aperture=arc form=text writes the recomposed carrier whole, its pages followed and joined; a slot writes its span", async () => {
    const pages = (args: Record<string, unknown>): Record<string, unknown> => {
      const params = args["params"] as Record<string, unknown>;
      const second = params["after"] === "1.0123456789abcdef";
      if (params["slot"] === "#/a") return { has: "<<~ has name=`lar:///t/x#/a` params=`base/partial:#/a:sha256:9`>>", recipe: "default", title: "lar:///t/x", lens: "meme",
        meme: { uri: "lar:///t/x", slotText: "the a span\n", canonicalHash: "sha256:9", bytes: 10, slots: [], slot: "#/a" }, grain: { asked: null, applied: "slot", why: "one slot" }, next: null, ...by("engine.record.reads") };
      return { has: "<<~ has name=`lar:///t/x` params=`base/sha256:9`>>", recipe: "default", title: "lar:///t/x", lens: "meme",
        meme: { uri: "lar:///t/x", text: second ? "BBBBBB" : "AAAA", canonicalHash: "sha256:9", bytes: 10, slots: [], page: { page: second ? 2 : 1, pages: 2 } },
        grain: { asked: "whole", applied: "whole", why: "the whole carrier, cut on slot boundaries" }, next: second ? null : { grain: "whole", after: "1.0123456789abcdef" }, ...by("engine.record.reads") };
    };
    h.replyFor = pages;
    const whole = await prose(piped("get", "title=lar:///t/x", "aperture=arc", "form=text"), true);
    expect(whole.out).toBe("AAAABBBBBB");
    expect(h.calls.map((c) => (c.args["params"] as Record<string, unknown>)["after"])).toEqual([undefined, "1.0123456789abcdef"]);
    h.calls.length = 0;
    const slot = await prose(piped("get", "title=lar:///t/x", "slot=#/a", "aperture=arc", "form=text"), true);
    expect(slot.out).toBe("the a span\n");
    expect(slot.err[0]).toBe("<<~ has name=`lar:///t/x#/a` params=`base/partial:#/a:sha256:9`>>");
  });

  test("RED: a pointer whose body rode no text refuses text-unread (exit 2) and leaves stdout empty, naming the pointer's cure", async () => {
    h.reply = { has: "<<~ has name=`Pic` params=`recipe/default _canonical_uri/https://x.example/p.txt`>>", recipe: "default", title: "Pic", lens: "record",
      tiddler: { fields: { title: "Pic", _canonical_uri: "https://x.example/p.txt" }, hash: "sha256-cc", textHash: null, bag: null, position: "plain" },
      grain: { asked: "whole", applied: "handle", why: "a web2 `_canonical_uri` names the body and the door never fetches it (web3 only)" }, next: null,
      pointer: { uri: "https://x.example/p.txt", body: "owed", owes: "a web2 address names the body and the door never fetches it", cure: "fetch the bytes by hand, stage them into the content tier" }, ...by("engine.record.reads") };
    const r = await prose(piped("get", "title=Pic", "form=text"), true);
    expect(r.exit).toBe(2);
    expect(r.out).toBe("");
    expect(r.err.join(" ")).toMatch(/text-unread: Pic answered no text alone: the pointer's body rode no text \(a web2 address names the body.*\); fetch the bytes by hand/);
  });

  test("RED: a carrier that answered its has-stack under form=text refuses text-unread, naming the whole read as a runnable call", async () => {
    h.reply = { has: "<<~ has name=`lar:///t/x` params=`slots/2`>>", recipe: "default", title: "lar:///t/x", lens: "meme",
      meme: { uri: "lar:///t/x", canonicalHash: "sha256:9", bytes: 10, slots: [] }, grain: { asked: null, applied: "skinny", why: "runs past one page" }, next: { grain: "whole" }, ...by("engine.record.reads") };
    const r = await prose(piped("get", "title=lar:///t/x", "recipe=kahu", "form=text"), true);
    expect(r.exit).toBe(2);
    expect(r.out).toBe("");
    expect(r.err.join(" ")).toContain("`lares get title=lar:///t/x recipe=kahu aperture=arc form=text` reads the whole carrier");
  });

  test("CONTROL: `json=true` beside form=text keeps the envelope, the daemon's answer verbatim", async () => {
    h.reply = record;
    const r = await prose(piped("get", "title=Note", "form=text", "json=true"), true);
    expect(JSON.parse(r.out)["data"]).toEqual(record);
  });
});

describe("a put's host crossings fold into its params", () => {
  test("file=<path> reads the host file's words as the text; text= beside file= refuses before the wire", async () => {
    const dir = mkdtempSync(join(tmpdir(), "call-door-"));
    try {
      const file = join(dir, "body.mem");
      writeFileSync(file, "alpha\n\n", "utf8");
      h.reply = { title: "lar:///t/x", decision: "put", hash: "sha256:r", landed: [], kept: [], tombstoned: [], warnings: [], ...by("engine.record.puts") };
      expect((await run(line("put", "title=lar:///t/x", `file=${file}`))).exit).toBe(0);
      expect(h.calls.at(-1)).toEqual(call("put", { title: "lar:///t/x", text: "alpha\n\n" }));
      expect((await run(line("put", "title=lar:///t/x", "slot=#/a", `file=${file}`, "base=partial:#/a:sha256:old", "bag=b"))).exit).toBe(0);
      expect(h.calls.at(-1)).toEqual(call("put", { title: "lar:///t/x", slot: "#/a", text: "alpha\n\n", base: "partial:#/a:sha256:old", bag: "b" }));
      const twoSources = await run(line("put", "title=lar:///t/x", "text=x", `file=${file}`));
      expect(twoSources).toMatchObject({ exit: 2, printed: { error: { code: "usage", message: expect.stringContaining("name one text source") } } });
      expect(h.calls).toHaveLength(2);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  test("a field patch carries no text and never waits on stdin; text= carries the words", async () => {
    h.reply = { decision: "put", changed: ["status"], hash: "sha256-x", ...by("engine.record.puts") };
    expect((await callPlan(parseArgs(["put", "title=T", "fields={\"status\":\"done\"}"]), NO_SOURCES)).plan).toEqual(call("put", { title: "T", fields: "{\"status\":\"done\"}" }));
    expect((await callPlan(parseArgs(["put", "title=T", "append=a dated note"]), NO_SOURCES)).plan).toEqual(call("put", { title: "T", append: "a dated note" }));
  });
});
