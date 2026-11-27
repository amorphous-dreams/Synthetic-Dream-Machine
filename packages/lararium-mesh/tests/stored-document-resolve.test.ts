/**
 * stored-document-resolve — a document this vessel's own store holds resolves from the STORE, not on a peer's clock.
 *
 * Measured on a live house: the first `lares get filter=…` over a named wiki after boot refused `never arrived (8000ms)` for a
 * working slot that rested in the vessel's own store, and the second identical call answered. The 8s bound raced the
 * store's cold load and named it a peer that never answered. The library reports which source still works
 * (`sources.storage`), so the resolve waits on that event while the store loads, starts the peer bound only once the store
 * answered "not here", and names each refusal by the phase that failed.
 */
import { afterEach, describe, expect, test } from "vitest";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { DocumentUnavailableRefusal, findOrThrow } from "../src/find-or-throw.js";

class MemoryStore implements StorageAdapterInterface {
  readonly rows = new Map<string, { key: StorageKey; data: Uint8Array }>();
  async load(key: StorageKey) { return this.rows.get(key.join("\u0000"))?.data; }
  async save(key: StorageKey, data: Uint8Array) { this.rows.set(key.join("\u0000"), { key: [...key], data }); }
  async remove(key: StorageKey) { this.rows.delete(key.join("\u0000")); }
  async loadRange(prefix: StorageKey): Promise<Chunk[]> { return [...this.rows.values()].filter((r) => prefix.every((p, i) => r.key[i] === p)); }
  async removeRange(prefix: StorageKey) { for (const [name, r] of [...this.rows]) if (prefix.every((p, i) => r.key[i] === p)) this.rows.delete(name); }
}

/** A store whose range read answers after `lagMs` (a cold load), or never (`lagMs` null). Every other call passes through. */
class SlowStore extends MemoryStore {
  constructor(private readonly lagMs: number | null) { super(); }
  override async loadRange(prefix: StorageKey): Promise<Chunk[]> {
    if (this.lagMs === null) return new Promise<Chunk[]>(() => {});
    await new Promise((resolve) => setTimeout(resolve, this.lagMs!));
    return super.loadRange(prefix);
  }
}

const repos: Repo[] = [];
afterEach(async () => { for (const repo of repos.splice(0)) await repo.shutdown().catch(() => {}); });
const standRepo = (storage: StorageAdapterInterface): Repo => { const repo = new Repo({ storage, network: [] }); repos.push(repo); return repo; };

/** A document written through one repo and flushed, so a fresh repo over the same rows holds it only in the store. */
async function restedUrl(rows: MemoryStore): Promise<string> {
  const writer = new Repo({ storage: rows, network: [] });
  const handle = writer.create<LarDoc>(emptyLarDoc());
  handle.change((doc) => { doc.tiddlers["lar:///stored/seed"] = { tiddler: { title: "lar:///stored/seed", text: "from the store" } } as never; });
  await writer.flush();
  await writer.shutdown();
  return handle.url;
}

describe("a stored document resolves from the store", () => {
  test("a store that loads past the peer bound still answers: the peer clock never races the store", async () => {
    const rows = new SlowStore(150);
    const url = await restedUrl(rows);
    const reader = standRepo(rows);
    const handle = await findOrThrow(reader, url, "a stored slot", { timeoutMs: 30 });
    expect(handle.doc()?.tiddlers?.["lar:///stored/seed"]).toBeDefined();
  }, 30_000);

  test("a store that never answers refuses by the store's own name, not as a peer that stayed silent", async () => {
    const rows = new SlowStore(null);
    const url = await restedUrl(new MemoryStore());
    const reader = standRepo(rows);
    const refusal = await findOrThrow(reader, url, "a stalled store", { timeoutMs: 20, storeBoundMs: 60 }).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(DocumentUnavailableRefusal);
    expect((refusal as DocumentUnavailableRefusal).phase).toBe("store");
    expect((refusal as Error).message).toContain("this vessel's store was still loading it");
    expect((refusal as Error).message).not.toContain("make the document reachable from a peer");
  }, 30_000);

  test("a store that answered not-here, with a peer silent, refuses naming both: not in the store, no peer answered", async () => {
    const silent = {
      findWithProgress: () => ({
        peek: () => ({ state: "loading", sources: { storage: "unavailable", sync: "pending" } }),
        subscribe: () => () => {},
      }),
      find: () => new Promise<never>(() => {}),
    } as unknown as Repo;
    const refusal = await findOrThrow(silent, "automerge:silent", "a silent document", { timeoutMs: 30 }).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(DocumentUnavailableRefusal);
    expect((refusal as DocumentUnavailableRefusal).phase).toBe("peers");
    expect((refusal as DocumentUnavailableRefusal).waitedMs).toBe(30);
    expect((refusal as Error).message).toContain("not in this vessel's store and no peer answered within 30ms");
  });
});
