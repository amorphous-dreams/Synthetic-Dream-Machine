/**
 * share-grant-registers-bag-on-grantee — a share grant adopts the bag on the grantee's hive (kahua backlog-awakens, "A share
 * grant never adopts the bag on the grantee").
 *
 * The share `grant` hook registered the bag on the owner, delegated, and handed the grantee's hive the cap events, but never
 * named the owner's Document for the bag on the grantee: the grantee's own `verify` answered `bag-not-registered`, so the
 * grant read only on the owner's replica.
 *
 *   SG1 RED  after the grant, the grantee's hive names the owner's Document for the bag and its own read clears there
 *   SG2 RED  a grant that mints the owner's Document records it in the owner's ledger, so the owner standing again (the
 *            late registration, `registerBagsDurably`) adopts the same Document the grantee adopted, never a fresh one
 *   CONTROL  the owner's own read of the grantee clears (the delegation landed), and a bag no grant named stays
 *            unregistered on the grantee
 */
import { describe, expect, test } from "vitest";
import { bagUri } from "@lararium/mesh";
import { InMemoryEventStore, KeyhiveProvider, registerBagsDurably, type BagDocLedger } from "../src/index.js";
import { grantShare } from "../src/share-grant.js";

const NOTES = bagUri("notes");
const strip = (id: string): string => id.replace(/^0x/, "").toLowerCase();
const stand = async (fill: number, eventStore = new InMemoryEventStore(), archiveBytes?: Uint8Array): Promise<KeyhiveProvider> => {
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(fill), eventStore, ...(archiveBytes ? { archiveBytes } : {}) });
  await p.hydrateFromEventStore();
  return p;
};
const memoryLedger = (): BagDocLedger => {
  const rows = new Map<string, string>();
  return { get: async (bag) => rows.get(bag) ?? null, put: async (bag, docId) => { rows.set(bag, docId); } };
};

describe("a share grant adopts the bag on the grantee", () => {
  test("SG1 RED — the grantee names the owner's Document and its own read clears; CONTROL: the owner's read cleared", { timeout: 90_000 }, async () => {
    const owner = await stand(0xd1), grantee = await stand(0xd2);
    const granteeId = strip(await grantee.vesselIdentifierHex());
    const out = await grantShare({ owner, grantee, bag: NOTES, access: "read" });
    expect(out.fresh).toBe(true);
    expect((await owner.verify({ bagUrl: NOTES, presenter: granteeId, access: "read" })).ok, "CONTROL: the delegation landed").toBe(true);
    expect(grantee.docIdOfBag(bagUri("elsewhere")), "CONTROL: a bag no grant named").toBeNull();
    expect(grantee.docIdOfBag(NOTES)).toBe(owner.docIdOfBag(NOTES));
    expect(await grantee.verify({ bagUrl: NOTES, presenter: granteeId, access: "read" })).toEqual({ ok: true });
    await owner.dispose(); await grantee.dispose();
  });

  test("SG2 RED — the minted Document rides the owner's ledger, so the owner standing again adopts the one the grantee holds", { timeout: 90_000 }, async () => {
    const ownerEvents = new InMemoryEventStore(), ledger = memoryLedger();
    const owner = await stand(0xd3, ownerEvents), grantee = await stand(0xd4);
    await grantShare({ owner, grantee, bag: NOTES, access: "edit", ownerLedger: ledger });
    const minted = owner.docIdOfBag(NOTES);
    expect(minted).not.toBeNull();
    expect(await ledger.get(NOTES)).toBe(minted);
    // The face stands again as a boot does: its Archive floor kept (`persistArchiveFloor`), its events replayed.
    const archive = await owner.exportArchiveAfterTheCard();
    await owner.dispose();
    const again = await stand(0xd3, ownerEvents, archive);
    await registerBagsDurably({ provider: again, bags: [NOTES], ledger });
    expect(again.docIdOfBag(NOTES)).toBe(minted);
    expect(grantee.docIdOfBag(NOTES)).toBe(minted);
    await again.dispose(); await grantee.dispose();
  });
});
