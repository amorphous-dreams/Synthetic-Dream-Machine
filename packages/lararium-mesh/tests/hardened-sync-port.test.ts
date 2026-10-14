/**
 * hardened-sync-port.test — a broad sync port drops what does not read as a sync message.
 *
 * The stock message-channel adapter reads `"targetId" in message` inside its port listener, so a far end that
 * posts a number, a string or null throws there, and a throw inside a port listener can end the owner's process.
 * Every broad port (the daemon island's, each wiki island's) therefore crosses `hardenedSyncPort` on both ends.
 *
 * P1 A NON-OBJECT NEVER REACHES THE ADAPTER. The far end posts a number, a string, null, an array, an object with
 *    no type, one with no sender, one whose `data` names a length, and one of a type no Repo knows that carries a
 *    value the Repo's own invalid-message line cannot print; the owner throws nothing, the sink names
 *    each drop, and the leg keeps syncing. Nine malformed messages of KNOWN types then pass the port, and the
 *    Repo's own handling throws nothing into the listener either. Control: a document minted before the noise and one minted after both
 *    cross the leg whole.
 * P2 THE READER ITSELF. `readsAsSyncMessage` accepts the adapter's own handshake and a sync message carrying
 *    bytes, and refuses each shape above. Control: the accepted shapes.
 * P3 BOTH ENDS WEAR IT (a source weld): `makeIslandRepo` and `attachMessageChannelSync` each hand the stock
 *    adapter a hardened port, and no other line constructs that adapter over a bare port.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { attachMessageChannelSync, makeIslandRepo, readsAsSyncMessage } from "../src/island-repo.js";
import { arrival } from "./handshake.js";

describe("a broad sync port drops what does not read as a sync message", () => {
  test("P1 noise from the far end throws nothing in the owner and the leg keeps syncing", async () => {
    const { port1, port2 } = new MessageChannel();
    const owner = new Repo({ network: [] });
    const dropped: string[] = [];
    // The port's own drop sink carries the wait: the eighth drop arrives when the owner has read all eight.
    const eighth = arrival<void>("the owner's port dropping the eighth noise message (its drop sink)");
    const ninth = arrival<void>("the owner's port dropping the sentinel posted behind the nine malformed messages");
    const detach = attachMessageChannelSync(owner, port1, undefined, (why) => {
      dropped.push(why);
      if (dropped.length === 8) eighth.arrive();
      if (dropped.length === 9) ninth.arrive();
    });
    const island = makeIslandRepo({ syncPort: port2 });
    try {
      const before = owner.create<{ n: number }>({ n: 1 });
      expect((await (await island.find<{ n: number }>(before.url)).doc()).n).toBe(1);        // control: the leg syncs
      const thrown: unknown[] = [];
      const onThrow = (e: unknown): void => { thrown.push(e); };
      process.on("uncaughtException", onThrow);
      try {
        for (const noise of [7, "a string", null, [1, 2], { senderId: "x" }, { type: "sync" }, { type: "sync", senderId: "x", data: 1_000_000_000 }, { type: "a-type-no-repo-knows", senderId: "x", n: 1n }]) {
          port2.postMessage(noise);
        }
        await eighth.arrived;
        expect(dropped.length).toBe(8);
        // A KNOWN type with a malformed body passes the port: the Repo's own handling answers for it, and it
        // throws nothing into the listener either.
        for (const malformed of [
          { type: "sync", senderId: "x" }, { type: "sync", senderId: "x", data: null, documentId: 7 },
          { type: "request", senderId: "x", documentId: "not-a-document", data: new ArrayBuffer(3) },
          { type: "ephemeral", senderId: "x" }, { type: "doc-unavailable", senderId: "x" },
          { type: "remote-subscription-change", senderId: "x" }, { type: "remote-heads-changed", senderId: "x" },
          { type: "welcome", senderId: "x" }, { type: "leave", senderId: "nobody" },
        ]) port2.postMessage(malformed);
        // A SENTINEL carries the wait: one more noise message posted behind the nine. A port delivers in the order
        // it took, so the sentinel's drop arrives only after the owner read every malformed message before it.
        port2.postMessage("the sentinel");
        await ninth.arrived;
      } finally { process.off("uncaughtException", onThrow); }
      expect(thrown).toEqual([]);
      expect(dropped.length, "the eight, and the sentinel alone beside them: none of the nine got dropped").toBe(9);
      // CONTROL: the leg still syncs, read in the direction the noise travelled. The island mints the document, so
      // the owner holds it only through sync messages its hardened port passed after all of the above.
      const after = island.create<{ n: number }>({ n: 2 });
      expect((await (await owner.find<{ n: number }>(after.url)).doc()).n).toBe(2);
    } finally {
      detach();
      port1.close(); port2.close();
      await Promise.all([owner.shutdown(), island.shutdown()]);
    }
  }, 30_000);

  test("P2 the reader accepts the adapter's own shapes and refuses every other", () => {
    expect(readsAsSyncMessage({ type: "arrive", senderId: "a", peerMetadata: {} })).toBe(true);          // control
    expect(readsAsSyncMessage({ type: "sync", senderId: "a", targetId: "b", data: new ArrayBuffer(4) })).toBe(true);
    expect(readsAsSyncMessage({ type: "sync", senderId: "a", targetId: "b", data: new Uint8Array(4) })).toBe(true);
    expect(readsAsSyncMessage({ type: "leave", senderId: "a" })).toBe(true);
    for (const bad of [7, "s", null, undefined, [1], { senderId: "a" }, { type: "sync" }, { type: 3, senderId: "a" },
      { type: "sync", senderId: "a", data: 12 }, { type: "sync", senderId: "a", targetId: 9 }, { type: "arrive", senderId: "a", peerMetadata: "m" }, { type: "a-type-no-repo-knows", senderId: "a" }]) {
      expect(readsAsSyncMessage(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  test("P3 both ends hand the stock adapter a hardened port", () => {
    const src = readFileSync(join(__dirname, "..", "src", "island-repo.ts"), "utf8");
    const built = src.match(/new MessageChannelNetworkAdapter\(([^)]*\)?)\)/g) ?? [];
    expect(built.length).toBe(2);
    for (const call of built) expect(call).toMatch(/new MessageChannelNetworkAdapter\(hardenedSyncPort\(/);
  });
});
