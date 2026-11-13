/**
 * bag-event-creator — does the carried bag event stream name the identity that created it?
 * Both outcomes named ahead:
 *   · vessel id IN the bytes → W25's creator leak is measured; registering bags under a veil
 *     must flip this canary, and the lane that hides the creator turns it into a law test;
 *   · vessel id ABSENT → this event stream does not carry the vessel creator in cleartext.
 */
import { describe, test, expect } from "vitest";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";

async function vessel(fill: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(fill), eventStore: new InMemoryEventStore() });
  return p;
}
const strip = (id: string): string => id.replace(/^0x/, "").toLowerCase();
const bytesHex = (events: Uint8Array[]): string => events
  .map((e) => Array.from(e).map((b) => b.toString(16).padStart(2, "0")).join(""))
  .join("|");
const BAG = "lar:///probe.bag.creator";

// MEASURED 2026-10-18: vesselIdInCleartext TRUE · veil-created stream carries no vessel id · host id spells (the scan
// bites). A bag the RAW vessel identity registers names that vessel in every event it carries to a reader: roadmap row
// W25's leak, measured red-first. Production registers each bag so (`boot-daemon-keyhive.ts` registerBags,
// `operator-daemon-behavior.ts` delegateToFaceViaVeil). Once bags register under a veil, the first canary flips, and
// the lane that hides the creator turns it into a law test.
describe("who creates the bag events a host receives", () => {
  test("★ THE MEASURE — vessel registers the bag, then delegates read to host ★", { timeout: 90_000 }, async () => {
    const creator = await vessel(0x61);
    const host = await vessel(0x62);
    const creatorId = strip(await creator.vesselIdentifierHex());
    await creator.registerBag(BAG);
    const { id: hostId } = await creator.receiveContactCard(await host.contactCard());
    await creator.delegate({ bagUrl: BAG, audience: hostId, access: "read" });
    const events = await creator.eventsForPeer(hostId);
    const streamHex = bytesHex(events);

    expect(events.length).toBeGreaterThan(0);
    // CANARY: the RAW vessel registration path spells its creator.
    expect(streamHex.includes(creatorId), "W25: vessel creator spells in carried bag events").toBe(true);
  });

  test("control — a separately seeded veil creates the bag stream", { timeout: 90_000 }, async () => {
    const vesselId = await vessel(0x63);
    const veil = await vessel(0x64);
    const host = await vessel(0x65);
    const vesselHex = strip(await vesselId.vesselIdentifierHex());
    const veilHex = strip(await veil.vesselIdentifierHex());
    await veil.registerBag("lar:///probe.bag.creator.veil");
    const { id: hostId } = await veil.receiveContactCard(await host.contactCard());
    await veil.delegate({ bagUrl: "lar:///probe.bag.creator.veil", audience: hostId, access: "read" });
    const events = await veil.eventsForPeer(hostId);
    const streamHex = bytesHex(events);

    expect(events.length).toBeGreaterThan(0);
    expect(streamHex.includes(vesselHex), "the vessel creator stays out of veil-created events").toBe(false);
    expect(streamHex.includes(veilHex), "the veil creator may spell in its own event stream").toBe(true);
  });

  test("control — the host identifier is visible to prove the byte scan detects stream IDs", { timeout: 90_000 }, async () => {
    const creator = await vessel(0x66);
    const host = await vessel(0x67);
    await creator.registerBag("lar:///probe.bag.creator.instrument");
    const { id: hostId } = await creator.receiveContactCard(await host.contactCard());
    await creator.delegate({ bagUrl: "lar:///probe.bag.creator.instrument", audience: hostId, access: "read" });
    const events = await creator.eventsForPeer(hostId);
    const streamHex = bytesHex(events);

    expect(events.length).toBeGreaterThan(0);
    expect(streamHex.includes(strip(hostId)), "the known host identifier rides the stream").toBe(true);
  });
});
