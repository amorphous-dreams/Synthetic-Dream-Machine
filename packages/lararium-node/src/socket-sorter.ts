/**
 * socket-sorter — the ONE sorter a vessel's gates arm with: every proven socket is classed before any verdict.
 *
 *   · same-operator — the keyholder worker vouched it (cap=admin@daemon, or a KEL-pinned device edge);
 *   · contracted    — it presented an admit, and `leafStandingFor` reads that admit HELD against a Nexus this
 *                     vessel carries (its leaf proof over this socket, its charter lineage, the deny board, the
 *                     antigen); or it is a faceless PLACE whose vessel key this vessel's own board counts a
 *                     carrier contract for (`carrier`) — a place proves by its wire key, the only nym it has;
 *   · stranger      — everything else. A gate answers strangers only if SOME Nexus it stands in reads OPEN —
 *                     its own primary charter or any it carries (`gateAnswersStrangers`); otherwise a stranger
 *                     is SILENCE, exactly like a failed proof.
 *
 * The fold itself is mesh's pure `classifySocket`; this module gathers its inputs off the vessel's own carried
 * readings, as of its last sync. A gate's posture is the true multi-Nexus rule: per-shrine silence over every
 * Nexus one gate key serves, which reduces exactly to per-Nexus posture once each Nexus carries its own wire key.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/socket-sorter
 */

import { classifySocket, answersStrangers, type FederationPosture, type PeerClass } from "@lararium/mesh";
import type { SocketSorter, SortVerdict } from "./daemon-auth-gate.js";
import { leafStandingFor, type CarriedNexusReading, type SocketBinding } from "./nexus-carriage.js";

export interface SocketSorterDeps {
  /** The carried Nexuses' readings as of this vessel's last sync — what an admit is held against, and whose
   *  postures decide whether strangers are answered. */
  readonly readings: () => Promise<readonly CarriedNexusReading[]>;
  /** Does this vessel's own board count a carrier contract for this wire key (a faceless PLACE)? */
  readonly carrier:  (vesselKey: string) => boolean;
  /** The posture of the vessel's own primary charter, read fresh (PRIVATE when absent or torn). */
  readonly primaryPosture: () => FederationPosture;
}

/**
 * Does a gate answer strangers? Iff its own primary charter or any Nexus it carries reads OPEN — the
 * multi-Nexus fold (`answersStrangers`) over every Nexus one gate key serves.
 */
export function gateAnswersStrangers(primary: FederationPosture, readings: readonly CarriedNexusReading[]): boolean {
  return answersStrangers([primary, ...readings.map((r) => r.posture)]);
}

/** Stand the vessel's sorter over its carried readings. */
export function makeSocketSorter(deps: SocketSorterDeps): SocketSorter {
  return async (input) => {
    if (input.sameOperator) return { class: "same-operator" };
    const readings = await deps.readings();
    let standing: SortVerdict["standing"];
    const presented = input.presented;
    if (presented?.kind === "admit") {
      const binding: SocketBinding = {
        presentedAdmit: presented, nonce: input.challenge.nonce,
        gatePubKey: input.challenge.gatePubKey, vesselKey: input.vesselKey,
      };
      const held = await leafStandingFor(binding, readings);
      if (held) standing = { nym: held.nym, aid: held.aid };
    }
    const cls = classifySocket({
      sameOperator: false,
      contracted: standing !== undefined || (presented === undefined && deps.carrier(input.vesselKey)),
      walker: false,
      answersStrangers: gateAnswersStrangers(deps.primaryPosture(), readings),
    });
    if (cls === null) return null;
    return cls === "contracted" && standing ? { class: cls, standing } : { class: cls };
  };
}

/**
 * The admitted sockets a refold no longer holds: a contracted socket whose admit the membership no longer
 * reads held, and any stranger (or classless) socket, once no carried Nexus answers strangers. Same-operator
 * and walker sockets are never dropped here — a walker's standing re-reads at its own next dial. Pure; the
 * caller drops each one silently.
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
