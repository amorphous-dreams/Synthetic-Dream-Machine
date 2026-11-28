/**
 * THE ASK BOOK: what the verb door holds in memory about the request ids it met in this life, and nothing it rests.
 *
 * A request id names one attempt. The book answers the questions an answer ring cannot: whether an ask under the id
 * still runs (a same-id re-ask joins its wait), whether the door refused it before dispatch (a hang-up the door met first,
 * or a cancel that reached it first: a later ask under the id refuses `abandoned`), what a session act's verdict read
 * (its answer rode the socket alone, so a retry under its id reads the receipt), and what input a landed ask carried (a
 * re-ask under its id with other input refuses by name, even where the answer that landed names no digest). The whole answers wait in the answer ring
 * (`control-home` `answerRingOf`) and a write's verdict row in the control document; the book holds neither.
 *
 * ONE SYNCHRONOUS TURN DECIDES. `begin` reads and books in one turn, so two asks under one id never both run: the first
 * books the id running and the second reads it. No write, flush or clock decides anything here, and a restart begins with
 * an empty book, as the ring does: an id the book and the ring no longer name re-runs honestly (an effect key dedups it at
 * the island's effect row).
 *
 * ONE BOUND, A COUNT: past {@link ANSWER_RING_COUNT} ids the oldest entry leaves, whatever it holds.
 * Heleuma ha: see lararium/mesh/uds-channel-ask-book.
 */

import { ANSWER_RING_COUNT } from "@lararium/mesh/control-home";

/** What the book holds for one request id. `digest` names the input the ask carried (`verbInputDigest`); a cancel that
 *  met no ask names none. `action` names the verb or act, where the door read one. */
export type AskEntry =
  | { readonly state: "running"; readonly digest: string; readonly action?: string }
  /** The ask's answer landed (the ring holds it, or a write's verdict row): the book keeps the input it carried. */
  | { readonly state: "landed"; readonly digest: string; readonly action?: string }
  | { readonly state: "abandoned"; readonly digest?: string; readonly action?: string }
  | { readonly state: "done" | "error"; readonly digest: string; readonly action: string };

/** What `begin` decides for an ask. */
export type AskVerdict =
  | { readonly verdict: "run" }
  /** The same id with the same input still runs (or, for an act, already concluded): the ask reads it back. */
  | { readonly verdict: "standing"; readonly entry: AskEntry }
  | { readonly verdict: "refuse"; readonly reason: "abandoned" | "request-id-reused-with-changed-input" };

export class AskBook {
  private readonly held = new Map<string, AskEntry>();

  constructor(private readonly bound: number = ANSWER_RING_COUNT) {}

  /** What the book holds for `requestId`, or undefined. */
  get(requestId: string): AskEntry | undefined {
    return this.held.get(requestId);
  }

  /**
   * Arbitrate one ask in one turn. An abandoned id refuses on its state alone, whatever the input; any other entry under
   * another input refuses by name; a running ask or an act's verdict under the same input reads back; a landed ask whose
   * answer the caller found nowhere (its body left the ring, and a read leaves no row) runs again under the same input, as
   * an id the book never met does: the book marks it running and answers `run`.
   */
  begin(requestId: string, digest: string, action?: string): AskVerdict {
    const entry = this.held.get(requestId);
    if (entry?.state === "abandoned") return { verdict: "refuse", reason: "abandoned" };
    if (entry !== undefined && entry.digest !== digest) return { verdict: "refuse", reason: "request-id-reused-with-changed-input" };
    if (entry !== undefined && entry.state !== "landed") return { verdict: "standing", entry };
    this.put(requestId, { state: "running", digest, ...(action !== undefined && { action }) });
    return { verdict: "run" };
  }

  /** The door refused the id before dispatch (a hang-up it met first, or a cancel). A no-op once anything stands for it. */
  abandon(requestId: string, digest?: string, action?: string): void {
    if (this.held.has(requestId)) return;
    this.put(requestId, { state: "abandoned", ...(digest !== undefined && { digest }), ...(action !== undefined && { action }) });
  }

  /** A session act concluded: its verdict stands for a retry under its id. Its answer rode the socket alone. */
  settle(requestId: string, status: "done" | "error", digest: string, action: string): void {
    this.put(requestId, { state: status, digest, action });
  }

  /** The ask's answer stands in the ring: a running entry reads landed, keeping the input it carried. */
  landed(requestId: string): void {
    const entry = this.held.get(requestId);
    if (entry?.state === "running") this.held.set(requestId, { state: "landed", digest: entry.digest, ...(entry.action !== undefined && { action: entry.action }) });
  }

  /** How many ids the book holds. */
  get size(): number {
    return this.held.size;
  }

  private put(requestId: string, entry: AskEntry): void {
    this.held.delete(requestId);
    this.held.set(requestId, entry);
    while (this.held.size > this.bound) this.held.delete(this.held.keys().next().value as string);
  }
}
