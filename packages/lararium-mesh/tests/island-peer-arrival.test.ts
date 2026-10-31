/**
 * island-peer-arrival — A HOUSE'S OWN ISLAND IS PROVEN BY ARRIVAL, never by its id alone (road `P26`; controller ruling
 * 2026-10-31).
 *
 * automerge-repo's network subsystem accepts a second arrival of a live peer id as a "replacement connection": it routes
 * that id's traffic through the newest adapter and drops the older adapter's messages as stale
 * (`@automerge/automerge-repo` NetworkSubsystem, the `peer-candidate` handler). The house's positive set keyed the id
 * alone, so a remote on another adapter (a dial) that claimed a standing island's id read as the house's own and pulled a
 * private document. The cure marks each island arrival on the island adapter's own `peer-candidate`, and unseats an id
 * whenever the subsystem hears it arrive with no island arrival pending (a replacement elsewhere).
 *
 *   C1  CONTROL: the real island reads as the house's own, and reads a private document.
 *   R1  RED: a peer on another adapter claiming the island's id unseats it and draws the wire's denial.
 *   C2  CONTROL: the real island's own re-arrival on its adapter seats it again (a replacement race never locks the house
 *       out of its own island), and the impostor still reads nothing.
 */
import { describe, test, expect } from "vitest";
import { Repo, type PeerId } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { attachMessageChannelSync, islandPeersOf } from "../src/island-repo.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";

const settle = async <T,>(p: Promise<T>, ms: number): Promise<"ready" | "unavailable" | "timeout"> =>
  Promise.race([p.then(() => "ready" as const, () => "unavailable" as const), new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms))]);
const tick = (ms = 250) => new Promise((r) => setTimeout(r, ms));

describe("a house's own island is proven by arrival", () => {
  test("C1 / R1 / C2 — the island reads house; an impostor's claim unseats it; the island's re-arrival seats it again", async () => {
    let house!: Repo;
    const isHouse = async (peerId: string) => islandPeersOf(house).has(peerId);
    house = new Repo({ network: [], peerId: "hearth" as PeerId, shareConfig: { announce: isHouse, access: isHouse } });
    const priv = house.create<LarDoc>(emptyLarDoc());
    const isle = new MessageChannel();
    attachMessageChannelSync(house, isle.port1);
    const island = new Repo({ network: [new MessageChannelNetworkAdapter(isle.port2)], peerId: "own-island" as PeerId });
    const dial = new MessageChannel();
    let impostor: Repo | null = null;
    try {
      await tick();
      expect(islandPeersOf(house).has("own-island"), "C1: the real island reads house").toBe(true);
      expect(await settle(island.find<LarDoc>(priv.url).then((h) => h.doc()), 3_000), "C1: the island reads a private document").toBe("ready");

      house.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(dial.port1));
      impostor = new Repo({ network: [new MessageChannelNetworkAdapter(dial.port2)], peerId: "own-island" as PeerId });
      await tick();
      expect(islandPeersOf(house).has("own-island"), "R1: the claim on another adapter unseats the id").toBe(false);
      expect(await settle(impostor.find<LarDoc>(priv.url).then((h) => h.doc()), 3_000), "R1: the impostor reads nothing").not.toBe("ready");

      // THE ISLAND'S OWN RE-ARRIVAL, on the very adapter the vessel attached for it.
      isle.port2.postMessage({ type: "arrive", senderId: "own-island", peerMetadata: {} });
      await tick();
      expect(islandPeersOf(house).has("own-island"), "C2: the island's re-arrival seats it again").toBe(true);
      const late = house.create<LarDoc>(emptyLarDoc());
      expect(await settle(impostor.find<LarDoc>(late.url).then((h) => h.doc()), 3_000), "C2: the impostor still reads nothing").not.toBe("ready");
    } finally {
      for (const p of [isle.port1, isle.port2, dial.port1, dial.port2]) p.close();
      await Promise.allSettled([house, island, ...(impostor ? [impostor] : [])].map((r) => r.shutdown()));
    }
  });
});
