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
// at the moment a row stands ready to land. Unarmed, it passes through.
const seam = vi.hoisted(() => ({ beforeRename: null as null | (() => void), unlinkFault: null as null | Error, readFault: null as null | Error }));
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
    // A row's read the disk refuses, once: the armed fault throws in place of the read.
    readFileSync: ((path: unknown, ...rest: unknown[]): unknown => {
      const fault = typeof path === "string" && /[0-9a-f]{32}\.[0-9a-f]{32}\.json$/.test(path) ? seam.readFault : null;
      if (fault !== null) { seam.readFault = null; throw fault; }
      return (actual.readFileSync as (...a: unknown[]) => unknown)(path, ...rest);
    }) as typeof actual.readFileSync,
    // A row's removal the disk refuses, once: the armed fault throws in place of the unlink.
    unlinkSync: (path: string): void => {
      const fault = /[0-9a-f]{32}\.[0-9a-f]{32}\.json$/.test(path) ? seam.unlinkFault : null;
      if (fault !== null) { seam.unlinkFault = null; throw fault; }
      actual.unlinkSync(path);
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
    const p = join(dir, "state", "synced-tree");
    const t1 = new SyncedTree(p);
    t1.set("lar:///a", AT, contentHash("alpha"));
    const t2 = new SyncedTree(p);
    expect(t2.get("lar:///a")).toBe(contentHash("alpha"));
    expect(t2.get("lar:///missing")).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test("delete removes the observation durably", () => {
    const dir = mkdtempSync(join(tmpdir(), "synced-"));
    const p = join(dir, "synced-tree");
    const t = new SyncedTree(p);
    t.set("lar:///a", AT, "h1");
    t.deleteAt("lar:///a", AT);
    expect(new SyncedTree(p).get("lar:///a")).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test("a torn row degrades to never-projected, never throws, and heals on the next agreement", () => {
    const dir = mkdtempSync(join(tmpdir(), "synced-"));
    const p = join(dir, "synced-tree");
    new SyncedTree(p).set("lar:///a", AT, "h1");
    const [name] = rowFiles(p);
    writeFileSync(join(p, name!), "{ torn json", "utf-8");
    const said: string[] = [];
    const warn = console.warn;
    console.warn = (line: unknown) => { said.push(String(line)); };
    let t: SyncedTree;
    try { t = new SyncedTree(p); } finally { console.warn = warn; }
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
    return { dir, p: join(dir, "synced-tree") };
  };

  test("one hash names both sides: a projector write leaves the disk holding the render", () => {
    const { dir, p } = fresh();
    const t = new SyncedTree(p);
    t.set("k", AT, contentHash("render"));
    expect(t.base("k")).toEqual({ path: AT, disk: contentHash("render"), records: contentHash("render") });
    expect(t.get("k")).toBe(contentHash("render"));
    rmSync(dir, { recursive: true, force: true });
  });

  test("a disk standing in another framing pins two hashes, and both survive a reload", () => {
    const { dir, p } = fresh();
    const t = new SyncedTree(p);
    t.set("k", AT, contentHash("disk bytes"), contentHash("the render"));
    expect(t.get("k")).toBe(contentHash("disk bytes"));
    const reopened = new SyncedTree(p);
    expect(reopened.base("k")).toEqual({ path: AT, disk: contentHash("disk bytes"), records: contentHash("the render") });
    expect(reopened.base("missing")).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test("the rename index keys on the disk side, never the records side", () => {
    const { dir, p } = fresh();
    const t = new SyncedTree(p);
    const bag = "lar:///ha.ka.ba/bags/x";
    t.set(syncedTreeKey(bag, "lar:///a"), AT, contentHash("disk bytes"), contentHash("the render"));
    expect(t.renameSourceUri(bag, contentHash("disk bytes"))).toBe("lar:///a");
    expect(t.renameSourceUri(bag, contentHash("the render"))).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test("the rename index follows each set and each removal", () => {
    const { dir, p } = fresh();
    const t = new SyncedTree(p);
    const bag = "lar:///ha.ka.ba/bags/x";
    t.set(syncedTreeKey(bag, "lar:///a"), AT, contentHash("disk bytes"), contentHash("the render"));
    expect(t.renameSourceUri(bag, contentHash("disk bytes"))).toBe("lar:///a");
    expect(t.renameSourceUri(bag, contentHash("the render"))).toBeNull();
    // A second set under the same key drops the earlier disk side from the index.
    t.set(syncedTreeKey(bag, "lar:///a"), AT, contentHash("later bytes"), contentHash("the render"));
    expect(t.renameSourceUri(bag, contentHash("disk bytes"))).toBeNull();
    expect(t.renameSourceUri(bag, contentHash("later bytes"))).toBe("lar:///a");
    t.deleteAt(syncedTreeKey(bag, "lar:///a"), AT);
    expect(t.renameSourceUri(bag, contentHash("later bytes"))).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test("a row in any other shape names no base: that carrier reads as never agreed", () => {
    const { dir, p } = fresh();
    const t0 = new SyncedTree(p);
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
    try { t = new SyncedTree(p); } finally { console.warn = warn; }
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

  test("a `.json` file beside the directory has no part in the tree and draws no word", () => {
    const { dir } = fresh();
    const p = join(dir, "synced-tree");
    const beside = `${p}.json`;
    const bytes = JSON.stringify({ k: { path: AT, disk: "d1", records: "r1" } });
    writeFileSync(beside, bytes, "utf-8");
    const said: string[] = [];
    const warn = console.warn;
    console.warn = (line: unknown) => { said.push(String(line)); };
    let t: SyncedTree;
    try { t = new SyncedTree(p); } finally { console.warn = warn; }
    expect(said).toEqual([]);
    expect(t.size).toBe(0);
    t.set("k", AT, "d2");
    expect(new SyncedTree(p).baseAt("k", AT)).toEqual({ path: AT, disk: "d2", records: "d2" });
    expect(readFileSync(beside, "utf-8")).toBe(bytes);
    rmSync(dir, { recursive: true, force: true });
  });

  test("a file standing at the directory's own path leaves the tree in memory, says so, and stays untouched", () => {
    const { dir } = fresh();
    const p = join(dir, "synced-tree");
    writeFileSync(p, "occupied", "utf-8");
    const said: string[] = [];
    const warn = console.warn;
    console.warn = (line: unknown) => { said.push(String(line)); };
    let t: SyncedTree;
    try { t = new SyncedTree(p); } finally { console.warn = warn; }
    expect(said).toEqual([`[synced-tree] ${p} stands as a file; the tree holds its bases in memory`]);
    t.set("k", AT, "d2");
    expect(t.baseAt("k", AT)).toEqual({ path: AT, disk: "d2", records: "d2" });
    expect(readFileSync(p, "utf-8")).toBe("occupied");
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("synced-tree — the R2 content-addressed rename-index", () => {
  const BAG = "lar:///ha.ka.ba/bags/daemon/notes";
  const OTHER = "lar:///ha.ka.ba/bags/daemon/other";
  const freshTree = () => new SyncedTree(join(mkdtempSync(join(tmpdir(), "synced-")), "synced-tree"));

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
    t.deleteAt(syncedTreeKey(BAG, "lar:///twin.two"), AT);
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
    t.deleteAt(syncedTreeKey(BAG, "lar:///a.b.c"), AT);
    expect(t.renameSourceUri(BAG, h)).toBeNull();
  });

  test("a tagged digest and the RFC spelling of one digest resolve the same carrier; a dash spelling resolves nothing", () => {
    const t = freshTree();
    const hex = "a".repeat(64);
    t.set(syncedTreeKey(BAG, "lar:///a.b.c"), AT, `sha256:${hex}`);
    expect(t.renameSourceUri(BAG, `sha256:${hex}`)).toBe("lar:///a.b.c");
    expect(t.renameSourceUri(BAG, `sha256-${hex}`)).toBeNull();
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
    const p = join(dir, "synced-tree");
    const h = carrierHash("persisted body", undefined);
    const t1 = new SyncedTree(p);
    t1.set(syncedTreeKey(BAG, "lar:///a.b.c"), AT, h);
    const t2 = new SyncedTree(p);                       // cold reload
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
    t.deleteAt(syncedTreeKey(BAG, "lar:///old.name"), AT);
    t.set(syncedTreeKey(BAG, "lar:///new.name"), AT, h);
    expect(t.renameSourceUri(BAG, h)).toBe("lar:///new.name");
    expect(t.get(syncedTreeKey(BAG, "lar:///old.name"))).toBeNull();
    expect(t.get(syncedTreeKey(BAG, "lar:///new.name"))).toBe(h);
  });
});

describe("synced-tree — CONCURRENT WRITERS over one tree (the island-per-worker law)", () => {
  // ONE tree serves EVERY projector in the vessel: the daemon island mirrors
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
    const p = join(dir, "synced-tree");
    const wiki   = new SyncedTree(p);        // the wiki island's projector
    const daemon = new SyncedTree(p);        // the daemon island's projector, same tree

    wiki.set(syncedTreeKey(A, "lar:///a.b.c"), AT, "h-wiki");
    daemon.set(syncedTreeKey(B, "lar:///verbs/x"), AT, "h-daemon");   // opened BEFORE the wiki wrote

    const onDisk = new SyncedTree(p);
    expect(onDisk.get(syncedTreeKey(A, "lar:///a.b.c"))).toBe("h-wiki");
    expect(onDisk.get(syncedTreeKey(B, "lar:///verbs/x"))).toBe("h-daemon");
    rmSync(dir, { recursive: true, force: true });
  });

  test("a delete still lands across writers — it never resurrects from the disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "synced-"));
    const p = join(dir, "synced-tree");
    const seed = new SyncedTree(p);
    seed.set(syncedTreeKey(A, "lar:///gone"), AT, "h1");

    const other = new SyncedTree(p);          // sees lar:///gone at open
    seed.deleteAt(syncedTreeKey(A, "lar:///gone"), AT);
    other.set(syncedTreeKey(B, "lar:///kept"), AT, "h2");   // must not resurrect the deleted key

    const onDisk = new SyncedTree(p);
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
    new SyncedTree(p).set(syncedTreeKey(A, "lar:///seeded"), AT, "h-seed");
    const first  = new SyncedTree(p);
    const second = new SyncedTree(p);
    let fired = 0;
    seam.beforeRename = () => { fired++; second.set(syncedTreeKey(B, "lar:///verbs/x"), AT, "h-second"); };
    first.set(syncedTreeKey(A, "lar:///a.b.c"), AT, "h-first");
    expect(fired).toBe(1);                                     // the window opened once, inside the first writer's write
    // Each writer's temp file stood under its own name: the second landed whole while the first's waited.
    expect(readdirSync(p)).toEqual(rowFiles(p));
    const onDisk = new SyncedTree(p);
    expect(onDisk.get(syncedTreeKey(B, "lar:///verbs/x"))).toBe("h-second");
    expect(onDisk.get(syncedTreeKey(A, "lar:///a.b.c"))).toBe("h-first");
    expect(onDisk.get(syncedTreeKey(A, "lar:///seeded"))).toBe("h-seed");
    // CONTROL: with no second writer in the window a set lands the same way.
    first.set(syncedTreeKey(A, "lar:///later"), AT, "h-later");
    expect(new SyncedTree(p).size).toBe(4);
    rmSync(dir, { recursive: true, force: true });
  });

  test("two writers persisting in the SAME process never collide on the temp file", () => {
    // Islands are worker THREADS — one pid, two SyncedTrees. A pid-keyed temp name is
    // the same name twice; the rename of one can carry the other's half-written bytes.
    const dir = mkdtempSync(join(tmpdir(), "synced-"));
    const p = join(dir, "synced-tree");
    const a = new SyncedTree(p);
    const b = new SyncedTree(p);
    for (let i = 0; i < 40; i++) { a.set(syncedTreeKey(A, `lar:///a${i}`), AT, `ha${i}`); b.set(syncedTreeKey(B, `lar:///b${i}`), AT, `hb${i}`); }
    const onDisk = new SyncedTree(p);
    expect(onDisk.get(syncedTreeKey(A, "lar:///a39"))).toBe("ha39");
    expect(onDisk.get(syncedTreeKey(B, "lar:///b39"))).toBe("hb39");
    expect(onDisk.size).toBe(80);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("a base stands at one path", () => {
  const fresh = (): { dir: string; p: string } => {
    const dir = mkdtempSync(join(tmpdir(), "synced-tree-path-"));
    return { dir, p: join(dir, "synced-tree") };
  };

  test("baseAt answers the base only at the path its agreement stood at, in every spelling of that path", () => {
    const { dir, p } = fresh();
    const t = new SyncedTree(p);
    t.set("k", "/scratch/mirror/a.mem", "d1", "r1");
    expect(t.baseAt("k", "/scratch/mirror/a.mem")).toEqual({ path: "/scratch/mirror/a.mem", disk: "d1", records: "r1" });
    expect(t.baseAt("k", "/scratch/mirror/sub/../a.mem")).not.toBeNull();
    expect(t.baseAt("k", "/scratch/mirror/moved/a.mem")).toBeNull();
    expect(t.baseAt("k", "/scratch/mirror/a.md")).toBeNull();
    expect(t.baseAt("missing", "/scratch/mirror/a.mem")).toBeNull();
    // The path survives a reload.
    expect(new SyncedTree(p).baseAt("k", "/scratch/mirror/a.mem")).not.toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test("a carrier holds one row per path: an agreement at a second path displaces none at the first", () => {
    const { dir, p } = fresh();
    const MIRROR = "/scratch/bags/lares/a.mem", HOLDING = "/scratch/wikis/inbox/a.mem";
    const projector = new SyncedTree(p);
    projector.set("k", MIRROR, "d1", "r1");                    // the projector pins the mirror's base
    const gesture = new SyncedTree(p);
    gesture.set("k", HOLDING, "d2", "r2");                     // the ingest gesture pins the holding file's
    for (const t of [gesture, new SyncedTree(p)]) {
      expect(t.baseAt("k", MIRROR)).toEqual({ path: MIRROR, disk: "d1", records: "r1" });
      expect(t.baseAt("k", HOLDING)).toEqual({ path: HOLDING, disk: "d2", records: "r2" });
      expect(t.bases("k").map((b) => b.path).sort()).toEqual([MIRROR, HOLDING]);
      expect(t.base("k")).toBeNull();                          // several stand: no one base names the carrier
      expect(t.size).toBe(2);
    }
    // CONTROL: a path no agreement stood at still names no base, and one base leaves alone.
    expect(gesture.baseAt("k", "/scratch/bags/lares/moved/a.mem")).toBeNull();
    gesture.deleteAt("k", HOLDING);
    const after = new SyncedTree(p);
    expect(after.baseAt("k", HOLDING)).toBeNull();
    expect(after.base("k")).toEqual({ path: MIRROR, disk: "d1", records: "r1" });
    after.deleteAt("k", MIRROR);
    expect(new SyncedTree(p).size).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  test("reread takes the directory's word: a sibling's rows arrive, and one carrier rereads alone", () => {
    const { dir, p } = fresh();
    const mine = new SyncedTree(p);
    const sibling = new SyncedTree(p);
    mine.set("mine", AT, "m1");
    sibling.set("theirs", AT, "s1");
    expect(mine.base("theirs")).toBeNull();
    mine.reread();
    expect(mine.base("theirs")).toEqual({ path: AT, disk: "s1", records: "s1" });
    expect(mine.base("mine")).toEqual({ path: AT, disk: "m1", records: "m1" });
    const onDisk = new SyncedTree(p);
    expect([onDisk.base("mine")?.disk, onDisk.base("theirs")?.disk, onDisk.size]).toEqual(["m1", "s1", 2]);
    // One carrier's rows reread alone, and the other carriers' rows stand as this instance held them.
    sibling.set("theirs", "/scratch/mirror/b.mem", "s2");
    sibling.set("later", AT, "s3");
    mine.reread("theirs");
    expect(mine.bases("theirs").map((b) => b.disk).sort()).toEqual(["s1", "s2"]);
    expect(mine.base("later")).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test("a tree with no directory holds its bases in memory, persists nothing and arms no timer", () => {
    const armed: unknown[] = [];
    const setTimer = globalThis.setTimeout;
    (globalThis as { setTimeout: unknown }).setTimeout = ((...a: unknown[]) => { armed.push(a); return (setTimer as (...x: unknown[]) => unknown)(...a); });
    try {
      const t = new SyncedTree(null);
      t.set("k", AT, "d1", "r1");
      expect(t.baseAt("k", AT)).toEqual({ path: AT, disk: "d1", records: "r1" });
      t.reread();
      expect(t.size).toBe(1);
      t.deleteAt("k", AT);
      expect(t.base("k")).toBeNull();
    } finally {
      (globalThis as { setTimeout: unknown }).setTimeout = setTimer;
    }
    expect(armed).toEqual([]);
  });
});

describe("an observation rests the moment it gets recorded", () => {
  const K = syncedTreeKey("lar:///ha.ka.ba/bags/lares", "lar:///a.b.c");
  const fresh = (): { dir: string; p: string } => {
    const dir = mkdtempSync(join(tmpdir(), "synced-tree-now-"));
    return { dir, p: join(dir, "synced-tree") };
  };
  /** Run `act` and return what the tree said on `console.warn`. */
  const hearing = (act: () => void): string[] => {
    const said: string[] = [];
    const warn = console.warn;
    console.warn = (line: unknown) => { said.push(String(line)); };
    try { act(); } finally { console.warn = warn; }
    return said;
  };

  test("a set lands its row before it returns: a sibling that opens next reads it", () => {
    const { dir, p } = fresh();
    const projector = new SyncedTree(p);               // as an island builds it: no argument but the directory
    projector.set(K, AT, "d1", "r1");
    expect(rowFiles(p)).toHaveLength(1);
    expect(new SyncedTree(p).baseAt(K, AT)).toEqual({ path: AT, disk: "d1", records: "r1" });
    // CONTROL: a tree with no directory lands nothing.
    new SyncedTree(null).set(K, AT, "d1");
    expect(rowFiles(p)).toHaveLength(1);
    rmSync(dir, { recursive: true, force: true });
  });

  test("a row a sibling removed never returns from another instance's memory", () => {
    const { dir, p } = fresh();
    const projector = new SyncedTree(p);
    projector.set(K, AT, "d1");
    const sibling = new SyncedTree(p);
    expect(sibling.baseAt(K, AT)).not.toBeNull();      // the sibling read the row the projector recorded
    sibling.deleteAt(K, AT);
    expect(rowFiles(p)).toEqual([]);
    // The projector goes on working and holds the row in memory still; nothing of it reaches the disk again.
    projector.set(syncedTreeKey("lar:///ha.ka.ba/bags/lares", "lar:///other"), AT, "d2");
    const onDisk = new SyncedTree(p);
    expect(onDisk.baseAt(K, AT)).toBeNull();
    expect(onDisk.size).toBe(1);
    // The projector reads the directory's word when it asks.
    projector.reread(K);
    expect(projector.baseAt(K, AT)).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test("the later observation of one row stands: a reread answers a sibling's newer base, never this instance's older one", () => {
    const { dir, p } = fresh();
    const projector = new SyncedTree(p);
    projector.set(K, AT, "d-old", "r-old");            // the projector wrote the row
    const gesture = new SyncedTree(p);
    gesture.set(K, AT, "d-new", "r-new");              // a hand edited it and ingested: the newer agreement
    expect(projector.baseAt(K, AT)?.disk).toBe("d-old");
    projector.reread(K);
    expect(projector.baseAt(K, AT)).toEqual({ path: AT, disk: "d-new", records: "r-new" });
    expect(new SyncedTree(p).baseAt(K, AT)).toEqual({ path: AT, disk: "d-new", records: "r-new" });
    // CONTROL: with no sibling in between, a reread answers what this instance recorded.
    projector.set(K, AT, "d-newest");
    projector.reread(K);
    expect(projector.baseAt(K, AT)?.disk).toBe("d-newest");
    rmSync(dir, { recursive: true, force: true });
  });

  test("a removal reaches a row this instance never read", () => {
    const { dir, p } = fresh();
    const early = new SyncedTree(p);                    // opens on an empty directory
    const sibling = new SyncedTree(p);
    sibling.set(K, AT, "d1");
    sibling.set(K, "/scratch/holding/a.mem", "d2");
    expect(rowFiles(p)).toHaveLength(2);
    expect(early.baseAt(K, AT)).toBeNull();
    early.deleteAt(K, AT);
    const onDisk = new SyncedTree(p);
    expect(onDisk.baseAt(K, AT)).toBeNull();
    // CONTROL: the carrier's base at another path stays.
    expect(onDisk.baseAt(K, "/scratch/holding/a.mem")).not.toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test("a removal the disk refuses gets named, throws nothing, and leaves the row for a reader to meet", () => {
    const { dir, p } = fresh();
    const t = new SyncedTree(p);
    t.set(K, AT, "d1");
    const [name] = rowFiles(p);
    seam.unlinkFault = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
    const said = hearing(() => { t.deleteAt(K, AT); });
    expect(said).toEqual([`[synced-tree] the disk refused to remove row ${join(p, name!)} (EACCES); the row stays, and the carrier keeps that base`]);
    expect(t.refusals).toBe(1);
    // The directory's word stands: the row rests on disk, so this instance holds it still, as every reader does.
    expect(t.baseAt(K, AT)).toEqual({ path: AT, disk: "d1", records: "d1" });
    expect(new SyncedTree(p).baseAt(K, AT)).not.toBeNull();
    // A row this instance never read, whose removal the disk refuses: the instance reads it back and holds it.
    const early = new SyncedTree(p);
    const HELD = "/scratch/holding/a.mem";
    new SyncedTree(p).set(K, HELD, "d7", "r7");
    expect(early.baseAt(K, HELD)).toBeNull();
    seam.unlinkFault = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
    hearing(() => { early.deleteAt(K, HELD); });
    expect(early.baseAt(K, HELD)).toEqual({ path: HELD, disk: "d7", records: "r7" });
    new SyncedTree(p).deleteAt(K, HELD);
    // CONTROL: with no fault the removal lands, and a row that already left raises no word.
    expect(hearing(() => { t.deleteAt(K, AT); t.deleteAt(K, AT); })).toEqual([]);
    expect(rowFiles(p)).toEqual([]);
    expect(t.refusals).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  test("a write the disk refuses gets named, throws nothing, leaves no temp file, and the directory's word stands", () => {
    const { dir, p } = fresh();
    const t = new SyncedTree(p);
    t.set(K, AT, "d0", "r0");                           // the row stands at an earlier agreement
    seam.beforeRename = () => { throw Object.assign(new Error("EIO: i/o error"), { code: "EIO" }); };
    const said = hearing(() => { t.set(K, AT, "d1", "r1"); });
    expect(said).toHaveLength(1);
    expect(said[0]).toMatch(/^\[synced-tree\] the disk refused to write row .*\(EIO\); the carrier keeps the base the directory holds, and the next agreement pins anew$/);
    expect(t.refusals).toBe(1);
    expect(readdirSync(p)).toEqual(rowFiles(p));        // no temp file stays behind
    // This instance answers what every reader meets: the earlier base, so a gate that weighs the carrier
    // finds the base behind and pins anew. An instance that kept `d1` in memory would call the carrier pinned.
    expect(t.baseAt(K, AT)).toEqual({ path: AT, disk: "d0", records: "r0" });
    expect(new SyncedTree(p).baseAt(K, AT)).toEqual({ path: AT, disk: "d0", records: "r0" });
    // A sibling moved the row since this instance read it, and this instance's own write gets refused: it
    // answers the sibling's row, never the older one it held.
    new SyncedTree(p).set(K, AT, "d-sibling", "r-sibling");
    seam.beforeRename = () => { throw Object.assign(new Error("EIO: i/o error"), { code: "EIO" }); };
    hearing(() => { t.set(K, AT, "d2", "r2"); });
    expect(t.baseAt(K, AT)).toEqual({ path: AT, disk: "d-sibling", records: "r-sibling" });
    t.set(K, AT, "d0", "r0");
    // A refused FIRST agreement rests nowhere.
    seam.beforeRename = () => { throw Object.assign(new Error("ENOSPC: no space"), { code: "ENOSPC" }); };
    expect(hearing(() => { t.set(K, "/scratch/mirror/first.mem", "d5"); })).toEqual([]);   // the second refusal counts and stays quiet
    expect(t.refusals).toBe(3);
    expect(t.baseAt(K, "/scratch/mirror/first.mem")).toBeNull();
    // The disk refuses the write AND the read back: the instance keeps the row it held before the act.
    seam.beforeRename = () => { throw Object.assign(new Error("EIO: i/o error"), { code: "EIO" }); };
    seam.readFault = Object.assign(new Error("EIO: i/o error"), { code: "EIO" });
    hearing(() => { t.set(K, AT, "d3", "r3"); });
    expect(seam.readFault).toBeNull();                  // the read back ran, and met the fault
    expect(t.baseAt(K, AT)).toEqual({ path: AT, disk: "d0", records: "r0" });
    expect(t.refusals).toBe(4);
    // CONTROL: the next agreement lands, and nothing wrote the refused rows behind anyone's back.
    expect(hearing(() => { t.set(K, AT, "d1", "r1"); })).toEqual([]);
    expect(rowFiles(p)).toHaveLength(1);
    expect(new SyncedTree(p).baseAt(K, AT)).toEqual({ path: AT, disk: "d1", records: "r1" });
    rmSync(dir, { recursive: true, force: true });
  });
});
