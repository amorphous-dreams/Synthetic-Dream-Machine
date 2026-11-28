/**
 * THE PARSER KEEPS ONE TOKEN RULE: a door line's params ride `name=value`, a dash flag outside the global ones refuses by name
 * with its param spelling, and a param the line's carrier takes nowhere refuses by name before the handler runs.
 *
 * Course: lar:///ha.ka.ba/kahua/memory/course/comms-ux-enacts#/burn (24 · the parser's flag tables leave).
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { parseArgs, splitCall, ArgsError, GLOBAL_FLAGS, PARAM_TOKEN } from "../src/parse-args.js";
import { dispatch, doorTakes, unknownParams, COMMANDS } from "../src/bin/lares.js";

afterEach(() => vi.restoreAllMocks());

describe("parseArgs: a door line's params", () => {
  test("★ `name=value` lands in options, `name=true` and `name=false` in flags ★", () => {
    const a = parseArgs(["vessel", "found", "--skip-build", "root=/state", "genesis=/app/genesis", "force=true", "hearth=false"]);
    expect(a.positional).toEqual(["found"]);
    expect(a.options).toEqual({ root: "/state", genesis: "/app/genesis" });
    expect(a.flags).toEqual({ "skip-build": true, force: true, hearth: false });
  });
  test("★ a param before a word leaves the word positional ★", () => {
    const a = parseArgs(["vault", "unbind", "rotate=true", "abc"]);
    expect(a.positional).toEqual(["unbind", "abc"]);
    expect(a.flags).toEqual({ rotate: true });
  });
  test("splits at the FIRST `=`; an empty value stays an option; a repeat joins with a space", () => {
    expect(parseArgs(["x", "k=a=b"]).options).toEqual({ k: "a=b" });
    expect(parseArgs(["x", "k="]).options).toEqual({ k: "" });
    expect(parseArgs(["x", "tag=a", "tag=b"]).options).toEqual({ tag: "a b" });
  });
  test("★ a value spelled like a flag rides as a value ★", () => {
    expect(parseArgs(["x", "text=--note"]).options).toEqual({ text: "--note" });
  });
  test("a token after `--` stays positional, a dash flag and a param alike", () => {
    const a = parseArgs(["mcp", "serve", "--", "--root=/y", "k=v"]);
    expect(a.positional).toEqual(["serve", "--root=/y", "k=v"]);
    expect(a.options).toEqual({});
  });
  test("★ each global flag reads as a dash spelling, taking no value; `--no-json` reads false ★", () => {
    for (const name of GLOBAL_FLAGS) expect(parseArgs(["x", `--${name}`]).flags[name], name).toBe(true);
    expect(parseArgs(["x", "--no-json"]).flags).toEqual({ json: false });
    expect(() => parseArgs(["x", "--json=1"])).toThrow(ArgsError);
  });
});

describe("parseArgs: every other dash spelling burned into params", () => {
  test("★ a dash flag refuses by name, naming its param reading and the whole line spelled in params ★", () => {
    expect(() => parseArgs(["rite", "kukulu", "--dry-run"])).toThrow(/--dry-run reads as dry-run=true .*; run: lares rite kukulu dry-run=true$/);
    expect(() => parseArgs(["wiki", "status", "--face", "1"])).toThrow(/--face reads as face=1 .*; run: lares wiki status face=1$/);
    expect(() => parseArgs(["wiki", "status", "--face=1"])).toThrow(/run: lares wiki status face=1$/);
    expect(() => parseArgs(["rite", "keep", "--no-sessions"])).toThrow(/--no-sessions reads as sessions=false/);
  });
  test("★ on a call line a flag that burned into the dials names its dial ★", () => {
    expect(() => parseArgs(["act", "lar:///carriage.record.adds", "--dry-run"])).toThrow(/--dry-run reads as mu=_0/);
    expect(() => parseArgs(["get", "title=x", "--draft"])).toThrow(/--draft reads as draft=true \(a call takes name=value params/);
  });
  test("★ a call line keeps its params positional, a value spelled `--x` included ★", () => {
    const a = parseArgs(["get", "title=--x", "--json"]);
    expect(a.positional).toEqual(["title=--x"]);
    expect(a.options).toEqual({});
    expect(a.flags).toEqual({ json: true });
  });
});

describe("splitCall: the call shape's one token rule", () => {
  test("★ a leading run of words names the verb; every name=value token names a param ★", () => {
    expect(splitCall(["get", "title=lar:///ha.ka.ba/x", "aperture=measure"])).toEqual({ words: ["get"], params: { title: "lar:///ha.ka.ba/x", aperture: "measure" } });
    expect(splitCall(["oracle", "cast", "query=q"])).toEqual({ words: ["oracle", "cast"], params: { query: "q" } });
  });
  test("★ a leading address names the verb ★", () => {
    expect(splitCall(["lar:///engine.record.reads", "title=x"])).toEqual({ words: ["lar:///engine.record.reads"], params: { title: "x" } });
  });
  test("★ a param splits at its FIRST `=`: a title or a filter holding `=` stays a value ★", () => {
    expect(splitCall(["get", "title=a=b"]).params).toEqual({ title: "a=b" });
    expect(splitCall(["get", "filter=[field:x[=y]]"]).params).toEqual({ filter: "[field:x[=y]]" });
    expect(splitCall(["put", "title=T", "text="]).params).toEqual({ title: "T", text: "" });
  });
  test("★ a value that starts like a flag rides whole: `with=--x` ★", () => {
    expect(splitCall(["put", "title=T", "replace=a", "with=--x"]).params).toEqual({ title: "T", replace: "a", with: "--x" });
  });
  test("★ a word after a param refuses by name (ArgsError) ★", () => {
    expect(() => splitCall(["get", "title=x", "stray"])).toThrow(ArgsError);
    expect(() => splitCall(["get", "title=x", "stray"])).toThrow(/"stray" stands after a param/);
  });
  test("★ a repeated param joins its values with a space, in the order written ★", () => {
    expect(splitCall(["put", "title=T", "tag-add=a", "tag-add=[[b c]]", "tag-add=d"]).params).toEqual({ title: "T", "tag-add": "a [[b c]] d" });
    // An empty repeat adds nothing, and a value after an empty one stands alone.
    expect(splitCall(["put", "tag-add=", "tag-add=a", "tag-add="]).params).toEqual({ "tag-add": "a" });
  });
  test("the token rule reads a lowercase name before the `=`; anything else stays a word", () => {
    for (const tok of ["title=x", "max-bytes=4", "a1=b"]) expect(PARAM_TOKEN.test(tok), tok).toBe(true);
    for (const tok of ["Title=x", "=x", "-x=y", "1a=b", "lar:///a=b", "--k=v"]) expect(PARAM_TOKEN.test(tok), tok).toBe(false);
    expect(splitCall(["Title=x"])).toEqual({ words: ["Title=x"], params: {} });
  });
  test("CONTROL: a line with no params is words alone", () => {
    expect(splitCall(["-"])).toEqual({ words: ["-"], params: {} });
    expect(splitCall([])).toEqual({ words: [], params: {} });
  });
});

describe("dispatch: a param the carrier takes nowhere refuses by name, before the handler", () => {
  const quiet = () => ({
    err: vi.spyOn(console, "error").mockImplementation(() => {}),
    log: vi.spyOn(console, "log").mockImplementation(() => {}),
  });

  test("★ the refusal names the nearest taken spelling ★", async () => {
    const { err } = quiet();
    expect(await dispatch(["circle", "add", "n", "petnam=x"])).toBe(2);
    expect(err.mock.calls.map((c) => String(c[0])).join("\n")).toContain("did you mean petname=");
  });
  test("★ a dash flag exits 2 from dispatch, naming its param, never a stack ★", async () => {
    const { err } = quiet();
    expect(await dispatch(["vessel", "stand", "--foreground"])).toBe(2);
    expect(err.mock.calls.map((c) => String(c[0])).join("\n")).toContain("run: lares vessel stand foreground=true");
  });
  test("★ the door's params come from its carriers' #/takes ★", () => {
    expect(doorTakes("sense")).toContain("limit");
    expect(doorTakes("sense")).toContain("k");
    const sense = COMMANDS.find((c) => c.name === "sense")!;
    expect(unknownParams(sense, parseArgs(["sense", "recall", "kw", "limit=1"]))).toEqual([]);
  });
  test("CONTROL: a command's own params and the global flags read", () => {
    const circle = COMMANDS.find((c) => c.name === "circle")!;
    expect(unknownParams(circle, parseArgs(["circle", "add", "n", "to=c", "petname=p", "--json", "--yes"]))).toEqual([]);
    const vessel = COMMANDS.find((c) => c.name === "vessel")!;
    expect(unknownParams(vessel, parseArgs(["vessel", "found", "--skip-build", "root=/state", "genesis=/app/genesis"]))).toEqual([]);
  });
  test("mempalace hands an unwrapped verb to the vendored parser untouched", () => {
    const mp = COMMANDS.find((c) => c.name === "mempalace")!;
    expect(unknownParams(mp, parseArgs(["mempalace", "search", "q", "n-results=3"]))).toEqual([]);
    expect(unknownParams(mp, parseArgs(["mempalace", "status", "n-results=3"])).map((u) => u.name)).toEqual(["n-results"]);
  });
});
