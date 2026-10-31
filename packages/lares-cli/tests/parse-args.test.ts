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
import { parseArgs, ArgsError, BOOLEAN_FLAGS, VALUE_OR_FLAG } from "../src/parse-args.js";
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
    expect([...flagReads].filter((n) => !BOOLEAN_FLAGS.has(n) && !VALUE_OR_FLAG.has(n)), "read as a flag, never declared").toEqual([]);
    expect([...BOOLEAN_FLAGS].filter((n) => optionReads.has(n)), "declared boolean, read as an option").toEqual([]);
    expect([...VALUE_OR_FLAG].filter((n) => !optionReads.has(n) || !flagReads.has(n)), "listed as dual, read one way only").toEqual([]);
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
