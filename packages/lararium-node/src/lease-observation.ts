/**
 * lease-observation — what a boot may raise in the sealed anchor from the lease slots it reads.
 *
 * The anchor's frontier rises only on a VERIFIED observation: the max over per-writer slots that carry their writer's
 * signature, for this face's group, from a key the face's CURRENT KEL roster seats (`signedLeaseEpoch`). An unsigned slot, a
 * stranger's, another group's, or a deleted one raises nothing; the result never falls below what the anchor holds.
 */
import { raiseFaceFrontier, readFace, type FaceAnchor, type PersonaKelEvent } from "@lararium/mesh";

export function raiseAnchorFromSlots(
  anchor: FaceAnchor, slotTexts: Iterable<unknown>, kelChain: readonly PersonaKelEvent[],
): FaceAnchor {
  // The one face reading: only the CURRENT roster's signed advances raise, and what the anchor already holds stays pinned.
  const face = readFace(kelChain);
  if (!face) return anchor;
  return raiseFaceFrontier(anchor, { leaseEpoch: face.observedLease(anchor.personaGroup, slotTexts) });
}
