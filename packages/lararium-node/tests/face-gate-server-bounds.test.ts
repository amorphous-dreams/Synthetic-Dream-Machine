/**
 * face-gate-server-bounds — what the gate's server lets one peer hold, and for how long a dead one holds it.
 *
 * Every verified dial seats a sealed channel, so a seat's own bounds decide how much memory a peer may pin; at an OPEN
 * Nexus a stranger seats with no admit at all. And a socket that went half-open answers nothing, so only the server's
 * own heartbeat on the real WebSocket learns it is gone.
 *
 * Proven, each with its control:
 *   · RED: a stranger's seat holds a stranger's bounds: a message past them closes its channel / CONTROL: a contracted
 *     seat carries the same message;
 *   · RED: strangers seat up to their own cap and no further, while a member still seats past it / CONTROL: a stranger
 *     whose seat closed frees its place;
 *   · with every pending place held, the NEWEST arrival is dropped, the place's holder stands, and a seated member's
 *     session carries a message (stable-founding-road: the strangers' dial drops the newest arrival);
 *   · RED: a socket that answers no ping is cut at the heartbeat / CONTROL: one that answers stands.
 */
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, test } from "vitest";
import { dialFaceGate, dialedChannel, gateFlightProtocols, type GateSession, type GateSessionChannel } from "@lararium/mesh";
import { faceGateServer, gateSessionRegistry, type FaceGateServer, type FaceGateServerOptions } from "../src/face-gate-server.js";
import { AUDIENCE, presenter, validFlight, world, type Presenter, type World } from "../../lararium-mesh/tests/face-gate-fixture.js";
import { wsDialSocket, type WsLike } from "../../lararium-mesh/src/ws-dial-socket.js";
import { WebSocket as WsSocket } from "ws";

const turn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
async function until(cond: () => boolean, ms = 5_000): Promise<boolean> {
  const end = Date.now() + ms;
  while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 5));
  return cond();
}

const standing: Array<{ http: Server; server: FaceGateServer }> = [];
afterEach(async () => {
  for (const s of standing.splice(0)) {
    s.server.close();
    await new Promise<void>((resolve) => s.http.close(() => resolve()));
  }
});

async function stand(opts: FaceGateServerOptions = {}) {
  const server = faceGateServer(opts);
  const http = createServer();
  http.on("upgrade", (req, socket, head) => { if (!server.handleUpgrade(req, socket, head)) socket.destroy(); });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", () => resolve()));
  const port = (http.address() as { port: number }).port;
  standing.push({ http, server });
  return { server, base: (route: string) => `ws://127.0.0.1:${port}${route}` };
}

/** An OPEN gate seating through a registry; the channels and sessions the registry handed over. */
async function openWorld(registryOpts?: Parameters<typeof gateSessionRegistry>[1]) {
  const opened: GateSessionChannel[] = [];
  const sessions: GateSession[] = [];
  const registry = gateSessionRegistry((channel, session) => { opened.push(channel); sessions.push(session); }, registryOpts);
  const w = await world({ posture: "open", sessions: registry.table });
  const p = await presenter(w, "bounded face");
  return { w, p, opened, sessions, registry };
}

/** Dial `w` at `base` as `p`; `arm: null` dials as a stranger. Answers the dialer's own channel, or the state it read. */
async function dialAs(w: World, p: Presenter, base: string, arm: Presenter["arm"] | null) {
  const socket = wsDialSocket(base, (url, protocols) => new WsSocket(url, protocols, { perMessageDeflate: false }) as unknown as WsLike);
  const verdict = await dialFaceGate({ pin: w.pin, tier: w.pin.tier, socket, audience: AUDIENCE, certificate: p.certificate, signer: p.signer, arm, history: p.history, deadlines: lapseAfter(1_000) });
  if (verdict.state !== "verified") return { state: verdict.state as string, channel: null };
  return { state: "verified", channel: dialedChannel({ transport: verdict.transport, socket: { send: (f) => socket.send(f), recv: () => socket.recv(), cut: () => socket.close() } }) };
}

/** A dialer's deadline on the process clock: silence reads as a lapse after `ms`. */
const lapseAfter = (ms: number) => ({ draw(lapse: () => void) { const t = setTimeout(lapse, ms); return { cancel: () => clearTimeout(t) }; } });

const big = (n: number): Uint8Array => Uint8Array.from({ length: n }, (_, i) => i & 0xff);

describe("what one peer may hold at the gate's server", () => {
  test("RED: a stranger's seat holds a stranger's bounds; CONTROL: a contracted seat carries the same message", async () => {
    const s = await stand();
    const { w, p, opened, sessions } = await openWorld();
    const stood = s.server.stand({ gate: w.gate, pin: w.pin });
    const message = big(5 * 1024 * 1024);

    const member = await dialAs(w, p, s.base("/ws"), p.arm);
    await until(() => opened.length === 1);
    expect(sessions[0]!.class).toBe("contracted");
    member.channel!.send("sync", message);
    expect((await opened[0]!.recv())?.bytes.length).toBe(message.length);           // CONTROL

    const stranger = await dialAs(w, p, s.base("/ws"), null);
    await until(() => opened.length === 2);
    expect(sessions[1]!.class).toBe("stranger");
    stranger.channel!.send("sync", message);
    expect(await opened[1]!.recv()).toBeNull();                                        // RED
    expect(opened[1]!.closedBy).toBe("carriage-refused");
  }, 60_000);

  test("RED: strangers seat up to their own cap and no further; a member still seats; CONTROL: a closed stranger frees its place", async () => {
    const s = await stand();
    const { w, p, opened, sessions } = await openWorld({ maxStrangers: 1 });
    const stood = s.server.stand({ gate: w.gate, pin: w.pin });
    const first = await dialAs(w, p, s.base("/ws"), null);
    expect(first.state).toBe("verified");
    await until(() => opened.length === 1);
    const second = await dialAs(w, p, s.base("/ws"), null);
    expect(second.state).not.toBe("verified");                                        // RED: past the stranger cap
    const member = await dialAs(w, p, s.base("/ws"), p.arm);
    expect(member.state).toBe("verified");                                            // a member seats past it
    await until(() => opened.length === 2);
    expect(sessions.map((x) => x.class)).toEqual(["stranger", "contracted"]);
    opened[0]!.close();
    const third = await dialAs(w, p, s.base("/ws"), null);
    expect(third.state).toBe("verified");                                             // CONTROL
  }, 60_000);

  test("pending places full: the NEWEST arrival is the one dropped, and a seated member's session stands", async () => {
    const s = await stand();
    const opened: GateSessionChannel[] = [];
    const registry = gateSessionRegistry((channel) => { opened.push(channel); });
    const w = await world({ posture: "open", sessions: registry.table, maxPending: 1 });
    const p = await presenter(w, "seated member");
    const stood = s.server.stand({ gate: w.gate, pin: w.pin });
    const member = await dialAs(w, p, s.base("/ws"), p.arm);
    expect(member.state).toBe("verified");
    await until(() => opened.length === 1);
    // One socket holds the one pending place: a flight that parses and opens to nothing, its socket left open.
    const knock = () => new Promise<WsSocket>((resolve, reject) => {
      const ws = new WsSocket(s.base(stood.path), [...gateFlightProtocols(validFlight(w))], { perMessageDeflate: false });
      ws.on("open", () => resolve(ws));
      ws.on("error", reject);
    });
    const holder = await knock();
    expect(await until(() => w.gate.pending === 1)).toBe(true);
    let holderClosed = false;
    holder.on("close", () => { holderClosed = true; });
    const newest = await knock();
    let newestClosed = false;
    newest.on("close", () => { newestClosed = true; });
    expect(await until(() => newestClosed)).toBe(true);                                  // the newest arrival is dropped
    expect(holderClosed).toBe(false);                                                     // the place's holder stands
    // The seated member's session stands and carries a message both ways.
    expect(opened[0]!.state).not.toBe("closed");
    member.channel!.send("sync", big(1024));
    expect((await opened[0]!.recv())?.bytes.length).toBe(1024);
    holder.terminate();
  }, 60_000);

  test("RED: a socket that answers no ping is cut at the heartbeat; CONTROL: one that answers stands", async () => {
    const s = await stand({ heartbeatMs: 40 });
    const { w } = await openWorld();
    const stood = s.server.stand({ gate: w.gate, pin: w.pin });
    // A flight that parses and opens to nothing: the gate holds the socket silent until its deadline, which never fires.
    const open = (autoPong: boolean) => new Promise<WsSocket>((resolve, reject) => {
      const ws = new WsSocket(s.base(stood.path), [...gateFlightProtocols(validFlight(w))], { autoPong, perMessageDeflate: false });
      ws.on("open", () => resolve(ws));
      ws.on("error", reject);
    });
    const deaf = await open(false);
    const live = await open(true);
    let deafClosed = false, liveClosed = false;
    deaf.on("close", () => { deafClosed = true; });
    live.on("close", () => { liveClosed = true; });
    expect(await until(() => deafClosed, 2_000)).toBe(true);                          // RED
    for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 20));
    expect(liveClosed).toBe(false);                                                    // CONTROL
    live.terminate();
    await turn();
  }, 30_000);
});
