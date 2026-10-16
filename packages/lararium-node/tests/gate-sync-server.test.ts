/**
 * gate-sync-server — the Repo's server adapter over gated sessions: each session the gate opened stands as one
 * socket the adapter reads, Automerge frames ride sealed "sync" messages, and lar:session JSON rides "session".
 *
 * Proven, each with its control:
 *   · an opened session reaches the adapter as one connection; a "sync" message reads as one frame, and the
 *     adapter's answer leaves as one "sync" message (a real NodeWSServerAdapter answers a join with "peer");
 *   · a "session" message never reaches the adapter: it goes to the session listener as parsed JSON, and a
 *     session message that reads as no JSON goes nowhere;
 *   · RED: a channel that ends closes the socket once, and the socket leaves the server's clients / CONTROL: a live
 *     one stays; the adapter's keepalive ping hears its pong;
 *   · closing the socket closes the channel; a send after it is dropped, never thrown;
 *   · THE FLOOR PIN SET (house ruling "The admit's gate pin", carrier (a)): a SOVEREIGN session hears, once at open, one
 *     "session" message of kind hearth/floor-pins carrying the floor pins at the Nexus its gate seated it under / RED: a
 *     floor-tier session hears none; a session with no Nexus hears none; a provider that throws or yields nothing sends
 *     nothing and the session stands.
 */
import { describe, expect, test } from "vitest";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { cbor } from "@automerge/automerge-repo/slim";
import { HEARTH_FLOOR_PINS_SESSION_KIND, type GateBundlePin, type GateSession, type GateSessionChannel, type SealedMessage } from "@lararium/mesh";
import { gateSyncServer, type GateSyncSocket } from "../src/gate-sync-server.js";

function fakeChannel() {
  const inbox: Array<SealedMessage | null> = [];
  const waiters: Array<(m: SealedMessage | null) => void> = [];
  const sent: Array<{ kind: string; bytes: Uint8Array }> = [];
  let state: "open" | "closed" = "open";
  const channel = {
    get state() { return state; },
    closedBy: null,
    send(kind: string, bytes: Uint8Array) { if (state !== "open") throw new Error("closed"); sent.push({ kind, bytes }); },
    recv() { const next = inbox.shift(); if (next !== undefined) return Promise.resolve(next); return new Promise<SealedMessage | null>((r) => waiters.push(r)); },
    close() { if (state === "closed") return; state = "closed"; for (const w of waiters.splice(0)) w(null); },
  } as unknown as GateSessionChannel;
  const deliver = (m: SealedMessage | null) => { const w = waiters.shift(); if (w) w(m); else inbox.push(m); };
  return { channel, sent, deliver, end: () => deliver(null) };
}
const session = { tier: "sovereign", class: "contracted", scope: { faceKey: "aa".repeat(32), nexus: "n" } } as unknown as GateSession;
const turn = () => new Promise<void>((r) => setImmediate(r));

describe("the gate sync server", () => {
  test("an opened session is one connection; sync frames cross both ways through a real adapter", async () => {
    const server = gateSyncServer();
    const adapter = new NodeWSServerAdapter(server.wss as never, 60_000);
    const candidates: string[] = [];
    adapter.on("peer-candidate", ({ peerId }) => candidates.push(peerId));
    adapter.connect("server-peer" as never, {});
    const c = fakeChannel();
    server.onOpen(c.channel, session);
    expect(server.wss.clients.size).toBe(1);
    const join = cbor.encode({ type: "join", senderId: "client-peer", peerMetadata: {}, supportedProtocolVersions: ["1"] });
    c.deliver({ kind: "sync", bytes: join } as SealedMessage);
    await turn();
    expect(candidates).toEqual(["client-peer"]);
    expect(c.sent).toHaveLength(1);
    expect(c.sent[0]!.kind).toBe("sync");
    expect(cbor.decode(c.sent[0]!.bytes)).toMatchObject({ type: "peer", targetId: "client-peer" });
    const socket = (adapter.sockets as Record<string, GateSyncSocket>)["client-peer"]!;
    expect(server.sessionOf(socket)).toBe(session);
    adapter.disconnect();
    server.close();
  });

  test("a session message goes to the session listener as JSON, never to the adapter", async () => {
    const heard: unknown[] = [];
    const server = gateSyncServer({ onSession: (_socket, body) => heard.push(body) });
    const frames: unknown[] = [];
    server.wss.on("connection", (s: GateSyncSocket) => s.on("message", (m: unknown) => frames.push(m)));
    const c = fakeChannel();
    server.onOpen(c.channel, session);
    c.deliver({ kind: "session", bytes: new TextEncoder().encode(JSON.stringify({ kind: "lar:session", body: 1 })) } as SealedMessage);
    c.deliver({ kind: "session", bytes: new TextEncoder().encode("{not json") } as SealedMessage);
    c.deliver({ kind: "sync", bytes: Uint8Array.of(1, 2) } as SealedMessage);
    await turn();
    expect(heard).toEqual([{ kind: "lar:session", body: 1 }]);
    expect(frames).toHaveLength(1);
    expect(new Uint8Array(frames[0] as Uint8Array)).toEqual(Uint8Array.of(1, 2));
    server.close();
  });

  test("RED: a channel that ends closes its socket once and leaves the clients; CONTROL: a live one stays", async () => {
    const server = gateSyncServer();
    const closes: string[] = [];
    server.wss.on("connection", (s: GateSyncSocket) => s.on("close", () => closes.push("close")));
    const ended = fakeChannel(), live = fakeChannel();
    server.onOpen(ended.channel, session);
    server.onOpen(live.channel, session);
    ended.end();
    await turn();
    expect(closes).toEqual(["close"]);
    expect(server.wss.clients.size).toBe(1);
    const [standing] = [...server.wss.clients];
    expect(standing!.readyState).toBe(1);
    let pong = false;
    standing!.on("pong", () => { pong = true; });
    standing!.ping();
    await turn();
    expect(pong).toBe(true);
    server.close();
  });

  test("closing the socket closes the channel, and a send after it is dropped", async () => {
    const server = gateSyncServer();
    let socket: GateSyncSocket | null = null;
    server.wss.on("connection", (s: GateSyncSocket) => { socket = s; });
    const c = fakeChannel();
    server.onOpen(c.channel, session);
    socket!.close();
    expect(c.channel.state).toBe("closed");
    expect(socket!.readyState).toBe(3);
    expect(() => socket!.send(Uint8Array.of(1))).not.toThrow();
    expect(c.sent).toEqual([]);
    expect(server.wss.clients.size).toBe(0);
  });

  test("THE FLOOR PIN SET: a sovereign session hears its Nexus's floor pins once at open; a floor session, a Nexus-less one, a failing provider: none", async () => {
    const PIN = { tier: "floor", route: "/oracle", nexus: "6e", signingKey: "aa".repeat(32), noiseKey: "bb".repeat(32) } as unknown as GateBundlePin;
    const asked: string[] = [];
    const server = gateSyncServer({ floorPins: (nexus) => { asked.push(nexus); return nexus === "n" ? [PIN] : nexus === "throws" ? (() => { throw new Error("no door"); })() : []; } });
    const read = (c: ReturnType<typeof fakeChannel>) => c.sent.filter((m) => m.kind === "session").map((m) => JSON.parse(new TextDecoder().decode(m.bytes)));
    // CONTROL: the sovereign session at "n".
    const sov = fakeChannel();
    server.onOpen(sov.channel, session);
    await turn();
    expect(read(sov)).toEqual([{ type: "lar:session", kind: HEARTH_FLOOR_PINS_SESSION_KIND, body: { pins: [PIN] } }]);
    // A place's seat, Nexus by its standing: also sovereign, also heard.
    const standing = fakeChannel();
    server.onOpen(standing.channel, { tier: "sovereign", class: "contracted", scope: null, standing: { nym: "x", aid: "n" } } as unknown as GateSession);
    await turn();
    expect(read(standing)).toHaveLength(1);
    // RED: a floor-tier session hears none.
    const floor = fakeChannel();
    server.onOpen(floor.channel, { ...session, tier: "floor" } as unknown as GateSession);
    // RED: a session that names no Nexus hears none.
    const bare = fakeChannel();
    server.onOpen(bare.channel, { tier: "sovereign", class: "contracted", scope: null } as unknown as GateSession);
    // RED: a provider that throws, or yields an empty set, sends nothing, and the session stands.
    const thrown = fakeChannel();
    server.onOpen(thrown.channel, { ...session, scope: { faceKey: "aa".repeat(32), nexus: "throws" } } as unknown as GateSession);
    const empty = fakeChannel();
    server.onOpen(empty.channel, { ...session, scope: { faceKey: "aa".repeat(32), nexus: "elsewhere" } } as unknown as GateSession);
    await turn();
    expect(read(floor)).toEqual([]);
    expect(read(bare)).toEqual([]);
    expect(read(thrown)).toEqual([]);
    expect(read(empty)).toEqual([]);
    expect(thrown.channel.state).toBe("open");
    expect(asked).toEqual(["n", "n", "throws", "elsewhere"]);
    expect(server.wss.clients.size).toBe(6);
    server.close();
  });
});
