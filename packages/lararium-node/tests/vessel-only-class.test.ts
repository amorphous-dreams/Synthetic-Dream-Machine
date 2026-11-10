/**
 * vessel-only-class — the share verdict's vessel-only class reads BY BAG, so the boot window holds.
 *
 * Before the vessel first reads its control document (and while its custody row cannot read), the control document's names
 * stand empty. A device-private document any boot-time source files (a held home, an announced device slot, a catalog row
 * whose bag classifies device-private) still stays on this vessel: a wire peer, sibling or other device reads none of it.
 */
import { describe, expect, test } from "vitest";
import { CONTROL_HOME_ID, SECRET_HOME_ID, daemonFaceCanonBag, emptyLarDoc, makeVesselOnlyDocs, storedLarRecord, wikiBagUri, wikiSlotUri, deviceDaemonDocs, type LarDoc } from "@lararium/mesh";
import { isDevicePrivateBag, vesselOnlyClass, vesselOnlyShareVerdict } from "../src/vessel-only-share.js";

const F1 = "11111111-1111-4111-8111-111111111111";
const ISLANDS = new Set(["island"]);

describe("the vessel-only class reads by bag in the boot window", () => {
  test("device-private bags classify by their own name", () => {
    for (const bag of [wikiSlotUri("daemon", "working"), wikiSlotUri("daemon", "draft"), wikiSlotUri("daemon", "personal"), daemonFaceCanonBag(F1), SECRET_HOME_ID, CONTROL_HOME_ID]) {
      expect(isDevicePrivateBag(bag), bag).toBe(true);
    }
    for (const bag of [wikiSlotUri("lares", "working"), wikiBagUri("daemon"), "lar:///ha.ka.ba/bags/daemon-not-a-relation"]) expect(isDevicePrivateBag(bag), bag).toBe(false);
  });

  test("RED: a device-private document asked during the boot window (the control document not yet read) is refused a wire peer", () => {
    const named = makeVesselOnlyDocs();           // never refreshed: the control document has not been read
    const device = deviceDaemonDocs({ enrollFloor: () => {} });
    device.announced(wikiSlotUri("daemon", "working"), "announced-slot");
    const catalog = emptyLarDoc();
    catalog.tiddlers[daemonFaceCanonBag(F1)] = storedLarRecord(daemonFaceCanonBag(F1), { text: "automerge:canon-doc" }, "test");
    catalog.tiddlers[wikiBagUri("lares")] = storedLarRecord(wikiBagUri("lares"), { text: "automerge:public-doc" }, "test");
    const held = new Set(["floor-slot"]);
    const docs = vesselOnlyClass({ named, held, device, catalog: () => catalog as LarDoc });
    for (const id of ["announced-slot", "canon-doc", "floor-slot"]) {
      expect(vesselOnlyShareVerdict(docs, ISLANDS, "wire", id, true), id).toBe(false);
      expect(vesselOnlyShareVerdict(docs, ISLANDS, "sibling", id, false, true), id).toBe(false);
      expect(vesselOnlyShareVerdict(docs, ISLANDS, "island", id, false), id).toBe(true);
    }
    // CONTROL: a document no source files device-private falls through to the rest of the verdict.
    expect(vesselOnlyShareVerdict(docs, ISLANDS, "wire", "public-doc", true)).toBeUndefined();
  });
});
