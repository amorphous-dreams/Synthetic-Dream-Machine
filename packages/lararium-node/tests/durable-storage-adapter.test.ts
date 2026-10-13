/**
 * L5 — the store's persistence writes land durably and atomically. `atomicWriteFile` (async)
 * writes bytes and strands no temp; `DurableNodeFSStorageAdapter` overrides save() to route
 * through it — a load-after-save (and a load-after-overwrite) returns the FRESH bytes, never a torn or
 * stale read. A save reads back from the moment it is called and for as long as it stays in flight; once it
 * settles the adapter holds nothing and every read follows the disk. A temp a dead writer stranded never
 * reads back as a chunk: the opener ignores it and names it.
 */
import { promises as fsp, mkdtempSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";

import { atomicWriteFile } from "../src/fs-atomic.js";
import { DurableNodeFSStorageAdapter } from "../src/durable-storage-adapter.js";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

describe("atomicWriteFile (async)", () => {
  test("writes the bytes and leaves no temp behind", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-atomic-"));
    const target = join(dir, "chunk.bin");
    await atomicWriteFile(target, Uint8Array.from([1, 2, 3, 4]));
    expect([...readFileSync(target)]).toEqual([1, 2, 3, 4]);
    expect(readdirSync(dir).filter((n) => n.includes(".tmp"))).toHaveLength(0);
  });

  test("overwrites atomically (whole new bytes, no tear)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-atomic-"));
    const target = join(dir, "chunk.bin");
    await atomicWriteFile(target, Uint8Array.from([9, 9]));
    await atomicWriteFile(target, Uint8Array.from([7, 7, 7]));
    expect([...readFileSync(target)]).toEqual([7, 7, 7]);
  });
});

const KEY = ["44u4T4NwgkkCoBdze4gyY8pFSNQC", "snapshot", "head0"];

/**
 * Hold every file sync in this process until `release`: a save then stands in flight, staged in its temp and not
 * yet renamed. `staged` resolves when the first sync is reached.
 */
async function holdSync(): Promise<{ staged: Promise<void>; release: () => void }> {
  const probeDir = mkdtempSync(join(tmpdir(), "lares-hold-"));
  const probe = await fsp.open(join(probeDir, ".probe"), "w");
  const proto = Object.getPrototypeOf(probe) as { sync: (this: unknown) => Promise<void> };
  await probe.close();
  rmSync(probeDir, { recursive: true, force: true });
  const realSync = proto.sync;
  let open!: () => void;
  const gate = new Promise<void>((r) => { open = r; });
  let reached!: () => void;
  const staged = new Promise<void>((r) => { reached = r; });
  proto.sync = async function (this: unknown): Promise<void> { reached(); await gate; return realSync.call(this); };
  return { staged, release: () => { proto.sync = realSync; open(); } };
}

describe("DurableNodeFSStorageAdapter", () => {

  test("save lands on disk and load returns it (round-trip)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-durable-"));
    const a = new DurableNodeFSStorageAdapter(dir);
    const bytes = Uint8Array.from([0x85, 0x6f, 0x4a, 0x83, 1, 2, 3]);
    await a.save(KEY, bytes);
    const back = await a.load(KEY);
    expect(back && [...back]).toEqual([...bytes]);
    // shard path exists on disk: dir / id[:2] / id[2:] / snapshot / head0
    const shard = join(dir, KEY[0]!.slice(0, 2), KEY[0]!.slice(2), "snapshot", "head0");
    expect(existsSync(shard)).toBe(true);
  });

  test("load-after-overwrite returns FRESH bytes (cache stays coherent, not stale)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-durable-"));
    const a = new DurableNodeFSStorageAdapter(dir);
    await a.save(KEY, Uint8Array.from([1, 1, 1]));
    await a.load(KEY);                                // prime the read cache with the old bytes
    await a.save(KEY, Uint8Array.from([2, 2]));       // overwrite
    const back = await a.load(KEY);
    expect(back && [...back]).toEqual([2, 2]);        // fresh, not the primed [1,1,1]
  });

  test("two saves of one key in flight together both land, the later call's bytes last", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-durable-"));
    const a = new DurableNodeFSStorageAdapter(dir);
    // The earlier save carries the larger chunk, so a write that did not wait would land it last.
    await Promise.all([a.save(KEY, new Uint8Array(4 * 1024 * 1024).fill(1)), a.save(KEY, Uint8Array.from([2, 2, 2]))]);
    const shard = join(dir, KEY[0]!.slice(0, 2), KEY[0]!.slice(2), "snapshot", "head0");
    expect([...readFileSync(shard)]).toEqual([2, 2, 2]);
  });

  test("two adapters on one store saving one key together both land — no shared temp renames the other away", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-durable-"));
    const a = new DurableNodeFSStorageAdapter(dir);
    const b = new DurableNodeFSStorageAdapter(dir);
    await Promise.all([a.save(KEY, Uint8Array.from([1, 1])), b.save(KEY, Uint8Array.from([2, 2, 2]))]);
    const shard = join(dir, KEY[0]!.slice(0, 2), KEY[0]!.slice(2), "snapshot", "head0");
    expect([[1, 1], [2, 2, 2]]).toContainEqual([...readFileSync(shard)]);
    expect(readdirSync(join(dir, KEY[0]!.slice(0, 2), KEY[0]!.slice(2), "snapshot")).filter((n) => n.includes(".tmp"))).toHaveLength(0);
  });

  test("a save reads back while it is still in flight: load returns it and loadRange lists it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-durable-"));
    const held = await holdSync();
    try {
      const a = new DurableNodeFSStorageAdapter(dir);
      const saving = a.save(KEY, Uint8Array.from([4, 4, 4, 4]));
      await held.staged;
      // The known positive: the chunk has NOT reached its name on disk, so only the adapter can answer.
      const shard = join(dir, KEY[0]!.slice(0, 2), KEY[0]!.slice(2), "snapshot", "head0");
      expect(existsSync(shard)).toBe(false);
      const back = await a.load(KEY);
      const listed = await a.loadRange([KEY[0]!]);
      held.release();
      await saving;
      expect(back && [...back]).toEqual([4, 4, 4, 4]);
      expect(listed.map((c) => ({ key: c.key, data: c.data && [...c.data] }))).toEqual([{ key: KEY, data: [4, 4, 4, 4] }]);
    } finally { held.release(); rmSync(dir, { recursive: true, force: true }); }
  });

  test("once a save settles the adapter holds nothing: load and loadRange follow the disk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-durable-"));
    try {
      const a = new DurableNodeFSStorageAdapter(dir);
      await a.save(KEY, Uint8Array.from([1, 1, 1]));
      const back = await a.load(KEY);
      expect(back && [...back]).toEqual([1, 1, 1]);                 // CONTROL: the settled save reads back
      // Another holder of the store moves the chunk on disk; a held copy would answer the old bytes.
      writeFileSync(join(dir, KEY[0]!.slice(0, 2), KEY[0]!.slice(2), "snapshot", "head0"), Uint8Array.from([8, 8]));
      const after = await a.load(KEY);
      expect(after && [...after]).toEqual([8, 8]);
      const listed = await a.loadRange([KEY[0]!]);
      expect(listed.map((c) => c.data && [...c.data])).toEqual([[8, 8]]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("a remove while the key's save is in flight drops the held bytes, and the key stays removed once that save settles", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-durable-"));
    const held = await holdSync();
    try {
      const a = new DurableNodeFSStorageAdapter(dir);
      const saving = a.save(KEY, Uint8Array.from([6]));
      await held.staged;
      const before = await a.load(KEY);
      expect(before && [...before]).toEqual([6]);                   // CONTROL: held while in flight
      // The remove joins the save in flight and unlinks after it, so it settles only once the save has.
      const removing = a.remove(KEY);
      expect(await a.load(KEY), "the held bytes leave at the remove call").toBeUndefined();
      held.release();
      await saving;
      await removing;
      expect(await a.load(KEY), "a removed key stays removed once its in-flight save settles").toBeUndefined();
      expect(await new DurableNodeFSStorageAdapter(dir).load(KEY), "and a fresh opener reads no chunk").toBeUndefined();
      // CONTROL: a save made after the remove lands and reads back.
      await a.save(KEY, Uint8Array.from([7, 7]));
      const after = await new DurableNodeFSStorageAdapter(dir).load(KEY);
      expect(after && [...after]).toEqual([7, 7]);
    } finally { held.release(); rmSync(dir, { recursive: true, force: true }); }
  });

  test("a removeRange while a save under the prefix is in flight drops the held bytes and the key stays removed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-durable-"));
    const held = await holdSync();
    try {
      const a = new DurableNodeFSStorageAdapter(dir);
      const saving = a.save(KEY, Uint8Array.from([6, 6]));
      await held.staged;
      const removing = a.removeRange([KEY[0]!]);
      expect(await a.load(KEY), "the held bytes leave at the removeRange call").toBeUndefined();
      expect(await a.loadRange([KEY[0]!]), "and the range lists no held chunk").toEqual([]);
      held.release();
      await saving;
      await removing;
      expect(await a.loadRange([KEY[0]!])).toEqual([]);
      expect(await new DurableNodeFSStorageAdapter(dir).load(KEY)).toBeUndefined();
    } finally { held.release(); rmSync(dir, { recursive: true, force: true }); }
  });

  test("a save of a fresh key issued while a removeRange over its prefix runs lands after the removal", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-durable-"));
    const held = await holdSync();
    try {
      const a = new DurableNodeFSStorageAdapter(dir);
      const OTHER = [KEY[0]!, "snapshot", "head1"];
      const saving = a.save(KEY, Uint8Array.from([6]));
      await held.staged;
      // The range removal waits on the save in flight; a save of ANOTHER key under the prefix arrives meanwhile.
      const removing = a.removeRange([KEY[0]!]);
      const later = a.save(OTHER, Uint8Array.from([9, 9]));
      held.release();
      await Promise.all([saving, removing, later]);
      expect(await a.load(KEY), "the key in flight at the removal stays removed").toBeUndefined();
      const back = await new DurableNodeFSStorageAdapter(dir).load(OTHER);
      expect(back && [...back], "the later save stands, landed after the range unlink").toEqual([9, 9]);
    } finally { held.release(); rmSync(dir, { recursive: true, force: true }); }
  });

  test("the holding outlives the first of two saves in flight: a read answers the later save's bytes until it settles", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-durable-"));
    // The first file sync passes; every later one waits, so the second save stands in flight after the first settled.
    const probe = await fsp.open(join(dir, ".probe"), "w");
    const proto = Object.getPrototypeOf(probe) as { sync: (this: unknown) => Promise<void> };
    await probe.close();
    rmSync(join(dir, ".probe"));
    const realSync = proto.sync;
    let open!: () => void;
    const gate = new Promise<void>((r) => { open = r; });
    let reached!: () => void;
    const secondStaged = new Promise<void>((r) => { reached = r; });
    let syncs = 0;
    let holdAfter = Number.POSITIVE_INFINITY;
    proto.sync = async function (this: unknown): Promise<void> { if (++syncs > holdAfter) { reached(); await gate; } return realSync.call(this); };
    try {
      const a = new DurableNodeFSStorageAdapter(dir);
      // One save of another key counts the file syncs a save makes; the gate then holds every sync past the first save's.
      await a.save([KEY[0]!, "snapshot", "counted"], Uint8Array.from([0]));
      holdAfter = syncs * 2;
      const first = a.save(KEY, Uint8Array.from([1]));
      const second = a.save(KEY, Uint8Array.from([2, 2]));
      await first;
      await secondStaged;
      // The known positive: the disk holds the first save's bytes while the second waits on its sync.
      const shard = join(dir, KEY[0]!.slice(0, 2), KEY[0]!.slice(2), "snapshot", "head0");
      expect([...readFileSync(shard)]).toEqual([1]);
      const back = await a.load(KEY);
      expect(back && [...back], "the adapter answers the save still in flight").toEqual([2, 2]);
      proto.sync = realSync;
      open();
      await second;
      expect([...readFileSync(shard)]).toEqual([2, 2]);
    } finally { proto.sync = realSync; open(); rmSync(dir, { recursive: true, force: true }); }
  });

  test("strands no temp file in the shard dir after a save", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-durable-"));
    const a = new DurableNodeFSStorageAdapter(dir);
    await a.save(KEY, Uint8Array.from([5]));
    const shardDir = join(dir, KEY[0]!.slice(0, 2), KEY[0]!.slice(2), "snapshot");
    expect(readdirSync(shardDir).filter((n) => n.includes(".tmp"))).toHaveLength(0);
  });
});

/**
 * A PROCESS THAT DIES MID-WRITE LEAVES ITS TEMP, and the next opener reads around it.
 *
 * The child runs the real `atomicWriteFile` into a stored document's chunk directory and dies by SIGKILL after half
 * the chunk reached the temp — no cleanup runs, exactly as a force-exit or a supervisor's kill leaves it. The next
 * opener's `loadRange` then lists that temp beside the chunks.
 */
describe("a stranded temp after a death mid-write", () => {
  const DEATH = `
    import { promises as fsp } from "node:fs";
    const [, , modPath, target] = process.argv;
    const probe = await fsp.open(target + ".probe", "w");
    const proto = Object.getPrototypeOf(probe);
    await probe.close();
    await fsp.rm(target + ".probe");
    const write = proto.writeFile;
    proto.writeFile = async function (data) {
      await write.call(this, data.subarray(0, Math.max(1, data.length >> 1)));
      process.kill(process.pid, "SIGKILL");
      await new Promise(() => {});
    };
    const { atomicWriteFile } = await import(modPath);
    await atomicWriteFile(target, new Uint8Array(4096).fill(7));
  `;

  /** Store one document under `adapter`, then kill a writer mid-chunk beside its chunks. Returns the doc and the temp. */
  async function strandTemp(dir: string): Promise<{ url: AutomergeUrl; docId: string; temp: string }> {
    const repo = new Repo({ storage: new DurableNodeFSStorageAdapter(dir) });
    const h = repo.create<{ text: string }>({ text: "kept" });
    h.change((d) => { d.text = "kept, and changed"; });
    await repo.flush();
    await repo.shutdown();
    const docId = h.documentId as string;
    const chunkDir = filesUnder(join(dir, docId.slice(0, 2), docId.slice(2)))[0]!.replace(/\/[^/]+$/, "");
    const script = join(dir, "die-mid-write.mjs");
    writeFileSync(script, DEATH);
    const target = join(chunkDir, "f".repeat(64));
    const run = spawnSync(process.execPath, ["--import", "tsx", script, join(SRC, "fs-atomic.ts"), target], { encoding: "utf8", timeout: 60_000 });
    expect(run.signal).toBe("SIGKILL");
    rmSync(script);
    const temps = readdirSync(chunkDir).filter((n) => n.endsWith(".tmp"));
    expect(temps).toHaveLength(1);
    return { url: h.url, docId, temp: join(chunkDir, temps[0]!) };
  }

  test("RED: the next opener's loadRange never hands the temp back as a chunk, and names it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-stranded-"));
    try {
      const { docId, temp } = await strandTemp(dir);
      const named: string[] = [];
      const a = new DurableNodeFSStorageAdapter(dir, { onStrandedTemp: (p) => named.push(p) });
      const keys = (await a.loadRange([docId])).map((c) => c.key.join("/"));
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.filter((k) => k.endsWith(".tmp"))).toEqual([]);
      expect(named).toEqual([temp]);
      expect(await a.load([docId, ...temp.split("/").slice(-2)])).toBeUndefined();
      // The opener ignores the temp; it never removes bytes it did not write.
      expect(existsSync(temp)).toBe(true);
      // And the document opens whole over it.
      const repo = new Repo({ storage: new DurableNodeFSStorageAdapter(dir, { onStrandedTemp: () => { /* named above */ } }) });
      const h = await repo.find<{ text: string }>(`automerge:${docId}` as AutomergeUrl);
      expect(h.doc().text).toBe("kept, and changed");
      await repo.shutdown();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("CONTROL (planted known positive): the stock adapter lists the same temp as a chunk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-stranded-"));
    try {
      const { docId, temp } = await strandTemp(dir);
      const keys = (await new NodeFSStorageAdapter(dir).loadRange([docId])).map((c) => c.key[c.key.length - 1]);
      expect(keys).toContain(temp.split("/").pop());
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("CONTROL: a save held in flight in this process lists no stranded temp", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-stranded-"));
    const probe = await fsp.open(join(dir, ".probe"), "w");
    const proto = Object.getPrototypeOf(probe) as { sync: (this: unknown) => Promise<void> };
    await probe.close();
    const realSync = proto.sync;
    let open!: () => void;
    const gate = new Promise<void>((r) => { open = r; });
    let staged!: () => void;
    const inFlight = new Promise<void>((r) => { staged = r; });
    try {
      const named: string[] = [];
      const a = new DurableNodeFSStorageAdapter(dir, { onStrandedTemp: (p) => named.push(p) });
      await a.save(KEY, Uint8Array.from([1]));
      proto.sync = async function (this: unknown): Promise<void> { staged(); await gate; return realSync.call(this); };
      const saving = a.save(KEY, Uint8Array.from([3, 3, 3]));
      await inFlight;
      const shardDir = join(dir, KEY[0]!.slice(0, 2), KEY[0]!.slice(2), "snapshot");
      // The known positive: the temp stands on disk while the save waits on its sync.
      expect(readdirSync(shardDir).filter((n) => n.endsWith(".tmp"))).toHaveLength(1);
      const listed = await a.loadRange([KEY[0]!]);
      proto.sync = realSync;
      open();
      await saving;
      expect(listed.map((c) => c.key[c.key.length - 1]).filter((k) => k!.endsWith(".tmp"))).toEqual([]);
      expect(named).toEqual([]);
    } finally { proto.sync = realSync; open(); rmSync(dir, { recursive: true, force: true }); }
  });
});

/** Every file under `root`, by path. */
function filesUnder(root: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(root)) {
    const p = join(root, name);
    if (statSync(p).isDirectory()) out.push(...filesUnder(p)); else out.push(p);
  }
  return out;
}

describe("a holder closes its adapter before it releases the store", () => {
  const files = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir, { recursive: true }).map(String).filter((n) => statSync(join(dir, n)).isFile()).sort() : []);

  test("RED: a save that arrives after the close lands no byte and no temp, and counts as late", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-durable-close-"));
    const adapter = new DurableNodeFSStorageAdapter(dir);
    await adapter.save(["abcdef", "snapshot", "one"], Uint8Array.from([1]));
    await adapter.close();
    const before = files(dir);
    await adapter.save(["abcdef", "snapshot", "two"], Uint8Array.from([2]));
    await adapter.remove(["abcdef", "snapshot", "one"]);
    await adapter.removeRange(["abcdef"]);
    expect(files(dir)).toEqual(before);
    expect(adapter.lateWrites).toBe(3);
    // CONTROL: an adapter nobody closed lands the same save.
    const open = new DurableNodeFSStorageAdapter(dir);
    await open.save(["abcdef", "snapshot", "two"], Uint8Array.from([2]));
    expect(files(dir).length).toBe(before.length + 1);
    expect(open.lateWrites).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  test("the close resolves only once a save already issued has landed whole", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lares-durable-close-"));
    const adapter = new DurableNodeFSStorageAdapter(dir);
    const big = new Uint8Array(4 * 1024 * 1024).fill(7);
    const saving = adapter.save(["abcdef", "snapshot", "big"], big);   // issued, unawaited
    await adapter.close();
    // The close's own answer names the landing: the whole file stands and no temp does, before `saving` gets read.
    expect(files(dir).filter((n) => n.includes(".tmp"))).toEqual([]);
    expect(statSync(join(dir, "ab", "cdef", "snapshot", "big")).size).toBe(big.length);
    await saving;
    rmSync(dir, { recursive: true, force: true });
  });
});
