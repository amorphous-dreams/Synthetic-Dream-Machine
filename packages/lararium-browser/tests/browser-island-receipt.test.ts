/**
 * browser-island-receipt — the browser's floor receipt rides the ONE helper the node's vessel calls (`receiptInStore`).
 *
 *   BR1 — a receipt asked before the daemon island's leg stands waits for it; asked before the vessel ever saw the island's
 *         document, it re-finds it, and it resolves once the vessel's copy holds the heads the island names.
 *   BR2 — the island's channel closing reads as a stall that rejects, never a park behind a handle that cannot move.
 */
import { describe, expect, test } from "vitest";
import * as A from "@automerge/automerge";
import { Repo, generateAutomergeUrl } from "@automerge/automerge-repo";
import { attachMessageChannelSync, makeIslandRepo } from "@lararium/mesh";
import { browserIslandReceipt } from "../src/browser-island-caps.js";

async function pair() {
  const vessel = new Repo({ network: [] });
  const channel = new MessageChannel();
  const island = makeIslandRepo({ syncPort: channel.port2 });
  let peerId = "";
  await new Promise<void>((resolve) => { attachMessageChannelSync(vessel, channel.port1, (id) => { peerId = id; resolve(); }); });
  return { vessel, island, peerId, channel };
}

const settledYet = async (p: Promise<unknown>): Promise<boolean> => {
  let done = false;
  void p.then(() => { done = true; }, () => { done = true; });
  await new Promise((r) => setTimeout(r, 0));
  return done;
};

describe("the browser's floor receipt", () => {
  test("BR1 — it waits on the island's leg, re-finds a document it never saw, and resolves on the island's heads", async () => {
    const { vessel, island, peerId, channel } = await pair();
    let stand!: (peer: string) => void;
    const receipt = browserIslandReceipt(vessel, { ready: new Promise<string>((resolve) => { stand = resolve; }), onClose: () => () => {} });
    const id = generateAutomergeUrl().slice("automerge:".length);
    const bytes = A.save(A.from({ schemaVersion: "0.1", tiddlers: { a: { text: "x" } } }));
    const asking = receipt([id], { [id]: A.getHeads(A.load(bytes)) });
    expect(await settledYet(asking)).toBe(false);
    stand(peerId);
    await island.import(bytes, { docId: id as never }).whenReady();
    await asking;
    await island.shutdown(); await vessel.shutdown(); channel.port1.close(); channel.port2.close();
  });

  test("BR2 — a closed island channel rejects as a stall", async () => {
    const { vessel, island, peerId, channel } = await pair();
    const receipt = browserIslandReceipt(vessel, { ready: Promise.resolve(peerId), onClose: () => () => {} });
    const id = generateAutomergeUrl().slice("automerge:".length);
    await expect(vessel.find(`automerge:${id}` as never)).rejects.toThrow(/is unavailable/);
    const asking = receipt([id], { [id]: ["a".repeat(64)] });
    // The island's side goes (its worker ended): the vessel's port reads the entangled port's close.
    await island.shutdown();
    channel.port2.close();
    await expect(asking).rejects.toThrow(/stalled: the island's channel closed/);
    await vessel.shutdown(); channel.port1.close();
  });
});
