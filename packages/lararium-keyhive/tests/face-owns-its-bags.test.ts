/**
 * K15 step 2 — each face creates and carries its own bag events.
 * The law scans two face streams for shared vessel or face identifiers; the control exercises
 * the vessel-to-veil road and confirms that the vessel identifier links both streams.
 */
import { describe, expect, test } from "vitest";
import { InMemoryEventStore, KeyhiveProvider, makeFaceBagDoor } from "../src/index.js";

const strip = (id: string): string => id.replace(/^0x/, "").toLowerCase();
const bytesHex = (events: Uint8Array[]): string => events
  .map((event) => Array.from(event, (byte) => byte.toString(16).padStart(2, "0")).join(""))
  .join("|");

async function stand(fill: number, eventStore: InMemoryEventStore): Promise<KeyhiveProvider> {
  const provider = new KeyhiveProvider();
  await provider.init({ seed: new Uint8Array(32).fill(fill), eventStore });
  return provider;
}

async function exchangeCards(a: KeyhiveProvider, b: KeyhiveProvider): Promise<void> {
  await a.receiveContactCard(await b.contactCard());
  await b.receiveContactCard(await a.contactCard());
}

async function disposeAll(providers: KeyhiveProvider[]): Promise<void> {
  await Promise.all(providers.map((provider) => provider.dispose()));
}

describe("K15 step 2: each face owns its bag identity and events", () => {
  test("law — each face carries its own bag without shared vessel or face identifiers", { timeout: 90_000 }, async () => {
    const shared = new InMemoryEventStore();
    const hostStore = new InMemoryEventStore();
    const vessel = await stand(0x71, shared);
    const faceA = await stand(0x72, shared);
    const faceB = await stand(0x73, shared);
    const host = await stand(0x74, hostStore);
    const providers = [vessel, faceA, faceB, host];

    try {
      const vesselId = strip(await vessel.vesselIdentifierHex());
      const faceAId = strip(await faceA.vesselIdentifierHex());
      const faceBId = strip(await faceB.vesselIdentifierHex());
      const { id: hostId } = await faceA.receiveContactCard(await host.contactCard());
      await faceB.receiveContactCard(await host.contactCard());
      await host.receiveContactCard(await faceA.contactCard());
      await host.receiveContactCard(await faceB.contactCard());

      const groupA = await faceA.createGroup();
      const groupB = await faceB.createGroup();
      await faceA.addGroupMember(hostId, groupA.groupId);
      await faceB.addGroupMember(hostId, groupB.groupId);

      const bagA = "lar:///k15.face-a/owned-bag";
      const bagB = "lar:///k15.face-b/owned-bag";
      const doorA = makeFaceBagDoor({ face: faceA, groupId: groupA.groupId });
      const doorB = makeFaceBagDoor({ face: faceB, groupId: groupB.groupId });
      await doorA.mint(bagA, "admin");
      await doorB.mint(bagB, "admin");
      await faceA.delegate({ bagUrl: bagA, audience: hostId, access: "read" });
      await faceB.delegate({ bagUrl: bagB, audience: hostId, access: "read" });

      const [eventsA, eventsB] = await Promise.all([
        faceA.eventsForPeer(hostId),
        faceB.eventsForPeer(hostId),
      ]);
      const streamA = bytesHex(eventsA);
      const streamB = bytesHex(eventsB);
      expect(eventsA.length).toBeGreaterThan(0);
      expect(eventsB.length).toBeGreaterThan(0);

      expect(streamA, "the vessel identifier stays out of face A's carried bytes").not.toContain(vesselId);
      expect(streamB, "the vessel identifier stays out of face B's carried bytes").not.toContain(vesselId);
      for (const id of [vesselId, faceAId, faceBId]) {
        expect(streamA.includes(id) && streamB.includes(id), `${id} must not link the two face streams`).toBe(false);
      }
      expect(streamA, "face A's own veil identifier spells in its stream").toContain(faceAId);
      expect(streamB, "face B's own veil identifier spells in its stream").toContain(faceBId);
      expect((await faceA.verify({ bagUrl: bagA, presenter: hostId, access: "read" })).ok).toBe(true);
      expect((await faceB.verify({ bagUrl: bagB, presenter: hostId, access: "read" })).ok).toBe(true);
      expect((await faceA.verify({ bagUrl: bagA, presenter: vesselId, access: "read" })).ok).toBe(false);
      expect((await faceB.verify({ bagUrl: bagB, presenter: vesselId, access: "read" })).ok).toBe(false);
    } finally {
      await disposeAll(providers);
    }
  });

  test("control — today's vessel-to-veil road links both face streams with the vessel identifier", { timeout: 90_000 }, async () => {
    const shared = new InMemoryEventStore();
    const hostStore = new InMemoryEventStore();
    const vessel = await stand(0x75, shared);
    const faceA = await stand(0x76, shared);
    const faceB = await stand(0x77, shared);
    const host = await stand(0x78, hostStore);
    const providers = [vessel, faceA, faceB, host];

    try {
      const vesselId = strip(await vessel.vesselIdentifierHex());
      const road = async (face: KeyhiveProvider, groupId: string, bagUrl: string): Promise<string> => {
        await vessel.registerBag(bagUrl);
        await exchangeCards(vessel, face);
        const faceId = await face.vesselIdentifierHex();
        await vessel.delegate({ bagUrl, audience: faceId, access: "admin" });
        await face.ingestPeerEvents(await vessel.eventsForPeer(faceId));
        const { docId } = await vessel.registerBag(bagUrl);
        face.adoptBag(bagUrl, docId);
        await face.delegate({ bagUrl, audience: groupId, access: "admin" });
        await exchangeCards(face, host);
        const { id: hostId } = await face.receiveContactCard(await host.contactCard());
        await face.delegate({ bagUrl, audience: hostId, access: "read" });
        return bytesHex(await face.eventsForPeer(hostId));
      };

      const groupA = await faceA.createGroup();
      const groupB = await faceB.createGroup();
      const streamA = await road(faceA, groupA.groupId, "lar:///k15.control.face-a/owned-bag");
      const streamB = await road(faceB, groupB.groupId, "lar:///k15.control.face-b/owned-bag");

      expect(streamA).toContain(vesselId);
      expect(streamB).toContain(vesselId);
    } finally {
      await disposeAll(providers);
    }
  });
});
