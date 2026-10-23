/**
 * rest-with-heads — the vessel answers a wiki island's rest ask only once its own copy holds the heads the island
 * names, and flushes the documents before it says so (dreamdom#/what-a-sink-keeps, "the edit that unloads before it
 * rests").
 */
import { describe, expect, test, vi } from "vitest";
import { next as A } from "@automerge/automerge";
import { Repo } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { REST_STALL_ROUNDS, answerRestWithHeads } from "../src/rest-with-heads.js";
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

  test("RED: a rest ask for heads the island never sends answers stalled the moment its channel closes, on a quiet doc — CONTROL: the same ask answers rested when the heads arrive over the open channel", async () => {
    const mc = new MessageChannel();
    const vessel = new Repo({ network: [new MessageChannelNetworkAdapter(mc.port1)] });
    const handle = vessel.create<LarDoc>(emptyLarDoc());
    const island = A.change(A.clone(handle.doc()!), (doc) => { doc.tiddlers["lar:///t/x"] = { tiddler: { title: "lar:///t/x", text: "edit" } } as never; });
    const islandRepo = new Repo({ network: [new MessageChannelNetworkAdapter(mc.port2)] });
    const peers = await new Promise<string[]>((resolve) => { const t = setInterval(() => { if (vessel.peers.length > 0) { clearInterval(t); resolve([...vessel.peers]); } }, 5); });
    const peer = peers[0]!;
    const ask = { type: "doc:rest" as const, requestId: "q", documentIds: [handle.documentId], heads: { [handle.documentId]: A.getHeads(island) } };
    let answer: { rested: boolean; stalled?: boolean; why?: string } | undefined;
    void answerRestWithHeads(vessel, ask, peer).then((a) => { answer = a; });
    await pause(); await pause();
    expect(answer, "the channel stands and the doc is quiet: the ask waits").toBeUndefined();
    mc.port2.close(); mc.port1.close();
    (vessel.networkSubsystem as unknown as { emit(e: string, p: unknown): void }).emit("peer-disconnected", { peerId: peer });
    await pause(); await pause();
    expect(answer).toMatchObject({ rested: false, stalled: true });
    expect(answer!.why).toContain("channel closed");
    void islandRepo;
    // CONTROL: the heads arrive over the open channel.
    const second = pair();
    let late: { rested: boolean; stalled?: boolean } | undefined;
    void answerRestWithHeads(second.vessel, { type: "doc:rest", requestId: "t", documentIds: [second.handle.documentId], heads: { [second.handle.documentId]: A.getHeads(second.island) } }, "no-peer-known").then((a) => { late = a; });
    await pause();
    expect(late, "an unknown peer is a closed channel: stalled at once").toMatchObject({ stalled: true });
  });

  test("RED: heads that never arrive over an open channel answer stalled after the backstop count — CONTROL: heads inside the bound answer rested", async () => {
    const { vessel, handle, island } = pair();
    const ahead = { type: "doc:rest" as const, requestId: "s", documentIds: [handle.documentId], heads: { [handle.documentId]: A.getHeads(island) } };
    let answer: { rested: boolean; stalled?: boolean; why?: string } | undefined;
    void answerRestWithHeads(vessel, ahead).then((a) => { answer = a; });
    await pause();
    for (let i = 0; i < REST_STALL_ROUNDS - 1; i++) handle.change((doc) => { doc.tiddlers[`lar:///t/n${i}`] = { tiddler: { title: `lar:///t/n${i}`, text: "x" } } as never; });
    await pause();
    expect(answer, "one change short of the bound: still waiting").toBeUndefined();
    handle.change((doc) => { doc.tiddlers["lar:///t/last"] = { tiddler: { title: "lar:///t/last", text: "x" } } as never; });
    await pause();
    expect(answer).toMatchObject({ rested: false, stalled: true });
    const second = pair();
    let late: { rested: boolean; stalled?: boolean } | undefined;
    void answerRestWithHeads(second.vessel, { type: "doc:rest", requestId: "t2", documentIds: [second.handle.documentId], heads: { [second.handle.documentId]: A.getHeads(second.island) } }).then((a) => { late = a; });
    await pause();
    second.handle.change((doc) => { doc.tiddlers["lar:///t/y"] = { tiddler: { title: "lar:///t/y", text: "y" } } as never; });
    second.handle.update((doc) => A.merge(doc, second.island));
    await pause(); await pause();
    expect(late).toEqual({ rested: true });
  });
});
