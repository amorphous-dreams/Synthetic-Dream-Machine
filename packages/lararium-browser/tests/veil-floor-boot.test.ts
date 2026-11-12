/**
 * THE BROWSER'S VEIL FLOOR, AND A FACE AS AN OVERLAY (the-veil-ladder#/the-base-model: "every vessel … stands anon at its floor
 * … A PersonaGroup rides as an OVERLAY, never a promotion that consumes the anon").
 *
 *   VF1  a fresh browser boots its floor and asks nobody: the record names a place and no face; the vessel's secret-home
 *        address rests in the open pre-bind window; no slot binds and no place KEL arms.
 *   VF2  the founding act asks for a face (`foundFace`): the face lands OVER that floor; the floor record stays byte-equal.
 *   VF3  an admit overlays the floor: its ceremony meets the floor's own daemon document, and the floor record stays.
 *   VF5  the burn's fall back: a booted face whose custody left this browser drops its overlay, and the vessel boots at its
 *        floor record; a locked face never reads as burned; another face's overlay stands.
 *   VF4  a second admit never replaces the first: both overlays stand, keyed by PersonaGroup, neither naming the other; a
 *        hello that names either face boots under it, and a face the record holds no overlay for refuses `face-not-worn`.
 */
import { describe, expect, test, vi } from "vitest";
import { BootHalted, admitNaming } from "./wire-vessel-rig.js";
import { bindSyntheticBrowserCustodySlot, bindSyntheticFace, fixtureWardDialog } from "./browser-custody-fixture.js";
import { openBrowserVessel, readBrowserVesselFaces, type BrowserVesselOptions } from "../src/open-browser-vessel.js";
import { openVesselIdb, idbKeys, loadBrowserPlaceKel } from "../src/browser-vessel-identity.js";
import { readBrowserCustody } from "../src/browser-custody.js";
import { clearFaceCustody, lockFaceCustody } from "../src/browser-face-custody.js";

const met: Array<{ group: string; daemonUrl: string }> = [];
vi.mock("@lararium/keyhive", async (orig) => {
  const rig = await import("./wire-vessel-rig.js");
  return {
    ...(await orig<object>()),
    runApplyAdmitPayload: async (input: { daemonHandle: { url: string }; payload: { personaGroupId: string; deviceEdge?: unknown } }) => {
      met.push({ group: input.payload.personaGroupId, daemonUrl: input.daemonHandle.url });
      return rig.fakeAdmitResult(input);
    },
  };
});

const SLOW = 180_000;
type Record_ = { daemonUrl: string; personaGroupId?: string; floor?: { daemonUrl: string }; faces?: Record<string, { personaGroupId?: string; personaUrl?: string }>; personaPlanes: unknown[] };
async function recordOf(idbName: string): Promise<Record_ | undefined> {
  const idb = await openVesselIdb(idbName);
  try {
    return await new Promise((resolve, reject) => { const q = idb.transaction("bootstrap").objectStore("bootstrap").getAll(); q.onsuccess = () => resolve((q.result as Record_[])[0]); q.onerror = () => reject(q.error); });
  } finally { idb.close(); }
}
async function keystoreRows(idbName: string): Promise<string[]> {
  const idb = await openVesselIdb(idbName);
  try { return (await idbKeys(idb, "keystore")).map(String).sort(); } finally { idb.close(); }
}
const halted = (extra: Partial<BrowserVesselOptions>): BrowserVesselOptions =>
  ({ onPhase: (phase: string) => { if (phase === "bootstrap-kept") throw new BootHalted(); }, ...extra }) as BrowserVesselOptions;
const boot = (extra: Partial<BrowserVesselOptions>) => expect(openBrowserVessel(halted(extra))).rejects.toBeInstanceOf(BootHalted);

describe("the browser's veil floor stands first, and a face lands over it", () => {
  test("VF1 · VF2 a fresh browser stands its floor and asks nobody; a founding then lays face 0 over the same floor", async () => {
    const idbName = `veil-floor-${crypto.randomUUID()}`;
    const asked: string[] = [];
    await boot({ idbName, askCustody: async (q: { readonly kind: string }) => { asked.push(q.kind); return null; } } as never);
    expect(asked, "the floor asks no custody, no ward and no card").toEqual([]);
    const floor = await recordOf(idbName);
    expect(floor?.daemonUrl).toMatch(/^automerge:/);
    expect(floor?.personaGroupId).toBeUndefined();
    expect(floor?.floor).toEqual({ daemonUrl: floor!.daemonUrl });
    expect(floor?.faces).toBeUndefined();
    expect(floor?.personaPlanes).toEqual([]);
    expect(await readBrowserVesselFaces(idbName)).toEqual([]);
    // THE PRE-BIND WINDOW, OPEN: the vessel's key and its secret home's address rest clear, no slot stands, no place KEL arms.
    expect((await readBrowserCustody(idbName)).reading).toBe("clear");
    expect(await keystoreRows(idbName)).toEqual(expect.arrayContaining(["secret-home", "vessel-key"]));
    expect((await keystoreRows(idbName)).some((row) => row.startsWith("sealed/"))).toBe(false);
    expect(await loadBrowserPlaceKel(idbName)).toBeNull();
    // A SECOND BOOT READS THE SAME FLOOR (it founds nothing twice).
    await boot({ idbName });
    expect(await recordOf(idbName)).toEqual(floor);

    // VF2: the founding act asks for a face, and its first bind closes the window.
    await bindSyntheticBrowserCustodySlot(idbName);
    expect((await keystoreRows(idbName))).toContain("sealed/secret-home");
    await boot({ idbName, foundFace: true, askWardRoute: fixtureWardDialog });
    const faced = await recordOf(idbName);
    expect(faced?.personaGroupId).toMatch(/^(0x)?[0-9a-f]+$/);
    expect(faced?.floor, "the floor record stays byte-equal").toEqual(floor!.floor);
    expect(faced?.daemonUrl, "the face lands in the floor's own daemon document").toBe(floor!.daemonUrl);
    expect(Object.keys(faced?.faces ?? {})).toEqual([faced!.personaGroupId]);
    expect(await readBrowserVesselFaces(idbName)).toEqual([faced!.personaGroupId]);
  }, SLOW);

  test("VF3 · VF4 an admit overlays the floor, and a second admit never replaces the first", async () => {
    const idbName = `veil-overlay-${crypto.randomUUID()}`;
    await boot({ idbName });
    const floor = await recordOf(idbName);
    await bindSyntheticBrowserCustodySlot(idbName);
    met.length = 0;
    const first = admitNaming("cd".repeat(32), {});
    await bindSyntheticFace(idbName, first.personaGroupId);
    await boot({ idbName, admit: first });
    expect(met, "the first overlay's ceremony meets the floor's own daemon document").toEqual([{ group: first.personaGroupId, daemonUrl: floor!.daemonUrl }]);
    const one = await recordOf(idbName);
    expect(one?.floor).toEqual(floor!.floor);
    expect(one?.personaGroupId).toBe(first.personaGroupId);
    expect(Object.keys(one?.faces ?? {})).toEqual([first.personaGroupId]);

    // VF4: a second face joins. Its overlay lands beside the first, which stays exactly as it stood.
    const second = { ...admitNaming("ce".repeat(32), {}), personaGroupId: "b2".repeat(16) } as typeof first;
    await bindSyntheticFace(idbName, second.personaGroupId);
    await boot({ idbName, admit: second });
    const two = await recordOf(idbName);
    expect(two?.floor, "the floor record stays byte-equal").toEqual(floor!.floor);
    expect(Object.keys(two?.faces ?? {}).sort()).toEqual([first.personaGroupId, second.personaGroupId].sort());
    expect(two?.faces?.[first.personaGroupId], "the first face's overlay stands as it stood").toEqual(one!.faces![first.personaGroupId]);
    expect(two?.personaGroupId).toBe(second.personaGroupId);
    // NO RECORD LINKS ONE FACE TO ANOTHER: neither overlay names the other's group or plane.
    const a = JSON.stringify(two!.faces![first.personaGroupId]), b = JSON.stringify(two!.faces![second.personaGroupId]);
    expect(a.includes(second.personaGroupId)).toBe(false);
    expect(b.includes(first.personaGroupId)).toBe(false);
    expect(b.includes(String(two!.faces![first.personaGroupId]!.personaUrl))).toBe(false);
    expect((await readBrowserVesselFaces(idbName)).sort()).toEqual([first.personaGroupId, second.personaGroupId].sort());
    // THE HELLO NAMES THE FACE IT WEARS: either overlay boots, the record at rest stays, and an unknown face refuses by name.
    await boot({ idbName, face: first.personaGroupId });
    await boot({ idbName, face: second.personaGroupId });
    expect(await recordOf(idbName)).toEqual(two);
    await expect(openBrowserVessel(halted({ idbName, face: "c3".repeat(16) }))).rejects.toThrow(/face-not-worn/);
  }, SLOW);

  test("VF5 THE BURN'S FALL BACK: a face whose custody left this browser severs forward, and the vessel boots at its floor", async () => {
    const idbName = `veil-burn-${crypto.randomUUID()}`;
    await boot({ idbName });
    const floor = await recordOf(idbName);
    await bindSyntheticBrowserCustodySlot(idbName);
    const first = admitNaming("cd".repeat(32), {});
    const second = { ...admitNaming("ce".repeat(32), {}), personaGroupId: "b2".repeat(16) } as typeof first;
    await bindSyntheticFace(idbName, first.personaGroupId);
    await boot({ idbName, admit: first });
    await bindSyntheticFace(idbName, second.personaGroupId);
    await boot({ idbName, admit: second });
    const both = await recordOf(idbName);
    expect(both?.personaGroupId, "the setup took: the record boots the second face").toBe(second.personaGroupId);
    // CONTROL: a face whose tree stands LOCKED still boots as that face (a lock never reads as a burn).
    lockFaceCustody(idbName, second.personaGroupId);
    await boot({ idbName });
    expect((await recordOf(idbName))?.personaGroupId).toBe(second.personaGroupId);
    // THE BURN: the person clears the booted face's custody. Its tree and every row under it leave this browser.
    const cleared = await clearFaceCustody(idbName, second.personaGroupId, [{ kind: "passphrase", passphrase: "browser fixture custody slot" }], () => true);
    expect(cleared.reading).toBe("cleared");
    await boot({ idbName });
    const after = await recordOf(idbName);
    expect(after?.personaGroupId, "the vessel stands at its floor, wearing no face").toBeUndefined();
    expect(after?.daemonUrl).toBe(floor!.floor!.daemonUrl);
    expect(after?.floor, "the floor record stays byte-equal").toEqual(floor!.floor);
    expect(after?.personaPlanes).toEqual([]);
    expect(Object.keys(after?.faces ?? {}), "the burned overlay left; the other face's overlay stands").toEqual([first.personaGroupId]);
    expect(after?.faces?.[first.personaGroupId]).toEqual(both!.faces![first.personaGroupId]);
    // A hello that names the face still standing boots under it; the burned face refuses by name.
    await boot({ idbName, face: first.personaGroupId });
    await expect(openBrowserVessel(halted({ idbName, face: second.personaGroupId }))).rejects.toThrow(/face-not-worn/);
    // A REPLAY FALLS NOWHERE FURTHER.
    await boot({ idbName });
    expect(await recordOf(idbName)).toEqual(after);
  }, SLOW);
});
