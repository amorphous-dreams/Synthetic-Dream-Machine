/**
 * THE DOOR'S OUTCOME HELPERS: what a line asks (a receipt, a cancel, a held ask), how an outcome reads as told (a whole
 * answer, or a verdict whose body left), a visit's withheld body, the input digest a same-id re-ask must match, and the
 * vessel's own wait ending.
 * Heleuma ha: see lararium/mesh/uds-channel-outcome.
 */

import { choreReceiptMarkOf, type ChoreReceiptMark } from "@lararium/mesh/chore-ask";
import { releasedBodyOf, verbInputDigest } from "@lararium/mesh/verb-tiddler";
import type { CallTouches } from "@lararium/mesh/call-touches";
import type { Invocation } from "./shapes.js";

/** Merge the documents a call changed on the island (its outcome's `touched`) with those it changed here: the later heads win. */
export function mergeCallTouches(...parts: ReadonlyArray<CallTouches | null | undefined>): CallTouches | null {
  const out: Record<string, readonly string[]> = {};
  for (const part of parts) if (part) for (const [id, heads] of Object.entries(part)) out[id] = heads;
  return Object.keys(out).length > 0 ? out : null;
}
/** An outcome's `touched` field, read with no trust: a malformed one reads as none. */
export function touchedOfField(raw: unknown): CallTouches | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out: Record<string, readonly string[]> = {};
    for (const [id, heads] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(heads) && heads.every((h: unknown) => typeof h === "string")) out[id] = heads as string[];
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch { return null; }
}

/** A read-only receipt query — `{op:"receipt", requestId}`. Never reaches `placeVerb`. */
export interface ReceiptQuery { op: "receipt"; requestId: string; }
/** An explicit withdrawal — `{op:"cancel", requestId}`. Where nothing this vessel holds names the id, the ask book marks
 *  it abandoned, so a later dispatch under the SAME id in this life refuses rather than running. Answers what the vessel
 *  holds for the id, as a receipt query would. */
export interface CancelQuery { op: "cancel"; requestId: string; }

export function isReceiptQuery(v: unknown): v is ReceiptQuery {
  return !!v && typeof v === "object" && (v as { op?: unknown }).op === "receipt" && typeof (v as { requestId?: unknown }).requestId === "string";
}
export function isCancelQuery(v: unknown): v is CancelQuery {
  return !!v && typeof v === "object" && (v as { op?: unknown }).op === "cancel" && typeof (v as { requestId?: unknown }).requestId === "string";
}

/** True where an outcome answers a VISIT: its output carries `visit: true` (keyhive `crossFaceReactor`). */
export function isVisitOutcome(outcome: Record<string, unknown>): boolean {
  const output = ((outcome["results"] as Record<string, unknown> | undefined)?.["summary"] as Record<string, unknown> | undefined)?.["output"];
  return output !== null && typeof output === "object" && (output as Record<string, unknown>)["visit"] === true;
}

/**
 * A VISIT'S BODY ANSWERS ITS CALLER ONCE, through the target's actor (`VisitTicket.deliver`). Every later retrieval (a receipt, a
 * re-ask under the same id, a session receipt, the floor's readbacks) reads the outcome through here, which keeps the status and
 * withholds the body: the visited face's records never answer a read its actor did not deliver.
 */
export function withheldVisit<O extends Record<string, unknown>>(outcome: O): O {
  if (!isVisitOutcome(outcome)) return outcome;
  const { results: _body, ...rest } = outcome;
  return { ...rest, results: { summary: { ok: true, output: { visit: { withheld: true } } } }, visit: { withheld: true } } as unknown as O;
}

/**
 * The vessel's OWN wait for an outcome ended — never a verdict on whether the act ran (M2). The act
 * already dispatched (past the causal EOF check) by the time this fires; it may still be running, or
 * its outcome may already be sitting in the durable doc unread by this particular wait. Told back
 * over the wire as `{status:"unknown", requestId}`, NEVER `{status:"error"}` — an "error" told a CLI
 * caller the act failed when it may have succeeded.
 */
export class VesselWaitExpired extends Error {
  constructor(verb: string, readonly requestId: string, budgetMs: number) {
    super(`verb "${verb}" — this vessel's own wait ended after ${budgetMs}ms (adaptive); outcome unknown. Check request ${requestId}.`);
  }
}

/** A chore mark read off an outcome's `chore` field (its JSON), or null where absent or malformed. */
export function choreMarkField(raw: unknown): ChoreReceiptMark | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try { return choreReceiptMarkOf(JSON.parse(raw)); } catch { return null; }
}

/** The invocation's own content — what an honest reused id must match to re-read instead of re-run. The worker's own
 *  formula ({@link verbInputDigest}, mesh), so a reuse compares against EXACTLY the digest the dispatcher stamps onto
 *  the outcome, never a second, locally invented hash that could drift from it. */
export function inputDigestOf(inv: Pick<Invocation, "verb" | "args" | "face" | "effectKey">): Promise<string> {
  return verbInputDigest({
    verb: inv.verb, args: inv.args ?? {}, face: inv.face,
    ...(inv.effectKey !== undefined && { effectKey: inv.effectKey }),
  });
}

/**
 * One outcome record as the door tells it. A record that carries `results` answers whole. A verdict alone answers its
 * status, refusal and error, and names what became of the body: a visit's stays withheld, and any other reads
 * `body: { released, sha256, bytes, cure }`, with no `touched`, so the seat reads its rest untracked (owed), never ok.
 */
export function toldOutcome(fields: Readonly<Record<string, unknown>>, requestId: string): Record<string, unknown> {
  let results: unknown;
  const whole = typeof fields["results"] === "string";
  if (whole && (fields["results"] as string).length > 0) {
    try { results = JSON.parse(fields["results"] as string); } catch { /* malformed — leave */ }
  }
  return {
    status: fields["status"], requestId,
    ...(results !== undefined ? { results } : {}),
    ...(!whole ? (fields["visit"] === "true" ? { visit: { withheld: true as const } } : { body: releasedBodyOf(fields) }) : {}),
    ...(fields["error-message"] !== undefined ? { errorMessage: fields["error-message"] } : {}),
    // A terminal outcome's own machine-readable reason (`concludeVerb({refusal})`), told back in the SAME additive shape
    // the socket's own direct refusals use, never as a second, differently-shaped field.
    ...(typeof fields["refusal"] === "string" ? { refusal: { reason: fields["refusal"] } } : {}),
    // T4-5: the chore's receipt mark rests in the outcome; a malformed one reads as none.
    ...(() => { const mark = choreMarkField(fields["chore"]); return mark ? { chore: mark } : {}; })(),
    // The effect index's copy (`concludeVerb({effectOf})`) names the PRIOR requestId whose effect this outcome answers,
    // so every reader can tell a dedup answer from a verb this attempt actually ran.
    ...(typeof fields["effect-of"] === "string" ? { effectOf: fields["effect-of"] } : {}),
    // THE CALL'S OWN CHANGES on the island (`call-touches`): the seat reads them for the owed band and strips them.
    ...(typeof fields["touched"] === "string" ? { touched: fields["touched"] } : {}),
  };
}

/** What a reused id that carries another input hears: nothing ran under this ask, and the cure reads a fresh id. */
export function reusedWithChangedInput(requestId: string): string {
  return `request ${requestId} was already used with different arguments — mint a fresh request id`;
}

/** The spellings a `call` names the watch by: its verb word, its address in either spelling. */
const HELD_CALL_WORDS: ReadonlySet<string> = new Set(["watch", "lar:///engine.filter.watches", "engine.filter.watches", "lar:///ha.ka.ba/lares/afford/engine.filter.watches"]);

/**
 * TRUE FOR AN ASK THAT HOLDS (a watch, a waiting events read), whose caller leaving withdraws it. A `call` holds where it names
 * the watch (its word, its address, or a sigil that leads with `watch`); `events` holds where it asks `wait`. Every other ask
 * (every write) answers false, so a hang-up never aborts its signal.
 */
export function heldAsk(verb: string, args: Readonly<Record<string, unknown>> | undefined): boolean {
  const a = args ?? {};
  if (verb === "filter-watch") return true;
  if (verb === "events") return a["wait"] === true;
  if (verb !== "call") return false;
  const word = typeof a["verb"] === "string" ? a["verb"].trim() : "";
  if (HELD_CALL_WORDS.has(word)) return true;
  const sigil = typeof a["sigil"] === "string" ? a["sigil"] : word.startsWith("<<") ? word : "";
  return /^<<~?\s*watch(?:\s|>)/.test(sigil.trim());
}
