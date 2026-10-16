/**
 * socket-sorter — the ONE sorter a vessel's face gates arm with (`@lararium/mesh` `face-gate` `GateSorter`): every
 * presenter the gate proved is classed once, before any verdict, over the facts the gate itself read.
 *
 *   · same-operator — the gate read the admit HELD, the PersonaGroup ring answered a grant for this very face,
 *                     no fleet shadow sets the presenter's device aside (D4, `gate-shadow-ring`), and the gate
 *                     stands at the sovereign tier. Same-operator establishes TRANSPORT alone: the session's proven
 *                     face and its scoped document view decide each document (D3);
 *   · contracted    — the gate read the admit HELD, standing as the proven face key at the admit's Nexus; or a
 *                     faceless PLACE presented a carriage contract the gate read HELD, standing as the place key;
 *   · walker        — SHUT by name at the cutover: a grant or claim arm draws nothing until a live grant reader
 *                     opens it (`SHUT_ARMS`);
 *   · stranger      — a presenter with no arm, answered only where THIS gate's Nexus reads OPEN. Otherwise it is
 *                     SILENCE, exactly like a failed proof.
 *
 * One gate stands per (Nexus, route), so the sorter reads that Nexus's posture alone, fresh at each sort.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/socket-sorter
 */

import {
  federationPostureFromDoc,
  type FederationPosture, type GateSorter, type GateSortInput, type GateSortVerdict, type NexusDoc, type PeerClass,
} from "@lararium/mesh";

/** The arms that ship SHUT at the cutover: a walker's hosting grant and its invite claim. */
export const SHUT_ARMS = Object.freeze(["grant", "claim"] as const);
export type ShutArm = (typeof SHUT_ARMS)[number];

export interface GateSorterDeps {
  /** The posture of the ONE Nexus this gate stands in, read fresh at every sort. */
  readonly posture: () => FederationPosture;
  /** Where a shut arm's name goes: this vessel's own log. The presenter hears nothing of it. */
  readonly onShut?: (arm: ShutArm) => void;
}

/** The kind of place a vessel stands as: a hearth (a lararium, with a face) or a crossroads (a herm). */
export type PlaceClass = "lararium" | "herm";

/**
 * ONE READER for a vessel's OWN place posture — the posture the gate of its own Nexus reads.
 *
 *   · A LARARIUM reads its charter: OPEN only where the charter says so; an absent or torn charter reads PRIVATE,
 *     because for a hearth an absent charter is a fault and a fault fails closed.
 *   · A HERM holds no charter by CLASS — a waystone, never a broken lararium — so its absent charter is no fault to
 *     fail closed on. A crossroads answers any proven peer that KNOCKED: the knock path derives from its gate key,
 *     and only a peer handed that key can knock at all (a bare route draws no upgrade). Its SILENT/WAYMARK rung
 *     governs the HTTP descriptor alone, never this.
 */
export function ownPlacePosture(placeClass: PlaceClass, charter: NexusDoc | null): FederationPosture {
  return placeClass === "herm" ? "open" : federationPostureFromDoc(charter);
}

const isShut = (kind: string): kind is ShutArm => (SHUT_ARMS as readonly string[]).includes(kind);

/** Stand the sorter for one gate. */
export function makeGateSorter(deps: GateSorterDeps): GateSorter {
  const sortNow = (input: GateSortInput): GateSortVerdict | null => {
    const arm = input.arm;
    if (arm !== null && isShut(arm.kind)) {
      // A NAME FOR THE OPERATOR NEVER DECIDES THE SORT: a callback that throws changes no verdict.
      try { deps.onShut?.(arm.kind); } catch { /* the sort goes on */ }
      return null;
    }
    if (arm?.kind === "admit") {
      if (input.admit === null || input.scope === null) return null;
      const group = input.sameGroup;
      if (input.tier === "sovereign" && !input.fleetAside && group !== null
        && group.faceKey === input.scope.faceKey && group.nexus === input.scope.nexus) return { class: "same-operator" };
      return { class: "contracted", standing: { nym: input.scope.faceKey, aid: input.admit.nexus } };
    }
    if (arm?.kind === "place") {
      if (input.place === null || input.placeKey === null) return null;
      return { class: "contracted", standing: { nym: input.placeKey, aid: input.place.nexus } };
    }
    return deps.posture() === "open" ? { class: "stranger" } : null;
  };
  return Object.freeze({ sort: async (input: GateSortInput) => sortNow(input) });
}

/**
 * The admitted sessions a refold no longer holds: a contracted session whose admit the membership no longer
 * reads held, and any stranger (or classless) session, once this gate's Nexus no longer answers strangers.
 * Same-operator and walker sessions are never dropped here. Pure; the caller drops each one silently.
 */
export function socketsNoLongerHeld<S>(
  admitted: Iterable<{ readonly peerId: string; readonly socket: S; readonly cls: PeerClass | undefined }>,
  now: { readonly holds: (peerId: string) => boolean; readonly answersStrangers: boolean },
): S[] {
  if (now.answersStrangers) return [];
  const out: S[] = [];
  for (const { peerId, socket, cls } of admitted) {
    if (cls === "same-operator" || cls === "walker") continue;
    if (cls === "contracted" && now.holds(peerId)) continue;
    out.push(socket);
  }
  return out;
}
