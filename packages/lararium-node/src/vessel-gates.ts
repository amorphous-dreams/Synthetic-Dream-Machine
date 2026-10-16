/**
 * vessel-gates — ONE face gate per (Nexus, route), assembled from this vessel's own readers (`@lararium/mesh`
 * `face-gate`). Every gate a vessel stands, the sovereign sync route and the floor's oracle alike, assembles here:
 *
 *   · THE ADMIT READER holds the root of the gate's own Nexus alone (`gateHeldRoot`), read fresh at every admit;
 *   · THE SHADOW RING is the vessel's one D4 reading (`gate-shadow-ring`);
 *   · THE GRANT RING answers the PersonaGroup grant this vessel holds for a face (`gate-rings`);
 *   · THE SORTER reads this Nexus's posture alone (`socket-sorter`), and the walker's arms ship shut;
 *   · THE WITHDRAWAL MEMORY outlives a restart where the composer hands the sealed store (`gate-memory-rows`).
 *
 * The gate's bundle comes from the composer, derived under the tier's own root door: a sovereign route's from the
 * custody root, a floor route's from the floor key. The session table comes from the route's own consumer.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/vessel-gates
 */
import {
  makeFaceGate, presentedAdmitReader,
  type FaceGate, type FederationPosture, type GateBundle, type GateDeadlines, type GateFaceGrantRing, type GateShadowRing,
  type FaceGateDeps, type GateSilenceDetail, type GateSilenceReason, type GateSessionTable, type GateWithdrawalMemory,
} from "@lararium/mesh";
import { gateHeldRoot, type CarriedNexusReading } from "./nexus-carriage.js";
import { makeGateSorter, type ShutArm } from "./socket-sorter.js";

/** What every gate of one vessel reads. */
export interface VesselGateDeps {
  /** The carried Nexuses' held roots, as of this vessel's last sync. */
  readonly readings:    () => Promise<readonly CarriedNexusReading[]>;
  /** The posture of the Nexus a gate stands in, read fresh at every sort. */
  readonly posture:     (nexus: string) => FederationPosture;
  readonly shadows:     GateShadowRing;
  readonly grants:      GateFaceGrantRing;
  readonly withdrawals: GateWithdrawalMemory;
  readonly deadlines:   GateDeadlines;
  /** The audience every dial names: the daemon bag. */
  readonly audience:    string;
  /** A refusal's cause, for this vessel's own log; the wire never carries it. */
  readonly onRefuse?:   (at: { readonly nexus: string; readonly route: string; readonly tier: string }, reason: GateSilenceReason, detail?: GateSilenceDetail) => void;
  /** A shut route's name, for this vessel's own log. */
  readonly onShut?:     (arm: ShutArm, at: { readonly nexus: string; readonly route: string }) => void;
}

/** Stand one gate for `nexus` under `bundle`, seating through `sessions`. */
export function vesselGate(deps: VesselGateDeps, at: { readonly bundle: GateBundle; readonly nexus: string; readonly sessions: GateSessionTable }): FaceGate {
  const where = { nexus: at.nexus, route: at.bundle.pin.route, tier: at.bundle.pin.tier };
  return makeFaceGate({
    bundle: at.bundle, nexus: at.nexus as FaceGateDeps["nexus"], audience: deps.audience, deadlines: deps.deadlines,
    admits: presentedAdmitReader(gateHeldRoot(deps.readings, at.nexus)),
    shadows: deps.shadows, grants: deps.grants, withdrawals: deps.withdrawals, sessions: at.sessions,
    sorter: makeGateSorter({
      posture: () => deps.posture(at.nexus),
      ...(deps.onShut ? { onShut: (arm: ShutArm) => deps.onShut!(arm, where) } : {}),
    }),
    ...(deps.onRefuse ? { onRefuse: (reason: GateSilenceReason, detail?: GateSilenceDetail) => deps.onRefuse!(where, reason, detail) } : {}),
  });
}
