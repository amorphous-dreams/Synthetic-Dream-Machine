/**
 * flow-read-client — peers prove first at the FLOOR gate, then the reader rule runs.
 *
 * A real floor-tier gate (`makeFaceGate` over a floor world on "/flow", seating channels) plays the peer's flow face:
 * its seat's open hands the channel a script that sends the pointer frame and the snapshot, as the node face will.
 * Every reader pins the gate (from the pair index) and the publisher (out of band).
 */
import { describe, expect, test } from "vitest";
import * as A from "@automerge/automerge";
import { hearthPinIndex } from "../src/admit-gate-pin.js";
import { channelSessionTable, type GateSessionChannel } from "../src/gate-session-channel.js";
import { ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { buildFlowPointer, exportFlowSnapshot, type FlowPointer, type FlowSnapshot } from "../src/flow-substrate.js";
import { FLOW_POINTER_FRAME, FLOW_SOCKET_ROUTE, flowSocketUrl, pullAndVerifyFlow } from "../src/flow-read-client.js";
import { dialSocketTo, gateOver } from "./gate-dial-fixture.js";
import { AUDIENCE, handDeadlines, presenter, world } from "./face-gate-fixture.js";

const SEED  = Uint8Array.from({ length: 32 }, (_, i) => i + 1);     // the publisher's vessel key
const OTHER = Uint8Array.from({ length: 32 }, (_, i) => 200 - i);
const enc = (text: string): Uint8Array => new TextEncoder().encode(text);

async function publish(seed = SEED, text = "the constitution"): Promise<{ snap: FlowSnapshot; ptr: FlowPointer }> {
  const snap = await exportFlowSnapshot(A.from({ tiddlers: { flow: { text } } }));
  return { snap, ptr: await buildFlowPointer({ snapshot: snap, parents: [], signerSeed: seed }) };
}

interface Face {
  readonly ptr?: FlowPointer | null;
  readonly bytes?: Uint8Array;
  readonly snapshotKind?: "session" | "sync" | "none";
  readonly stallAfterPointer?: boolean;
}

async function rig(face: Face, over: { silent?: boolean } = {}) {
  const sent = { pointer: false };
  const w = await world({ tier: "floor", route: FLOW_SOCKET_ROUTE });
  const p = await presenter(w, "flow reader");
  if (over.silent) w.held = null;
  const served = await publish();
  const ptr = face.ptr === undefined ? served.ptr : face.ptr;
  const gate = gateOver(w, channelSessionTable((channel: GateSessionChannel) => {
    if (ptr !== null) channel.send("session", enc(JSON.stringify({ type: FLOW_POINTER_FRAME, pointer: ptr })));
    sent.pointer = ptr !== null;
    if (ptr !== null && !face.stallAfterPointer && face.snapshotKind !== "none") {
      channel.send(face.snapshotKind ?? "session", face.bytes ?? served.snap.bytes);
    }
    if (ptr === null || face.snapshotKind === "none") channel.close();
  }));
  const pins = hearthPinIndex();
  pins.put("hearth-1", w.pin);
  const urls: string[] = [];
  const deadlines = handDeadlines();
  const opts = {
    pins, hearth: "hearth-1", nexus: w.pin.nexus, audience: AUDIENCE, deadlines, verifyingKey: "",
    presentation: { certificate: p.certificate, signer: p.signer, arm: p.arm, history: p.history },
    dialSocket: (url: string) => { urls.push(url); return dialSocketTo(gate).socket; },
  };
  return { sent, w, opts: { ...opts, verifyingKey: await ed25519VerifyingKeyFromSeed(SEED) }, urls, pins, deadlines };
}

describe("flow-read-client over the sealed floor gate", () => {
  test("CONTROL: a pinned dial pulls, verifies and loads the flow; the dial went to the flow route", async () => {
    const r = await rig({});
    const res = await pullAndVerifyFlow<{ tiddlers: Record<string, { text: string }> }>("http://peer:8080", r.opts);
    expect(res.ok, res.reason).toBe(true);
    expect(res.doc?.tiddlers["flow"]?.text).toBe("the constitution");
    expect(r.urls).toEqual([flowSocketUrl("http://peer:8080")]);
    expect(r.urls[0]).toBe("ws://peer:8080/flow");
  });

  test("the snapshot may ride a sync message as well", async () => {
    const r = await rig({ snapshotKind: "sync" });
    expect((await pullAndVerifyFlow("http://peer", r.opts)).ok).toBe(true);
  });

  test("a hearth and Nexus the index holds no floor pin for dial nothing", async () => {
    const r = await rig({});
    const res = await pullAndVerifyFlow("http://peer", { ...r.opts, pins: hearthPinIndex() });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/pin-absent/);
    expect(r.urls).toEqual([]);
  });

  test("a pointer signed by another key than the pinned publisher is rejected", async () => {
    const r = await rig({});
    const res = await pullAndVerifyFlow("http://peer", { ...r.opts, verifyingKey: await ed25519VerifyingKeyFromSeed(OTHER) });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/pointer rejected/);
  });

  test("a face with no pointer yet closes without a message", async () => {
    const r = await rig({ ptr: null });
    const res = await pullAndVerifyFlow("http://peer", r.opts);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("peer published no pointer");
  });

  test("a snapshot whose bytes do not hash to the pointer's cid is refused", async () => {
    const forged = await publish(SEED, "another constitution");
    const r = await rig({ bytes: forged.snap.bytes });
    const res = await pullAndVerifyFlow("http://peer", r.opts);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/hash mismatch/);
  });

  test("a face that sends the pointer and never the snapshot is waited on only until the reader's deadline", async () => {
    const r = await rig({ stallAfterPointer: true });
    const pulling = pullAndVerifyFlow("http://peer", r.opts);
    // The dial's own deadline cancels once it verified; the first wait cancels after the pointer; the second wait stands.
    while (!r.sent.pointer) await new Promise((resolve) => setImmediate(resolve));
    for (let i = 0; i < 16; i++) await new Promise((resolve) => setImmediate(resolve));
    while (r.deadlines.standing < 1) await new Promise((resolve) => setImmediate(resolve));
    r.deadlines.fire();
    const res = await pulling;
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("peer sent no snapshot");
  });

  test("a gate that refuses says nothing: the reader's dial lapses and reads no map", async () => {
    const r = await rig({}, { silent: true });
    const pulling = pullAndVerifyFlow("http://peer", r.opts);
    while (r.deadlines.standing < 1) await new Promise((resolve) => setImmediate(resolve));
    for (let i = 0; i < 4; i++) await new Promise((resolve) => setImmediate(resolve));
    r.deadlines.fire();
    const res = await pulling;
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/dial failed/);
    r.w.deadlines.fire();
  });
});
