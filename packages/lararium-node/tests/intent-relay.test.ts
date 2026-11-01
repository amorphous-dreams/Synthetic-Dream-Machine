import { createServer } from "node:http";
import { createPublicKey, verify } from "node:crypto";
import { afterEach, describe, expect, test } from "vitest";
import { WebSocket } from "ws";
import { dialFaceGate, dialIntentRelay, deriveGateBundle, sovereignGateRoot, sovereignRoute, utf8Bytes, INTENT_RELAY_ROUTE, type SignedIntentEntry } from "@lararium/mesh";
import { wsDialSocket, type WsLike } from "../../lararium-mesh/src/ws-dial-socket.js";
import { faceGateServer, gatePath, gateSessionRegistry } from "../src/face-gate-server.js";
import { custodyGateDoor } from "../src/custody-seat.js";
import { standIntentRelay, type IntentRelayService } from "../src/intent-relay.js";
import { enableIntentRelayFace, disableIntentRelayFace } from "../src/intent-relay-ring.js";
import { intentRelayKeyOrMint, intentRelayPublicKey, signAsIntentRelay } from "../src/intent-relay-key-store.js";
import { openRelayGateSeed } from "../src/relay-gate-seed.js";
import { startCarriageRelay } from "../src/carriage-relay.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { AUDIENCE, handDeadlines, presenter, world } from "../../lararium-mesh/tests/face-gate-fixture.js";

const group = "b".repeat(64);
const entry = { body: { entry: "intent" } } as unknown as SignedIntentEntry;
const image = new TextEncoder().encode("admission after restart");
let seat: SeatedScratchCustody | null = null;
const closing: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of closing.splice(0)) await close(); if (seat) { await seat.drop(); seat = null; } });

async function rig() {
  const server = faceGateServer();
  const http = createServer();
  http.on("upgrade", (req, socket, head) => { if (!server.handleUpgrade(req, socket, head)) socket.destroy(); });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  closing.push(async () => { server.close(); await new Promise<void>((resolve) => http.close(() => resolve())); });
  const port = (http.address() as { port: number }).port;
  const log: string[] = [];
  const deadlines = handDeadlines();
  const stand = (faces: (g: string) => Promise<{ group: string; admit: () => Promise<{ status: "admitted"; receipt: unknown }> } | null>) =>
    standIntentRelay({ gateServer: server, rootDoor: custodyGateDoor(), deadlines, faces, log: (message) => log.push(message) });
  const face = async (g: string) => g === group ? { group: g, admit: async () => ({ status: "admitted" as const, receipt: { signature: await signAsIntentRelay(image) } }) } : null;
  const dial = (service: IntentRelayService) => wsDialSocket(`ws://127.0.0.1:${port}${service.pinOf(group)!.route}`, (url, protocols) => new WebSocket(url, protocols, { perMessageDeflate: false }) as unknown as WsLike);
  return { server, stand, face, dial, log, deadlines, base: `ws://127.0.0.1:${port}` };
}

describe("the per-face relay service", () => {
  test("RED: absent enablement stands no path; CONTROL: enable stands and disable removes the path", async () => {
    seat = await seatScratchCustody("relay-off");
    const r = await rig();
    const service = await r.stand(r.face);
    expect(service.standing()).toEqual([]);
    expect(r.server.paths()).toEqual([]);
    const wouldBe = deriveGateBundle(sovereignGateRoot(custodyGateDoor()), utf8Bytes(group), sovereignRoute(INTENT_RELAY_ROUTE));
    const attempt = await new Promise<string>((resolve) => {
      const socket = new WebSocket(`${r.base}${gatePath(wouldBe.pin)}`);
      socket.on("open", () => { socket.terminate(); resolve("opened"); });
      socket.on("error", () => resolve("refused"));
      socket.on("unexpected-response", () => resolve("refused"));
    });
    expect(attempt).toBe("refused");
    wouldBe.drop();
    const pin = await service.enable(group);
    expect(pin.route).toBe("/ws/intent-relay");
    expect(r.server.paths()).toHaveLength(1);
    expect((await dialIntentRelay({ pin, socket: r.dial(service), entry })).status).toBe("admitted");
    await service.disable(group);
    expect(r.server.paths()).toEqual([]);
    service.close();
  });

  test("RED: a throwing face does not stop the next face; CONTROL: the next enabled face stands", async () => {
    seat = await seatScratchCustody("relay-skip");
    await enableIntentRelayFace("a".repeat(64)); await enableIntentRelayFace(group);
    const r = await rig();
    const service = await r.stand(async (g) => { if (g.startsWith("a")) throw new Error("face lookup failed"); return r.face(g); });
    expect(r.log.some((message) => message.includes("skipped face"))).toBe(true);
    expect(service.standing().map((row) => row.group)).toEqual([group]);
    service.close();
  });

  test("RED: locked custody stands no relay path and says so once; CONTROL: unlock stands the enabled face", async () => {
    seat = await seatScratchCustody("relay-locked");
    await enableIntentRelayFace(group);
    const r = await rig();
    await seat.holder.lock();
    const closed = await r.stand(r.face);
    await closed.refresh();
    expect(closed.standing()).toEqual([]);
    expect(r.server.paths()).toEqual([]);
    expect(r.log.filter((message) => message.includes("custody stays locked"))).toHaveLength(1);
    closed.close();
    await seat.holder.adopt(seat.treeKey);
    const opened = await r.stand(r.face);
    expect(opened.standing()).toHaveLength(1);
    opened.close();
  });

  test("RED: disable survives restart; CONTROL: enabled face admits after restart under its own public key", async () => {
    seat = await seatScratchCustody("relay-restart");
    const r = await rig();
    const first = await r.stand(r.face);
    await first.enable(group); first.close();
    const restarted = await r.stand(r.face);
    expect(restarted.standing()).toHaveLength(1);
    const result = await dialIntentRelay({ pin: restarted.pinOf(group), socket: r.dial(restarted), entry });
    expect(result.status).toBe("admitted");
    if (result.status !== "admitted") throw new Error("relay did not admit");
    const key = await intentRelayPublicKey();
    const publicKey = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: Buffer.from(key, "hex").toString("base64url") }, format: "jwk" });
    expect(verify(null, image, publicKey, Buffer.from((result.receipt as { signature: string }).signature, "hex"))).toBe(true);
    restarted.close(); await disableIntentRelayFace(group);
    const closed = await r.stand(r.face);
    expect(closed.standing()).toEqual([]);
    closed.close();
  });

  test("RED: the relay route cannot replace the sync route; CONTROL: both gates answer on one server", async () => {
    seat = await seatScratchCustody("relay-sync");
    const r = await rig();
    const registry = gateSessionRegistry(() => {});
    const sync = await world({ sessions: registry.table });
    const person = await presenter(sync, "sync beside relay");
    r.server.stand({ gate: sync.gate, pin: sync.pin });
    const relay = await r.stand(r.face);
    const relayPin = await relay.enable(group);
    expect(relayPin.route).not.toBe(sync.pin.route);
    expect(r.server.paths()).toHaveLength(2);
    const syncSocket = wsDialSocket(`${r.base}${sync.pin.route}`, (url, protocols) => new WebSocket(url, protocols, { perMessageDeflate: false }) as unknown as WsLike);
    const read = await dialFaceGate({ pin: sync.pin, tier: sync.pin.tier, socket: syncSocket, audience: AUDIENCE, certificate: person.certificate, signer: person.signer, arm: person.arm, history: person.history, deadlines: handDeadlines() });
    expect(read.state).toBe("verified");
    syncSocket.close();
    expect((await dialIntentRelay({ pin: relayPin, socket: r.dial(relay), entry })).status).toBe("admitted");
    relay.close(); sync.bundle.drop();
  });

  test("RED: the carriage relay retains its own port and public key; CONTROL: intent admission signs under its separate key", async () => {
    seat = await seatScratchCustody("relay-carriage");
    const r = await rig();
    const relay = await r.stand(r.face);
    await relay.enable(group);
    const seed = openRelayGateSeed();
    try {
      const carriage = await startCarriageRelay({ gateSeed: seed, port: 0 });
      try {
        expect(carriage.port).toBeGreaterThan(0);
        expect(carriage.gatePubKey).not.toBe(await intentRelayPublicKey());
        expect((await dialIntentRelay({ pin: relay.pinOf(group), socket: r.dial(relay), entry })).status).toBe("admitted");
      } finally { await carriage.close(); }
    } finally { seed.fill(0); relay.close(); }
  });
  test("RED: overlapping refreshes stand one path; CONTROL: the same face stands once and answers", async () => {
    seat = await seatScratchCustody("relay-overlap");
    const r = await rig();
    const service = await r.stand(r.face);
    await intentRelayKeyOrMint();
    await enableIntentRelayFace(group);
    await Promise.all([service.refresh(), service.refresh(), service.refresh()]);
    expect(r.server.paths()).toHaveLength(1);
    expect(service.standing()).toHaveLength(1);
    expect((await dialIntentRelay({ pin: service.pinOf(group)!, socket: r.dial(service), entry })).status).toBe("admitted");
    service.close();
  });
});


describe("the relay service keeps its stands owned", () => {
  const second = "c".repeat(64);
  const facesOf = (...groups: string[]) => async (g: string) => groups.includes(g) ? { group: g, admit: async () => ({ status: "refused" as const, refusal: "fault" as const }) } : null;
  test("RED: a failed registration for one face stands nothing orphaned and leaves the other face tracked; CONTROL: a working dispatcher stands both", async () => {
    seat = await seatScratchCustody("relay-owned");
    const r = await rig();
    await intentRelayKeyOrMint(); await enableIntentRelayFace(group); await enableIntentRelayFace(second);
    let calls = 0, broken = true;
    const dispatcher = { registerUpgrade: () => { if (broken && ++calls === 2) throw new Error("registration failed"); return () => {}; } } as never;
    const service = await standIntentRelay({ gateServer: r.server, dispatcher, rootDoor: custodyGateDoor(), deadlines: r.deadlines, faces: facesOf(group, second), log: (m) => r.log.push(m) });
    expect(service.standing().map((s) => s.group)).toEqual([group]);
    expect(r.server.paths()).toHaveLength(1);
    broken = false;
    await service.refresh();
    expect(service.standing().map((s) => s.group).sort()).toEqual([group, second].sort());
    expect(r.server.paths()).toHaveLength(2);
    service.close();
    expect(r.server.paths()).toEqual([]);
  });

  test("RED: a close during face resolution leaves no route standing; CONTROL: the same sweep keeps its route when no close arrives", async () => {
    seat = await seatScratchCustody("relay-close");
    const r = await rig();
    await intentRelayKeyOrMint(); await enableIntentRelayFace(group);
    for (const closeMidway of [false, true]) {
      let release!: () => void, resolving!: () => void, slow = false;
      const held = new Promise<void>((resolve) => { release = resolve; });
      const started = new Promise<void>((resolve) => { resolving = resolve; });
      const service = await standIntentRelay({ gateServer: r.server, rootDoor: custodyGateDoor(), deadlines: r.deadlines, faces: async (g) => { if (slow) { resolving(); await held; } return facesOf(group)(g); }, log: (m) => r.log.push(m) });
      expect(r.server.paths()).toHaveLength(1);
      slow = true;
      const refreshing = service.refresh();
      await started;
      if (closeMidway) service.close();
      release();
      await refreshing;
      expect(r.server.paths()).toHaveLength(closeMidway ? 0 : 1);
      service.close();
      expect(r.server.paths()).toEqual([]);
    }
  });

  test("RED: the caller owns the service before its first sweep, so a close while one face's read stalls leaves no route, and the next stand stands its gate; CONTROL: an unstalled stand and close, then the next stand", async () => {
    // Train t3's Sol read (MEDIUM): the first sweep stood one face's route while it awaited another face, and the caller held
    // no service to close until that sweep ended. A stalled read left the route owned past the teardown, and the next
    // composition's stand of that face read "a gate already stands".
    seat = await seatScratchCustody("relay-own-first");
    const r = await rig();
    await intentRelayKeyOrMint(); await enableIntentRelayFace(group); await enableIntentRelayFace(second);
    for (const stall of [false, true]) {
      let release!: () => void, stalled!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      const reached = new Promise<void>((resolve) => { stalled = resolve; });
      let owned: IntentRelayService | null = null;
      const standing = standIntentRelay({
        gateServer: r.server, rootDoor: custodyGateDoor(), deadlines: r.deadlines, log: (m) => r.log.push(m),
        faces: async (g) => { if (stall && g === second) { stalled(); await held; } return facesOf(group, second)(g); },
        onStand: (service: IntentRelayService) => { owned = service; },
      } as Parameters<typeof standIntentRelay>[0]);
      if (stall) {
        await reached;                                             // the first face's route stands; the second face's read stalls
        expect(r.server.paths()).toHaveLength(1);
        (owned as IntentRelayService | null)?.close();             // the teardown, mid-sweep
        expect(r.server.paths(), "a route outlived the teardown that met a stalled sweep").toEqual([]);
        release();
      }
      const service = await standing;
      service.close();
      expect(r.server.paths()).toEqual([]);
      // The next composition's stand stands every enabled face's gate, none "already" standing.
      const next = await standIntentRelay({ gateServer: r.server, rootDoor: custodyGateDoor(), deadlines: r.deadlines, faces: facesOf(group, second), log: (m) => r.log.push(m) });
      expect(next.standing().map((s) => s.group).sort()).toEqual([group, second].sort());
      next.close();
    }
  });

  test("RED: a locked face's route closes on the refresh the lock sets off and a dial refuses; CONTROL: the other face's relay keeps admitting", async () => {
    seat = await seatScratchCustody("relay-lock");
    const r = await rig();
    await intentRelayKeyOrMint(); await enableIntentRelayFace(group); await enableIntentRelayFace(second);
    let locked = false;
    const admit = async () => ({ status: "admitted" as const, receipt: { signature: await signAsIntentRelay(image) } });
    const service = await standIntentRelay({ gateServer: r.server, rootDoor: custodyGateDoor(), deadlines: r.deadlines, faces: async (g) => g === second && locked ? null : { group: g, admit }, log: (m) => r.log.push(m) });
    const pinOne = service.pinOf(group)!, pinTwo = service.pinOf(second)!;
    const dial = (pin: typeof pinOne) => dialIntentRelay({ pin, entry, socket: wsDialSocket(`${r.base}${pin.route}`, (url, protocols) => new WebSocket(url, protocols, { perMessageDeflate: false }) as unknown as WsLike) });
    expect((await dial(pinTwo)).status).toBe("admitted");
    locked = true;
    await service.refresh();
    expect(service.standing().map((s) => s.group)).toEqual([group]);
    expect(await dial(pinTwo).then((x) => x.status, () => "refused")).not.toBe("admitted");
    expect((await dial(pinOne)).status).toBe("admitted");
    service.close();
  });
});
