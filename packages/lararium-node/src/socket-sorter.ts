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
  type FaceScope, type GateAdmitReader, type GateSession,
} from "@lararium/mesh";
import type { FaceDeviceReading } from "./gate-shadow-ring.js";

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
 * ONE READER for a vessel's OWN place posture: what the gate it stands at a Nexus answers a proven peer with no arm.
 *
 *   · A LARARIUM reads its charter: OPEN only where the charter says so; an absent or torn charter reads PRIVATE,
 *     because for a hearth an absent charter is a fault and a fault fails closed.
 *   · A HERM ANSWERS THE KNOCK (operator ruling, siege-resilience "A HERM ANSWERS THE KNOCK"; stable-founding-road "A herm
 *     answers the knock"). A herm holds no charter by CLASS, a waystone and never a broken lararium, so its absent charter is no
 *     fault to fail closed on: it answers any PROVEN peer that knocked. The knock is its silence: the path derives from the
 *     gate key, and only a peer handed that key can knock at all (a bare route draws no upgrade). WHERE it stands a gate is
 *     the other half of the ruling, read elsewhere (`herm-carriage`): only at a Nexus whose quorum counted its `carry`. Its
 *     SILENT/WAYMARK rung governs the HTTP descriptor alone, never this.
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


/** A seated presenter as the D4 device book reads it: the face it wears and the digest of its face-scoped key. */
export type SeatedPresenter = { readonly scope: FaceScope; readonly vesselFaceDigest: string };

/**
 * THE DEVICE BEHIND A SEATED SESSION — what the vessel's own consults read as the peer's vessel key (the edge ring's
 * `aside`, the fetch door's fleet class, the PersonaGroup ring's proven key). A face's seat reads the device edge its
 * face-scoped key was certified to (`face-device-book`), and null where the book binds none: the face key is never a
 * device, so it never stands in for one. A place's seat reads its place key, the key its carriage names. No session
 * reads null.
 */
export function seatedDeviceKey(session: GateSession | null | undefined, deviceOf: (seat: SeatedPresenter) => FaceDeviceReading): string | null {
  if (!session) return null;
  if (session.scope === null) return session.placeKey ?? null;
  if (typeof session.vesselFaceDigest !== "string") return null;
  let reading: FaceDeviceReading;
  try { reading = deviceOf({ scope: session.scope, vesselFaceDigest: session.vesselFaceDigest }); } catch { return null; }
  return "device" in reading && typeof reading.device === "string" && reading.device.length > 0 ? reading.device.toLowerCase() : null;
}

/** What a refold reads to keep a same-operator seat: the facts its gate read, read again. */
export interface SameOperatorReading {
  /** The D4 binding: the device a face-scoped key was certified to. */
  readonly deviceOf:    (seat: SeatedPresenter) => FaceDeviceReading;
  /** The fleet shadow over that device (the edge ring's `deviceAside`). */
  readonly deviceAside: (device: string) => boolean;
  /** The admit reader of the gate that seated the session, for its Nexus (`vesselAdmitReader`). */
  readonly admits:      (nexus: string) => Pick<GateAdmitReader, "read">;
}

/**
 * Does a same-operator session still stand where its gate would seat it same-operator today? Its device still binds
 * and no standing shadow sets it aside, and the admit it rode still reads HELD at its own Nexus, heading at its face
 * key. A reading that throws or cannot read answers false: the session closes, as the gate would answer silence. A
 * session of any other class answers true here; its own reading keeps it (`socketsNoLongerHeld`).
 *
 * Canon: lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings ("A device set aside"); kapae#/reach.
 */
export async function sameOperatorStands(session: GateSession, now: SameOperatorReading): Promise<boolean> {
  if (session.class !== "same-operator") return true;
  try {
    const scope = session.scope;
    if (scope === null || session.arm?.kind !== "admit") return false;
    const device = seatedDeviceKey(session, now.deviceOf);
    if (device === null || now.deviceAside(device)) return false;
    const reading = await now.admits(scope.nexus).read({ admit: session.arm.admit, lineage: session.arm.lineage });
    if ("refusal" in reading) return false;
    return reading.verdict.state === "held" && reading.head === scope.faceKey && reading.nexus === scope.nexus;
  } catch { return false; }
}
