/**
 * A BROWSER VESSEL KEEPS THE ARCHIVES ITS FOUNDING HANDS OUT, and a creator that reloads still seals.
 *
 * `openBrowserVessel` runs for real over the page's IndexedDB, WebCrypto and the keyhive wasm, with no ceremony
 * faked; the rig's phase hook halts it at the catalog, after the founding. The reload then stands the vessel
 * individual the way the daemon island does: its seed from the keystore, its Archive from the keystore, and the
 * cap events replayed.
 *
 *   K1  a founding leaves two rows in the keystore: the vessel's own Archive and face 0's veil Archive.
 *   K2  THE RELOAD: a creator restored from its kept Archive opens what it sealed before the reload and seals
 *       anew. Control: the same replay with no Archive leaves the creator's hand empty, so the reading measures
 *       the kept row and nothing else.
 *   K3  each row holds its own identity: the veil's Archive stood under the vessel seed refuses by name, and the
 *       vessel's own still stands afterwards.
 *   K5  a vessel whose bootstrap stands and whose keystore holds no Archive refuses the boot by row name, before
 *       its catalog. Control: K1's vessel, founded whole, reaches the catalog.
 *   K4  a row that stands and holds no bytes refuses by row name; a row that never stood reads undefined; an
 *       empty Archive never lands and the standing row keeps its bytes.
 */
import { describe, expect, test } from "vitest";
import { KeyhiveProvider, InMemoryEventStore, ArchiveIdentityMismatch } from "@lararium/keyhive";
import { BootHalted } from "./wire-vessel-rig.js";
import { openBrowserVessel, type BrowserVesselOptions } from "../src/open-browser-vessel.js";
import { loadBrowserSigningSeed, openVesselIdb, idbPut } from "../src/browser-vessel-identity.js";
import {
  BrowserArchiveRowMissing, BrowserArchiveRowUnreadable, browserVeilArchiveRow,
  loadBrowserKeyhiveArchive, loadBrowserVeilArchive, saveBrowserKeyhiveArchive,
} from "../src/browser-keyhive-archive.js";

const BAG = "lar:///browser.reload.bag";

/** Found a browser vessel for real and halt once its catalog stands. */
async function foundHalted(): Promise<string> {
  const idbName = `archive-keep-${crypto.randomUUID()}`;
  const opts = {
    idbName,
    onPhase: (phase: string) => { if (phase === "catalog-ready") throw new BootHalted(); },
  } as BrowserVesselOptions;
  await expect(openBrowserVessel(opts)).rejects.toBeInstanceOf(BootHalted);
  return idbName;
}

/** One session of the vessel individual: restore, create a document, seal a chunk, hand out the events. */
async function sessionCreates(seed: Uint8Array, archive: Uint8Array) {
  const store = new InMemoryEventStore();
  const p = new KeyhiveProvider();
  await p.init({ seed, eventStore: store, archiveBytes: archive });
  const { docId } = await p.registerBag(BAG);
  const sealed = await p.encryptContent(BAG, new TextEncoder().encode("sealed before the reload"));
  await p.settleEvents();
  const events = await store.list();
  await p.dispose();
  return { docId, sealed, events };
}

async function reload(seed: Uint8Array, archive: Uint8Array | undefined, s: Awaited<ReturnType<typeof sessionCreates>>) {
  const store = new InMemoryEventStore();
  for (const r of s.events) await store.put(r);
  const p = new KeyhiveProvider();
  await p.init({ seed, eventStore: store, ...(archive ? { archiveBytes: archive } : {}) });
  await p.hydrateFromEventStore();
  p.adoptBag(BAG, s.docId);
  return p;
}

describe("a browser vessel keeps its keyhive Archives", () => {
  test("K1 a founding leaves the vessel's Archive and face 0's veil Archive in the keystore", async () => {
    const idbName = await foundHalted();
    const vessel = await loadBrowserKeyhiveArchive(idbName);
    const veil = await loadBrowserVeilArchive(idbName, 0);
    expect(vessel?.byteLength ?? 0).toBeGreaterThan(0);
    expect(veil?.byteLength ?? 0).toBeGreaterThan(0);
    expect(await loadBrowserVeilArchive(idbName, 1), "no other face founded here").toBeUndefined();
  });

  test("K2 THE RELOAD: a creator restored from its kept Archive opens what it sealed and seals anew", async () => {
    const idbName = await foundHalted();
    const seed = await loadBrowserSigningSeed(idbName);
    const kept = await loadBrowserKeyhiveArchive(idbName);
    expect(kept).toBeDefined();
    const s = await sessionCreates(seed, kept!);

    // CONTROL: the seed and the replayed events with no Archive. The document stays known; the hand does not.
    const bare = await reload(seed, undefined, s);
    await expect(bare.encryptContent(BAG, new Uint8Array([1]))).rejects.toThrow(/Cgka is not initialized/);
    await bare.dispose();

    // The reload reads the row again, as a fresh page does.
    const p = await reload(seed, await loadBrowserKeyhiveArchive(idbName), s);
    expect(new TextDecoder().decode(await p.decryptContent(BAG, s.sealed))).toBe("sealed before the reload");
    expect((await p.encryptContent(BAG, new Uint8Array([1]))).byteLength).toBeGreaterThan(0);
    await p.dispose();
  });

  test("K3 each row holds its own identity: the veil's Archive refuses under the vessel seed", async () => {
    const idbName = await foundHalted();
    const seed = await loadBrowserSigningSeed(idbName);
    const veil = (await loadBrowserVeilArchive(idbName, 0))!;
    const wrong = new KeyhiveProvider();
    await expect(wrong.init({ seed, eventStore: new InMemoryEventStore(), archiveBytes: veil }))
      .rejects.toBeInstanceOf(ArchiveIdentityMismatch);
    // The vessel's own row never moved, and still stands under its seed.
    const own = new KeyhiveProvider();
    await own.init({ seed, eventStore: new InMemoryEventStore(), archiveBytes: (await loadBrowserKeyhiveArchive(idbName))! });
    expect(await own.vesselIdentifierHex()).toMatch(/[0-9a-f]{64}$/);
    await own.dispose();
  });

  test("K5 a founded vessel with no Archive in its keystore refuses the boot by row name", async () => {
    const idbName = `archive-missing-${crypto.randomUUID()}`;
    const idb = await openVesselIdb(idbName);
    try { await idbPut(idb, "bootstrap", "social-bootstrap", { daemonUrl: "automerge:planted", personaPlanes: [] }); } finally { idb.close(); }
    const phases: string[] = [];
    const boot = openBrowserVessel({ idbName, onPhase: (p: string) => { phases.push(p); } } as BrowserVesselOptions);
    const refusal = await boot.then(() => null, (e: unknown) => e);
    expect(refusal).toBeInstanceOf(BrowserArchiveRowMissing);
    expect((refusal as Error).message).toMatch(/keyhive-archive/);
    expect(phases, "the refusal lands before the catalog").not.toContain("catalog-ready");
  });

  test("K4 a torn row refuses by name, an absent row reads undefined, and an empty Archive never lands", async () => {
    const idbName = `archive-rows-${crypto.randomUUID()}`;
    expect(await loadBrowserKeyhiveArchive(idbName)).toBeUndefined();
    expect(await loadBrowserVeilArchive(idbName, 0)).toBeUndefined();

    const standing = new Uint8Array([9, 8, 7, 6]);
    await saveBrowserKeyhiveArchive(idbName, standing);
    await expect(saveBrowserKeyhiveArchive(idbName, new Uint8Array(0))).rejects.toThrow(/empty Archive/);
    expect(Array.from((await loadBrowserKeyhiveArchive(idbName))!), "the standing bytes never moved").toEqual([9, 8, 7, 6]);

    const idb = await openVesselIdb(idbName);
    try { await idbPut(idb, "keystore", browserVeilArchiveRow(0), "not bytes"); } finally { idb.close(); }
    await expect(loadBrowserVeilArchive(idbName, 0)).rejects.toBeInstanceOf(BrowserArchiveRowUnreadable);
    await expect(loadBrowserVeilArchive(idbName, 0)).rejects.toThrow(/veil-archive-h0/);
    expect(() => browserVeilArchiveRow(-1)).toThrow(/face index/);
  });
});
