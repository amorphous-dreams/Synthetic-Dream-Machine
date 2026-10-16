/**
 * ws-dial-socket — a WebSocket as a dial's socket: the knock and the flight ride the upgrade, frames ride binary messages.
 */
import { describe, expect, it } from "vitest";
import { GATE_PROTOCOL, gateFlightProtocols } from "../src/gate-exchange.js";
import { NOISE_MAX_MESSAGE_BYTES } from "../src/noise-ik.js";
import { DIAL_QUEUE_BOUND, knockedRouteUrl, wsDialSocket, type WsLike } from "../src/ws-dial-socket.js";

type Handler = (event: { data?: unknown }) => void;
function double(selected = GATE_PROTOCOL): { ws: WsLike & { fire(type: string, data?: unknown): void; sent: unknown[]; closed: number }; asked: Array<[string, string[]]> } {
  const handlers = new Map<string, Handler[]>();
  const sent: unknown[] = [];
  const state = { closed: 0 };
  const ws = {
    protocol: selected, binaryType: "blob", sent,
    get closed() { return state.closed; },
    send: (d: unknown) => { sent.push(d); },
    close: () => { state.closed++; },
    addEventListener: (type: string, h: Handler) => { handlers.set(type, [...(handlers.get(type) ?? []), h]); },
    fire: (type: string, data?: unknown) => { for (const h of handlers.get(type) ?? []) h({ data }); },
  };
  return { ws: ws as never, asked: [] };
}
const FLIGHT = new Uint8Array(96).fill(5);

describe("wsDialSocket", () => {
  it("CONTROL: opens on the knocked route with the flight in the protocols, and frames flow both ways", async () => {
    const { ws } = double();
    const asked: Array<[string, string[]]> = [];
    const socket = wsDialSocket("wss://hearth.example:8443/ws", (url, protocols) => { asked.push([url, protocols]); return ws; });
    const opening = socket.open({ knock: "k".repeat(32), message1: FLIGHT });
    ws.fire("open");
    await opening;
    expect(asked).toEqual([[`wss://hearth.example:8443/ws/${"k".repeat(32)}`, [...gateFlightProtocols(FLIGHT)]]]);
    expect(ws.binaryType).toBe("arraybuffer");
    socket.send(Uint8Array.of(1, 2));
    expect(ws.sent).toEqual([Uint8Array.of(1, 2)]);
    ws.fire("message", Uint8Array.of(9).buffer);
    expect(await socket.recv()).toEqual(Uint8Array.of(9));
    ws.fire("close");
    expect(await socket.recv()).toBeNull();
  });

  it("a 101 that selected no lar-gate is cut and the open rejects", async () => {
    const { ws } = double("");
    const socket = wsDialSocket("ws://h/ws", () => ws);
    const opening = socket.open({ knock: "k".repeat(32), message1: FLIGHT });
    ws.fire("open");
    await expect(opening).rejects.toThrow(/lar-gate/);
    expect(ws.closed).toBe(1);
  });

  it("a socket that closes before it opens rejects the open, a second open throws, and close ends recv", async () => {
    const { ws } = double();
    const socket = wsDialSocket("ws://h/ws", () => ws);
    const opening = socket.open({ knock: "k".repeat(32), message1: FLIGHT });
    ws.fire("close");
    await expect(opening).rejects.toThrow(/before open/);
    expect(() => socket.open({ knock: "k".repeat(32), message1: FLIGHT })).toThrow(/one socket/);
    socket.close();
    expect(await socket.recv()).toBeNull();
  });

  it("knockedRouteUrl appends one segment and keeps the query away from the route", () => {
    expect(knockedRouteUrl("ws://h:1/ws/", "abc")).toBe("ws://h:1/ws/abc");
  });

  it("a flight that is not a minimal message one never leaves", () => {
    const { ws } = double();
    const socket = wsDialSocket("ws://h/ws", () => ws);
    expect(() => socket.open({ knock: "k", message1: new Uint8Array(10) })).toThrow(RangeError);
  });

  async function opened(opts?: { queueBound?: number; byteBound?: number }) {
    const { ws } = double();
    const socket = wsDialSocket("ws://h/ws", () => ws, opts);
    const opening = socket.open({ knock: "k".repeat(32), message1: FLIGHT });
    ws.fire("open");
    await opening;
    return { ws, socket };
  }

  it("RED: a text frame cuts the socket, as the server cuts it; the reader sees the end", async () => {
    const { ws, socket } = await opened();
    ws.fire("message", Uint8Array.of(1).buffer);
    ws.fire("message", "a text frame");
    expect(ws.closed).toBe(1);
    expect(await socket.recv()).toBeNull();              // the end drops what stood unread
  });

  it("RED: more frames than the queue bound, unread, cut the socket", async () => {
    const { ws, socket } = await opened();
    for (let i = 0; i < DIAL_QUEUE_BOUND; i++) ws.fire("message", Uint8Array.of(i).buffer);
    expect(ws.closed).toBe(0);                            // CONTROL: exactly the bound stands
    expect(await socket.recv()).toEqual(Uint8Array.of(0));
    ws.fire("message", Uint8Array.of(99).buffer);         // the queue is back under the bound
    expect(ws.closed).toBe(0);
    ws.fire("message", Uint8Array.of(7).buffer);          // one past the bound
    expect(ws.closed).toBe(1);
    expect(await socket.recv()).toBeNull();
  });

  it("RED: unread bytes past the byte bound cut the socket", async () => {
    const { ws, socket } = await opened({ byteBound: 100 });
    ws.fire("message", new Uint8Array(60).buffer);
    ws.fire("message", new Uint8Array(40).buffer);
    expect(ws.closed).toBe(0);                            // CONTROL: the bound itself stands
    ws.fire("message", new Uint8Array(1).buffer);
    expect(ws.closed).toBe(1);
    expect(await socket.recv()).toBeNull();
  });

  it("RED: a frame past a Noise message cuts the socket", async () => {
    const { ws, socket } = await opened();
    ws.fire("message", new Uint8Array(NOISE_MAX_MESSAGE_BYTES).buffer);
    expect(ws.closed).toBe(0);                            // CONTROL: a full Noise message reads
    expect(((await socket.recv()) as Uint8Array).length).toBe(NOISE_MAX_MESSAGE_BYTES);
    ws.fire("message", new Uint8Array(NOISE_MAX_MESSAGE_BYTES + 1).buffer);
    expect(ws.closed).toBe(1);
    expect(await socket.recv()).toBeNull();
  });

  it("the factory is told the payload cap, for a client that can hold it", () => {
    const { ws } = double();
    let told: unknown = null;
    const socket = wsDialSocket("ws://h/ws", (_u, _p, o) => { told = o; return ws; });
    void socket.open({ knock: "k".repeat(32), message1: FLIGHT }).catch(() => {});
    expect(told).toEqual({ maxPayload: NOISE_MAX_MESSAGE_BYTES });
  });
});
