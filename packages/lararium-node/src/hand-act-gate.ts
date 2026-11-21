/**
 * hand-act-gate — an act a person's own hand alone runs, read off the socket's PEER before the act reads its frame.
 *
 * The vessel's verb socket answers any process of its own user, so a frame's own words never decide who sent it: an AI seat or
 * a spirit under a harness may write the same bytes a terminal writes. The peer does decide (`uds-peer`): a peer that runs on a
 * harness's process branch reads as an AI seat, and a hand act refuses it by name (`hand-act-only`) before any credential the
 * frame carries reaches a holder. The same gate serves every hand act on the custody door; `rite abandon`'s hand gate (#409)
 * names the same need and may take this helper when the two land.
 */
import type { Socket } from "node:net";
import { peerSeatOf } from "./uds-peer.js";

/** Null where the peer reads as a person's hand; else the refusal reason a hand act answers. */
export async function handActRefusal(sock: Socket, read: (sock: Socket) => Promise<"ai" | null> = peerSeatOf): Promise<"hand-act-only" | null> {
  return (await read(sock)) === "ai" ? "hand-act-only" : null;
}
