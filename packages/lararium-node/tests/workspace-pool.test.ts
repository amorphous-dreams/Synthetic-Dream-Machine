/**
 * workspace-pool — A NAMED WORKSPACE SERVES AS A POOL (face-pools; cabal-realm#/the-workbench). A shared wiki whose share row
 * names a workspace (`lares wiki share <wiki> --workspace <name>`, bound at `<root>/workspaces/<name>`) projects its workbench
 * there, one disk copy whichever face wears; the watch core, the unattended flow-back and the commit seam serve that copy as
 * they serve the worn face's own pool.
 *
 *   WP1 the workspace stands as a git working tree: `.git` at its top (0700), the house's one ignore list in
 *       `.git/info/exclude`, a local author that names no face, signing off; a second stand changes nothing; a workspace that
 *       rests inside another history (the checkout) founds no nested repository
 *   WP2 the vessel's seat over a workspace arms off the boot path (founding the tree there), watches the whole workspace
 *       (its `.git/`, `temp/`, `recovery/` and litter wake no wave), and downs at lock with the final wave, then a commit
 *       whose subject and author name no face
 *   WP3 the workspace's ports land a clean edit as an UNATTENDED INGEST wave in the wiki's working layer, run IN that wiki's
 *       island, under the worn face's actor; a stand-off goes to that wiki's shore
 *   WP4 the witness on a scratch house: a user wiki bound to a workspace (as `notes` would be) flows a disk edit back by
 *       itself and commits at lock
 *   WP5 control: a wiki with no workspace binds none, keeps projecting to `wikis/<slug>/`, and stands unwatched
 *   WP6 the vessel arms one seat per bound workspace in its after-live step, unawaited, under the worn face's actor, and
 *       downs each at lock, wear and shutdown
 */
import { describe, test, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { carrierHash, VERB_RESULT_KEY, wikiSlotUri } from "@lararium/mesh";
import { resolveDiskMirrors } from "../../lararium-mesh/src/vessel-island-pool-core.js";
import { SyncedTree, syncedTreeKey } from "../src/synced-tree.js";
import { workspaceRootsOf } from "../src/bag-paths.js";

type WatchCore = typeof import("../src/watch-core.js");
type IngestScan = typeof import("../src/ingest-scan.js");
let wcLoaded: WatchCore | null = null, isLoaded: IngestScan | null = null;
beforeAll(async () => {
  wcLoaded = await import(/* @vite-ignore */ "../src/watch-core.js") as WatchCore;
  isLoaded = await import(/* @vite-ignore */ "../src/ingest-scan.js") as IngestScan;
});
const wc = new Proxy({} as WatchCore, { get: (_t, k) => wcLoaded![k as keyof WatchCore] });
const is = new Proxy({} as IngestScan, { get: (_t, k) => isLoaded![k as keyof IngestScan] });

const NOTES_WORKING = wikiSlotUri("notes", "working");

let house: string;
let ws: string;
let tree: SyncedTree;
beforeEach(() => {
  house = mkdtempSync(join(tmpdir(), "lar-workspace-pool-"));
  ws = join(house, "workspaces", "notes");
  mkdirSync(ws, { recursive: true });
  mkdirSync(join(house, "hearth"), { recursive: true });
  tree = new SyncedTree(join(house, "tree"));
});
afterEach(() => { rmSync(house, { recursive: true, force: true }); });

const put = (rel: string, text: string): string => { const p = join(ws, ...rel.split("/")); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); return p; };
const tid = (title: string, body = "a body"): string => `title: ${title}\ntype: text/vnd.tiddlywiki\n\n${body}\n`;
const gitIn = (cwd: string, ...args: string[]): { code: number; out: string } => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
  const r = spawnSync("git", args, { cwd, env, encoding: "utf8" });
  return { code: r.status ?? 1, out: (r.stdout ?? "").trim() };
};
const git = (...args: string[]): string => gitIn(ws, ...args).out;
const agreed = (bag: string, uri: string, file: string, oldText: string): void => { const h = carrierHash(oldText); tree.set(syncedTreeKey(bag, uri), file, h, h); };

type Opts = Parameters<IngestScan["settleIngest"]>[0];
function island(decide: (uri: string) => string = () => "ingest") {
  const waves: Opts[] = [];
  const submit = async (o: Opts) => {
    waves.push(o);
    return {
      status: "done" as const, requestId: `r${waves.length}`,
      results: { [VERB_RESULT_KEY]: { ok: true, output: { carriers: o.candidates.map((c) => ({ uri: c.uri, decision: decide(c.uri), ...(decide(c.uri) === "ingest" ? { canonicalHash: c.diskHash } : {}) })) } } },
    };
  };
  return { waves, submit };
}
function shore() {
  const looks: Array<readonly string[] | undefined> = [];
  return { looks, sense: async (uris?: readonly string[]) => { looks.push(uris === undefined ? undefined : [...uris].sort()); return {}; } };
}
function fakeWatch() {
  const watchers: Array<EventEmitter & { close(): void; closed: boolean }> = [];
  const watch = ((_dir: string, _opts: unknown, cb: (event: string, filename: string | null) => void) => {
    const w = Object.assign(new EventEmitter(), { closed: false, close() { this.closed = true; } });
    w.on("change", cb);
    watchers.push(w);
    return w;
  }) as unknown as NonNullable<Parameters<WatchCore["armFacePoolWatch"]>[0]["watch"]>;
  return { watch, fire: (rel: string) => { for (const w of watchers) if (!w.closed) w.emit("change", "change", rel); } };
}
const settle = (ms = 30): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe("WP1 — the workspace stands as a git working tree", () => {
  test("0700 .git, the house's ignore list, an author naming no face, signing off; a second stand changes nothing", () => {
    const first = wc.standWorkspaceTree(ws, "notes");
    expect(first.stood).toBe("founded");
    expect(statSync(join(ws, ".git")).mode & 0o777).toBe(0o700);
    const exclude = readFileSync(join(ws, ".git", "info", "exclude"), "utf8");
    for (const line of ["temp/", ".shore/", ".vscode/"]) expect(exclude.split("\n")).toContain(line);
    expect(git("config", "--local", "user.email")).toBe("notes@workspace.invalid");
    expect(git("config", "--local", "user.name")).not.toMatch(/face/i);
    expect(git("config", "--local", "commit.gpgsign")).toBe("false");
    const again = wc.standWorkspaceTree(ws, "notes");
    expect(again).toEqual({ stood: "already", changed: [] });
  });

  test("a workspace inside another history (the checkout) founds no nested repository", () => {
    const outer = join(house, "checkout");
    mkdirSync(join(outer, "wikis", "notes"), { recursive: true });
    expect(gitIn(outer, "init", "-q").code).toBe(0);
    const inner = join(outer, "wikis", "notes");
    expect(wc.standWorkspaceTree(inner, "notes").stood).toBe("inside-another-history");
    expect(() => statSync(join(inner, ".git"))).toThrow();
  });
});

describe("WP2 — the seat over a workspace: off the boot path, the whole tree, down at lock", () => {
  test("arms at once and founds the tree off the boot path; the whole workspace wakes waves, its tooling none", async () => {
    const waves: string[] = [];
    const { watch, fire } = fakeWatch();
    const seat = wc.armWorkspaceWatch({
      workspace: ws, name: "notes", watch, cookie: async () => true, settleMs: 5, log: () => {},
      ports: { catchUp: async () => {}, wave: async (files) => { waves.push(...files); } },
    });
    expect(["arming", "catching-up"]).toContain(seat.state());
    expect(await seat.armed).toBe("live");
    expect(statSync(join(ws, ".git")).isDirectory()).toBe(true);
    for (const rel of ["My Notes.tid", "ha.ka.ba/notes/pond.mem", "journal/2026-11-18.tid"]) fire(rel);
    for (const rel of [".git/index", "temp/x.tid", "recovery/Draft.tid", ".My Notes.tid.swp", "x.tid~", "x.tid.123.tmp", ".shore/x.tid"]) fire(rel);
    await settle(40);
    expect(waves.map((f) => f.slice(ws.length + 1)).sort()).toEqual(["My Notes.tid", "ha.ka.ba/notes/pond.mem", "journal/2026-11-18.tid"]);
    await seat.down("down");
  });

  test("lock: the final wave, then a commit whose subject and author name no face", async () => {
    const order: string[] = [];
    const { watch, fire } = fakeWatch();
    const seat = wc.armWorkspaceWatch({
      workspace: ws, name: "notes", watch, cookie: async () => true, settleMs: 10_000, log: () => {},
      ports: { catchUp: async () => {}, wave: async (files) => { order.push(`wave ${files.map((f) => f.slice(ws.length + 1)).join(",")}`); } },
    });
    await seat.armed;
    put("My Notes.tid", tid("My Notes"));
    put("temp/scratch.tid", tid("scratch"));
    fire("My Notes.tid");
    const reading = await seat.down("lock");
    expect(order).toEqual(["wave My Notes.tid"]);
    expect(reading).toEqual({ committed: true, sha: expect.any(String) });
    const subject = git("log", "-1", "--format=%s");
    expect(subject.startsWith("lar:///workspace.closes.the-sitting/lock")).toBe(true);
    expect(git("log", "-1", "--format=%ae")).toBe("notes@workspace.invalid");
    expect(git("show", "--name-only", "--format=", "HEAD").split("\n")).toEqual(["My Notes.tid"]);
    expect(await wc.workspaceCommitSeam(ws, "down")).toEqual({ committed: false, why: "nothing-moved" });
  });

  test("a workspace inside another history commits nothing there, by name", async () => {
    const outer = join(house, "checkout");
    const inner = join(outer, "wikis", "notes");
    mkdirSync(inner, { recursive: true });
    gitIn(outer, "init", "-q");
    writeFileSync(join(inner, "My Notes.tid"), tid("My Notes"));
    expect(await wc.workspaceCommitSeam(inner, "lock")).toEqual({ committed: false, why: "no-pool-history" });
  });
});

describe("WP3 — the workspace's ports: an unattended wave in the wiki's own island, under the worn face's actor", () => {
  test("a clean edit lands in the working layer, in-wiki, unattended, under the did it was handed; then pins", async () => {
    const plain = put("My Notes.tid", tid("My Notes", "the new words"));
    agreed(NOTES_WORKING, "My Notes", plain, tid("My Notes", "the old words"));
    const { waves, submit } = island();
    const { looks, sense } = shore();
    const ports = is.workspaceIngestPorts({ workspace: ws, slug: "notes", submit, sense, did: "0xwornface", tree: () => tree, log: () => {} });
    await ports.wave([plain]);
    expect(waves).toHaveLength(1);
    const w = waves[0]!;
    expect(w.toBag).toBe(NOTES_WORKING);
    expect(w.inWiki).toBe(true);
    expect(w.wiki).toBe("notes");
    expect(w.unattended).toBe(true);
    expect(w.did).toBe("0xwornface");
    expect(w.source).toBe(ws);
    expect(w.candidates.map((c) => [c.uri, c.status])).toEqual([["My Notes", "changed"]]);
    expect(tree.baseAt(syncedTreeKey(NOTES_WORKING, "My Notes"), plain)?.disk).toBe(carrierHash(readFileSync(plain, "utf8")));
    expect(looks).toEqual([]);
    await ports.wave([plain]);
    expect(waves).toHaveLength(1);
  });

  test("a stand-off goes to the shore by name; the catch-up reads the whole workspace but its tooling", async () => {
    const plain = put("My Notes.tid", tid("My Notes", "the disk's words"));
    agreed(NOTES_WORKING, "My Notes", plain, tid("My Notes", "the old words"));
    put("temp/scratch.tid", tid("scratch"));
    put("recovery/Draft.tid", tid("Draft"));
    const { waves, submit } = island(() => "conflict");
    const { looks, sense } = shore();
    const ports = is.workspaceIngestPorts({ workspace: ws, slug: "notes", submit, sense, did: "0xwornface", tree: () => tree, log: () => {} });
    await ports.catchUp();
    expect(waves).toHaveLength(1);
    expect(waves[0]!.candidates.map((c) => c.uri)).toEqual(["My Notes"]);
    expect(looks).toEqual([undefined]);
    await ports.wave([plain]);
    expect(looks[1]).toEqual(["My Notes"]);
  });
});

describe("WP4 — the witness on a scratch house: a user wiki bound to a workspace flows back and commits at lock", () => {
  test("the share row binds notes to its workspace; a disk edit lands by itself; the lock commits it", async () => {
    const bound = workspaceRootsOf({ rows: [{ slug: "notes", kind: "wiki", workspace: "notes" }], workspacesHome: join(house, "workspaces"), hearth: join(house, "hearth"), sourcedSlugs: [] });
    expect(Object.keys(bound.roots)).toEqual(["notes"]);
    const dir = bound.roots["notes"]!;
    const { waves, submit } = island();
    const { sense } = shore();
    const { watch, fire } = fakeWatch();
    const seat = wc.armWorkspaceWatch({
      workspace: dir, name: "notes", watch, cookie: async () => true, settleMs: 5, log: () => {},
      ports: is.workspaceIngestPorts({ workspace: dir, slug: "notes", submit, sense, did: "0xwornface", tree: () => tree, log: () => {} }),
    });
    expect(await seat.armed).toBe("live");
    const plain = join(dir, "Fresh Note.tid");
    writeFileSync(plain, tid("Fresh Note", "typed in an editor"));
    fire("Fresh Note.tid");
    for (let i = 0; i < 50 && !waves.some((w) => w.candidates.some((c) => c.uri === "Fresh Note")); i++) await settle(10);
    const landed = waves.find((w) => w.candidates.some((c) => c.uri === "Fresh Note"));
    expect(landed?.toBag).toBe(NOTES_WORKING);
    expect(landed?.unattended).toBe(true);
    expect(tree.baseAt(syncedTreeKey(NOTES_WORKING, "Fresh Note"), plain)).not.toBeNull();
    const reading = await seat.down("lock");
    expect(reading).toEqual({ committed: true, sha: expect.any(String) });
    expect(gitIn(dir, "show", "--name-only", "--format=", "HEAD").out.split("\n")).toEqual(["Fresh Note.tid"]);
  });
});

describe("WP5 — control: a wiki with no workspace keeps projecting to wikis/<slug>/, unwatched", () => {
  test("no workspace binds; the working mirror rests at wikis/<slug>", () => {
    const bound = workspaceRootsOf({ rows: [{ slug: "works", kind: "wiki" }], workspacesHome: join(house, "workspaces"), hearth: join(house, "hearth"), sourcedSlugs: [] });
    expect(bound.roots).toEqual({});
    const projections = join(house, "projections");
    const grant = [{ bagId: "working", mirrorRoot: join(projections, "wikis"), scope: "working", wikiSlot: "working" as const, workspaceRoots: bound.roots }];
    const mirrors = resolveDiskMirrors(grant, [wikiSlotUri("works", "working")], "works");
    expect(mirrors.map((m) => m.mirrorRoot)).toEqual([`${join(projections, "wikis")}/works`]);
  });
});

describe("WP6 — the vessel arms one seat per bound workspace", () => {
  const vessel = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8");
  const afterLive = vessel.slice(vessel.indexOf("const afterLive:"), vessel.indexOf("const orchestration:"));
  test("after-live arms armWorkspaceWatch unawaited over each bound workspace, with the worn face's actor, downed at lock", () => {
    expect(afterLive).toMatch(/armWorkspaceWatch\(/);
    expect(afterLive).not.toMatch(/await\s+armWorkspaceWatch/);
    expect(afterLive).toMatch(/workspaceIngestPorts\(\{[^}]*did:\s*requestedBy/);
    expect(afterLive).toMatch(/stood\.push\(\{\s*what:\s*`the workspace \$\{name\}'s watch`/);
  });
  test("the shutdown's stand-down downs every workspace seat beside the face pool", () => {
    expect(vessel).toMatch(/facePoolStandDown:\s*async\s*\(\)\s*=>\s*\{[^}]*workspaceWatches/);
  });
});
