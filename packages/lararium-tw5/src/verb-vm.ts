/**
 * verb-vm — volatile verb invocation lifecycle for the daemon causal island.
 *
 * Manages the in-TW5-wiki invocation tiddlers (volatile scratch, never synced)
 * and writes each outcome two ways: a VERDICT ROW into the vessel's CONTROL document (`control-home`: a store no recipe
 * composes and no mirror names, sealed under the lit face like the daemon wiki's slots,
 * lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed, U1), and the WHOLE ANSWER into the vessel's answer ring
 * (`answerRingOf`), memory alone. No outcome body rests anywhere, and a read with no effect key leaves no row at all.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/verb-vm
 */

import { inCallScope, ridesAnswerRing, takeCallTouches, type CallTouches } from "@lararium/mesh/call-touches";
import type { BatchMode, Verb, VerbTargetResult } from "@lararium/mesh/verb-tiddler";
import type { ChoreReceiptMark } from "@lararium/mesh/chore-ask";
import type { CompositeStore } from "@lararium/mesh/composite-store";
import {
  EFFECT_URI_PREFIX,
  VERB_RESULT_KEY,
  concludeVerb,
  buildVerb,
  buildRunningPatch,
  verbInputDigest,
  verdictRowOf,
} from "@lararium/mesh/verb-tiddler";
import { canonicalJsonBytes, sha256HexBytesSync } from "@lararium/mesh/crypto";
import { isVerbRefusal } from "@lararium/mesh/verb-refusal";
import { ControlHomeUnavailable, answerRingOf } from "@lararium/mesh/control-home";
import type { TW5Engine } from "./tw5-vm.js";

// ── Effect index — single writer: the daemon worker (D1, P2.5 iter 4) ──────
// `<control home>/effects/<effectKey>` (`EFFECT_URI_PREFIX`) names the ONE prior `done` attempt that produced
// this effect, so a later attempt under a NEW requestId with the SAME effectKey can
// find it (verb-dispatcher.ts owns the reuse decision; this module owns the write).
export { EFFECT_URI_PREFIX };

// ── The answer's own bound (the dd4da8481 class) ────────────────────────────────────────────────────
//
// A verb's whole answer embeds the handler's FULL return value under `results[summary].output`. For a batch verb (e.g.
// INGEST) that means a per-carrier result array, unbounded across a corpus seed (214 entries measured for one lararium
// ingest). The control document rests none of it (the verdict row carries a hash and a byte count), yet the answer
// still crosses the island's message, rides the socket and waits in the answer ring's bounded memory.
//
// So any top-level array field in the answer's `output` that crosses AUDIT_ARRAY_CAP entries gives way to a BOUNDED
// summary: a count, a per-"decision" tally, a content-hash of the full array (so a full-detail re-derivation stays
// possible and verifiable), and a small sample. Below the cap the array rides FAITHFULLY, and a caller reads exact
// per-carrier detail.
//
// A ROW A PERSON MUST ACT ON STAYS NAMED. A summary that counted refusals and named none would leave a
// refused carrier unfindable, and a refusal nobody can find stays unfixable. So the summary HOLDS every
// row whose decision applied nothing and asks for a hand (`refuse`, `conflict`), whole, up to the cap,
// and states how many more such rows it leaves unnamed (`heldMore`). Zero says the summary names every
// one. A caller that reads `heldMore` above zero asks again in waves under the cap, where every row
// rides whole (the ingest gesture pages so: `lares-cli/src/ingest-core.ts` `settleIngest`).

/** Past this many entries a top-level array of an outcome's output rides as a bounded summary. */
export const AUDIT_ARRAY_CAP = 32;

/** The decisions that apply nothing and ask a person to act: each such row stays named in a summary. */
const HELD_DECISIONS: ReadonlySet<string> = new Set(["refuse", "conflict"]);

/** The bounded stand-in for an oversized array field — a summary, not the body. */
export interface BoundedArraySummary {
  readonly boundedArrayCount: number;
  /** Rows per `decision`, over the rows that carry one. An array whose rows carry none (titles, plain
   *  strings) tallies nothing, so the tally never invents a decision nobody made. */
  readonly tallies: Readonly<Record<string, number>>;
  readonly sha256: string;
  readonly sample: readonly unknown[];
  /** Every row whose decision reads `refuse` or `conflict`, whole, in wave order, up to the cap. */
  readonly held: readonly unknown[];
  /** How many `refuse` and `conflict` rows `held` leaves unnamed; zero says it names every one. */
  readonly heldMore: number;
}

function decisionOf(item: unknown): string | null {
  const raw = item !== null && typeof item === "object" ? (item as Record<string, unknown>)["decision"] : undefined;
  return typeof raw === "string" ? raw : null;
}

function tallyByDecision(items: readonly unknown[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = decisionOf(item);
    if (k !== null) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function boundArray(items: readonly unknown[], cap: number): BoundedArraySummary {
  const asks = items.filter((item) => HELD_DECISIONS.has(decisionOf(item) ?? ""));
  return {
    boundedArrayCount: items.length,
    tallies: tallyByDecision(items),
    sha256:  sha256HexBytesSync(canonicalJsonBytes(items)),
    sample:  items.slice(0, 3),
    held:    asks.slice(0, cap),
    heldMore: Math.max(0, asks.length - cap),
  };
}

/**
 * Cap any top-level array field of `result` past `AUDIT_ARRAY_CAP` entries — the durable-outcome
 * shape the write-amplification cure applies to. Exported for the CLI's read-path (and tests) to
 * recognize a bounded field via `boundedArrayCount`, distinct from a genuine small array.
 */
export function boundOutcomeOutput(
  result: Record<string, unknown>, cap: number = AUDIT_ARRAY_CAP,
): Record<string, unknown> {
  const bounded: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(result)) {
    bounded[key] = Array.isArray(value) && value.length > cap ? boundArray(value, cap) : value;
  }
  return bounded;
}

export interface VerbPlacement {
  readonly verb:        string;
  readonly args:        Record<string, unknown>;
  readonly requestedBy: string;
  /** The verified face's proof subject: it enters the input digest and attributes the outcome. The seat supplies the
   *  presenter in `requestedBy`, which the capability gate reads and the digest leaves out. */
  readonly face?:       string;
  readonly targets?:    string[];
  readonly batchMode?:  BatchMode;
  readonly requestId?:  string;
  readonly fromUri?:    string;
  readonly listenable?: string;
  /** The effect this attempt would produce (D1, P2.5 iter 4) — see `Verb.effectKey`. */
  readonly effectKey?:  string;
}

export function placeVerb(tw5: TW5Engine, opts: VerbPlacement): string {
  const fields = buildVerb(opts);
  const Tiddler = tw5.$tw.Tiddler;
  tw5.$tw.wiki.addTiddler(new Tiddler(fields));
  return fields["request-id"] as string;
}

export function patchVerb(tw5: TW5Engine, title: string, patch: Record<string, string>): void {
  const wiki = tw5.$tw.wiki;
  const existing = wiki.getTiddler(title) as { fields: Record<string, unknown> } | undefined;
  if (!existing) return;
  const Tiddler = tw5.$tw.Tiddler;
  wiki.addTiddler(new Tiddler({ ...existing.fields, ...patch }));
}

export function removeVerb(tw5: TW5Engine, title: string): void {
  tw5.$tw.wiki.deleteTiddler(title);
}

/**
 * A VISIT'S ANSWER (a read of another lit face, `crossFaceReactor`): its output carries `visit: true`. A visit never replays: its
 * outcome indexes no effect, and no effect copy answers from one, so every visit admits on its target's face actor anew and runs
 * its reactor afresh (Sol 407c H2).
 */
export function isVisitResults(results: unknown): boolean {
  const output = ((results as Record<string, unknown> | null | undefined)?.[VERB_RESULT_KEY] as Record<string, unknown> | undefined)?.["output"];
  return output !== null && typeof output === "object" && (output as Record<string, unknown>)["visit"] === true;
}

/** True where a change report names at least one document. */
function reportsChange(touched: CallTouches | undefined): boolean {
  return touched !== undefined && Object.keys(touched).length > 0;
}

/**
 * CONCLUDE ONE VERB: the verdict row rests, the whole answer rides the ring.
 *
 * The whole outcome (`concludeVerb`: results, the change report, the cause) goes to the vessel's answer ring, memory
 * alone, for the caller that waits. The control document takes the VERDICT ROW (`verdictRowOf`): no `results`, no
 * `touched`, no `cause`; a hash and a byte count stand for the body. The row lands first, then the effect index, then
 * the answer, so a caller that hears the answer finds its verdict already standing.
 *
 * A READ LEAVES NO ROW (`ridesAnswerRing`: a READ verb asked with no effect key): its answer rides the ring and nothing
 * rests. EVIDENCE BACKS THE DECLARATION: a read whose change report names a document wrote something after all, so its
 * verdict row lands after the fact and the island says `read-verb-wrote` by the verb's name.
 */
export async function writeOutcome(
  control: CompositeStore,
  opts: {
    invocation:    Verb;
    status:        "done" | "error";
    result?:       Record<string, unknown>;
    errorMessage?: string;
    /** Machine-readable refusal reason (e.g. "beyond-profile") — additive alongside
     *  `errorMessage`; see `concludeVerb`. */
    refusal?:      string;
    /** The chore's receipt mark the island booked with this ask; it rests in the outcome beside the result. */
    chore?:        ChoreReceiptMark;
    /** What the handler changed (`call-touches`), tagged at each change. */
    touched?:      CallTouches;
  },
): Promise<void> {
  const origin = { kind: "lares-verb" as const, requestId: opts.invocation.requestId };
  // Digest-on-outcome (D1): stamp the request's input digest onto the outcome so a later
  // reader (the effect-dedup check, the channel's own arbitration) can re-check reuse
  // without re-walking the originating fact.
  const inputDigest = await verbInputDigest({
    verb:        opts.invocation.action,
    args:        opts.invocation.args,
    ...(opts.invocation.face !== undefined && { face: opts.invocation.face }),
    ...(opts.invocation.effectKey !== undefined && { effectKey: opts.invocation.effectKey }),
  });
  const answer = concludeVerb({
    requestId:   opts.invocation.requestId,
    ...(opts.invocation.face !== undefined && { face: opts.invocation.face }),
    verb:        opts.invocation.action,
    status:      opts.status,
    cause:       opts.invocation.title,
    batchMode:   opts.invocation.batchMode,
    results: {
      [VERB_RESULT_KEY]: {
        ok: opts.status === "done",
        ...(opts.result       !== undefined && { output: boundOutcomeOutput(opts.result) }),
        ...(opts.errorMessage !== undefined && { error:  opts.errorMessage }),
      },
    },
    ...(opts.errorMessage !== undefined && { errorMessage: opts.errorMessage }),
    ...(opts.refusal      !== undefined && { refusal:      opts.refusal }),
    ...(opts.chore        !== undefined && { chore:        opts.chore }),
    ...(opts.touched      !== undefined && { touched:      opts.touched }),
    inputDigest,
    ...(opts.invocation.effectKey !== undefined && { effectKey: opts.invocation.effectKey }),
  });
  const row = verdictRowOf(answer);
  const read = ridesAnswerRing(opts.invocation.action, opts.invocation.effectKey);
  const wrote = read && reportsChange(opts.touched);
  if (wrote) console.warn(`[verb-vm] read-verb-wrote: "${opts.invocation.action}" (request ${opts.invocation.requestId}) stands in the read set and its call changed ${Object.keys(opts.touched!).length} document(s); its verdict row lands after the fact. Take "${opts.invocation.action}" out of READ_VERBS (mesh call-touches) or end the write in its handler.`);
  // THE LEDGER RESTS IN THE CONTROL DOCUMENT: the control store's one layer, never a layer any mirror reads. It rests the
  // verdict alone, and a read that changed nothing rests none.
  if (!read || wrote) await control.put(row, origin);

  // Effect index — single writer (the daemon worker). Only a `done` outcome with an
  // effect key indexes; an `error` outcome indexes nothing, so a failed effect may be
  // retried under a fresh requestId without the dedup path ever shadowing it.
  // THE ROW ANSWERS A DEDUP BY ITSELF: it names the digest its attempt carried and the measure of the body it left, so a
  // later attempt under the same effect key decides against this row alone and joins no outcome row.
  if (opts.status === "done" && opts.invocation.effectKey !== undefined && opts.result?.["visit"] !== true) {
    const measure = row.tiddler as Record<string, unknown>;
    await control.put({
      tiddler: {
        title:          `${EFFECT_URI_PREFIX}${opts.invocation.effectKey}`,
        "effect-key":   opts.invocation.effectKey,
        ...(opts.invocation.face !== undefined && { face: opts.invocation.face }),
        "request-id":   opts.invocation.requestId,
        "input-digest": inputDigest,
        ...(typeof measure["result-sha256"] === "string" && { "result-sha256": measure["result-sha256"] }),
        ...(typeof measure["result-bytes"] === "string" && { "result-bytes": measure["result-bytes"] }),
      },
      meta: { authority: "lares-dispatcher" },
    }, origin);
  }

  // THE WHOLE ANSWER, LAST: it waits in memory for its caller and rests nowhere.
  answerRingOf(control).put(answer);
}

/**
 * Effect-dedup shortcut (D1, P2.5 iter 4): conclude THIS invocation as a COPY of a prior `done` attempt
 * (`effect-of: priorRequestId`) instead of invoking the handler, then tombstone the volatile invocation exactly as
 * `dispatchVerb` does on a real run. The caller (verb-dispatcher.ts) is the one that decided the digests match; this
 * function only performs the write + cleanup, mirroring `dispatchVerb`'s own lifecycle so the two paths read alike.
 *
 * `priorResults` carries the prior attempt's body where this island's answer ring still holds it: the copy's answer
 * then rides whole. Where the body already left (`priorResults` null), the copy answers `effect-of` beside the measure
 * the effect row kept (`resultSha256`, `resultBytes`), and its caller reads a released body. Either way the verdict row
 * rests no body.
 */
export async function copyEffectOutcome(
  tw5: TW5Engine,
  control: CompositeStore,
  invocation: Verb,
  opts: {
    priorRequestId: string;
    priorResults: Record<string, VerbTargetResult> | null;
    inputDigest: string;
    chore?: ChoreReceiptMark;
    resultSha256?: string;
    resultBytes?: string;
  },
): Promise<void> {
  const origin = { kind: "lares-verb" as const, requestId: invocation.requestId };
  const whole = concludeVerb({
    requestId:   invocation.requestId,
    ...(invocation.face !== undefined && { face: invocation.face }),
    verb:        invocation.action,
    status:      "done",
    cause:       invocation.title,
    batchMode:   invocation.batchMode,
    ...(opts.priorResults !== null && { results: opts.priorResults }),
    inputDigest: opts.inputDigest,
    ...(invocation.effectKey !== undefined && { effectKey: invocation.effectKey }),
    effectOf:    opts.priorRequestId,
    // A COPY RAN NOTHING: it reports an empty tally, tracked.
    touched:     {},
    ...(opts.chore !== undefined && { chore: opts.chore }),
  });
  // A copy whose body left carries no `results` at all, and names the measure the effect row kept in its place.
  const { results: _empty, ...bare } = whole.tiddler as Record<string, unknown>;
  const answer = opts.priorResults !== null ? whole : {
    ...whole,
    tiddler: {
      ...bare,
      ...(opts.resultSha256 !== undefined && { "result-sha256": opts.resultSha256 }),
      ...(opts.resultBytes !== undefined && { "result-bytes": opts.resultBytes }),
    } as typeof whole.tiddler,
  };
  await control.put(verdictRowOf(answer), origin);
  answerRingOf(control).put(answer);
  removeVerb(tw5, invocation.title);
}

/**
 * Render any thrown value to a readable message. A non-Error throw (a plain object,
 * e.g. a `{ok:false,reason}` verify result) yields its message/reason/error field,
 * else a compact JSON — never the bare "[object Object]" cast.
 */
function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    for (const k of ["message", "reason", "error"]) {
      if (typeof o[k] === "string" && o[k]) return o[k] as string;
    }
    try { return JSON.stringify(err); } catch { /* circular — fall through */ }
  }
  return String(err);
}

export async function dispatchVerb(
  tw5: TW5Engine,
  control: CompositeStore,
  invocation: Verb,
  run: () => Promise<Record<string, unknown>>,
  chore?: ChoreReceiptMark,
): Promise<void> {
  patchVerb(tw5, invocation.title, buildRunningPatch());
  const mark = chore !== undefined ? { chore } : {};

  // THE CALL'S OWN CHANGES TAG AT THE CHANGE (`call-touches`): the handler runs inside its call's scope, and the outcome
  // names the documents it changed, so the seat owes this call's writes alone (sealed-store#/owed).
  // ALWAYS A REPORT, EVEN EMPTY: the seat reads an outcome with no `touched` as untracked (owed), never as sealed.
  const touchedOf = (): { touched: CallTouches } => ({ touched: takeCallTouches(invocation.requestId) ?? {} });
  try {
    const result = await inCallScope(invocation.requestId, run);
    await writeOutcome(control, { invocation, status: "done", result, ...mark, ...touchedOf() });
  } catch (err) {
    await writeOutcome(control, {
      invocation, status: "error", errorMessage: errorText(err), ...mark, ...touchedOf(),
      // A reactor that refuses by name hands its machine-read reason to the outcome; a plain
      // failure carries none. An act that wrote a control fact on a place with no readable control
      // document refuses by that document's name (`control-home-unnamed`, `vessel-locked`).
      ...(isVerbRefusal(err) && { refusal: err.reason }),
      ...(err instanceof ControlHomeUnavailable && { refusal: err.refusal }),
    });
  }

  removeVerb(tw5, invocation.title);
}
