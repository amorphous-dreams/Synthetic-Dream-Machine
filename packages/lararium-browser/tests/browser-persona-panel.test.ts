/**
 * browser-persona-panel.test.ts — the daemon persona surface's data flow, over REAL IndexedDB.
 *
 * The panel is projection-rendered (a worker+camera boot vitest-browser can't easily drive), so
 * these tests stand the SHORES the panel rides: the vessel-side mint→list→wear round-trip against
 * the browser persona vault (exactly the sequence the persona-mint / persona-refresh / persona-wear
 * main-verbs orchestrate), the custody-by-type FAIL-CLOSED on wearing an unheld root, and the
 * pure panel-state shaping (personaPanelStateArgs) the `persona-state` worker verb writes.
 */
import { bindSyntheticBrowserCustodySlot, FIXTURE_WARD } from "./browser-custody-fixture.js";
import { describe, test, expect, afterEach } from "vitest";
import {
  personaMultitudeView, renameOwnPersona, type PersonaMultitudeEntry,
} from "@lararium/mesh";
import {
  generateOrLoadBrowserPersonaRoot, wearBrowserPersona,
  listBrowserPersonaRoots, loadBrowserActivePersona,
  makeBrowserIdbPersonaVault, makeBrowserPersonaPetnameStore,
} from "../src/browser-vessel-identity.js";
import { personaPanelStateArgs } from "../src/persona-panel-state.js";

let created = 0;
const opened = new Set<string>();
function idb(): string { const n = `lares:test-persona-panel:${Date.now()}:${created++}`; opened.add(n); return n; }
function deleteIdb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}
afterEach(async () => { for (const n of opened) await deleteIdb(n); opened.clear(); });

/** The vessel-side mint the persona-mint verb runs: next index = max(held)+1 (or 0), default label. */
async function mintNext(name: string): Promise<number> {
  const roster = await listBrowserPersonaRoots(name);
  const nextIndex = roster.length ? Math.max(...roster) + 1 : 0;
  await bindSyntheticBrowserCustodySlot(name);
  await generateOrLoadBrowserPersonaRoot(name, nextIndex, FIXTURE_WARD);
  await renameOwnPersona(await makeBrowserPersonaPetnameStore(name), nextIndex, `persona-h${nextIndex}`);
  return nextIndex;
}

/** The persona-refresh read: the multitude-view + worn index the pushPersonaState reflects. */
async function readState(name: string): Promise<{ view: PersonaMultitudeEntry[]; active: number | undefined }> {
  const vault    = await makeBrowserIdbPersonaVault(name);
  const petnames = await makeBrowserPersonaPetnameStore(name);
  const view     = await personaMultitudeView(vault, petnames);   // PRIVATE-all: no publicView
  const active   = await loadBrowserActivePersona(name);
  return { view, active };
}

describe("the daemon persona surface — mint → list → wear over IndexedDB", () => {
  test("mint founds the face's root with a default private label; a second mint names no face and refuses", async () => {
    const name = idb();
    expect(await mintNext(name)).toBe(0);
    await expect(mintNext(name), "one root per face").rejects.toMatchObject({ reading: "face-names-a-handle" });
    expect(await listBrowserPersonaRoots(name)).toEqual([0]);

    const { view } = await readState(name);
    expect(view.map((e) => e.handleIndex)).toEqual([0]);
    // PRIVATE-all: minting set the private label; nothing federated (no public glamour).
    expect(view.map((e) => e.petname)).toEqual(["persona-h0"]);
    expect(view.every((e) => e.heldHere && !e.hasPublicHandle && e.glamour === null)).toBe(true);
  });

  test("wear moves only the selector; list + panel-state reflect the worn face", async () => {
    const name = idb();
    await mintNext(name);   // h0, the face's one root
    await wearBrowserPersona(name, 0);
    const { view, active } = await readState(name);
    expect(active).toBe(0);
    expect(view.map((e) => e.handleIndex)).toEqual([0]);

    const args = personaPanelStateArgs(view, active);
    expect(args["list"]).toBe("0");
    expect(args["active"]).toBe("0");
    expect(args["held"]).toBe("0");
    expect(args["petname-0"]).toBe("persona-h0");
  });

  test("FAIL CLOSED — wearing a persona whose root this vessel does NOT hold refuses; selector unmoved", async () => {
    const name = idb();
    await mintNext(name);   // h0 only
    await expect(wearBrowserPersona(name, 5)).rejects.toThrow(/cannot wear persona h5|no persona-root/);
    expect(await loadBrowserActivePersona(name)).toBe(0);   // the refusal moved nothing: the one root held is still the face worn
  });
});

describe("personaPanelStateArgs — the panel's push contract", () => {
  test("shapes list/active/held/petname-<idx> from a view; an unnamed face rides a blank label", () => {
    const view: PersonaMultitudeEntry[] = [
      { handleIndex: 0, petname: "work",  heldHere: true,  hasPublicHandle: false, glamour: null },
      { handleIndex: 1, petname: null,    heldHere: true,  hasPublicHandle: false, glamour: null },
      { handleIndex: 3, petname: "guest", heldHere: false, hasPublicHandle: false, glamour: null },
    ];
    const args = personaPanelStateArgs(view, 0);
    expect(args["list"]).toBe("0 1 3");
    expect(args["active"]).toBe("0");
    expect(args["held"]).toBe("0 1");                  // h3 is a joinee-face → no wear button
    expect(args["petname-0"]).toBe("work");
    expect(args["petname-1"]).toBe("");                // unnamed → blank, never dropped
    expect(args["petname-3"]).toBe("guest");
  });

  test("no worn persona → an empty active (no inference)", () => {
    const args = personaPanelStateArgs([], undefined);
    expect(args["active"]).toBe("");
    expect(args["list"]).toBe("");
    expect(args["held"]).toBe("");
  });
});
