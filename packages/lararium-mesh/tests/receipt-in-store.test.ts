/**
 * receipt-in-store — the ONE receipt helper both hosts call (the node's vessel and the browser's `browserIslandReceipt`).
 *
 *   RS1 — a receipt asked before the vessel ever saw the island's document: the helper re-finds it, the vessel's copy comes
 *         to hold the heads the island names once the island holds it, and the receipt resolves (so the results parked
 *         behind it go on). CONTROL: the bare heads answer, asked at the same moment, refuses: the vessel holds no copy.
 *   RS2 — a derived document the vessel read unavailable before the island held it still rests through the helper.
 *   RS3 — the helper waits on the island's leg, and the island's channel closing reads as a stall that rejects.
 *         CONTROL: the bare answer, which knows no island peer, still waits after the channel closed (the old browser
 *         receipt's endless park).
 *   RS4 — a vessel that stands down ends a wait on a leg that never stands.
 */
import { describe, expect, test } from "vitest";
import * as A from "@automerge/automerge";
import { Repo, generateAutomergeUrl, type DocumentId } from "@automerge/automerge-repo";
import { attachMessageChannelSync, makeIslandRepo, replicaHeads } from "../src/island-repo.js";
import { answerReceiptWithHeads, receiptInStore } from "../src/receipt-with-heads.js";

async function pair() {
  const vessel = new Repo({ network: [] });
  const channel = new MessageChannel();
  const island = makeIslandRepo({ syncPort: channel.port2 as unknown as MessagePort });
  let peerId = "";
  await new Promise<void>((resolve) => { attachMessageChannelSync(vessel, channel.port1 as unknown as MessagePort, (id) => { peerId = id; resolve(); }); });
  const close = async (): Promise<void> => { await island.shutdown(); await vessel.shutdown(); channel.port1.close(); channel.port2.close(); };
  return { vessel, island, peerId, channel, close };
}

/** A derived document the vessel asked for before the island held it: the vessel's handle stands cached unavailable. */
async function derivedReadUnavailable(vessel: Repo): Promise<{ id: string; url: ReturnType<typeof generateAutomergeUrl> }> {
  const url = generateAutomergeUrl();
  await expect(vessel.find(url)).rejects.toThrow(/is unavailable/);
  return { id: url.slice("automerge:".length), url };
}

const settledYet = async (p: Promise<unknown>): Promise<boolean> => {
  let done = false;
  void p.then(() => { done = true; }, () => { done = true; });
  await new Promise((r) => setTimeout(r, 0));
  return done;
};

describe("the one receipt helper", () => {
  test("RS1 — a receipt asked before the vessel saw the document re-finds it and resolves; CONTROL: the bare answer holds no copy", async () => {
    const { vessel, island, peerId, close } = await pair();
    try {
      const url = generateAutomergeUrl();
      const id = url.slice("automerge:".length);
      const bytes = A.save(A.from({ schemaVersion: "0.1", tiddlers: { a: { text: "x" } } }));
      const heads = { [id]: A.getHeads(A.load(bytes)) };
      await expect(answerReceiptWithHeads(vessel, { type: "receipt:request", requestId: "bare", documentIds: [id], heads } as never))
        .resolves.toMatchObject({ issued: false, why: "the vessel holds no copy of the document" });
      const asking = receiptInStore(vessel, [id as DocumentId], { ready: Promise.resolve(peerId), onClose: () => () => {} }, heads);
      await (island.import(bytes, { docId: id as never })).whenReady();
      await asking;
      expect(A.getHeads(vessel.handles[id as DocumentId]!.doc() as A.Doc<unknown>)).toEqual(heads[id]);
    } finally { await close(); }
  });

  test("RS2 — a derived document the vessel read unavailable before the island held it still rests", async () => {
    const { vessel, island, peerId, close } = await pair();
    try {
      const { id } = await derivedReadUnavailable(vessel);
      const handle = island.import(A.save(A.from({ schemaVersion: "0.1", tiddlers: {} })), { docId: id as never });
      await handle.whenReady();
      const heads = { [id]: replicaHeads(handle) };
      await receiptInStore(vessel, [id as DocumentId], { ready: Promise.resolve(peerId), onClose: () => () => {} }, heads);
      expect(A.getHeads(vessel.handles[id as DocumentId]!.doc() as A.Doc<unknown>)).toEqual(heads[id]);
    } finally { await close(); }
  });

  test("RS3 — the helper waits for the leg, and a closed channel rejects as a stall; CONTROL: the bare answer parks", async () => {
    const { vessel, island, peerId, channel } = await pair();
    const { id } = await derivedReadUnavailable(vessel);
    const heads = { [id]: ["a".repeat(64)] };
    let stand!: (peer: string) => void;
    const ready = new Promise<string>((resolve) => { stand = resolve; });
    const asking = receiptInStore(vessel, [id as DocumentId], { ready, onClose: () => () => {} }, heads);
    expect(await settledYet(asking)).toBe(false);
    const bare = answerReceiptWithHeads(vessel, { type: "receipt:request", requestId: "bare", documentIds: [id], heads } as never);
    stand(peerId);
    await island.shutdown();
    channel.port2.close(); channel.port1.close();
    await expect(asking).rejects.toThrow(/stalled: the island's channel closed/);
    expect(await settledYet(bare)).toBe(false);
    await vessel.shutdown();
  });

  test("RS4 — a vessel that stands down ends a wait on a leg that never stands", async () => {
    const vessel = new Repo({ network: [] });
    const closers = new Set<() => void>();
    const asking = receiptInStore(vessel, ["x" as DocumentId], { ready: new Promise(() => {}), onClose: (fn) => { closers.add(fn); return () => { closers.delete(fn); }; } });
    expect(await settledYet(asking)).toBe(false);
    for (const close of closers) close();
    await expect(asking).rejects.toThrow(/stood down before the island's sync leg stood/);
    await vessel.shutdown();
  });
});
