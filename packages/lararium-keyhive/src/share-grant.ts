/**
 * share-grant — one share row's grant between two lit faces' hives (sealed-store#/the-share-config).
 *
 * The owner's hive registers the bag where it stands unregistered, takes the grantee's contact card, delegates the grade the
 * row names (a writer takes Keyhive's `admin`, `FACE_SEATS_AND_UNSEATS`), and hands the grantee's hive the cap events.
 * The grantee's hive then names the owner's Document for the bag (`adoptBag`), so its own read resolves there; without the
 * adoption it held the events and answered `bag-not-registered`.
 */
import type { KeyhiveProvider } from "./keyhive-provider.js";
import { registerBagsDurably, type BagDocLedger } from "./bag-doc-ledger.js";

export interface ShareGrantInput {
  readonly owner: KeyhiveProvider;
  readonly grantee: KeyhiveProvider;
  readonly bag: string;
  readonly access: "read" | "edit";
  /**
   * The ledger the owner's late registration reads (`registerBagsDurably`): a Document the grant mints rides it, so the owner
   * standing again adopts the one the grantee adopted, never a fresh one. Absent, a minted Document lives in this process alone.
   */
  readonly ownerLedger?: BagDocLedger;
}

/** Land one grant. `fresh` where the owner's hive held no such delegation before. */
export async function grantShare({ owner, grantee, bag, access: grade, ownerLedger }: ShareGrantInput): Promise<{ fresh: boolean }> {
  if (!owner.docIdOfBag(bag)) {
    if (ownerLedger) await registerBagsDurably({ provider: owner, bags: [bag], ledger: ownerLedger });
    else await owner.registerBag(bag);
  }
  const { id } = await owner.receiveContactCard(await grantee.contactCard());
  // A writer takes the hand the house grants a face over a bag it writes (Keyhive's `admin`, `FACE_SEATS_AND_UNSEATS`).
  const access = grade === "edit" ? "admin" : "read";
  // THE ROSTER'S OWN READ: a delegation the owner's hive already holds delegates again by reference and moves nothing.
  const held = (await owner.verify({ bagUrl: bag, presenter: id, access }).catch(() => ({ ok: false }))).ok;
  await owner.delegate({ audience: id, bagUrl: bag, access });
  await grantee.ingestPeerEvents(await owner.eventsForPeer(id));
  grantee.adoptBag(bag, owner.docIdOfBag(bag)!);
  return { fresh: !held };
}
