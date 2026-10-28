import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { deviceAtomProofBytes, hex, verifyDeviceDelegation, type DeviceDelegationTiddler } from "@lararium/mesh";
import { openBrowserVessel, type BrowserVesselOptions } from "../src/open-browser-vessel.js";
import { idbGet, openVesselIdb } from "../src/browser-vessel-identity.js";
import { browserFaceAtom, requireBrowserFaceAtomSeed } from "../src/browser-face-atom.js";
import { bindSyntheticBrowserCustodySlot } from "./browser-custody-fixture.js";
import { placeSeed } from "./browser-place-seed.fixture.js";
import { BootHalted } from "./wire-vessel-rig.js";

describe("a browser face countersigns its own edge", () => {
  test("the real founding edge accepts its atom; place, B, and absent face refuse by name", async () => {
    const idbName = `browser-edge-${crypto.randomUUID()}`;
    await bindSyntheticBrowserCustodySlot(idbName);
    await expect(openBrowserVessel({ idbName, onPhase: (phase: string) => { if (phase === "bootstrap-kept") throw new BootHalted(); } } as BrowserVesselOptions))
      .rejects.toBeInstanceOf(BootHalted);
    const db = await openVesselIdb(idbName);
    const social = await idbGet<{ personaGroupId: string; deviceEdge: DeviceDelegationTiddler }>(db, "bootstrap", "social-bootstrap");
    db.close();
    if (!social) throw new Error("founding left no face edge");
    const edge = social.deviceEdge;
    expect(await verifyDeviceDelegation(edge, edge.personaRootDid)).toMatchObject({ ok: true });
    const own = await requireBrowserFaceAtomSeed(idbName, social.personaGroupId);
    expect(own).toHaveLength(32);
    const other = await browserFaceAtom(idbName, "another-face");
    const otherSeed = await requireBrowserFaceAtomSeed(idbName, "another-face");
    expect(other.key).not.toBe(edge.deviceVerifyingKey);
    const image = deviceAtomProofBytes(edge);
    for (const thief of [await placeSeed(idbName), otherSeed]) {
      const forged = { ...edge, atomSignature: hex(await ed.signAsync(image, thief)) };
      expect(await verifyDeviceDelegation(forged, edge.personaRootDid)).toMatchObject({ ok: false, reason: "atom countersignature mismatch" });
    }
    await expect(requireBrowserFaceAtomSeed(idbName, "no-face")).rejects.toMatchObject({ name: "FaceAtomMissing" });
  });
});
