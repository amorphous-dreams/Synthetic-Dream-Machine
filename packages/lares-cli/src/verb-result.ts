/**
 * verb-result — the transport-neutral vocabulary of a verb invocation.
 *
 * A verb-summons and its outcome belong to no transport. The CLI speaks one — the
 * daemon's sock — and a command reads an outcome here without reaching for the
 * invoker at all.
 *
 * See lar:///ha.ka.ba/lararium/api/lares-lararium-binding — transport, authority,
 * and record decouple; this module holds the record's surface.
 */

import { VERB_RESULT_KEY } from "@lararium/mesh";

export interface SubmitOptions {
  /** Total timeout in ms (default 10000). */
  readonly timeoutMs?: number;
  /**
   * Content-addressed request id (V1). For an idempotent/declarative verb the
   * caller passes `taskContentId({subject, command, args, nonce:""})` so a
   * re-issued identical change collapses to the same id — the dispatcher's
   * outcome-keyed dedup then gives exactly-once EFFECT. Omit → fresh `newRequestId()`.
   */
  readonly requestId?: string;
  /**
   * The effect this attempt would produce (D1, P2.5 iter 4 commit 4) — a CONTENT-ADDRESSED
   * key, distinct from `requestId`. A caller that mints a FRESH `requestId` per attempt (so a
   * retry after an abandoned/unknown outcome can actually run, never reusing an id the vessel
   * already settled) still passes the SAME `effectKey` across those attempts, so the daemon's
   * own effect index answers a repeat with the prior `done` outcome instead of running it
   * twice. Rides the wire as an additive field (`local-connector.ts`); absent means no dedup
   * beyond the ordinary requestId-keyed arbitration.
   */
  readonly effectKey?: string;
}

export interface SubmitTargetResult {
  readonly ok:      boolean;
  readonly output?: Record<string, unknown>;
  readonly error?:  string;
}

export interface SubmitResult {
  readonly status:       "done" | "error";
  readonly results?:     Record<string, SubmitTargetResult>;
  readonly errorMessage?: string;
  readonly requestId:    string;
  /**
   * The channel's own ADDITIVE refusal reason (D1, M3″) — present only when `status` reads
   * "error" AND the refusal came from the ledger's own arbitration (abandoned, a changed-input
   * reuse, a retention-gap eviction), never from the verb's own handler faulting. An older CLI
   * build that never reads this field still reads the unchanged `errorMessage` prose; this is
   * the machine-readable twin `verb-call.ts`'s `refusalCode` keys exit codes from.
   */
  readonly refusal?: { readonly reason: string };
  /**
   * The PRIOR request id this answer's effect was actually decided under (G1/G2, H7) — present
   * only when the daemon's own effect index answered a repeat attempt with an earlier `done`
   * outcome rather than running the verb again (`uds-channel.ts`'s `readOutcomeFor` /
   * the awaited-outcome answer carry it as `effect-of` on the wire). Absent means this attempt
   * ran for real. Additive: an older daemon build that never sends it reads exactly as before.
   */
  readonly effectOf?: string;
}

export function summaryOutput(result: SubmitResult): Record<string, unknown> | undefined {
  return result.results?.[VERB_RESULT_KEY]?.output;
}

/** A verb's outcome, read whole: whether it ran, what it landed, and why it refused. */
export interface VerbOutcome {
  readonly ok:     boolean;
  readonly output: Record<string, unknown>;
  readonly error:  string | null;
}

/**
 * Read an outcome without losing its verdict.
 *
 * THE STATUS IS PART OF THE PAYLOAD. Reaching straight for `results` skips it, and a refused
 * invocation carries no payload — so the reader falls to an empty object and renders success over a
 * verb that never ran. A pass that landed nothing because everything was already landed and a pass
 * the daemon cut short then print identically, and only one of them leaves work owed.
 */
export function readVerbOutcome(result: SubmitResult): VerbOutcome {
  if (result.status === "error") {
    return { ok: false, output: {}, error: result.errorMessage ?? "the daemon refused and named no reason" };
  }
  return { ok: true, output: summaryOutput(result) ?? {}, error: null };
}
