/**
 * dial-relation — THE OUTBOUND DIAL SEATS THE RELATION THIS VESSEL'S OWN HELD RECORDS PROVE (road `P26`; controller transport
 * ruling 2026-10-31 and its fork ruling (b), settled at rung 1).
 *
 * "A peer's share standing comes from the relation its ARRIVAL proved, on every adapter and in both directions … Direction
 * neither grants nor denies." Each side decides what IT shares from ITS OWN held records ("sync carries; verification
 * decides"; membership-doctrine: "a held root comes from one place"). The hearth's gate already sorts what the hearth shares
 * to this dialer. What this dialer shares to the hearth rests on this vessel's records alone: the gate's signed answer
 * carries no class, and a remote's word would only narrow what the records already grant.
 *
 * So the relation reads off the dial's PIN and the SEALED record of the act that wrote it (controller revision ruling,
 * 2026-10-31; road #/rulings 2026-10-19: "a face's custody rows seal under its own key", "a face's secrets never rest
 * clear"). `fleet join land` seals the landed pin's digest in the worn face's join record, under that face's own key:
 *   · a pin whose digest the WORN face's sealed landing record names → that face's own hearth: a face view of the worn face
 *     (the same seat an inbound same-face session takes);
 *   · a kept admit bundle's pin → the CONTRACTED class and its standing at the pin's Nexus, and no private plane;
 *   · any other pin → the weakest relation: no class, no view, the wire shelf and the realm's return lane alone (fail
 *     closed). Nothing the bootstrap carries counts as provenance: a clear file names where to dial, never who answers.
 *
 * The seat writes the composer's own maps (class, standing, face view) and nothing it cannot prove: no gate session and no
 * face key ride a dial, so the Kahu guard (which reads a gate session) withholds the canon from a dialed hearth.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/nexus-client-dial
 */
import type { PeerClass } from "@lararium/mesh";

export type DialRelation =
  | { readonly kind: "same-face";  readonly personaGroup: string; readonly nexus: string | null }
  | { readonly kind: "contracted"; readonly nexus: string | null }
  | { readonly kind: "untagged";   readonly nexus: string | null };

/** The AID text a pin's hex Nexus names, or null where it reads as none. */
function nexusOfPin(pinNexus: string | null): string | null {
  if (!pinNexus || !/^(?:[0-9a-f]{2})+$/.test(pinNexus)) return null;
  const text = Buffer.from(pinNexus, "hex").toString("utf8");
  return text.length > 0 ? text : null;
}

/** The relation a dial's pin proves: the worn face's sealed landing record, where the pin came from, the pin's digest. */
export function dialRelationOf(input: {
  readonly source:    "bootstrap" | "kept" | null;
  /** The digest the WORN face's sealed join record names (`FaceJoinRecord.hearthPin`), or null where none stands. */
  readonly landedPin: string | null;
  /** The dialed pin's digest (`admitGatePinDigest`), or null where the dial holds no pin. */
  readonly pinDigest: string | null;
  readonly pinNexus:  string | null;
  readonly wornGroup: string | null;
}): DialRelation {
  const nexus = nexusOfPin(input.pinNexus);
  if (input.wornGroup !== null && input.landedPin !== null && input.pinDigest !== null && input.landedPin === input.pinDigest) {
    return { kind: "same-face", personaGroup: input.wornGroup, nexus };
  }
  if (input.source === "kept") return { kind: "contracted", nexus };
  return { kind: "untagged", nexus };
}

/** The composer's seat maps a dial writes. */
export interface DialSeatMaps {
  readonly peerClassMap: Map<string, PeerClass>;
  readonly peerNexus:    Map<string, string | null>;
  readonly faceViews:    { seat(peerId: string, face: { readonly personaGroup: string } | null): void; drop(peerId: string): void };
  /** THE HEARTH THE DIAL SEATED, for the realm's return lane (Sol's transport read, BLOCKER 1): the lane opens toward the
   *  Nexus of the pin the dial actually seated, never the bootstrap's scope. Null while no dialed peer stands. */
  dialedHearth?: { readonly pinned: boolean; readonly aid: string | null } | null;
  /** The peer the return lane names, so an unseat of any other peer leaves it standing. */
  dialedPeer?: string | null;
}

/** Seat a dialed peer under the relation its pin proved; an untagged pin seats nothing. */
export function seatDialPeer(maps: DialSeatMaps, peerId: string, relation: DialRelation): void {
  unseatDialPeer(maps, peerId);
  maps.dialedHearth = { pinned: true, aid: relation.nexus };
  maps.dialedPeer = peerId;
  if (relation.kind === "untagged") return;
  maps.peerNexus.set(peerId, relation.nexus);
  if (relation.kind === "same-face") {
    maps.peerClassMap.set(peerId, "same-operator");
    maps.faceViews.seat(peerId, { personaGroup: relation.personaGroup });
    return;
  }
  maps.peerClassMap.set(peerId, "contracted");
}

/** The dialed peer left, or another arrival took its id: drop its class, its standing and its view. */
export function unseatDialPeer(maps: DialSeatMaps, peerId: string): void {
  maps.peerClassMap.delete(peerId);
  maps.peerNexus.delete(peerId);
  maps.faceViews.drop(peerId);
  if (maps.dialedPeer === peerId) { maps.dialedHearth = null; maps.dialedPeer = null; }
}
