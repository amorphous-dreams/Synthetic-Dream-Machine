/**
 * island-rest-guard-coalesces — the daemon island's rest guard asks the vessel once per document per load.
 *
 * A Repo's load of one document reads its store in more than one range at once (snapshots, incrementals, sync state).
 * Each read once posted its own `rest:ask` to the vessel's main thread, and each waited a round trip there. Reads of one
 * document that overlap now share one ask.
 *
 *   C1  two overlapping range reads of one document draw one ask; control: a later read, after an unsealed answer, asks
 *       again (an unsealed answer never caches).
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store
 */
import { describe, expect, test } from "vitest";
import { generateAutomergeUrl, parseAutomergeUrl, type Chunk, type StorageAdapterInterface } from "@automerge/automerge-repo";
import { islandRestGuard } from "../src/sealed-rest.js";

const inner: StorageAdapterInterface = {
  async load() { return undefined; },
  async save() {},
  async remove() {},
  async loadRange(): Promise<Chunk[]> { return []; },
  async removeRange() {},
};

describe("the rest guard coalesces its asks", () => {
  test("C1 — overlapping reads of one document draw one ask; a later read asks again", async () => {
    const doc = parseAutomergeUrl(generateAutomergeUrl()).documentId;
    const asked: string[] = [];
    let answer!: (sealed: boolean) => void;
    const guard = islandRestGuard(inner, (id) => { asked.push(id); return new Promise<boolean>((r) => { answer = r; }); });
    const reads = Promise.all([guard.loadRange([doc, "snapshot"]), guard.loadRange([doc, "incremental"]), guard.load([doc, "sync-state", "x"])]);
    await Promise.resolve();
    expect(asked).toEqual([doc]);
    answer(false);
    await reads;
    const later = guard.loadRange([doc]);
    await Promise.resolve();
    expect(asked).toEqual([doc, doc]);
    answer(false);
    await later;
  });
});
