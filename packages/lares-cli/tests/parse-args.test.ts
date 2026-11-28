/**
 * THE PARSER READS `--key=value`, AND A FLAG NOBODY READS REFUSES BY NAME.
 *
 * Measured before this file: `vessel found --skip-build --root=/state` parsed to flags
 * `{"skip-build":true,"root=/state":true}` and options `{}`; `vessel --root=/state read` parsed to
 * `options {"root=/state":"read"}`, so the subcommand vanished. Each parse below pins one of those, and
 * the CONTROL rows pin that the space form still reads exactly as it did.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseArgs, splitCall, ArgsError, BOOLEAN_FLAGS, PARAM_TOKEN, VALUE_FLAGS, VALUE_OR_FLAG } from "../src/parse-args.js";
import { dispatch, unknownFlags, COMMANDS } from "../src/bin/lares.js";

afterEach(() => vi.restoreAllMocks());

describe("parseArgs: --key=value", () => {
  test("★ `--root=/state` is an option, not a flag named `root=/state` ★", () => {
    const a = parseArgs(["vessel", "found", "--skip-build", "--root=/state", "--genesis=/app/genesis"]);
    expect(a.options).toEqual({ root: "/state", genesis: "/app/genesis" });
    expect(a.flags).toEqual({ "skip-build": true });
  });
  test("★ `vessel --root=/state read` keeps its subcommand ★", () => {
    const a = parseArgs(["vessel", "--root=/state", "read"]);
    expect(a.positional).toEqual(["read"]);
    expect(a.options).toEqual({ root: "/state" });
  });
  test("splits at the FIRST `=`; an empty value stays an option", () => {
    expect(parseArgs(["x", "--k=a=b"]).options).toEqual({ k: "a=b" });
    expect(parseArgs(["x", "--k="]).options).toEqual({ k: "" });
  });
  test("`--no-key=…` and `--=v` refuse", () => {
    expect(() => parseArgs(["x", "--no-json=1"])).toThrow(ArgsError);
    expect(() => parseArgs(["x", "--=v"])).toThrow(ArgsError);
  });
  test("a token after `--` stays positional", () => {
    const a = parseArgs(["x", "--", "--root=/y"]);
    expect(a.positional).toEqual(["--root=/y"]);
    expect(a.options).toEqual({});
  });
  test("CONTROL: the space form reads as before", () => {
    const a = parseArgs(["vessel", "found", "--root", "/state", "--force", "--no-json"]);
    expect(a.options).toEqual({ root: "/state" });
    expect(a.flags).toEqual({ force: true, json: false });
  });
});

describe("parseArgs: a boolean flag takes no value, in every position", () => {
  test("★ `--rotate <id>` keeps `<id>` positional; `<id> --rotate` reads the same ★", () => {
    for (const argv of [["vault", "unbind", "--rotate", "abc"], ["vault", "unbind", "abc", "--rotate"]]) {
      const a = parseArgs(argv);
      expect(a.positional).toEqual(["unbind", "abc"]);
      expect(a.flags).toEqual({ rotate: true });
      expect(a.options).toEqual({});
    }
  });
  test("★ every declared boolean flag placed before a positional leaves the positional alone ★", () => {
    for (const name of BOOLEAN_FLAGS) {
      const a = parseArgs(["x", `--${name}`, "pos"]);
      expect(a.positional, `--${name} swallowed the positional`).toEqual(["pos"]);
      expect(a.flags[name], `--${name}`).toBe(true);
      expect(a.options[name], `--${name}`).toBeUndefined();
    }
  });
  test("★ every declared boolean flag refuses `=value` by name ★", () => {
    for (const name of BOOLEAN_FLAGS) expect(() => parseArgs(["x", `--${name}=anything`]), name).toThrow(/takes no value/);
  });
  test("CONTROL: a valued option still binds the next token", () => {
    const a = parseArgs(["x", "--root", "/r", "pos"]);
    expect(a.options).toEqual({ root: "/r" });
    expect(a.positional).toEqual(["pos"]);
  });
  test("★ a value flag takes the next token whatever it starts with: front matter binds as the body ★", () => {
    const body = "---\nfront: matter\n---\nbody";
    expect(parseArgs(["kahua", "stage", "T", "--text", body]).options).toEqual({ text: body });
    expect(parseArgs(["kahua", "stage", "T", "--text", "--literal"]).options).toEqual({ text: "--literal" });
    expect(parseArgs(["kahua", "stage", "T", `--text=${body}`]).options).toEqual({ text: body });
    expect(parseArgs(["kahua", "stage", "T", "--text", body]).positional).toEqual(["stage", "T"]);
  });
  test("CONTROL: any other valued name still peeks, so `--key --other` leaves the first bare and an unknown flag stays a flag", () => {
    const a = parseArgs(["x", "--root", "--mystery"]);
    expect(a.flags).toEqual({ root: true, mystery: true });
    expect(a.positional).toEqual([]);
  });
  test("the declaration cannot drift from the handlers: flag reads are declared, option reads are not", () => {
    const files: string[] = [];
    const walk = (d: string): void => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".ts")) files.push(p);
      }
    };
    walk(join(import.meta.dirname, "..", "src"));
    const flagReads = new Set<string>(); const optionReads = new Set<string>();
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(/\bflags\["([a-z0-9-]+)"\]/g)) flagReads.add(m[1]!);
      for (const m of text.matchAll(/\boptions\["([a-z0-9-]+)"\]/g)) optionReads.add(m[1]!);
    }
    expect([...flagReads].filter((n) => !BOOLEAN_FLAGS.has(n) && !VALUE_OR_FLAG.has(n) && !["bag", "release"].includes(n)), "read as a flag, never declared").toEqual([]);
    expect([...BOOLEAN_FLAGS].filter((n) => optionReads.has(n)), "declared boolean, read as an option").toEqual([]);
    expect([...VALUE_FLAGS].filter((n) => !optionReads.has(n) || flagReads.has(n) || BOOLEAN_FLAGS.has(n) || VALUE_OR_FLAG.has(n)), "value flag read other than as an option").toEqual([]);
    expect([...VALUE_OR_FLAG].filter((n) => !optionReads.has(n) || !flagReads.has(n)), "listed as dual, read one way only").toEqual([]);
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

describe("dispatch: an unread flag refuses by name, before the handler", () => {
  const quiet = () => ({
    err: vi.spyOn(console, "error").mockImplementation(() => {}),
    log: vi.spyOn(console, "log").mockImplementation(() => {}),
  });

  test("★ the refusal also reads the `=` spelling, and names the nearest accepted one ★", async () => {
    const { err } = quiet();
    expect(await dispatch(["circle", "--petnam=x"])).toBe(2);
    expect(err.mock.calls.map((c) => String(c[0])).join("\n")).toContain("did you mean --petname");
  });
  test("★ `sense recall kw --limit 1` still reads: --limit is the operator-kept second name for --k ★", () => {
    const sense = COMMANDS.find((c) => c.name === "sense")!;
    expect(sense.accepts).toContain("limit");
    expect(sense.accepts).toContain("k");
    expect(unknownFlags(sense, parseArgs(["sense", "recall", "kw", "--limit", "1"]))).toEqual([]);
  });
  test("a malformed `--no-x=1` exits 2 from dispatch, not a stack", async () => {
    quiet();
    expect(await dispatch(["vessel", "--no-json=1"])).toBe(2);
  });
  test("CONTROL: a command's own flags and the global ones read", () => {
    const circle = COMMANDS.find((c) => c.name === "circle")!;
    expect(unknownFlags(circle, parseArgs(["circle", "add", "n", "--to", "c", "--petname=p", "--json", "--yes"]))).toEqual([]);
    const vessel = COMMANDS.find((c) => c.name === "vessel")!;
    expect(unknownFlags(vessel, parseArgs(["vessel", "found", "--skip-build", "--root=/state", "--genesis=/app/genesis"]))).toEqual([]);
  });
  test("mempalace hands an unwrapped verb to the vendored parser untouched", () => {
    const mp = COMMANDS.find((c) => c.name === "mempalace")!;
    expect(unknownFlags(mp, parseArgs(["mempalace", "search", "q", "--n-results", "3"]))).toEqual([]);
    expect(unknownFlags(mp, parseArgs(["mempalace", "status", "--n-results", "3"])).map((u) => u.name)).toEqual(["n-results"]);
  });
});
