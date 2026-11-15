/**
 * wire-legs — the node vessel's wire legs, each seated for the (face, Nexus) it serves (`@lararium/mesh`
 * `wire-identity`, `leg`).
 *
 * A node's Repo reaches the wire by two legs. The SYNC GATE's leg (the engine's server adapter over gated sessions,
 * `gate-sync-server`) seats many sessions on one adapter; the CLIENT DIAL's leg (`nexus-client-dial`) presents one face
 * at one hearth. Unseated, each presented the composition's one peer id and one store id, so a peer seated under one
 * face read the ids every other face of the vessel showed.
 *
 *   · A GATE SESSION FACES ONE LOCAL FACE AT ITS NEXUS (`gateLegAt`). A same-operator session proved a PersonaGroup of
 *     this vessel (a device of that face, lit here or worn): it faces THAT face. Every other session (a contracted
 *     peer, a guest, a place's seat) faces the hearth as the composition wears it: the worn face, or the floor. The
 *     Nexus reads off the session's own scope, or off the standing a place's seat holds.
 *   · THE ALIAS SETTLES BEFORE THE SESSION'S FIRST WORD (`gateSessionSettles`). The gate sync server holds an opened
 *     session until its pair's alias settled, so the adapter's answer to a join already leaves under it. A session
 *     whose alias cannot settle (the store refused) closes, and no word leaves for it.
 *   · THE SEAT READS THE SESSION BEHIND A PEER'S SOCKET (`seatGateLeg`). The adapter announces a joining peer before
 *     it files that peer's socket, so an arrival reads the socket whose message the adapter holds right then
 *     (`ListeningWSServerAdapter.arriving`), and every later word reads the socket the adapter filed for the peer.
 *
 * WHAT THIS LEAVES SHOWN, by name: one gate stands for each Nexus, never for each face, so two faces of this vessel
 * that stand in ONE Nexus answer a contracted peer there as one hearth, under the worn face's alias; and the vessel's
 * one store, address and actors still serve every face (road rows `C11`, `C12`, `C13`).
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/residency-follows-the-contract#/faces-sit-flat
 */
import type { PeerId } from "@automerge/automerge-repo";
import type { GateSession, WireIdentity, WireLegAt, WireLegRefusal } from "@lararium/mesh";

/** The (face, Nexus) a gate session faces on this vessel wearing `worn` (null at the veil floor). */
export function gateLegAt(session: GateSession, worn: string | null): WireLegAt {
  return {
    face: session.class === "same-operator" && session.face ? session.face.personaGroup : worn,
    nexus: session.scope?.nexus ?? session.standing?.aid ?? null,
  };
}

/** The gate sync server's `settle`: the session's pair settles its alias before the adapter hears the session. */
export function gateSessionSettles(wire: Pick<WireIdentity, "alias">, worn: string | null): (session: GateSession) => Promise<void> {
  return async (session) => { await wire.alias(gateLegAt(session, worn)); };
}

/** What the seat reads of the server adapter: the socket filed for each peer, and the socket whose message it holds now. */
interface GateLegAdapter {
  readonly sockets: Readonly<Record<string, unknown>>;
  readonly arriving: unknown;
}

/**
 * SEAT THE SYNC GATE'S LEG before it joins the Repo: each peer reads the alias of the pair its session faces. A peer
 * behind no gated session reads nothing.
 */
export function seatGateLeg<T extends GateLegAdapter>(
  wire: Pick<WireIdentity, "leg">, adapter: T, gateSync: { sessionOf(socket: unknown): GateSession | null }, worn: string | null,
  onRefusal?: (refusal: WireLegRefusal, peerId: string) => void,
): T {
  return wire.leg(adapter, (remote: PeerId, arriving: boolean) => {
    const socket = arriving ? adapter.arriving : adapter.sockets[remote];
    const session = socket !== null && typeof socket === "object" ? gateSync.sessionOf(socket) : null;
    return session === null ? null : gateLegAt(session, worn);
  }, onRefusal);
}
