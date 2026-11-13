/**
 * node-dial-socket — the node vessel's dial socket: the `ws` client beneath the mesh's dial door (`wsDialSocket`).
 *
 * The door hands its factory the payload cap (a Noise message, `NOISE_MAX_MESSAGE_BYTES`) as `maxPayload`, and `ws`
 * holds it on the wire: a frame whose header names more is refused as that header lands, before its body is buffered,
 * so a hostile gate cannot push one huge frame into a dialer's memory. No compression rides a dial socket, as none
 * rides the gate's own (`face-gate-server`).
 *
 * Called by the Nexus sync dial (`nexus-client-dial`) and the carriage pull the vessel stands (`open-node-vessel`).
 */
import { WebSocket } from "ws";
import { wsDialSocket, type DialSocket, type WsFactory, type WsLike } from "@lararium/mesh";

/** The `ws` client as the door's factory: the door's payload cap rides the client itself. */
export const nodeWsFactory: WsFactory = (url, protocols, { maxPayload }) =>
  new WebSocket(url, protocols, { maxPayload, perMessageDeflate: false }) as unknown as WsLike;

/** A fresh dial socket to `url` over the `ws` client. One socket per dial. */
export function nodeDialSocket(url: string): DialSocket {
  return wsDialSocket(url, nodeWsFactory);
}
