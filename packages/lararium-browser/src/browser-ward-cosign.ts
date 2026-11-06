/**
 * browser-ward-cosign — the browser vessel's composition of a ward act's co-sign gate (seat-harness#/the-swarm-slices).
 *
 * The worn face's intent plane, its proven admission roster and this leaf's fleet board reading make the port the gate reads:
 * the device count rides the projection's signed admission fold, the answerer's standing rides the fleet board (a set-aside
 * edge reads `aside`, a raise owed a roll or an unread frontier reads `unknown`), and this device's face atom asks.
 * Node parity: `nodeWardCosignPort` reads the same three sources on a node vessel.
 */
import {
  deviceEdgeId, faceIntentVerbs, faceRosterForIntents, intentPlaneCosignPort,
  type EdgeReading, type HandLineage, type IntentSigner, type LarDoc, type PersonaProjection, type WardCosignPort, type WideningRead,
} from "@lararium/mesh";

export interface BrowserFleetShadows { readonly root: string; readonly readings: ReadonlyMap<string, EdgeReading>; readonly frontier: WideningRead }

/** A device's standing as this leaf's fleet board reads it; no reading yet, or an unknown frontier, reads `unknown`. */
export function browserFleetStanding(fleet: () => BrowserFleetShadows | null): (atom: string) => "stands" | "aside" | "unknown" {
  return (atom) => {
    const shadows = fleet();
    if (!shadows || shadows.frontier.status !== "known") return "unknown";
    const reading = shadows.readings.get(deviceEdgeId(shadows.root, atom));
    return reading?.stands === true ? "aside" : reading && reading.raiseCids.length > 0 ? "unknown" : "stands";
  };
}

export function browserWardCosignPort(input: {
  readonly group: string; readonly atom: IntentSigner;
  readonly plane: { doc(): LarDoc | undefined; change(fn: (draft: LarDoc) => void): void };
  readonly flush?: () => Promise<unknown>;
  readonly projection: () => PersonaProjection;
  readonly lineage: () => HandLineage;
  readonly fleet: () => BrowserFleetShadows | null;
}): WardCosignPort {
  return intentPlaneCosignPort({
    group: input.group, requester: input.atom, verbs: faceIntentVerbs(), plane: input.plane,
    ...(input.flush ? { flush: input.flush } : {}),
    face: () => faceRosterForIntents(input.projection(), input.lineage()), standing: browserFleetStanding(input.fleet),
  });
}
