/**
 * share-grant — one share row's grant between two lit faces' hives (sealed-store#/the-share-config).
 *
 * The owner's hive registers the bag where it stands unregistered, takes the grantee's contact card, delegates the grade the
 * row names (a writer takes Keyhive's `admin`, `FACE_SEATS_AND_UNSEATS`), and hands the grantee's hive the cap events.
 */
import type { KeyhiveProvider } from "./keyhive-provider.js";

export interface ShareGrantInput {
  readonly owner: KeyhiveProvider;
  readonly grantee: KeyhiveProvider;
  readonly bag: string;
  readonly access: "read" | "edit";
}

/** Land one grant. `fresh` where the owner's hive held no such delegation before. */
export async function grantShare({ owner, grantee, bag, access: grade }: ShareGrantInput): Promise<{ fresh: boolean }> {
  if (!owner.docIdOfBag(bag)) await owner.registerBag(bag);
  const { id } = await owner.receiveContactCard(await grantee.contactCard());
  // A writer takes the hand the house grants a face over a bag it writes (Keyhive's `admin`, `FACE_SEATS_AND_UNSEATS`).
  const access = grade === "edit" ? "admin" : "read";
  // THE ROSTER'S OWN READ: a delegation the owner's hive already holds delegates again by reference and moves nothing.
  const held = (await owner.verify({ bagUrl: bag, presenter: id, access }).catch(() => ({ ok: false }))).ok;
  await owner.delegate({ audience: id, bagUrl: bag, access });
  await grantee.ingestPeerEvents(await owner.eventsForPeer(id));
  return { fresh: !held };
}
