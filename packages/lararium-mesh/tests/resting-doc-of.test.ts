/**
 * resting-doc-of — a lit sibling's persona plane rests in this replica's own store, unmounted: the boot's proof reads it there
 * (`restingDocOf`), never from a peer. Red: a plane resting in the store reads absent to the memory-only read (`heldDocOf`),
 * the 2026-11-20 two-face walk's `no-founding`. Controls: a store that holds nothing answers absent at once, with a peer
 * still able to deliver; a plane already loaded reads as before.
 */
import { describe, expect, test } from "vitest";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { heldDocOf, restingDocOf } from "../src/persona-act-board.js";
import type { LarDoc } from "../src/base-doc.js";

function memoryAdapter(): StorageAdapterInterface {
  const bytes = new Map<string, Uint8Array>();
  const name = (key: StorageKey): string => key.join("\u0000");
  const starts = (key: string, prefix: StorageKey): boolean => key.split("\u0000").slice(0, prefix.length).join("\u0000") === name(prefix);
  return {
    async load(key) { const got = bytes.get(name(key)); return got ? Uint8Array.from(got) : undefined; },
    async save(key, data) { bytes.set(name(key), Uint8Array.from(data)); },
    async remove(key) { bytes.delete(name(key)); },
    async loadRange(prefix): Promise<Chunk[]> { return [...bytes].filter(([k]) => starts(k, prefix)).map(([k, data]) => ({ key: k.split("\u0000"), data: Uint8Array.from(data) })); },
    async removeRange(prefix) { for (const k of [...bytes.keys()]) if (starts(k, prefix)) bytes.delete(k); },
  };
}

const textOf = (doc: LarDoc | undefined, title: string): string | undefined =>
  (doc?.tiddlers as Record<string, { text?: string }> | undefined)?.[title]?.text;

describe("restingDocOf: a plane resting in this replica's own store reads held", () => {
  test("RED: a plane resting unmounted reads absent to heldDocOf and whole to restingDocOf", async () => {
    const storage = memoryAdapter();
    const founding = new Repo({ storage, sharePolicy: async () => false });
    const plane = founding.create<LarDoc>({ tiddlers: { "lar:///founding": { text: "the founding act" } } } as unknown as LarDoc);
    await founding.flush();
    const boot = new Repo({ storage, sharePolicy: async () => false });
    expect(heldDocOf(boot, plane.url)).toBeUndefined();
    expect(textOf(await restingDocOf(boot, plane.url), "lar:///founding")).toBe("the founding act");
  });

  test("CONTROL: a store that holds nothing answers absent at once, never waiting out its bound", async () => {
    const elsewhere = new Repo({ sharePolicy: async () => false }).create<LarDoc>({ tiddlers: {} } as unknown as LarDoc);
    const boot = new Repo({ storage: memoryAdapter(), sharePolicy: async () => false });
    const t0 = Date.now();
    expect(await restingDocOf(boot, elsewhere.url, 30_000)).toBeUndefined();
    expect(Date.now() - t0).toBeLessThan(5_000);
  });

  test("CONTROL: a plane already loaded reads as heldDocOf reads it", async () => {
    const repo = new Repo({ sharePolicy: async () => false });
    const plane = repo.create<LarDoc>({ tiddlers: { a: { text: "x" } } } as unknown as LarDoc);
    expect(await restingDocOf(repo, plane.url)).toBe(heldDocOf(repo, plane.url));
  });
});
