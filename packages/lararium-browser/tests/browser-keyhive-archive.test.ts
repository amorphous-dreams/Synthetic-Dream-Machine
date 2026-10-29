import { describe, expect, test } from "vitest";
import { KeyhiveProvider, InMemoryEventStore, ArchiveIdentityMismatch } from "@lararium/keyhive";
import { BootHalted } from "./wire-vessel-rig.js";
import { bindSyntheticBrowserCustodySlot } from "./browser-custody-fixture.js";
import { placeSeed } from "./browser-place-seed.fixture.js";
import { openBrowserVessel, type BrowserVesselOptions } from "../src/open-browser-vessel.js";
import { openVesselIdb, idbGet, idbKeys, idbPut } from "../src/browser-vessel-identity.js";
import { browserFaceAtom, requireBrowserFaceAtomSeed } from "../src/browser-face-atom.js";
import { BrowserArchiveRowUnreadable, loadBrowserVeilArchive, saveBrowserVeilArchive } from "../src/browser-keyhive-archive.js";

async function foundHalted(): Promise<{ idbName: string; group: string }> {
  const idbName = `browser-archive-${crypto.randomUUID()}`;
  await bindSyntheticBrowserCustodySlot(idbName);
  await expect(openBrowserVessel({ idbName, onPhase: (phase: string) => { if (phase === "catalog-ready") throw new BootHalted(); } } as BrowserVesselOptions))
    .rejects.toBeInstanceOf(BootHalted);
  const db = await openVesselIdb(idbName);
  try {
    const atomRow = (await idbKeys(db, "keystore")).find((row) => /^(?:sealed\/)?face-atom\//.test(row));
    if (!atomRow) throw new Error("founding left no face atom");
    return { idbName, group: atomRow.replace(/^(?:sealed\/)?face-atom\//, "") };
  } finally { db.close(); }
}

describe("the browser keeps only a face Archive", () => {
  test("a real founding leaves a veil Archive and atom but no vessel Keyhive Archive", async () => {
    const { idbName, group } = await foundHalted();
    const db = await openVesselIdb(idbName);
    try {
      const rows = await idbKeys(db, "keystore");
      expect(rows).not.toContain("keyhive-archive");
      expect(rows).not.toContain("sealed/keyhive-archive");
      expect(rows).toContain(`sealed/face-atom/${group}`);
    } finally { db.close(); }
    const archive = await loadBrowserVeilArchive(idbName, group);
    expect(archive?.byteLength).toBeGreaterThan(0);
    if (!archive) throw new Error("founding left no face Archive");
    const faceSeed = await requireBrowserFaceAtomSeed(idbName, group);
    const own = new KeyhiveProvider();
    await own.init({ seed: faceSeed, eventStore: new InMemoryEventStore(), archiveBytes: archive });
    expect((await own.contactCard()).byteLength).toBeGreaterThan(0);
    await own.dispose();
    const thief = new KeyhiveProvider();
    await expect(thief.init({ seed: await placeSeed(idbName), eventStore: new InMemoryEventStore(), archiveBytes: archive }))
      .rejects.toBeInstanceOf(ArchiveIdentityMismatch);
    await browserFaceAtom(idbName, "other-face");
    const other = new KeyhiveProvider();
    await expect(other.init({ seed: await requireBrowserFaceAtomSeed(idbName, "other-face"), eventStore: new InMemoryEventStore(), archiveBytes: archive }))
      .rejects.toBeInstanceOf(ArchiveIdentityMismatch);
    await expect(requireBrowserFaceAtomSeed(idbName, "no-face")).rejects.toMatchObject({ name: "FaceAtomMissing" });
  });

  test("a torn veil row refuses by row name, and an empty replacement leaves its bytes", async () => {
    const { idbName, group } = await foundHalted();
    const standing = await loadBrowserVeilArchive(idbName, group);
    expect(standing?.byteLength).toBeGreaterThan(0);
    await expect(saveBrowserVeilArchive(idbName, group, new Uint8Array())).rejects.toThrow(/empty Archive/);
    expect(await loadBrowserVeilArchive(idbName, group)).toEqual(standing);
    const db = await openVesselIdb(idbName);
    try { expect(await idbGet(db, "keystore", "keyhive-archive")).toBeUndefined(); } finally { db.close(); }
    const bare = `browser-archive-torn-${crypto.randomUUID()}`;
    const another = await openVesselIdb(bare);
    try { await idbPut(another, "keystore", `veil-archive-g${group}`, { torn: true }); } finally { another.close(); }
    await expect(loadBrowserVeilArchive(bare, group)).rejects.toBeInstanceOf(BrowserArchiveRowUnreadable);
  });
});
