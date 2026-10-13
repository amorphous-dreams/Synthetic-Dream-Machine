/**
 * synced-tree — vectors for the Confluence merge base: atomic persistence, corrupt
 * recovery, and the projector's hash-gate contract.
 */

import { describe, test, expect } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SyncedTree, contentHash, syncedTreeKey } from "../src/synced-tree.js";
import { carrierHash } from "@lararium/mesh";

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

  test("corrupt tree degrades to never-projected, never throws", () => {
    const dir = mkdtempSync(join(tmpdir(), "synced-"));
    const p = join(dir, "synced-tree.json");
    writeFileSync(p, "{ torn json", "utf-8");
    const t = new SyncedTree(p, 0);
    expect(t.size).toBe(0);
    expect(t.get("lar:///a")).toBeNull();
    t.set("lar:///a", AT, "h1");                       // heals by re-persisting
    expect(JSON.parse(readFileSync(p, "utf-8"))["lar:///a"]).toEqual({ path: AT, disk: "h1", records: "h1" });
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
    writeFileSync(p, JSON.stringify({
      whole: { path: AT, disk: "d1", records: "r1" },
      "two sides and no path": { disk: "d0", records: "r0" },
      "a bare string": "h1",
      "one side only": { disk: "d2" },
      "an empty side": { disk: "d3", records: "" },
      "an array": ["d4", "r4"],
    }), "utf-8");
    const said: string[] = [];
    const warn = console.warn;
    console.warn = (line: unknown) => { said.push(String(line)); };
    let t: SyncedTree;
    try { t = new SyncedTree(p, 0); } finally { console.warn = warn; }
    // The forgotten bases speak once, by count and by file.
    expect(said).toEqual([`[synced-tree] 5 row(s) of ${p} name no base in this tree's shape; each such carrier reads as never agreed`]);
    expect(t.size).toBe(1);
    expect(t.base("whole")).toEqual({ path: AT, disk: "d1", records: "r1" });
    for (const k of ["two sides and no path", "a bare string", "one side only", "an empty side", "an array"]) expect(t.base(k)).toBeNull();
    // A write keeps the readable row and leaves the unreadable ones behind.
    t.set("fresh", AT, "d9");
    expect(Object.keys(JSON.parse(readFileSync(p, "utf-8"))).sort()).toEqual(["fresh", "whole"]);
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
    // the on-disk shape stays the flat primary map — no index leaks into the file
    const raw = JSON.parse(readFileSync(p, "utf-8")) as Record<string, string>;
    expect(Object.keys(raw)).toEqual([syncedTreeKey(BAG, "lar:///a.b.c")]);
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
    // The path survives a reload, and a later agreement at another path moves it.
    const reopened = new SyncedTree(p, 0);
    expect(reopened.baseAt("k", "/scratch/mirror/a.mem")).not.toBeNull();
    reopened.set("k", "/scratch/mirror/moved/a.mem", "d2");
    expect(reopened.baseAt("k", "/scratch/mirror/a.mem")).toBeNull();
    expect(reopened.baseAt("k", "/scratch/mirror/moved/a.mem")).toEqual({ path: "/scratch/mirror/moved/a.mem", disk: "d2", records: "d2" });
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
    expect(Object.keys(JSON.parse(readFileSync(p, "utf-8"))).sort()).toEqual(["mine", "theirs"]);
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
