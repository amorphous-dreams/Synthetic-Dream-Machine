/**
 * hand-act-gate — an act a person's own hand alone runs, read off the socket's PEER before the act reads its frame.
 *
 * The vessel's verb socket answers any process of its own user, so a frame's own words never decide who sent it: an AI seat or
 * a spirit under a harness may write the same bytes a terminal writes. The peer reads one of three ways (`uds-peer`):
 *
 *   ai       a harness stands on the branch of a process holding the peer's end: the hand act refuses `hand-act-only`.
 *   hand     the peer's processes read, and no harness stands on their branch.
 *   unknown  the peer's processes cannot be read (no socket table, a gone peer): attribution proves NOTHING, so the act stands
 *            only where it proves a person by itself, through a typed route its holder checks against an attempt budget
 *            (`proveRoute`); an act that proves no route refuses `hand-unattested`. Unknown never reads as allowed.
 *
 * The same gate serves every hand act on the custody door and the pūlama's hand door, and the rite's abandon (`rite-abandon`, a
 * seat refused `hand-act-only` at the socket; `lares rite land --abandon` reads its own branch through `readOwnHand`).
 *
 * THE VERB SOCKET'S BOOKED ASKER STANDS AS THIS GATE'S CACHED READING. The socket (`uds-channel`) reads each line's or session's peer
 * once, through the same `peerKindOf` (or the reader a suite names), and books what it read: `ai` books the seat's hand and
 * profile, `hand` books the `cli` asker, `unknown` books none and marks the session unattested. A verb downstream reads that
 * booking (`ctx.asker`) rather than the peer again; `askerRefusal` (`@lararium/mesh/hand-refusal`) reads it as this gate's
 * verdict. So the socket keeps its booking, by design: one reading per line, read through this gate's reader.
 *
 * ONE SENTENCE REFUSES. Every door that refuses a hand act words it through `handRefusalOf` (`@lararium/mesh/hand-refusal`,
 * re-exported here), naming what the reading looked at (a command's own branch, or a line's peer) and the command the cure runs.
 *
 * A COMMAND WITH NO SOCKET reads its own branch (`readOwnHand`): the sense lifecycle's hand verbs (`lares sense harden`,
 * `retire`, `un-retire`, `purge`, `teardown --confirm`) run direct over the store, so the CLI asks the same three readings of the
 * process that runs the command. A flag the command carries (`--approve`, `--confirm`) names the intent; only this reading
 * approves. Like the peer reading it closes the honest road and the casual omission (a stripped harness mark), not a process
 * that leaves the harness's branch on purpose.
 */
import type { Socket } from "node:net";
import { branchKind, harnessMark, peerKindOf, PROC, type PeerKind, type ProcReader } from "./uds-peer.js";

export { askerRefusal, handRefusalOf, type HandReads, type HandRefusal, type HandRefusalCode } from "@lararium/mesh/hand-refusal";

export type HandReading =
  | { readonly admit: "hand" | "route-proves" }
  | { readonly refusal: "hand-act-only" | "hand-unattested" };

/**
 * Read the hand behind a hand act. `proveRoute` names an act whose own frame carries a route the holder checks against an attempt
 * budget before anything moves (a rehive's face route): only such an act stands for an unknown peer.
 */
export async function readHand(sock: Socket, opts: { readonly proveRoute: boolean }, read: (sock: Socket) => Promise<PeerKind> = peerKindOf): Promise<HandReading> {
  return handOf(await read(sock).catch((): PeerKind => "unknown"), opts);
}

/** One reading's verdict: `ai` refuses, `hand` admits, `unknown` stands only for an act that proves a route by itself. */
function handOf(kind: PeerKind, opts: { readonly proveRoute: boolean }): HandReading {
  if (kind === "ai") return { refusal: "hand-act-only" };
  if (kind === "hand") return { admit: "hand" };
  return opts.proveRoute ? { admit: "route-proves" } : { refusal: "hand-unattested" };
}

/**
 * How the process running a command reads: `ai` where a harness mark stands in its own environment or a harness stands on its
 * parent chain (up to init: no vessel line cuts this walk, since the command makes the whole act); `unknown` where any link
 * of that chain cannot be read (`branchKind`); else `hand`.
 */
export function ownPeerKind(env: Readonly<Record<string, string | undefined>> = process.env, self: number = process.pid, read: ProcReader = PROC): PeerKind {
  if (Object.entries(env).some(([key, value]) => harnessMark(key, value))) return "ai";
  return branchKind(self, 0, read);
}

/** Read the hand behind a command that runs in its own process (no socket): the same verdicts `readHand` gives a peer. */
export function readOwnHand(opts: { readonly proveRoute: boolean }, kind: PeerKind = ownPeerKind()): HandReading {
  return handOf(kind, opts);
}
