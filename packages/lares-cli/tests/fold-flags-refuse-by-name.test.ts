/**
 * fold-flags-refuse-by-name — a folded sub-path refuses by name any flag it does not read.
 *
 * A door's carriers take a union over every sub-verb, so a param a sibling takes could ride a sub-verb that ignores it:
 * `persona raise-sign face=2` signing as persona 0, `vessel request cancel=true dry-run=true` withdrawing for real. The
 * dispatcher narrows the line to the carrier its words route to (`lineTakes`).
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
  test("wiki keep paths refuse sibling flags, and a verb no door table holds meets the door's unknown-verb refusal", async () => {
    for (const argv of [["wiki", "switch", "x", "rotate=true"], ["wiki", "switch", "x", "release=true"], ["wiki", "keep", "x", "release=true"], ["wiki", "unkeep", "x", "bag=true"], ["wiki", "keep", "x", "reason=why"]]) {
      const r = await run([...argv, "json=false"]);
      expect(r.code).toBe(2);
      expect(r.err).toContain("unknown param");
    }
    for (const [door, verb] of [["wiki", "list"], ["wiki", "active"], ["bag", "stats"], ["bag", "list"]] as const) {
      const r = await run([door, verb, "x", "json=false"]);
      expect(r.code).toBe(2);
      expect(r.err).toContain(`lares ${door}: unknown verb "${verb}"`);
    }
    for (const argv of [["wiki", "pin", "x"], ["wiki", "hold", "x"], ["wiki", "release", "x"], ["wiki", "unpin", "x"], ["bag", "pin", "x"], ["bag", "unpin", "x"]]) {
      const r = await run([...argv, "json=false"]);
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
      const r = await run([...argv, "json=false"]);
      expect(r.code).toBe(2);
      expect(r.err).toContain(`unknown param ${flag}= for \`lares ${door}\``);
    }
  });
  test("kahua's retired list spelling answers its door's moved pointer, never an unknown flag", async () => {
    const k = await run(["kahua", "list", "face=1", "json=false"]);
    expect(k.code).not.toBe(0);
    expect(k.err).toContain("moved to `kahua get");
    expect(k.err).not.toContain("unknown param");
  });
  test("★ persona raise-sign refuses face= and every sibling param; as= stays ★", async () => {
    const r = await run(["persona", "raise-sign", "{}", "face=2", "json=false"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("unknown param face= for `lares persona`");
    // CONTROL: as= is read; a sibling sub-verb refuses it.
    const s = await run(["persona", "list", "as=1", "json=false"]);
    expect(s.code).toBe(2);
    expect(s.err).toContain("unknown param as=");
  });

  test("★ vessel request refuses dry-run= beside cancel=, and a sibling refuses cancel= ★", async () => {
    const r = await run(["vessel", "request", "req-1", "cancel=true", "dry-run=true", "json=false"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("unknown param dry-run=");
    const s = await run(["vessel", "read", "cancel=true", "json=false"]);
    expect(s.code).toBe(2);
    expect(s.err).toContain("unknown param cancel=");
  });

  test("★ an address rides the call door: every dash flag beside it refuses before any dispatch, naming the address's help ★", async () => {
    for (const flag of [["--draft"], ["--dry-run"], ["--bag", "b"], ["--from", "b"], ["--change-id", "c"], ["--debounce", "5"]] as const) {
      const r = await run(["lar:///carriage.record.adds", ...flag, "json=false"]);
      expect(r.code, flag.join(" ")).toBe(2);
      expect(r.err).toContain("dash-flag-burned: dash flags burned; params ride as name=value (lares help lar:///carriage.record.adds)");
    }
  });

  test("★ ingest watch=true refuses the one-shot params at the door, and plain ingest refuses watch's own ★", async () => {
    const a = await run(["ingest", "watch=true", "tag-blobs=true", "source=x", "to=y", "json=false"]);
    expect(a.code).toBe(2);
    expect(a.err).toContain("tag-blobs= ride the one-shot ingest alone");
    const b = await run(["ingest", "debounce=5", "source=x", "to=y", "json=false"]);
    expect(b.code).toBe(2);
    expect(b.err).toContain("debounce= sets the watcher's quiet window and rides `watch=true` alone");
  });

  test("★ vessel request never gates on a fresh build: a read and a withdrawal run beside a standing daemon ★", () => {
    expect(needsFreshBuild(parseArgs(["vessel", "request", "req-1", "cancel=true"]))).toBe(false);
    expect(needsFreshBuild(parseArgs(["vessel", "request", "req-1"]))).toBe(false);
    // CONTROL: a founding sub-door still gates.
    expect(needsFreshBuild(parseArgs(["vessel", "found"]))).toBe(true);
  });

  test("★ a call verb folds no flag on this side: every dash spelling refuses `dash-flag-burned`, naming the door's help (the carrier's #/takes binds params in the VM) ★", async () => {
    for (const argv of [
      ["get", "title=lar:///x", "--fields", "text"],
      ["get", "title=lar:///x", "--max-bytes", "4096"],
      ["get", "title=Note", "--after", "1.0123456789abcdef"],
      ["get", "title=lar:///x", "--slot", "#/a"],
      ["get", "title=lar:///x", "--all"],
    ] as const) {
      const r = await run([...argv, "json=false"]);
      expect(r.code, argv.join(" ")).toBe(2);
      expect(r.err).toContain("dash-flag-burned: dash flags burned; params ride as name=value (lares help get)");
    }
  });
});

describe("★ each param binds by the kind its carrier states (kind/switch, or a value) ★", () => {
  test("a switch given a word refuses by name, and its cure rewrites the caller's own line with name=true", async () => {
    const r = await run(["vault", "unbind", "abc", "rotate=abc", "json=false"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("rotate= names a switch for `lares vault`");
    expect(r.err).toContain("run `lares vault unbind abc rotate=true json=false`");
  });
  test("a global param rides as a switch: json= given a word refuses likewise", async () => {
    const r = await run(["vault", "status", "json=yes"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("json= names a switch");
    expect(r.err).toContain("run `lares vault status json=true`");
  });
  test("a value given true refuses by name, and its cure names the value shape the carrier's takes/ states", async () => {
    const r = await run(["vault", "unlock", "face=true", "json=false"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("face= takes a value for `lares vault`, never true alone");
    expect(r.err).toContain("face=<handle-index>");
  });
  test("★ every cli carrier's arg row states its kind: kind/switch, a takes/ shape, or a seat; none rides inferred ★", () => {
    const afford = join(import.meta.dirname, "..", "..", "..", "bags", "lares", "ha.ka.ba", "lares", "afford");
    const unstated: string[] = [];
    for (const file of readdirSync(afford).filter((f) => f.endsWith(".mem"))) {
      const text = readFileSync(join(afford, file), "utf8");
      for (const m of text.matchAll(/<<has entity=`arg` name=`([^`]+)` params=`([^`]*)`>>/g)) {
        if (!/(^|\s)(kind\/switch|takes\/\S+|seat\/\d+)/.test(m[2]!)) unstated.push(`${file} ${m[1]}`);
      }
    }
    expect(unstated, "state kind/switch or a takes/ shape on each row").toEqual([]);
  });
});
