/**
 * browser-ward-cosign — the browser vessel's composition of a ward act's co-sign gate (seat-harness#/the-swarm-slices).
 *
 * The worn face's intent plane, its proven admission roster and this leaf's fleet board reading make the port the gate reads:
 * the device count rides the persona plane's signed admission fold, FOLDED AGAIN AT EACH ACT (`browserFaceFold`), so a tab that
 * booted with one device counts a second one admitted since; the answerer's standing rides the fleet board (a set-aside edge reads
 * `aside`, a raise owed a roll or an unread frontier reads `unknown`); the fleet's frontier head and its chain's links ride the same
 * reading (a ward act's outcome cites the link it spent at, and its readers judge the co-signer and the issuer there), and this
 * device's face atom asks. A fold that no longer proves refuses `ward-cosign-fold-unread`.
 * Node parity: `nodeWardCosignPort` reads the same three sources on a node vessel.
 */
import {
  deviceEdgeId, faceIntentVerbs, faceRosterForIntents, fleetStoodAt, intentPlaneCosignPort, proveFaceFromLog, WardRefused, FLEET_HAND,
  type EdgeReading, type FaceAnchor, type HandLineage, type IntentSigner, type LarDoc, type PersonaKelEvent, type PersonaProjection, type WardCosignPort, type WideningRead,
} from "@lararium/mesh";

export interface BrowserFleetShadows {
  readonly root: string; readonly readings: ReadonlyMap<string, EdgeReading>; readonly frontier: WideningRead;
  /** Each link of the fleet's verified frontier chain, by cid, with the raises it counts (`fleetFrontierLinks`): a ward act's frozen spend reads at the link its outcome cites. */
  readonly links: ReadonlyMap<string, readonly string[]>;
}

/** A device's standing as this leaf's fleet board reads it; no reading yet, or an unknown frontier, reads `unknown`. */
export function browserFleetStanding(fleet: () => BrowserFleetShadows | null): (atom: string) => "stands" | "aside" | "unknown" {
  return (atom) => {
    const shadows = fleet();
    if (!shadows || shadows.frontier.status !== "known") return "unknown";
    const reading = shadows.readings.get(deviceEdgeId(shadows.root, atom));
    return reading?.stands === true ? "aside" : reading && reading.raiseCids.length > 0 ? "unknown" : "stands";
  };
}

/**
 * The worn face's persona plane folded at each read, the boot's own proof run again over the records as they stand now (the plane
 * doc and the admit bundle) and the KEL as it stands now: null where it no longer proves.
 */
export function browserFaceFold(input: {
  readonly records: () => readonly unknown[]; readonly chain: () => readonly PersonaKelEvent[] | null;
  readonly group: string; readonly anchor: FaceAnchor; readonly deviceKey: string; readonly planes: Readonly<Record<string, string | null | undefined>>;
  readonly edge?: Parameters<typeof proveFaceFromLog>[0]["edge"];
}): () => PersonaProjection | null {
  return () => {
    const chain = input.chain();
    if (!chain) return null;
    const proof = proveFaceFromLog({ records: input.records(), chain, group: input.group, anchor: input.anchor, deviceKey: input.deviceKey, planes: input.planes, ...(input.edge ? { edge: input.edge } : {}) });
    return proof.ok ? proof.projection : null;
  };
}

export function browserWardCosignPort(input: {
  readonly group: string; readonly atom: IntentSigner;
  readonly plane: { doc(): LarDoc | undefined; change(fn: (draft: LarDoc) => void): void };
  readonly flush?: () => Promise<unknown>;
  /** The worn face's signed admission fold, read at each call (`browserFaceFold`); null where it no longer proves. */
  readonly fold: () => PersonaProjection | null;
  readonly lineage: () => HandLineage;
  readonly fleet: () => BrowserFleetShadows | null;
}): WardCosignPort {
  const projection = (): PersonaProjection => {
    const folded = input.fold();
    if (!folded) throw new WardRefused("ward-cosign-fold-unread", "the worn face's signed admission fold no longer proves, so its device count reads nothing");
    return folded;
  };
  return intentPlaneCosignPort({
    group: input.group, requester: input.atom, verbs: faceIntentVerbs(), plane: input.plane,
    ...(input.flush ? { flush: input.flush } : {}),
    face: () => faceRosterForIntents(projection(), input.lineage()), standing: browserFleetStanding(input.fleet),
    frontier: () => { const read = input.fleet()?.frontier; return read?.status === "known" ? read.asOf[FLEET_HAND]?.cid ?? null : null; },
    stoodAt: (atom, frontier) => { const shadows = input.fleet(); return !!shadows && fleetStoodAt({ links: shadows.links, readings: shadows.readings, fleetRoot: shadows.root, atom, frontier }); },
  });
}
