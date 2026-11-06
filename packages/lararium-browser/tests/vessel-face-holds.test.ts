/**
 * vessel-face-holds — A SESSION WEARS A FACE ONLY BY ITS OWN UNLOCK, AND A KEY STANDS ONLY WHILE A SESSION HOLDS IT
 * (browser-vessel-lift slice 3; the custody read's HOLD over the production reach).
 *
 *   FH1 RED two fresh tabs into one founding: a faceless second session that admits on the place tree's clear reading while
 *       the founding lights refuses `face-lighting` and wears no face; a faceless session over the lit vessel wears its face
 *       only after its own unlock of that face, and a wrong route leaves it faceless. CONTROL: the founding session wears the
 *       face it founded, and the right route admits a later session wearing it.
 *   FH2 RED a failed light leaves no session admitted and no key held: a face session's key drops with the failed light, and
 *       a founding's place key and unnamed founder key drop at the floor. CONTROL: a light that lands admits and holds.
 *   FH3 RED a switch closed mid-preflight leaves the target locked: the key the preflight's unlock seats after the close drops
 *       once that unlock settles. CONTROL: a switch that lands holds the target.
 *   FH4 RED a failed switch spares the key an asking session of the target holds. CONTROL: the switch's own target key drops
 *       where no other session holds it (FF3).
 *   FH5 RED a face bound under a passphrase other than the place's admits: its own route opens its own tree, and the place
 *       opens by its own route when the light needs it. CONTROL: one route for both asks once.
 *   FH6 RED the reserved founding spelling `unnamed:` names no face at any door. CONTROL: a PersonaGroup opens a session.
 *   FH7 RED a PRF seed wrap gates on the face's own tree, never the place tree: a face whose tree stands refuses the wrap
 *       while the place tree reads clear. CONTROL: a face with no tree keeps the opt-in wrap door.
 *   FH8 RED the walk record (`walk/<gate>`, the place tree's LEAD row) holds no face secret: a carry receipt (a document key
 *       the face's carry secret derives) refuses `walk-receipt-unhomed`. CONTROL: an invite, a wallet and a grant rest.
 *
 * Faces and secrets stay synthetic, over scratch stores; each tree derives with scrypt, so the cases run slow.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { afterEach, describe, expect, test } from "vitest";
import { encodeInvite } from "@lararium/mesh";
import { overwriteBrowserCustody, readBrowserCustody, sealBrowserKeystore } from "../src/browser-custody.js";
import {
  bindFirstFaceSlot, checkFaceName, faceCustodyHeld, heldUnnamedFace, lockFaceCustody, standUnnamedFace, unlockFaceCustody,
} from "../src/browser-face-custody.js";
import { writeBrowserSeedWrap } from "../src/browser-vessel-identity.js";
import { browserWalkStore } from "../src/browser-walk.js";
import { bindSyntheticBrowserCustodySlot } from "./browser-custody-fixture.js";
import { standVesselHouse, type HouseAsk, type LitVessel, type VesselHouse } from "../src/vessel-sessions.js";

const SLOW = 300_000;
const PASS = { kind: "passphrase", passphrase: "the founded face keeps its fire" } as const;
const OTHER = { kind: "passphrase", passphrase: "another fire" } as const;
const WRONG = { kind: "passphrase", passphrase: "not this face's route" } as const;
const face = (tag: string): string => `pg-${tag}-${crypto.randomUUID()}`;
const houses: VesselHouse[] = [];
afterEach(async () => { for (const h of houses.splice(0)) await h.release().catch(() => undefined); });
async function stand(idbName: string, light: () => Promise<LitVessel> = () => Promise.resolve({ close: async () => undefined })): Promise<VesselHouse> {
  const h = await standVesselHouse({ idbName, light });
  houses.push(h);
  return h;
}
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
/** One unlock's derivation on this machine, measured over the face's own tree (the far side's own pace). */
async function deriveTime(idbName: string, f: string, route: typeof PASS | typeof OTHER): Promise<number> {
  lockFaceCustody(idbName, f);
  const t0 = performance.now();
  expect((await unlockFaceCustody(idbName, f, [route])).reading).toBe("opens");
  const d = performance.now() - t0;
  lockFaceCustody(idbName, f);
  return d;
}

describe("a session wears a face only by its own unlock", () => {
  test("FH1 RED a faceless second tab into a founding wears no face — CONTROL: the founder wears it, a later right route admits", async () => {
    const idbName = `holds-founding-${crypto.randomUUID()}`;
    const founded = face("founded");
    let open: () => void = () => undefined;
    const gate = new Promise<void>((r) => { open = r; });
    // The founding stands in: it binds the founded face's tree by the founder's own route, then names the face it boots.
    const house = await stand(idbName, async () => { await gate; await bindFirstFaceSlot(idbName, founded, PASS); return { face: founded, close: async () => undefined }; });
    const a = house.open({ tabId: "tab-a" });
    const lit = house.admit(a.sessionId, { ask: async () => PASS });
    const b = house.open({ tabId: "tab-b" });
    const bAsks: HouseAsk[] = [];
    const bAdmit = house.admit(b.sessionId, { ask: async (q) => { bAsks.push(q); return WRONG; } });
    bAdmit.catch(() => undefined);
    await sleep(50);
    open();
    await lit;
    await expect(bAdmit, "a faceless clear admission while the founding lights refuses by name").rejects.toMatchObject({ refusal: "face-lighting" });
    expect(house.session(b.sessionId).face, "the second tab wears no face").toBeNull();
    expect(house.session(b.sessionId).admission).not.toBe("admitted");
    expect(house.session(a.sessionId).face, "CONTROL: the founding session wears the face it founded").toBe(founded);

    const c = house.open({ tabId: "tab-c" });
    const cAsks: HouseAsk[] = [];
    await expect(house.admit(c.sessionId, { ask: async (q) => { cAsks.push(q); return WRONG; } }), "a wrong route admits nothing").rejects.toMatchObject({ refusal: "no-slot-opens" });
    expect(cAsks.some((q) => q.kind === "unlock" && q.face === founded), "the faceless session asks its own unlock of the lit face").toBe(true);
    expect(house.session(c.sessionId).face, "and wears nothing it did not open").toBeNull();
    const d = house.open({ tabId: "tab-d" });
    await house.admit(d.sessionId, { ask: async () => PASS });
    expect(house.session(d.sessionId).face, "CONTROL: its own right route admits it wearing the face").toBe(founded);
  }, SLOW);
});

describe("a failed light holds nothing", () => {
  test("FH2 RED a failed light leaves no session admitted and no key held — CONTROL: a landed light admits and holds", async () => {
    const idbName = `holds-light-${crypto.randomUUID()}`;
    const a = face("a");
    await bindFirstFaceSlot(idbName, a, PASS);
    lockFaceCustody(idbName, a);
    let fail = true;
    const house = await stand(idbName, async () => { if (fail) throw new Error("the light did not stand"); return { close: async () => undefined }; });
    const s = house.open({ tabId: "t", face: a });
    await expect(house.admit(s.sessionId, { ask: async () => PASS })).rejects.toThrow(/did not stand/);
    expect(house.session(s.sessionId).admission, "a failed light admits no session").not.toBe("admitted");
    expect(faceCustodyHeld(idbName, a), "the failed light's face key drops").toBe(false);
    fail = false;
    const s2 = house.open({ tabId: "t2", face: a });
    await house.admit(s2.sessionId, { ask: async () => PASS });
    expect(house.session(s2.sessionId).admission, "CONTROL: a landed light admits").toBe("admitted");
    expect(faceCustodyHeld(idbName, a), "CONTROL: and holds the face key").toBe(true);

    const fresh = `holds-light-founding-${crypto.randomUUID()}`;
    const founding = await stand(fresh, async () => {
      await sealBrowserKeystore(fresh, PASS);
      await standUnnamedFace(fresh, PASS);
      throw new Error("the founding did not stand");
    });
    const f = founding.open({ tabId: "tf" });
    await expect(founding.admit(f.sessionId, { ask: async () => PASS })).rejects.toThrow(/did not stand/);
    await founding.close(f.sessionId, "pagehide");
    expect((await readBrowserCustody(fresh)) , "the place key drops at the floor with no session").toMatchObject({ reading: "sealed", unlocked: false });
    expect(heldUnnamedFace(fresh), "the unnamed founder key drops at the floor").toBeNull();
  }, SLOW);
});

describe("a switch's key leaves with the switch", () => {
  test("FH3 RED a switch closed mid-preflight leaves the target locked — CONTROL: a landed switch holds the target", async () => {
    const idbName = `holds-switch-close-${crypto.randomUUID()}`;
    const a = face("a"), b = face("b");
    await bindFirstFaceSlot(idbName, a, PASS);
    await bindFirstFaceSlot(idbName, b, OTHER);
    lockFaceCustody(idbName, a);
    const derive = await deriveTime(idbName, b, OTHER);
    const house = await stand(idbName);
    const keep = house.open({ tabId: "keep", face: a });
    await house.admit(keep.sessionId, { ask: async () => PASS });
    const s = house.open({ tabId: "t", face: a });
    await house.admit(s.sessionId, { ask: async () => PASS });
    let closed: Promise<unknown> | null = null;
    const switched = house.switchFace(s.sessionId, b, { ask: async () => { closed = sleep(0).then(() => house.close(s.sessionId, "pagehide")); return OTHER; } });
    await expect(switched).rejects.toMatchObject({ refusal: "lock-ended" });
    await closed;
    // barrier: three times the measured derivation, the time the preflight's unlock in flight needs to seat its key
    await sleep(3 * derive + 200);
    expect(faceCustodyHeld(idbName, b), "no key stands for a target whose switching session closed").toBe(false);

    const s2 = house.open({ tabId: "t2", face: a });
    await house.admit(s2.sessionId, { ask: async () => PASS });
    await house.switchFace(s2.sessionId, b, { ask: async () => OTHER });
    expect(faceCustodyHeld(idbName, b), "CONTROL: a landed switch holds the target").toBe(true);
  }, SLOW);

  test("FH4 RED a failed switch spares an asking session's key of the target — CONTROL: the switch's own target key drops", async () => {
    const idbName = `holds-switch-asking-${crypto.randomUUID()}`;
    const a = face("a"), b = face("b");
    await bindFirstFaceSlot(idbName, a, PASS);
    await bindFirstFaceSlot(idbName, b, OTHER);
    lockFaceCustody(idbName, a);
    const derive = await deriveTime(idbName, b, OTHER);
    const house = await stand(idbName);
    const keep = house.open({ tabId: "keep", face: a });
    await house.admit(keep.sessionId, { ask: async () => PASS });
    const s = house.open({ tabId: "t", face: a });
    await house.admit(s.sessionId, { ask: async () => PASS });
    // The place seals under B's route after the vessel lit, so B's session still asks while the place opens behind its face.
    await sealBrowserKeystore(idbName, OTHER);
    await overwriteBrowserCustody(idbName);
    const x = house.open({ tabId: "x", face: b });
    let xAdmit: Promise<unknown> | null = null;
    await expect(house.switchFace(s.sessionId, b, {
      ask: async () => OTHER,
      intent: async () => {
        xAdmit = house.admit(x.sessionId, { ask: async () => OTHER });
        xAdmit.catch(() => undefined);
        await sleep(1.5 * derive);
        throw new Error("the intent did not rest");
      },
    })).rejects.toThrow(/intent did not rest/);
    await xAdmit;
    expect(house.session(x.sessionId).admission).toBe("admitted");
    expect(faceCustodyHeld(idbName, b), "the asking session's key of the target stands through the failed switch").toBe(true);

    const c = `holds-switch-own-${crypto.randomUUID()}`;
    await bindFirstFaceSlot(c, a, PASS);
    await bindFirstFaceSlot(c, b, OTHER);
    lockFaceCustody(c, a); lockFaceCustody(c, b);
    const h2 = await stand(c);
    const k2 = h2.open({ tabId: "keep", face: a });
    await h2.admit(k2.sessionId, { ask: async () => PASS });
    const s2 = h2.open({ tabId: "t", face: a });
    await h2.admit(s2.sessionId, { ask: async () => PASS });
    await expect(h2.switchFace(s2.sessionId, b, { ask: async () => OTHER, intent: async () => { throw new Error("no rest"); } })).rejects.toThrow(/no rest/);
    expect(faceCustodyHeld(c, b), "CONTROL: the switch's own target key drops").toBe(false);
  }, SLOW);
});

describe("each face's unlock opens its own tree", () => {
  test("FH5 RED a face under another passphrase than the place's admits; the place opens by its own route — CONTROL: one route asks once", async () => {
    const idbName = `holds-place-${crypto.randomUUID()}`;
    const b = face("b");
    await sealBrowserKeystore(idbName, PASS);
    await overwriteBrowserCustody(idbName);
    await bindFirstFaceSlot(idbName, b, OTHER);
    lockFaceCustody(idbName, b);
    const house = await stand(idbName);
    const s = house.open({ tabId: "t", face: b });
    const asks: HouseAsk[] = [];
    await house.admit(s.sessionId, { ask: async (q) => { asks.push(q); return q.face === null ? PASS : OTHER; } });
    expect(house.session(s.sessionId).admission, "the face's own route admits it").toBe("admitted");
    expect(asks.map((q) => q.face), "its own face first, then the place by its own route for the light").toEqual([b, null]);

    const one = `holds-place-one-${crypto.randomUUID()}`;
    const c = face("c");
    await sealBrowserKeystore(one, PASS);
    await overwriteBrowserCustody(one);
    await bindFirstFaceSlot(one, c, PASS);
    lockFaceCustody(one, c);
    const h2 = await stand(one);
    const s2 = h2.open({ tabId: "t", face: c });
    const asks2: HouseAsk[] = [];
    await h2.admit(s2.sessionId, { ask: async (q) => { asks2.push(q); return PASS; } });
    expect(asks2.map((q) => q.face), "CONTROL: one route for face and place asks once").toEqual([c]);
    expect((await readBrowserCustody(one)), "CONTROL: and opens the place").toMatchObject({ unlocked: true });
  }, SLOW);

  test("FH6 RED `unnamed:` names no face — CONTROL: a PersonaGroup opens a session", async () => {
    expect(() => checkFaceName("unnamed:00ff"), "the reserved founding spelling names no face").toThrow(/face-name-reserved/);
    const house = await stand(`holds-unnamed-${crypto.randomUUID()}`);
    expect(() => house.open({ tabId: "t", face: "unnamed:00ff" })).toThrow(/face-name-reserved/);
    expect(house.open({ tabId: "t2", face: face("ok") }).face, "CONTROL").toMatch(/^pg-ok-/);
  });
});

describe("the place tree holds no face secret", () => {
  test("FH7 RED a PRF wrap gates on the face's own tree — CONTROL: a face with no tree keeps the wrap door", async () => {
    const idbName = `holds-wrap-${crypto.randomUUID()}`;
    const b = face("b");
    await bindFirstFaceSlot(idbName, b, OTHER);
    expect((await readBrowserCustody(idbName)).reading, "the place tree reads clear").toBe("clear");
    const wrap = { keyClass: "relation", info: "x", nonce: "00", wrapped: "00" } as never;
    await expect(writeBrowserSeedWrap(idbName, b, wrap), "a face whose tree stands takes no wrap").rejects.toThrow(/ward-passkey-refused/);
    await expect(writeBrowserSeedWrap(idbName, face("treeless"), wrap), "CONTROL").resolves.toBeUndefined();
  }, SLOW);

  test("FH8 RED a walk record refuses a carry receipt — CONTROL: invite, wallet and grant rest", async () => {
    const idbName = `holds-walk-${crypto.randomUUID()}`;
    await bindSyntheticBrowserCustodySlot(idbName);
    const store = browserWalkStore(idbName);
    const gate = "ab".repeat(32), aid = `nexus-${"a".repeat(64)}`;
    const invite = encodeInvite({ nexusAid: aid, gatePubKey: gate, token: { purpose: "host-invite", n: "12".repeat(32), y: "34".repeat(64) } });
    await store.update(gate, () => ({ nexusAid: aid, invite }));
    expect((await store.read(gate))?.invite, "CONTROL: an invite rests").toBe(invite);
    const receipt = { cid: `blake3:${"c".repeat(64)}`, ref: "d".repeat(64), key: "e".repeat(64) };
    await expect(store.update(gate, () => ({ nexusAid: aid, invite, carried: [receipt] })), "a carry receipt names a face secret").rejects.toThrow(/walk-receipt-unhomed/);
    expect((await store.read(gate))?.carried, "nothing of the receipt rests").toBeUndefined();
  }, SLOW);
});
