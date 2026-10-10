/**
 * L5 — the store's persistence writes land durably and atomically. `atomicWriteFile` (async)
 * writes bytes and strands no temp; `DurableNodeFSStorageAdapter` overrides save() to route
 * through it while keeping the base's write-through read cache coherent — a load-after-save
 * (and a load-after-overwrite) returns the FRESH bytes, never a torn or stale read. A temp a dead writer
 * stranded never reads back as a chunk: the opener ignores it and names it.
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
