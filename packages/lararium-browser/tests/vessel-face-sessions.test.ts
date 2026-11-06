/**
 * vessel-face-sessions — A SESSION WEARS ONE FACE (browser-vessel-lift slice 3 part ii; k15-wave-b-lane; k19-hive-lane).
 *
 *   VF1 RED the stranger's port: a session the house never minted, and one it never admitted, read no sealed body and refuse
 *       by name. CONTROL (same face): another admitted session of the face reads, and an admitted same-face port receives
 *       its body.
 *   VF2 RED one Keyhive provider per unlocked face: face A lights at its first admitted session and drops at its last,
 *       through the provider door (`daemon:face-lit` / `daemon:face-drop`), while face B stays lit and keeps reading; A's
 *       last close overwrites A's key alone; the vessel stays up until the last session of every face closes.
 *   VF3 RED sibling sealing: the asker's session seals; with the asker gone, another admitted unlocked session of the SAME
 *       face seals; a session of another face never does, and the work names `seal-awaits-session`.
 *   VF4 RED a session acts only as the face it wears, booked by request id: a booking for another face refuses
 *       `face-not-worn`; a booking spends once.
 *   VF5 RED `face` rides every ask, and a clear names one face: a faceless clear refuses `clear-face-absent`, a clear of
 *       another face refuses `face-not-worn`, and `h<N>` never names a face.
 *   VF6 RED `no-custody-slot`: a face with no slot tree admits nothing until a secret's mint binds one (asked as
 *       `bind-first`, naming the face).
 *   VF7 RED the face switch's fence (row `B8`): the switch freezes the session's calls, admits the target face by the
 *       session's OWN unlock, fences the old generation (its bookings retire, its acts end), advances the generation and
 *       moves the face; a refused preflight leaves the old face and generation live.
 *
 * Faces and secrets stay synthetic, over scratch stores. Each face's tree derives with scrypt, so the cases run slow.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { afterEach, describe, expect, test } from "vitest";
import { bindFirstFaceSlot, faceCustodyHeld, lockFaceCustody, writeFaceRow } from "../src/browser-face-custody.js";
import { standVesselHouse, type HouseAsk, type LitVessel, type VesselHouse } from "../src/vessel-sessions.js";

const SLOW = 300_000;
const PASS_A = { kind: "passphrase", passphrase: "face A keeps its own fire" } as const;
const PASS_B = { kind: "passphrase", passphrase: "face B keeps another fire" } as const;
const face = (tag: string): string => `pg-${tag}-${crypto.randomUUID()}`;
const text = (b: Uint8Array | null): string | null => b === null ? null : new TextDecoder().decode(b);

const houses: VesselHouse[] = [];
afterEach(async () => { for (const h of houses.splice(0)) await h.release().catch(() => undefined); });

function fakeVessel() {
  const v = { lit: 0, closed: 0 };
  return { v, light: (): Promise<LitVessel> => { v.lit++; return Promise.resolve({ close: async () => { v.closed++; } }); } };
}
function providers() {
  const log: string[] = [];
  return { log, doors: { lit: async (f: string) => { log.push(`lit ${f}`); }, drop: async (f: string, why: string) => { log.push(`drop ${f} ${why}`); } } };
}
/** A tab's ceremony: it answers each ask with its route and keeps every ask it heard, face and all. */
function tab(route: typeof PASS_A | null) {
  const asked: HouseAsk[] = [];
  return { asked, ask: (q: HouseAsk) => { asked.push(q); return Promise.resolve(route); } };
}
/** A store with faces A and B founded, each under its own tree and a row of its own, both locked as a fresh worker stands. */
async function twoFaces(tag: string): Promise<{ idbName: string; a: string; b: string }> {
  const idbName = `face-sessions-${tag}-${crypto.randomUUID()}`;
  const a = face("a"), b = face("b");
  await bindFirstFaceSlot(idbName, a, PASS_A);
  await bindFirstFaceSlot(idbName, b, PASS_B);
  await writeFaceRow(idbName, a, "recipe/1", new TextEncoder().encode("A's recipe"));
  await writeFaceRow(idbName, b, "ledger/1", new TextEncoder().encode("B's ledger"));
  lockFaceCustody(idbName, a); lockFaceCustody(idbName, b);
  return { idbName, a, b };
}
async function stand(idbName: string, extra: Partial<Parameters<typeof standVesselHouse>[0]> = {}): Promise<VesselHouse> {
  const house = await standVesselHouse({ idbName, light: fakeVessel().light, ...extra });
  houses.push(house);
  return house;
}

describe("the stranger's port and the same face", () => {
  test("VF1 RED a session never minted and one never admitted read no body — CONTROL: same-face sessions read their bodies", async () => {
    const { idbName, a } = await twoFaces("stranger");
    const house = await stand(idbName);
    await expect(house.body("a-port-from-another-page", "recipe/1")).rejects.toMatchObject({ refusal: "unknown-session" });
    const a1 = house.open({ tabId: "a1", face: a }), a2 = house.open({ tabId: "a2", face: a });
    await expect(house.body(a2.sessionId, "recipe/1"), "an unadmitted port of the same face reads nothing").rejects.toMatchObject({ refusal: "session-unadmitted" });
    await house.admit(a1.sessionId, { ask: tab(PASS_A).ask });
    expect(text(await house.body(a1.sessionId, "recipe/1")), "CONTROL: the admitted port receives its body").toBe("A's recipe");
    await expect(house.body(a2.sessionId, "recipe/1"), "A1's unlock admits no sibling").rejects.toMatchObject({ refusal: "session-unadmitted" });
    const t2 = tab(PASS_A);
    await house.admit(a2.sessionId, { ask: t2.ask });
    expect(t2.asked.map((q) => q.kind), "the sibling proves its own unlock").toEqual(["unlock"]);
    expect(text(await house.body(a2.sessionId, "recipe/1")), "CONTROL: another admitted session of the same face reads").toBe("A's recipe");
  }, SLOW);
});

describe("one provider per unlocked face", () => {
  test("VF2 RED face A lights and drops apart from face B; A's last close overwrites A's key alone", async () => {
    const { idbName, a, b } = await twoFaces("providers");
    const { v, light } = fakeVessel();
    const p = providers();
    const house = await stand(idbName, { light, providers: p.doors });
    const a1 = house.open({ tabId: "a1", face: a }), a2 = house.open({ tabId: "a2", face: a }), b1 = house.open({ tabId: "b1", face: b });
    await house.admit(a1.sessionId, { ask: tab(PASS_A).ask });
    await house.admit(b1.sessionId, { ask: tab(PASS_B).ask });
    await house.admit(a2.sessionId, { ask: tab(PASS_A).ask });
    expect(p.log, "one provider per face, lit at its first admitted session").toEqual([`lit ${a}`, `lit ${b}`]);
    expect(v.lit, "one vessel for every face").toBe(1);
    expect(house.faceCensus()).toEqual({ lit: 2, faceKeys: 2 });

    await house.close(a1.sessionId, "pagehide");
    expect(p.log.length, "A's sibling still stands: no drop").toBe(2);
    expect(faceCustodyHeld(idbName, a)).toBe(true);
    await house.close(a2.sessionId, "pagehide");
    expect(p.log).toEqual([`lit ${a}`, `lit ${b}`, `drop ${a} pagehide`]);
    expect(faceCustodyHeld(idbName, a), "A's last session overwrote A's key").toBe(false);
    expect(faceCustodyHeld(idbName, b), "B's key stands").toBe(true);
    expect(house.floor(), "the vessel stays up for B").toBe("lit");
    expect(v.closed).toBe(0);
    expect(text(await house.body(b1.sessionId, "ledger/1")), "CONTROL: B reads on").toBe("B's ledger");

    await house.close(b1.sessionId, "pagehide");
    expect(p.log.at(-1)).toBe(`drop ${b} pagehide`);
    expect(house.floor()).toBe("floor");
    expect(v.closed).toBe(1);
    expect(house.faceCensus()).toEqual({ lit: 0, faceKeys: 0 });
  }, SLOW);
});

describe("the asker's session seals", () => {
  test("VF3 RED with the asker gone a same-face session seals; another face never does (seal-awaits-session)", async () => {
    const { idbName, a, b } = await twoFaces("seal");
    const house = await stand(idbName);
    const a1 = house.open({ tabId: "a1", face: a }), a2 = house.open({ tabId: "a2", face: a }), b1 = house.open({ tabId: "b1", face: b });
    for (const [s, route] of [[a1, PASS_A], [a2, PASS_A], [b1, PASS_B]] as const) await house.admit(s.sessionId, { ask: tab(route).ask });

    expect(await house.seal(a1.sessionId, a, async (sealer) => sealer.sessionId), "the asker's own session seals").toBe(a1.sessionId);
    await expect(house.seal(b1.sessionId, a, async () => "sealed"), "a session of another face never seals for A").rejects.toMatchObject({ refusal: "face-not-worn" });
    await house.close(a1.sessionId, "pagehide");
    expect(await house.seal(a1.sessionId, a, async (sealer) => sealer.sessionId), "the sibling of the same face seals").toBe(a2.sessionId);
    await house.close(a2.sessionId, "pagehide");
    let ran = false;
    await expect(house.seal(a1.sessionId, a, async () => { ran = true; }), "B stands, and B never seals A's row").rejects.toMatchObject({ refusal: "seal-awaits-session" });
    expect(ran).toBe(false);
  }, SLOW);

  test("VF4 RED a session acts only as the face it wears, booked by request id; a booking spends once", async () => {
    const { idbName, a, b } = await twoFaces("booking");
    const house = await stand(idbName);
    const a1 = house.open({ tabId: "a1", face: a });
    await house.admit(a1.sessionId, { ask: tab(PASS_A).ask });
    expect(() => house.book(a1.sessionId, "req-1", b)).toThrow(/face-not-worn/);
    house.book(a1.sessionId, "req-2", a);
    expect(() => house.book(a1.sessionId, "req-2", a), "one id books once").toThrow(/request-booked/);
    expect(house.spend("req-2")).toEqual({ sessionId: a1.sessionId, face: a, generation: 0 });
    expect(() => house.spend("req-2"), "the booking spent").toThrow(/request-unbooked/);
    expect(() => house.spend("req-never")).toThrow(/request-unbooked/);
  }, SLOW);
});

describe("the face on every ask, and the clear that names one", () => {
  test("VF5 RED every ask names the session's face; a clear names one face; h<N> names none", async () => {
    const { idbName, a, b } = await twoFaces("asks");
    const house = await stand(idbName);
    expect(() => house.open({ tabId: "t", face: "h0" })).toThrow(/face-names-a-handle/);
    const a1 = house.open({ tabId: "a1", face: a });
    const t = tab(PASS_A);
    await house.admit(a1.sessionId, { ask: t.ask });
    expect(t.asked.length).toBeGreaterThan(0);
    for (const q of t.asked) expect(q.face, "the ask names the face it speaks for").toBe(a);

    await expect(house.clear(a1.sessionId, { face: null, ask: t.ask, confirm: () => true })).rejects.toMatchObject({ refusal: "clear-face-absent" });
    await expect(house.clear(a1.sessionId, { face: undefined as unknown as string, ask: t.ask, confirm: () => true })).rejects.toMatchObject({ refusal: "clear-face-absent" });
    await expect(house.clear(a1.sessionId, { face: b, ask: t.ask, confirm: () => true })).rejects.toMatchObject({ refusal: "face-not-worn" });
    expect(await house.clear(a1.sessionId, { face: a, ask: t.ask, confirm: () => false })).toMatchObject({ reading: "asked" });
    expect(t.asked.at(-1)).toMatchObject({ kind: "clear", face: a });
  }, SLOW);

  test("VF6 RED a face with no slot tree admits nothing (no-custody-slot) until a secret's mint binds one, asked naming the face", async () => {
    const idbName = `face-sessions-noslot-${crypto.randomUUID()}`;
    const c = face("c");
    const house = await stand(idbName);
    const c1 = house.open({ tabId: "c1", face: c });
    await expect(house.admit(c1.sessionId, { ask: tab(PASS_A).ask })).rejects.toMatchObject({ refusal: "no-custody-slot" });
    expect(c1.admission).toBe("unadmitted");
    const t = tab(PASS_A);
    await house.admit(c1.sessionId, { ask: t.ask, secretMintDue: true });
    expect(t.asked).toEqual([{ kind: "bind-first", why: "face-secret-mint-due", face: c }]);
    expect(c1.admittedBy).toBe("bind-first");
    expect(faceCustodyHeld(idbName, c)).toBe(true);
  }, SLOW);
});

describe("the face switch (row B8)", () => {
  test("VF7 RED the switch admits the target by the session's own unlock, fences the old generation and advances — a refused preflight leaves A live", async () => {
    const { idbName, a, b } = await twoFaces("switch");
    const p = providers();
    const house = await stand(idbName, { providers: p.doors });
    const s = house.open({ tabId: "s", face: a });
    await house.admit(s.sessionId, { ask: tab(PASS_A).ask });
    house.book(s.sessionId, "req-old", a);

    // A refused preflight (the person declines B's unlock) leaves A's generation live.
    await expect(house.switchFace(s.sessionId, b, { ask: tab(null).ask })).rejects.toMatchObject({ refusal: "admission-declined" });
    expect({ face: s.face, generation: s.generation, admission: s.admission }).toEqual({ face: a, generation: 0, admission: "admitted" });
    expect(text(await house.body(s.sessionId, "recipe/1"))).toBe("A's recipe");

    const steps: string[] = [];
    const inFlight = house.act(s.sessionId, () => new Promise<never>(() => { /* never answers */ })).then(() => null, (e: unknown) => e);
    const t = tab(PASS_B);
    await house.switchFace(s.sessionId, b, { ask: t.ask, intent: async (i) => { steps.push(`intent ${i.from}->${i.to}`); }, outcome: async (o) => { steps.push(`outcome ${o.generation}`); } });
    expect(t.asked.map((q) => [q.kind, q.face]), "the target face admits by the session's own unlock").toEqual([["unlock", b]]);
    expect(steps).toEqual([`intent ${a}->${b}`, "outcome 1"]);
    expect(await inFlight, "the old generation's act ends").toMatchObject({ refusal: "lock-ended" });
    expect(() => house.spend("req-old"), "the old generation's booking retires").toThrow(/request-unbooked/);
    expect({ face: s.face, generation: s.generation, admission: s.admission }).toEqual({ face: b, generation: 1, admission: "admitted" });
    expect(p.log, "A's last session left A: its provider drops; B lights").toEqual([`lit ${a}`, `drop ${a} face-switch`, `lit ${b}`]);
    expect(faceCustodyHeld(idbName, a)).toBe(false);
    expect(text(await house.body(s.sessionId, "ledger/1"))).toBe("B's ledger");
    await expect(house.body(s.sessionId, "recipe/1"), "the session reads as B alone now").rejects.toMatchObject({ refusal: "body-absent" });
  }, SLOW);
});
