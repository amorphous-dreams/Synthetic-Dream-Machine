/**
 * THE HELD-SAVE CENSUS — the sealed rest names each document whose saves wait in memory, by id and refusal, never by
 * body, so a stop can list what it would drop.
 *
 *   H1  a save no session booked counts under `save-unbooked`; a save of a sealed bag no face wears yet counts under
 *       `save-unmapped`; each row names its bag and how many saves wait, and a save that seals once a session books
 *       it leaves the census.                                                  control: an unsealed bag's save holds nothing
 */
import { describe, expect, it } from "vitest";
import type { Chunk, StorageAdapterInterface, StorageKey } from "@automerge/automerge-repo";
import { SealedDocumentStore } from "../src/sealed-doc-store.js";

function memory(): StorageAdapterInterface {
  const bytes = new Map<string, Uint8Array>();
  const name = (k: StorageKey) => k.join("\u0000");
  return {
    async load(k) { return bytes.get(name(k)); },
    async save(k, d) { bytes.set(name(k), d); },
    async remove(k) { bytes.delete(name(k)); },
    async loadRange(): Promise<Chunk[]> { return []; },
    async removeRange() {},
  };
}

describe("the held-save census", () => {
  it("H1 — unbooked and unmapped saves count by document, refusal and bag; an unsealed bag's save holds nothing", async () => {
    let booked = false;
    const store = new SealedDocumentStore({
      inner: memory(),
      bagOf: (id) => id === "doc-faceless" ? { bagId: "bag-faceless", face: null } : id === "doc-clear" ? null : { bagId: "bag-notes", face: "face-a" },
      sessionFace: () => "face-a",
      sessionOf: () => booked ? { id: "s", subject: "face-a" } : null,
      seal: async ({ values }) => ({ values: values.map(() => ({ address: "ab".repeat(32) })) }) as never,
      open: async () => ({ refusal: "value-absent" }) as never,
    });
    await store.save(["doc-notes", "incremental", "h1"], new Uint8Array([1]));
    await store.save(["doc-notes", "incremental", "h2"], new Uint8Array([2]));
    await store.save(["doc-faceless", "incremental", "h3"], new Uint8Array([3]));
    await store.save(["doc-clear", "incremental", "h4"], new Uint8Array([4]));
    const rows = store.held().sort((a, b) => a.documentId.localeCompare(b.documentId));
    expect(rows).toEqual([
      { documentId: "doc-faceless", refusal: "save-unmapped", saves: 1, bagId: "bag-faceless" },
      { documentId: "doc-notes", refusal: "save-unbooked", saves: 2, bagId: "bag-notes" },
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/"data"|\[1\]/);
    booked = true;
    await store.reseal();
    expect(store.held()).toEqual([{ documentId: "doc-faceless", refusal: "save-unmapped", saves: 1, bagId: "bag-faceless" }]);
  });
});
