/**
 * host-countersign — the HEARTH's side of a user's invite: countersign a walker's invite nonce over a live
 * session this hearth's gate holds with that walker.
 *
 * "This hearth currently hosts that walker" proves WITHOUT A ROSTER. The gate issued a single-use nonce and
 * advertised its gate key on one socket, and that socket is open now; the walker's per-Nexus leaf signs that
 * nonce, that gate key, the Nexus and the invite nonce (`hostSessionProofBytes`). The hearth reads the
 * session from its OWN gate, never from anything the walker echoed, so it countersigns exactly the walkers
 * it is talking to and keeps no list of them. A closed socket carries no session, and the countersign refuses.
 *
 * The hearth signs with its persona's per-Nexus LEAF, never the vessel key and never the persona root, and
 * presents its own admit beside the countersign so the newcomer's gate reads the hearth's standing.
 *
 * NOTHING IS KEPT. The countersign writes no file and returns nothing that names a guest: the request
 * names the Nexus, a random nonce and the walker's leaf. The hearth learns that one of its walkers invited
 * someone, and never whom.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import * as ed25519 from "@noble/ed25519";
import {
  countersignHostedInvite,
  type CarriageEntry, type HostCountersignRequest, type HostCountersignVerdict, type HostSession,
  type PresentedLineageAct,
} from "@lararium/mesh";
import type { DaemonAuthGate } from "./daemon-auth-gate.js";
import { nexusLeafFor } from "./nexus-leaf.js";

type GateSocket = Parameters<DaemonAuthGate["getChallengeForSocket"]>[0];

/**
 * The live hosting session on `socket`, read from this hearth's own gate: the nonce and gate key it issued,
 * and only while the socket stays among the gate's live clients. Null when the socket is closed, was never
 * admitted, or the gate advertised no gate key.
 */
export function hostSessionOf(
  gate: Pick<DaemonAuthGate, "clients" | "getChallengeForSocket">,
  socket: GateSocket,
): HostSession | null {
  if (!gate.clients.has(socket)) return null;
  const challenge = gate.getChallengeForSocket(socket);
  if (!challenge?.gatePubKey) return null;
  return { nonce: challenge.nonce, gatePubKey: challenge.gatePubKey };
}

/**
 * Countersign a walker's request arriving on `socket`, as the hearth persona at `handleIndex` for the Nexus
 * named by `nexusAid`. `admit` and `lineage` present the hearth leaf's own standing
 * (`presentationFromBoardDoc`). Refuses when the socket holds no live session or the walker's leaf did not
 * sign over it. Writes nothing.
 */
export async function runHostCountersign(opts: {
  gate:        Pick<DaemonAuthGate, "clients" | "getChallengeForSocket">;
  socket:      GateSocket;
  request:     HostCountersignRequest;
  handleIndex: number;
  nexusAid:    string;
  admit:       CarriageEntry;
  lineage:     readonly PresentedLineageAct[];
}): Promise<HostCountersignVerdict> {
  const leaf = await nexusLeafFor(opts.handleIndex, opts.nexusAid);
  return countersignHostedInvite({
    session:  hostSessionOf(opts.gate, opts.socket),
    request:  opts.request,
    nexusAid: opts.nexusAid,
    hearth: {
      key: leaf.verifyingKey, admit: opts.admit, lineage: opts.lineage,
      sign: async (bytes) => Buffer.from(await ed25519.signAsync(bytes, leaf.seed)).toString("hex"),
    },
  });
}
