/**
 * compaction-by-count — a document's incremental chunks stay bounded by count and by bytes, whatever its snapshot weighs.
 *
 * Measured on a live hearth (vessel-heat-2026-11-26, row 3): the vessel's control document rested a 30 MB snapshot beside
 * 4,396 incremental chunks (12 MB). The engine compacts once incremental bytes reach the snapshot's, so a heavy snapshot
 * leaves thousands of small chunks to seal, open and replay. The control below measures that policy on the same store
 * fixture the resolve suite stands (`MemoryStore`); the laws measure the cure (`compactingStorage`). No clock decides.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { compactingStorage } from "../src/compacting-storage.js";

class MemoryStore implements StorageAdapterInterface {
  readonly rows = new Map<string, { key: StorageKey; data: Uint8Array }>();
  async load(key: StorageKey) { return this.rows.get(key.join("\u0000"))?.data; }
  async save(key: StorageKey, data: Uint8Array) { this.rows.set(key.join("\u0000"), { key: [...key], data }); }
  async remove(key: StorageKey) { this.rows.delete(key.join("\u0000")); }
  async loadRange(prefix: StorageKey): Promise<Chunk[]> { return [...this.rows.values()].filter((r) => prefix.every((p, i) => r.key[i] === p)); }
  async removeRange(prefix: StorageKey) { for (const [name, r] of [...this.rows]) if (prefix.every((p, i) => r.key[i] === p)) this.rows.delete(name); }
  chunks(documentId: string, role: "snapshot" | "incremental"): number {
    return [...this.rows.values()].filter((r) => r.key[0] === documentId && r.key[1] === role).length;
  }
}

/** A store that refuses every snapshot once `refuseSnapshots` stands (a sealed rest whose seal refused). */
class RefusingStore extends MemoryStore {
  refuseSnapshots = false;
  override async save(key: StorageKey, data: Uint8Array) {
    if (this.refuseSnapshots && key[1] === "snapshot") throw new Error("snapshot-refused");
    return super.save(key, data);
  }
}

type Ledger = { big: string; n: Record<string, string> };

const repos: Repo[] = [];
afterEach(async () => { for (const repo of repos.splice(0)) await repo.shutdown().catch(() => {}); });

/** A heavy snapshot (64 KiB of text no deflate shrinks) the engine's own policy weighs every incremental against. */
const heavy = (): string => Array.from({ length: 4096 }, (_, i) => (Math.imul(i + 1, 2654435761) >>> 0).toString(36).padStart(16, "0")).join("");

function stand(storage: StorageAdapterInterface): Repo {
  const repo = new Repo({ storage, network: [] });
  repos.push(repo);
  return repo;
}

/** Wrap `inner` beneath a Repo, the live document read off that Repo's handle table (as the vessel wires it). */
function standCompacting(inner: StorageAdapterInterface, opts: { maxIncrementals?: number; maxIncrementalBytes?: number; faults?: unknown[] } = {}) {
  let repo: Repo | null = null;
  const storage = compactingStorage(inner, {
    liveDoc: (documentId) => {
      const handle = (repo!.handles as Record<string, { isReady(): boolean; doc(): unknown } | undefined>)[documentId];
      return handle?.isReady() ? handle.doc() as never : null;
    },
    ...(opts.maxIncrementals !== undefined ? { maxIncrementals: opts.maxIncrementals } : {}),
    ...(opts.maxIncrementalBytes !== undefined ? { maxIncrementalBytes: opts.maxIncrementalBytes } : {}),
    onFault: (_documentId, error) => { opts.faults?.push(error); },
  });
  repo = stand(storage);
  return { repo, storage };
}

/** Write `count` small changes, each flushed as its own save: the door's outcome-per-call shape. */
async function write(repo: Repo, count: number) {
  const handle = repo.create<Ledger>({ big: heavy(), n: {} });
  await repo.flush();
  for (let i = 0; i < count; i++) {
    handle.change((d) => { d.n[`outcome-${i}`] = `answer ${i}`; });
    await repo.flush();
  }
  return handle;
}

describe("compaction by count and bytes", () => {
  test("CONTROL: the engine's own policy leaves every small chunk standing beside a heavy snapshot", async () => {
    const rows = new MemoryStore();
    const handle = await write(stand(rows), 80);
    expect(rows.chunks(handle.documentId, "snapshot")).toBe(1);
    expect(rows.chunks(handle.documentId, "incremental")).toBe(80);
  });

  test("LAW: a document's incremental chunks never pass the count, and a fresh Repo reads every change", async () => {
    const rows = new MemoryStore();
    const { repo } = standCompacting(rows, { maxIncrementals: 32 });
    const handle = await write(repo, 80);
    expect(rows.chunks(handle.documentId, "incremental")).toBeLessThan(32);
    expect(rows.chunks(handle.documentId, "snapshot")).toBe(1);
    const reread = await stand(rows).find<Ledger>(handle.url);
    expect(Object.keys(reread.doc().n)).toHaveLength(80);
    expect(reread.doc().n["outcome-79"]).toBe("answer 79");
  });

  test("LAW: incremental bytes past the bound compact, whatever the count", async () => {
    const rows = new MemoryStore();
    const { repo } = standCompacting(rows, { maxIncrementals: 1_000_000, maxIncrementalBytes: 2048 });
    const handle = await write(repo, 80);
    const bytes = [...rows.rows.values()].filter((r) => r.key[0] === handle.documentId && r.key[1] === "incremental").reduce((n, r) => n + r.data.length, 0);
    expect(bytes).toBeLessThan(2048);
    expect(rows.chunks(handle.documentId, "incremental")).toBeLessThan(80);
  });

  test("LAW: a chunk the Repo never received stays at rest through a compaction", async () => {
    const rows = new MemoryStore();
    const { repo } = standCompacting(rows, { maxIncrementals: 16 });
    const handle = repo.create<Ledger>({ big: heavy(), n: {} });
    await repo.flush();
    const planted: StorageKey = [handle.documentId, "incremental", "planted-by-another-hand"];
    await rows.save(planted, new Uint8Array([1, 2, 3]));
    for (let i = 0; i < 40; i++) { handle.change((d) => { d.n[`k${i}`] = String(i); }); await repo.flush(); }
    expect(rows.chunks(handle.documentId, "incremental")).toBeLessThan(17);
    expect(await rows.load(planted)).toEqual(new Uint8Array([1, 2, 3]));
  });

  test("LAW: a snapshot the rest refuses removes nothing, and the fault is heard", async () => {
    const rows = new RefusingStore();
    const faults: unknown[] = [];
    const { repo } = standCompacting(rows, { maxIncrementals: 16, faults });
    const handle = repo.create<Ledger>({ big: heavy(), n: {} });
    await repo.flush();
    rows.refuseSnapshots = true;
    for (let i = 0; i < 20; i++) { handle.change((d) => { d.n[`k${i}`] = String(i); }); await repo.flush(); }
    expect(faults.length).toBeGreaterThan(0);
    expect(rows.chunks(handle.documentId, "incremental")).toBe(20);
    expect(rows.chunks(handle.documentId, "snapshot")).toBe(1);
  });

  test("WELD: the node vessel's Repo stands on the compacting storage", () => {
    const vessel = readFileSync(fileURLToPath(new URL("../../lararium-node/src/open-node-vessel.ts", import.meta.url)), "utf8");
    expect(vessel, "the vessel's Repo saves straight to its wire store, so a heavy snapshot leaves its chunks uncompacted").toMatch(/const repo = new Repo\(\{[^]*?storage: compactingStorage\(wire\.storage, \{/);
  });
});
