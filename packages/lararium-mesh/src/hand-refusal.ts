/**
 * hand-refusal — the one sentence a hand act refuses with, written once for every door that reads a hand.
 *
 * The house reads the hand behind a hand act in one gate (`@lararium/node`'s `hand-act-gate`): `readHand` reads a socket's
 * peer, `readOwnHand` reads the branch of the process that runs a command, and the verb socket books the asker it read off the
 * same peer reading (`peerKindOf`) once per line or session, so a verb downstream (`ctx.asker`) carries the gate's CACHED
 * reading; a frame's own words only narrow it (a seat mark books the seat), never lift it. Each reading refuses one of two ways,
 * and this module words both:
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
 * `HAND_ADMITS` holds the one hand-code table (`custody.hand.admits`): every act a person's hand alone runs, keyed by verb, with
 * the code each door answers; every wing's table reads as a view of it (`handCodesOf`).
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
 * the refusal code. `terminal` names an act a person runs at their own terminal alone (a retire, a sense hand verb, a landing
 * the owner's holder signs): there `cli` alone admits, and a tab refuses `hand-act-only` as a seat does.
 */
export function askerRefusal(asker: string | undefined, opts: { readonly terminal?: boolean } = {}): HandRefusalCode | null {
  if (asker === "cli" || (asker === "tab" && opts.terminal !== true)) return null;
  return asker === "seat" || asker === "tab" ? "hand-act-only" : "hand-unattested";
}

/** The wing a hand act rides: the door family that answers it, each refusing by its own code. */
export type HandWing = "promote" | "kapae" | "swarm" | "sense" | "shore" | "retire" | "share" | "floor" | "render-output";

/** One hand act's row: the code every door answers a refused asker with, and the wing that act rides. */
export interface HandAdmitRow { readonly code: string; readonly wing: HandWing }

const row = (wing: HandWing, code: string): HandAdmitRow => ({ code, wing });
const PROMOTE = row("promote", "promote-needs-hand");
const KAPAE = row("kapae", "kapae-needs-hand");
const SWARM = row("swarm", "swarm-needs-hand");
const SENSE = row("sense", "sense-needs-hand");
const SHORE = row("shore", "hand-act-only");
const SHARE = row("share", "share-needs-hand");

/**
 * THE ONE HAND-CODE TABLE (`lar:///custody.hand.admits`): every act a person's hand alone runs, keyed by verb, with the code a
 * door refuses any other asker by and the wing it rides. Each wing's table reads as a view of this one (`handCodesOf`), so a
 * code moves in one row and every door that answers it moves with it. The codes stay as every caller reads them; the gate's
 * own two (`hand-act-only`, `hand-unattested`) word the sentence (`handRefusalOf`), and a wing's code names the family.
 *
 * An act whose hand-only reach turns on its arguments names its verb and its turn (`shore take-records`),
 * so no bare op word reaches a verb table. Keys stay disjoint by construction: an object literal refuses a duplicate key.
 *
 *   promote / kapae   the promote panel and the store door's settling rows (a stage's commit, drop or orphan; a kapae's raise, lower)
 *   swarm             the house cap, a lane share, a lei (`swarm-show` stays open to a seat)
 *   sense             the sense lifecycle verbs that move what the house keeps
 *   shore             the shore's settling ops (a standoff settles only by a person); a seat lists, reads and flushes
 *   retire            the daemon island's unmint of a face's wiki shell
 *   share             who reads and writes a bag, and its landing (sealed-store#/the-share-config)
 *   floor             the vessel floor's accept (w26-floor-lane#/the-vessel-pin); a seat reads the status
 *   render-output     derived bytes landing in a bound workbench (a disk write grant)
 */
export const HAND_ADMITS: Readonly<Record<string, HandAdmitRow>> = Object.freeze({
  "promote-commit": PROMOTE, "promote-drop": PROMOTE, "promote-orphan": PROMOTE, "promote-keep": PROMOTE, "promote-orphan-drop": PROMOTE,
  "kapae-raise": KAPAE, "kapae-lower": KAPAE,
  "swarm-cap-set": SWARM, "swarm-share-set": SWARM, "swarm-lei-kui": SWARM, "swarm-lei-unstring": SWARM, "swarm-lei-restring": SWARM,
  promote: SENSE, retire: SENSE, "un-retire": SENSE, purge: SENSE,
  "shore take-records": SHORE, "shore keep-both": SHORE, "shore restore": SHORE, "shore remove": SHORE,
  "retire-wiki": row("retire", "retire-needs-hand"),
  "share-set": SHARE, "share-apply": SHARE,
  "floor-accept": row("floor", "floor-needs-hand"), "floor-adopt-apply": row("floor", "floor-needs-hand"),
  "wiki-render-out": row("render-output", "render-output-needs-hand"),
});

/** The code a hand act refuses by, or undefined where the act stands open (never a prototype key). */
export function handCodeOf(act: string): string | undefined {
  return Object.hasOwn(HAND_ADMITS, act) ? HAND_ADMITS[act]!.code : undefined;
}

/** A view of the one table: each act of the named wings with its code, in the table's own order. */
export function handCodesOf(...wings: readonly HandWing[]): ReadonlyMap<string, string> {
  return new Map(Object.entries(HAND_ADMITS).filter(([, r]) => wings.includes(r.wing)).map(([act, r]) => [act, r.code]));
}
