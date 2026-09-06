/**
 * vessel-dyads — the live read path onto `mesh/dyad`: what relationships does this vessel hold?
 *
 * THE SLOT IS THE ONLY SOURCE (Stage 0 ruling 2026-09-05 · the alpha collapse 2026-09-06). The
 * ceremony mints a dyad slot wherever a face meets a device — the derived veil in the ref, the
 * binding signed where the group root stands and null where it does not — so reading a vessel's
 * relationships means reading its slots and nothing else. A bare delegation edge presents NO dyad:
 * the edge carries the Binding Gate's authority, and the boot path says the drift aloud when a face
 * stands beside zero slots, rather than fabricating a (device × root) reading alpha owes nothing to.
 *
 * WHAT IT REFUSES TO INVENT: a dyad whose binding nothing signed joins no fleet (`fleetOfGroup`
 * gathers only bound dyads), so presenting the relationship and claiming its gathering stay
 * different acts, and only the first one has happened for an unbound slot.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/persona-circle
 */

import { dyadsFromDoc, type DyadRecord, type LarDoc } from "@lararium/mesh";

/**
 * Every relationship this vessel holds — its ceremony-minted dyad slots, de-duplicated by `dyadId`,
 * which content-addresses the ordered pair: the same relationship reached twice stays one record.
 */
export function vesselDyads(doc: LarDoc | undefined | null): DyadRecord[] {
  const seen = new Map<string, DyadRecord>(dyadsFromDoc(doc).map((d) => [d.dyadId, d]));
  return [...seen.values()];
}
