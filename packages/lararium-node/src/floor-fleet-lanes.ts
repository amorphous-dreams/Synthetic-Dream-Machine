/**
 * floor-fleet-lanes — AT THE FLOOR EVERY FLEET LANE STAYS SHUT.
 *
 * The fleet roots a vessel serves read off the persona roster, a row sealed under the vessel key. A composition at
 * the floor holds no key, names no root and folds no fleet board, so it cannot tell a device its fleet set aside
 * from one that stands. It therefore reads every device as set aside:
 *
 *   `deviceAside`  THE SORTER'S CONSULT answers true for every vessel key, so no socket sorts same-operator.
 *   `aside`        THE SHARE VERDICT'S CONSULT, read first on every lane, sets a proven sibling aside too, so the
 *                  sibling lane carries nothing. A peer that rides neither lane keeps what the built ring answers:
 *                  the public shelf stays served.
 *
 *   `noFleetAtTheFloor`  THE FETCH DOOR'S PREDICATE (Socket B's cleartext tier) reads no peer as fleet, the pinned
 *                  join gate's key included: a cleartext ask draws the Mu a miss draws.
 *
 * Every other reading passes through to the ring the composition built. The first unlock stands a fresh
 * composition that reads the roster and uses the built ring whole.
 */
import type { EdgeShadowRing } from "./edge-shadow-ring.js";

export function floorShadowRing(built: EdgeShadowRing, provenSibling: (peerId: string) => boolean): EdgeShadowRing {
  return {
    ...built,
    deviceAside: () => true,
    aside: (peerId) => provenSibling(peerId) || built.aside(peerId),
  };
}

/** The fetch door's fleet predicate at the floor: nobody reads as fleet. */
export const noFleetAtTheFloor = (_peerKey: string): boolean => false;
