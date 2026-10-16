/**
 * lar-ws-client-adapter, READINESS and the stuck dial — automerge's Repo waits on every adapter's `whenReady` before it
 * lets a document settle unavailable, so an adapter that never readies holds every find of an absent document forever.
 *
 *   R1  RED: a pin the index does not hold anergizes pin-absent, and the adapter READIES (the Repo may settle)
 *   R2  RED: a dial that meets silence readies too: the leaf is idle until its parent re-dials
 *   R3  RED: a pin index that THROWS (a Nexus spelled as the AID text, say) leaves no crossing in CONNECTING: the leaf
 *       anergizes `pin-unreadable`, readies, and a re-presentation dials again
 *   R4  CONTROL: before any connect the adapter is not ready; a verified crossing readies on the gate's peer
 *   R5  RED: messages that arrive after disconnect() are dropped, with no throw (the parent asserts its socket)
 *   R6  RED: a throw AFTER the dial verified (the pin's key reads as no text at the session's seating) closes the dial
 *       socket it drew, leaves no crossing open, and readies; CONTROL: R4's verified crossing keeps its socket
 */
import { cbor } from "@automerge/automerge-repo/slim";
import type { PeerId } from "@automerge/automerge-repo";
import { describe, expect, it } from "vitest";
import { hearthPinIndex } from "../src/admit-gate-pin.js";
import type { DialSocket } from "../src/face-dial.js";
import { dialGate, faceGateRig } from "./gate-dial-fixture.js";

const PEER = "leaf-ready" as PeerId;
const settled = async (p: Promise<unknown>): Promise<boolean> => {
  let done = false;
  void p.then(() => { done = true; });
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
  return done;
};
/** A dial socket whose upgrade never opens: the far side is gone. */
const deadSocket = (): DialSocket => ({
  open: () => Promise.reject(new Error("no gate here")),
  send: () => undefined, recv: () => Promise.resolve(null), close: () => undefined,
});

describe("LarWSClientAdapter readiness", () => {
  it("R1 RED: pin-absent anergizes and readies", async () => {
    const rig = await faceGateRig();
    const adapter = dialGate(rig.adapterOptions({ pins: hearthPinIndex() }));
    adapter.connect(PEER);
    expect(await settled(adapter.whenReady())).toBe(true);
    expect(adapter.isReady()).toBe(true);
    expect(adapter.anergized).toBe("pin-absent");
    adapter.disconnect();
  });

  it("R2 RED: a dial met by silence readies, the leaf idle until its parent re-dials", async () => {
    const rig = await faceGateRig();
    const adapter = dialGate(rig.adapterOptions({ dialSocket: deadSocket }));
    adapter.connect(PEER);
    expect(await settled(adapter.whenReady())).toBe(true);
    expect(adapter.anergized).toBeNull();               // silence is a transport fault, never an anergy
    adapter.disconnect();
  });

  it("R3 RED: a throwing pin index leaves no crossing in CONNECTING; a re-presentation dials again", async () => {
    const rig = await faceGateRig();
    let throwing = true;
    const pins = { get: (key: Parameters<typeof rig.pins.get>[0]) => { if (throwing) throw new TypeError("the AID text, not the pin's hex"); return rig.pins.get(key); } };
    const adapter = dialGate(rig.adapterOptions({ pins }));
    adapter.connect(PEER);
    expect(await settled(adapter.whenReady())).toBe(true);
    expect(adapter.anergized).toBe("pin-unreadable");
    expect((adapter.socket as unknown as { readyState: number }).readyState).toBe(3);
    expect(rig.sockets).toHaveLength(0);                // no dial socket was drawn, so none is left open
    // CONTROL: the index reads again; the re-presentation crosses.
    throwing = false;
    const candidate = new Promise((resolve) => adapter.once("peer-candidate", resolve));
    adapter.represent(adapter.presentation);
    const channel = await rig.nextChannel();
    await channel.recv();
    channel.send("sync", cbor.encode({ type: "peer", senderId: "gate-peer", peerMetadata: {}, selectedProtocolVersion: "1" }));
    await candidate;
    expect(adapter.anergized).toBeNull();
    adapter.disconnect();
  });

  it("R4 CONTROL: not ready before a connect; a verified crossing readies on the gate's peer", async () => {
    const rig = await faceGateRig();
    const adapter = dialGate(rig.adapterOptions());
    expect(adapter.isReady()).toBe(false);
    expect(await settled(adapter.whenReady())).toBe(false);
    adapter.connect(PEER);
    const channel = await rig.nextChannel();
    await channel.recv();
    expect(adapter.isReady()).toBe(false);              // crossed, and no peer yet
    channel.send("sync", cbor.encode({ type: "peer", senderId: "gate-peer", peerMetadata: {}, selectedProtocolVersion: "1" }));
    expect(await settled(adapter.whenReady())).toBe(true);
    adapter.disconnect();
  });

  it("R5 RED: messages arriving after disconnect are dropped, with no throw", async () => {
    // The race: a frame the channel already handed the leaf's pump, and a disconnect that lands before the pump's turn.
    // Scan the disconnect across the microtasks after the gate's send, so one lands inside that window.
    const errors: unknown[] = [];
    const onError = (e: unknown): void => { errors.push(e); };
    process.on("unhandledRejection", onError);
    process.on("uncaughtException", onError);
    try {
      for (let k = 0; k < 60; k++) {
        const rig = await faceGateRig();
        const adapter = dialGate(rig.adapterOptions());
        adapter.connect(PEER);
        const channel = await rig.nextChannel();
        await channel.recv();
        for (let i = 0; i < 3; i++) channel.send("sync", cbor.encode({ type: "doc-unavailable", senderId: "gate-peer", targetId: PEER, documentId: `doc-${i}` }));
        for (let i = 0; i < k; i++) await Promise.resolve();
        adapter.disconnect();
        for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
      }
      expect(errors).toEqual([]);
    } finally {
      process.off("unhandledRejection", onError);
      process.off("uncaughtException", onError);
    }
  }, 60_000);

  it("R6 RED: a throw after the dial verified closes the dial socket and readies", async () => {
    const rig = await faceGateRig();
    // The pin reads whole for the dial; the adapter's own read of its key, after the verdict, throws.
    let reads = 0;
    const pinOnce = (key: Parameters<typeof rig.pins.get>[0]) => {
      const held = rig.pins.get(key);
      if (held === null) return null;
      const pin = { ...held };
      Object.defineProperty(pin, "signingKey", { enumerable: true, get: () => (++reads === 1 ? held.signingKey : { toLowerCase: () => { throw new Error("torn key"); } }) });
      return pin as typeof held;
    };
    const closed: number[] = [];
    const adapter = dialGate(rig.adapterOptions({
      pins: { get: pinOnce },
      dialSocket: () => {
        const met = rig.adapterOptions().dialSocket!();
        return { ...met, open: met.open.bind(met), send: met.send.bind(met), recv: met.recv.bind(met), close: () => { closed.push(1); met.close(); } };
      },
    }));
    adapter.connect(PEER);
    expect(await settled(adapter.whenReady())).toBe(true);
    expect(reads).toBeGreaterThan(1);                    // the dial verified and the adapter read the key again
    expect(closed.length).toBeGreaterThan(0);
    expect((adapter.socket as unknown as { readyState: number }).readyState).toBe(3);
    expect(adapter.session).toBeNull();
    adapter.disconnect();
  });
});
