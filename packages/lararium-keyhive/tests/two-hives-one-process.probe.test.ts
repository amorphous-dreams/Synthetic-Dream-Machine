/**
 * K15 step 1 — two Keyhive instances share a process only if their identities, documents,
 * events and archives hold apart through interleaving, reboot and lawful public cross-read.
 *
 * Both outcomes stand named: ISOLATION HOLDS, so one process may serve several faces; or
 * state crosses, so each face hive runs in its own worker. This probe expects ISOLATION.
 */
import { describe, expect, test } from "vitest";
import { InMemoryEventStore, KeyhiveProvider } from "../src/index.js";

const BAG_A = "lar:///probe.face-a/book";
const BAG_B = "lar:///probe.face-b/book";
const strip = (id: string): string => id.replace(/^0x/, "").toLowerCase();
const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const storeOf = (p: KeyhiveProvider): InMemoryEventStore => (p as unknown as { eventStore: InMemoryEventStore }).eventStore;

async function stand(fill: number, eventStore: InMemoryEventStore, archiveBytes?: Uint8Array): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(fill), eventStore, ...(archiveBytes ? { archiveBytes } : {}) });
  return p;
}

async function byteStream(store: InMemoryEventStore): Promise<string> {
  return (await store.list()).map((record) => hex(record.bytes)).join("|");
}

// MEASURED 2026-10-18 (three runs, Keyhive 0.3.0-alpha.1): ISOLATION HOLDS. Interleaved register, delegate and revoke,
// a dispose-and-re-init over each own store and archive, and a lawful cross-read leave neither hive knowing the other's
// agents, holding the other's bag, verifying for the other, or carrying the other's identifier or bag doc id in its
// store or archive; the shared-store control reads both identifiers, so the scan bites. K15's house reading (one process
// only after this probe proves separation) stands measured; a Keyhive bump re-reads it.
describe("K15: two Keyhive hives hold apart in one process", () => {
  test("interleaving, reboot and lawful cross-read preserve isolation; shared-store controls bite", { timeout: 90_000 }, async () => {
    const storeA = new InMemoryEventStore(), storeB = new InMemoryEventStore();
    const a = await stand(0xa1, storeA), b = await stand(0xb2, storeB);
    const readerA = await stand(0xa3, new InMemoryEventStore());
    const readerB = await stand(0xb4, new InMemoryEventStore());
    const aId = strip(await a.vesselIdentifierHex()), bId = strip(await b.vesselIdentifierHex());
    const readerAId = strip(await readerA.vesselIdentifierHex()), readerBId = strip(await readerB.vesselIdentifierHex());

    await a.receiveContactCard(await readerA.contactCard());
    await readerA.receiveContactCard(await a.contactCard());
    await b.receiveContactCard(await readerB.contactCard());
    await readerB.receiveContactCard(await b.contactCard());

    // Each mutation stands alone and alternates strictly between the two hives.
    const docA = await a.registerBag(BAG_A);
    const docB = await b.registerBag(BAG_B);
    const delegationA = await a.delegate({ audience: readerAId, bagUrl: BAG_A, access: "read" });
    const delegationB = await b.delegate({ audience: readerBId, bagUrl: BAG_B, access: "read" });
    await a.revoke(delegationA.delegationId);

    const assertApart = async (left: KeyhiveProvider, right: KeyhiveProvider, leftStore: InMemoryEventStore,
      rightStore: InMemoryEventStore, leftBag: string, rightBag: string, rightId: string, rightReaderId: string,
      rightDocId: string): Promise<void> => {
      expect(await left.holdsHand(rightBag)).toBe(false);
      expect((await left.verify({ bagUrl: rightBag, presenter: rightReaderId, access: "read" })).ok).toBe(false);
      expect(await right.holdsHand(leftBag)).toBe(false);
      expect((await right.verify({ bagUrl: leftBag, presenter: rightId, access: "read" })).ok).toBe(false);
      expect(await left.knowsAgent(rightId)).toBe(false);
      expect(await left.knowsAgent(rightReaderId)).toBe(false);
      expect(await right.knowsAgent(aId)).toBe(false);
      expect(await right.knowsAgent(readerAId)).toBe(false);
      const leftBytes = await byteStream(leftStore), rightBytes = await byteStream(rightStore);
      expect(leftBytes).not.toContain(rightId);
      expect(leftBytes).not.toContain(strip(rightDocId));
      expect(rightBytes).not.toContain(aId);
      expect(rightBytes).not.toContain(strip(docA.docId));
      expect(hex(await left.exportArchive())).not.toContain(rightId);
      expect(hex(await right.exportArchive())).not.toContain(aId);
    };

    await readerB.ingestPeerEvents(await b.eventsForPeer(readerBId));
    expect((await b.verify({ bagUrl: BAG_B, presenter: readerBId, access: "read" })).ok).toBe(true);
    await assertApart(a, b, storeA, storeB, BAG_A, BAG_B, bId, readerBId, docB.docId);
    expect((await a.verify({ bagUrl: BAG_A, presenter: readerAId, access: "read" })).ok).toBe(false);

    const archiveA = await a.exportArchive(), archiveB = await b.exportArchive();
    await a.dispose(); await b.dispose();
    const rebootA = await stand(0xa1, storeA, archiveA), rebootB = await stand(0xb2, storeB, archiveB);
    rebootA.adoptBag(BAG_A, docA.docId); rebootB.adoptBag(BAG_B, docB.docId);
    await rebootA.hydrateFromEventStore(); await rebootB.hydrateFromEventStore();
    await assertApart(rebootA, rebootB, storeA, storeB, BAG_A, BAG_B, bId, readerBId, docB.docId);
    expect((await rebootA.verify({ bagUrl: BAG_A, presenter: readerAId, access: "read" })).ok).toBe(false);
    expect((await rebootB.verify({ bagUrl: BAG_B, presenter: readerBId, access: "read" })).ok).toBe(true);

    // B may learn A's public events addressed to readerA: the lawful wire carries no hand over A's bag.
    await rebootB.ingestPeerEvents(await rebootA.eventsForPeer(readerAId));
    expect(await rebootB.holdsHand(BAG_A)).toBe(false);
    expect(await rebootB.holdsHand(BAG_B)).toBe(true);
    expect((await rebootB.verify({ bagUrl: BAG_B, presenter: readerBId, access: "read" })).ok).toBe(true);

    // Shared-store control: cross-presence reads positive for identifiers and bag document ids.
    const shared = new InMemoryEventStore();
    const sharedA = await stand(0xc1, shared), sharedB = await stand(0xc2, shared);
    const sharedAId = strip(await sharedA.vesselIdentifierHex()), sharedBId = strip(await sharedB.vesselIdentifierHex());
    const sharedDocA = await sharedA.registerBag("lar:///probe.shared-a/book");
    await sharedB.registerBag("lar:///probe.shared-b/book");
    const sharedBytes = await byteStream(shared);
    expect(sharedBytes).toContain(sharedAId);
    expect(sharedBytes).toContain(sharedBId);
    expect(sharedBytes).toContain(strip(sharedDocA.docId));

    // Single-hive control: its own identifier is present in its event store.
    const ownStore = new InMemoryEventStore(), own = await stand(0xd1, ownStore);
    const ownId = strip(await own.vesselIdentifierHex());
    await own.registerBag("lar:///probe.own/book");
    expect(await byteStream(ownStore)).toContain(ownId);

    await readerA.dispose(); await readerB.dispose();
    await rebootA.dispose(); await rebootB.dispose(); await sharedA.dispose(); await sharedB.dispose(); await own.dispose();
  });
});
