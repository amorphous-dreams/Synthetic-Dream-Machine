/**
 * ONE CARD PER STAND, and the Archive leaves after it.
 *
 * A contact card carries a prekey; the secret behind it rests in the provider that minted it and in whatever
 * Archive leaves AFTER the mint. A peer adds this identity under the card's prekey, so a stand that ends with that
 * secret in no kept Archive leaves the next stand unable to open what the peer sealed.
 *
 *   C1  every ask within one stand answers the same card. Control: another stand of the same seed mints another.
 *   C2  THE RESTART: a peer adds this identity under the stand's card and seals; the next stand, restored from the
 *       Archive `exportArchiveAfterTheCard` handed out, opens it. Control: restored from an Archive that left
 *       BEFORE the card minted, the same events refuse, so the reading measures the order and nothing else.
 *   C4  asks that arrive TOGETHER await one mint and answer one card. Control: the same asks against a second stand
 *       answer that stand's own card, another one.
 *   C3  a card asked for late in a stand still rests inside the Archive that left earlier through
 *       `exportArchiveAfterTheCard`: the late ask mints nothing.
 */
import { describe, expect, test } from "vitest";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";

const SELF = new Uint8Array(32).fill(0x81);
const PEER = new Uint8Array(32).fill(0x82);
const BAG = "lar:///one-card.bag";
const text = (b: Uint8Array): string => new TextDecoder().decode(b);

async function stand(seed: Uint8Array, archiveBytes?: Uint8Array): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed, eventStore: new InMemoryEventStore(), ...(archiveBytes ? { archiveBytes } : {}) });
  return p;
}

/** A peer adds the card's identity to a fresh document, seals one chunk, and hands out what the identity needs. */
async function peerSealsFor(card: Uint8Array) {
  const peer = await stand(PEER);
  const { id } = await peer.receiveContactCard(card);
  const { docId } = await peer.registerBag(BAG);
  await peer.delegate({ bagUrl: BAG, audience: id, access: "read" });
  const sealed = await peer.encryptContent(BAG, new TextEncoder().encode("sealed under the stand's card"));
  const events = await peer.eventsForPeer(id);
  await peer.dispose();
  return { docId, sealed, events };
}

async function nextStandOpens(archive: Uint8Array, s: Awaited<ReturnType<typeof peerSealsFor>>): Promise<string> {
  const next = await stand(SELF, archive);
  await next.ingestPeerEvents(s.events);
  next.adoptBag(BAG, s.docId);
  try { return text(await next.decryptContent(BAG, s.sealed)); }
  finally { await next.dispose(); }
}

describe("one contact card per stand", () => {
  test("C1 every ask within a stand answers the same card; another stand mints another", async () => {
    const a = await stand(SELF);
    const first = text(await a.contactCard());
    expect(text(await a.contactCard())).toBe(first);
    expect(text(await a.contactCard())).toBe(first);
    await a.dispose();
    const b = await stand(SELF);
    expect(text(await b.contactCard()), "CONTROL: a fresh stand still mints its own card").not.toBe(first);
    await b.dispose();
  });

  test("C2 THE RESTART: the Archive that left after the card opens what a peer sealed under it", async () => {
    const a = await stand(SELF);
    const before = await a.exportArchive();              // left BEFORE the card minted
    const after = await a.exportArchiveAfterTheCard();   // mints the stand's card, then leaves
    const sealedFor = await peerSealsFor(await a.contactCard());
    await a.dispose();

    await expect(nextStandOpens(before, sealedFor), "CONTROL: an Archive that left before the card holds no such prekey").rejects.toThrow();
    expect(await nextStandOpens(after, sealedFor)).toBe("sealed under the stand's card");
  });

  test("C4 asks that arrive together answer one card", async () => {
    const a = await stand(SELF);
    const together = (await Promise.all([a.contactCard(), a.contactCard(), a.contactCard(), a.exportArchiveAfterTheCard().then(() => a.contactCard())])).map(text);
    expect(new Set(together).size, "every concurrent ask answered the same card").toBe(1);
    await a.dispose();
    const b = await stand(SELF);
    const other = (await Promise.all([b.contactCard(), b.contactCard()])).map(text);
    expect(new Set(other).size).toBe(1);
    expect(other[0], "CONTROL: a second stand mints its own").not.toBe(together[0]);
    await b.dispose();
  });

  test("C3 a late ask mints nothing: the card stands inside the Archive that already left", async () => {
    const a = await stand(SELF);
    const archive = await a.exportArchiveAfterTheCard();
    await a.registerBag("lar:///one-card.other");       // the stand goes on acting
    const sealedFor = await peerSealsFor(await a.contactCard());   // asked late
    await a.dispose();
    expect(await nextStandOpens(archive, sealedFor)).toBe("sealed under the stand's card");
  });
});
