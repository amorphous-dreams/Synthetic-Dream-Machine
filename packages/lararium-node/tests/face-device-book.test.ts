/**
 * face-device-book — the D4 binding off this vessel's own records: its own certificates map to its own key, and
 * the root holder's issued book maps each certificate it issued to the device the signed answer named.
 *
 * Proven, each with its control:
 *   · the founder's own certificate maps to the founder's own vessel key; an issued certificate maps to the
 *     joinee's device / RED: a key no carrier names reads unbound, at another Nexus or under another face too;
 *   · RED: one key two carriers map to two devices reads ambiguous / CONTROL: the same device twice reads it;
 *   · RED: before the first refresh, and after a refresh that failed, every presenter reads unbound;
 *   · a refresh asked later decides over one asked earlier that settles after it;
 *   · through the shadow ring: the joinee's mapped device decides `fleetAside`, and an unbound one reads aside.
 */
import { describe, expect, test } from "vitest";
import type { FaceScope, VesselFaceKey } from "@lararium/mesh";
import { faceDeviceBook, faceDeviceBindings } from "../src/face-device-book.js";
import { gateShadowRing } from "../src/gate-shadow-ring.js";
import type { FaceJoinRecord } from "../src/fleet-join-custody.js";

const FACE = "fa".repeat(32), NEXUS = "nexus-a.synthetic";
const FOUNDER = "f0".repeat(32), JOINEE = "10".repeat(32), OTHER = "20".repeat(32);
const FOUNDER_VFK = "a1".repeat(32), JOINEE_VFK = "b2".repeat(32), STRAY_VFK = "c3".repeat(32);
const scope = { faceKey: FACE, nexus: NEXUS } as FaceScope;
const at = (vesselFaceKey: string, s: FaceScope = scope) => ({ scope: s, vesselFaceKey: vesselFaceKey as VesselFaceKey });

const record = (issued: FaceJoinRecord["issued"] = []): FaceJoinRecord => ({
  personaGroup: "0xb7f1c2a9d4e60381", rootKey: "ee".repeat(32),
  certificates: [{ scope, vesselFaceKey: FOUNDER_VFK, signature: "00".repeat(64) }],
  grants: [], issued,
});
const issuedTo = (device: string, vesselFaceKey = JOINEE_VFK) => ({ nexus: NEXUS, faceKey: FACE, vesselFaceKey, device });

async function bookOver(records: FaceJoinRecord[], own = FOUNDER) {
  const book = faceDeviceBook({ records: async () => records, ownVesselKey: async () => own });
  await book.refresh();
  return book;
}

describe("the face device book", () => {
  test("own certificates map to this vessel; issued ones to their device; RED: an unnamed key reads unbound", async () => {
    const book = await bookOver([record([issuedTo(JOINEE)])]);
    expect(book.deviceOf(at(FOUNDER_VFK))).toEqual({ device: FOUNDER });
    expect(book.deviceOf(at(JOINEE_VFK))).toEqual({ device: JOINEE });
    expect(book.deviceOf(at(STRAY_VFK))).toEqual({ unreadable: "face-device-unbound" });
    expect(book.deviceOf(at(JOINEE_VFK, { faceKey: FACE, nexus: "nexus-b.synthetic" } as FaceScope))).toEqual({ unreadable: "face-device-unbound" });
    expect(book.deviceOf(at(JOINEE_VFK, { faceKey: "fb".repeat(32), nexus: NEXUS } as FaceScope))).toEqual({ unreadable: "face-device-unbound" });
  });

  test("RED: one key mapped to two devices reads ambiguous; CONTROL: the same device twice reads it", async () => {
    expect((await bookOver([record([issuedTo(JOINEE), issuedTo(OTHER)])])).deviceOf(at(JOINEE_VFK))).toEqual({ unreadable: "face-device-ambiguous" });
    expect((await bookOver([record([issuedTo(JOINEE), issuedTo(JOINEE)])])).deviceOf(at(JOINEE_VFK))).toEqual({ device: JOINEE });
    // An issued entry naming the founder's own key to another device makes the founder's own key ambiguous too.
    expect(faceDeviceBindings([record([issuedTo(OTHER, FOUNDER_VFK)])], FOUNDER).get(`${NEXUS}\n${FACE}\n${FOUNDER_VFK}`)).toBeNull();
  });

  test("RED: unbound before the first refresh and after one that failed", async () => {
    let fail = false;
    const book = faceDeviceBook({ records: async () => { if (fail) throw new Error("locked"); return [record([issuedTo(JOINEE)])]; }, ownVesselKey: async () => FOUNDER });
    expect(book.deviceOf(at(JOINEE_VFK))).toEqual({ unreadable: "face-device-unbound" });
    await book.refresh();
    expect(book.deviceOf(at(JOINEE_VFK))).toEqual({ device: JOINEE });          // CONTROL
    fail = true;
    await expect(book.refresh()).rejects.toThrow("locked");
    expect(book.deviceOf(at(JOINEE_VFK))).toEqual({ unreadable: "face-device-unbound" });
  });

  test("a refresh asked later decides over an earlier one that settles after it", async () => {
    const gates: Array<(r: FaceJoinRecord[]) => void> = [];
    const book = faceDeviceBook({ records: () => new Promise((r) => gates.push(r)), ownVesselKey: async () => FOUNDER });
    const first = book.refresh(), second = book.refresh();
    gates[1]!([record([issuedTo(JOINEE)])]);
    await second;
    gates[0]!([record([])]);
    await first;
    expect(book.deviceOf(at(JOINEE_VFK))).toEqual({ device: JOINEE });
  });

  test("through the shadow ring: the mapped device decides fleetAside; an unbound presenter reads aside", async () => {
    const book = await bookOver([record([issuedTo(JOINEE)])]);
    const asideDevices = new Set<string>();
    const ring = gateShadowRing({ ring: { fold: () => ({ fleets: [], realms: [] }), deviceAside: (d) => asideDevices.has(d) }, deviceOf: (p) => book.deviceOf(p) });
    expect(ring.consult(at(JOINEE_VFK))).toEqual({ aside: false, fleetAside: false });
    expect(ring.consult(at(STRAY_VFK))).toEqual({ aside: false, fleetAside: true });
    asideDevices.add(JOINEE);
    expect(ring.consult(at(JOINEE_VFK))).toEqual({ aside: false, fleetAside: true });
    expect(ring.consult(at(FOUNDER_VFK))).toEqual({ aside: false, fleetAside: false });
  });
});
