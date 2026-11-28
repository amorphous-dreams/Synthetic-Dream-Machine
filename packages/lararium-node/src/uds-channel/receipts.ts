/**
 * THE DOOR'S RECEIPTS: what a receipt read, a cancel and a session receipt answer for a request id. A READ, never a
 * dispatch, and no write: the answer comes from what the vessel holds for the id in this life (the answer ring, a write's
 * verdict row, the ask book), and an id none of them names answers `unknown`, the honest "no idea".
 * Heleuma ha: see lararium/mesh/uds-channel-receipts.
 */

import type { ChoreReceiptMark } from "@lararium/mesh/chore-ask";
import { faceScopedId } from "@lararium/mesh/face-scoped-id";
import type { SessionReceipt } from "@lararium/mesh/session-receipt";
import type { DurabilityReceipt } from "@lararium/mesh/durability-receipt";
import { engineFallBody, engineTerminatedRefusal, type EngineFall } from "../engine-watch.js";
import type { AskBook } from "./ask-book.js";
import type { OutcomeReads } from "./outcome-reads.js";
import { toldOutcome, withheldVisit } from "./outcome.js";
import type { ReceiptAnswer } from "./shapes.js";

export interface DoorReceipts {
  /** A `{op:"receipt"}` read: the outcome where one stands (even under an abandonment: a record that landed says the act
   *  ran, on whatever road), else what the book holds, else `unknown`. */
  answerReceipt(requestId: string): Promise<ReceiptAnswer>;
  /**
   * A receipt AFTER THE ENGINE FELL reads memory alone (the ring and the book): no store read reaches the dead engine. An
   * id memory never held refuses `engine-terminated`: the dead engine cannot say whether it ran, and `unknown` would
   * invite a re-run.
   */
  settledReceipt(requestId: string, fall: EngineFall): ReceiptAnswer;
  /** A `session:receipt` (or the receipt a `session:cancel` and an act's retry answer): the face-scoped id's reading. */
  sessionReceipt(requestId: string, face: string): Promise<SessionReceipt>;
}

export function makeDoorReceipts(a: {
  readonly reads: OutcomeReads;
  readonly book: AskBook;
  /** The vessel life that answers (`StoreClaim.life`). */
  readonly ownerEpoch: string;
  /** A durability receipt over the control document's heads, flushed first. */
  readonly settleDurably: () => Promise<DurabilityReceipt>;
  readonly log: (line: string) => void;
}): DoorReceipts {
  const { reads, book, ownerEpoch } = a;
  const fromOutcome = (requestId: string, outcome: Record<string, unknown>): ReceiptAnswer => ({
    requestId, state: outcome["status"] as "done" | "error",
    ...(outcome["visit"] !== undefined ? { visit: { withheld: true as const } } : {}),
    ...(outcome["results"] !== undefined ? { results: outcome["results"] as Record<string, unknown> } : {}),
    ...(outcome["body"] !== undefined ? { body: outcome["body"] as NonNullable<ReceiptAnswer["body"]> } : {}),
    ...(outcome["errorMessage"] !== undefined ? { errorMessage: outcome["errorMessage"] as string } : {}),
    ...(outcome["refusal"] !== undefined ? { refusal: outcome["refusal"] as { reason: string } } : {}),
    ...(outcome["chore"] !== undefined ? { chore: outcome["chore"] as ChoreReceiptMark } : {}),
  });
  /** What the book alone says: a running ask reads `committed`; a landed ask whose answer stands nowhere reads `unknown`. */
  const fromBook = (requestId: string): ReceiptAnswer => {
    const entry = book.get(requestId);
    const state = entry === undefined || entry.state === "landed" ? "unknown" : entry.state === "running" ? "committed" : entry.state;
    return { requestId, state };
  };
  return {
    answerReceipt: async (requestId) => {
      const outcome = await reads.retrievedOutcome(requestId);
      return outcome ? fromOutcome(requestId, outcome) : fromBook(requestId);
    },
    settledReceipt: (requestId, fall) => {
      const engine = engineFallBody(fall);
      const held = reads.heldFieldsOf(requestId);
      if (held) return { requestId, state: held["status"] as "done" | "error", engine };
      const entry = book.get(requestId);
      // A landed write's verdict rests in the document the dead engine cannot read: memory says nothing true of it.
      if (entry === undefined || entry.state === "landed") {
        const refused = engineTerminatedRefusal(fall);
        return { requestId, state: "error", errorMessage: refused.message, refusal: { reason: refused.refusal }, engine };
      }
      return { ...fromBook(requestId), engine };
    },
    sessionReceipt: async (requestId, face) => {
      const scoped = faceScopedId(face, requestId);
      let fields: Record<string, unknown> | null = reads.heldFieldsOf(scoped);
      if (fields === null) {
        try { fields = await reads.rowFieldsOf(scoped); }
        catch (error) { a.log(`session receipt failed to read request ${requestId}: ${error instanceof Error ? error.message : String(error)}`); }
      }
      // The ring's whole answer and the row both name their face; an outcome of another face answers nothing here.
      const ours = fields !== null && fields["face"] === face ? fields : null;
      const outcome = ours !== null ? withheldVisit(toldOutcome(ours, scoped)) : null;
      const entry = book.get(scoped);
      const state = outcome !== null ? outcome["status"] as "done" | "error"
        : entry === undefined || entry.state === "landed" ? "unknown" : entry.state === "running" ? "pending" : entry.state;
      const durable = state === "done" || state === "error" ? await a.settleDurably() : undefined;
      const action = entry?.action ?? (typeof ours?.["verb"] === "string" ? ours["verb"] : "unknown");
      return { requestId, action, face, state,
        ...(outcome !== null && { outcome: { ...outcome, requestId } }),
        position: { ownerEpoch, ...(durable && { durable }) } };
    },
  };
}
