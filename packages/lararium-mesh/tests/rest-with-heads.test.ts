/**
 * rest-with-heads — the vessel answers a wiki island's rest ask only once its own copy holds the heads the island
 * names, and flushes the documents before it says so (dreamdom#/what-a-sink-keeps, "the edit that unloads before it
 * rests").
 */
import { describe, expect, test, vi } from "vitest";
import { next as A } from "@automerge/automerge";
import { Repo } from "@automerge/automerge-repo";
import { answerRestWithHeads } from "../src/rest-with-heads.js";
import { emptyLarDoc, type LarDoc } from "../src/index.js";

const pause = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

function pair() {
  const vessel = new Repo({ network: [] });
  const handle = vessel.create<LarDoc>(emptyLarDoc());
  // The island's copy: a fork that lays one more change the vessel's copy has not seen.
  const island = A.change(A.clone(handle.doc()!), (doc) => { doc.tiddlers["lar:///t/x"] = { tiddler: { title: "lar:///t/x", text: "edit" } } as never; });
  return { vessel, handle, island };
}

describe("the vessel's rest answer waits on the island's heads", () => {
  test("RED: an ask whose heads the vessel does not hold yet stays unanswered until they arrive, then flushes — CONTROL: heads it already holds answer rested at once", async () => {
    const { vessel, handle, island } = pair();
    const flush = vi.spyOn(vessel, "flush");
    const held = { type: "doc:rest" as const, requestId: "a", documentIds: [handle.documentId], heads: { [handle.documentId]: A.getHeads(handle.doc()!) } };
    expect(await answerRestWithHeads(vessel, held)).toEqual({ rested: true });   // CONTROL
    flush.mockClear();
    const ahead = { type: "doc:rest" as const, requestId: "b", documentIds: [handle.documentId], heads: { [handle.documentId]: A.getHeads(island) } };
    let answer: { rested: boolean } | undefined;
    void answerRestWithHeads(vessel, ahead).then((a) => { answer = a; });
    await pause();
    expect(answer, "the vessel's copy lacks the island's change: no answer").toBeUndefined();
    expect(flush).not.toHaveBeenCalled();
    handle.update((doc) => A.merge(doc, island));
    await pause(); await pause();
    expect(answer).toEqual({ rested: true });
    expect(flush).toHaveBeenCalledWith([handle.documentId]);
  });

  test("a document the vessel holds no handle for, and a malformed ask, answer unrested", async () => {
    const { vessel, handle } = pair();
    const head = "a".repeat(64);
    expect(await answerRestWithHeads(vessel, { type: "doc:rest", requestId: "c", documentIds: ["no-such-document"], heads: { "no-such-document": [head] } })).toMatchObject({ rested: false });
    expect(await answerRestWithHeads(vessel, { type: "doc:rest", requestId: "d", documentIds: [handle.documentId], heads: { [handle.documentId]: ["not-a-hash"] } })).toMatchObject({ rested: false, why: "malformed rest ask" });
    expect(await answerRestWithHeads(vessel, { type: "doc:rest", requestId: "e", documentIds: [handle.documentId] })).toMatchObject({ rested: false });
    expect(await answerRestWithHeads(null, { type: "doc:rest", requestId: "f", documentIds: [], heads: {} })).toMatchObject({ rested: false });
  });
});
