/**
 * peer-arrivals — A PEER'S SHARE STANDING COMES FROM THE RELATION ITS ARRIVAL PROVED, held in ONE table keyed by
 * (adapter, peerId), on every adapter and in both directions (road `P26`; controller transport ruling 2026-10-31).
 *
 * automerge-repo's network subsystem takes a second arrival of a live peer id as a REPLACEMENT connection and routes that
 * id through the newest adapter. The composer kept each relation by id alone, so an impostor on the dial's adapter that
 * claimed a live inbound session's id read that session's relation. The table drops a relation the moment the same id
 * arrives on another adapter, and an arrival's own unseat removes that arrival alone, never a newer seating of the id.
 *
 *   G1  RED (SHOULD 1, generation): an old island arrival's cleanup leaves a newer seating of the same id standing.
 *   B1  CONTROL: an arrival marked on its own adapter stands with the relation it proved.
 *   B2  RED: the same id arriving on a second adapter drops the first relation (its unseat hook fires once) and stands
 *       the second's.
 *   B3  RED: the same id arriving on an adapter that marks nothing drops the relation and stands none.
 *   B4  CONTROL: the displaced arrival's own unseat leaves the newer arrival standing; the newer's own unseat clears it.
 */
import { describe, test, expect } from "vitest";
import { Repo, type PeerId } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import * as island from "../src/island-repo.js";

const tick = (ms = 250) => new Promise((r) => setTimeout(r, ms));

type Arrivals = {
  of(peerId: string): { readonly adapter: object; readonly peerId: string; readonly relation: unknown } | null;
  mark(adapter: object, peerId: string, relation: unknown, onUnseat?: () => void): () => void;
};
const peerArrivalsOf = async (): Promise<((repo: Repo) => Arrivals) | null> => {
  const mod = await import("../src/peer-arrivals.js").catch(() => null) as { peerArrivals?: (repo: Repo) => Arrivals } | null;
  return mod?.peerArrivals ?? null;
};

/** A hearth Repo with one adapter that marks its arrivals with `relation`, the way the composer marks a seat. */
function marking(repo: Repo, arrivals: Arrivals, relation: string, unseated: string[]): { adapter: MessageChannelNetworkAdapter; port: MessagePort; unseats: Map<string, () => void> } {
  const channel = new MessageChannel();
  const adapter = new MessageChannelNetworkAdapter(channel.port1);
  const unseats = new Map<string, () => void>();
  adapter.on("peer-candidate", ({ peerId }) => { unseats.set(peerId, arrivals.mark(adapter, peerId, relation, () => unseated.push(`${relation}:${peerId}`))); });
  repo.networkSubsystem.addNetworkAdapter(adapter);
  return { adapter, port: channel.port2, unseats };
}

describe("one arrival table keyed by (adapter, peerId)", () => {
  test("G1 — RED (generation): an old island arrival's cleanup leaves a newer seating of the same id standing", async () => {
    const house = new Repo({ network: [], peerId: "hearth" as PeerId });
    try {
      const older = island.markIslandArrival(house, "own-island");
      island.markIslandArrival(house, "own-island");                         // the island's re-arrival on a fresh leg
      older();                                                               // the old leg's late cleanup
      expect(island.islandPeersOf(house).has("own-island"), "G1: the newer seating still stands").toBe(true);
    } finally { await house.shutdown(); }
  });

  test("B1–B4 — the relation follows the arrival; a replacement elsewhere drops it; an unseat removes its own arrival alone", async () => {
    const peerArrivals = await peerArrivalsOf();
    expect(typeof peerArrivals, "peerArrivals stands").toBe("function");
    const house = new Repo({ network: [], peerId: "hearth" as PeerId });
    const arrivals = peerArrivals!(house);
    const unseated: string[] = [];
    const inbound = marking(house, arrivals, "gate", unseated);
    const dial = marking(house, arrivals, "dial", unseated);
    const bare = new MessageChannel();
    house.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(bare.port1));
    const peers: Repo[] = [];
    try {
      peers.push(new Repo({ network: [new MessageChannelNetworkAdapter(inbound.port)], peerId: "device-two" as PeerId }));
      await tick();
      expect(arrivals.of("device-two")?.relation, "B1: the inbound arrival stands with its relation").toBe("gate");
      expect(arrivals.of("device-two")?.adapter, "B1: on its own adapter").toBe(inbound.adapter);

      peers.push(new Repo({ network: [new MessageChannelNetworkAdapter(dial.port)], peerId: "device-two" as PeerId }));
      await tick();
      expect(unseated, "B2: the inbound relation dropped once").toEqual(["gate:device-two"]);
      expect(arrivals.of("device-two")?.relation, "B2: the dial's arrival stands").toBe("dial");

      inbound.unseats.get("device-two")?.();                                 // the displaced leg's late cleanup
      expect(arrivals.of("device-two")?.relation, "B4: the newer arrival still stands").toBe("dial");
      expect(unseated, "B4: no second unseat").toEqual(["gate:device-two"]);

      peers.push(new Repo({ network: [new MessageChannelNetworkAdapter(bare.port2)], peerId: "device-two" as PeerId }));
      await tick();
      expect(arrivals.of("device-two"), "B3: an unmarked arrival stands no relation").toBeNull();
      expect(unseated, "B3: the dial's relation dropped").toEqual(["gate:device-two", "dial:device-two"]);

      peers.push(new Repo({ network: [new MessageChannelNetworkAdapter(new MessageChannel().port1)], peerId: "unused" as PeerId }));
      const own = arrivals.mark(dial.adapter, "solo", "dial", () => unseated.push("dial:solo"));
      own();
      expect(arrivals.of("solo"), "B4: an arrival's own unseat clears it").toBeNull();
      expect(unseated.at(-1)).toBe("dial:solo");
    } finally {
      for (const p of [inbound.port, dial.port, bare.port1, bare.port2]) p.close();
      await Promise.allSettled([house, ...peers].map((r) => r.shutdown()));
    }
  });
});
