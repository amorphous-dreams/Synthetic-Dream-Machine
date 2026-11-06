/**
 * worn-face-wiki-bags — every bag the sealed rest seals under a lit face stands among the bags that face registers, so a
 * record its session seals there reads its writer capable (sealed-store#/owed, U1's D half).
 *
 * THE HOLE: the daemon wiki's working and draft slots (the D half of the daemon bag) carry the verb outcome ledger and
 * the receipt facts. Sealed under the face while the register set names only the user wiki's slots, each record there
 * reads `writer-not-capable` under the production standing (`ownChainStanding` over the island's `registerBags`), its
 * seal refuses, and the anon-veil lift's flush waits on it.
 *
 *   W1 — a lit, proved face seals the daemon wiki's slots beside the user wiki's
 *   W2 — every sealed bag reads its writer capable under the production standing over the derived register set
 *   W3 — CONTROL, the user wiki's slots: registered and sealed as before, at the floor and lit alike
 *   W4 — CONTROL, the floor: a vessel no lit face stands in seals nothing and registers no daemon slot
 *   W5 — NONSENSE: a bag the face never registers reads not capable, and a foreign chain reads not capable
 *   W6 — the face's own catalog (U1's D half of the catalog) seals and registers under the lit face, so the boot's island
 *        holds its key before the lift opens it; the floor seals and registers none
 */
import { describe, expect, test } from "vitest";
import { FACE_CATALOG_BAG_ID, deriveRegisterBags, wikiSlotUri, wornFaceWikiBags } from "@lararium/mesh";
import { ownChainStanding } from "../src/index.js";

const USER_SLOT = { wikiBagId: "wikis/lares", workingBagId: wikiSlotUri("lares", "working"), draftBagId: wikiSlotUri("lares", "draft") };
const DAEMON_SLOTS = [wikiSlotUri("daemon", "working"), wikiSlotUri("daemon", "draft")];
const GROUP = "4e1f0c2a9b7d43e8a6c5b1d2e3f4a5b6";
const chain = { scope: { faceKey: "ab".repeat(32), nexus: "cd".repeat(32) }, vesselFaceKey: "ef".repeat(32) };
const certificate = { scope: { faceKey: chain.scope.faceKey, nexus: chain.scope.nexus }, vesselFaceKey: chain.vesselFaceKey, sessionKey: "01".repeat(32) };

describe("the worn face's wiki bags", () => {
  test("W1-W2 — a lit face seals the daemon wiki's slots, and every bag it seals reads its writer capable", () => {
    const bags = wornFaceWikiBags({ slot: USER_SLOT, lit: true });
    expect(bags.sealed).toEqual(expect.arrayContaining([...DAEMON_SLOTS, USER_SLOT.wikiBagId, USER_SLOT.workingBagId, USER_SLOT.draftBagId]));
    const registered = deriveRegisterBags({ fleets: [{ personaGroupId: GROUP }], wikiBags: bags.registered });
    const standing = ownChainStanding(() => chain as never, () => registered);
    for (const bagId of bags.sealed) expect(standing.holdsWrite({ certificate: certificate as never, bagId }), bagId).toBe(true);
  });

  test("W3 — CONTROL: the user wiki's slots register at the floor and lit alike, and seal only lit", () => {
    const user = [USER_SLOT.wikiBagId, USER_SLOT.workingBagId, USER_SLOT.draftBagId];
    expect(wornFaceWikiBags({ slot: USER_SLOT, lit: false }).registered).toEqual(user);
    expect(wornFaceWikiBags({ slot: USER_SLOT, lit: true }).registered).toEqual(expect.arrayContaining(user));
    expect(wornFaceWikiBags({ slot: USER_SLOT, lit: true }).sealed).toEqual(expect.arrayContaining(user));
  });

  test("W4 — CONTROL: the floor seals nothing and registers no daemon slot; a herm (no wiki slot) lit seals the daemon slots alone", () => {
    const floor = wornFaceWikiBags({ slot: USER_SLOT, lit: false });
    expect(floor.sealed).toEqual([]);
    for (const bag of DAEMON_SLOTS) expect(floor.registered).not.toContain(bag);
    expect(wornFaceWikiBags({ lit: false })).toEqual({ registered: [], sealed: [] });
    expect(wornFaceWikiBags({ lit: true }).sealed).toEqual(expect.arrayContaining(DAEMON_SLOTS));
  });

  test("W5 — NONSENSE: an unregistered bag and a foreign chain each read not capable", () => {
    const registered = deriveRegisterBags({ fleets: [{ personaGroupId: GROUP }], wikiBags: wornFaceWikiBags({ slot: USER_SLOT, lit: true }).registered });
    const standing = ownChainStanding(() => chain as never, () => registered);
    expect(standing.holdsWrite({ certificate: certificate as never, bagId: wikiSlotUri("nowhere", "working") })).toBe(false);
    const foreign = ownChainStanding(() => ({ ...chain, vesselFaceKey: "99".repeat(32) }) as never, () => registered);
    expect(foreign.holdsWrite({ certificate: certificate as never, bagId: DAEMON_SLOTS[0]! })).toBe(false);
  });

  test("W6 — the face's own catalog seals and registers under the lit face alone, and its writer reads capable", () => {
    const lit = wornFaceWikiBags({ slot: USER_SLOT, lit: true });
    expect(lit.sealed).toContain(FACE_CATALOG_BAG_ID);
    expect(lit.registered).toContain(FACE_CATALOG_BAG_ID);
    const registered = deriveRegisterBags({ fleets: [{ personaGroupId: GROUP }], wikiBags: lit.registered });
    expect(ownChainStanding(() => chain as never, () => registered).holdsWrite({ certificate: certificate as never, bagId: FACE_CATALOG_BAG_ID })).toBe(true);
    const floor = wornFaceWikiBags({ slot: USER_SLOT, lit: false });
    expect(floor.sealed).not.toContain(FACE_CATALOG_BAG_ID);
    expect(floor.registered).not.toContain(FACE_CATALOG_BAG_ID);
  });
});
