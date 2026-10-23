/**
 * lease-observation — what a boot may raise in the sealed anchor from the lease slots it reads.
 *
 * The anchor's frontier rises only on a VERIFIED observation: the max over per-writer slots that carry their writer's
 * signature, for this face's group, from a key the face's CURRENT KEL roster seats (`signedLeaseEpoch`). An unsigned slot, a
 * stranger's, another group's, or a deleted one raises nothing; the result never falls below what the anchor holds.
 */
import { currentSignerOf, personaLineageFromKel, raiseFaceFrontier, signedLeaseEpoch, type FaceAnchor, type PersonaKelEvent } from "@lararium/mesh";

export function raiseAnchorFromSlots(
  anchor: FaceAnchor, slotTexts: Iterable<unknown>, kelChain: readonly PersonaKelEvent[],
): FaceAnchor {
  const lineage = personaLineageFromKel(kelChain);
  if (!lineage) return anchor;
  const seated = currentSignerOf(lineage);
  // ONLY THE CURRENT ROSTER RAISES (`currentSignerOf`, the one door every lease reader and writer asks): a key the KEL has
  // rotated past raises nothing new, and what the anchor already holds stays pinned. A rotated root re-advances.
  return raiseFaceFrontier(anchor, { leaseEpoch: signedLeaseEpoch(anchor.personaGroup, slotTexts, seated) });
}
