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
import { mayAct, type IntentView } from "./intent-read.js";
import { WARD_COSIGN_VERBS } from "./intent-verbs.js";
import type { PersonaProjection } from "./persona-act.js";

type Standing = "stands" | "aside" | "unknown";

/** The digest an ask carries as its `detail`: it names the act, the face, the wiki and the head the act binds. */
export function cosignDigest(parts: { readonly act: string; readonly face: string; readonly wiki: string; readonly head: string }): string {
  return sha256HexBytesSync(canonicalJsonBytes({ domain: WARD_COSIGN_DIGEST_DOMAIN, act: parts.act, face: parts.face, wiki: parts.wiki, head: parts.head }));
}

export type CosignRefusal =
  | "not-a-ward-intent" | "wrong-requester" | "void" | "spent" | "awaiting-ask" | "ask-signer" | "digest-mismatch"
  | "awaiting-answer" | "contested" | "denied" | "self-answer" | "signer-not-in-face" | "answerer-aside" | "answerer-not-standing"
  | "executor-mismatch";
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
  if (state.slots.some((s) => s.winner) || state.outOfAudience.length) return refuse("spent");
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
  if (!mayAct(input.view, input.intentId, requester).act) return refuse("awaiting-answer");
  return { need: "cosign", approved: true, cosigner: signer, answer: answer.cid };
}
