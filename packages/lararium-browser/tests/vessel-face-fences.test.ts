/**
 * vessel-face-fences — A FACE'S KEY STANDS ONLY WHILE ITS SESSION STANDS (browser-vessel-lift slice 3; the cold read's holes).
 *
 *   FF1 RED a session that closes while its own face unlock derives leaves no key seated: the close awaits the act, and a key
 *       an act seated for a closed session drops at once. CONTROL: an admission that runs to its end holds the key.
 *   FF2 RED a clear authenticates the face's sealed anchor before it deletes anything: an index entry pointed at a sibling's
 *       tree (one passphrase shared by both) refuses `face-index-mismatch` and every sibling byte stands. CONTROL: the
 *       face's own clear removes its own tree.
 *   FF3 RED a switch that fails after its preflight drops the key the preflight seated: the target face stands locked.
 *       CONTROL: a switch that lands holds the target's key.
 *
 * Faces and secrets stay synthetic, over scratch stores; each tree derives with scrypt, so the cases run slow.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { afterEach, describe, expect, test } from "vitest";
import { browserKeystoreCustodyIo } from "../src/browser-custody.js";
import { bindFirstFaceSlot, clearFaceCustody, faceCustodyHeld, lockFaceCustody, unlockFaceCustody, writeFaceRow } from "../src/browser-face-custody.js";
import { standVesselHouse, type LitVessel, type VesselHouse } from "../src/vessel-sessions.js";

const SLOW = 300_000;
const PASS = { kind: "passphrase", passphrase: "one fire for both faces" } as const;
const OTHER = { kind: "passphrase", passphrase: "another fire" } as const;
const face = (tag: string): string => `pg-${tag}-${crypto.randomUUID()}`;
const houses: VesselHouse[] = [];
afterEach(async () => { for (const h of houses.splice(0)) await h.release().catch(() => undefined); });
async function stand(idbName: string): Promise<VesselHouse> {
  const h = await standVesselHouse({ idbName, light: (): Promise<LitVessel> => Promise.resolve({ close: async () => undefined }) });
  houses.push(h);
  return h;
}

describe("a face's key stands only while its session stands", () => {
  test("FF1 RED a close mid-unlock leaves no key seated — CONTROL: a whole admission holds the key", async () => {
    const idbName = `fences-close-${crypto.randomUUID()}`;
    const a = face("a");
    await bindFirstFaceSlot(idbName, a, PASS);
    lockFaceCustody(idbName, a);
    // The derivation's own time on this machine, measured by one unlock of the same tree (the far side's own pace).
    const t0 = performance.now();
    expect((await unlockFaceCustody(idbName, a, [PASS])).reading).toBe("opens");
    const derive = performance.now() - t0;
    lockFaceCustody(idbName, a);

    const house = await stand(idbName);
    const s = house.open({ tabId: "t", face: a });
    let closed: Promise<unknown> | null = null;
    const admitted = house.admit(s.sessionId, { ask: async () => { closed = new Promise((r) => setTimeout(r, 0)).then(() => house.close(s.sessionId, "pagehide")); return PASS; } });
    await expect(admitted).rejects.toMatchObject({ refusal: "lock-ended" });
    await closed;
    // barrier: three times the measured derivation, the time the unlock in flight needs to seat its key
    await new Promise((r) => setTimeout(r, 3 * derive + 200));
    expect(faceCustodyHeld(idbName, a), "no key stands for a face whose only session closed").toBe(false);

    const s2 = house.open({ tabId: "t2", face: a });
    await house.admit(s2.sessionId, { ask: async () => PASS });
    expect(faceCustodyHeld(idbName, a), "CONTROL: a whole admission holds the key").toBe(true);
  }, SLOW);
});

describe("a clear authenticates the face it names", () => {
  test("FF2 RED an index pointed at a sibling's tree refuses face-index-mismatch and the sibling stands — CONTROL: the face's own clear lands", async () => {
    const idbName = `fences-clear-${crypto.randomUUID()}`;
    const a = face("a"), b = face("b");
    await bindFirstFaceSlot(idbName, a, PASS);
    await bindFirstFaceSlot(idbName, b, PASS);
    await writeFaceRow(idbName, b, "recipe/1", new TextEncoder().encode("B's recipe"));
    lockFaceCustody(idbName, a); lockFaceCustody(idbName, b);
    const io = browserKeystoreCustodyIo(idbName);
    const index = JSON.parse(new TextDecoder().decode((await io.read("face-index"))!)) as { entries: { group: string; fcid: string }[] };
    const [ea, eb] = index.entries as [{ group: string; fcid: string }, { group: string; fcid: string }];
    const before = (await io.list()).filter((k) => k.includes(eb.fcid)).sort();
    // The tamper: A's clear index entry routes to B's tree.
    await io.write("face-index", new TextEncoder().encode(JSON.stringify({ entries: [{ group: ea.group, fcid: eb.fcid }, eb] })));
    await expect(clearFaceCustody(idbName, a, [PASS], () => true)).rejects.toMatchObject({ reading: "face-index-mismatch" });
    expect((await io.list()).filter((k) => k.includes(eb.fcid)).sort(), "every byte of B stands").toEqual(before);
    await io.write("face-index", new TextEncoder().encode(JSON.stringify({ entries: [ea, eb] })));
    expect((await clearFaceCustody(idbName, a, [PASS], () => true)).reading, "CONTROL: A's own clear lands").toBe("cleared");
    expect((await io.list()).filter((k) => k.includes(eb.fcid)).sort(), "and leaves B whole").toEqual(before);
  }, SLOW);
});

describe("a failed switch drops what its preflight seated", () => {
  test("FF3 RED a switch whose intent fails leaves the target locked — CONTROL: a landed switch holds the target", async () => {
    const idbName = `fences-switch-${crypto.randomUUID()}`;
    const a = face("a"), b = face("b");
    await bindFirstFaceSlot(idbName, a, PASS);
    await bindFirstFaceSlot(idbName, b, OTHER);
    lockFaceCustody(idbName, a); lockFaceCustody(idbName, b);
    const house = await stand(idbName);
    // A sibling session of A keeps the vessel up, so the failed switch's own close runs no whole-vessel lock.
    const keep = house.open({ tabId: "keep", face: a });
    await house.admit(keep.sessionId, { ask: async () => PASS });
    const s = house.open({ tabId: "t", face: a });
    await house.admit(s.sessionId, { ask: async () => PASS });
    await expect(house.switchFace(s.sessionId, b, { ask: async () => OTHER, intent: async () => { throw new Error("the intent did not rest"); } })).rejects.toThrow(/intent did not rest/);
    expect(faceCustodyHeld(idbName, b), "the failed switch's target stands locked").toBe(false);

    const s2 = house.open({ tabId: "t2", face: a });
    await house.admit(s2.sessionId, { ask: async () => PASS });
    await house.switchFace(s2.sessionId, b, { ask: async () => OTHER });
    expect(faceCustodyHeld(idbName, b), "CONTROL: a landed switch holds the target").toBe(true);
  }, SLOW);
});
