/** Browser face anchors rest in PersonaGroup-named custody rows and refuse old archive shapes. */
import { describe, expect, test } from "vitest";
import { mintFaceAnchor } from "@lararium/mesh";
import { bindSyntheticBrowserCustodySlot } from "./browser-custody-fixture.js";
import { faceAnchorRow, keepBrowserFaceAnchor, loadBrowserFaceAnchor, requireBrowserFaceAnchor } from "../src/browser-face-anchor.js";
import { readKeystoreRow } from "../src/browser-custody.js";
import { BrowserOldShapeVeilArchiveRefused, oldShapeVeilRow } from "../src/browser-keyhive-archive.js";
import { idbPut, openVesselIdb } from "../src/browser-vessel-identity.js";

const GROUP_A = "group-a";
const GROUP_B = "group-b";
const anchor = mintFaceAnchor({ personaGroup: GROUP_A, personaKelPrefix: "prefix-a", personaRootDid: "root-a", edge: { device: "a" }, leaseEpoch: 0 });

describe("browser face anchor custody", () => {
  test("A1 a bound slot keeps and reads one anchor; CONTROL: an absent row reads null", async () => {
    const idbName = `face-anchor-${crypto.randomUUID()}`;
    await bindSyntheticBrowserCustodySlot(idbName);
    expect(await loadBrowserFaceAnchor(idbName, GROUP_A)).toBeNull();
    await keepBrowserFaceAnchor(idbName, anchor);
    expect(await loadBrowserFaceAnchor(idbName, GROUP_A)).toEqual(anchor);
    expect(await requireBrowserFaceAnchor(idbName, GROUP_A)).toEqual(anchor);
    expect(await readKeystoreRow(idbName, faceAnchorRow(GROUP_A))).toBeInstanceOf(Uint8Array);
  });

  test("A2 require refuses anchor-missing by group name", async () => {
    const idbName = `face-anchor-missing-${crypto.randomUUID()}`;
    await bindSyntheticBrowserCustodySlot(idbName);
    await expect(requireBrowserFaceAnchor(idbName, GROUP_A)).rejects.toThrow(`anchor-missing for ${GROUP_A}`);
  });

  test("A3 another group's row never opens as this group's anchor", async () => {
    const idbName = `face-anchor-groups-${crypto.randomUUID()}`;
    await bindSyntheticBrowserCustodySlot(idbName);
    await keepBrowserFaceAnchor(idbName, anchor);
    expect(await loadBrowserFaceAnchor(idbName, GROUP_B)).toBeNull();
    await expect(requireBrowserFaceAnchor(idbName, GROUP_B)).rejects.toThrow(`anchor-missing for ${GROUP_B}`);
  });

  test("A4 an old handle-index veil row refuses by name before boot", async () => {
    const idbName = `face-anchor-old-${crypto.randomUUID()}`;
    const db = await openVesselIdb(idbName);
    try { await idbPut(db, "keystore", "veil-archive-h0", new Uint8Array([1])); } finally { db.close(); }
    await expect(oldShapeVeilRow(idbName)).rejects.toBeInstanceOf(BrowserOldShapeVeilArchiveRefused);
    await expect(oldShapeVeilRow(idbName)).rejects.toThrow(/refuses: this store holds the old face-archive shape; re-found the face/);
  });

  test("A5 a sealed old handle-index veil carrier also refuses", async () => {
    const idbName = `face-anchor-old-sealed-${crypto.randomUUID()}`;
    const db = await openVesselIdb(idbName);
    try { await idbPut(db, "keystore", "sealed/veil-archive-h3", new Uint8Array([1])); } finally { db.close(); }
    await expect(oldShapeVeilRow(idbName)).rejects.toMatchObject({ name: "BrowserOldShapeVeilArchiveRefused", row: "sealed/veil-archive-h3" });
  });
});
