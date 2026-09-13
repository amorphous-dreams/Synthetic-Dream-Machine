/**
 * A CROSSING'S CAP EVENTS ARRIVE TYPED — the variant survives the boundary after all.
 *
 * `eventsForPeer` hands a peer bare `Uint8Array[]`, so the SENDER's variant and island do not ride the
 * wire. The reading that followed — that an admitted vessel therefore cannot know them — measures the
 * wrong side. The RECEIVER's own keyhive parses those same bytes back into `Event` objects and fires its
 * OWN `event_handler`, which stamps the true variant and self-attributes the island off the event's own
 * subject. The truth is not lost in transit; it is re-derived on arrival, and the ceremony was simply
 * writing its record before asking.
 *
 * So the order IS the fix. `DaemonEventStore.put` de-dups by content hash, first-writer-wins — whoever
 * writes a given event first stamps its variant for good. Ingest first and the handler's typed row stands;
 * persist first and an `UNTYPED` row masks it permanently.
 *
 * `absorbCapEvents` is that order, named once: ingest → settle the handler's writes → persist whatever
 * keyhive did not accept (a bundle carries more than any one receiver takes) as the honest backstop.
 */
import { describe, test, expect } from "vitest";
import { buildDeviceDelegation } from "@lararium/mesh";
import { KeyhiveProvider } from "../src/keyhive-provider.js";
import { runFaceJoin, type FaceJoinContext } from "../src/face-join.js";
import { absorbCapEvents } from "../src/daemon-event-store.js";
import { CAP_EVENT_VARIANT_UNKNOWN } from "../src/daemon-event-store.js";
import type { EventRecord, EventStore } from "../src/event-store.js";

const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const b64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64"));
const NOW = Date.parse("2026-08-17T12:00:00.000Z");
const REAL_VARIANTS = ["PREKEY_ROTATED", "CGKA_OPERATION", "DELEGATED", "REVOKED"];
const hexOf = (b: Uint8Array): string => Buffer.from(b).toString("hex");

/** The rows a given bundle put in the store — the joinee's own boot events share it. */
function fromCrossing(rows: readonly EventRecord[], events: readonly Uint8Array[]): readonly EventRecord[] {
  const sent = new Set(events.map(hexOf));
  return rows.filter((r) => sent.has(hexOf(r.bytes)));
}

/** A store that keeps first-writer-wins by content hash, exactly as the daemon-backed one does. */
function recordingStore(): EventStore & { rows: EventRecord[] } {
  const rows: EventRecord[] = [];
  const keyOf = (b: Uint8Array): string => Buffer.from(b).toString("hex");
  return {
    rows,
    put: async (rec: EventRecord): Promise<void> => {
      if (rows.some((r) => keyOf(r.bytes) === keyOf(rec.bytes))) return;
      rows.push(rec);
    },
    list: async (): Promise<readonly EventRecord[]> => rows,
  };
}

/** A founder standing a face, and the crossing it packs for a joinee. */
async function crossing(): Promise<{ joineeSeed: Uint8Array; capEvents: readonly string[]; founderCard: string }> {
  const noop = { put: async (): Promise<void> => {}, list: async (): Promise<readonly EventRecord[]> => [] };
  const phone = new KeyhiveProvider();
  await phone.init({ seed: seedOf(61), eventStore: noop });
  const laptopSeed = seedOf(62);
  const laptop = new KeyhiveProvider();
  await laptop.init({ seed: laptopSeed, eventStore: noop });

  const pg = await phone.createSentinelDoc("lar:///ha.ka.ba/sentinel/pg-absorb");
  await phone.addSentinelMember(await phone.vesselIdentifierHex(), pg.docIdHex);
  const edge = await buildDeviceDelegation({
    personaRootSeed:    seedOf(213),
    deviceVerifyingKey: (await laptop.whoami()).replace(/^0x/, ""),
    hearthTrueName:     "",
    issuedAt:           "2026-08-17T11:00:00.000Z",
    expiresAt:          "2026-09-17T11:00:00.000Z",
    boundEpoch:         0,
  });
  const ctx: FaceJoinContext = {
    personaRootDid:         edge.personaRootDid,
    hearthTrueName:         "",
    personaGroupDocIdHex:   pg.docIdHex,
    personaGroupAgentIdHex: pg.agentIdHex,
    leaseEpoch:             0,
    now:                    NOW,
  };
  const out = await runFaceJoin(phone, {
    kind:        "face-join/v1",
    contactCard: new TextDecoder().decode(await laptop.contactCard()),
    deviceEdge:  edge,
  }, ctx);
  if (!out.ok) throw new Error(`the fixture's own join failed: ${JSON.stringify(out)}`);
  return { joineeSeed: laptopSeed, capEvents: out.grant.capEvents, founderCard: out.grant.founderCard };
}

/** The joinee, stood on its own seed against a recording store, holding the founder's card. */
async function joinee(seed: Uint8Array, founderCard: string): Promise<{ kh: KeyhiveProvider; store: EventStore & { rows: EventRecord[] } }> {
  const store = recordingStore();
  const kh = new KeyhiveProvider();
  await kh.init({ seed, eventStore: store });
  await kh.receiveContactCard(new TextEncoder().encode(founderCard));
  return { kh, store };
}

describe("what an admitted vessel records about the events it takes", () => {
  test("★ absorbing a crossing stamps REAL variants — the receiver re-derives what the wire dropped ★", async () => {
    const c = await crossing();
    const { kh, store } = await joinee(c.joineeSeed, c.founderCard);

    const events = c.capEvents.map(b64);
    await absorbCapEvents(kh, store, events);

    // The joinee's OWN boot and card-receipt fire events into this same store — read only the rows the
    // crossing put there, or the fixture's noise answers for the crossing.
    const crossed = fromCrossing(store.rows, events);
    const typed = crossed.filter((r) => REAL_VARIANTS.includes(r.variant));
    expect(typed.length, "no row carries a variant from the real vocabulary").toBeGreaterThan(0);
    // A membership crossing is a DELEGATED grant plus the CGKA ops that key the joinee's leaf — the
    // delegation is the one every crossing must carry, so it is the row worth naming.
    expect(typed.map((r) => r.variant)).toContain("DELEGATED");

    // CIV-3 — a delegation self-attributes its island off its own subject bytes. That stamp is what keeps
    // a per-island slice from co-loading the whole store, and it survives the crossing for free.
    const delegated = typed.filter((r) => r.variant === "DELEGATED");
    expect(delegated.every((r) => typeof r.island === "string" && r.island.length > 0),
      "a delegation reached the store with no island").toBe(true);

    // EVERY event still lands. Keyhive accepts a subset of any bundle; the rest persist untyped rather
    // than vanish, so a boot replay sees the whole crossing.
    expect(crossed.length).toBe(c.capEvents.length);
    await kh.dispose();
  }, 60_000);

  test("★ a bundle keyhive cannot read still lands — the read may fail, the record may not ★", async () => {
    const c = await crossing();
    const { kh, store } = await joinee(c.joineeSeed, c.founderCard);

    // Bytes no keyhive will deserialize. It refuses the WHOLE array, so a crossing from a peer running other
    // code would abort an admit outright if the ingest were allowed to throw past this door.
    const junk = [new TextEncoder().encode("membership-op-1"), new TextEncoder().encode("membership-op-2")];
    await absorbCapEvents(kh, store, junk);

    const landed = fromCrossing(store.rows, junk);
    expect(landed.length, "an unreadable bundle cost the vessel its events").toBe(junk.length);
    expect(landed.every((r) => r.variant === CAP_EVENT_VARIANT_UNKNOWN)).toBe(true);
    await kh.dispose();
  }, 60_000);

  test("CONTROL — persisting BEFORE the ingest masks the truth permanently (the order is the whole fix)", async () => {
    const c = await crossing();
    const { kh, store } = await joinee(c.joineeSeed, c.founderCard);

    // The naive order: write the record, then ingest. First-writer-wins means the handler's typed row is
    // refused as a duplicate, and the sentinel stands forever over an event whose variant was knowable.
    const events = c.capEvents.map(b64);
    for (const bytes of events) await store.put({ bytes, variant: CAP_EVENT_VARIANT_UNKNOWN, hash: "" });
    await kh.ingestPeerEvents(events);
    await kh.settleEvents();

    expect(fromCrossing(store.rows, events).every((r) => r.variant === CAP_EVENT_VARIANT_UNKNOWN),
      "the control did not actually mask — this test proves nothing").toBe(true);
    await kh.dispose();
  }, 60_000);
});
