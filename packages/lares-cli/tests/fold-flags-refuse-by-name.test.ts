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
});
