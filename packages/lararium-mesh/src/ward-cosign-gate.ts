/**
 * ward-cosign-gate: the hook a ward act runs before its effect, calling the co-sign judge (`judgeCosign`).
 *
 * A ward act whose effect leaves the device (a kāpae lowered, the house cap, a push go) names itself by its verb, the wiki it
 * binds and the head it acts over. The gate first reads the fleet's signed frontier head: one that does not read `known` (an
 * admission or a raise may not have synced here) refuses `ward-cosign-frontier-unknown`, one device or two, since the device count
 * it would read may be short. It then folds the face's intent plane and asks the judge:
 *   - `none` (the face's signed admission fold holds zero or one device): the act proceeds on its fresh unlock alone, whether or not
 *     the intents plane loaded;
 *   - a face of two devices whose intents plane did not load refuses `ward-cosign-intents-unread`;
 *   - `cosign`, approved by a second standing device: the act runs, then the gate signs the outcome that spends the intent, citing
 *     the answer it spent and the frontier head it read (so the readers judge the spend as it stood, `wardActWitness`); a head under
 *     which the vessel cannot read the co-signer or itself standing refuses `ward-cosign-frontier-unknown`;
 *   - `cosign` with no ask yet: the gate issues the act's intent (audience `asks`) and the issuer-signed ask whose detail
 *     carries the act's digest, and refuses `ward-awaiting-cosign: <ask cid>`;
 *   - `cosign` with the ask unanswered: it refuses `ward-awaiting-cosign: <ask cid>` again, writing nothing;
 *   - a plane that drops the act's intent (a second body under its id, an entry its fold refuses) refuses
 *     `ward-cosign-intent-dropped`, so a retry never rewrites an intent the plane will not count;
 *   - any other judge refusal refuses `ward-cosign-<reason>` (a self-answer, a digest mismatch, an aside answerer, a contested
 *     pair, a spent intent, a denial).
 * No clock, no timeout, no fallback: an offline second device keeps the act refused until it answers.
 *
 * The intent's nonce IS the act's digest, so one act at one head names one intent: a retry finds its own ask, and a replay
 * after the outcome reads `spent`. The gate reads the plane through the judge alone; the effect door's own read (`mayAct`)
 * never decides a ward act here.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-swarm-slices
 */
import { buildAsks, buildIntent, buildOutcome, type IntentSigner } from "./intent-issue.js";
import { intentEntryCid, intentEntryRecordsOfGroup, intentId, writeIntentEntry, type SignedIntentEntry } from "./intent-entry.js";
import { intentAdmissionRecordsOfGroup } from "./intent-admission.js";
import { readIntentPlane, type IntentReadInput, type IntentView } from "./intent-read.js";
import type { LarDoc } from "./base-doc.js";
import type { IntentVerbRegistry } from "./intent-verbs.js";
import { cosignDigest, judgeCosign, wardActWitness, type WardActWitness, type WardCosignAct } from "./ward-cosign.js";
import { WardRefused } from "./ward-slots.js";

type Standing = "stands" | "aside" | "unknown";

/** The face's intent plane as a ward act's gate reads and writes it; every read runs fresh at the call. */
export interface WardCosignPort {
  readonly group: string;
  /** This device's atom of the face: the act's issuer, its asker and the executor an approve names. */
  readonly requester: IntentSigner;
  readonly verbs: IntentVerbRegistry;
  /** The plane's fold, read now; null where the face's intents plane did not load. */
  view(): IntentView | null;
  /** The devices the face's signed admission fold holds, set-aside ones among them, read now; a fold that cannot be read throws by name. */
  devices(): readonly string[];
  /** The cid of the fleet's signed frontier head as this vessel reads it now; null where it does not read `known`. */
  frontier(): string | null;
  standing(atom: string): Standing;
  /** Whether a device stood at one link of the fleet's signed frontier chain this vessel holds (`fleetStoodAt`). */
  stoodAt(atom: string, frontier: string): boolean;
  /** Land one signed entry on the plane. */
  write(entry: SignedIntentEntry): Promise<void>;
}

/**
 * The port over the face's intent document, the one composition the node and browser vessels share: each read folds the
 * document as it stands, under the face's admission roster and the fleet's standing, and each write lands one entry.
 */
export function intentPlaneCosignPort(input: {
  readonly group: string; readonly requester: IntentSigner; readonly verbs: IntentVerbRegistry;
  /** The face's intents plane; null where it did not load (a one-device face still acts on its unlock alone). */
  readonly plane: { doc(): LarDoc | undefined; change(fn: (draft: LarDoc) => void): void } | null;
  readonly flush?: () => Promise<unknown>;
  /** The face's roster as its signed admission fold reads now. */
  readonly face: () => IntentReadInput["face"];
  readonly standing: (atom: string) => Standing;
  readonly frontier: () => string | null;
  readonly stoodAt: (atom: string, frontier: string) => boolean;
  readonly heldFrontiers?: () => ReadonlySet<string>;
}): WardCosignPort {
  const plane = input.plane;
  return {
    group: input.group, requester: input.requester, verbs: input.verbs, standing: input.standing, frontier: input.frontier, stoodAt: input.stoodAt,
    devices: () => input.face().devices,
    view: () => {
      if (!plane) return null;
      const doc = plane.doc();
      return readIntentPlane({ group: input.group, records: intentEntryRecordsOfGroup(doc, input.group), admissions: intentAdmissionRecordsOfGroup(doc, input.group),
        face: input.face(), standing: input.standing, verbs: input.verbs, ...(input.heldFrontiers ? { heldFrontiers: input.heldFrontiers() } : {}) });
    },
    write: async (entry) => {
      if (!plane) throw new WardRefused("ward-cosign-intents-unread", "the face's intents plane did not load, so no ask can land");
      plane.change((draft) => writeIntentEntry(draft, entry)); await input.flush?.();
    },
  };
}

export type { WardCosignAct } from "./ward-cosign.js";

/**
 * An effect that finds its own act already resting (it ran, and its outcome never landed: a crash between the two). The effect
 * throws it before it signs anything, the gate lands the outcome the act owed, and the replay refuses `ward-act-already-run`.
 */
export class WardActAlreadyRun extends WardRefused {
  constructor(verb: string, head: string) { super("ward-act-already-run", `${verb} at ${head} ran already; its outcome lands now, and nothing runs again`); }
}

/** A witness over a plane that cannot be read: no ward act stands. */
export const WARD_WITNESS_CLOSED: WardActWitness = { accepts: () => false };

/** The readers' witness over the gate's own port: the same plane, roster and standing the gate reads, fresh at each call. */
export function cosignPortWitness(port: WardCosignPort): WardActWitness {
  return wardActWitness({ group: port.group, devices: () => port.devices(), view: () => port.view(), stoodAt: (atom, frontier) => port.stoodAt(atom, frontier) });
}

/** The intent one act at one head names: the issuer, the verb, the act's own words, and the digest as its nonce. */
export function wardCosignIntentId(port: Pick<WardCosignPort, "group" | "requester">, act: WardCosignAct): { readonly id: string; readonly digest: string; readonly args: { wiki: string; head: string } } {
  const digest = cosignDigest({ act: act.verb, face: port.group, wiki: act.wiki, head: act.head });
  const args = { wiki: act.wiki, head: act.head };
  return { id: intentId({ issuer: port.requester.key.toLowerCase(), verb: act.verb, args, nonce: digest }), digest, args };
}

/**
 * Gate one ward act. `effect` runs only where the judge answers `none` or an approved co-sign; an approved act lands its outcome
 * after the effect, so a failed effect (a wrong route, a moved board) leaves the intent unspent for the hand's retry. The readers read
 * the act only beside that outcome (`wardActWitness`), so the outcome, never the effect's bytes, makes the act stand.
 */
export async function wardCosignGate<T>(port: WardCosignPort, act: WardCosignAct, effect: () => Promise<T>): Promise<T> {
  const { id, digest, args } = wardCosignIntentId(port, act);
  const requester = port.requester.key.toLowerCase();
  const refuse = (reason: string): never => { throw new WardRefused(`ward-cosign-${reason}`, `the co-sign of ${act.verb} over ${act.wiki} at ${act.head} refuses (${reason})`); };
  // An unknown frontier may hide an admission: the device count it would read could be short, so the act refuses on one device too.
  const frontier = port.frontier();
  if (frontier === null) return refuse("frontier-unknown");
  const devices = port.devices(), view = port.view();
  if (view === null && devices.length >= 2) return refuse("intents-unread");
  const viewNow = (): IntentView => port.view() ?? EMPTY_VIEW;
  const verdict = judgeCosign({ view: view ?? EMPTY_VIEW, intentId: id, requester, projection: { devices }, standing: port.standing, digest });
  if (verdict.need === "none") return effect();
  if (verdict.approved) {
    // The readers judge the spend at the frontier the outcome cites: one under which this vessel reads either side not standing lands nothing.
    if (!port.stoodAt(verdict.cosigner, frontier) || !port.stoodAt(requester, frontier)) return refuse("frontier-unknown");
    const outcome = async () => port.write(await buildOutcome({ group: port.group, signer: port.requester, cause: id,
      result: { status: "done", act: act.verb, digest, cosigner: verdict.cosigner, answer: verdict.answer, frontier } }));
    let done: T;
    // The effect lands first and its outcome after it: every reader reads the act only beside that outcome, so a crash between the
    // two leaves the act unread, and the replay finds it standing (`WardActAlreadyRun`), lands the outcome it owed, and runs nothing.
    try { done = await effect(); }
    catch (e) { if (e instanceof WardActAlreadyRun) await outcome(); throw e; }
    await outcome();
    return done;
  }
  const awaiting = (askCid: string): never => { throw new WardRefused("ward-awaiting-cosign", askCid); };
  if (verdict.reason === "not-a-ward-intent" && !viewNow().intents.some((s) => s.id === id)) {
    // Two bodies under the act's id: the plane counts neither, and a third would change nothing.
    if (viewNow().collisions.some((c) => c.id === id)) return refuse("intent-dropped");
    // The act's first reach: its intent and its ask land together, and the act waits on the second device.
    await port.write(await buildIntent({ group: port.group, signer: port.requester, verb: act.verb, args, nonce: digest, audience: { mode: "asks" }, verbs: port.verbs }));
    // The plane must count what landed: an intent its fold refuses would wait on an answer nothing can give.
    if (!viewNow().intents.some((s) => s.id === id)) return refuse("intent-dropped");
    const ask = await buildAsks({ group: port.group, signer: port.requester, intent: id, needs: "approval", detail: digest });
    await port.write(ask);
    return awaiting(intentEntryCid(ask));
  }
  if (verdict.reason === "awaiting-ask") {
    const ask = await buildAsks({ group: port.group, signer: port.requester, intent: id, needs: "approval", detail: digest });
    await port.write(ask);
    return awaiting(intentEntryCid(ask));
  }
  if (verdict.reason === "awaiting-answer") {
    const own = viewNow().intents.find((s) => s.id === id)?.asks
      .filter((q) => q.entry.signer === requester && q.entry.body["detail"] === digest).map((q) => q.cid).sort()[0];
    if (own) return awaiting(own);
  }
  return refuse(verdict.reason);
}

/** The fold of a plane that holds nothing: the judge reads it where a one-device face's intents plane did not load. */
const EMPTY_VIEW: IntentView = { intents: [], delegations: [], refused: [], refusedAdmissions: [], collisions: [], strayAnswers: [],
  standing: () => "unknown", holdsCapability: () => false, face: { devices: [], rosterCids: [], admittedAt: new Map(), lineage: [] as never } };
