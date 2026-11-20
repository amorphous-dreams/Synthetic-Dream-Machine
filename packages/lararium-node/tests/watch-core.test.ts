/**
 * watch-core — THE DRAIN, LIFTED (face-pools #/lanes W1, W2): one settle seat the CLI's `lares watch` and the vessel share,
 * and the vessel's host over the WORN face's pool (`projections/faces/<pet name>/`).
 *
 *   W1a the drain seat: hints inside one settle window ride ONE wave; a hint mid-wave queues exactly one rerun; `flush`
 *       drains what stands buffered now, never on a timer alone
 *   W1b the host arms OFF the boot path: `armFacePoolWatch` returns before its catch-up resolves, so a boot never waits
 *   W1c the host watches the pool's planes alone: `wiki/ canon/ stage/ personal/ recovery/`; the pool's `.git/`, its `temp/`,
 *       a file at the pool's root and editor litter wake no wave
 *   W2a the wear catch-up: the arm runs the catch-up (the `liveLay` read of the whole pool) once, before the watch reads live
 *   W2b lock and down: the final wave drains what stands buffered, THEN the commit seam runs, naming the close
 *   W2c dead inotify: a backend that echoes no cookie stands in a NAMED state (`inotify-dead`), and no poll loop stands:
 *       no interval ever arms, and the final wave at the seam reads the whole pool once
 *   W2d the commit seam: the pool's git history takes the watched planes as they stand, under a `lar:` subject naming no
 *       face; nothing moved commits nothing; a pool with no history commits nothing, by name
 *   W2e the arm tends the pool's ignore block: a block `lares surface init` wrote before a rule joined re-reads HOUSE_IGNORED,
 *       the operator's lines kept; a tracked file the house now ignores reads by name; a pool init never made stays as it stands
 *   W2f EVERY POOL A TREE: where no history stands at or above a pool root, the house founds one (`ensurePoolTree`) with the
 *       face pool's init (`git init -b main`, the house's exclude block, the local author, signing off, the pool-check hook) and
 *       no remote; a standing repo stays exactly as it stands; a folder resting inside another history founds nothing. The
 *       worn face's arm founds its pool, and the boot's heal (`healPoolTrees`) founds each face root and realm root on disk; a
 *       realm's ONE tree roots at `realms/<pet>/` under the realm's identity, and a wiki folder inside it founds none
 *   W2h ONE TREE PER ENTITY: a wiki folder holding its own tree below a realm root lifts into the realm's tree, every commit kept
 *       reachable (the re-root commit's parent names the wiki's head), its uncommitted edits kept, its old git dir kept inside
 *       the realm's `.git`; a second heal changes nothing
 *   S1  stage/ joins the watched planes (RULED floor 4 (b)), and the wake names every stage edit made on disk since the last
 *       sitting, each title with its pool commit or "uncommitted"
 *   C   control: the house's ignore list already keeps a pool's `.git/` out of every scan
 */
import { describe, test, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { houseIgnored, POOL_EXCLUDE_CLOSE, POOL_EXCLUDE_OPEN, withExcludeBlock } from "../src/bag-paths.js";

type WatchCore = typeof import("../src/watch-core.js");
const WATCH_CORE = "../src/watch-core.js";
let loaded: WatchCore | null = null;
let loadFault: unknown = null;
// Loaded once, its fault held: the control below reads without the module, every other test throws the fault it met.
beforeAll(async () => { try { loaded = await import(/* @vite-ignore */ WATCH_CORE) as WatchCore; } catch (e) { loadFault = e; } });
const wc = new Proxy({} as WatchCore, { get: (_t, k) => { if (loaded === null) throw loadFault; return loaded[k as keyof WatchCore]; } });

let pool: string;
beforeEach(() => { pool = join(mkdtempSync(join(tmpdir(), "lar-pool-")), "Heron"); mkdirSync(pool, { recursive: true }); });
afterEach(() => { rmSync(dirname(pool), { recursive: true, force: true }); vi.restoreAllMocks(); });

const put = (rel: string, text: string): string => { const p = join(pool, ...rel.split("/")); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); return p; };
const tid = (title: string, body = "a body"): string => `title: ${title}\ntype: text/vnd.tiddlywiki\n\n${body}\n`;
/** git in the pool, the hook env stripped (a worktree's GIT_DIR never leaks into a pool's history). */
const git = (...args: string[]): string => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
  const r = spawnSync("git", args, { cwd: pool, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};
const initPool = (): void => { git("init", "-q"); git("config", "user.name", "Heron"); git("config", "user.email", "heron@face.invalid"); git("config", "commit.gpgsign", "false"); };

/** A watcher the test drives: `fire(rel)` raises one change event as `fs.watch` would. */
function fakeWatch() {
  const watchers: Array<EventEmitter & { close(): void; closed: boolean }> = [];
  const watch = ((_dir: string, _opts: unknown, cb: (event: string, filename: string | null) => void) => {
    const w = Object.assign(new EventEmitter(), { closed: false, close() { this.closed = true; } });
    w.on("change", cb);
    watchers.push(w);
    return w;
  }) as unknown as NonNullable<Parameters<WatchCore["armFacePoolWatch"]>[0]["watch"]>;
  return { watch, fire: (rel: string) => { for (const w of watchers) if (!w.closed) w.emit("change", "change", rel); }, watchers };
}

const settle = (ms = 30): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe("C — control: the house's ignore list keeps a pool's .git out of every scan", () => {
  test("houseIgnored names .git/ inside a pool", () => {
    expect(houseIgnored(".git/HEAD")).not.toBeNull();
    expect(houseIgnored("stage/memory/heron.tid")).toBeNull();
  });
});

describe("W1a — the drain seat: one wave per settle, one rerun per busy wave", () => {
  test("hints inside one window ride one wave; flush drains at once", async () => {
    const waves: string[][] = [];
    const seat = wc.drainSeat({ settleMs: 20, wave: async (files) => { waves.push([...files].sort()); } });
    seat.hint("/p/a.tid"); seat.hint("/p/b.tid"); seat.hint("/p/a.tid");
    await settle(60);
    expect(waves).toEqual([["/p/a.tid", "/p/b.tid"]]);
    seat.hint("/p/c.tid");
    await seat.flush();
    expect(waves).toEqual([["/p/a.tid", "/p/b.tid"], ["/p/c.tid"]]);
    seat.close();
  });

  test("a hint landing mid-wave queues exactly one rerun", async () => {
    const waves: string[][] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    const seat = wc.drainSeat({ settleMs: 5, wave: async (files) => { waves.push([...files]); if (waves.length === 1) await gate; } });
    seat.hint("/p/a.tid");
    await settle(20);
    seat.hint("/p/b.tid"); await settle(20);
    seat.hint("/p/c.tid"); await settle(20);
    release();
    await seat.flush();
    expect(waves.length).toBe(2);
    expect(waves[1]!.sort()).toEqual(["/p/b.tid", "/p/c.tid"]);
    seat.close();
  });
});

describe("W1b/W2a — the host arms off the boot path and catches up at wear", () => {
  test("arm returns before the catch-up resolves; the catch-up runs once, before live", async () => {
    let finish: () => void = () => {};
    const caught = new Promise<void>((r) => { finish = r; });
    const order: string[] = [];
    const { watch } = fakeWatch();
    const host = wc.armFacePoolWatch({
      pool, watch, cookie: async () => true, settleMs: 5, log: () => {},
      ports: { catchUp: async () => { order.push("catch-up"); await caught; }, wave: async () => { order.push("wave"); }, commit: async () => ({ committed: false, why: "nothing-moved" }) },
    });
    // The arm handed back at once: the catch-up still runs.
    expect(["arming", "catching-up"]).toContain(host.state());
    finish();
    expect(await host.armed).toBe("live");
    expect(order).toEqual(["catch-up"]);
    await host.down("down");
  });
});

describe("W1c — the host watches the pool's planes alone", () => {
  test("an edit under each watched plane rides a wave; .git, temp, view state, the pool root and litter wake none", async () => {
    const waves: string[] = [];
    const { watch, fire } = fakeWatch();
    const host = wc.armFacePoolWatch({
      pool, watch, cookie: async () => true, settleMs: 5, log: () => {},
      ports: { catchUp: async () => {}, wave: async (files) => { waves.push(...files); }, commit: async () => ({ committed: false, why: "nothing-moved" }) },
    });
    await host.armed;
    for (const rel of ["wiki/daemon/My Notes.tid", "canon/ha.ka.ba/notes/pond.mem", "stage/memory/heron.tid", "personal/elyncia/Aside.tid", "recovery/elyncia/Draft.tid"]) fire(rel);
    for (const rel of [".git/index", "temp/elyncia/x.tid", "loose.tid", "stage/memory/.heron.tid.swp", "wiki/daemon/x.tid~", "wiki/daemon/x.tid.123.tmp", "personal/elyncia/$__StoryList.tid"]) fire(rel);
    await settle(40);
    expect(waves.map((f) => f.slice(pool.length + 1)).sort()).toEqual([
      "canon/ha.ka.ba/notes/pond.mem", "personal/elyncia/Aside.tid", "recovery/elyncia/Draft.tid", "stage/memory/heron.tid", "wiki/daemon/My Notes.tid",
    ]);
    await host.down("down");
  });

  test("WATCHED_PLANES holds stage beside wiki, canon, personal and recovery, and never temp", () => {
    expect([...wc.WATCHED_PLANES].sort()).toEqual(["canon", "personal", "recovery", "stage", "wiki"]);
  });

  test("a real backend: a hand edit under stage/ reaches the wave", async () => {
    const waves: string[] = [];
    const host = wc.armFacePoolWatch({
      pool, settleMs: 20, log: () => {},
      ports: { catchUp: async () => {}, wave: async (files) => { waves.push(...files); }, commit: async () => ({ committed: false, why: "nothing-moved" }) },
    });
    const state = await host.armed;
    if (state === "inotify-dead") return;     // a backend with no inotify names itself; W2c covers that road
    put("stage/memory/heron.tid", tid("memory/heron"));
    for (let i = 0; i < 50 && waves.length === 0; i++) await settle(20);
    expect(waves).toContain(join(pool, "stage", "memory", "heron.tid"));
    await host.down("down");
  });
});

describe("W2b — lock and down: the final wave, then the commit seam", () => {
  test("down drains what stands buffered before the seam runs, and names the close", async () => {
    const order: string[] = [];
    const { watch, fire } = fakeWatch();
    const host = wc.armFacePoolWatch({
      pool, watch, cookie: async () => true, settleMs: 10_000, log: () => {},
      ports: {
        catchUp: async () => {},
        wave: async (files) => { order.push(`wave ${files.map((f) => f.slice(pool.length + 1)).join(",")}`); },
        commit: async (reason) => { order.push(`seam ${reason}`); return { committed: true, sha: "abc" }; },
      },
    });
    await host.armed;
    fire("stage/memory/heron.tid");
    const reading = await host.down("lock");
    expect(order).toEqual(["wave stage/memory/heron.tid", "seam lock"]);
    expect(reading).toEqual({ committed: true, sha: "abc" });
    expect(host.state()).toBe("down");
    // A second down reads the same close, and runs nothing again.
    expect(await host.down("down")).toEqual({ committed: true, sha: "abc" });
    expect(order.length).toBe(2);
  });
});

describe("W2c — dead inotify degrades to a named state, never a poll loop", () => {
  test("no cookie echo: inotify-dead by name, no interval, and the seam's final wave reads the whole pool once", async () => {
    const interval = vi.spyOn(globalThis, "setInterval");
    const lines: string[] = [];
    const order: string[] = [];
    const { watch } = fakeWatch();
    const host = wc.armFacePoolWatch({
      pool, watch, cookie: async () => false, settleMs: 5, log: (l) => lines.push(l),
      ports: { catchUp: async () => { order.push("catch-up"); }, wave: async () => { order.push("wave"); }, commit: async () => { order.push("seam"); return { committed: false, why: "nothing-moved" }; } },
    });
    expect(await host.armed).toBe("inotify-dead");
    expect(lines.some((l) => /inotify-dead/.test(l))).toBe(true);
    await settle(30);
    expect(order).toEqual(["catch-up"]);
    await host.down("down");
    expect(order).toEqual(["catch-up", "catch-up", "seam"]);
    expect(interval).not.toHaveBeenCalled();
  });
});

describe("W2d — the commit seam over the pool's git history", () => {
  test("commits the watched planes under a lar: subject naming no face; nothing moved commits nothing", async () => {
    initPool();
    put("stage/memory/heron.tid", tid("memory/heron"));
    put("wiki/daemon/My Notes.tid", tid("My Notes"));
    put("loose.txt", "not a plane\n");
    const first = await wc.poolCommitSeam(pool, "lock");
    expect(first.committed).toBe(true);
    const subject = git("log", "-1", "--format=%s");
    expect(subject.startsWith("lar:///pool.closes.the-sitting/lock")).toBe(true);
    expect(subject).not.toMatch(/Heron/);
    expect(git("show", "--name-only", "--format=", "HEAD").split("\n").sort()).toEqual(["stage/memory/heron.tid", "wiki/daemon/My Notes.tid"]);
    expect(await wc.poolCommitSeam(pool, "down")).toEqual({ committed: false, why: "nothing-moved" });
  });

  test("a pool with no history commits nothing, by name", async () => {
    put("stage/memory/heron.tid", tid("memory/heron"));
    expect(await wc.poolCommitSeam(pool, "down")).toEqual({ committed: false, why: "no-pool-history" });
  });
});

describe("W2e — the arm tends the pool's ignore block", () => {
  const armOnce = async (lines: string[]): Promise<void> => {
    const host = wc.armFacePoolWatch({
      pool, watch: fakeWatch().watch, cookie: async () => true, settleMs: 5, log: (l) => lines.push(l),
      ports: { catchUp: async () => {}, wave: async () => {}, commit: async () => ({ committed: false, why: "nothing-moved" }) },
    });
    await host.armed;
    await host.down("down");
  };

  test("a block written before a rule joined learns it at the arm; the operator's lines stay; a tracked view-state file reads by name", async () => {
    initPool();
    put("personal/lares/$__StoryList.tid", tid("$:/StoryList", "tracked before the rule"));
    git("add", "-A"); git("commit", "-q", "-m", "an older sitting");
    const exclude = join(pool, ".git", "info", "exclude");
    const older = `my-own-notes/\n${POOL_EXCLUDE_OPEN}\n.vscode/\n${POOL_EXCLUDE_CLOSE}\n`;
    writeFileSync(exclude, older);
    const lines: string[] = [];
    await armOnce(lines);
    expect(readFileSync(exclude, "utf8")).toBe(withExcludeBlock(older));
    expect(readFileSync(exclude, "utf8")).toMatch(/^my-own-notes\/\n/);
    expect(lines.join("\n")).toMatch(/re-reads HOUSE_IGNORED/);
    expect(lines.join("\n")).toMatch(/1 file\(s\) the house ignores stand tracked \(personal\/lares\/\$__StoryList\.tid\)/);
    // Once out of the history, the view state never rides a sitting's close again.
    git("rm", "-q", "--cached", "personal/lares/$__StoryList.tid"); git("commit", "-q", "-m", "out once");
    put("personal/lares/$__StoryList.tid", tid("$:/StoryList", "a later view"));
    put("personal/lares/$__HistoryList.tid", tid("$:/HistoryList"));
    expect(await wc.poolCommitSeam(pool, "down")).toEqual({ committed: false, why: "nothing-moved" });
    const again: string[] = [];
    await armOnce(again);
    expect(readFileSync(exclude, "utf8")).toBe(withExcludeBlock(older));
    expect(again.some((l) => /re-reads HOUSE_IGNORED|stand tracked/.test(l)), "a current block and a clean history log nothing").toBe(false);
  });

  test("a lit face's pool tends itself without a watch: the block re-reads, the operator's lines stay, a tracked file reads by name, a current pool stays silent", () => {
    initPool();
    put("personal/lares/$__StoryList.tid", tid("$:/StoryList", "tracked before the rule"));
    git("add", "-A"); git("commit", "-q", "-m", "an older sitting");
    const exclude = join(pool, ".git", "info", "exclude");
    const older = `my-own-notes/\n${POOL_EXCLUDE_OPEN}\n.vscode/\n${POOL_EXCLUDE_CLOSE}\n`;
    writeFileSync(exclude, older);
    const lines: string[] = [];
    wc.tendLitFacePool(pool, "h1", (l) => lines.push(l));
    expect(readFileSync(exclude, "utf8")).toBe(withExcludeBlock(older));
    expect(lines.join("\n")).toMatch(/h1: the house's ignore block .* re-reads HOUSE_IGNORED/);
    expect(lines.join("\n")).toMatch(/h1: 1 file\(s\) the house ignores stand tracked/);
    git("rm", "-q", "--cached", "personal/lares/$__StoryList.tid"); git("commit", "-q", "-m", "out once");
    const again: string[] = [];
    wc.tendLitFacePool(pool, "h1", (l) => again.push(l));
    expect(again).toEqual([]);
  });

  test("a pool `lares surface init` never made stays as it stands", () => {
    initPool();
    const exclude = join(pool, ".git", "info", "exclude");
    writeFileSync(exclude, "my-own-notes/\n");
    expect(wc.tendPoolExclude(pool)).toEqual({ reading: "unmade", tracked: [] });
    expect(readFileSync(exclude, "utf8")).toBe("my-own-notes/\n");
    rmSync(join(pool, ".git"), { recursive: true });
    expect(wc.tendPoolExclude(pool)).toEqual({ reading: "unmade", tracked: [] });
    expect(existsSync(join(pool, ".git"))).toBe(false);
  });
});

describe("S1 — the wake names every stage edit made on disk since the last sitting", () => {
  test("each title with its pool commit or uncommitted; a wiki edit stays out", async () => {
    initPool();
    put("stage/memory/old.tid", tid("memory/old"));
    await wc.poolCommitSeam(pool, "lock");                                  // the last sitting closes here
    put("stage/memory/heron.tid", tid("memory/heron", "a hand edited this"));
    git("add", "stage/memory/heron.tid"); git("commit", "-q", "-m", "a hand commit");
    const hand = git("rev-parse", "HEAD");
    put("stage/memory/pond.tid", tid("memory/pond"));                       // left uncommitted
    put("wiki/daemon/Other.tid", tid("Other"));
    const edits = wc.stageEditsSinceSitting(pool);
    expect(edits).toEqual([
      { title: "memory/heron", file: "stage/memory/heron.tid", commit: hand },
      { title: "memory/pond", file: "stage/memory/pond.tid", commit: "uncommitted" },
    ]);
    const line = wc.wakeStageLine(edits);
    expect(line).toContain("memory/heron");
    expect(line).toContain(hand.slice(0, 12));
    expect(line).toContain("memory/pond (uncommitted)");
  });

  test("no edit since the last sitting reads as such", async () => {
    initPool();
    put("stage/memory/old.tid", tid("memory/old"));
    await wc.poolCommitSeam(pool, "lock");
    expect(wc.stageEditsSinceSitting(pool)).toEqual([]);
    expect(wc.wakeStageLine([])).toMatch(/no stage edit/);
  });

  test("the arm names the wake before its catch-up", async () => {
    initPool();
    await wc.poolCommitSeam(pool, "lock");
    put("stage/memory/pond.tid", tid("memory/pond"));
    const lines: string[] = [];
    const { watch } = fakeWatch();
    const host = wc.armFacePoolWatch({
      pool, watch, cookie: async () => true, settleMs: 5, log: (l) => lines.push(l),
      ports: { catchUp: async () => { lines.push("catch-up"); }, wave: async () => {}, commit: async () => ({ committed: false, why: "nothing-moved" }) },
    });
    await host.armed;
    const wake = lines.findIndex((l) => l.includes("memory/pond (uncommitted)"));
    expect(wake).toBeGreaterThanOrEqual(0);
    expect(wake).toBeLessThan(lines.indexOf("catch-up"));
    await host.down("down");
  });
});

describe("W2f — every pool a tree: the house founds a pool's history where none stands, idempotently", () => {
  const pt = (): Promise<typeof import("../src/pool-tree.js")> => import(/* @vite-ignore */ "../src/pool-tree.js");
  const bare = (root: string, ...args: string[]): string => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
    return (spawnSync("git", args, { cwd: root, env, encoding: "utf8" }).stdout ?? "").trim();
  };
  const cfg = (root: string, key: string): string => bare(root, "config", "--local", "--get", key);

  test("the worn face's arm founds its pool where none stands, with the face pool's init and no remote", async () => {
    const lines: string[] = [];
    const host = wc.armFacePoolWatch({
      pool, owner: "Heron", watch: fakeWatch().watch, cookie: async () => true, settleMs: 5, log: (l) => lines.push(l),
      ports: { catchUp: async () => {}, wave: async () => {}, commit: async () => ({ committed: false, why: "nothing-moved" }) },
    });
    await host.armed;
    await host.down("down");
    expect(existsSync(join(pool, ".git", "HEAD"))).toBe(true);
    expect(git("symbolic-ref", "HEAD")).toBe("refs/heads/main");
    expect(cfg(pool, "user.name")).toBe("Heron");
    expect(cfg(pool, "user.email")).toBe("heron@face.invalid");
    expect(cfg(pool, "commit.gpgsign")).toBe("false");
    const exclude = readFileSync(join(pool, ".git", "info", "exclude"), "utf8");
    expect(exclude).toContain(POOL_EXCLUDE_OPEN);
    expect(withExcludeBlock(exclude), "the house's block stands current").toBe(exclude);
    expect(readFileSync(join(pool, ".git", "hooks", "pre-commit"), "utf8")).toBe((await pt()).POOL_PRE_COMMIT);
    expect(bare(pool, "remote")).toBe("");
    expect(lines.join("\n")).toMatch(/founds a git tree at/);
  });

  test("a standing repo stays exactly as it stands: no config, hook or history rewritten", async () => {
    initPool();
    git("config", "user.name", "Someone Else");
    put("wiki/daemon/A.tid", tid("A")); git("add", "-A"); git("commit", "-q", "-m", "the operator's own");
    const head = git("rev-parse", "HEAD");
    const r = (await pt()).ensurePoolTree(pool, { face: "Heron" });
    expect(r.reading).toBe("standing");
    expect(cfg(pool, "user.name")).toBe("Someone Else");
    expect(existsSync(join(pool, ".git", "hooks", "pre-commit"))).toBe(false);
    expect(git("rev-parse", "HEAD")).toBe(head);
  });

  test("a second ensure changes nothing; a folder inside another history founds nothing", async () => {
    const { ensurePoolTree } = await pt();
    expect(ensurePoolTree(pool, { face: "Heron" }).reading).toBe("founded");
    expect(ensurePoolTree(pool, { face: "Heron" }).reading).toBe("standing");
    const inner = join(pool, "wiki", "nested");
    mkdirSync(inner, { recursive: true });
    expect(ensurePoolTree(inner, { realm: "nested" }).reading).toBe("inside-another-tree");
    expect(existsSync(join(inner, ".git"))).toBe(false);
  });

  test("a realm root founds under the realm's identity with the realm's exclude lines; a wiki folder inside founds no tree of its own", async () => {
    const { ensurePoolTree } = await pt();
    const { REALM_EXCLUDE_LINES } = await import("../src/bag-paths.js");
    const realm = join(dirname(pool), "realms", "Kahu Hale");
    const wiki = join(realm, "wikis", "kahu");
    mkdirSync(wiki, { recursive: true });
    expect(ensurePoolTree(realm, { realm: "Kahu Hale" }).reading).toBe("founded");
    expect(cfg(realm, "user.name")).toBe("Kahu Hale");
    expect(cfg(realm, "user.email")).toBe("kahu-hale@realm.invalid");
    const exclude = readFileSync(join(realm, ".git", "info", "exclude"), "utf8");
    for (const line of REALM_EXCLUDE_LINES) expect(exclude).toContain(line);
    expect(withExcludeBlock(exclude, REALM_EXCLUDE_LINES), "the house's block with the realm's lines stands current").toBe(exclude);
    expect(ensurePoolTree(wiki, { realm: "Kahu Hale" }).reading).toBe("inside-another-tree");
    expect(existsSync(join(wiki, ".git"))).toBe(false);
  });

  test("the boot's heal founds each face root and each realm root standing on disk, and leaves the standing ones", async () => {
    const { healPoolTrees } = await pt();
    const projections = join(dirname(pool), "projections");
    const heron = join(projections, "faces", "Heron"), egret = join(projections, "faces", "Egret");
    const kahuRealm = join(projections, "realms", "kahu");
    const kahu = join(kahuRealm, "wikis", "kahu");
    for (const d of [heron, egret, kahu]) mkdirSync(d, { recursive: true });
    bare(egret, "init", "-q");
    bare(egret, "config", "user.name", "Egret's Own");
    const lines: string[] = [];
    const healed = healPoolTrees(projections, (l) => lines.push(l));
    expect(healed.map((h) => `${h.root} ${h.reading}`).sort()).toEqual([`${egret} standing`, `${heron} founded`, `${kahuRealm} founded`].sort());
    expect(cfg(heron, "user.email")).toBe("heron@face.invalid");
    expect(cfg(kahuRealm, "user.email")).toBe("kahu@realm.invalid");
    expect(cfg(egret, "user.name")).toBe("Egret's Own");
    expect(existsSync(join(kahu, ".git"))).toBe(false);
    expect(lines.filter((l) => /founds a git tree/.test(l)).length).toBe(2);
    const again: string[] = [];
    expect(healPoolTrees(projections, (l) => again.push(l)).every((h) => h.reading === "standing")).toBe(true);
    expect(again).toEqual([]);
  });
});

describe("W2h — one tree per entity: the heal lifts a wiki folder's own tree into its realm root, history kept", () => {
  const pt = (): Promise<typeof import("../src/pool-tree.js")> => import(/* @vite-ignore */ "../src/pool-tree.js");
  const g = (root: string, ...args: string[]): string => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
    const r = spawnSync("git", ["-c", "core.quotepath=off", ...args], { cwd: root, env, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")} in ${root}: ${r.stderr}`);
    return (r.stdout ?? "").trim();
  };
  /** The live house's shape: `realms/<pet>/wikis/<slug>/` holding its own tree, its commits made, the realm root holding none. */
  const wikiTree = (projections: string, pet: string, slug: string, commits: number): { dir: string; head: string } => {
    const dir = join(projections, "realms", pet, "wikis", slug);
    mkdirSync(dir, { recursive: true });
    g(dir, "init", "-q", "-b", "main");
    g(dir, "config", "user.name", slug); g(dir, "config", "user.email", `${slug}@realm.invalid`); g(dir, "config", "commit.gpgsign", "false");
    for (let i = 1; i <= commits; i++) {
      writeFileSync(join(dir, `Page ${i}.tid`), tid(`Page ${i}`));
      g(dir, "add", "-A"); g(dir, "commit", "-q", "--no-verify", "-m", `the wiki's own commit ${i}`);
    }
    return { dir, head: g(dir, "rev-parse", "HEAD") };
  };

  test("★ the live shape (one wiki tree, one commit): the realm root takes the tree, every commit stays reachable, the files track under wikis/<slug>/ ★", async () => {
    const { healPoolTrees } = await pt();
    const projections = join(dirname(pool), "projections");
    const realm = join(projections, "realms", "kahu");
    const { dir, head } = wikiTree(projections, "kahu", "kahu", 1);
    writeFileSync(join(dir, "Page 1.tid"), tid("Page 1", "an edit no commit holds yet"));
    const lines: string[] = [];
    healPoolTrees(projections, (l) => lines.push(l));
    expect(existsSync(join(realm, ".git", "HEAD"))).toBe(true);
    expect(existsSync(join(dir, ".git")), "no tree stands nested below the realm root").toBe(false);
    expect(g(realm, "merge-base", "--is-ancestor", head, "HEAD"), "the wiki's head stands in the realm's history").toBe("");
    expect(g(realm, "rev-parse", "HEAD^")).toBe(head);
    expect(g(realm, "log", "--format=%s", "HEAD~1")).toBe("the wiki's own commit 1");
    expect(g(realm, "ls-tree", "-r", "--name-only", "HEAD")).toBe("wikis/kahu/Page 1.tid");
    const lift = g(realm, "log", "-1", "--format=%an <%ae>%n%B");
    expect(lift).toContain("kahu <kahu@realm.invalid>");
    expect(lift).toContain("lar:///realm.lifts.a-tree/kahu");
    expect(lift).toContain(head);
    expect(g(realm, "status", "--porcelain", "-z").replace(/\0/g, ""), "the uncommitted edit survives as a change to the lifted path").toBe("M wikis/kahu/Page 1.tid");
    expect(readFileSync(join(dir, "Page 1.tid"), "utf8")).toContain("an edit no commit holds yet");
    expect(lines.join("\n")).toMatch(/lifts the tree at .*wikis\/kahu/);
    const again: string[] = [];
    const before = g(realm, "rev-parse", "HEAD");
    healPoolTrees(projections, (l) => again.push(l));
    expect(g(realm, "rev-parse", "HEAD"), "a second heal changes nothing").toBe(before);
    expect(again).toEqual([]);
  });

  test("two wiki trees in one realm: both lift, each head an ancestor of the realm's, the old git dirs kept inside the realm's .git", async () => {
    const { healPoolTrees } = await pt();
    const projections = join(dirname(pool), "projections");
    const realm = join(projections, "realms", "Garden");
    const notes = wikiTree(projections, "Garden", "notes", 2);
    const works = wikiTree(projections, "Garden", "works", 1);
    healPoolTrees(projections, () => {});
    for (const w of [notes, works]) {
      expect(g(realm, "merge-base", "--is-ancestor", w.head, "HEAD")).toBe("");
      expect(existsSync(join(w.dir, ".git"))).toBe(false);
    }
    expect(existsSync(join(realm, ".git", "lifted", "notes.git", "HEAD"))).toBe(true);
    expect(existsSync(join(realm, ".git", "lifted", "works.git", "HEAD"))).toBe(true);
    expect(g(realm, "ls-tree", "-r", "--name-only", "HEAD").split("\n")).toEqual(["wikis/notes/Page 1.tid", "wikis/notes/Page 2.tid", "wikis/works/Page 1.tid"]);
    expect(g(realm, "status", "--porcelain")).toBe("");
    expect(g(realm, "rev-list", "--count", "HEAD")).toBe("5");
  });
});

describe("W2g — the pool-check hook answers on both sides, and refuses where no check stands", () => {
  const pt = (): Promise<typeof import("../src/pool-tree.js")> => import(/* @vite-ignore */ "../src/pool-tree.js");
  /** Run a hook body in the pool under a PATH that holds `node` (and a fake `lares` where asked), never the host's own. */
  const runHook = (body: string, opts: { lares?: boolean } = {}): { code: number; err: string; said: string } => {
    const bin = join(dirname(pool), "bin");
    mkdirSync(bin, { recursive: true });
    const said = join(dirname(pool), "said.txt");
    writeFileSync(join(bin, "node"), `#!/bin/sh\nexec "${process.execPath}" "$@"\n`, { mode: 0o755 });
    if (opts.lares) writeFileSync(join(bin, "lares"), `#!/bin/sh\necho "host lares $*" > "${said}"\n`, { mode: 0o755 });
    const hook = join(dirname(pool), "pre-commit");
    writeFileSync(hook, body, { mode: 0o755 });
    const r = spawnSync("/bin/sh", [hook], { cwd: pool, env: { PATH: `${bin}:/usr/bin:/bin` }, encoding: "utf8" });
    return { code: r.status ?? -1, err: r.stderr ?? "", said: existsSync(said) ? readFileSync(said, "utf8").trim() : "" };
  };

  test("no `lares` on PATH, the in-image CLI standing: the hook runs the check through it", async () => {
    const { poolPreCommit } = await pt();
    const cli = join(dirname(pool), "app", "lares.mjs");
    mkdirSync(dirname(cli), { recursive: true });
    writeFileSync(cli, `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(join(dirname(pool), "said.txt"))}, "in-image " + process.argv.slice(2).join(" "));\n`);
    const r = runHook(poolPreCommit(cli));
    expect(r.code).toBe(0);
    expect(r.said).toBe("in-image surface check");
  });

  test("`lares` on PATH (the host): the hook runs it", async () => {
    const { POOL_PRE_COMMIT } = await pt();
    const r = runHook(POOL_PRE_COMMIT, { lares: true });
    expect(r.code).toBe(0);
    expect(r.said).toBe("host lares surface check");
  });

  test("neither standing: the hook refuses with one line naming both, never passing silently", async () => {
    const { poolPreCommit } = await pt();
    const r = runHook(poolPreCommit(join(dirname(pool), "nowhere", "lares.mjs")));
    expect(r.code).toBe(1);
    expect(r.err.trim().split("\n")).toHaveLength(1);
    expect(r.err).toMatch(/no `lares` on PATH/);
    expect(r.err).toMatch(/nowhere\/lares\.mjs/);
  });

  test("the heal re-reads an older hook the house wrote in a standing pool; a hook of another hand stays", async () => {
    const { ensurePoolTree, POOL_PRE_COMMIT } = await pt();
    initPool();
    const hook = join(pool, ".git", "hooks", "pre-commit");
    mkdirSync(dirname(hook), { recursive: true });
    writeFileSync(hook, "#!/bin/sh\n# lares surface: the roster check runs before every commit (`lares surface init` wrote this hook)\nexec lares surface check\n", { mode: 0o755 });
    expect(ensurePoolTree(pool, { face: "Heron" })).toEqual({ root: pool, reading: "standing", hook: "refreshed" });
    expect(readFileSync(hook, "utf8")).toBe(POOL_PRE_COMMIT);
    expect(ensurePoolTree(pool, { face: "Heron" })).toEqual({ root: pool, reading: "standing" });
    writeFileSync(hook, "#!/bin/sh\necho mine\n", { mode: 0o755 });
    expect(ensurePoolTree(pool, { face: "Heron" })).toEqual({ root: pool, reading: "standing" });
    expect(readFileSync(hook, "utf8")).toBe("#!/bin/sh\necho mine\n");
  });
});
