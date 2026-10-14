/**
 * synced-tree — vectors for the Confluence merge base: atomic persistence, corrupt
 * recovery, and the projector's hash-gate contract.
 */

import { describe, test, expect, vi } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SyncedTree, contentHash, syncedTreeKey } from "../src/synced-tree.js";
import { carrierHash } from "@lararium/mesh";

// THE HANDSHAKE SEAM for the two-writers vector: the tree's own `renameSync` calls a hook the vector arms,
// at the moment a row (or, under a single-file tree, the whole map) stands ready to land. Unarmed, it passes through.
const seam = vi.hoisted(() => ({ beforeRename: null as null | (() => void) }));
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    renameSync: (from: string, to: string): void => {
      const hook = seam.beforeRename;
      seam.beforeRename = null;                 // one firing: the second writer's own renames pass through
      hook?.();
      actual.renameSync(from, to);
    },
  };
});

/** The row files a tree directory holds (temp files and strangers left out). */
const rowFiles = (dir: string): string[] => readdirSync(dir).filter((f) => /^[0-9a-f]{32}\.[0-9a-f]{32}\.json$/.test(f)).sort();

/** The path every base in this file stands at: the tree compares it and never reads it. */
const AT = "/scratch/mirror/a.mem";

describe("synced-tree — observations persist atomically", () => {
  test("set → reload reads the same observation", () => {
    const dir = mkdtempSync(join(tmpdir(), "synced-"));
    const p = join(dir, "state", "synced-tree.json");
    const t1 = new SyncedTree(p, 0);
    t1.set("lar:///a", AT, contentHash("alpha"));
    const t2 = new SyncedTree(p, 0);
    expect(t2.get("lar:///a")).toBe(contentHash("alpha"));
    expect(t2.get("lar:///missing")).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test("delete removes the observation durably", () => {
    const dir = mkdtempSync(join(tmpdir(), "synced-"));
    const p = join(dir, "synced-tree.json");
    const t = new SyncedTree(p, 0);
    t.set("lar:///a", AT, "h1");
    t.delete("lar:///a");
    expect(new SyncedTree(p, 0).get("lar:///a")).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test("a torn row degrades to never-projected, never throws, and heals on the next agreement", () => {
    const dir = mkdtempSync(join(tmpdir(), "synced-"));
    const p = join(dir, "synced-tree");
    new SyncedTree(p, 0).set("lar:///a", AT, "h1");
    const [name] = rowFiles(p);
    writeFileSync(join(p, name!), "{ torn json", "utf-8");
    const said: string[] = [];
    const warn = console.warn;
    console.warn = (line: unknown) => { said.push(String(line)); };
    let t: SyncedTree;
    try { t = new SyncedTree(p, 0); } finally { console.warn = warn; }
    expect(said).toEqual([`[synced-tree] 1 row(s) of ${p} name no base in this tree's shape; each such carrier reads as never agreed`]);
    expect(t.size).toBe(0);
    expect(t.get("lar:///a")).toBeNull();
    t.set("lar:///a", AT, "h2");                       // heals: the row lands whole under the same name
    expect(rowFiles(p)).toEqual([name]);
    expect(JSON.parse(readFileSync(join(p, name!), "utf-8"))).toEqual({ key: "lar:///a", path: AT, disk: "h2", records: "h2" });
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("synced-tree — the base holds two sides", () => {
  const fresh = () => {
    const dir = mkdtempSync(join(tmpdir(), "synced-"));
    return { dir, p: join(dir, "synced-tree.json") };
  };

  test("one hash names both sides: a projector write leaves the disk holding the render", () => {
    const { dir, p } = fresh();
    const t = new SyncedTree(p, 0);
    t.set("k", AT, contentHash("render"));
    expect(t.base("k")).toEqual({ path: AT, disk: contentHash("render"), records: contentHash("render") });
    expect(t.get("k")).toBe(contentHash("render"));
    rmSync(dir, { recursive: true, force: true });
  });

  test("a disk standing in another framing pins two hashes, and both survive a reload", () => {
    const { dir, p } = fresh();
    const t = new SyncedTree(p, 0);
    t.set("k", AT, contentHash("disk bytes"), contentHash("the render"));
    expect(t.get("k")).toBe(contentHash("disk bytes"));
    const reopened = new SyncedTree(p, 0);
    expect(reopened.base("k")).toEqual({ path: AT, disk: contentHash("disk bytes"), records: contentHash("the render") });
    expect(reopened.base("missing")).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test("the rename index keys on the disk side, never the records side", () => {
    const { dir, p } = fresh();
    const t = new SyncedTree(p, 0);
    const bag = "lar:///ha.ka.ba/bags/x";
    t.set(syncedTreeKey(bag, "lar:///a"), AT, contentHash("disk bytes"), contentHash("the render"));
    expect(t.renameSourceUri(bag, contentHash("disk bytes"))).toBe("lar:///a");
    expect(t.renameSourceUri(bag, contentHash("the render"))).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test("the rename index reads right before any persist: a coalescing tree answers from the set itself", () => {
    const { dir, p } = fresh();
    const t = new SyncedTree(p, 60_000);   // the write waits; the index must not
    const bag = "lar:///ha.ka.ba/bags/x";
    t.set(syncedTreeKey(bag, "lar:///a"), AT, contentHash("disk bytes"), contentHash("the render"));
    expect(t.renameSourceUri(bag, contentHash("disk bytes"))).toBe("lar:///a");
    expect(t.renameSourceUri(bag, contentHash("the render"))).toBeNull();
    // A second set under the same key drops the earlier disk side from the index.
    t.set(syncedTreeKey(bag, "lar:///a"), AT, contentHash("later bytes"), contentHash("the render"));
    expect(t.renameSourceUri(bag, contentHash("disk bytes"))).toBeNull();
    expect(t.renameSourceUri(bag, contentHash("later bytes"))).toBe("lar:///a");
    t.delete(syncedTreeKey(bag, "lar:///a"));
    expect(t.renameSourceUri(bag, contentHash("later bytes"))).toBeNull();
    t.flush();
    rmSync(dir, { recursive: true, force: true });
  });

  test("a row in any other shape names no base: that carrier reads as never agreed", () => {
    const { dir, p } = fresh();
    const t0 = new SyncedTree(p, 0);
    t0.set("whole", AT, "d1", "r1");
    const [whole] = rowFiles(p);
    const strangers: Record<string, unknown> = {
      [`${"1".repeat(32)}.${"1".repeat(32)}.json`]: { key: "no path", disk: "d0", records: "r0" },
      [`${"2".repeat(32)}.${"2".repeat(32)}.json`]: "h1",
      [`${"3".repeat(32)}.${"3".repeat(32)}.json`]: { key: "one side", path: AT, disk: "d2" },
      [`${"4".repeat(32)}.${"4".repeat(32)}.json`]: { key: "empty side", path: AT, disk: "d3", records: "" },
      [`${"5".repeat(32)}.${"5".repeat(32)}.json`]: ["d4", "r4"],
      // A whole row resting under a name its own key and path do not fold to names no base either.
      [`${"6".repeat(32)}.${"6".repeat(32)}.json`]: { key: "misfiled", path: AT, disk: "d5", records: "r5" },
    };
    for (const [name, value] of Object.entries(strangers)) writeFileSync(join(p, name), JSON.stringify(value), "utf-8");
    writeFileSync(join(p, ".row.1.1.abcd.tmp"), "{ a temp file a crash left", "utf-8");   // never read, never counted
    const said: string[] = [];
    const warn = console.warn;
    console.warn = (line: unknown) => { said.push(String(line)); };
    let t: SyncedTree;
    try { t = new SyncedTree(p, 0); } finally { console.warn = warn; }
    // The forgotten bases speak once, by count and by directory.
    expect(said).toEqual([`[synced-tree] 6 row(s) of ${p} name no base in this tree's shape; each such carrier reads as never agreed`]);
    expect(t.size).toBe(1);
    expect(t.base("whole")).toEqual({ path: AT, disk: "d1", records: "r1" });
    for (const k of ["no path", "one side", "empty side", "misfiled"]) expect(t.base(k)).toBeNull();
    // A write lands its own row and touches no other file.
    t.set("fresh", AT, "d9");
    expect(rowFiles(p)).toHaveLength(8);
    expect(JSON.parse(readFileSync(join(p, whole!), "utf-8"))).toEqual({ key: "whole", path: AT, disk: "d1", records: "r1" });
    rmSync(dir, { recursive: true, force: true });
  });

  test("a single-file tree of an earlier shape names no base, and the tree says so by name", () => {
    const { dir } = fresh();
    const p = join(dir, "synced-tree");
    const earlier = `${p}.json`;
    const bytes = JSON.stringify({ k: { path: AT, disk: "d1", records: "r1" } });
    writeFileSync(earlier, bytes, "utf-8");
    const said: string[] = [];
    const warn = console.warn;
    console.warn = (line: unknown) => { said.push(String(line)); };
    let t: SyncedTree;
    try { t = new SyncedTree(p, 0); } finally { console.warn = warn; }
    expect(said).toEqual([`[synced-tree] ${earlier} holds a tree in an earlier shape; it names no base here, and each carrier reads as never agreed`]);
    expect(t.size).toBe(0);
    expect(t.baseAt("k", AT)).toBeNull();
    t.set("k", AT, "d2");
    expect(new SyncedTree(p, 0).baseAt("k", AT)).toEqual({ path: AT, disk: "d2", records: "d2" });
    expect(readFileSync(earlier, "utf-8")).toBe(bytes);          // nothing rewrites the earlier file
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("synced-tree — the R2 content-addressed rename-index", () => {
  const BAG = "lar:///ha.ka.ba/bags/daemon/notes";
  const OTHER = "lar:///ha.ka.ba/bags/daemon/other";
  const freshTree = () => new SyncedTree(join(mkdtempSync(join(tmpdir(), "synced-")), "synced-tree.json"), 0);

  test("resolves the UNIQUE live carrier observing a given content in a bag", () => {
    const t = freshTree();
    const h = carrierHash("the body of a note", undefined);
    t.set(syncedTreeKey(BAG, "lar:///a.b.c"), AT, h);
    expect(t.renameSourceUri(BAG, h)).toBe("lar:///a.b.c");
    expect(t.renameSourceUri(BAG, carrierHash("different body", undefined))).toBeNull();
  });

  test("is bag-scoped — the same content in another bag never matches", () => {
    const t = freshTree();
    const h = carrierHash("shared body", undefined);
    t.set(syncedTreeKey(OTHER, "lar:///x.y.z"), AT, h);
    expect(t.renameSourceUri(BAG, h)).toBeNull();        // different bag
    expect(t.renameSourceUri(OTHER, h)).toBe("lar:///x.y.z");
  });

  test("declines on ambiguity — two carriers sharing content resolve to null (no guess)", () => {
    const t = freshTree();
    const h = carrierHash("identical twins", undefined);
    t.set(syncedTreeKey(BAG, "lar:///twin.one"), AT, h);
    t.set(syncedTreeKey(BAG, "lar:///twin.two"), AT, h);
    expect(t.renameSourceUri(BAG, h)).toBeNull();        // >1 live carrier — decline
    // remove one → the collision clears, the survivor resolves uniquely
    t.delete(syncedTreeKey(BAG, "lar:///twin.two"));
    expect(t.renameSourceUri(BAG, h)).toBe("lar:///twin.one");
  });

  test("a content EDIT re-keys the index — the old content no longer resolves", () => {
    const t = freshTree();
    const key = syncedTreeKey(BAG, "lar:///a.b.c");
    const h1 = carrierHash("first body", undefined);
    const h2 = carrierHash("edited body", undefined);
    t.set(key, AT, h1);
    t.set(key, AT, h2);                                       // an edit at the same location
    expect(t.renameSourceUri(BAG, h1)).toBeNull();        // stale content drops out
    expect(t.renameSourceUri(BAG, h2)).toBe("lar:///a.b.c");
  });

  test("delete drops the content from the index", () => {
    const t = freshTree();
    const h = carrierHash("body", undefined);
    t.set(syncedTreeKey(BAG, "lar:///a.b.c"), AT, h);
    t.delete(syncedTreeKey(BAG, "lar:///a.b.c"));
    expect(t.renameSourceUri(BAG, h)).toBeNull();
  });

  test("spelling-agnostic: every tagged spelling of one digest resolves the same carrier", () => {
    const t = freshTree();
    const hex = "a".repeat(64);
    t.set(syncedTreeKey(BAG, "lar:///a.b.c"), AT, `sha256:${hex}`);
    expect(t.renameSourceUri(BAG, `sha256:${hex}`)).toBe("lar:///a.b.c");
    expect(t.renameSourceUri(BAG, `sha256-${hex}`)).toBe("lar:///a.b.c");     // SRI spelling, same digest
  });

  test("★ a BARE hex names no algorithm: stored, it stays out of the index; asked, it resolves nothing ★", () => {
    const t = freshTree();
    const hex = "a".repeat(64);
    t.set(syncedTreeKey(BAG, "lar:///a.b.c"), AT, hex);
    expect(t.renameSourceUri(BAG, `sha256:${hex}`)).toBeNull();
    expect(t.renameSourceUri(BAG, hex)).toBeNull();
  });

  test("the index rebuilds from disk on reload (derived, never persisted)", () => {
    const dir = mkdtempSync(join(tmpdir(), "synced-"));
    const p = join(dir, "synced-tree.json");
    const h = carrierHash("persisted body", undefined);
    const t1 = new SyncedTree(p, 0);
    t1.set(syncedTreeKey(BAG, "lar:///a.b.c"), AT, h);
    const t2 = new SyncedTree(p, 0);                       // cold reload
    expect(t2.renameSourceUri(BAG, h)).toBe("lar:///a.b.c");
    // the directory holds the one row and nothing else: no index rests on disk
    expect(readdirSync(p)).toEqual(rowFiles(p));
    expect(rowFiles(p)).toHaveLength(1);
    rmSync(dir, { recursive: true, force: true });
  });

  test("a rename retarget (delete old + set new) leaves only the new location indexed", () => {
    const t = freshTree();
    const h = carrierHash("moved unchanged", undefined);
    t.set(syncedTreeKey(BAG, "lar:///old.name"), AT, h);
    // the R2 retarget: drop the stale source observation, record the moved carrier
    t.delete(syncedTreeKey(BAG, "lar:///old.name"));
    t.set(syncedTreeKey(BAG, "lar:///new.name"), AT, h);
    expect(t.renameSourceUri(BAG, h)).toBe("lar:///new.name");
    expect(t.get(syncedTreeKey(BAG, "lar:///old.name"))).toBeNull();
    expect(t.get(syncedTreeKey(BAG, "lar:///new.name"))).toBe(h);
  });
});

describe("synced-tree — CONCURRENT WRITERS over one file (the island-per-worker law)", () => {
  // ONE tree file serves EVERY projector in the vessel: the daemon island mirrors
  // wikis/daemon + bags/crossroads, each wiki island mirrors its recipe's bags, and
  // the CLI's ingest gate records packs and renames. They live in SEPARATE workers and
  // SEPARATE processes, so each holds its own in-memory map loaded at open. A persist
  // that writes the WHOLE map erases every observation a sibling recorded after that
  // load — and a bag whose observations vanish reads `new` forever, so the echo gate
  // re-lands it and NO deletion is ever detectable (deletionsOf needs a syncedHash).
  const A = "lar:///ha.ka.ba/bags/lares";
  const B = "lar:///ha.ka.ba/wikis/daemon/working";

  test("a sibling's observation survives another writer's persist", () => {
    const dir = mkdtempSync(join(tmpdir(), "synced-"));
    const p = join(dir, "synced-tree.json");
    const wiki   = new SyncedTree(p, 0);        // the wiki island's projector
    const daemon = new SyncedTree(p, 0);        // the daemon island's projector, same file

    wiki.set(syncedTreeKey(A, "lar:///a.b.c"), AT, "h-wiki");
    daemon.set(syncedTreeKey(B, "lar:///verbs/x"), AT, "h-daemon");   // opened BEFORE the wiki wrote

    const onDisk = new SyncedTree(p, 0);
    expect(onDisk.get(syncedTreeKey(A, "lar:///a.b.c"))).toBe("h-wiki");
    expect(onDisk.get(syncedTreeKey(B, "lar:///verbs/x"))).toBe("h-daemon");
    rmSync(dir, { recursive: true, force: true });
  });

  test("a delete still lands across writers — it never resurrects from the file", () => {
    const dir = mkdtempSync(join(tmpdir(), "synced-"));
    const p = join(dir, "synced-tree.json");
    const seed = new SyncedTree(p, 0);
    seed.set(syncedTreeKey(A, "lar:///gone"), AT, "h1");

    const other = new SyncedTree(p, 0);          // sees lar:///gone at open
    seed.delete(syncedTreeKey(A, "lar:///gone"));
    other.set(syncedTreeKey(B, "lar:///kept"), AT, "h2");   // must not resurrect the deleted key

    const onDisk = new SyncedTree(p, 0);
    expect(onDisk.get(syncedTreeKey(A, "lar:///gone"))).toBeNull();
    expect(onDisk.get(syncedTreeKey(B, "lar:///kept"))).toBe("h2");
    rmSync(dir, { recursive: true, force: true });
  });

  test("two writers in ONE window drop no row (pinned by handshake at the first writer's rename)", () => {
    // Both writers load the tree before either writes. The first writer's write stands ready to land; at
    // that moment, by the seam and by no clock, the second writer records its own row and lands it whole.
    // A tree that rewrote one whole map from what it read before the window would land the first writer's
    // stale map over the second writer's row.
    const dir = mkdtempSync(join(tmpdir(), "synced-"));
    const p = join(dir, "synced-tree");
    new SyncedTree(p, 0).set(syncedTreeKey(A, "lar:///seeded"), AT, "h-seed");
    const first  = new SyncedTree(p, 60_000);
    const second = new SyncedTree(p, 0);
    first.set(syncedTreeKey(A, "lar:///a.b.c"), AT, "h-first");
    let fired = 0;
    seam.beforeRename = () => { fired++; second.set(syncedTreeKey(B, "lar:///verbs/x"), AT, "h-second"); };
    first.flush();
    expect(fired).toBe(1);                                     // the window opened once, inside the first writer's write
    const onDisk = new SyncedTree(p, 0);
    expect(onDisk.get(syncedTreeKey(B, "lar:///verbs/x"))).toBe("h-second");
    expect(onDisk.get(syncedTreeKey(A, "lar:///a.b.c"))).toBe("h-first");
    expect(onDisk.get(syncedTreeKey(A, "lar:///seeded"))).toBe("h-seed");
    // CONTROL: with no second writer in the window the same flush lands the same rows.
    first.set(syncedTreeKey(A, "lar:///later"), AT, "h-later");
    first.flush();
    expect(new SyncedTree(p, 0).size).toBe(4);
    rmSync(dir, { recursive: true, force: true });
  });

  test("two writers persisting in the SAME process never collide on the temp file", () => {
    // Islands are worker THREADS — one pid, two SyncedTrees. A pid-keyed temp name is
    // the same name twice; the rename of one can carry the other's half-written bytes.
    const dir = mkdtempSync(join(tmpdir(), "synced-"));
    const p = join(dir, "synced-tree.json");
    const a = new SyncedTree(p, 0);
    const b = new SyncedTree(p, 0);
    for (let i = 0; i < 40; i++) { a.set(syncedTreeKey(A, `lar:///a${i}`), AT, `ha${i}`); b.set(syncedTreeKey(B, `lar:///b${i}`), AT, `hb${i}`); }
    const onDisk = new SyncedTree(p, 0);
    expect(onDisk.get(syncedTreeKey(A, "lar:///a39"))).toBe("ha39");
    expect(onDisk.get(syncedTreeKey(B, "lar:///b39"))).toBe("hb39");
    expect(onDisk.size).toBe(80);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("a base stands at one path", () => {
  const fresh = (): { dir: string; p: string } => {
    const dir = mkdtempSync(join(tmpdir(), "synced-tree-path-"));
    return { dir, p: join(dir, "synced-tree.json") };
  };

  test("baseAt answers the base only at the path its agreement stood at, in every spelling of that path", () => {
    const { dir, p } = fresh();
    const t = new SyncedTree(p, 0);
    t.set("k", "/scratch/mirror/a.mem", "d1", "r1");
    expect(t.baseAt("k", "/scratch/mirror/a.mem")).toEqual({ path: "/scratch/mirror/a.mem", disk: "d1", records: "r1" });
    expect(t.baseAt("k", "/scratch/mirror/sub/../a.mem")).not.toBeNull();
    expect(t.baseAt("k", "/scratch/mirror/moved/a.mem")).toBeNull();
    expect(t.baseAt("k", "/scratch/mirror/a.md")).toBeNull();
    expect(t.baseAt("missing", "/scratch/mirror/a.mem")).toBeNull();
    // The path survives a reload.
    expect(new SyncedTree(p, 0).baseAt("k", "/scratch/mirror/a.mem")).not.toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test("a carrier holds one row per path: an agreement at a second path displaces none at the first", () => {
    const { dir, p } = fresh();
    const MIRROR = "/scratch/bags/lares/a.mem", HOLDING = "/scratch/wikis/inbox/a.mem";
    const projector = new SyncedTree(p, 0);
    projector.set("k", MIRROR, "d1", "r1");                    // the projector pins the mirror's base
    const gesture = new SyncedTree(p, 0);
    gesture.set("k", HOLDING, "d2", "r2");                     // the ingest gesture pins the holding file's
    for (const t of [gesture, new SyncedTree(p, 0)]) {
      expect(t.baseAt("k", MIRROR)).toEqual({ path: MIRROR, disk: "d1", records: "r1" });
      expect(t.baseAt("k", HOLDING)).toEqual({ path: HOLDING, disk: "d2", records: "r2" });
      expect(t.bases("k").map((b) => b.path).sort()).toEqual([MIRROR, HOLDING]);
      expect(t.base("k")).toBeNull();                          // several stand: no one base names the carrier
      expect(t.size).toBe(2);
    }
    // CONTROL: a path no agreement stood at still names no base, and one base leaves alone.
    expect(gesture.baseAt("k", "/scratch/bags/lares/moved/a.mem")).toBeNull();
    gesture.deleteAt("k", HOLDING);
    const after = new SyncedTree(p, 0);
    expect(after.baseAt("k", HOLDING)).toBeNull();
    expect(after.base("k")).toEqual({ path: MIRROR, disk: "d1", records: "r1" });
    after.delete("k");
    expect(new SyncedTree(p, 0).size).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  test("reread lays this instance's unpersisted changes over what a sibling wrote", () => {
    const { dir, p } = fresh();
    const mine = new SyncedTree(p, 60_000);          // coalescing: its own set waits in the journal
    const sibling = new SyncedTree(p, 0);
    mine.set("mine", AT, "m1");
    sibling.set("theirs", AT, "s1");
    expect(mine.base("theirs")).toBeNull();
    mine.reread();
    expect(mine.base("theirs")).toEqual({ path: AT, disk: "s1", records: "s1" });
    expect(mine.base("mine")).toEqual({ path: AT, disk: "m1", records: "m1" });
    mine.flush();
    const onDisk = new SyncedTree(p, 0);
    expect([onDisk.base("mine")?.disk, onDisk.base("theirs")?.disk, onDisk.size]).toEqual(["m1", "s1", 2]);
    // One carrier's rows reread alone, and the other carriers' rows stand as this instance held them.
    sibling.set("theirs", "/scratch/mirror/b.mem", "s2");
    sibling.set("later", AT, "s3");
    mine.reread("theirs");
    expect(mine.bases("theirs").map((b) => b.disk).sort()).toEqual(["s1", "s2"]);
    expect(mine.base("later")).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test("a tree with no file holds its bases in memory, persists nothing and arms no timer", () => {
    const armed: unknown[] = [];
    const setTimer = globalThis.setTimeout;
    (globalThis as { setTimeout: unknown }).setTimeout = ((...a: unknown[]) => { armed.push(a); return (setTimer as (...x: unknown[]) => unknown)(...a); });
    try {
      const t = new SyncedTree(null);
      t.set("k", AT, "d1", "r1");
      expect(t.baseAt("k", AT)).toEqual({ path: AT, disk: "d1", records: "r1" });
      t.reread();
      t.flush();
      expect(t.size).toBe(1);
      t.delete("k");
      expect(t.base("k")).toBeNull();
    } finally {
      (globalThis as { setTimeout: unknown }).setTimeout = setTimer;
    }
    expect(armed).toEqual([]);
  });
});
