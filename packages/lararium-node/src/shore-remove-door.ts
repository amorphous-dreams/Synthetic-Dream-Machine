/**
 * THE SHORE'S REMOVE DOOR — a pending removal leaves the layer its record stands in.
 *
 * A pending removal names a file that vanished from one bag's mirror: a hand deleted the carrier where that bag
 * keeps it. The answer `lares shore remove` carries that deletion into the same bag, never into the layer a
 * browser's save would take: the record's own layer lets it go, so whatever a kāpae there would shadow stands
 * in the composition beneath THAT layer, and its shadow file sits in THAT layer's mirror
 * (lar:///ha.ka.ba/lares/api/pono/kapae#/disk-sense).
 *
 * A DELETE DELETES PLAINLY; ONLY A LOWER LAYER MAKES IT A CHOICE (recipe-layer-model#/delete-reveals-or-shadows).
 * Where no layer beneath the bag holds the title, the family retracts to absent: no tombstone rises and no
 * `.kapae` lands. Where one does, the removal raises a kāpae in the bag, so the lower copy never surfaces, and
 * the projector asks a person's approval first (`answerRemovals`, `remove-raises-kapae`). A layer beneath that
 * the composition could not read counts as holding the title (`unknownBeneath`), named `an unread layer`.
 */
import type { CompositeStore } from "@lararium/mesh/composite-store";
import type { ChangeOrigin } from "@lararium/mesh/tiddler-store";
import { storeIsRetired } from "@lararium/mesh/effect-record";
import { VerbRefusal } from "@lararium/mesh/verb-refusal";
import { removeMeme, storeMemeSink } from "@lararium/tw5";

/** The name a layer beneath reads by where the composition could not read it. */
export const UNREAD_LAYER = "an unread layer";

/**
 * The layers beneath `bagId` in this composition that hold a live record of `uri`, highest first, with
 * `an unread layer` where a layer beneath stands unread; `null` where the composition mounts no such bag.
 */
export function layersBeneathOf(composite: CompositeStore): (bagId: string, uri: string) => Promise<readonly string[] | null> {
  return async (bagId, uri) => {
    const at = composite.layerIndexOf(bagId);
    if (at < 0) return null;
    const holding = (await composite.resolveAll(uri)).filter((row) => composite.layerIndexOf(row.bagId) < at).map((row) => row.bagId);
    return composite.unknownBeneath(bagId) ? [...holding, UNREAD_LAYER] : holding;
  };
}

/**
 * Remove the carrier family `uri` from bag `bagId`'s own layer: each member retracts to absent where no layer
 * beneath holds it, and leaves as a kāpae in that bag where one does (`removeMeme` over the bag's store, which
 * knows the layers beneath it). The bag's own store answers, writable flag or not: the shore carries a deletion
 * the bag's own mirror already holds, as the ingest leg carries an edit, and the routed gate has read the bag's cap
 * and, for house canon, the Kahu hand (the remove names its bag). A bag the composition never mounts, or a retired
 * bag, refuses by name and nothing lands.
 */
export function removeInOwnLayer(composite: CompositeStore, origin: ChangeOrigin): (uri: string, bagId: string) => Promise<void> {
  return async (uri, bagId) => {
    const store = composite.writableStoreForBag(bagId) ?? composite.storeForBag(bagId);
    if (store === null) throw new VerbRefusal("remove-bag-unmounted", `remove-bag-unmounted: this island mounts no layer for ${bagId}, so ${uri} cannot leave it here`);
    // A RETIRED BAG TAKES NO LANDING (action-handler#/retired), a removal included: the composite's write door reads the
    // same marker, and this door reaches the bag's own store, so it reads the marker itself.
    if (await storeIsRetired(store, bagId)) throw new VerbRefusal("bag-retired", `bag-retired: ${bagId} stands retired (DROP); a retired bag takes no landing, and ${uri} stays as it stands`);
    const at = composite.layerIndexOf(bagId);
    const beneath = async (title: string): Promise<boolean> =>
      composite.unknownBeneath(bagId) || (await composite.resolveAll(title)).some((row) => composite.layerIndexOf(row.bagId) < at);
    await removeMeme({ uri }, storeMemeSink(store, bagId, origin, undefined, beneath));
  };
}

/** The slice of a TW5 wiki the view wait reads. */
interface ViewWiki {
  getTiddler?: (title: string) => { fields: Record<string, unknown> } | undefined | null;
  addEventListener?: (type: string, fn: () => void) => void;
  removeEventListener?: (type: string, fn: () => void) => void;
}

/**
 * Wait until the wiki's view no longer answers `uri` from `bagId`: a store write reaches the view through the
 * landing queue, a beat after the door returns. Each change event looks again; the bound paces the wait and
 * decides nothing, since the caller reads the view back afterward and names a carrier still standing as left.
 */
export function viewLeaves(wiki: ViewWiki, uri: string, bagId: string, boundMs = 5_000): Promise<void> {
  const gone = (): boolean => wiki.getTiddler?.(uri)?.fields["$origin-bag"] !== bagId;
  if (gone() || typeof wiki.addEventListener !== "function") return Promise.resolve();
  return new Promise((resolve) => {
    const done = (): void => { clearTimeout(timer); wiki.removeEventListener?.("change", look); resolve(); };
    const look = (): void => { if (gone()) done(); };
    const timer = setTimeout(done, boundMs);
    timer.unref?.();
    wiki.addEventListener!("change", look);
  });
}
