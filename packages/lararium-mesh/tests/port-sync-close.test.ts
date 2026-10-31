/**
 * port-sync-close — A SESSION LEG'S PORT THAT CLOSES TAKES ITS PEER WITH IT (road `P26`; Sol's lanes read, SHOULD 1).
 *
 * A session island's worker that ends, or a port its side closed, posts no `leave`; the leg's adapter kept the id seated, so
 * the house's arrival table read a gone island as standing.
 *
 *   C1  CONTROL: an arrival on the leg's port names its peer.
 *   R1  RED: the port's close disconnects that peer.
 */
import { describe, expect, test } from "vitest";
import type { PeerId } from "@automerge/automerge-repo";
import { PortSyncAdapter } from "../src/gated-sync-leg.js";

const tick = (ms = 100) => new Promise((r) => setTimeout(r, ms));

describe("a session leg's port that closes takes its peer with it", () => {
  test("C1 / R1", async () => {
    const channel = new MessageChannel();
    const adapter = new PortSyncAdapter(channel.port1);
    const seen: string[] = [];
    adapter.on("peer-candidate", ({ peerId }) => seen.push(`in:${peerId}`));
    adapter.on("peer-disconnected", ({ peerId }) => seen.push(`out:${peerId}`));
    adapter.connect("house" as PeerId);
    channel.port2.start();
    channel.port2.postMessage({ type: "arrive", senderId: "session-island", peerMetadata: {} });
    await tick();
    expect(seen, "C1: the arrival names its peer").toEqual(["in:session-island"]);
    channel.port2.close();
    await tick();
    expect(seen, "R1: the port's close disconnects the peer").toEqual(["in:session-island", "out:session-island"]);
    adapter.disconnect();
  });
});
