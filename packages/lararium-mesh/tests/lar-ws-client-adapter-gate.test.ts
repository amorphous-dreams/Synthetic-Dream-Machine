/**
 * lar-ws-client-adapter on the sealed gate — the leaf transport dials through `dialFaceGate`, holds a `dialedChannel`, and
 * shows automerge's adapter the same socket-shaped surface as before. A real gate (`makeFaceGate` seating channels) stands at
 * the other end, in this process.
 *
 *   A1  CONTROL: a pinned dial crosses; automerge's join frame reaches the gate as a sealed "sync" message; the gate's peer
 *       frame reaches the adapter as a peer-candidate proven under the pinned gate's signing key
 *   A2  session messages ride the same channel both ways, beside sync, and a sync frame never reaches the session listeners
 *   A3  a pin the index does not hold dials nothing and anergizes "pin-absent"
 *   A4  a refusal on this side anergizes by name; a new presentation re-dials and crosses
 *   A5  disconnect closes the channel: the gate reads a peer close
 */
import { cbor } from "@automerge/automerge-repo/slim";
import type { PeerId } from "@automerge/automerge-repo";
import { describe, expect, it } from "vitest";
import { hearthPinIndex } from "../src/admit-gate-pin.js";
import { dialGate, faceGateRig } from "./gate-dial-fixture.js";
import { handDeadlines, presenter } from "./face-gate-fixture.js";

const PEER = "leaf-under-test" as PeerId;
const peerFrame = (): Uint8Array => cbor.encode({ type: "peer", senderId: "gate-peer", peerMetadata: {}, selectedProtocolVersion: "1" });
const once = <T>(register: (resolve: (value: T) => void) => void): Promise<T> => new Promise<T>(register);

describe("LarWSClientAdapter over the sealed gate", () => {
  it("A1 CONTROL: a pinned dial crosses, sync frames ride sealed, and the peer is proven under the gate's signing key", async () => {
    const rig = await faceGateRig();
    const adapter = dialGate(rig.adapterOptions());
    const candidate = once<{ peerId: PeerId }>((resolve) => adapter.once("peer-candidate", resolve));
    adapter.connect(PEER);
    const channel = await rig.nextChannel();
    const join = await channel.recv();
    expect(join?.kind).toBe("sync");
    const decoded = cbor.decode(join!.bytes) as { type: string; senderId: string };
    expect(decoded.type).toBe("join");
    expect(decoded.senderId).toBe(PEER);
    channel.send("sync", peerFrame());
    const { peerId } = await candidate;
    expect(peerId).toBe("gate-peer");
    expect(adapter.provenKeyOf(peerId)).toBe(rig.w.pin.signingKey.toLowerCase());
    expect(adapter.session?.gatePubKey).toBe(rig.w.pin.signingKey.toLowerCase());
    expect(adapter.session?.handshakeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(adapter.anergized).toBeNull();
    adapter.disconnect();
  });

  it("A2 session messages ride the channel both ways, and sync frames never reach the session listeners", async () => {
    const rig = await faceGateRig();
    const adapter = dialGate(rig.adapterOptions());
    const heard: unknown[] = [];
    adapter.onSession((msg) => heard.push(msg));
    const candidate = once((resolve) => adapter.once("peer-candidate", resolve));
    adapter.connect(PEER);
    const channel = await rig.nextChannel();
    await channel.recv();                                   // the join
    channel.send("sync", peerFrame());
    await candidate;
    channel.send("session", new TextEncoder().encode(JSON.stringify({ type: "lar:session", kind: "hosting/mint", body: { n: 1 } })));
    channel.send("session", new TextEncoder().encode(JSON.stringify({ type: "lar:session", kind: "after", body: 2 })));
    expect(adapter.sendSession("walk/ask", { q: 1 })).toBe(true);
    const asked = await channel.recv();
    expect(asked?.kind).toBe("session");
    expect(JSON.parse(new TextDecoder().decode(asked!.bytes))).toEqual({ type: "lar:session", kind: "walk/ask", body: { q: 1 } });
    await once<void>((resolve) => { const off = adapter.onSession((msg) => { if ((msg as { kind: string }).kind === "after") { off(); resolve(); } }); });
    expect(heard).toEqual([
      { type: "lar:session", kind: "hosting/mint", body: { n: 1 } },
      { type: "lar:session", kind: "after", body: 2 },
    ]);
    adapter.disconnect();
  });

  it("A3 a pin the index does not hold dials nothing and anergizes pin-absent", async () => {
    const rig = await faceGateRig();
    const reasons: string[] = [];
    const adapter = dialGate(rig.adapterOptions({ pins: hearthPinIndex(), onAnergy: (r) => reasons.push(r) }));
    adapter.connect(PEER);
    await Promise.resolve();
    expect(adapter.anergized).toBe("pin-absent");
    expect(reasons).toEqual(["pin-absent"]);
    expect(rig.sockets).toHaveLength(0);
    expect(adapter.sendSession("k", 1)).toBe(false);
  });

  it("A4 a refusal on this side anergizes by name, and a new presentation re-dials and crosses", async () => {
    const rig = await faceGateRig();
    const other = await presenter(rig.w, "another face");
    const reasons: string[] = [];
    // This face's certificate with another face's signer: the signer stands under another chain.
    const bad = { certificate: rig.p.certificate, signer: other.signer, arm: rig.p.arm, history: rig.p.history };
    const adapter = dialGate(rig.adapterOptions({ presentation: bad, onAnergy: (r) => reasons.push(r) }));
    const anergy = once<string>((resolve) => { adapter.connect(PEER); const poll = (): void => { if (adapter.anergized !== null) resolve(adapter.anergized); else setImmediate(poll); }; poll(); });
    expect(await anergy).toBe("refused:signer-other-chain");
    expect(reasons).toEqual(["refused:signer-other-chain"]);
    expect(rig.opened).toHaveLength(0);
    const candidate = once((resolve) => adapter.once("peer-candidate", resolve));
    adapter.represent({ certificate: rig.p.certificate, signer: rig.p.signer, arm: rig.p.arm, history: rig.p.history });
    expect(adapter.anergized).toBeNull();
    const channel = await rig.nextChannel();
    await channel.recv();
    channel.send("sync", peerFrame());
    await candidate;
    expect(adapter.session).not.toBeNull();
    adapter.disconnect();
  });

  it("A5 disconnect closes the channel: the gate reads a peer close", async () => {
    const rig = await faceGateRig();
    const adapter = dialGate(rig.adapterOptions());
    const candidate = once((resolve) => adapter.once("peer-candidate", resolve));
    adapter.connect(PEER);
    const channel = await rig.nextChannel();
    await channel.recv();
    channel.send("sync", peerFrame());
    await candidate;
    adapter.disconnect();
    expect(await channel.recv()).toBeNull();
    expect(channel.closedBy).toBe("peer-close");
    expect(adapter.session).toBeNull();
  });

  it("A6 a gate that refuses says nothing: the dial's deadline lapses, the socket closes, and the leaf does not anergize", async () => {
    const rig = await faceGateRig();
    rig.w.held = null;                                       // the gate holds no root to read the admit under: it draws silence
    const dialDeadlines = handDeadlines();
    const adapter = dialGate(rig.adapterOptions({ deadlines: dialDeadlines }));
    adapter.connect(PEER);
    const crossing = adapter.socket as unknown as { readyState: number };
    while ((rig.sockets[0]?.log.toGate.length ?? 0) === 0) await new Promise((r) => setImmediate(r));
    for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r));
    expect(crossing.readyState).toBe(0);
    dialDeadlines.fire();
    while (crossing.readyState !== 3) await new Promise((r) => setImmediate(r));
    expect(adapter.anergized).toBeNull();
    expect(adapter.session).toBeNull();
    expect(rig.opened).toHaveLength(0);
    rig.w.deadlines.fire();
    adapter.disconnect();
  });
});
