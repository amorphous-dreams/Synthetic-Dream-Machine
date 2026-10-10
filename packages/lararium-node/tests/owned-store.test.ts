/**
 * owned-store — one holder of a store at every instant, and no torn chunk behind it.
 *
 * Proven:
 *   · RED: while one `ownedStore` act holds a store, a second claim refuses by name and its act never runs;
 *     CONTROL: two acts in sequence both write, and the second reads the first's bytes;
 *   · a caller that reaches the claimed rendezvous hears which holder it met, in the outcome shape a vessel
 *     answers in; a socket file nobody answers at reads as a corpse and the claim replaces it;
 *   · RED: a save that dies mid-chunk under the holder's Repo leaves no torn chunk on disk; CONTROL (a planted
 *     known positive): the same fault under the stock adapter tears a chunk, so the instrument sees a tear.
 */
import { promises as fsp, mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync, statSync, mkdirSync } from "node:fs";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import { rendezvousDir, rendezvousPath } from "@lararium/mesh/rendezvous-path";

import { ownedStore, claimStore, StoreHeld } from "../src/owned-store.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "lares-owned-store-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const socketOf = (d: string): string => rendezvousPath({ root: d, uid: process.getuid?.() ?? 0 });

function ask(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const sock = createConnection(path);
    let buf = "";
    sock.setEncoding("utf8");
    sock.on("connect", () => sock.write(JSON.stringify({ verb: "kapae", requestedBy: "did:test" }) + "\n"));
    sock.on("data", (c: string) => { buf += c; });
    sock.on("end", () => resolve(buf));
    sock.on("error", reject);
  });
}

describe("ownedStore — one holder", () => {
  it("RED: a second claim beside a held store refuses by name, and its act never runs", async () => {
    let releaseFirst!: () => void;
    const gate = new Promise<void>((r) => { releaseFirst = r; });
    let entered!: () => void;
    const holding = new Promise<void>((r) => { entered = r; });
    const first = ownedStore(dir, async (repo) => {
      const h = repo.create<{ n: number }>({ n: 1 });
      entered();
      await gate;
      return h.url;
    });
    await holding;
    let secondRan = false;
    await expect(ownedStore(dir, async () => { secondRan = true; })).rejects.toBeInstanceOf(StoreHeld);
    await expect(ownedStore(dir, async () => { secondRan = true; })).rejects.toThrow(/already has a holder answering/);
    expect(secondRan).toBe(false);
    releaseFirst();
    await first;
  });

  it("CONTROL: two acts in sequence both write, and the second reads the first", async () => {
    const url = await ownedStore(dir, async (repo) => repo.create<{ n: number }>({ n: 1 }).url);
    await ownedStore(dir, async (repo) => {
      const h = await repo.find<{ n: number }>(url as AutomergeUrl);
      expect(h.doc().n).toBe(1);
      h.change((d) => { d.n = 2; });
    });
    const n = await ownedStore(dir, async (repo) => (await repo.find<{ n: number }>(url as AutomergeUrl)).doc().n);
    expect(n).toBe(2);
  });

  it("a caller that reaches the claimed name hears which holder it met", async () => {
    const claim = await claimStore(dir);
    try {
      const line = JSON.parse(await ask(socketOf(dir))) as { status: string; errorMessage: string };
      expect(line.status).toBe("error");
      expect(line.errorMessage).toMatch(/held by a direct lares command \(pid \d+\)/);
    } finally { await claim.release(); }
  });

  it("a socket file nobody answers at reads as a corpse, and the claim stands over it", async () => {
    mkdirSync(rendezvousDir(process.getuid?.() ?? 0), { recursive: true, mode: 0o700 });
    writeFileSync(socketOf(dir), "");
    const wrote = await ownedStore(dir, async (repo) => repo.create<{ n: number }>({ n: 7 }).url);
    expect(wrote).toMatch(/^automerge:/);
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

/**
 * Arm a fault that writes the first half of each chunk and then dies, at both write shores: the stock
 * adapter's `fs.promises.writeFile` and the file handle the crash-atomic adapter writes its temp through.
 * Returns the payloads each write was asked to land, and the disarm.
 */
async function armMidChunkFault(): Promise<{ attempted: Uint8Array[]; disarm: () => void }> {
  const attempted: Uint8Array[] = [];
  const probe = await fsp.open(join(dir, ".probe"), "w");
  const handleProto = Object.getPrototypeOf(probe) as { writeFile: (this: unknown, data: Uint8Array) => Promise<void> };
  await probe.close();
  rmSync(join(dir, ".probe"));
  const realHandleWrite = handleProto.writeFile;
  const realWriteFile = fsp.writeFile;
  const half = (data: Uint8Array): Uint8Array => data.subarray(0, Math.max(1, Math.floor(data.length / 2)));
  handleProto.writeFile = async function (this: unknown, data: Uint8Array): Promise<void> {
    attempted.push(Uint8Array.from(data));
    await realHandleWrite.call(this, half(data));
    throw new Error("the disk died mid-chunk");
  };
  (fsp as { writeFile: unknown }).writeFile = async (path: string, data: Uint8Array): Promise<void> => {
    attempted.push(Uint8Array.from(data));
    await realWriteFile(path, half(data));
    throw new Error("the disk died mid-chunk");
  };
  return {
    attempted,
    disarm: () => { handleProto.writeFile = realHandleWrite; (fsp as { writeFile: unknown }).writeFile = realWriteFile; },
  };
}

/** Files on disk whose bytes are a STRICT prefix of a chunk some write was asked to land — a tear. */
function torn(root: string, attempted: readonly Uint8Array[]): string[] {
  return filesUnder(root).filter((p) => {
    const bytes = readFileSync(p);
    return attempted.some((a) => bytes.length > 0 && bytes.length < a.length && Buffer.from(a.subarray(0, bytes.length)).equals(bytes));
  });
}

describe("ownedStore — crash-atomic saves", () => {
  // The disk is read the instant the save dies — what a crash at that moment leaves — before any later save
  // could heal it.
  it("RED: a save that dies mid-chunk under the holder leaves no torn chunk", async () => {
    let attempted: Uint8Array[] = [];
    let tears: string[] = [];
    await ownedStore(dir, async (repo) => {
      await repo.storageId();                     // the store's own id lands before the disk fails
      const fault = await armMidChunkFault();
      try {
        const h = repo.create<{ text: string }>({ text: "x".repeat(4096) });
        h.change((d) => { d.text = "y".repeat(4096); });
        await repo.flush().catch(() => { /* the fault is the point */ });
        attempted = fault.attempted;
        tears = torn(dir, attempted);
      } finally { fault.disarm(); }
    });
    expect(attempted.length).toBeGreaterThan(0);
    expect(tears).toEqual([]);
  });

  it("CONTROL (planted known positive): the stock adapter under the same fault tears a chunk", async () => {
    const repo = new Repo({ storage: new NodeFSStorageAdapter(dir) });
    await repo.storageId();                       // the store's own id lands before the disk fails
    const fault = await armMidChunkFault();
    let tears: string[] = [];
    try {
      const h = repo.create<{ text: string }>({ text: "x".repeat(4096) });
      h.change((d) => { d.text = "y".repeat(4096); });
      await repo.flush().catch(() => { /* the fault is the point */ });
      tears = torn(dir, fault.attempted);
    } finally {
      fault.disarm();
      await repo.shutdown().catch(() => { /* already faulted */ });
    }
    expect(fault.attempted.length).toBeGreaterThan(0);
    expect(tears.length).toBeGreaterThan(0);
  });
});
