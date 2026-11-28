/**
 * fold-flags-refuse-by-name — a folded sub-path refuses by name any flag it does not read.
 *
 * A door's carriers take a union over every sub-verb, so a param a sibling takes could ride a sub-verb that ignores it:
 * `persona raise-sign face=2` signing as persona 0, `vessel request cancel=true dry-run=true` withdrawing for real. The
 * dispatcher narrows the line to the carrier its words route to (`lineTakes`).
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
    for (const argv of [["wiki", "switch", "x", "rotate=true"], ["wiki", "switch", "x", "release=true"], ["wiki", "keep", "x", "release=true"], ["wiki", "unkeep", "x", "bag=true"], ["wiki", "keep", "x", "reason=why"]]) {
      const r = await run([...argv, "--no-json"]);
      expect(r.code).toBe(2);
      expect(r.err).toContain("unknown param");
    }
    for (const argv of [["bag", "stats", "rotate=true"]]) {
      const r = await run([...argv, "--no-json"]);
      expect(r.err).toContain("moved to");
    }
    for (const [door, verb, destination] of [["wiki", "list", "wiki status"], ["wiki", "active", "wiki status"], ["bag", "stats", "wiki status"]] as const) {
      const r = await run([door, verb, "x", "face=1", "--no-json"]);
      expect(r.code).toBe(2);
      expect(r.err).toContain(destination);
      expect(r.err).not.toContain("unknown param");
    }
    for (const argv of [["wiki", "pin", "x"], ["wiki", "hold", "x"], ["wiki", "release", "x"], ["wiki", "unpin", "x"], ["bag", "pin", "x"], ["bag", "unpin", "x"]]) {
      const r = await run([...argv, "--no-json"]);
      expect(r.code).toBe(2);
      expect(r.err).not.toContain("moved to");
    }
  });

  test("plane reads refuse sibling mutation flags before dispatch", async () => {
    for (const [argv, flag, door] of [
      [["kahua", "get", "T", "text=overwrite"], "text", "kahua"],
      [["bag", "show", "book", "approve=true"], "approve", "bag"],
      [["meme", "offer", "show", "a".repeat(64), "over-fresher=true"], "over-fresher", "meme"],
    ] as const) {
      const r = await run([...argv, "--no-json"]);
      expect(r.code).toBe(2);
      expect(r.err).toContain(`unknown param ${flag}= for \`lares ${door}\``);
    }
  });
  test("retired list spellings answer their moved pointer, never an unknown flag", async () => {
    const k = await run(["kahua", "list", "face=1", "--no-json"]);
    expect(k.code).not.toBe(0);
    expect(k.err).toContain("moved to `kahua get");
    expect(k.err).not.toContain("unknown param");
    const b = await run(["bag", "list", "dir=X", "--no-json"]);
    expect(b.code).toBe(2);
    expect(b.err).toContain("moved to `lares bag show");
    expect(b.err).not.toContain("unknown param");
  });
  test("★ persona raise-sign refuses --face and every sibling flag; --as stays ★", async () => {
    const r = await run(["persona", "raise-sign", "{}", "face=2", "--no-json"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("unknown param face= for `lares persona`");
    // CONTROL: --as is read; a sibling sub-verb refuses it.
    const s = await run(["persona", "list", "as=1", "--no-json"]);
    expect(s.code).toBe(2);
    expect(s.err).toContain("unknown param as=");
  });

  test("★ vessel request refuses --dry-run beside --cancel, and a sibling refuses --cancel ★", async () => {
    const r = await run(["vessel", "request", "req-1", "cancel=true", "dry-run=true", "--no-json"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("unknown param dry-run=");
    const s = await run(["vessel", "read", "cancel=true", "--no-json"]);
    expect(s.code).toBe(2);
    expect(s.err).toContain("unknown param cancel=");
  });

  test("★ act rides the call door: every flag beside it refuses by name before any dispatch, naming its param spelling ★", async () => {
    for (const [flag, reading] of [[["--draft"], "draft=true"], [["--dry-run"], "mu=_0"], [["--bag", "b"], "bag=b"], [["--from", "b"], "from=b"], [["--change-id", "c"], "change-id=c"], [["--debounce", "5"], "debounce=5"]] as const) {
      const r = await run(["act", "lar:///carriage.record.adds", ...flag, "--no-json"]);
      expect(r.code, flag.join(" ")).toBe(2);
      // A flag the keyword head burned into a dial names the dial it reads as (`--dry-run` reads mu=_0); any other names its param.
      expect(r.err).toContain(`dash-flag-burned: ${flag[0]} reads as ${reading} (a call takes name=value params`);
    }
  });

  test("★ ingest --watch refuses the one-shot flags at the door, and plain ingest refuses --watch's own ★", async () => {
    const a = await run(["ingest", "watch=true", "tag-blobs=true", "source=x", "to=y", "--no-json"]);
    expect(a.code).toBe(2);
    expect(a.err).toContain("tag-blobs= ride the one-shot ingest alone");
    const b = await run(["ingest", "debounce=5", "source=x", "to=y", "--no-json"]);
    expect(b.code).toBe(2);
    expect(b.err).toContain("debounce= sets the watcher's quiet window and rides `watch=true` alone");
  });

  test("★ vessel request never gates on a fresh build: a read and a withdrawal run beside a standing daemon ★", () => {
    expect(needsFreshBuild(parseArgs(["vessel", "request", "req-1", "cancel=true"]))).toBe(false);
    expect(needsFreshBuild(parseArgs(["vessel", "request", "req-1"]))).toBe(false);
    // CONTROL: a founding sub-door still gates.
    expect(needsFreshBuild(parseArgs(["vessel", "found"]))).toBe(true);
  });

  test("★ a call verb folds no flag on this side: every dash spelling refuses by name, naming its param (the carrier's #/takes binds params in the VM) ★", async () => {
    for (const [argv, reading] of [
      [["get", "title=lar:///x", "--fields", "text"], "--fields reads as fields=text"],
      [["get", "title=lar:///x", "--max-bytes", "4096"], "--max-bytes reads as max-bytes=4096"],
      [["get", "title=Note", "--after", "1.0123456789abcdef"], "--after reads as after=1.0123456789abcdef"],
      [["get", "title=lar:///x", "--slot", "#/a"], "--slot reads as slot=#/a"],
      [["get", "title=lar:///x", "--all"], "--all reads as aperture=arc"],
    ] as const) {
      const r = await run([...argv, "--no-json"]);
      expect(r.code, argv.join(" ")).toBe(2);
      expect(r.err).toContain(`dash-flag-burned: ${reading}`);
    }
  });
});
