/**
 * THE CORPUS READER'S MEMO FOLLOWS THE BODY IT DERIVED FROM.
 *
 * `compositeCorpusReader` keeps one derived stalk per title so a refold after one write re-derives one
 * title. A record's `changeId` names a title's LINEAGE and survives an edit (a hand's write supplies no
 * ceremony keys, so the store keeps them), so a memo keyed on it serves the old body's stalk after an
 * edit. The memo keys on the body the stalk came from.
 *
 * Control: a refold of an unmoved body answers the SAME stalk object (the memo still saves the work).
 */
import { describe, expect, test } from "vitest";
import { CompositeStore } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { compositeCorpusReader } from "../src/wiki-corpus-reader.js";

const BAG = "lar:///ha.ka.ba/bags/corpus-memo";
const TITLE = "lar:///t/corpus/memo";
const origin = { kind: "lares-verb", requestId: "memo" } as const;

describe("the corpus reader's memo follows the body", () => {
  test("an edit that keeps the title's change-id re-derives the stalk from the new body", async () => {
    const store = new CompositeStore();
    store.addLayer({ bagId: BAG, store: new MemoryTiddlerStore(BAG), writable: true });
    const reader = compositeCorpusReader(store);

    await store.put({ tiddler: { title: TITLE, text: "the first body speaks of tides and shores" }, meta: { changeId: "lineage-1" } }, origin);
    const first = (await reader.docs()).find((d) => d.title === TITLE)!;
    expect(first.changeId).toBe("lineage-1");
    const firstStalk = reader.stalkOf!(first);
    // CONTROL: an unmoved body answers the memoed stalk itself.
    expect(reader.stalkOf!((await reader.docs()).find((d) => d.title === TITLE)!)).toBe(firstStalk);

    await store.put({ tiddler: { title: TITLE, text: "an entirely different passage about ledgers and hearths" }, meta: { changeId: "lineage-1" } }, origin);
    const second = (await reader.docs()).find((d) => d.title === TITLE)!;
    expect(second.changeId, "the edit kept the title's lineage id").toBe("lineage-1");
    const secondStalk = reader.stalkOf!(second);
    expect(secondStalk).not.toBe(firstStalk);
    expect([...secondStalk.shingleSet].some((s) => "an entirely different passage about ledgers and hearths".includes(s))).toBe(true);
    expect([...secondStalk.shingleSet].some((s) => s.includes("tides"))).toBe(false);
  });
});
