/**
 * workspace-pool — A SHARED WIKI'S WORKBENCH SERVES AS A POOL (face-pools; cabal-realm#/the-workbench). A wiki's workbench
 * mirror rests in ONE folder whichever face wears: `<projections>/realms/<realm pet name>/wikis/<slug>/`, or the workspace its share row names
 * (`lares wiki share <wiki> --workspace <name>`, bound at `<root>/workspaces/<name>`). The watch core, the unattended flow-back
 * and the commit seam serve that copy as they serve the worn face's own pool.
 *
 * THE SEAT FOUNDS NO HISTORY: the folder's git tree comes from `lares surface init` (Lares-Alpha's lane, not yet on develop);
 * this rig stubs it with a plain `git init`, the house's ignore lines in `.git/info/exclude` and a local author naming no face.
 *
 *   WP1 a folder with no tree serves as a plain mirror: the arm founds none and names it, and the seam reads `no-pool-history`;
 *       a folder inside another history (the checkout) commits nothing there either
 *   WP2 the seat arms off the boot path, watches the whole folder (its `.git/`, `temp/`, `recovery/` and litter wake no wave),
 *       and downs at lock with the final wave, then a commit whose subject names no face
 *   WP3 the ports land a clean edit as an UNATTENDED INGEST wave in the wiki's working layer, run IN that wiki's island, under
 *       the worn face's actor; a conflict goes to that wiki's shore
 *   WP4 the witness on a scratch house: a user wiki bound to a workspace (as `notes` would be) flows a disk edit back by itself
 *       and commits at lock
 *   WP2b a realm's wiki folder commits into its realm's one tree (`realms/<pet>/`), its own paths alone
 *   WP5 the workbench folders: each bound workspace (its own tree), then each `realms/<pet>/wikis/<slug>/` a realm label holds
 *       that no workspace takes (its tree at the realm root); control: a plain `wikis/<slug>/` takes no seat, and a realm's slug with no folder on disk takes none
 *   WP6 the vessel arms one seat per workbench folder in its after-live step, unawaited, under the worn face's actor, and downs
 *       each at lock, wear and shutdown
 */
import { describe, test, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { carrierHash } from "@lararium/mesh/crypto";
import { VERB_RESULT_KEY } from "@lararium/mesh/verb-tiddler";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { SyncedTree, syncedTreeKey } from "../src/synced-tree.js";
import { workspaceRootsOf, workbenchFolders, realmRoot } from "../src/bag-paths.js";
import { nameRealm, placeInRealm, realmPlacement } from "../src/realm-labels.js";

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

/** THE STUB of the tree `lares surface init` founds (Lares-Alpha's lane): plain `git init`, the house's ignore lines, a local author naming no face. */
const stubTree = (dir: string): void => {
  for (const args of [["init", "-q"], ["config", "user.name", "workbench"], ["config", "user.email", "workbench@pool.invalid"], ["config", "commit.gpgsign", "false"]]) expect(gitIn(dir, ...args).code).toBe(0);
  writeFileSync(join(dir, ".git", "info", "exclude"), ".vscode/\n.shore/\ntemp/\n*.orphans/\n*.[0-9]*.tmp\n");
};

describe("WP1 — a folder with no tree serves as a plain mirror", () => {
  test("the arm founds no repository and names the plain mirror; the seam reads no-pool-history by name", async () => {
    const lines: string[] = [];
    const { watch } = fakeWatch();
    const seat = wc.armWorkspaceWatch({
      workspace: ws, name: "notes", watch, cookie: async () => true, settleMs: 5, log: (l) => lines.push(l),
      ports: { catchUp: async () => {}, wave: async () => {} },
    });
    expect(await seat.armed).toBe("live");
    expect(() => statSync(join(ws, ".git"))).toThrow();
    expect(lines.some((l) => /plain mirror/.test(l))).toBe(true);
    put("My Notes.tid", tid("My Notes"));
    expect(await seat.down("lock")).toEqual({ committed: false, why: "no-pool-history" });
  });

  test("a folder inside another history (the checkout) commits nothing there, by name", async () => {
    const outer = join(house, "checkout");
    const inner = join(outer, "wikis", "notes");
    mkdirSync(inner, { recursive: true });
    gitIn(outer, "init", "-q");
    writeFileSync(join(inner, "My Notes.tid"), tid("My Notes"));
    expect(await wc.workspaceCommitSeam(inner, "lock")).toEqual({ committed: false, why: "no-pool-history" });
  });
});

describe("WP2 — the seat over a workbench: off the boot path, the whole folder, down at lock", () => {
  test("arms at once; the whole folder wakes waves, its tooling none", async () => {
    stubTree(ws);
    const waves: string[] = [];
    const { watch, fire } = fakeWatch();
    const seat = wc.armWorkspaceWatch({
      workspace: ws, name: "notes", watch, cookie: async () => true, settleMs: 5, log: () => {},
      ports: { catchUp: async () => {}, wave: async (files) => { waves.push(...files); } },
    });
    expect(["arming", "catching-up"]).toContain(seat.state());
    expect(await seat.armed).toBe("live");
    for (const rel of ["My Notes.tid", "ha.ka.ba/notes/pond.mem", "journal/2026-11-18.tid"]) fire(rel);
    for (const rel of [".git/index", "temp/x.tid", "recovery/Draft.tid", ".My Notes.tid.swp", "x.tid~", "x.tid.123.tmp", ".shore/x.tid"]) fire(rel);
    await settle(40);
    expect(waves.map((f) => f.slice(ws.length + 1)).sort()).toEqual(["My Notes.tid", "ha.ka.ba/notes/pond.mem", "journal/2026-11-18.tid"]);
    await seat.down("down");
  });

  test("lock: the final wave, then a commit whose subject names no face; recovery/ and temp/ stay out", async () => {
    stubTree(ws);
    const order: string[] = [];
    const { watch, fire } = fakeWatch();
    const seat = wc.armWorkspaceWatch({
      workspace: ws, name: "notes", watch, cookie: async () => true, settleMs: 10_000, log: () => {},
      ports: { catchUp: async () => {}, wave: async (files) => { order.push(`wave ${files.map((f) => f.slice(ws.length + 1)).join(",")}`); } },
    });
    await seat.armed;
    put("My Notes.tid", tid("My Notes"));
    put("temp/scratch.tid", tid("scratch"));
    put("recovery/Draft.tid", tid("Draft"));
    fire("My Notes.tid");
    const reading = await seat.down("lock");
    expect(order).toEqual(["wave My Notes.tid"]);
    expect(reading).toEqual({ committed: true, sha: expect.any(String) });
    const subject = git("log", "-1", "--format=%s");
    expect(subject.startsWith("lar:///workspace.closes.the-sitting/lock")).toBe(true);
    expect(git("show", "--name-only", "--format=", "HEAD").split("\n")).toEqual(["My Notes.tid"]);
    expect(await wc.workspaceCommitSeam(ws, "down")).toEqual({ committed: false, why: "nothing-moved" });
  });
});

describe("WP2b — a realm wiki folder commits into its realm's ONE tree, its own paths alone", () => {
  test("★ the seam reads the tree at the realm root, stages the wiki folder alone, and keeps its recovery/ and temp/ out ★", async () => {
    const realm = join(house, "projections", "realms", "Garden");
    const notes = join(realm, "wikis", "notes"), works = join(realm, "wikis", "works");
    mkdirSync(notes, { recursive: true }); mkdirSync(works, { recursive: true });
    stubTree(realm);
    writeFileSync(join(notes, "My Notes.tid"), tid("My Notes"));
    mkdirSync(join(notes, "recovery"), { recursive: true }); writeFileSync(join(notes, "recovery", "Draft.tid"), tid("Draft"));
    writeFileSync(join(works, "Other.tid"), tid("Other"));
    const { watch } = fakeWatch();
    const lines: string[] = [];
    const seat = wc.armWorkspaceWatch({
      workspace: notes, tree: realm, name: "notes", watch, cookie: async () => true, settleMs: 10_000, log: (l) => lines.push(l),
      ports: { catchUp: async () => {}, wave: async () => {} },
    });
    await seat.armed;
    expect(lines.some((l) => /plain mirror/.test(l)), "the realm's tree serves the folder").toBe(false);
    expect(await seat.down("lock")).toEqual({ committed: true, sha: expect.any(String) });
    expect(gitIn(realm, "show", "--name-only", "--format=", "HEAD").out.split("\n")).toEqual(["wikis/notes/My Notes.tid"]);
    expect(gitIn(realm, "status", "--porcelain", "-uall").out).toContain("?? wikis/works/Other.tid");
    expect(() => statSync(join(notes, ".git"))).toThrow();
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

  test("a conflict goes to the shore by name; the catch-up reads the whole workspace but its tooling", async () => {
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

  test("CATCH-UP WAKES ON A DIFF: a folder that stands as the last sync left it takes no wave and no look (the wiki stays cold)", async () => {
    const plain = put("My Notes.tid", tid("My Notes", "the words"));
    agreed(NOTES_WORKING, "My Notes", plain, tid("My Notes", "the words"));
    const { waves, submit } = island();
    const { looks, sense } = shore();
    const ports = is.workspaceIngestPorts({ workspace: ws, slug: "notes", submit, sense, did: "0xwornface", tree: () => tree, log: () => {} });
    await ports.catchUp();
    expect(waves).toHaveLength(0);
    expect(looks).toEqual([]);
  });

  test("control: an edit made while the vessel was down wakes the wiki (its wave lands, the shore looks)", async () => {
    const plain = put("My Notes.tid", tid("My Notes", "edited while down"));
    agreed(NOTES_WORKING, "My Notes", plain, tid("My Notes", "the words"));
    const { waves, submit } = island();
    const { looks, sense } = shore();
    const ports = is.workspaceIngestPorts({ workspace: ws, slug: "notes", submit, sense, did: "0xwornface", tree: () => tree, log: () => {} });
    await ports.catchUp();
    expect(waves).toHaveLength(1);
    expect(waves[0]!.candidates.map((c) => c.uri)).toEqual(["My Notes"]);
    expect(looks).toEqual([undefined]);
  });

  test("control: a file added while the vessel was down wakes the wiki", async () => {
    const kept = put("Kept.tid", tid("Kept"));
    agreed(NOTES_WORKING, "Kept", kept, tid("Kept"));
    put("Added.tid", tid("Added"));
    const { waves, submit } = island();
    const { looks, sense } = shore();
    const ports = is.workspaceIngestPorts({ workspace: ws, slug: "notes", submit, sense, did: "0xwornface", tree: () => tree, log: () => {} });
    await ports.catchUp();
    expect(waves).toHaveLength(1);
    expect(waves[0]!.candidates.map((c) => c.uri)).toEqual(["Added"]);
    expect(looks).toEqual([undefined]);
  });

  test("control: a file removed while the vessel was down wakes the wiki (the shore's whole look sees it pending)", async () => {
    const kept = put("Kept.tid", tid("Kept"));
    agreed(NOTES_WORKING, "Kept", kept, tid("Kept"));
    const gone = join(ws, "Gone.tid");
    agreed(NOTES_WORKING, "Gone", gone, tid("Gone"));
    const { waves, submit } = island();
    const { looks, sense } = shore();
    const ports = is.workspaceIngestPorts({ workspace: ws, slug: "notes", submit, sense, did: "0xwornface", tree: () => tree, log: () => {} });
    await ports.catchUp();
    expect(waves).toHaveLength(0);
    expect(looks).toEqual([undefined]);
  });

  test("a base another wiki's workspace holds never reads as a removal here", async () => {
    const kept = put("Kept.tid", tid("Kept"));
    agreed(NOTES_WORKING, "Kept", kept, tid("Kept"));
    const other = join(house, "workspaces", "other", "Gone.tid");
    agreed(wikiSlotUri("other", "working"), "Gone", other, tid("Gone"));
    const { submit } = island();
    const { looks, sense } = shore();
    const ports = is.workspaceIngestPorts({ workspace: ws, slug: "notes", submit, sense, did: "0xwornface", tree: () => tree, log: () => {} });
    await ports.catchUp();
    expect(looks).toEqual([]);
  });
});

describe("WP4 — the witness on a scratch house: a user wiki bound to a workspace flows back and commits at lock", () => {
  test("the share row binds notes to its workspace; a disk edit lands by itself; the lock commits it", async () => {
    const bound = workspaceRootsOf({ rows: [{ slug: "notes", kind: "wiki", workspace: "notes" }], workspacesHome: join(house, "workspaces"), hearth: join(house, "hearth"), sourcedSlugs: [] });
    expect(Object.keys(bound.roots)).toEqual(["notes"]);
    const dir = bound.roots["notes"]!;
    stubTree(dir);
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

describe("WP5 — the workbench folders: each bound workspace, then each wiki a realm label holds", () => {
  test("a bound workspace and a realm's workbench each take one seat; the bound slug's realm folder takes none", () => {
    const projections = join(house, "projections");
    nameRealm(projections, "Garden");
    for (const slug of ["notes", "works", "elyncia"]) placeInRealm(projections, "Garden", { slug, id: null });
    for (const slug of ["notes", "works", "elyncia"]) mkdirSync(join(realmRoot(projections, "Garden"), "wikis", slug), { recursive: true });
    const bound = workspaceRootsOf({ rows: [{ slug: "notes", kind: "wiki", workspace: "notes" }, { slug: "works", kind: "wiki" }], workspacesHome: join(house, "workspaces"), hearth: join(house, "hearth"), sourcedSlugs: [] });
    const folders = workbenchFolders({ projectionRoot: projections, workspaces: bound, sourcedSlugs: ["lares"], realms: realmPlacement(projections).realms() });
    expect(folders).toEqual([
      { slug: "notes", dir: bound.roots["notes"], name: "notes", tree: bound.roots["notes"] },
      { slug: "elyncia", dir: join(projections, "realms", "Garden", "wikis", "elyncia"), name: "elyncia", tree: join(projections, "realms", "Garden") },
      { slug: "works", dir: join(projections, "realms", "Garden", "wikis", "works"), name: "works", tree: join(projections, "realms", "Garden") },
    ]);
  });

  test("control: a plain wikis/<slug> folder takes no seat (only a realm's folder does), and a realm's slug with no folder takes none", () => {
    const projections = join(house, "projections");
    expect(workbenchFolders({ projectionRoot: projections, workspaces: { roots: {}, names: {} }, sourcedSlugs: [], realms: [] })).toEqual([]);
    mkdirSync(join(projections, "wikis", "notes"), { recursive: true });
    mkdirSync(join(projections, "wikis", "lares"), { recursive: true });
    expect(workbenchFolders({ projectionRoot: projections, workspaces: { roots: {}, names: {} }, sourcedSlugs: ["lares"], realms: realmPlacement(projections).realms() })).toEqual([]);
    nameRealm(projections, "Garden");
    placeInRealm(projections, "Garden", { slug: "notes", id: null });
    expect(workbenchFolders({ projectionRoot: projections, workspaces: { roots: {}, names: {} }, sourcedSlugs: [], realms: realmPlacement(projections).realms() })).toEqual([]);
  });
});

describe("WP6 — the vessel arms one seat per workbench folder", () => {
  const vessel = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8");
  const afterLive = vessel.slice(vessel.indexOf("const afterLive:"), vessel.indexOf("const orchestration:"));
  test("after-live arms armWorkspaceWatch unawaited over each workbench folder, with the worn face's actor, downed at lock", () => {
    expect(afterLive).toMatch(/readWorkbenches\(\)/);
    expect(vessel).toMatch(/workbenchFolders\(\{\s*projectionRoot,\s*workspaces,/);
    expect(afterLive).toMatch(/armWorkspaceWatch\(/);
    expect(afterLive).not.toMatch(/await\s+armWorkspaceWatch/);
    expect(afterLive).toMatch(/workspaceIngestPorts\(\{[^}]*did:\s*requestedBy/);
    expect(afterLive).toMatch(/stood\.push\(\{\s*what:\s*`the workbench \$\{name\}'s watch`/);
  });
  test("the shutdown's stand-down downs every workbench seat beside the face pool", () => {
    expect(vessel).toMatch(/facePoolStandDown:\s*async\s*\(\)\s*=>\s*\{[^}]*workspaceWatches/);
  });
});
