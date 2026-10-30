/**
 * reality tunnel — one door per radius over one declared reality tunnel (lar:///ha.ka.ba/lares/cli/reality-tunnel). Every
 * red plants against a scratch clone or a scratch home; nothing here writes the live tree or a real
 * home.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { EXIT, Ledger, exitOf, read, tend, undo, type External, type Item } from "../src/reality-tunnel/engine.js";
import { windowsProfile } from "../src/reality-tunnel/homes.js";
import { indexReader } from "../src/commands/tunnel-door.js";
import {
  claudeHook, headLine, jsonFloor, tomlHookForeign, jsonForeign, jsonIncludes, jsonSet, namesSeed, seedless, tomlHook, tomlMcpServer,
  tomlTableKey, tomlTableUnset, tomlTopFloor,
} from "../src/reality-tunnel/kinds.js";
import { CARRIER, declared, homeItems, repoItems } from "../src/reality-tunnel/catalog.js";
import { finalHash, judgeLoads, verifyLoads } from "../src/reality-tunnel/verify.js";

const REPO = join(import.meta.dirname, "..", "..", "..");
let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "tunnel-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const MCP = { command: "/usr/bin/python3", args: ["/clone/lares_mcp.py"], env: { PYTHONPATH: "/clone/mp" } };

/** A git clone carrying the carrier, the seed and the hook scripts the home items aim at. */
function clone(): string {
  const root = mkdtempSync(join(dir, "clone-"));
  for (const rel of [CARRIER, declared(REPO).seed]) {
    mkdirSync(join(root, dirname(rel)), { recursive: true });
    writeFileSync(join(root, rel), readFileSync(join(REPO, rel), "utf8"));
  }
  for (const s of declared(REPO).home) {
    const script = s["script"] ?? s["target"];
    if (typeof script === "string") { mkdirSync(join(root, dirname(script)), { recursive: true }); writeFileSync(join(root, script), "#\n"); }
  }
  execFileSync("git", ["init", "-q", root]);
  return root;
}

const ledger = (): Ledger => new Ledger(mkdtempSync(join(dir, "ledger-")));

describe("every kind converges: a second application changes nothing", () => {
  const cases: Array<[string, (c: string | null) => string | null, Array<string | null>]> = [
    ["jsonFloor", jsonFloor("cleanupPeriodDays", 99999), [null, "{}", '{"cleanupPeriodDays": 30, "model": "x"}', '{"cleanupPeriodDays":200000}']],
    ["jsonSet", jsonSet(["mcpServers", "lares"], { command: "p" }), [null, '{"mcpServers":{"other":{}}}']],
    ["jsonIncludes", jsonIncludes("claudeMdExcludes", "**/x.md"), [null, '{"claudeMdExcludes":["a"]}']],
    ["claudeHook", claudeHook("Stop", "hook.sh", { type: "command", command: 'bash "/new/hook.sh"', timeout: 30 }), [null, '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"bash \\"/old/hook.sh\\""}]},{"hooks":[{"type":"command","command":"other"}]}]}}']],
    ["headLine", headLine("@.claude/noosphere-boot", "@.claude/noosphere-boot\n\nbody\n"), [null, "@bags/x/noosphere-boot.mem\n\n- prose\n", "# title\n"]],
    ["seedless", seedless("thin\n"), [null, "-> [noosphere-boot.mem](x)\n\n- keep\n", "---\npaths: ['**']\n---\n\n-> [noosphere-boot.mem](x)\n"]],
    ["tomlTopFloor", tomlTopFloor("project_doc_max_bytes", 65536), [null, "project_doc_max_bytes = 32768\n[mcp_servers.x]\ncommand = \"n\"\n", "[a]\nb = 1\n"]],
    ["tomlTableKey", tomlTableKey("history", "persistence", "save-all"), [null, "[history]\npersistence = \"none\"\nmax_bytes = 10\n", "model = \"x\"\n"]],
    ["tomlTableUnset", tomlTableUnset("history", "max_bytes"), [null, "[history]\nmax_bytes = 10\npersistence = \"save-all\"\n"]],
    ["tomlMcpServer", tomlMcpServer("lares", MCP), [null, "[mcp_servers.lares]\ncommand = \"/old\"\nargs = []\nenv = { }\n\n[other]\na = 1\n"]],
    ["tomlHook", tomlHook("Stop", "hook.sh", "/new/hook.sh", 60), [null, "[[hooks.Stop]]\n\n[[hooks.Stop.hooks]]\ntype = \"command\"\ncommand = \"/old/hook.sh\"\ntimeout = 60\n"]],
  ];
  for (const [name, f, inputs] of cases) {
    it(name, () => { for (const x of inputs) { const once = f(x); expect(f(once)).toBe(once); } });
  }
});

describe("the memory guard never lowers", () => {
  it("raises a low value and keeps a higher one", () => {
    const f = jsonFloor("cleanupPeriodDays", 99999);
    expect(JSON.parse(f('{"cleanupPeriodDays": 30}')!).cleanupPeriodDays).toBe(99999);
    expect(f('{"cleanupPeriodDays": 200000}')).toBe('{"cleanupPeriodDays": 200000}');
  });
});

describe("hooks re-aim at the resolved path rather than standing beside a stale one", () => {
  it("Claude: the stale group yields to the resolved one at its place; a foreign group stays", () => {
    const f = claudeHook("Stop", "hook.sh", { type: "command", command: 'bash "/new/hook.sh"', timeout: 30 });
    const o = JSON.parse(f('{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"bash \\"/old/hook.sh\\""}]},{"hooks":[{"type":"command","command":"other"}]}]}}')!);
    expect(o.hooks.Stop).toEqual([{ hooks: [{ type: "command", command: 'bash "/new/hook.sh"', timeout: 30 }] }, { hooks: [{ type: "command", command: "other" }] }]);
  });
  it("Claude: an operator's own hook and a group's matcher stand beside the house's, untouched", () => {
    const f = claudeHook("SessionStart", "wake.mjs", { type: "command", command: "node", args: ["/new/wake.mjs"], timeout: 15 });
    const mine = { type: "command", command: "echo mine" };
    const o = JSON.parse(f(JSON.stringify({ hooks: { SessionStart: [{ matcher: "startup", hooks: [mine, { type: "command", command: "node", args: ["/old/wake.mjs"] }] }] } }))!);
    expect(o.hooks.SessionStart[0]).toEqual({ matcher: "startup", hooks: [mine, { type: "command", command: "node", args: ["/new/wake.mjs"], timeout: 15 }] });
    expect(f(JSON.stringify(o))).toBe(JSON.stringify(o));
  });
  it("Codex: a block that mixes the house's hook with another reads foreign, never stripped", () => {
    const mixed = "[[hooks.Stop]]\n\n[[hooks.Stop.hooks]]\ntype = \"command\"\ncommand = \"/old/hook.sh\"\ntimeout = 60\n\n[[hooks.Stop.hooks]]\ntype = \"command\"\ncommand = \"mine.sh\"\n";
    expect(tomlHookForeign("Stop", "hook.sh")(mixed)).toMatch(/shares/);
    expect(tomlHookForeign("Stop", "hook.sh")("[[hooks.Stop]]\n\n[[hooks.Stop.hooks]]\ntype = \"command\"\ncommand = \"/old/hook.sh\"\n")).toBeNull();
  });
  it("Codex: one block names the resolved path", () => {
    const t = tomlHook("Stop", "hook.sh", "/new/hook.sh", 60)("[[hooks.Stop]]\n\n[[hooks.Stop.hooks]]\ntype = \"command\"\ncommand = \"/old/hook.sh\"\ntimeout = 60\n")!;
    expect(t).toContain('"/new/hook.sh"');
    expect(t).not.toContain("/old/");
  });
});

describe("pointer lines and prose", () => {
  it("a pointer is a link, an import or a bare path; prose naming the file is not", () => {
    expect(["-> [noosphere-boot.mem](x)", "@.claude/noosphere-boot", "bags/x/noosphere-boot.mem"].every(namesSeed)).toBe(true);
    expect(["- never hand-edit noosphere-boot.mem", "the link `.claude/noosphere-boot`"].some(namesSeed)).toBe(false);
  });
  it("a file whose pointer was all it carried, frontmatter and all, lifts whole", () => {
    expect(seedless()("---\npaths: ['**']\n---\n\n-> [noosphere-boot.mem](x)\n")).toBeNull();
  });
});

describe("the engine", () => {
  const file = (p: string, what: Partial<Item>): Item => ({ id: `t.${p}`, radius: "home", host: "t", path: join(dir, p), what: p, ...what });

  it("tend writes only on difference, records a generation, and a second tend writes nothing", async () => {
    const l = ledger();
    const it1 = file("a.json", { transform: jsonFloor("n", 5), foreign: jsonForeign });
    const r1 = await tend([it1], l);
    expect(r1.wrote).toEqual([join(dir, "a.json")]);
    expect(r1.generation?.gen).toBe(1);
    const r2 = await tend([it1], l);
    expect(r2.wrote).toEqual([]);
    expect(r2.generation).toBeNull();
    expect(exitOf(r2.rows)).toBe(EXIT.aligned);
  });

  it("items on one file compose, and the file writes once", async () => {
    const l = ledger();
    const items = [file("s.json", { transform: jsonFloor("a", 1) }), file("s.json", { transform: jsonFloor("b", 2) })];
    const r = await tend(items, l);
    expect(r.wrote.length).toBe(1);
    expect(JSON.parse(readFileSync(join(dir, "s.json"), "utf8"))).toEqual({ a: 1, b: 2 });
  });

  it("read writes nothing and names drift with exit 1", () => {
    const rows = read([file("absent.json", { transform: jsonFloor("n", 5) })], ledger());
    expect(rows[0]!.state).toBe("drift");
    expect(exitOf(rows)).toBe(EXIT.drift);
    expect(existsSync(join(dir, "absent.json"))).toBe(false);
  });

  it("foreign bytes refuse with exit 3; --force takes them and the ledger keeps them", async () => {
    writeFileSync(join(dir, "bad.json"), "{not json");
    const it1 = file("bad.json", { transform: jsonFloor("n", 5), foreign: jsonForeign });
    const l = ledger();
    const r = await tend([it1], l);
    expect(r.refused.length).toBe(1);
    expect(readFileSync(join(dir, "bad.json"), "utf8")).toBe("{not json");
    expect(exitOf(r.rows)).toBe(EXIT.foreign);
  });

  it("a hand edit after the house wrote reads as touched", async () => {
    const l = ledger();
    const it1 = file("t.json", { transform: jsonFloor("n", 5) });
    await tend([it1], l);
    writeFileSync(join(dir, "t.json"), '{"n": 9, "mine": true}\n');
    const row = read([it1], l)[0]!;
    expect(row.touched).toBe(true);
    expect(row.state).toBe("aligned");
  });

  it("undo restores a generation's prior bytes and records the restore", async () => {
    const l = ledger();
    writeFileSync(join(dir, "u.json"), '{"n": 1}\n');
    await tend([file("u.json", { transform: jsonFloor("n", 5) })], l);
    const g = undo(l).generation!;
    expect(readFileSync(join(dir, "u.json"), "utf8")).toBe('{"n": 1}\n');
    expect(g.act).toBe("undo");
    expect(g.undoes).toBe(1);
    undo(l, g.gen);
    expect(JSON.parse(readFileSync(join(dir, "u.json"), "utf8")).n).toBe(5);
  });

  it("a link item links, a regular file in its place refuses, and undo restores the link's absence", async () => {
    const l = ledger();
    const it1 = file("link", { link: "target" });
    await tend([it1], l);
    expect(readlinkSync(join(dir, "link"))).toBe("target");
    undo(l);
    expect(existsSync(join(dir, "link")) || (() => { try { lstatSync(join(dir, "link")); return true; } catch { return false; } })()).toBe(false);
    writeFileSync(join(dir, "link"), "a file");
    expect(read([it1], l)[0]!.state).toBe("foreign");
  });

  it("an absent host leaves the exit alone; an unreachable piece reads 4", () => {
    expect(exitOf(read([file("x", { absent: "codex stands unset" })], ledger()))).toBe(EXIT.aligned);
    expect(exitOf(read([file("y", { unreachable: "no python" })], ledger()))).toBe(EXIT.unreachable);
  });
});

describe("the repo radius", () => {
  it("CONTROL: a bare clone tends whole, then reads aligned, and a second tend writes nothing", async () => {
    const root = clone();
    const items = repoItems(root);
    const l = ledger();
    const r = await tend(items, l);
    expect(r.refused).toEqual([]);
    expect(exitOf(read(items, l))).toBe(EXIT.aligned);
    expect((await tend(repoItems(root), l)).wrote).toEqual([]);
    expect(readlinkSync(join(root, ".claude/noosphere-boot"))).toBe(`../${declared(REPO).seed}`);
    expect(readFileSync(join(root, "CLAUDE.md"), "utf8").split("\n")[0]).toBe("@.claude/noosphere-boot");
    expect(readFileSync(join(root, ".claude/agents/Explore.md"), "utf8")).toContain("disallowedTools: Agent, Edit, Write");
  });

  it("a scout edited by hand without its marker refuses; a seed edit moves the projection", async () => {
    const root = clone();
    const l = ledger();
    await tend(repoItems(root), l);
    writeFileSync(join(root, declared(REPO).seed), `${readFileSync(join(root, declared(REPO).seed), "utf8")}\nmore\n`);
    expect(read(repoItems(root), l).filter((x) => /scout/.test(x.id)).every((x) => x.state === "drift")).toBe(true);
    writeFileSync(join(root, ".claude/agents/Plan.md"), "my own Plan agent\n");
    expect(read(repoItems(root), l).find((x) => x.id === "claude.scout-plan")!.state).toBe("foreign");
  });

  it("the live tree's checkout holds its reality tunnel, read without a write", () => {
    const rows = read(repoItems(REPO), new Ledger(join(dir, "never-written")));
    expect(rows.filter((r) => r.state !== "aligned")).toEqual([]);
    expect(existsSync(join(dir, "never-written"))).toBe(false);
  });
});

describe("the home radius", () => {
  function homes(): { native: string; windows: string } {
    const native = mkdtempSync(join(dir, "home-"));
    const windows = mkdtempSync(join(dir, "win-"));
    for (const d of [".claude", ".codex", ".copilot", ".local/bin"]) mkdirSync(join(native, d), { recursive: true });
    mkdirSync(join(windows, ".claude"));
    return { native, windows };
  }

  it("every Claude home carries the memory guard, the Windows profile included", async () => {
    const root = clone();
    const h = homes();
    const items = homeItems({ repo: root, homes: h, mcp: MCP, claudeCli: false });
    await tend(items, ledger());
    for (const home of [h.native, h.windows]) {
      expect(JSON.parse(readFileSync(join(home, ".claude/settings.json"), "utf8")).cleanupPeriodDays).toBe(99999);
    }
    expect(existsSync(join(h.windows, ".claude/rules"))).toBe(false);
  });

  it("each harness's retention holds at its maximum: Codex saves all, uncapped; Copilot keeps 1000", async () => {
    const root = clone();
    const h = homes();
    writeFileSync(join(h.native, ".codex/config.toml"), "[history]\npersistence = \"none\"\nmax_bytes = 4096\n");
    writeFileSync(join(h.native, ".copilot/settings.json"), '{"commandHistoryMaxSize": 50, "model": "m"}\n');
    await tend(homeItems({ repo: root, homes: h, mcp: MCP, claudeCli: false }), ledger());
    const toml = readFileSync(join(h.native, ".codex/config.toml"), "utf8");
    expect(toml).toContain('persistence = "save-all"');
    expect(toml).not.toContain("max_bytes");
    expect(JSON.parse(readFileSync(join(h.native, ".copilot/settings.json"), "utf8"))).toEqual({ commandHistoryMaxSize: 1000, model: "m" });
  });

  it("hooks and the bin link aim at the main clone, and a tend converges", async () => {
    const root = clone();
    const h = homes();
    const l = ledger();
    await tend(homeItems({ repo: root, homes: h, mcp: MCP, claudeCli: false }), l);
    const settings = readFileSync(join(h.native, ".claude/settings.json"), "utf8");
    expect(settings).toContain(`${root}/packages/lares-cli/.claude-plugin/hooks/lares-loads-hook.mjs`);
    expect(readlinkSync(join(h.native, ".local/bin/lares"))).toBe(join(root, "packages/lares-cli/bin/lares.mjs"));
    expect((await tend(homeItems({ repo: root, homes: h, mcp: MCP, claudeCli: false }), l)).wrote).toEqual([]);
  });

  it("a host whose home stands absent reads absent; a seat whose MCP pieces stand absent reads unreachable", () => {
    const root = clone();
    const native = mkdtempSync(join(dir, "bare-"));
    const rows = read(homeItems({ repo: root, homes: { native, windows: null }, mcp: null, claudeCli: false }), ledger());
    expect(rows.find((r) => r.id === "codex.mcp-seat")!.state).toBe("absent");
    mkdirSync(join(native, ".copilot"));
    const again = read(homeItems({ repo: root, homes: { native, windows: null }, mcp: null, claudeCli: false }), ledger());
    expect(again.find((r) => r.id === "copilot.mcp-seat")!.state).toBe("unreachable");
  });

  it("the seed rule refuses a same-named file the house never wrote", () => {
    const root = clone();
    symlinkSync(`../${declared(REPO).seed}`, (mkdirSync(join(root, ".claude"), { recursive: true }), join(root, ".claude/noosphere-boot")));
    const h = homes();
    mkdirSync(join(h.native, ".claude/rules"), { recursive: true });
    writeFileSync(join(h.native, ".claude/rules/lares-seed-seat.md"), "the operator's own words\n");
    const rows = read(homeItems({ repo: root, homes: h, mcp: MCP, claudeCli: false }), ledger());
    expect(rows.find((r) => r.id === "claude.seed-rule")!.state).toBe("foreign");
  });
});

describe("verify reads what the host loaded", () => {
  const seed = "/c/bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem";
  it("one load of one real path holds; two loads red; a compact reload never counts", () => {
    expect(judgeLoads([{ session_id: "s", file_path: seed, load_reason: "include", cwd: "/c" }], "home", "/c").ok).toBe(true);
    expect(judgeLoads([{ session_id: "s", file_path: seed, load_reason: "include" }, { session_id: "s", file_path: "/w/bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem", load_reason: "include" }], "home", "/c").ok).toBe(false);
    expect(judgeLoads([{ session_id: "s", file_path: seed, load_reason: "include" }, { session_id: "s", file_path: seed, load_reason: "compact" }], "home", "/c").ok).toBe(true);
  });
  it("no session in the log reads unverified", () => {
    expect(judgeLoads([], "home", "/c").ok).toBe(false);
  });
  it("the repo radius reads the latest session inside the checkout", () => {
    const r = judgeLoads([
      { session_id: "in", file_path: seed, load_reason: "include", cwd: REPO },
      { session_id: "out", file_path: "/x/CLAUDE.md", load_reason: "session_start", cwd: "/elsewhere" },
    ], "repo", REPO);
    expect(r.ok).toBe(true);
  });
  it("the seed's final hash reads off its last block-check line", () => {
    expect(finalHash(readFileSync(join(REPO, declared(REPO).seed), "utf8"))).toMatch(/^[A-Za-z0-9_-]{8}$/);
  });
});

describe("the carrier", () => {
  it("parses whole, and every item names a kind the engine knows", () => {
    const d = declared(REPO);
    expect(d.repo.length).toBeGreaterThan(5);
    expect(d.home.length).toBeGreaterThan(10);
    expect(() => repoItems(REPO, d)).not.toThrow();
    expect(() => homeItems({ repo: REPO, homes: { native: dir, windows: null }, mcp: null, claudeCli: false }, d)).not.toThrow();
  });
});

describe("the brief line", () => {
  it("prints one line with no terminal, the way the wake hook reads it", () => {
    const out = execFileSync("node", [join(REPO, "packages/lares-cli/dist/src/bin/lares.js"), "repo", "read", "--brief"], { encoding: "utf8", cwd: REPO });
    expect(out.trim().split("\n")).toHaveLength(1);
    expect(out).toMatch(/^reality tunnel: /);
  });
});

describe("the cold reader's findings, each a red first", () => {
  const free = { release: async (): Promise<void> => {} };
  const file = (p: string, what: Partial<Item>): Item => ({ id: `t.${p}`, radius: "home", host: "t", path: join(dir, p), what: p, ...what });

  it("tend reads under the lock: a writer that finished while tend waited keeps its change", async () => {
    const p = join(dir, "s.json");
    writeFileSync(p, '{"a": 1}\n');
    const lock = async (path: string) => { writeFileSync(path, '{"a": 1, "theirs": true}\n'); return free; };
    await tend([file("s.json", { transform: jsonFloor("n", 5), foreign: jsonForeign })], ledger(), { lock });
    expect(JSON.parse(readFileSync(p, "utf8"))).toEqual({ a: 1, theirs: true, n: 5 });
  });

  it("a tend that fails midway still records a generation for what it wrote", async () => {
    const l = ledger();
    mkdirSync(join(dir, "adir"));
    const items = [file("ok.json", { transform: jsonFloor("n", 5) }), file("adir", { transform: () => "x" })];
    await expect(tend(items, l)).rejects.toThrow();
    expect(l.generations().at(-1)?.entries.map((e) => e.path)).toEqual([join(dir, "ok.json")]);
  });

  it("undo refuses a target a hand touched after the tend, and --force takes it", async () => {
    const l = ledger();
    const p = join(dir, "u.json");
    writeFileSync(p, '{"n": 1}\n');
    await tend([file("u.json", { transform: jsonFloor("n", 5) })], l);
    writeFileSync(p, '{"n": 9, "mine": true}\n');
    const r = undo(l);
    expect(r.refused).toEqual([p]);
    expect(readFileSync(p, "utf8")).toBe('{"n": 9, "mine": true}\n');
    undo(l, undefined, { force: true });
    expect(readFileSync(p, "utf8")).toBe('{"n": 1}\n');
  });

  it("an external seat records a snapshot, and undo restores it", async () => {
    const l = ledger();
    let seat: string | null = "old";
    const ext: External = {
      observe: () => ({ aligned: seat === "new", detail: String(seat) }),
      apply: () => { seat = "new"; return { ok: true, detail: "" }; },
      snapshot: () => JSON.stringify(seat),
      restore: (s) => { seat = JSON.parse(s) as string | null; return { ok: true, detail: "" }; },
    };
    const it1 = file("seat", { external: ext });
    await tend([it1], l);
    expect(seat).toBe("new");
    undo(l, undefined, { externals: new Map([[it1.id, ext]]) });
    expect(seat).toBe("old");
  });

  it("--force takes bytes that do not parse, and the ledger keeps them", async () => {
    const l = ledger();
    writeFileSync(join(dir, "bad.json"), "{not json");
    await tend([file("bad.json", { transform: jsonFloor("n", 5), foreign: jsonForeign })], l, { force: true });
    expect(JSON.parse(readFileSync(join(dir, "bad.json"), "utf8"))).toEqual({ n: 5 });
    expect(l.generations().at(-1)?.entries[0]?.prior).toEqual({ kind: "file", bytes: "{not json" });
  });

  it("an unreachable piece outranks ordinary drift in the exit", () => {
    expect(exitOf(read([file("d", { transform: () => "x" }), file("u", { unreachable: "no script" })], ledger()))).toBe(EXIT.unreachable);
  });

  it("the Windows profile comes from Windows itself; an unverified guess never stands", () => {
    const guessed = mkdtempSync(join(dir, "Users-"));
    const real = mkdtempSync(join(dir, "real-"));
    const state = mkdtempSync(join(dir, "state-"));
    expect(windowsProfile(guessed, { state, ask: () => real })).toBe(real);
    expect(windowsProfile(guessed, { state: mkdtempSync(join(dir, "s2-")), ask: () => null })).toBeNull();
    expect(windowsProfile(guessed, { state, ask: () => { throw new Error("cached, never asked"); } })).toBe(real);
  });

  it("--staged reads the carrier and the seed the commit carries", async () => {
    const root = clone();
    const l = ledger();
    await tend(repoItems(root), l);
    execFileSync("git", ["-C", root, "add", "-A"]);
    const seedRel = declared(REPO).seed;
    writeFileSync(join(root, seedRel), `${readFileSync(join(root, seedRel), "utf8")}\nunstaged\n`);
    await tend(repoItems(root), l);
    execFileSync("git", ["-C", root, "add", ".claude/agents"]);
    const show = (rel: string): string | null => { try { return execFileSync("git", ["-C", root, "show", `:${rel}`], { encoding: "utf8" }); } catch { return null; } };
    const rows = read(repoItems(root, declared(root, show), show), l, indexReader(root));
    expect(rows.filter((r) => /scout/.test(r.id)).every((r) => r.state === "drift")).toBe(true);
  });

  it("verify fails when a probe's host does not answer", () => {
    const v = verifyLoads({ door: "repo", repo: REPO, home: dir, probe: true, entries: [{ session_id: "s", file_path: join(REPO, declared(REPO).seed), load_reason: "include", cwd: REPO }], probes: () => [{ ok: true, line: "claude ✓" }, { ok: false, line: "codex: does not answer" }] });
    expect(v.ok).toBe(false);
  });
});
