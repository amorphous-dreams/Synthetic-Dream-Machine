/**
 * THE DOOR'S OUTCOME READS: where an answer stands and how a wait hears it land.
 *
 * Two places hold what a verb concluded. The vessel's ANSWER RING (`control-home` `answerRingOf`) holds the whole outcome
 * in memory alone; the island hands each across as it concludes. The control document holds the VERDICT ROW a write leaves
 * (`verb-tiddler` `verdictRowOf`): status, digest, refusal and the measure of the body, never the body. A read leaves no
 * row. Every read here takes the ring first and the row second, so a body answers while the ring holds it and its verdict
 * answers after it left.
 * Heleuma ha: see lararium/mesh/uds-channel-outcome-reads.
 */

import type { DocHandle } from "@automerge/automerge-repo";
import type { LarDoc } from "@lararium/mesh/base-doc";
import type { CompositeStore } from "@lararium/mesh/composite-store";
import type { AnswerRing } from "@lararium/mesh/control-home";
import { OUTCOME_URI_PREFIX } from "@lararium/mesh/verb-tiddler";
// The adaptive-timeout SERVO (fail on a GRADIENT, never a cliff): a per-verb wait that GROWS with the observed durations
// and clamps FLOOR..CEIL, so a long-but-honest verb is never false-killed the way a fixed cliff killed them.
import { adaptiveTimeoutMs, recordMineDuration, verbBudgetMs } from "@lararium/mempalace";
import { VesselWaitExpired, toldOutcome, withheldVisit } from "./outcome.js";

export interface OutcomeReads {
  /** The whole answer the ring holds for `requestId`, or null once it left. */
  heldFieldsOf(requestId: string): Record<string, unknown> | null;
  /** The verdict row the control document rests for `requestId`, or null (a read, or an id no write named). */
  rowFieldsOf(requestId: string): Promise<Record<string, unknown> | null>;
  /** The ring, then the row, as the door tells it; null where neither stands. */
  readOutcomeFor(requestId: string): Promise<Record<string, unknown> | null>;
  /** An outcome read back on any road but the live answer: a visit's body withheld (`withheldVisit`). */
  retrievedOutcome(requestId: string): Promise<Record<string, unknown> | null>;
  /** Mark an id this seat dispatches: its whole answer still rides toward the ring, so a wait holds for it. */
  owe(requestId: string): void;
  /**
   * Await the outcome for `requestId` — NEVER places a verb. `needsRow` names a write: its answer leaves only once its
   * verdict row stands too, so the answer never outruns the verdict a receipt reads. Rejects {@link VesselWaitExpired}
   * when this side's own budget ends.
   */
  awaitOutcome(verb: string, requestId: string, askedTimeoutMs?: number, needsRow?: boolean): Promise<Record<string, unknown>>;
  /** The verb behind `requestId` SETTLED (its answer or its row stands). No timer: the face's close waits on the verb. */
  outcomeLanded(requestId: string): Promise<void>;
  /** Hear each answer the ring takes. Answers the unsubscribe. */
  onAnswer(fn: (requestId: string) => void): () => void;
  /** Stop hearing the ring. */
  close(): void;
}

export function makeOutcomeReads(a: {
  readonly composite: CompositeStore;
  readonly controlHandle: DocHandle<LarDoc>;
  readonly ring: AnswerRing;
  /** The floor of every wait (`verbBudgetMs`). */
  readonly timeoutMs: number;
}): OutcomeReads {
  const { composite, controlHandle, ring, timeoutMs } = a;
  const rowFieldsOf = async (requestId: string): Promise<Record<string, unknown> | null> => {
    const event = await composite.get(`${OUTCOME_URI_PREFIX}${requestId}`);
    if (!event || event.meta?.deleted) return null;
    const fields = event.tiddler as Record<string, unknown>;
    return fields["status"] === "done" || fields["status"] === "error" ? fields : null;
  };
  const heldFieldsOf = (requestId: string): Record<string, unknown> | null => {
    const fields = ring.get(requestId)?.tiddler as Record<string, unknown> | undefined;
    return fields && (fields["status"] === "done" || fields["status"] === "error") ? fields : null;
  };
  const readOutcomeFor = async (requestId: string): Promise<Record<string, unknown> | null> => {
    const held = heldFieldsOf(requestId);
    if (held) return toldOutcome(held, requestId);
    const row = await rowFieldsOf(requestId);
    return row ? toldOutcome(row, requestId) : null;
  };
  /**
   * THE IDS THIS SEAT DISPATCHED WHOSE WHOLE ANSWER STILL RIDES TOWARD THE RING. The island lands the verdict row first
   * and the answer after it, so a wait that met the row alone would tell a released body a beat before the body came.
   * A wait on such an id therefore holds for the ring. An id leaves the set when its answer stands, or when a wait on it
   * ran its whole budget beside a standing row (the answer went missing with the island that owed it): from then on its
   * row answers, body released.
   */
  const answerOwed = new Set<string>();
  const unsubAnswers = ring.subscribe((requestId) => { answerOwed.delete(requestId); });
  const settledOutcomeFor = async (requestId: string, needsRow: boolean): Promise<Record<string, unknown> | null> => {
    const held = heldFieldsOf(requestId);
    if (held) return !needsRow || await rowFieldsOf(requestId) !== null ? toldOutcome(held, requestId) : null;
    const row = await rowFieldsOf(requestId);
    if (row === null) return null;
    // THE RING MAY HAVE TAKEN THE ANSWER DURING THE ROW'S READ (its put clears the owed mark): the whole answer wins.
    const landed = heldFieldsOf(requestId);
    if (landed) return toldOutcome(landed, requestId);
    // A row that rests a whole record answers by itself; a verdict whose answer still rides toward the ring waits for it.
    if (typeof row["results"] !== "string" && answerOwed.has(requestId)) return null;
    answerOwed.delete(requestId);
    return toldOutcome(row, requestId);
  };
  /** Hear a change that may land `requestId`: the control store's row, the document beneath it, and the ring. */
  const hear = (requestId: string, check: () => void): (() => void) => {
    const onChange = (): void => check();
    const unsubscribeStore = composite.subscribe((change) => { if (change.title === `${OUTCOME_URI_PREFIX}${requestId}`) check(); });
    const unsubscribeRing = ring.subscribe((answered) => { if (answered === requestId) check(); });
    controlHandle.on("change", onChange);
    return () => { controlHandle.off("change", onChange); unsubscribeStore(); unsubscribeRing(); };
  };
  const awaitOutcome = (verb: string, requestId: string, askedTimeoutMs?: number, needsRow = false): Promise<Record<string, unknown>> =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      let settled = false;
      // MONOTONIC, NEVER Date.now(): the servo's elapsed reading must never move with a wall clock.
      const t0 = performance.now();
      const settle = (fn: () => void): void => { if (!settled) { settled = true; cleanup(); fn(); } };
      // Only a COMPLETION teaches the servo (a timeout never records, so it cannot drag the EWMA to CEIL).
      const check = (): void => {
        void settledOutcomeFor(requestId, needsRow).then((r) => {
          if (r) settle(() => { recordMineDuration(verb, performance.now() - t0); resolve(r); });
        }, () => { /* a read that faults answers nothing; the next change reads again */ });
      };
      const unhear = hear(requestId, check);
      // THIS TIMER IS THIS SIDE'S OWN LIVENESS, NEVER A VERDICT ON THE ACT (M2): a verb still running when this wait ends
      // keeps running, and its outcome lands for a later read. The caller's ask raises it within the servo's bound.
      const budget = verbBudgetMs({
        ...(typeof askedTimeoutMs === "number" ? { asked: askedTimeoutMs } : {}),
        adaptive: adaptiveTimeoutMs(verb),
        floor: timeoutMs,
      });
      const timer = setTimeout(() => settle(() => {
        // A VERDICT THAT STOOD THROUGH THIS WHOLE WAIT WITH NO ANSWER BESIDE IT lost its answer: later waits read the row.
        if (answerOwed.has(requestId)) void rowFieldsOf(requestId).then((row) => { if (row !== null) answerOwed.delete(requestId); }, () => { /* unread: the id stays owed */ });
        reject(new VesselWaitExpired(verb, requestId, budget));
      }), budget);
      const cleanup = (): void => { unhear(); clearTimeout(timer); };
      check(); // the outcome may already stand (a same-id re-ask)
    });
  const outcomeLanded = (requestId: string): Promise<void> => new Promise<void>((resolve) => {
    let landed = false;
    const check = (): void => {
      void readOutcomeFor(requestId).then((r) => { if (r && !landed) { landed = true; unhear(); resolve(); } }, () => {});
    };
    const unhear = hear(requestId, check);
    check();
  });
  return {
    heldFieldsOf,
    rowFieldsOf,
    readOutcomeFor,
    retrievedOutcome: async (requestId) => {
      const outcome = await readOutcomeFor(requestId);
      return outcome === null ? null : withheldVisit(outcome);
    },
    owe: (requestId) => { answerOwed.add(requestId); },
    awaitOutcome,
    outcomeLanded,
    onAnswer: (fn) => ring.subscribe((requestId) => fn(requestId)),
    close: () => { unsubAnswers(); },
  };
}
