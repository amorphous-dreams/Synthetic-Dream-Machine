/**
 * lar-ws-client-adapter, THE FLOOR PIN SET over the sovereign session (house ruling "The admit's gate pin", carrier (a)).
 *
 * Once the sovereign crossing verified, the hearth sends one sealed "session" message of kind `hearth/floor-pins`. The
 * crossing is the authenticated relation, so the leaf files the set in its pair index under the hearth it dialed, at
 * floor tier, one per route.
 *
 *   S1  CONTROL: a set at the dialed Nexus files: the flow's floor pin reads back at (hearth, nexus, "/flow", floor)
 *   S2  RED: a set naming another Nexus files nothing
 *   S3  RED: a set holding a sovereign pin files nothing (floor routes take floor pins only)
 *   S4  RED: a body with a stray key files nothing; a set before the crossing verified cannot arrive (no channel)
 *   S5  RED: an index with no `put` (a read-only index) hears the set and files nothing, with no throw
 *   S6  RED: the same set under another session kind files nothing: only the hearth's floor-pin message files
 *   S7  CONTROL/POSITIVE: a set with a floor pin claim files through the claim door, and the hearth's rotated successor
 *       claim re-files LIVE over the same crossing (the first claim over the authenticated crossing adopts the AID)
 *   S8  RED: a claim of another place AID, a stale (rollback) claim and a claim whose rows do not fold file nothing
 */
import { cbor } from "@automerge/automerge-repo/slim";
import type { PeerId } from "@automerge/automerge-repo";
import { describe, expect, it } from "vitest";
import { utf8Bytes } from "../src/crypto.js";
import { deriveGateBundle, floorGateRoot, floorKeyDoor, floorRoute, type GateBundlePin } from "../src/gate-bundle.js";
import { mkLarSessionMsg } from "../src/leaf-presentation.js";
import { HEARTH_FLOOR_PINS_SESSION_KIND, hearthFloorPinsBody } from "../src/hearth-floor-pins.js";
import { dialGate, faceGateRig, type FaceGateRig } from "./gate-dial-fixture.js";
import { claimAt, foundPlace, headOf, rotatePlace, rowsOf } from "./place-claim-fixture.js";

const PEER = "leaf-floor-pins" as PeerId;
const floorPinAt = (nexus: string, route = "/flow", tag = 8): GateBundlePin => {
  const bundle = deriveGateBundle(floorGateRoot(floorKeyDoor({ derive: () => new Uint8Array(32).fill(tag) })), utf8Bytes(nexus), floorRoute(route));
  try { return bundle.pin; } finally { bundle.drop(); }
};
const turns = async (): Promise<void> => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); };

async function crossed(rig: FaceGateRig, over: Parameters<FaceGateRig["adapterOptions"]>[0] = {}) {
  const adapter = dialGate(rig.adapterOptions(over));
  const heard: string[] = [];
  adapter.onSession((msg) => heard.push(msg.kind));
  adapter.connect(PEER);
  const channel = await rig.nextChannel();
  await channel.recv();
  channel.send("sync", cbor.encode({ type: "peer", senderId: "gate-peer", peerMetadata: {}, selectedProtocolVersion: "1" }));
  const sendSession = async (body: unknown, kind = HEARTH_FLOOR_PINS_SESSION_KIND): Promise<void> => {
    channel.send("session", utf8Bytes(JSON.stringify(mkLarSessionMsg(kind, body))));
    await turns();
  };
  return { adapter, sendSession, heard };
}
const flowKey = (rig: FaceGateRig) => ({ hearth: rig.hearth, nexus: rig.w.pin.nexus, route: "/flow", tier: "floor" as const });

describe("the hearth's floor pin set over the sovereign session", () => {
  it("S1 CONTROL: a set at the dialed Nexus files the flow's floor pin under the dialed hearth", async () => {
    const rig = await faceGateRig();
    const { adapter, sendSession, heard } = await crossed(rig);
    expect(rig.pins.get(flowKey(rig))).toBeNull();
    const flow = floorPinAt(rig.w.nexus);
    await sendSession(hearthFloorPinsBody([flow, floorPinAt(rig.w.nexus, "/shelf")]));
    expect(rig.pins.get(flowKey(rig))).toEqual(flow);
    expect(rig.pins.get({ ...flowKey(rig), route: "/shelf" })).not.toBeNull();
    expect(heard).toEqual([HEARTH_FLOOR_PINS_SESSION_KIND]);
    adapter.disconnect();
  });

  it("S2 RED: a set naming another Nexus files nothing", async () => {
    const rig = await faceGateRig();
    const { adapter, sendSession } = await crossed(rig);
    await sendSession(hearthFloorPinsBody([floorPinAt("nexus-b.elsewhere")]));
    expect(rig.pins.size).toBe(1);                       // the sovereign pin alone
    adapter.disconnect();
  });

  it("S3 RED: a set holding a sovereign pin files nothing", async () => {
    const rig = await faceGateRig();
    const { adapter, sendSession } = await crossed(rig);
    await sendSession(hearthFloorPinsBody([floorPinAt(rig.w.nexus), rig.w.pin]));
    expect(rig.pins.get(flowKey(rig))).toBeNull();
    expect(rig.pins.size).toBe(1);
    adapter.disconnect();
  });

  it("S4 RED: a body with a stray key files nothing", async () => {
    const rig = await faceGateRig();
    const { adapter, sendSession } = await crossed(rig);
    await sendSession({ pins: [floorPinAt(rig.w.nexus)], extra: true });
    await sendSession([floorPinAt(rig.w.nexus)]);
    expect(rig.pins.get(flowKey(rig))).toBeNull();
    adapter.disconnect();
  });

  it("S5 RED: a read-only index hears the set and files nothing, with no throw", async () => {
    const rig = await faceGateRig();
    const readOnly = { get: (key: Parameters<typeof rig.pins.get>[0]) => rig.pins.get(key) };
    const { adapter, sendSession, heard } = await crossed(rig, { pins: readOnly });
    await sendSession(hearthFloorPinsBody([floorPinAt(rig.w.nexus)]));
    expect(rig.pins.get(flowKey(rig))).toBeNull();
    expect(heard).toEqual([HEARTH_FLOOR_PINS_SESSION_KIND]);
    adapter.disconnect();
  });

  it("S6 RED: the same set under another session kind files nothing", async () => {
    const rig = await faceGateRig();
    const { adapter, sendSession, heard } = await crossed(rig);
    await sendSession(hearthFloorPinsBody([floorPinAt(rig.w.nexus)]), "hosting/grant");
    expect(rig.pins.get(flowKey(rig))).toBeNull();
    expect(heard).toEqual(["hosting/grant"]);
    adapter.disconnect();
  });

  it("S7 CONTROL/POSITIVE: a claim set files through the claim door; the rotated successor re-files live; the superseded pin leaves", async () => {
    const rig = await faceGateRig();
    const { adapter, sendSession } = await crossed(rig);
    const p0 = foundPlace(1), p1 = rotatePlace(p0);
    const flow0 = floorPinAt(rig.w.nexus, "/flow", 8), flow1 = floorPinAt(rig.w.nexus, "/flow", 9);
    await sendSession(hearthFloorPinsBody([flow0], { claims: [await claimAt(p0, flow0)], kel: p0.chain as never }));
    expect(rig.pins.get(flowKey(rig))).toEqual(flow0);
    expect(rig.pins.standingOf(flowKey(rig))).toMatchObject({ aid: p0.aid, seq: 0 });
    await sendSession(hearthFloorPinsBody([flow1], { claims: [await claimAt(p1, flow1)], kel: p1.chain as never }));
    expect(rig.pins.get(flowKey(rig))).toEqual(flow1);
    expect(rig.pins.standingOf(flowKey(rig))).toMatchObject({ aid: p0.aid, seq: 1, head: headOf(p1).headDigest });
    adapter.disconnect();
  });

  it("S8 RED: another place's claim, a stale claim and a claim whose rows do not fold file nothing", async () => {
    const rig = await faceGateRig();
    const { adapter, sendSession } = await crossed(rig);
    const p0 = foundPlace(1), p1 = rotatePlace(p0), stranger = foundPlace(2);
    const flow0 = floorPinAt(rig.w.nexus, "/flow", 8), flow1 = floorPinAt(rig.w.nexus, "/flow", 9), foreign = floorPinAt(rig.w.nexus, "/flow", 3);
    await sendSession(hearthFloorPinsBody([flow1], { claims: [await claimAt(p1, flow1)], kel: p1.chain as never }));
    expect(rig.pins.get(flowKey(rig))).toEqual(flow1);
    await sendSession(hearthFloorPinsBody([foreign], { claims: [await claimAt(stranger, foreign)], kel: stranger.chain as never }));
    expect(rig.pins.get(flowKey(rig))).toEqual(flow1);                        // the adopted AID anchors the crossing
    await sendSession(hearthFloorPinsBody([flow0], { claims: [await claimAt(p0, flow0)], kel: rowsOf(p0) as never }));
    expect(rig.pins.get(flowKey(rig))).toEqual(flow1);                        // a rollback
    await sendSession(hearthFloorPinsBody([flow1], { claims: [await claimAt(p1, flow1)], kel: [] as never }));
    expect(rig.pins.get(flowKey(rig))).toEqual(flow1);                        // rows that do not fold
    adapter.disconnect();
  });
});
