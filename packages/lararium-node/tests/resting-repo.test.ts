/**
 * resting-repo — the teardown every storage-backed vector shares: a Repo at rest writes nothing, so its
 * directory can leave.
 *
 * Each vector forces the late write by its own hand (a change made after the Repo stood down, then the Repo's
 * own `flush`), so no vector waits on the Repo's debounce or on the machine.
 */
import { afterEach, describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { DurableNodeFSStorageAdapter } from "../src/durable-storage-adapter.js";
import { restEvery, restingRepo } from "./resting-repo.js";

const dirs: string[] = [];
const scratch = (): string => { const d = mkdtempSync(join(tmpdir(), "lares-resting-repo-")); dirs.push(d); return d; };
/** Every file under `dir` with a digest of its bytes: a write that replaces a file's bytes moves the reading too. */
const files = (dir: string): string[] => (existsSync(dir)
  ? readdirSync(dir, { recursive: true }).map(String).filter((n) => statSync(join(dir, n)).isFile()).sort()
      .map((n) => `${n} ${createHash("sha256").update(readFileSync(join(dir, n))).digest("hex")}`)
  : []);

/** An adapter that answers the Repo's close with nothing, as the stock adapter does; the vector closes it by hand at its end. */
class Unclosing extends DurableNodeFSStorageAdapter {
  override async close(): Promise<void> { /* the stock adapter's answer: no close */ }
  reallyClose(): Promise<void> { return super.close(); }
}

afterEach(async () => {
  await restEvery();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("a Repo at rest writes nothing", () => {
  test("RED: a change made after the rest lands no byte, and the adapter counts it as late", async () => {
    const dir = scratch();
    const repo = restingRepo(dir);
    const handle = repo.create<{ n: number }>({ n: 1 });
    await repo.flush();
    await repo.rest();
    const before = files(dir);
    expect(before.length).toBeGreaterThan(0);
    handle.change((d) => { d.n = 2; });
    await repo.flush();
    expect(files(dir)).toEqual(before);
    expect(repo.restingStorage.lateWrites).toBeGreaterThan(0);

    // CONTROL: a Repo whose adapter answers no close (the stock adapter's shape) still lands the same change after
    // its shutdown, which names what the rest closes. The vector closes that adapter itself before the directory leaves.
    const plainDir = scratch();
    const unclosing = new Unclosing(plainDir);
    const plain = new Repo({ storage: unclosing });
    const plainHandle = plain.create<{ n: number }>({ n: 1 });
    await plain.flush();
    await plain.shutdown();
    const plainBefore = files(plainDir);
    plainHandle.change((d) => { d.n = 2; });
    await plain.flush();
    await unclosing.reallyClose();
    expect(files(plainDir)).not.toEqual(plainBefore);
  });

  test("the rest keeps what the Repo held: a second Repo over the directory reads the last change", async () => {
    const dir = scratch();
    const repo = restingRepo(dir);
    const handle = repo.create<{ n: number }>({ n: 1 });
    handle.change((d) => { d.n = 7; });   // never flushed by the vector: the rest's own shutdown lands it
    await repo.rest();
    expect(files(dir).filter((n) => n.includes(".tmp"))).toEqual([]);
    const reader = restingRepo(dir);
    expect((await reader.find<{ n: number }>(handle.url)).doc().n).toBe(7);
    await reader.rest();
  });

  test("`rest` runs once, and `restEvery` rests each Repo that still stands and no Repo twice", async () => {
    const a = restingRepo(scratch());
    const b = restingRepo(scratch(), { sharePolicy: async () => false });
    let shutA = 0, shutB = 0;
    const realA = a.shutdown.bind(a), realB = b.shutdown.bind(b);
    a.shutdown = async () => { shutA += 1; await realA(); };
    b.shutdown = async () => { shutB += 1; await realB(); };
    const first = a.rest();
    expect(a.rest()).toBe(first);
    await first;
    await restEvery();
    await restEvery();
    expect([shutA, shutB]).toEqual([1, 1]);
    const hb = b.create<{ n: number }>({ n: 1 });
    await b.flush();
    expect(b.restingStorage.lateWrites).toBeGreaterThan(0);
    expect(hb.doc().n).toBe(1);
  });

  test("a `restEvery` that runs while a rest is in progress waits for that rest", async () => {
    const repo = restingRepo(scratch());
    let release!: () => void;
    const held = new Promise<void>((r) => { release = r; });
    const real = repo.shutdown.bind(repo);
    const order: string[] = [];
    repo.shutdown = async () => { await held; await real(); order.push("the Repo shut down"); };
    const resting = repo.rest();
    const every = restEvery().then(() => { order.push("restEvery answered"); });
    release();
    await every;
    await resting;
    expect(order).toEqual(["the Repo shut down", "restEvery answered"]);
  });

  test("a shutdown that faults still closes the adapter, and the fault reaches the caller", async () => {
    const dir = scratch();
    const repo = restingRepo(dir);
    const handle = repo.create<{ n: number }>({ n: 1 });
    await repo.flush();
    repo.shutdown = async () => { throw new Error("the shutdown faulted"); };
    await expect(repo.rest()).rejects.toThrow("the shutdown faulted");
    const before = files(dir);
    handle.change((d) => { d.n = 2; });
    await repo.flush();
    expect(files(dir)).toEqual(before);
  });
});
