/**
 * face-recard-reads — the recard's keyhive floor: a card minted BEFORE the bags opens a stand whose Archive lags its log, and
 * what the face can no longer read refuses by name.
 *
 *   CARD FIRST          a before-the-card lineage that refuses `PrekeySecretAbsent` registers again once its stand mints its
 *                       card first, keeping its identity, and the Archive after that card opens the next ordinary stand.
 *   PEER SEAL           content a peer sealed to a card whose secret no kept Archive held reads `ContentKeyNotHeld`, by bag,
 *                       claiming no permanent loss (the same keyhive answer covers a key that has not arrived by sync).
 *   LOST DOCUMENT       a key-not-found seal under a Document a RECARD's stand reminted reads `SealedUnderLostDocument`, by bag;
 *                       the same remint on an ordinary stand reads `ContentKeyNotHeld`, and a tampered seal keeps its own name.
 */
import { describe, expect, test } from "vitest";
import { ContentKeyNotHeld, InMemoryEventStore, KeyhiveProvider, PrekeySecretAbsent, SealedUnderLostDocument, registerBagsDurably, type BagDocLedger } from "../src/index.js";

const BAG = "lar:///probe.recard.bag";
const text = (s: string): Uint8Array => new TextEncoder().encode(s);

function ledgerOf(): BagDocLedger & { readonly rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return { rows, get: async (bag) => rows.get(bag) ?? null, put: async (bag, docId) => { rows.set(bag, docId); } };
}

/** One before-the-card stand: restore, replay, register, Archive taken BEFORE its card. */
async function staleStand(seed: Uint8Array, store: InMemoryEventStore, ledger: BagDocLedger, archive: Uint8Array | null, i: number): Promise<Uint8Array> {
  const p = new KeyhiveProvider();
  await p.init({ seed, eventStore: store, ...(archive ? { archiveBytes: archive } : {}) });
  try {
    await p.hydrateFromEventStore();
    await registerBagsDurably({ provider: p, bags: [BAG, `lar:///probe.recard.stand-${i}`], ledger });
    const next = await p.exportArchive();
    await p.contactCard();
    await p.settleEvents();
    return next;
  } finally { await p.dispose(); }
}

/** Walk a lineage stale: answers the last Archive whose stand stood, the one the refusing stand restored. */
async function walkStale(seed: Uint8Array, store: InMemoryEventStore, ledger: BagDocLedger): Promise<Uint8Array> {
  let archive: Uint8Array | null = null;
  for (let i = 0; i < 120; i++) {
    try { archive = await staleStand(seed, store, ledger, archive, i); }
    catch (error) { expect(error).toBeInstanceOf(PrekeySecretAbsent); return archive!; }
  }
  throw new Error("the lineage never walked stale within the bound");
}

describe("the recard's keyhive floor", () => {
  test("CARD FIRST: the stale stand registers once its card mints first, under the same identity, and its Archive after that card opens the next stand", async () => {
    const seed = new Uint8Array(32).fill(0x73);
    const store = new InMemoryEventStore();
    const ledger = ledgerOf();
    const stale = await walkStale(seed, store, ledger);
    // CONTROL: the stale Archive, registered in the ordinary order, refuses.
    const control = new KeyhiveProvider();
    await control.init({ seed, eventStore: store, archiveBytes: stale });
    let identity: string;
    try {
      await control.hydrateFromEventStore();
      identity = await control.whoami();
      await expect(registerBagsDurably({ provider: control, bags: [BAG, "lar:///probe.recard.fresh"], ledger })).rejects.toBeInstanceOf(PrekeySecretAbsent);
    } finally { await control.dispose(); }
    // THE RECARD: card first, then the same registration.
    const p = new KeyhiveProvider();
    await p.init({ seed, eventStore: store, archiveBytes: stale });
    let after: Uint8Array;
    try {
      await p.hydrateFromEventStore();
      await p.contactCard();
      await registerBagsDurably({ provider: p, bags: [BAG, "lar:///probe.recard.fresh"], ledger });
      expect(await p.whoami()).toBe(identity!);
      after = await p.exportArchiveAfterTheCard();
      await p.settleEvents();
    } finally { await p.dispose(); }
    // The next ordinary stand from the recard's Archive opens.
    const next = new KeyhiveProvider();
    await next.init({ seed, eventStore: store, archiveBytes: after! });
    try {
      await next.hydrateFromEventStore();
      await registerBagsDurably({ provider: next, bags: [BAG, "lar:///probe.recard.next"], ledger });
    } finally { await next.dispose(); }
  });

  test("PEER SEAL: content a peer sealed to a card no kept Archive holds reads ContentKeyNotHeld by bag, before and after a card-first stand", async () => {
    const seed = new Uint8Array(32).fill(0x55);
    const store = new InMemoryEventStore();
    const s0 = new KeyhiveProvider();
    await s0.init({ seed, eventStore: store });
    const kept = await s0.exportArchiveAfterTheCard();
    await s0.settleEvents(); await s0.dispose();
    // A stand whose Archive nobody keeps mints a card a peer seals to.
    const s1 = new KeyhiveProvider();
    await s1.init({ seed, eventStore: store, archiveBytes: kept });
    await s1.hydrateFromEventStore();
    const lostCard = await s1.contactCard();
    await s1.settleEvents(); await s1.dispose();
    const peer = new KeyhiveProvider();
    await peer.init({ seed: new Uint8Array(32).fill(0x66), eventStore: new InMemoryEventStore() });
    const { id } = await peer.receiveContactCard(lostCard);
    const { docId } = await peer.registerBag("lar:///peer.bag");
    await peer.delegate({ audience: id, bagUrl: "lar:///peer.bag", access: "read" });
    const seal = await peer.encryptContent("lar:///peer.bag", text("from the peer"));
    const events = await peer.eventsForPeer(id);
    await peer.dispose();
    const s2 = new KeyhiveProvider();
    await s2.init({ seed, eventStore: store, archiveBytes: kept });
    try {
      await s2.hydrateFromEventStore();
      await s2.contactCard();
      await s2.ingestPeerEvents(events);
      s2.adoptBag("lar:///peer.bag", docId);
      const refused = await s2.decryptContent("lar:///peer.bag", seal).then(() => null, (e: unknown) => e);
      expect(refused).toBeInstanceOf(ContentKeyNotHeld);
      expect((refused as ContentKeyNotHeld).bag).toBe("lar:///peer.bag");
      expect((refused as Error).message).toContain("Key not found");
      expect((refused as Error).message).toContain("for now");
      expect((refused as Error).message).toContain("may still arrive by sync");
      expect((refused as Error).message).not.toMatch(/[0-9a-f]{40}/);
    } finally { await s2.dispose(); }
  });

  test("LOST DOCUMENT: a bag a recard reminted names its lost Document on key-not-found; an ordinary stand and a tampered seal keep other names", async () => {
    const seed = new Uint8Array(32).fill(0x74);
    const store = new InMemoryEventStore();
    const ledger = ledgerOf();
    const s0 = new KeyhiveProvider();
    await s0.init({ seed, eventStore: store });
    let seal: Uint8Array;
    try {
      await registerBagsDurably({ provider: s0, bags: [BAG], ledger });
      seal = await s0.encryptContent(BAG, text("under the old Document"));
      await s0.settleEvents();
    } finally { await s0.dispose(); }
    // No Archive of s0 rests: the next stand holds no hand in the recorded Document and remints it.
    const stand = async (recard: boolean): Promise<{ refused: unknown; tampered: unknown }> => {
      const p = new KeyhiveProvider();
      await p.init({ seed, eventStore: store });
      try {
        await p.hydrateFromEventStore();
        if (recard) p.markRecard();
        const { reminted } = await registerBagsDurably({ provider: p, bags: [BAG], ledger });
        expect(reminted).toEqual([BAG]);
        const refused = await p.decryptContent(BAG, seal!).then(() => null, (e: unknown) => e);
        // A seal under the CURRENT Document, one byte flipped: a tamper, never a missing key.
        const fresh = await p.encryptContent(BAG, text("under the new Document"));
        const bent = Uint8Array.from(fresh); bent[bent.length - 1] = bent[bent.length - 1]! ^ 0x01;
        const tampered = await p.decryptContent(BAG, bent).then(() => null, (e: unknown) => e);
        return { refused, tampered };
      } finally { await p.dispose(); }
    };
    const recarded = await stand(true);
    expect(recarded.refused).toBeInstanceOf(SealedUnderLostDocument);
    expect((recarded.refused as SealedUnderLostDocument).bag).toBe(BAG);
    expect(recarded.tampered).toBeTruthy();
    expect(recarded.tampered).not.toBeInstanceOf(SealedUnderLostDocument);
    expect(recarded.tampered).not.toBeInstanceOf(ContentKeyNotHeld);
    // An ordinary stand fills no remint record: the same seal reads ContentKeyNotHeld.
    const ordinary = await stand(false);
    expect(ordinary.refused).toBeInstanceOf(ContentKeyNotHeld);
  });
});
