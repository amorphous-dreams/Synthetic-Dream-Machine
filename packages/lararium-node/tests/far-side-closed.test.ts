/**
 * THE FAR SIDE CLOSES (road row G36): the island's watch for the link that would carry a settle word's heads.
 * It resolves when the Repo holds no sync peer: at once where it holds none, else when the last peer
 * disconnects. A disconnect that leaves another peer standing leaves the watch pending, and a cancelled watch
 * leaves no listener behind. No clock decides.
 */
import { describe, test, expect } from "vitest";
import { EventEmitter } from "node:events";
import { farSideClosedOf } from "../src/island-behaviors.js";

const flush = async (): Promise<void> => { for (let i = 0; i < 3; i++) await new Promise<void>((r) => setImmediate(r)); };

function repoWith(...peers: string[]) {
  const net = new EventEmitter();
  const repo = { peers: [...peers], networkSubsystem: net } as unknown as Parameters<typeof farSideClosedOf>[0];
  return { repo, net, peers: (repo as unknown as { peers: string[] }).peers };
}

describe("farSideClosedOf", () => {
  test("a Repo with no peer has already lost its far side", async () => {
    const { repo } = repoWith();
    let closed = false;
    void farSideClosedOf(repo).promise.then(() => { closed = true; });
    await flush();
    expect(closed).toBe(true);
  });

  test("the last peer's disconnect closes it; an earlier disconnect leaves it pending", async () => {
    const { repo, net, peers } = repoWith("relay", "sibling");
    let closed = false;
    void farSideClosedOf(repo).promise.then(() => { closed = true; });
    peers.splice(peers.indexOf("sibling"), 1);
    net.emit("peer-disconnected", { peerId: "sibling" });
    await flush();
    expect(closed, "a peer still stands").toBe(false);
    peers.splice(0, 1);
    net.emit("peer-disconnected", { peerId: "relay" });
    await flush();
    expect(closed).toBe(true);
    expect(net.listenerCount("peer-disconnected"), "the watch drops its listener once it fires").toBe(0);
  });

  test("a cancelled watch leaves no listener behind, and never fires", async () => {
    const { repo, net, peers } = repoWith("relay");
    let closed = false;
    const watch = farSideClosedOf(repo);
    void watch.promise.then(() => { closed = true; });
    expect(net.listenerCount("peer-disconnected")).toBe(1);
    watch.cancel();
    expect(net.listenerCount("peer-disconnected")).toBe(0);
    peers.splice(0, 1);
    net.emit("peer-disconnected", { peerId: "relay" });
    await flush();
    expect(closed).toBe(false);
  });
});
