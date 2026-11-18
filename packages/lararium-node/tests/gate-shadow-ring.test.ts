/**
 * gate-shadow-ring.test.ts — D4, "a device set aside", at the ring a face gate consults (`face-gate`
 * `GateShadowRing`): the presenter's face key maps to its certified device edge, and the fleet edge's shadow over
 * that device edge decides whether the presenter may sort same-operator.
 *
 * Proven, each with its control:
 *   · RED: before the edge ring's first fold every presenter reads aside and fleet-aside, and every place aside /
 *     CONTROL: after the fold a mapped, unshadowed device reads clear;
 *   · RED: a mapping that reads unreadable, or throws, reads fleet-aside: the gate refuses same-operator while the
 *     mapping is unreadable / CONTROL: a mapped device reads clear;
 *   · RED: a shadow over the device edge sets every face that device wears fleet-aside (two faces, one device) /
 *     CONTROL: a face on another device reads clear;
 *   · the production mapping stands unbound until the certificate issue keeps the binding: it reads every
 *     presenter unreadable, so no presenter sorts same-operator.
 */
import { describe, expect, test } from "vitest";
import type { FaceScope, VesselFaceKey } from "@lararium/mesh";
import { gateShadowRing, faceDevicesUnbound, type FaceDeviceReading } from "../src/gate-shadow-ring.js";

const scope = (faceKey: string): FaceScope => ({ faceKey, nexus: "nexus-n" }) as FaceScope;
const vfk = (byte: string) => byte.repeat(32) as VesselFaceKey;
const PHONE = "51".repeat(32), LAPTOP = "53".repeat(32);

function edgeRing() {
  const state = { folded: false, aside: new Set<string>() };
  return {
    state,
    ring: { fold: () => (state.folded ? { fleets: [], realms: [] } : null), deviceAside: (device: string) => !state.folded || state.aside.has(device) },
  };
}
const map = (pairs: Record<string, string>) => (p: { vesselFaceKey: VesselFaceKey }): FaceDeviceReading =>
  pairs[p.vesselFaceKey] !== undefined ? { device: pairs[p.vesselFaceKey]! } : { unreadable: "face-device-unbound" };

describe("D4 — the gate's shadow ring", () => {
  test("RED: before the first fold every presenter and every place reads aside; CONTROL: after it a mapped device reads clear", () => {
    const { state, ring } = edgeRing();
    const gate = gateShadowRing({ ring, deviceOf: map({ [vfk("a1")]: PHONE }) });
    expect(gate.consult({ scope: scope("f1"), vesselFaceKey: vfk("a1") })).toEqual({ aside: true, fleetAside: true });
    expect(gate.consultPlace({ nexus: "nexus-n" as never, placeKey: "p" })).toEqual({ aside: true });
    state.folded = true;
    expect(gate.consult({ scope: scope("f1"), vesselFaceKey: vfk("a1") })).toEqual({ aside: false, fleetAside: false });
    expect(gate.consultPlace({ nexus: "nexus-n" as never, placeKey: "p" })).toEqual({ aside: false });
  });

  test("RED: an unreadable mapping, or one that throws, reads fleet-aside; CONTROL: a mapped device reads clear", () => {
    const { state, ring } = edgeRing();
    state.folded = true;
    const unmapped = gateShadowRing({ ring, deviceOf: map({}) });
    expect(unmapped.consult({ scope: scope("f1"), vesselFaceKey: vfk("a1") })).toEqual({ aside: false, fleetAside: true });
    const throwing = gateShadowRing({ ring, deviceOf: () => { throw new Error("a mapping that fails"); } });
    expect(throwing.consult({ scope: scope("f1"), vesselFaceKey: vfk("a1") })).toEqual({ aside: false, fleetAside: true });
    const torn = gateShadowRing({ ring, deviceOf: () => ({ device: "" }) });
    expect(torn.consult({ scope: scope("f1"), vesselFaceKey: vfk("a1") })).toEqual({ aside: false, fleetAside: true });
    const mapped = gateShadowRing({ ring, deviceOf: map({ [vfk("a1")]: PHONE }) });
    expect(mapped.consult({ scope: scope("f1"), vesselFaceKey: vfk("a1") })).toEqual({ aside: false, fleetAside: false });
  });

  test("RED: a shadow over one device edge sets aside every face that device wears; CONTROL: another device's face reads clear", () => {
    const { state, ring } = edgeRing();
    state.folded = true;
    const gate = gateShadowRing({ ring, deviceOf: map({ [vfk("a1")]: PHONE, [vfk("a2")]: PHONE, [vfk("b1")]: LAPTOP }) });
    const faceOne = { scope: scope("f1"), vesselFaceKey: vfk("a1") }, faceTwo = { scope: scope("f2"), vesselFaceKey: vfk("a2") };
    const other = { scope: scope("f1"), vesselFaceKey: vfk("b1") };
    for (const p of [faceOne, faceTwo, other]) expect(gate.consult(p).fleetAside).toBe(false);
    state.aside.add(PHONE);
    expect(gate.consult(faceOne)).toEqual({ aside: false, fleetAside: true });
    expect(gate.consult(faceTwo)).toEqual({ aside: false, fleetAside: true });
    expect(gate.consult(other)).toEqual({ aside: false, fleetAside: false });
  });

  test("the production mapping stands unbound: every presenter reads unreadable", () => {
    const deviceOf = faceDevicesUnbound();
    expect(deviceOf({ scope: scope("f1"), vesselFaceKey: vfk("a1") })).toEqual({ unreadable: "face-device-unbound" });
    const { state, ring } = edgeRing();
    state.folded = true;
    expect(gateShadowRing({ ring, deviceOf }).consult({ scope: scope("f1"), vesselFaceKey: vfk("a1") }).fleetAside).toBe(true);
  });
});
