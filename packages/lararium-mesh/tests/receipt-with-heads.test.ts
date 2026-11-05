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

// ── ONE ANSWERER PER RECEIPT ASK ─────────────────────────────────────────────────────────────────────────────────
// The pool answers a wiki island's `receipt:request` only when the island's bound record grants `receipt`
// (`VesselWorkerHandle.grants`, read at ask time). Where the record lacks it, the pool stays silent and never reads
// its main Repo, so the island's own worker is the one answerer (its named refusal). Exactly one party answers each
// requestId: the Drain's "acked means durable" never races a refusal against an issue.
import { VesselIslandPoolCore } from "../src/vessel-island-pool-core.js";
import { mkEa, mkTeardownAck } from "../src/island-protocol.js";
import type { VesselIslandHost, VesselWorkerHandle } from "../src/vessel-host.js";

function poolRig(mainRepo: Repo, grantsOf: (wikiId: string) => (() => { readonly receipt: boolean }) | undefined) {
  const wikiIds: string[] = [];
  const heard = new Map<string, Set<(raw: unknown) => void>>();
  const said = new Map<string, Array<Record<string, unknown>>>();
  const host: VesselIslandHost = {
    spawnWorker(): VesselWorkerHandle {
      const id = wikiIds[wikiIds.length - 1]!;
      const listeners = new Set<(raw: unknown) => void>();
      heard.set(id, listeners); said.set(id, []);
      const grants = grantsOf(id);
      return {
        post(msg) {
          const m = msg as { type?: string };
          said.get(id)!.push(m as Record<string, unknown>);
          if (m.type === "manifest" || m.type === "teardown") queueMicrotask(() => { for (const fn of [...listeners]) fn(m.type === "manifest" ? mkEa("wiki") : mkTeardownAck()); });
        },
        listen(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
        onError: () => () => {}, terminate() {},
        ...(grants ? { grants } : {}),
      };
    },
    newSyncChannel() { const c = new MessageChannel(); return { mainPort: c.port1, syncPort: c.port2 }; },
    storage: () => undefined,
  };
  const pool = new VesselIslandPoolCore({ host, mainRepo, resolvePluginCids: async () => ({ ok: true, pluginCids: [] }) });
  return {
    pool,
    async mount(wikiId: string) {
      wikiIds.push(wikiId);
      await pool.mountWiki(wikiId, { coreHash: null, recipe: { wikiSlug: wikiId }, grants: { islandUrl: "automerge:fixture", wikiUrl: null } });
    },
    ask(wikiId: string, msg: unknown) { for (const fn of [...heard.get(wikiId)!]) fn(msg); },
    answers(wikiId: string, requestId: string) { return said.get(wikiId)!.filter((m) => m["type"] === "receipt:issued" && m["requestId"] === requestId); },
  };
}

/** A main Repo that counts every read of its handle table: the pool consults the repo only through `handles`. */
function countedRepo() {
  const repo = new Repo({ network: [] });
  const doc = repo.create<LarDoc>(emptyLarDoc());
  let consulted = 0;
  const table = repo.handles;
  Object.defineProperty(repo, "handles", { get() { consulted++; return table; } });
  return { repo, doc, consulted: () => consulted };
}

describe("exactly one answer per receipt requestId", () => {
  const settle = async (): Promise<void> => { for (let i = 0; i < 6; i++) await pause(); };

  test("RED: a granted island draws ONE receipt:issued from the pool, issued true — CONTROL: a malformed ask from it draws one issued false", async () => {
    const { repo, doc, consulted } = countedRepo();
    const rig = poolRig(repo, () => () => ({ receipt: true }));
    await rig.mount("w");
    const heads = { [doc.documentId]: A.getHeads(doc.doc()!) };
    rig.ask("w", { type: "receipt:request", requestId: "g1", documentIds: [doc.documentId], heads });
    await settle();
    expect(rig.answers("w", "g1")).toEqual([{ type: "receipt:issued", requestId: "g1", issued: true }]);
    expect(consulted()).toBeGreaterThan(0);
    rig.ask("w", { type: "receipt:request", requestId: "g2", documentIds: [doc.documentId] });   // no heads
    await settle();
    expect(rig.answers("w", "g2")).toHaveLength(1);
    expect(rig.answers("w", "g2")[0]).toMatchObject({ issued: false });
    await rig.pool.disposeAll();
  });

  test("RED: an island whose record grants no receipt draws NO pool answer and the pool's main Repo is never consulted — CONTROL: the same ask from a granted island answers", async () => {
    const { repo, doc, consulted } = countedRepo();
    const rig = poolRig(repo, (id) => (id === "granted" ? () => ({ receipt: true }) : () => ({ receipt: false })));
    await rig.mount("bare"); await rig.mount("granted");
    const ask = (requestId: string) => ({ type: "receipt:request", requestId, documentIds: [doc.documentId], heads: { [doc.documentId]: A.getHeads(doc.doc()!) } });
    rig.ask("bare", ask("b1"));
    await settle();
    expect(rig.answers("bare", "b1"), "the pool stays silent; the island's own worker owns the refusal").toEqual([]);
    expect(consulted(), "the main Repo never consulted for an island without the grant").toBe(0);
    expect(rig.pool.restState().asked, "an unanswered ask counts nowhere").toBe(0);
    rig.ask("granted", ask("g1"));   // CONTROL
    await settle();
    expect(rig.answers("granted", "g1")).toHaveLength(1);
    expect(consulted()).toBeGreaterThan(0);
    await rig.pool.disposeAll();
  });

  test("RED: a handle that declares no grants draws no pool answer (a record never bound grants nothing) — CONTROL: the declared grant answers", async () => {
    const { repo, doc, consulted } = countedRepo();
    const rig = poolRig(repo, (id) => (id === "declared" ? () => ({ receipt: true }) : undefined));
    await rig.mount("unbound"); await rig.mount("declared");
    const ask = (requestId: string) => ({ type: "receipt:request", requestId, documentIds: [doc.documentId], heads: { [doc.documentId]: A.getHeads(doc.doc()!) } });
    rig.ask("unbound", ask("u1")); await settle();
    expect(rig.answers("unbound", "u1")).toEqual([]);
    expect(consulted()).toBe(0);
    rig.ask("declared", ask("d1")); await settle();
    expect(rig.answers("declared", "d1")).toHaveLength(1);
    await rig.pool.disposeAll();
  });

  test("RED: the grant reads at ask time — a lift that stands late draws the answer from then on, and one that withdraws draws none", async () => {
    const { repo, doc } = countedRepo();
    let lifted = false;
    const rig = poolRig(repo, () => () => ({ receipt: lifted }));
    await rig.mount("w");
    const ask = (requestId: string) => ({ type: "receipt:request", requestId, documentIds: [doc.documentId], heads: { [doc.documentId]: A.getHeads(doc.doc()!) } });
    rig.ask("w", ask("e1")); await settle();
    expect(rig.answers("w", "e1")).toEqual([]);
    lifted = true;
    rig.ask("w", ask("e2")); await settle();
    expect(rig.answers("w", "e2")).toHaveLength(1);
    lifted = false;
    rig.ask("w", ask("e3")); await settle();
    expect(rig.answers("w", "e3")).toEqual([]);
    await rig.pool.disposeAll();
  });
});
