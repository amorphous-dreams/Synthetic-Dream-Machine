/**
 * standoff-watch — the island's one question to its disk shore before a wave lands: does this carrier stand off?
 *
 * A stand-off settles on a person's hand (operator ruling, 2026-11-23). `take-disk` and `keep-disk` ride an INGEST wave whose
 * candidate names the records' present hash as its base, and the ingest gate trusts the caller's base; so the island's INGEST
 * asks each projector it mounts whether a carrier of the wave stands in a stand-off, and lands such a wave only from a person's
 * line. A projector registers its watch while it runs (`watchStandoffs`) and drops it at its stop; one island may run several
 * (its own, and a lit sibling face's), so the question asks each.
 *
 * Pure: no I/O, no clock. One registry per island worker, as one island runs per worker.
 */

/** Where a carrier stands off in a bag: its key, or null where it stands in none. */
export type StandoffWatch = (bagId: string, uri: string) => string | null;

const watches = new Set<StandoffWatch>();

/** Register a projector's watch while it runs; the answer drops it. */
export function watchStandoffs(watch: StandoffWatch): () => void {
  watches.add(watch);
  return () => { watches.delete(watch); };
}

/** The key under which `uri` stands off in `bagId`, by any watch this island runs, or null. */
export function standoffOf(bagId: string, uri: string): string | null {
  for (const watch of watches) {
    const key = watch(bagId, uri);
    if (key !== null) return key;
  }
  return null;
}
