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
 * So the relation reads off the dial's PIN and the act that wrote it:
 *   · the bootstrap's pin, tagged `fleet-join-land` for the face this vessel WEARS → that face's own hearth: a face view of the
 *     worn face (the same seat an inbound same-face session takes);
 *   · a kept admit bundle's pin → the CONTRACTED class and its standing at the pin's Nexus, and no private plane;
 *   · any other pin (no tag, a tag for another face) → the weakest relation: no class, no view, the wire shelf and the realm's
 *     return lane alone (fail closed).
 *
 * The seat writes the composer's own maps (class, standing, face view) and nothing it cannot prove: no gate session and no
 * face key ride a dial, so the Kahu guard (which reads a gate session) withholds the canon from a dialed hearth.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/nexus-client-dial
 */
import type { PeerClass } from "@lararium/mesh";
import type { HearthPinProvenance } from "./hearth-dial-pin.js";

export type DialRelation =
  | { readonly kind: "same-face";  readonly personaGroup: string; readonly nexus: string | null }
  | { readonly kind: "contracted"; readonly nexus: string | null }
  | { readonly kind: "untagged" };

/** The AID text a pin's hex Nexus names, or null where it reads as none. */
function nexusOfPin(pinNexus: string | null): string | null {
  if (!pinNexus || !/^(?:[0-9a-f]{2})+$/.test(pinNexus)) return null;
  const text = Buffer.from(pinNexus, "hex").toString("utf8");
  return text.length > 0 ? text : null;
}

/** The relation a dial's pin proves, from where the pin came and the face this vessel wears. */
export function dialRelationOf(input: {
  readonly source:      "bootstrap" | "kept" | null;
  readonly provenance?: HearthPinProvenance | null;
  readonly pinNexus:    string | null;
  readonly wornGroup:   string | null;
}): DialRelation {
  const nexus = nexusOfPin(input.pinNexus);
  if (input.source === "bootstrap" && input.provenance?.act === "fleet-join-land" && input.wornGroup !== null
      && input.provenance.personaGroup === input.wornGroup) {
    return { kind: "same-face", personaGroup: input.wornGroup, nexus };
  }
  if (input.source === "kept") return { kind: "contracted", nexus };
  return { kind: "untagged" };
}

/** The composer's seat maps a dial writes. */
export interface DialSeatMaps {
  readonly peerClassMap: Map<string, PeerClass>;
  readonly peerNexus:    Map<string, string | null>;
  readonly faceViews:    { seat(peerId: string, face: { readonly personaGroup: string } | null): void; drop(peerId: string): void };
}

/** Seat a dialed peer under the relation its pin proved; an untagged pin seats nothing. */
export function seatDialPeer(maps: DialSeatMaps, peerId: string, relation: DialRelation): void {
  unseatDialPeer(maps, peerId);
  if (relation.kind === "untagged") return;
  maps.peerNexus.set(peerId, relation.nexus);
  if (relation.kind === "same-face") {
    maps.peerClassMap.set(peerId, "same-operator");
    maps.faceViews.seat(peerId, { personaGroup: relation.personaGroup });
    return;
  }
  maps.peerClassMap.set(peerId, "contracted");
}

/** The dialed peer left (or its arrival was replaced): drop its class, its standing and its view. */
export function unseatDialPeer(maps: DialSeatMaps, peerId: string): void {
  maps.peerClassMap.delete(peerId);
  maps.peerNexus.delete(peerId);
  maps.faceViews.drop(peerId);
}
