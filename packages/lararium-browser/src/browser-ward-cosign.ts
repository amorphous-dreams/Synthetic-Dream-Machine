/**
 * browser-ward-cosign — the browser vessel's composition of a ward act's co-sign gate (seat-harness#/the-swarm-slices).
 *
 * The worn face's intent plane, its proven admission roster and this leaf's fleet board reading make the port the gate reads:
 * the device count rides the persona plane's signed admission fold, FOLDED AGAIN AT EACH ACT (`browserFaceFold`), so a tab that
 * booted with one device counts a second one admitted since; the answerer's standing rides the fleet board (a set-aside edge reads
 * `aside`, a raise owed a roll or an unread frontier reads `unknown`); the fleet's frontier head and its chain's links ride the same
 * reading (a ward act's outcome cites the link it spent at, and its readers judge the co-signer and the issuer there), and this
 * device's face atom asks. A fold that does not prove refuses `ward-cosign-fold-unread`.
 * Node parity: `nodeWardCosignPort` reads the same three sources on a node vessel.
 *
 * THE ANSWER DOOR (`browserWardAnswer`): this browser answers a ward ask through its own ward. An approve signs only inside a fresh
 * ward act of this face on this browser (the per-act ward worker, opened from the passphrase typed for that one act, zeroed after),
 * and carries the ward signature of the face's ward key (resting under a ward of its own, `ward/sign/<group>/…`, whose public half
 * this browser's admission carries) over (the answer, the ask's digest, the fleet frontier this leaf read). A passkey route refuses
 * `ward-passkey-refused`; a deny and an answer to any other ask open no ward.
 */
import { browserWardKeySign, type WardAskKind } from "./browser-ward.js";
import type { WardRoute } from "./ward-core.js";
import {
  answerRefusal, askShown, buildAnswer, buildWardedAnswer, type SignedIntentEntry,
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
 * doc and the admit bundle) and the KEL as it stands at that read: null where it does not prove.
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
  /** The worn face's signed admission fold, read at each call (`browserFaceFold`); null where it does not prove. */
  readonly fold: () => PersonaProjection | null;
  readonly lineage: () => HandLineage;
  readonly fleet: () => BrowserFleetShadows | null;
}): WardCosignPort {
  const projection = (): PersonaProjection => {
    const folded = input.fold();
    if (!folded) throw new WardRefused("ward-cosign-fold-unread", "the worn face's signed admission fold does not prove, so its device count reads nothing");
    return folded;
  };
  return intentPlaneCosignPort({
    group: input.group, requester: input.atom, verbs: faceIntentVerbs(), plane: input.plane,
    ...(input.flush ? { flush: input.flush } : {}),
    face: () => faceRosterForIntents(projection(), input.lineage()), standing: browserFleetStanding(input.fleet),
    frontier: () => { const read = input.fleet()?.frontier; return read?.status === "known" ? read.asOf[FLEET_HAND]?.cid ?? null : null; },
    stoodAt: (atom, frontier) => { const shadows = input.fleet(); return !!shadows && fleetStoodAt({ links: shadows.links, readings: shadows.readings, fleetRoot: shadows.root, atom, frontier }); },
    wardKey: (atom) => input.fold()?.wardKeys[atom] ?? null,
  });
}

/** A route a person offers one ward act: the passphrase typed for it. A passkey names a vendor registry and opens no ward. */
export type BrowserWardRoute = string | { readonly kind: "passphrase"; readonly passphrase: string } | { readonly kind: "passkey"; readonly [k: string]: unknown };

/**
 * Answer one ask as this browser's face atom, over the gate's own port (its plane, its frontier, its write). The door refuses before
 * it signs what the plane would count as nothing (`answerRefusal`), and an approve of a ward act signs inside a fresh ward act of
 * this face on this browser, its frontier the one this leaf reads now (none known refuses `ward-cosign-frontier-unknown`).
 */
export async function browserWardAnswer(input: {
  readonly idbName: string; readonly group: string; readonly atom: IntentSigner; readonly port: WardCosignPort;
  readonly ask: string; readonly executor: string; readonly deny: boolean;
  /** The page's dialog: the route the person types for this one act. */
  readonly route: (act: string, kind: WardAskKind) => Promise<BrowserWardRoute>;
}): Promise<SignedIntentEntry> {
  const view = input.port.view();
  const asked = view ? askShown(view, input.ask) : null;
  const refusal = answerRefusal(asked, input.atom.key.toLowerCase(), input.executor, input.deny);
  if (refusal || !asked) throw new WardRefused(/^[a-z-]+/.exec(refusal ?? "ward-ask-unseen")![0], refusal ?? "the ask has not reached this browser");
  let entry: SignedIntentEntry;
  if (!asked.cosign || input.deny) {
    entry = await buildAnswer({ group: input.group, signer: input.atom, ask: input.ask, executor: input.executor, verdict: input.deny ? "deny" : "approve", refs: [input.ask] });
  } else {
    const frontier = input.port.frontier();
    if (frontier === null) throw new WardRefused("ward-cosign-frontier-unknown", "this leaf reads no known fleet frontier, so its approve names none");
    const route = await input.route(`the co-sign approve of ${asked.verb}`, "open");
    if (typeof route !== "string" && route.kind === "passkey") throw new WardRefused("ward-passkey-refused", "the ward opens to human routes alone (a passphrase, a paper sheet); a passkey rides an authenticator vendor's registry");
    entry = await buildWardedAnswer({ group: input.group, signer: input.atom, ask: input.ask, detail: String(asked.detail ?? ""), executor: input.executor, frontier,
      wardSign: async (bytes) => (await browserWardKeySign(input.idbName, input.group, route as WardRoute, bytes)).signature });
  }
  await input.port.write(entry);
  return entry;
}
