/**
 * receipt-with-heads — the vessel issues a wiki island's receipt only once its own copy holds the heads the island
 * names, and flushes the documents before it says so (dreamdom#/what-a-sink-keeps, "the edit that unloads before it
 * rests").
 */
import { describe, expect, test, vi } from "vitest";
import { next as A } from "@automerge/automerge";
import { Repo } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { RECEIPT_STALL_ROUNDS, answerReceiptWithHeads } from "../src/receipt-with-heads.js";
import { attachMessageChannelSync, emptyLarDoc, type LarDoc } from "../src/index.js";

const pause = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

function pair() {
  const vessel = new Repo({ network: [] });
  const handle = vessel.create<LarDoc>(emptyLarDoc());
  // The island's copy: a fork that lays one more change the vessel's copy has not seen.
  const island = A.change(A.clone(handle.doc()!), (doc) => { doc.tiddlers["lar:///t/x"] = { tiddler: { title: "lar:///t/x", text: "edit" } } as never; });
  return { vessel, handle, island };
}

describe("the vessel's receipt waits on the island's heads", () => {
  test("RED: an ask whose heads the vessel does not hold yet stays unanswered until they arrive, then flushes — CONTROL: heads it already holds issue at once", async () => {
    const { vessel, handle, island } = pair();
    const flush = vi.spyOn(vessel, "flush");
    const held = { type: "receipt:request" as const, requestId: "a", documentIds: [handle.documentId], heads: { [handle.documentId]: A.getHeads(handle.doc()!) } };
    expect(await answerReceiptWithHeads(vessel, held)).toEqual({ issued: true });   // CONTROL
    flush.mockClear();
    const ahead = { type: "receipt:request" as const, requestId: "b", documentIds: [handle.documentId], heads: { [handle.documentId]: A.getHeads(island) } };
    let answer: { issued: boolean } | undefined;
    void answerReceiptWithHeads(vessel, ahead).then((a) => { answer = a; });
    await pause();
    expect(answer, "the vessel's copy lacks the island's change: no answer").toBeUndefined();
    expect(flush).not.toHaveBeenCalled();
    handle.update((doc) => A.merge(doc, island));
    await pause(); await pause();
    expect(answer).toEqual({ issued: true });
    expect(flush).toHaveBeenCalledWith([handle.documentId]);
  });

  test("a document the vessel holds no handle for, and a malformed ask, issue no receipt", async () => {
    const { vessel, handle } = pair();
    const head = "a".repeat(64);
    expect(await answerReceiptWithHeads(vessel, { type: "receipt:request", requestId: "c", documentIds: ["no-such-document"], heads: { "no-such-document": [head] } })).toMatchObject({ issued: false });
    expect(await answerReceiptWithHeads(vessel, { type: "receipt:request", requestId: "d", documentIds: [handle.documentId], heads: { [handle.documentId]: ["not-a-hash"] } })).toMatchObject({ issued: false, why: "malformed receipt request" });
    expect(await answerReceiptWithHeads(vessel, { type: "receipt:request", requestId: "e", documentIds: [handle.documentId] })).toMatchObject({ issued: false });
    expect(await answerReceiptWithHeads(null, { type: "receipt:request", requestId: "f", documentIds: [], heads: {} })).toMatchObject({ issued: false });
  });

  test("RED: a receipt request for heads the island never sends answers stalled the moment its channel closes, on a quiet doc — CONTROL: the same ask issues when the heads arrive over the open channel", async () => {
    const mc = new MessageChannel();
    const vessel = new Repo({ network: [] });
    let peer = "";
    attachMessageChannelSync(vessel, mc.port1, (id) => { peer = id; });
    const handle = vessel.create<LarDoc>(emptyLarDoc());
    const island = A.change(A.clone(handle.doc()!), (doc) => { doc.tiddlers["lar:///t/x"] = { tiddler: { title: "lar:///t/x", text: "edit" } } as never; });
    const islandRepo = new Repo({ network: [new MessageChannelNetworkAdapter(mc.port2)] });
    await new Promise<void>((resolve) => { const t = setInterval(() => { if (peer !== "" && vessel.peers.includes(peer as never)) { clearInterval(t); resolve(); } }, 5); });
    const ask = { type: "receipt:request" as const, requestId: "q", documentIds: [handle.documentId], heads: { [handle.documentId]: A.getHeads(island) } };
    let answer: { issued: boolean; stalled?: boolean; why?: string } | undefined;
    void answerReceiptWithHeads(vessel, ask, peer).then((a) => { answer = a; });
    await pause(); await pause();
    expect(answer, "the channel stands and the doc is quiet: the ask waits").toBeUndefined();
    mc.port2.close();   // the island's side ends: the real adapter's close path, no hand-emitted event
    await new Promise((r) => setTimeout(r, 100));
    expect(answer).toMatchObject({ issued: false, stalled: true });
    expect(answer!.why).toContain("channel closed");
    void islandRepo;
    // CONTROL: the heads arrive over the open channel.
    const second = pair();
    let late: { issued: boolean; stalled?: boolean } | undefined;
    void answerReceiptWithHeads(second.vessel, { type: "receipt:request", requestId: "t", documentIds: [second.handle.documentId], heads: { [second.handle.documentId]: A.getHeads(second.island) } }, "no-peer-known").then((a) => { late = a; });
    await pause();
    expect(late, "an unknown peer is a closed channel: stalled at once").toMatchObject({ stalled: true });
  });

  test("RED: heads that never arrive over an open channel answer stalled after the backstop count — CONTROL: heads inside the bound issue", async () => {
    const { vessel, handle, island } = pair();
    const ahead = { type: "receipt:request" as const, requestId: "s", documentIds: [handle.documentId], heads: { [handle.documentId]: A.getHeads(island) } };
    let answer: { issued: boolean; stalled?: boolean; why?: string } | undefined;
    void answerReceiptWithHeads(vessel, ahead).then((a) => { answer = a; });
    await pause();
    for (let i = 0; i < RECEIPT_STALL_ROUNDS - 1; i++) handle.change((doc) => { doc.tiddlers[`lar:///t/n${i}`] = { tiddler: { title: `lar:///t/n${i}`, text: "x" } } as never; });
    await pause();
    expect(answer, "one change short of the bound: still waiting").toBeUndefined();
    handle.change((doc) => { doc.tiddlers["lar:///t/last"] = { tiddler: { title: "lar:///t/last", text: "x" } } as never; });
    await pause();
    expect(answer).toMatchObject({ issued: false, stalled: true });
    const second = pair();
    let late: { issued: boolean; stalled?: boolean } | undefined;
    void answerReceiptWithHeads(second.vessel, { type: "receipt:request", requestId: "t2", documentIds: [second.handle.documentId], heads: { [second.handle.documentId]: A.getHeads(second.island) } }).then((a) => { late = a; });
    await pause();
    second.handle.change((doc) => { doc.tiddlers["lar:///t/y"] = { tiddler: { title: "lar:///t/y", text: "y" } } as never; });
    second.handle.update((doc) => A.merge(doc, second.island));
    await pause(); await pause();
    expect(late).toEqual({ issued: true });
  });
});
