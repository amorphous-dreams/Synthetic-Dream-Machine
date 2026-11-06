/**
 * ward-cosign-gate: the hook a ward act runs before its effect, calling the co-sign judge (`judgeCosign`).
 *
 * A ward act whose effect leaves the device (a kāpae lowered, the house cap, a push go) names itself by its verb, the wiki it
 * binds and the head it acts over. The gate folds the face's intent plane and asks the judge:
 *   - `none` (the face holds zero or one device): the act proceeds on its fresh unlock alone;
 *   - `cosign`, approved by a second standing device: the act runs, then the gate signs the outcome that spends the intent;
 *   - `cosign` with no ask yet: the gate issues the act's intent (audience `asks`) and the issuer-signed ask whose detail
 *     carries the act's digest, and refuses `ward-awaiting-cosign: <ask cid>`;
 *   - `cosign` with the ask unanswered: it refuses `ward-awaiting-cosign: <ask cid>` again, writing nothing;
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
import { cosignDigest, judgeCosign } from "./ward-cosign.js";
import { WardRefused } from "./ward-slots.js";

type Standing = "stands" | "aside" | "unknown";

/** The face's intent plane as a ward act's gate reads and writes it; every read runs fresh at the call. */
export interface WardCosignPort {
  readonly group: string;
  /** This device's atom of the face: the act's issuer, its asker and the executor an approve names. */
  readonly requester: IntentSigner;
  readonly verbs: IntentVerbRegistry;
  /** The plane's fold, read now. */
  view(): IntentView;
  /** The devices the face's signed admission fold holds, set-aside ones among them. */
  devices(): readonly string[];
  standing(atom: string): Standing;
  /** Land one signed entry on the plane. */
  write(entry: SignedIntentEntry): Promise<void>;
}

/**
 * The port over the face's intent document, the one composition the node and browser vessels share: each read folds the
 * document as it stands, under the face's admission roster and the fleet's standing, and each write lands one entry.
 */
export function intentPlaneCosignPort(input: {
  readonly group: string; readonly requester: IntentSigner; readonly verbs: IntentVerbRegistry;
  readonly plane: { doc(): LarDoc | undefined; change(fn: (draft: LarDoc) => void): void };
  readonly flush?: () => Promise<unknown>;
  /** The face's roster as its signed admission fold reads now. */
  readonly face: () => IntentReadInput["face"];
  readonly standing: (atom: string) => Standing;
  readonly heldFrontiers?: () => ReadonlySet<string>;
}): WardCosignPort {
  return {
    group: input.group, requester: input.requester, verbs: input.verbs, standing: input.standing,
    devices: () => input.face().devices,
    view: () => {
      const doc = input.plane.doc();
      return readIntentPlane({ group: input.group, records: intentEntryRecordsOfGroup(doc, input.group), admissions: intentAdmissionRecordsOfGroup(doc, input.group),
        face: input.face(), standing: input.standing, verbs: input.verbs, ...(input.heldFrontiers ? { heldFrontiers: input.heldFrontiers() } : {}) });
    },
    write: async (entry) => { input.plane.change((draft) => writeIntentEntry(draft, entry)); await input.flush?.(); },
  };
}

/** One ward act, as its digest names it. */
export interface WardCosignAct {
  readonly verb: "ward-kapae-lower" | "ward-house-cap" | "ward-push-go";
  readonly wiki: string;
  readonly head: string;
}

/** The intent one act at one head names: the issuer, the verb, the act's own words, and the digest as its nonce. */
export function wardCosignIntentId(port: Pick<WardCosignPort, "group" | "requester">, act: WardCosignAct): { readonly id: string; readonly digest: string; readonly args: { wiki: string; head: string } } {
  const digest = cosignDigest({ act: act.verb, face: port.group, wiki: act.wiki, head: act.head });
  const args = { wiki: act.wiki, head: act.head };
  return { id: intentId({ issuer: port.requester.key.toLowerCase(), verb: act.verb, args, nonce: digest }), digest, args };
}

/**
 * Gate one ward act. `effect` runs only where the judge answers `none` or an approved co-sign; an approved act lands its outcome
 * after the effect, so a failed effect (a wrong route, a moved board) leaves the intent unspent for the hand's retry.
 */
export async function wardCosignGate<T>(port: WardCosignPort, act: WardCosignAct, effect: () => Promise<T>): Promise<T> {
  const { id, digest, args } = wardCosignIntentId(port, act);
  const requester = port.requester.key.toLowerCase();
  const judge = () => judgeCosign({ view: port.view(), intentId: id, requester, projection: { devices: port.devices() }, standing: port.standing, digest });
  const verdict = judge();
  if (verdict.need === "none") return effect();
  if (verdict.approved) {
    const done = await effect();
    await port.write(await buildOutcome({ group: port.group, signer: port.requester, cause: id, result: { status: "done", act: act.verb, digest, cosigner: verdict.cosigner, answer: verdict.answer } }));
    return done;
  }
  const awaiting = (askCid: string): never => { throw new WardRefused("ward-awaiting-cosign", askCid); };
  if (verdict.reason === "not-a-ward-intent" && !port.view().intents.some((s) => s.id === id)) {
    // The act's first reach: its intent and its ask land together, and the act waits on the second device.
    await port.write(await buildIntent({ group: port.group, signer: port.requester, verb: act.verb, args, nonce: digest, audience: { mode: "asks" }, verbs: port.verbs }));
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
    const own = port.view().intents.find((s) => s.id === id)?.asks
      .filter((q) => q.entry.signer === requester && q.entry.body["detail"] === digest).map((q) => q.cid).sort()[0];
    if (own) return awaiting(own);
  }
  throw new WardRefused(`ward-cosign-${verdict.reason}`, `the co-sign of ${act.verb} over ${act.wiki} at ${act.head} refuses (${verdict.reason})`);
}
