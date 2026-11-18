/**
 * face-gate-server — the gate over a live WebSocket: the knock dispatcher, the first flight in the upgrade, the
 * sealed channel the seat opens, and the socket's own flow control.
 *
 * Proven here, each with its control:
 *   · a real dial over a real socket reads `verified`, and an application frame it sends AT `verified` arrives at the
 *     gate's channel exactly once, after the seat opens (VERDICT_OPENS_BEFORE_FIRST_SYNC_FRAME, live);
 *   · the 101 selects `lar-gate` alone and never echoes the flight;
 *   · an unknown path stays unclaimed; a knock path with no flight, or a forged one, is destroyed before any 101 and
 *     never reaches the gate;
 *   · two Nexuses on one route stand two paths, and a flight written to one pin draws silence at the other;
 *   · a text frame cuts the socket; a flood pauses the socket at the queue bound and a read resumes it;
 *   · the registry hands each opened channel over once, drops what a refold names, and closes the rest;
 *   · the deadline draws uniform in [base, 2·base) and cancels once.
 */
import { createServer, type Server } from "node:http";
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, test } from "vitest";
import { NOISE_MAX_MESSAGE_BYTES, dialFaceGate, dialedChannel, gateFlightProtocols, type FaceGate, type GateOutcome, type GateSession, type GateSessionChannel } from "@lararium/mesh";
import {
  GATE_DEADLINE_MAX_BASE_MS, GATE_SERVER_MAX_SOCKETS, GATE_SOCKET_QUEUE_BOUND, faceGateServer, gatePath, gateSessionRegistry, timerGateDeadlines,
  wsGateSocket, type FaceGateServer, type FaceGateServerOptions, type GateWire,
} from "../src/face-gate-server.js";
import { AUDIENCE, handDeadlines, presenter, validFlight, world, type Presenter, type World } from "../../lararium-mesh/tests/face-gate-fixture.js";
import { wsDialSocket, type WsLike } from "../../lararium-mesh/src/ws-dial-socket.js";
import { WebSocket as WsSocket } from "ws";

/** Slice B's dial socket over the `ws` client: `seen` keeps the 101's headers and the live socket beneath. */
function liveDialSocket(base: string) {
  const seen: { headers: Readonly<Record<string, unknown>>; ws: WsSocket | null } = { headers: {}, ws: null };
  const socket = wsDialSocket(base, (url, protocols) => {
    const ws = new WsSocket(url, protocols, { perMessageDeflate: false });
    ws.on("upgrade", (res) => { seen.headers = res.headers; });
    seen.ws = ws;
    return ws as unknown as WsLike;
  });
  return { socket, seen };
}

const turn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
async function until(cond: () => boolean): Promise<void> { while (!cond()) await turn(); }

interface Stood {
  readonly http: Server;
  readonly server: FaceGateServer;
  readonly base: (route: string) => string;
  readonly outcomes: Array<[string, GateOutcome]>;
  readonly refusals: Array<[string, string]>;
}

const standing: Stood[] = [];
afterEach(async () => {
  for (const s of standing.splice(0)) {
    s.server.close();
    await new Promise<void>((resolve) => s.http.close(() => resolve()));
  }
});

async function stand(queueBound?: number, more: Omit<FaceGateServerOptions, "onOutcome" | "onRefuse" | "queueBound"> = {}): Promise<Stood> {
  const outcomes: Array<[string, GateOutcome]> = [];
  const refusals: Array<[string, string]> = [];
  const server = faceGateServer({
    onOutcome: (path, outcome) => outcomes.push([path, outcome]),
    onRefuse: (path, refusal) => refusals.push([path, refusal]),
    ...(queueBound !== undefined ? { queueBound } : {}),
    ...more,
  });
  const http = createServer();
  // The vessel's dispatcher destroys every upgrade no face claims.
  http.on("upgrade", (req, socket, head) => { if (!server.handleUpgrade(req, socket, head)) socket.destroy(); });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", () => resolve()));
  const port = (http.address() as { port: number }).port;
  const s = { http, server, base: (route: string) => `ws://127.0.0.1:${port}${route}`, outcomes, refusals };
  standing.push(s);
  return s;
}

/** A world whose gate seats through a registry, and the channels the registry handed over. */
async function seatedWorld(opts: { nexus?: string } = {}): Promise<{ w: World; p: Presenter; opened: GateSessionChannel[]; sessions: GateSession[]; registry: ReturnType<typeof gateSessionRegistry> }> {
  const opened: GateSessionChannel[] = [];
  const sessions: GateSession[] = [];
  const registry = gateSessionRegistry((channel, session) => { opened.push(channel); sessions.push(session); });
  const w = await world({ ...(opts.nexus ? { nexus: opts.nexus } : {}), sessions: registry.table });
  const p = await presenter(w, `server face ${opts.nexus ?? "a"}`);
  return { w, p, opened, sessions, registry };
}

const dialOver = (w: World, p: Presenter, base: string) => {
  const { socket, seen } = liveDialSocket(base);
  return { socket, seen, outcome: dialFaceGate({ pin: w.pin, tier: w.pin.tier, socket, audience: AUDIENCE, certificate: p.certificate, signer: p.signer, arm: p.arm, history: p.history, deadlines: handDeadlines() }) };
};

describe("the gate over a live socket", () => {
  test("CONTROL + VERDICT_OPENS_BEFORE_FIRST_SYNC_FRAME: a verified dial's frame one, sent at verified, arrives once after the seat opens", async () => {
    const s = await stand();
    const { w, p, opened, sessions } = await seatedWorld();
    const stood = s.server.stand({ gate: w.gate, pin: w.pin });
    expect(stood.path).toBe(gatePath(w.pin));
    expect(s.server.paths()).toEqual([stood.path]);
    const { socket, seen, outcome } = dialOver(w, p, s.base("/ws"));
    const verdict = await outcome;
    if (verdict.state !== "verified") throw new Error(`the dial came to ${verdict.state}`);
    // The 101 selected the gate's one protocol, and no token rode back.
    expect(seen.headers["sec-websocket-protocol"]).toBe("lar-gate");
    const mine = dialedChannel({ transport: verdict.transport, socket: { send: (f) => socket.send(f), recv: () => socket.recv(), cut: () => socket.close() } });
    mine.send("sync", Uint8Array.of(9, 8, 7));                       // frame one, at verified
    await until(() => opened.length === 1);
    const at = opened[0]!;
    expect(at.state).toBe("open");
    expect(sessions[0]!.class).toBe("contracted");
    expect(sessions[0]!.scope?.faceKey).toBe(p.scope.faceKey);
    const first = await at.recv();
    expect(first?.kind).toBe("sync");
    expect(Array.from(first!.bytes)).toEqual([9, 8, 7]);
    // And back the other way, under the same seal.
    at.send("session", Uint8Array.of(1));
    expect(Array.from((await mine.recv())!.bytes)).toEqual([1]);
    mine.close();
    expect(await at.recv()).toBeNull();                               // exactly once: nothing else stood queued
    expect(at.closedBy).toBe("peer-close");
    await until(() => s.outcomes.length === 1);
    expect(s.outcomes[0]).toEqual([stood.path, { outcome: "attached", class: "contracted" }]);
  });

  test("RED: an unknown path stays unclaimed, and a knock path with no flight or a forged one dies before any 101, unseen by the gate", async () => {
    const s = await stand();
    const { w } = await seatedWorld();
    const stood = s.server.stand({ gate: w.gate, pin: w.pin });
    const { WebSocket } = await import("ws");
    const attempt = (url: string, protocols?: string[]) => new Promise<string>((resolve) => {
      const ws = new WebSocket(url, protocols);
      ws.on("open", () => { ws.terminate(); resolve("opened"); });
      ws.on("error", () => resolve("refused"));
      ws.on("unexpected-response", () => resolve("refused"));
    });
    const at = s.base(stood.path);
    expect(await attempt(s.base("/ws/0123456789abcdef0123456789abcdef"), [...gateFlightProtocols(new Uint8Array(96))])).toBe("refused");
    expect(await attempt(at)).toBe("refused");
    expect(await attempt(at, ["lar-gate"])).toBe("refused");
    expect(await attempt(at, ["lar-gate", "x".repeat(127)])).toBe("refused");
    expect(s.refusals.map(([, r]) => r)).toEqual(["flight-absent", "flight-shape", "flight-token"]);
    expect(w.gate.pending).toBe(0);
    expect(s.outcomes).toEqual([]);
    // RED (W10 finding): a well-formed 96-byte flight that fails to decrypt draws no 101, and the gate never sees the socket.
    expect(await attempt(at, [...gateFlightProtocols(new Uint8Array(96))])).toBe("refused");
    expect(s.refusals.map(([, r]) => r)).toEqual(["flight-absent", "flight-shape", "flight-token", "flight-undecrypted"]);
    expect(s.outcomes).toEqual([]);
    expect(w.gate.pending).toBe(0);
  });

  test("RED: a flight written to this gate's pin and sent on its path opens; one under any other pin draws no 101", async () => {
    const s = await stand();
    const { w, p } = await seatedWorld();
    const stood = s.server.stand({ gate: w.gate, pin: w.pin });
    const { outcome } = dialOver(w, p, s.base("/ws"));
    expect((await outcome).state).toBe("verified");
    await until(() => s.outcomes.length === 1);
    expect(s.refusals).toEqual([]);
    expect(s.outcomes[0]).toEqual([stood.path, { outcome: "attached", class: "contracted" }]);
  });

  test("RED: two Nexuses on one route stand two paths; a flight written to one pin draws silence at the other", async () => {
    const s = await stand();
    const a = await seatedWorld({ nexus: "nexus-a.synthetic" });
    const b = await seatedWorld({ nexus: "nexus-b.synthetic" });
    const pathA = s.server.stand({ gate: a.w.gate, pin: a.w.pin }).path;
    const pathB = s.server.stand({ gate: b.w.gate, pin: b.w.pin }).path;
    expect(pathA).not.toBe(pathB);
    expect(() => s.server.stand({ gate: a.w.gate, pin: a.w.pin })).toThrow(/already stands/);
    // A's presenter, writing to A's pin, knocks on B's path: the URL names B's knock, the flight decrypts only at A.
    const { socket } = liveDialSocket(s.base("/ws"));
    const crossed = { ...socket, open: (flight: { knock: string; message1: Uint8Array }) => socket.open({ ...flight, knock: pathB.split("/").pop()! }) };
    void dialFaceGate({ pin: a.w.pin, tier: a.w.pin.tier, socket: crossed, audience: AUDIENCE, certificate: a.p.certificate, signer: a.p.signer, arm: a.p.arm, history: a.p.history, deadlines: handDeadlines() });
    await until(() => s.refusals.length === 1);
    expect(s.refusals[0]).toEqual([pathB, "flight-undecrypted"]);
    expect(s.outcomes).toEqual([]);
    expect(b.opened).toEqual([]);
    // CONTROL: each presenter reaches its own gate.
    for (const { w, p, opened } of [a, b]) {
      const { outcome } = dialOver(w, p, s.base("/ws"));
      expect((await outcome).state).toBe("verified");
      await until(() => opened.length === 1);
    }
  });

  test("RED: a text frame after the seat cuts the socket and the gate's channel reads the peer gone; unstand closes the path", async () => {
    const s = await stand();
    const { w, p, opened } = await seatedWorld();
    const stood = s.server.stand({ gate: w.gate, pin: w.pin });
    const { socket, seen, outcome } = dialOver(w, p, s.base("/ws"));
    const verdict = await outcome;
    if (verdict.state !== "verified") throw new Error(`the dial came to ${verdict.state}`);
    await until(() => opened.length === 1);
    const mine = dialedChannel({ transport: verdict.transport, socket: { send: (f) => socket.send(f), recv: () => socket.recv(), cut: () => socket.close() } });
    mine.send("sync", Uint8Array.of(5));
    expect(Array.from((await opened[0]!.recv())!.bytes)).toEqual([5]);   // CONTROL: a sealed binary frame reads
    seen.ws!.send("not sealed");                                         // a text frame on the sealed wire
    expect(await opened[0]!.recv()).toBeNull();
    expect(opened[0]!.closedBy).toBe("peer-gone");
    expect(await mine.recv()).toBeNull();                                  // the gate cut the dialer's socket
    stood.unstand();
    stood.unstand();
    expect(s.server.paths()).toEqual([]);
    const again = dialOver(w, p, s.base("/ws"));
    expect((await again.outcome).state).not.toBe("verified");
  });
});

describe("the gate socket's flow control", () => {
  /** A ws double: it records pause, resume, terminate and sends. */
  function fakeWire(): GateWire & EventEmitter & { calls: string[]; sent: Uint8Array[] } {
    const e = new EventEmitter() as EventEmitter & { calls: string[]; sent: Uint8Array[]; readyState: number };
    e.calls = []; e.sent = []; e.readyState = 1;
    Object.assign(e, {
      send: (data: Uint8Array) => { e.sent.push(data); },
      pause: () => { e.calls.push("pause"); },
      resume: () => { e.calls.push("resume"); },
      // A real socket emits its close later, on its own turn: the cut alone must end every reader.
      terminate: () => { e.calls.push("terminate"); e.readyState = 3; },
    });
    return e as never;
  }
  const flight = { knock: "k", message1: new Uint8Array(96) };

  test("a flood pauses at the bound, a read below it resumes, and frames arrive in order", async () => {
    const ws = fakeWire();
    const gs = wsGateSocket(ws, flight, 3);
    for (let i = 0; i < 3; i++) ws.emit("message", Buffer.from([i]), true);
    expect(ws.calls).toEqual(["pause"]);
    ws.emit("message", Buffer.from([3]), true);                        // a frame the kernel already held
    expect(ws.calls).toEqual(["pause"]);
    expect(Array.from((await gs.recv())!)).toEqual([0]);
    expect(ws.calls).toEqual(["pause"]);                               // still at the bound
    expect(Array.from((await gs.recv())!)).toEqual([1]);
    expect(ws.calls).toEqual(["pause", "resume"]);
    for (const want of [2, 3]) expect(Array.from((await gs.recv())!)).toEqual([want]);
    // A waiting reader takes a frame straight off the wire.
    const waiting = gs.recv();
    ws.emit("message", Buffer.from([4]), true);
    expect(Array.from((await waiting)!)).toEqual([4]);
    expect(GATE_SOCKET_QUEUE_BOUND).toBe(32);
    expect(() => wsGateSocket(fakeWire(), flight, 0)).toThrow(RangeError);
  });

  test("RED: a text frame cuts; the socket's end reads null for every reader; a send on a closed socket throws", async () => {
    const ws = fakeWire();
    const gs = wsGateSocket(ws, flight);
    gs.send(Uint8Array.of(1));
    expect(ws.sent).toHaveLength(1);                                   // CONTROL
    const waiting = gs.recv();
    ws.emit("message", "text", false);
    expect(await waiting).toBeNull();
    expect(ws.calls).toEqual(["terminate"]);
    expect(await gs.recv()).toBeNull();
    expect(() => gs.send(Uint8Array.of(1))).toThrow(/closed/);
    const other = fakeWire();
    const gs2 = wsGateSocket(other, flight);
    other.emit("message", Buffer.from([7]), true);
    other.emit("close");
    expect(await gs2.recv()).toBeNull();                               // the end drops what stood unread
    expect(gs2.flight.message1).not.toBe(flight.message1);             // the flight is the socket's own copy
  });
});

describe("the registry and the deadline", () => {
  test("the registry hands each channel over once, drops what a refold names, and closes the rest", async () => {
    const s = await stand();
    const { w, p, registry, opened } = await seatedWorld();
    s.server.stand({ gate: w.gate, pin: w.pin });
    for (let i = 0; i < 2; i++) {
      const { outcome } = dialOver(w, p, s.base("/ws"));
      expect((await outcome).state).toBe("verified");
    }
    await until(() => opened.length === 2);
    expect(registry.live()).toHaveLength(2);
    let first = true;
    expect(registry.drop(() => { const hit = first; first = false; return hit; })).toBe(1);
    expect(registry.live()).toHaveLength(1);
    expect(opened.filter((c) => c.state === "closed")).toHaveLength(1);
    registry.close();
    expect(registry.live()).toEqual([]);
    expect(opened.every((c) => c.closedBy === "local")).toBe(true);
  });

  test("a throwing onOpen leaves no live session behind", async () => {
    const registry = gateSessionRegistry(() => { throw new Error("refused"); });
    const seat = await registry.table.attach({ flight: { knock: "k", message1: new Uint8Array(96) }, send() {}, recv: () => new Promise(() => {}), cut() {} }, { transport: { send: { seal: (b: Uint8Array) => b }, receive: { open: (b: Uint8Array) => b } } } as never);
    expect(() => seat.open()).toThrow("refused");
    expect(registry.live()).toEqual([]);
  });

  test("the deadline draws uniform in [base, 2·base) and cancels once", () => {
    const drawn: number[] = [], cleared: unknown[] = [];
    const d = timerGateDeadlines({ baseMs: 100, random: (min, max) => { expect([min, max]).toEqual([0, 100]); return 37; }, setTimer: (_l, ms) => { drawn.push(ms); return "t"; }, clearTimer: (t) => cleared.push(t) });
    const one = d.draw(() => {});
    expect(drawn).toEqual([137]);
    one.cancel(); one.cancel();
    expect(cleared).toEqual(["t"]);
    expect(() => timerGateDeadlines({ baseMs: 0 })).toThrow(RangeError);
  });
});

// ── The server's own bounds, live ───────────────────────────────────────────────────────────────

/** A raw client on `url`: with a world, a flight that decrypts at its gate and then goes silent; without one, a well-formed flight a stand-in gate takes. It opens a 101, or is refused. */
async function rawKnock(url: string, w?: World): Promise<{ ws: WsSocket | null; closed: Promise<number> }> {
  const ws = new WsSocket(url, [...gateFlightProtocols(w === undefined ? new Uint8Array(96) : validFlight(w))], { perMessageDeflate: false });
  const closed = new Promise<number>((resolve) => { ws.on("close", (code) => resolve(code)); ws.on("error", () => resolve(-1)); });
  const opened = await new Promise<boolean>((resolve) => { ws.on("open", () => resolve(true)); ws.on("error", () => resolve(false)); ws.on("unexpected-response", () => resolve(false)); });
  return { ws: opened ? ws : null, closed };
}
/** A gate that takes its socket and reads nothing, ever. */
const deafGate = (taken: unknown[] = []): FaceGate => ({ accept: (socket) => { taken.push(socket); return new Promise(() => {}); }, preflight: () => true, get pending() { return 0; } } as unknown as FaceGate);
const stillOpen = async (closed: Promise<number>, ms = 150): Promise<boolean> =>
  Promise.race([closed.then(() => false), new Promise<boolean>((r) => setTimeout(() => r(true), ms))]);

describe("the server's own bounds over a live socket", () => {
  test("RED: a flood of tiny frames past the hard bound is cut, though the gate never reads; CONTROL: frames within it stand", async () => {
    const s = await stand(4);
    const { w } = await seatedWorld();
    const path = s.server.stand({ gate: deafGate(), pin: w.pin }).path;
    const calm = await rawKnock(s.base(path));
    for (let i = 0; i < 3; i++) calm.ws!.send(Uint8Array.of(i));
    expect(await stillOpen(calm.closed)).toBe(true);                   // CONTROL: within the soft bound, the socket stands
    const flood = await rawKnock(s.base(path));
    // Many tiny frames in one burst: the pause cannot hold back what the current chunk already parsed.
    for (let i = 0; i < 4000; i++) flood.ws!.send(Uint8Array.of(i & 0xff));
    expect(await flood.closed).toBeGreaterThan(0);                      // the server cut it
    calm.ws!.terminate();
  });

  test("RED: a frame over the Noise bound is refused by the socket itself (maxPayload)", async () => {
    const s = await stand();
    const { w } = await seatedWorld();
    const path = s.server.stand({ gate: deafGate(), pin: w.pin }).path;
    const big = await rawKnock(s.base(path));
    big.ws!.send(new Uint8Array(NOISE_MAX_MESSAGE_BYTES + 1));
    expect(await big.closed).toBe(1009);
    const fits = await rawKnock(s.base(path));
    fits.ws!.send(new Uint8Array(NOISE_MAX_MESSAGE_BYTES));
    expect(await stillOpen(fits.closed)).toBe(true);                   // CONTROL
    fits.ws!.terminate();
  });

  test("RED: a text frame before any seat cuts the socket at once, before any lapse", async () => {
    const s = await stand();
    const { w } = await seatedWorld();
    const path = s.server.stand({ gate: w.gate, pin: w.pin }).path;       // hand deadlines: no lapse ever fires
    const quiet = await rawKnock(s.base(path), w);
    expect(await stillOpen(quiet.closed)).toBe(true);                  // CONTROL: the gate waits on its silent socket
    const texty = await rawKnock(s.base(path), w);
    texty.ws!.send("not sealed");
    expect(await texty.closed).toBeGreaterThan(0);
    quiet.ws!.terminate();
  });

  test("RED: past maxSockets a knock dies before any 101; CONTROL: a socket freed makes room", async () => {
    const s = await stand(undefined, { maxSockets: 1 });
    const { w } = await seatedWorld();
    const path = s.server.stand({ gate: deafGate(), pin: w.pin }).path;
    const first = await rawKnock(s.base(path));
    expect(first.ws).not.toBeNull();
    expect((await rawKnock(s.base(path))).ws).toBeNull();
    expect(s.refusals.map(([, r]) => r)).toEqual(["server-full"]);
    first.ws!.terminate();
    await first.closed;
    await until(() => true);
    for (let i = 0; i < 50; i++) await turn();
    const again = await rawKnock(s.base(path));
    expect(again.ws).not.toBeNull();
    again.ws!.terminate();
    expect(GATE_SERVER_MAX_SOCKETS).toBe(1024);
  });

  test("RED: a socket the gate turns away as pending-full is cut at once, not at its lapse", async () => {
    const s = await stand();
    const w = await world({ maxPending: 1 });
    const path = s.server.stand({ gate: w.gate, pin: w.pin }).path;      // hand deadlines: no lapse fires
    const holder = await rawKnock(s.base(path), w);                      // its flight decrypts and then goes silent: it waits
    await until(() => w.gate.pending === 1);
    const turned = await rawKnock(s.base(path), w);
    expect(await turned.closed).toBeGreaterThan(0);
    await until(() => s.outcomes.length === 1);
    expect(s.outcomes.map(([, o]) => o)).toEqual([{ outcome: "silence", reason: "pending-full" }]);
    expect(await stillOpen(holder.closed)).toBe(true);                 // CONTROL: the one holding its place waits on
    holder.ws!.terminate();
  });

  test("RED: a gate whose accept throws, or rejects, has its socket cut", async () => {
    const s = await stand();
    const { w } = await seatedWorld();
    const pin = w.pin;
    const throwing = { accept: () => { throw new Error("sync fault"); }, preflight: () => true, pending: 0 } as unknown as FaceGate;
    const path = s.server.stand({ gate: throwing, pin }).path;
    expect(await (await rawKnock(s.base(path))).closed).toBeGreaterThan(0);
    s.server.paths();
    const other = await seatedWorld({ nexus: "nexus-b.synthetic" });
    const rejecting = { accept: () => Promise.reject(new Error("async fault")), preflight: () => true, pending: 0 } as unknown as FaceGate;
    const path2 = s.server.stand({ gate: rejecting, pin: other.w.pin }).path;
    expect(await (await rawKnock(s.base(path2))).closed).toBeGreaterThan(0);
  });

  test("RED: close cuts every upgraded socket, and a late knock on a path it stood is refused by name; an unknown path stays unclaimed", async () => {
    const s = await stand();
    const { w } = await seatedWorld();
    const path = s.server.stand({ gate: deafGate(), pin: w.pin }).path;
    const live = await rawKnock(s.base(path));
    expect(await stillOpen(live.closed)).toBe(true);                   // CONTROL
    s.server.close();
    expect(await live.closed).toBeGreaterThan(0);
    expect((await rawKnock(s.base(path))).ws).toBeNull();
    expect(s.refusals.map(([, r]) => r)).toEqual(["server-closed"]);
    expect((await rawKnock(s.base("/ws/0123456789abcdef0123456789abcdef"))).ws).toBeNull();
    expect(s.refusals).toHaveLength(1);                                 // the dispatcher destroyed that one, unclaimed
  });

  test("RED: unstand cuts every socket its gate seated (a Nexus no longer carried keeps no stranger); CONTROL: another gate's socket stands", async () => {
    const s = await stand();
    const a = await seatedWorld({ nexus: "nexus-a.synthetic" });
    const b = await seatedWorld({ nexus: "nexus-b.synthetic" });
    const stoodA = s.server.stand({ gate: deafGate(), pin: a.w.pin });
    const pathB = s.server.stand({ gate: deafGate(), pin: b.w.pin }).path;
    const atA = await rawKnock(s.base(stoodA.path));
    const atB = await rawKnock(s.base(pathB));
    expect(atA.ws).not.toBeNull();
    expect(atB.ws).not.toBeNull();
    stoodA.unstand();
    expect(s.server.paths()).toEqual([pathB]);
    expect(await stillOpen(atA.closed)).toBe(false);                   // RED on the span: the seated socket outlives its gate
    expect(await stillOpen(atB.closed)).toBe(true);                    // CONTROL: the gate still standing keeps its own
  });

  test("a live gate on the process timer cuts a silent socket at its lapse; RED: no base past the bound", async () => {
    const s = await stand();
    const short = await world({ lapses: timerGateDeadlines({ baseMs: 30 }) });
    const long = await world({ nexus: "nexus-b.synthetic", lapses: timerGateDeadlines({ baseMs: 60_000 }) });
    const pathShort = s.server.stand({ gate: short.gate, pin: short.pin }).path;
    const pathLong = s.server.stand({ gate: long.gate, pin: long.pin }).path;
    const lapsing = await rawKnock(s.base(pathShort), short);
    const waiting = await rawKnock(s.base(pathLong), long);
    expect(await lapsing.closed).toBeGreaterThan(0);
    expect(await stillOpen(waiting.closed)).toBe(true);                // CONTROL: a long base has not lapsed
    waiting.ws!.terminate();
    expect(() => timerGateDeadlines({ baseMs: GATE_DEADLINE_MAX_BASE_MS + 1 })).toThrow(RangeError);
    expect(() => timerGateDeadlines({ baseMs: 2 ** 48 })).toThrow(RangeError);
    expect(() => timerGateDeadlines({ baseMs: GATE_DEADLINE_MAX_BASE_MS })).not.toThrow();
  });
});

describe("the registry's edges", () => {
  const fakeSocket = () => ({ flight: { knock: "k", message1: new Uint8Array(96) }, send() {}, recv: () => new Promise<Uint8Array | null>(() => {}), cut() {} });
  const fakeSession = () => ({ transport: { send: { seal: (b: Uint8Array) => b }, receive: { open: (b: Uint8Array) => b } } } as never);

  test("RED: an onOpen that closes its own channel and throws leaves every other live session standing", async () => {
    let sabotage = false;
    const registry = gateSessionRegistry((channel) => {
      if (!sabotage) return;
      channel.close();
      registry.live();                                                    // a prune that already took the seat out
      throw new Error("refused");
    });
    (await registry.table.attach(fakeSocket(), fakeSession())).open();
    expect(registry.live()).toHaveLength(1);
    sabotage = true;
    const seat = await registry.table.attach(fakeSocket(), fakeSession());
    expect(() => seat.open()).toThrow("refused");
    expect(registry.live()).toHaveLength(1);
  });

  test("RED: a seat that opens after close reaches no onOpen and closes; a throwing reading drops its session and the walk goes on", async () => {
    const heard: GateSessionChannel[] = [];
    const registry = gateSessionRegistry((channel) => { heard.push(channel); });
    for (let i = 0; i < 3; i++) (await registry.table.attach(fakeSocket(), fakeSession())).open();
    let asked = 0;
    expect(registry.drop(() => { asked++; if (asked === 1) throw new Error("unreadable"); return false; })).toBe(1);
    expect(asked).toBe(3);                                               // the walk went on past the throw
    expect(registry.live()).toHaveLength(2);
    const late = await registry.table.attach(fakeSocket(), fakeSession());
    registry.close();
    expect(() => late.open()).toThrow(/closed/);
    expect(heard).toHaveLength(3);
    expect(registry.live()).toEqual([]);
  });
});
