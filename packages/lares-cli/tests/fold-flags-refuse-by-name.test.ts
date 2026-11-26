/**
 * fold-flags-refuse-by-name — a folded sub-path refuses by name any flag it does not read.
 *
 * The door's `accepts` row is wide (a union over every sub-verb), so a flag a sibling reads could ride a sub-verb that ignores
 * it: `persona raise-sign --face 2` signing as persona 0, `vessel request --cancel --dry-run` withdrawing for real. `pathAccepts`
 * narrows the row to the sub-path on the line.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { dispatch } from "../src/bin/lares.js";
import { needsFreshBuild } from "../src/build-freshness.js";
import { parseArgs } from "../src/parse-args.js";

async function run(argv: string[]): Promise<{ code: number; err: string }> {
  const err: string[] = [];
  const lo = vi.spyOn(console, "log").mockImplementation(() => {});
  const le = vi.spyOn(console, "error").mockImplementation((...a) => { err.push(a.map(String).join(" ")); });
  try { return { code: await dispatch(argv), err: err.join("\n") }; }
  finally { lo.mockRestore(); le.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

describe("a folded sub-path refuses the flags it does not read", () => {
  test("wiki keep paths refuse sibling flags and moved doors name their destination", async () => {
    for (const argv of [["wiki", "switch", "x", "--rotate"], ["wiki", "switch", "x", "--release"], ["wiki", "keep", "x", "--release"], ["wiki", "unkeep", "x", "--bag"], ["wiki", "keep", "x", "--reason", "why"]]) {
      const r = await run([...argv, "--no-json"]);
      expect(r.code).toBe(2);
      expect(r.err).toContain("unknown flag");
    }
    for (const argv of [["bag", "stats", "--rotate"]]) {
      const r = await run([...argv, "--no-json"]);
      expect(r.err).toContain("moved to");
    }
    for (const [door, verb, destination] of [["wiki", "list", "wiki status"], ["wiki", "active", "wiki status"], ["bag", "stats", "wiki status"]] as const) {
      const r = await run([door, verb, "x", "--face", "1", "--no-json"]);
      expect(r.code).toBe(2);
      expect(r.err).toContain(destination);
      expect(r.err).not.toContain("unknown flag");
    }
    for (const argv of [["wiki", "pin", "x"], ["wiki", "hold", "x"], ["wiki", "release", "x"], ["wiki", "unpin", "x"], ["bag", "pin", "x"], ["bag", "unpin", "x"]]) {
      const r = await run([...argv, "--no-json"]);
      expect(r.code).toBe(2);
      expect(r.err).not.toContain("moved to");
    }
  });

  test("plane reads refuse sibling mutation flags before dispatch", async () => {
    for (const [argv, flag, door] of [
      [["kahua", "get", "T", "--text", "overwrite"], "--text", "kahua"],
      [["kahua", "get", "T", "--limit", "2"], "--limit", "kahua"],
      [["bag", "show", "book", "--approve"], "--approve", "bag"],
      [["meme", "offer", "show", "a".repeat(64), "--over-fresher"], "--over-fresher", "meme"],
      [["meme", "offer", "show", "a".repeat(64), "--bag", "lares"], "--bag", "meme"],
    ] as const) {
      const r = await run([...argv, "--no-json"]);
      expect(r.code).toBe(2);
      expect(r.err).toContain(`unknown flag ${flag} for \`lares ${door}\``);
    }
  });
  test("retired list spellings answer their moved pointer, never an unknown flag", async () => {
    const k = await run(["kahua", "list", "--face", "1", "--no-json"]);
    expect(k.code).not.toBe(0);
    expect(k.err).toContain("moved to `kahua get");
    expect(k.err).not.toContain("unknown flag");
    const b = await run(["bag", "list", "--dir", "X", "--no-json"]);
    expect(b.code).toBe(2);
    expect(b.err).toContain("moved to `lares bag show");
    expect(b.err).not.toContain("unknown flag");
  });
  test("★ persona raise-sign refuses --face and every sibling flag; --as stays ★", async () => {
    const r = await run(["persona", "raise-sign", "{}", "--face", "2", "--no-json"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("unknown flag --face for `lares persona`");
    // CONTROL: --as is read; a sibling sub-verb refuses it.
    const s = await run(["persona", "list", "--as", "1", "--no-json"]);
    expect(s.code).toBe(2);
    expect(s.err).toContain("unknown flag --as");
  });

  test("★ vessel request refuses --dry-run beside --cancel, and a sibling refuses --cancel ★", async () => {
    const r = await run(["vessel", "request", "req-1", "--cancel", "--dry-run", "--no-json"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("unknown flag --dry-run");
    const s = await run(["vessel", "read", "--cancel", "--no-json"]);
    expect(s.code).toBe(2);
    expect(s.err).toContain("unknown flag --cancel");
  });

  test("★ act --draft refuses the ACTION flags, and an ACTION verb beside --draft ★", async () => {
    for (const flag of [["--dry-run"], ["--bag", "b"], ["--from", "b"], ["--change-id", "c"]]) {
      const r = await run(["act", "--draft", "lar:///x", ...flag, "--no-json"]);
      expect(r.code, flag.join(" ")).toBe(2);
      expect(r.err).toContain("unknown flag");
    }
    const m = await run(["act", "MOVE", "--draft", "lar:///x", "--no-json"]);
    expect(m.code).toBe(2);
    expect(m.err).toContain("ACTION verb");
    const s = await run(["act", "ADD", "--draft", "--no-json"]);
    expect(s.code).toBe(2);
    // CONTROL: an act without --draft refuses --draft's sibling name nowhere it reads it.
    const c = await run(["act", "ADD", "--debounce", "5", "--no-json"]);
    expect(c.code).toBe(2);
    expect(c.err).toContain("unknown flag --debounce");
  });

  test("★ ingest --watch refuses the one-shot flags at the door, and plain ingest refuses --watch's own ★", async () => {
    const a = await run(["ingest", "--watch", "--tag-blobs", "--source", "x", "--to", "y", "--no-json"]);
    expect(a.code).toBe(2);
    expect(a.err).toContain("unknown flag --tag-blobs");
    const b = await run(["ingest", "--debounce", "5", "--source", "x", "--to", "y", "--no-json"]);
    expect(b.code).toBe(2);
    expect(b.err).toContain("unknown flag --debounce");
  });

  test("★ vessel request never gates on a fresh build: a read and a withdrawal run beside a standing daemon ★", () => {
    expect(needsFreshBuild(parseArgs(["vessel", "request", "req-1", "--cancel"]))).toBe(false);
    expect(needsFreshBuild(parseArgs(["vessel", "request", "req-1"]))).toBe(false);
    // CONTROL: a founding sub-door still gates.
    expect(needsFreshBuild(parseArgs(["vessel", "found"]))).toBe(true);
  });

  test("★ tiddler get folds by lens and grain: the meme lens refuses --fields and --max-bytes, the record lens refuses --after, a slot refuses beside --skinny or --all under --meme ★", async () => {
    for (const [argv, flag] of [
      [["tiddler", "get", "lar:///x", "--recipe", "default", "--meme", "--fields", "text"], "--fields"],
      [["tiddler", "get", "lar:///x", "--recipe", "default", "--meme", "--max-bytes", "4096"], "--max-bytes"],
      [["tiddler", "get", "Note", "--recipe", "default", "--after", "1.0123456789abcdef"], "--after"],
      [["tiddler", "get", "lar:///x", "--recipe", "default", "--meme", "--skinny", "--slot", "#/a"], "--slot"],
      [["tiddler", "get", "lar:///x", "--recipe", "default", "--meme", "--all", "--slot", "#/a"], "--slot"],
      [["tiddler", "put", "Note", "--recipe", "default", "--slot", "#/a"], "--slot"],
    ] as const) {
      const r = await run([...argv, "--no-json"]);
      expect(r.code, argv.join(" ")).toBe(2);
      expect(r.err).toContain(`unknown flag ${flag} for \`lares tiddler\``);
    }
  });
});
