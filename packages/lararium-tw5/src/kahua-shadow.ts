/**
 * kahua-shadow — the "local draft over shared" mark, derived from this device's own cascade.
 *
 * A title whose topmost live record sits in a layer above `bags/kahua` (the daemon's device-local
 * temp, draft, personal and working layers) while `bags/kahua` also holds it SHADOWS the shared record
 * on this device alone. The island adaptor asks the composition after each landing and stamps one
 * record per shadowed title into the temp plane, carrying the covered kahua body; the `kahua-shadow`
 * filter operator lists the stamped titles, and the daemon view-template segment renders the mark with
 * a diff of the draft against that body. The stamp never reaches a store, a disk or another device
 * (`neverPersists`), so no device reads its own draft as the fleet's record and no peer hears of it.
 *
 * A re-lift (the kahua body equals the draft's) or a discarded draft (the topmost record falls to
 * kahua, or a tombstone hides the title) clears the stamp.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { KAHUA_BAG, type CompositeStore } from "@lararium/mesh";
import { KAHUA_SHADOW_PREFIX, kahuaShadowTitle } from "./kahua-shadow-title.js";

export { KAHUA_SHADOW_PREFIX, kahuaShadowTitle };

/** What a shadow covers: the layer holding the draft and the kahua body beneath it. */
export interface KahuaShadow {
  readonly draftBag: string;
  readonly shared:   string;
}

/**
 * The shadow `title` casts over kahua in this composition, or null when none stands: no kahua twin, no
 * live record above kahua, a tombstone hiding the title, or draft and kahua bodies equal.
 */
export async function kahuaShadowOf(
  store: Pick<CompositeStore, "resolveAll" | "resolveLayered">,
  title: string,
): Promise<KahuaShadow | null> {
  const top = await store.resolveLayered(title);
  if (!top || top.record.meta?.deleted || top.bagId === KAHUA_BAG) return null;
  const shared = (await store.resolveAll(title)).find((entry) => entry.bagId === KAHUA_BAG);
  if (!shared) return null;
  const sharedText = String(shared.record.tiddler.text ?? "");
  if (String(top.record.tiddler.text ?? "") === sharedText) return null;
  return { draftBag: top.bagId, shared: sharedText };
}
