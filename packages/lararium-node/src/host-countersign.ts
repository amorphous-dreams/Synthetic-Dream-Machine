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
 * THE WIRE. The walker asks on the authenticated session (`lar:session`, kind `host-countersign/ask`) and the
 * hearth answers on the same socket (`host-countersign/answer`, `{ nonce, verdict }`). `serveHostCountersign`
 * registers that handler on the gate.
 *
 * The hearth signs with its own per-Nexus LEAF, never the vessel key and never the persona root, and presents
 * that leaf's own admit beside the countersign (`ownPresentationFor`, the one presenter) so the newcomer's
 * gate reads the hearth's standing. A hearth with no admit in the asked Nexus lends nothing.
 *
 * NOTHING IS KEPT. The countersign writes no file and returns nothing that names a guest: the request
 * names the Nexus, a random nonce and the walker's leaf. The hearth learns that one of its walkers invited
 * someone, and never whom.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import * as ed25519 from "@noble/ed25519";
import {
  countersignHostedInvite, HOST_COUNTERSIGN_ASK, HOST_COUNTERSIGN_ANSWER,
  type CarriageEntry, type HostCountersignRequest, type HostCountersignVerdict, type HostSession,
  type PresentedLineageAct,
} from "@lararium/mesh";
import type { DaemonAuthGate } from "./daemon-auth-gate.js";
import type { NexusLeaf } from "./nexus-leaf.js";
import { ownPresentationFor, type BoardOpener } from "./nexus-carriage.js";

type GateSocket = Parameters<DaemonAuthGate["getChallengeForSocket"]>[0];

/** What a hearth lends from: its own per-Nexus leaf in one Nexus and that leaf's admit there. */
export interface HearthStanding {
  readonly leaf:    NexusLeaf;
  readonly admit:   CarriageEntry;
  readonly lineage: readonly PresentedLineageAct[];
}

/** The hearth's own standing in the Nexus named by an AID, or null where it holds no admit. */
export type HearthStandingSource = (nexusAid: string) => Promise<HearthStanding | null>;

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
 * Countersign a walker's request arriving on `socket`. Refuses when the socket holds no live session, the
 * hearth holds no admit in the asked Nexus, or the walker's leaf did not sign over this session. Writes
 * nothing.
 */
export async function runHostCountersign(opts: {
  gate:     Pick<DaemonAuthGate, "clients" | "getChallengeForSocket">;
  socket:   GateSocket;
  request:  HostCountersignRequest;
  standing: HearthStandingSource;
}): Promise<HostCountersignVerdict> {
  const session = hostSessionOf(opts.gate, opts.socket);
  if (!session) return { ok: false, refusal: "no-live-session" };
  const req = opts.request;
  if (!req || typeof req !== "object" || typeof req.nexusAid !== "string") return { ok: false, refusal: "malformed-request" };
  const own = await opts.standing(req.nexusAid);
  if (!own) return { ok: false, refusal: "hearth-not-admitted" };
  return countersignHostedInvite({
    session, request: req, nexusAid: req.nexusAid,
    hearth: {
      key: own.leaf.verifyingKey, admit: own.admit, lineage: own.lineage,
      sign: async (bytes) => Buffer.from(await ed25519.signAsync(bytes, own.leaf.seed)).toString("hex"),
    },
  });
}

/**
 * Serve countersigns on `gate`'s authenticated sessions: every `host-countersign/ask` is answered on the same
 * socket with `{ nonce, verdict }`. Returns the unsubscribe.
 */
export function serveHostCountersign(
  gate: Pick<DaemonAuthGate, "clients" | "getChallengeForSocket" | "onSession" | "sendSession">,
  standing: HearthStandingSource,
): () => void {
  return gate.onSession((socket, msg) => {
    if (msg.kind !== HOST_COUNTERSIGN_ASK) return;
    const request = msg.body as HostCountersignRequest;
    const nonce = request && typeof request === "object" ? (request as { nonce?: unknown }).nonce : undefined;
    void runHostCountersign({ gate, socket, request, standing })
      .catch((): HostCountersignVerdict => ({ ok: false, refusal: "malformed-request" }))
      .then((verdict) => { gate.sendSession(socket, HOST_COUNTERSIGN_ANSWER, { nonce, verdict }); });
  });
}

/**
 * The hearth's own standing, read off the boards this vessel holds: its held leaf's admit in each asked
 * Nexus, through the one presenter.
 */
export function hearthStandingFromBoards(opts: {
  readonly sealHome: string; readonly ownVesselKey: string; readonly open: BoardOpener;
}): HearthStandingSource {
  return async (nexusAid) => {
    const p = await ownPresentationFor({ ...opts, aid: nexusAid });
    return p ? { leaf: p.leaf, admit: p.admit, lineage: p.lineage } : null;
  };
}
