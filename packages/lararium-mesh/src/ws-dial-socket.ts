/**
 * ws-dial-socket — a WebSocket as a dial's socket (`DialSocket`): the first flight rides the upgrade, every later
 * frame is one binary message.
 *
 * The browser envelope (gate-exchange, "the upgrade's envelope"): the socket opens on the gate's URL with the knock
 * (the pin's `gateKnock`) appended to its route as one path segment, offering the protocols `lar-gate` and the
 * flight's token. The gate's 101 selects `lar-gate` alone, and a dialer that sees any other selection cuts the
 * socket (Firefox and WebKit open a 101 that selected nothing). Node 22+ and every browser carry the same global
 * `WebSocket`, so one door serves both.
 *
 * Pure of clocks: a socket that never opens leaves `open` pending, and the dial's own deadline cuts it by `close()`.
 * Stands specified in code until the socket cutover wires it; out of the package barrel till then.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-browser-envelope
 */
import type { DialSocket } from "./face-dial.js";
import { gateFlightProtocols, gateProtocolSelected } from "./gate-exchange.js";
import { NOISE_MAX_MESSAGE_BYTES } from "./noise-ik.js";

/** The slice of a WebSocket this door speaks; a vector hands a double. */
export interface WsLike {
  readonly protocol: string;
  binaryType: string;
  send(data: ArrayBuffer | Uint8Array): void;
  close(): void;
  addEventListener(type: "open" | "message" | "close" | "error", listener: (event: { data?: unknown }) => void): void;
}
/** What a client that can hold a payload cap is told (`ws`'s `maxPayload`); a platform WebSocket cannot, and the door holds it itself. */
export interface WsFactoryOptions { readonly maxPayload: number }
export type WsFactory = (url: string, protocols: string[], options: WsFactoryOptions) => WsLike;

/** How many whole frames may stand unread before the socket is cut — the gate server's own queue bound. */
export const DIAL_QUEUE_BOUND = 32;
/** How many unread bytes may stand before the socket is cut. */
export const DIAL_BYTE_BOUND = DIAL_QUEUE_BOUND * NOISE_MAX_MESSAGE_BYTES;

/** `url` (the gate's route, `ws(s)://host/ws`) with the knock appended as the last path segment. */
export function knockedRouteUrl(url: string, knock: string): string {
  const u = new URL(url);
  u.pathname = `${u.pathname.replace(/\/+$/, "")}/${knock}`;
  return u.href;
}

const defaultFactory: WsFactory = (url, protocols) => new WebSocket(url, protocols) as unknown as WsLike;

/** A fresh DialSocket over one WebSocket to `url`. One socket per dial; a second `open` throws. */
export function wsDialSocket(url: string, factory: WsFactory = defaultFactory, bounds: { readonly queueBound?: number; readonly byteBound?: number } = {}): DialSocket {
  const queueBound = bounds.queueBound ?? DIAL_QUEUE_BOUND;
  const byteBound = bounds.byteBound ?? DIAL_BYTE_BOUND;
  let ws: WsLike | null = null;
  let heldBytes = 0;
  const held: Array<Uint8Array | null> = [];
  const waiting: Array<(frame: Uint8Array | null) => void> = [];
  let ended = false;
  const push = (frame: Uint8Array | null): void => {
    if (ended) return;
    if (frame === null) ended = true;
    const waiter = waiting.shift();
    if (waiter) waiter(frame);
    else {
      held.push(frame);
      heldBytes += frame?.length ?? 0;
    }
    if (frame === null) for (const rest of waiting.splice(0)) rest(null);
  };
  /** The server's own law: a peer that outruns its reader, or breaks the frame rules, is cut and the reader sees the end. */
  const cut = (): void => { try { ws?.close(); } catch { /* already gone */ } held.length = 0; heldBytes = 0; push(null); };
  const take = (frame: Uint8Array): void => {
    if (ended) return;
    if (frame.length > NOISE_MAX_MESSAGE_BYTES) { cut(); return; }
    if (waiting.length === 0 && (held.length >= queueBound || heldBytes + frame.length > byteBound)) { cut(); return; }
    push(frame);
  };
  return {
    open(flight) {
      if (ws !== null) throw new Error("ws-dial-socket: one socket per dial");
      const socket = factory(knockedRouteUrl(url, flight.knock), [...gateFlightProtocols(flight.message1)], { maxPayload: NOISE_MAX_MESSAGE_BYTES });
      ws = socket;
      socket.binaryType = "arraybuffer";
      socket.addEventListener("message", (event) => {
        const data = event.data;
        if (data instanceof ArrayBuffer) take(new Uint8Array(data));
        else if (data instanceof Uint8Array) take(Uint8Array.from(data));
        // A text frame is no gate frame: the gate cuts one, and so does the dial.
        else cut();
      });
      socket.addEventListener("close", () => push(null));
      socket.addEventListener("error", () => { /* the close that follows ends the dial */ });
      return new Promise<void>((resolve, reject) => {
        socket.addEventListener("open", () => {
          if (!gateProtocolSelected(socket.protocol)) { try { socket.close(); } catch { /* already gone */ } reject(new Error("ws-dial-socket: the 101 selected no lar-gate")); return; }
          resolve();
        });
        socket.addEventListener("close", () => reject(new Error("ws-dial-socket: closed before open")));
      });
    },
    send(frame) { ws?.send(frame); },
    recv() {
      if (held.length > 0) { const next = held.shift()!; heldBytes -= next?.length ?? 0; return Promise.resolve(next); }
      if (ended) return Promise.resolve(null);
      return new Promise((resolve) => waiting.push(resolve));
    },
    close() { try { ws?.close(); } catch { /* already gone */ } push(null); },
  };
}
