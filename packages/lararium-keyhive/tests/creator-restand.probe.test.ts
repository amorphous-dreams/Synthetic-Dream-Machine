/**
 * creator-restand probe — what a document's CREATOR keeps when it stands again from its seed.
 *
 * A boot re-stands a keyhive identity three ways: from the seed and the replayed cap events alone, from the
 * seed with its prekey secrets imported before the replay, or from its Archive. The seed names the identity
 * in all three. The document's CGKA does not follow the name: it initialises only for a holder of the prekey
 * secret the creator's leaf was keyed to. A probe measures; each row below is a reading with its control.
 *
 *   EVENTS ALONE              the document is known and its CGKA stands empty: the creator can neither seat
 *                             a member nor seal a chunk ("Cgka is not initialized").
 *   PREKEY SECRETS + EVENTS   the replay initialises the CGKA: the creator seats and seals.
 *   ARCHIVE                   the creator seats, seals, and opens what it sealed before.
 *
 * So the cap events carry the membership lattice and never the creator's hand: a founding that means its
 * creator to act after the ceremony's provider is disposed must keep that provider's secrets (the Archive, or
 * `exportPrekeySecrets`) from the founding instant.
 */
import { describe, expect, test } from "vitest";
import type * as KH from "@keyhive/keyhive/slim";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";

const CREATOR = new Uint8Array(32).fill(0x51);
const rawKh = (p: KeyhiveProvider): KH.Keyhive => (p as unknown as { requireKh: () => KH.Keyhive }).requireKh();

/** A creator that founded one sentinel and sealed one chunk under a bag, with everything a re-stand could carry. */
async function founded() {
  const store = new InMemoryEventStore();
  const creator = new KeyhiveProvider();
  await creator.init({ seed: CREATOR, eventStore: store });
  const sentinel = await creator.createSentinelDoc("lar:///probe.restand.sentinel");
  const bagUrl = "lar:///probe.restand.bag";
  const { docId } = await creator.registerBag(bagUrl);
  const sealed = await creator.encryptContent(bagUrl, new TextEncoder().encode("sealed at the founding"));
  await creator.settleEvents();
  const events = await store.list();
  const prekeySecrets = await rawKh(creator).exportPrekeySecrets();
  const archive = await creator.exportArchive();
  await creator.dispose();
  return { sentinel, bagUrl, docId, sealed, events, prekeySecrets, archive };
}

async function replayInto(p: KeyhiveProvider, events: Awaited<ReturnType<typeof founded>>["events"], store: InMemoryEventStore) {
  for (const r of events) await store.put(r);
  return p.hydrateFromEventStore();
}

/** Seat a fresh guest on the sentinel; resolves to whether the guest then rides its CGKA. */
async function seats(p: KeyhiveProvider, sentinelDocIdHex: string, fill: number): Promise<boolean> {
  const guest = new KeyhiveProvider();
  await guest.init({ seed: new Uint8Array(32).fill(fill), eventStore: new InMemoryEventStore() });
  const { id } = await p.receiveContactCard(await guest.contactCard());
  await p.addSentinelMember(id, sentinelDocIdHex);
  await guest.dispose();
  return (await p.sentinelCgkaMembers(sentinelDocIdHex)).includes(id);
}

describe("a creator re-stood from its seed", () => {
  test("EVENTS ALONE: the name stands, the document is known, and the creator's hand is gone", async () => {
    const f = await founded();
    const store = new InMemoryEventStore();
    const p = new KeyhiveProvider();
    await p.init({ seed: CREATOR, eventStore: store });
    const replay = await replayInto(p, f.events, store);
    expect(replay.skipped).toBe(0);                                         // CONTROL: every event was readable
    expect(replay.ingested).toBeGreaterThan(0);
    expect(await p.sentinelCgkaMembers(f.sentinel.docIdHex)).toEqual([]);    // known, with an empty CGKA
    await expect(seats(p, f.sentinel.docIdHex, 0x61)).rejects.toThrow(/Cgka is not initialized/);
    p.adoptBag(f.bagUrl, f.docId);
    await expect(p.encryptContent(f.bagUrl, new Uint8Array([1]))).rejects.toThrow(/Cgka is not initialized/);
    await expect(p.decryptContent(f.bagUrl, f.sealed)).rejects.toThrow();
    await p.dispose();
  });

  test("PREKEY SECRETS before the replay: the CGKA initialises, and the creator seats and seals", async () => {
    const f = await founded();
    const store = new InMemoryEventStore();
    const p = new KeyhiveProvider();
    await p.init({ seed: CREATOR, eventStore: store });
    await rawKh(p).importPrekeySecrets(f.prekeySecrets);
    await replayInto(p, f.events, store);
    expect((await p.sentinelCgkaMembers(f.sentinel.docIdHex)).length).toBe(1);
    expect(await seats(p, f.sentinel.docIdHex, 0x62)).toBe(true);
    p.adoptBag(f.bagUrl, f.docId);
    expect((await p.encryptContent(f.bagUrl, new Uint8Array([1]))).byteLength).toBeGreaterThan(0);
    await p.dispose();
  });

  test("ARCHIVE: the creator seats, seals, and opens what it sealed before", async () => {
    const f = await founded();
    const p = new KeyhiveProvider();
    await p.init({ seed: CREATOR, eventStore: new InMemoryEventStore(), archiveBytes: f.archive });
    expect(await seats(p, f.sentinel.docIdHex, 0x63)).toBe(true);
    p.adoptBag(f.bagUrl, f.docId);
    expect(new TextDecoder().decode(await p.decryptContent(f.bagUrl, f.sealed))).toBe("sealed at the founding");
    expect((await p.encryptContent(f.bagUrl, new Uint8Array([1]))).byteLength).toBeGreaterThan(0);
    await p.dispose();
  });
});
