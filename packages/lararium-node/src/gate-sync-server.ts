/**
 * gate-sync-server — the Repo's server adapter over GATED sessions. Automerge's `NodeWSServerAdapter` reads a
 * server that emits `connection` and `close` and holds `clients`, and sockets that emit `message`, `close` and
 * `pong`; this module stands both over the sealed channels a vessel's gates open (`face-gate-server`):
 *
 *   · one opened session is one socket: the adapter sees it once, at open, and never before the gate's verdict left;
 *   · a sealed "sync" message reads as one Automerge frame, and the adapter's every send leaves as one "sync"
 *     message on the same channel;
 *   · a sealed "session" message (lar:session JSON, UTF-8) never reaches the adapter: it goes to `onSession`;
 *   · the channel's liveness is the gate socket's own: the gate's server pings the real WebSocket beneath it and cuts
 *     one that answers no ping (`face-gate-server`'s heartbeat), and a cut ends the channel; so the adapter's keepalive
 *     ping answers its pong while the channel stands, and the socket closes, once, when the channel ends;
 *   · closing the socket closes the channel; a send to a closed socket drops, as a ws send to a closed peer does;
 *   · THE FLOOR PIN SET (house ruling "Floor pins", carrier (a)): a SOVEREIGN session hears, once at open, one sealed
 *     "session" message of kind `hearth/floor-pins` whose body is the floor pins this hearth stands at the Nexus that
 *     seated it (`floorPins`). The verified crossing is the authenticated relation the dialer files them under. A floor
 *     session, a session naming no Nexus, an empty set or a provider that fails sends nothing; the session stands.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/gate-sync-server
 */
import { EventEmitter } from "node:events";
import {
  HEARTH_FLOOR_PINS_SESSION_KIND, hearthFloorPinsBody, mkLarSessionMsg,
  type GateBundlePin, type GateSession, type GateSessionChannel,
} from "@lararium/mesh";

const OPEN = 1;
const CLOSED = 3;

/** One gated session, as the adapter reads a socket. */
export interface GateSyncSocket extends EventEmitter {
  readonly readyState: number;
  send(data: ArrayBuffer | Uint8Array): void;
  close(): void;
  terminate(): void;
  ping(): void;
}

/** The server face the adapter reads. */
export interface GateSyncWss extends EventEmitter {
  readonly clients: Set<GateSyncSocket>;
}

export interface GateSyncServer {
  readonly wss: GateSyncWss;
  /** The registry's `onOpen`: hand one opened session to the adapter. */
  onOpen(channel: GateSessionChannel, session: GateSession): void;
  /** What the gate proved for the session behind `socket`, or null for a socket this server never stood. */
  sessionOf(socket: unknown): GateSession | null;
  /** Close every socket and tell the adapter the server closed. */
  close(): void;
}

export interface GateSyncServerOptions {
  /** A lar:session message a session sent, parsed. A body that reads as no JSON goes nowhere. */
  readonly onSession?: (socket: GateSyncSocket, body: unknown) => void;
  /** The floor pins this hearth stands at `nexus` (the AID text), sent to each sovereign session at open. */
  readonly floorPins?: (nexus: string) => readonly GateBundlePin[] | Promise<readonly GateBundlePin[]>;
}

function toBytes(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? Uint8Array.from(data) : new Uint8Array(data.slice(0));
}

export function gateSyncServer(opts: GateSyncServerOptions = {}): GateSyncServer {
  const clients = new Set<GateSyncSocket>();
  const sessions = new WeakMap<object, GateSession>();
  const wss = Object.assign(new EventEmitter(), { clients }) as GateSyncWss;

  const socketOver = (channel: GateSessionChannel): GateSyncSocket => {
    let closed = false;
    const socket = new EventEmitter() as EventEmitter & GateSyncSocket;
    const end = (): void => {
      if (closed) return;
      closed = true;
      clients.delete(socket);
      try { channel.close(); } catch { /* already gone */ }
      socket.emit("close");
    };
    Object.defineProperty(socket, "readyState", { get: () => (closed || channel.state !== "open" ? CLOSED : OPEN) });
    Object.assign(socket, {
      send(data: ArrayBuffer | Uint8Array): void {
        if (closed || channel.state !== "open") return;
        try { channel.send("sync", toBytes(data)); } catch { end(); }
      },
      close: end,
      terminate: end,
      ping(): void { if (!closed) queueMicrotask(() => { if (!closed) socket.emit("pong"); }); },
    });
    const pump = async (): Promise<void> => {
      for (;;) {
        let next;
        try { next = await channel.recv(); } catch { next = null; }
        if (next === null || closed) break;
        if (next.kind === "sync") socket.emit("message", Buffer.from(next.bytes));
        else if (next.kind === "session") {
          let body: unknown;
          try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(next.bytes)); } catch { continue; }
          try { opts.onSession?.(socket, body); } catch { /* a listener never decides the channel */ }
        }
      }
      end();
    };
    queueMicrotask(() => { void pump(); });
    return socket;
  };

  /** THE FLOOR PIN SET: one message to a sovereign session, at open, of the floor pins at the Nexus that seated it. */
  const sendFloorPins = async (channel: GateSessionChannel, session: GateSession): Promise<void> => {
    const provider = opts.floorPins;
    const nexus = session.scope?.nexus ?? session.standing?.aid ?? null;
    if (!provider || session.tier !== "sovereign" || typeof nexus !== "string" || nexus.length === 0) return;
    let pins: readonly GateBundlePin[];
    try { pins = await provider(nexus); } catch { return; }
    if (!Array.isArray(pins) || pins.length === 0 || channel.state !== "open") return;
    const bytes = new TextEncoder().encode(JSON.stringify(mkLarSessionMsg(HEARTH_FLOOR_PINS_SESSION_KIND, hearthFloorPinsBody(pins))));
    try { channel.send("session", bytes); } catch { /* a channel that ended takes nothing */ }
  };

  return {
    wss,
    onOpen(channel, session) {
      const socket = socketOver(channel);
      sessions.set(socket, session);
      clients.add(socket);
      wss.emit("connection", socket);
      void sendFloorPins(channel, session);
    },
    sessionOf: (socket) => (socket !== null && typeof socket === "object" ? sessions.get(socket) ?? null : null),
    close() {
      for (const socket of [...clients]) socket.close();
      wss.emit("close");
    },
  };
}
