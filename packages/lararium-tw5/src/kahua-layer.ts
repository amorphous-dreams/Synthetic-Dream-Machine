/**
 * kahua-layer — THE ONE SEAM through which an island mounts the face's kahua stage.
 *
 * The document reads off the island's manifest grant (`IslandGrants.kahuaUrl`), which the vessel fills from the url
 * the face's verified `plane` act pins (`adoptKahuaPlane`); a catalog row never answers for `bags/kahua`, so a holder
 * who rewrites the row moves no layer. The store the layer stands on comes from `kahuaLayerStore`, the one place a
 * verify-on-read adapter (the stage's fold over its signed acts) replaces the raw document store.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { AutomergeDocStore, KAHUA_BAG, type DocHandle, type LarDoc, type LarTiddlerStore } from "@lararium/mesh";

/**
 * The document a library slot mounts from. `bags/kahua` answers from the grant alone and never asks the catalog;
 * every other library bag asks the catalog lookup.
 */
export async function librarySlotUrl(
  slot: string,
  grants: { readonly kahuaUrl?: string | null },
  catalog: ((slot: string) => Promise<string | null>) | null,
): Promise<string | null> {
  if (slot === KAHUA_BAG) return grants.kahuaUrl ?? null;
  return catalog ? catalog(slot) : null;
}

/** The store the kahua layer stands on. SEAM: the verify-on-read stage adapter replaces this body at merge. */
export function kahuaLayerStore(handle: DocHandle<LarDoc>): LarTiddlerStore {
  return new AutomergeDocStore(handle, KAHUA_BAG);
}
