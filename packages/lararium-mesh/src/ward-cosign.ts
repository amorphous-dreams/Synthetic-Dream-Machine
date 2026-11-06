/**
 * ward-cosign: the pure judge of a ward act's co-sign.
 *
 * A ward act whose effect leaves the device (a kapae lowered, the house cap, a push go) needs a second device of the
 * face once the face holds two. The judge reads the face's own intent plane and the face's own persona projection:
 * the answer counts only from an atom in THIS face's device set, distinct from the asker's atom, standing, and the
 * ask must name the act by its digest. No clock, no timeout, no fallback: an unanswered ask stays unanswered.
 *
 * Distinctness reads face-scoped atoms alone. A vessel wearing two faces holds one atom per face, and the other
 * face's atom is no device here, so it cannot answer this face's ask. Two atoms of ONE vessel admitted into one
 * face stay the admission's to refuse (a blinded per-face vessel tag); the judge never sees a vessel key, which
 * would link a person's faces to each other.
 *
 * Class-blind: it reads devices and reach, never a vessel class.
 */
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { WARD_COSIGN_DIGEST_DOMAIN } from "./domains.js";
import { intentId } from "./intent-entry.js";
import { mayAct, type IntentState, type IntentView } from "./intent-read.js";
import { WARD_COSIGN_VERBS } from "./intent-verbs.js";
import type { PersonaProjection } from "./persona-act.js";

type Standing = "stands" | "aside" | "unknown";

/** One ward act, as its digest names it: the verb, the wiki it binds and the head it acts over. */
export interface WardCosignAct {
  readonly verb: "ward-kapae-lower" | "ward-house-cap" | "ward-push-go";
  readonly wiki: string;
  readonly head: string;
}

/** The digest an ask carries as its `detail`: it names the act, the face, the wiki and the head the act binds. */
export function cosignDigest(parts: { readonly act: string; readonly face: string; readonly wiki: string; readonly head: string }): string {
  return sha256HexBytesSync(canonicalJsonBytes({ domain: WARD_COSIGN_DIGEST_DOMAIN, act: parts.act, face: parts.face, wiki: parts.wiki, head: parts.head }));
}

export type CosignRefusal =
  | "not-a-ward-intent" | "wrong-requester" | "void" | "spent" | "awaiting-ask" | "ask-signer" | "digest-mismatch"
  | "awaiting-answer" | "contested" | "denied" | "self-answer" | "signer-not-in-face" | "answerer-aside" | "answerer-not-standing"
  | "executor-mismatch" | "requester-unknown" | "requester-aside" | "requester-not-in-face" | "frontier-unknown" | "requester-may-not-act";
export type CosignVerdict =
  | { readonly need: "none" }
  | { readonly need: "cosign"; readonly approved: true; readonly cosigner: string; readonly answer: string }
  | { readonly need: "cosign"; readonly approved: false; readonly reason: CosignRefusal };

export function judgeCosign(input: {
  readonly view: IntentView; readonly intentId: string; readonly requester: string;
  readonly projection: Pick<PersonaProjection, "devices">; readonly standing: (atom: string) => Standing; readonly digest: string;
}): CosignVerdict {
  // Aside devices count toward the total: a free raise never drops the co-sign.
  if (input.projection.devices.length < 2) return { need: "none" };
  const refuse = (reason: CosignRefusal): CosignVerdict => ({ need: "cosign", approved: false, reason });
  const requester = input.requester.toLowerCase();
  const state = input.view.intents.find((i) => i.id === input.intentId);
  if (!state || !WARD_COSIGN_VERBS.includes(state.verb)) return refuse("not-a-ward-intent");
  if (state.issuer !== requester) return refuse("wrong-requester");
  if (state.voidCause) return refuse("void");
  // Any outcome the issuer signed spends the act, in a slot or not: an answer landing after it changes nothing.
  if (state.slots.some((s) => s.winner) || state.outOfAudience.length || state.outcomes.some((o) => o.entry.signer === requester)) return refuse("spent");
  const asks = state.asks.filter((q) => q.entry.signer === requester && q.entry.body["detail"] === input.digest);
  if (state.asks.length === 0) return refuse("awaiting-ask");
  if (!state.asks.some((q) => q.entry.signer === requester)) return refuse("ask-signer");
  if (asks.length === 0) return refuse("digest-mismatch");
  if (state.answer === "contested") return refuse("contested");
  const devices = new Set(input.projection.devices.map((d) => d.toLowerCase()));
  const named = state.answers.filter((a) => asks.some((q) => q.cid === a.entry.body["ask"]));
  if (state.answer === null) {
    // Nothing counted: say why the nearest answer fails, else wait.
    const own = named.find((a) => a.entry.signer === requester);
    if (own) return refuse("self-answer");
    const near = named[0];
    if (!near) return refuse("awaiting-answer");
    const nearSigner = near.entry.signer.toLowerCase(), nearStanding = input.standing(nearSigner);
    if (!devices.has(nearSigner)) return refuse("signer-not-in-face");
    if (nearStanding === "aside") return refuse("answerer-aside");
    if (nearStanding !== "stands") return refuse("answerer-not-standing");
    if (near.entry.body["verdict"] === "approve" && String(near.entry.body["executor"] ?? "").toLowerCase() !== requester) return refuse("executor-mismatch");
    return refuse("digest-mismatch");
  }
  const answer = state.answer;
  const signer = answer.entry.signer.toLowerCase();
  if (!asks.some((q) => q.cid === answer.entry.body["ask"])) return refuse("digest-mismatch");
  if (answer.entry.body["verdict"] !== "approve") return refuse("denied");
  if (signer === requester) return refuse("self-answer");
  if (!devices.has(signer)) return refuse("signer-not-in-face");
  const standing = input.standing(signer);
  if (standing === "aside") return refuse("answerer-aside");
  if (standing !== "stands") return refuse("answerer-not-standing");
  if (String(answer.entry.body["executor"] ?? "").toLowerCase() !== requester) return refuse("executor-mismatch");
  // The answer counts: whatever the effect door still refuses names the requester's own side, never a wait.
  const may = mayAct(input.view, input.intentId, requester);
  if (!may.act) {
    if (may.reason === "unknown-frontier") return refuse(input.standing(requester) === "unknown" ? "requester-unknown" : "frontier-unknown");
    if (may.reason === "atom-aside") return refuse("requester-aside");
    if (may.reason === "not-audience") return refuse("requester-not-in-face");
    if (may.reason === "spent" || may.reason === "void") return refuse(may.reason);
    return refuse("requester-may-not-act");
  }
  return { need: "cosign", approved: true, cosigner: signer, answer: answer.cid };
}

/**
 * What a READER of a ward act's effect asks (a board's kāpae lower, the house cap, a go): does this act stand beside its co-sign?
 * The gate holds the door; the witness holds every reader, so an act signed outside the door (the root opened through the ward
 * route, never through the gate) reads as nothing on a face of two devices. `accepts` answers false where the act refuses
 * (`ward-act-uncosigned`).
 */
export interface WardActWitness { readonly accepts: (act: WardCosignAct) => boolean }

/**
 * The witness over a face's intent plane, read fresh at each call. A face whose signed admission fold holds zero or one device
 * (set-aside ones counted, as the judge counts them) accepts the act on its own. A face of two or more accepts it only beside a
 * SPENT co-sign, FROZEN at its outcome: the intent the act's digest names as its nonce (the act's own verb and words), and the
 * issuer's outcome in it, which cites the answer it spent and the fleet frontier the gate read. That cited answer approves this
 * act (an answer to the issuer's own ask naming the digest, the issuer as executor) from another device of the face, and both
 * that device and the issuer stood at the cited frontier (no raise the frontier counts sets either aside). What lands after the
 * outcome (a second approve, a deny, a raise the next frontier counts) never changes what stands; an approved intent with no
 * outcome stands nothing. A plane that did not load, or a fold that throws, accepts nothing on two devices.
 */
export function wardActWitness(input: {
  readonly group: string; readonly devices: () => readonly string[]; readonly view: () => IntentView | null;
  /** Whether a device stood at one link of the fleet's signed frontier chain (`fleetStoodAt`); a link this reader lacks reads false. */
  readonly stoodAt: (atom: string, frontier: string) => boolean;
}): WardActWitness {
  return {
    accepts: (act) => {
      let devices: readonly string[], view: IntentView | null;
      try { devices = input.devices(); } catch { return false; }
      if (devices.length < 2) return true;
      try { view = input.view(); } catch { return false; }
      if (!view) return false;
      const digest = cosignDigest({ act: act.verb, face: input.group, wiki: act.wiki, head: act.head });
      const args = { wiki: act.wiki, head: act.head }, enrolled = new Set(devices.map((d) => d.toLowerCase()));
      return view.intents.some((s) => s.verb === act.verb && s.id === intentId({ issuer: s.issuer, verb: s.verb, args, nonce: digest }) && spentCosign(s, digest, enrolled, input.stoodAt));
    },
  };
}

const record = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

function spentCosign(s: IntentState, digest: string, devices: ReadonlySet<string>, stoodAt: (atom: string, frontier: string) => boolean): boolean {
  if (s.audience.mode !== "asks") return false;
  return s.outcomes.some((o) => {
    const result = o.entry.body["result"];
    if (o.entry.signer !== s.issuer || !record(result) || result["digest"] !== digest) return false;
    const cited = result["answer"], frontier = result["frontier"];
    if (typeof cited !== "string" || typeof frontier !== "string") return false;
    const answer = s.answers.find((a) => a.cid === cited);
    if (!answer || answer.entry.body["verdict"] !== "approve") return false;
    const signer = answer.entry.signer.toLowerCase();
    if (signer === s.issuer || !devices.has(signer)) return false;
    if (String(answer.entry.body["executor"] ?? "").toLowerCase() !== s.issuer) return false;
    if (!s.asks.some((q) => q.cid === answer.entry.body["ask"] && q.entry.signer === s.issuer && q.entry.body["detail"] === digest)) return false;
    return stoodAt(signer, frontier) && stoodAt(s.issuer, frontier);
  });
}
