/**
 * THE PARSER READS `--key=value`, AND A FLAG NOBODY READS REFUSES BY NAME.
 *
 * Measured before this file: `vessel found --skip-build --root=/state` parsed to flags
 * `{"skip-build":true,"root=/state":true}` and options `{}`; `vessel --root=/state read` parsed to
 * `options {"root=/state":"read"}`, so the subcommand vanished. Each parse below pins one of those, and
 * the CONTROL rows pin that the space form still reads exactly as it did.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { parseArgs, ArgsError } from "../src/parse-args.js";
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
  test("opt()/flag()/unread() track what a reader touched", () => {
    const a = parseArgs(["x", "--a=1", "--b", "--c"]);
    a.opt!("a"); a.flag!("b");
    expect(a.unread!()).toEqual(["c"]);
  });
});

describe("dispatch: an unread flag refuses by name, before the handler", () => {
  const quiet = () => ({
    err: vi.spyOn(console, "error").mockImplementation(() => {}),
    log: vi.spyOn(console, "log").mockImplementation(() => {}),
  });

  test("★ exit 2, naming the flag and the command ★", async () => {
    const { err } = quiet();
    expect(await dispatch(["circle", "--bogus-flag", "x"])).toBe(2);
    const said = err.mock.calls.map((c) => String(c[0])).join("\n");
    expect(said).toContain("--bogus-flag");
    expect(said).toContain("lares circle");
  });
  test("★ the refusal also reads the `=` spelling, and names the nearest accepted one ★", async () => {
    const { err } = quiet();
    expect(await dispatch(["circle", "--petnam=x"])).toBe(2);
    expect(err.mock.calls.map((c) => String(c[0])).join("\n")).toContain("did you mean --petname");
  });
  test("★ `vessel read sensorium` refuses by name ★", async () => {
    const { err } = quiet();
    expect(await dispatch(["vessel", "read", "sensorium"])).toBe(2);
    expect(err.mock.calls.map((c) => String(c[0])).join("\n")).toContain("sensorium");
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
