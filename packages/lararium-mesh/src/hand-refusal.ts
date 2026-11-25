/**
 * hand-refusal — the one sentence a hand act refuses with, written once for every door that reads a hand.
 *
 * The house reads the hand behind a hand act in one gate (`@lararium/node`'s `hand-act-gate`): `readHand` reads a socket's
 * peer, `readOwnHand` reads the branch of the process that runs a command, and the verb socket books the asker it read off the
 * same peer reading (`peerKindOf`) once per line or session, so a verb downstream (`ctx.asker`) carries the gate's CACHED
 * reading, never a word of the frame. Each reading refuses one of two ways, and this module words both:
 *
 *   hand-act-only    an AI harness stands on the branch (or a seat asked): the operator runs the act at their own terminal.
 *   hand-unattested  the branch or the peer reads nothing (no socket table, a gone peer, an unreadable link): attribution proves
 *                    nothing, so the act runs from a terminal whose processes the host can read.
 *
 * `reads` names what the reading looked at, so the sentence names the right witness: a command's own process chain
 * (`branch`), or the line's peer the socket read (`peer`). `line`, where the door knows it, names the command the cure runs;
 * absent, the cure names the act itself. Every refusal names its cure.
 *
 * `askerRefusal` reads a booked asker as the gate's verdict: `cli` and `tab` stand for a hand the socket read, `seat` refuses
 * `hand-act-only`, and anything else (no asker booked, a watcher) refuses `hand-unattested`.
 *
 * Pure: no clock, no environment, no I/O; the floor every package composes on (`@lararium/tw5` reads it, below `@lararium/node`).
 */

/** The two codes a refused hand act answers with, everywhere the house reads a hand. */
export type HandRefusalCode = "hand-act-only" | "hand-unattested";

/** What the reading looked at: the process chain of the command that runs the act, or the peer of the socket's line. */
export type HandReads = "branch" | "peer";

/** A refused hand act: its code, and the one sentence that names why and the cure. */
export interface HandRefusal { readonly code: HandRefusalCode; readonly message: string }

/**
 * Word one refused hand act. `act` names what runs on a hand, as the door's own subject (`` `lares shore take-disk` ``,
 * `a release`); `line` names the command the operator runs, where the door knows it.
 */
export function handRefusalOf(code: HandRefusalCode, at: { readonly act: string; readonly reads: HandReads; readonly line?: string }): HandRefusal {
  const run = at.line !== undefined ? `run \`${at.line}\`` : "run it";
  if (code === "hand-act-only") {
    const who = at.reads === "branch" ? "an AI harness stands on this command's branch" : "a seat asked";
    return { code, message: `hand-act-only: ${at.act} runs on a person's hand at a real terminal, and ${who}. Ask the operator to ${run} on their own terminal.` };
  }
  const what = at.reads === "branch" ? "this command's process chain" : "this line's peer";
  return { code, message: `hand-unattested: ${at.act} runs on a person's hand at a real terminal, and ${what} reads nothing to attest one. ${run.charAt(0).toUpperCase()}${run.slice(1)} on a terminal whose processes the host can read.` };
}

/**
 * The verdict a booked asker carries (the socket's cached reading of the gate): null where a hand stands (`cli`, `tab`), else
 * the refusal code.
 */
export function askerRefusal(asker: string | undefined): HandRefusalCode | null {
  if (asker === "cli" || asker === "tab") return null;
  return asker === "seat" ? "hand-act-only" : "hand-unattested";
}
