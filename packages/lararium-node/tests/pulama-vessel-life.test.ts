/**
 * pulama-vessel-life — each vessel life names itself at the hello, and the pūlama reads the life its own hearth names.
 *
 * A vessel's store claim mints a fresh life id at `<hearth>/vessel/.life`, and claims run one at a time, so a hearth naming
 * another life proves a dropped life ended, and its memory (any save it never sealed) ended with it. The hello carries
 * `life: { id }`; the pūlama checks it against the life its own storage home names. A drop that names its life clears once
 * the hearth names another life, or once that same life comes back and answers the close; a drop with no life waits on the
 * operator's hand, and a hearth that names no life proves nothing. A first close of a face no live session lends holds while
 * a life this pūlama lent it ended without coming back and the hearth still names that life.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { pulamaStandBy } from "../src/pulama-seat.js";
import { fixtureSlots, lend, openGate, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const GROUP_A = "group-life-a";

let fx: PulamaFixture | null = null;
afterEach(async () => { await fx?.drop(); fx = null; });

/** A vessel life id: `n` spelled as the id's one shape (32 lowercase hex characters). */
const L = (n: number): string => n.toString(16).padStart(32, "0");

/** Set the life the hearth names at rest (null removes it; a string rests as written, torn or not). */
function hearth(f: PulamaFixture, life: number | string | null): void {
  const dir = f.seat.homes.storage;
  mkdirSync(dir, { recursive: true });
  if (life === null) rmSync(join(dir, ".life"), { force: true });
  else writeFileSync(join(dir, ".life"), `${typeof life === "number" ? L(life) : life}\n`);
}

async function standOne(label: string, life: number | null) {
  fx = await standPulama(label, () => openGate({ faces: lend(0), coldReads: [] }));
  hearth(fx, life);
  const a = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
  return { f: fx, a };
}

const settle = async (): Promise<void> => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };

describe("a dropped close clears by the vessel life it names", () => {
  test("DEAD LIFE: a session of life 3 drops its close; the hearth names life 4; the drop clears and a plain close locks, no force", async () => {
    const { f, a } = await standOne("life-dead", 3);
    const vessel = f.vessel({}, { id: L(3) });
    await vessel.unlock([]);
    expect(await f.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 1 });
    await vessel.lock();
    await vi.waitFor(() => expect(f.server.closing()).toMatchObject([{ face: 0, unanswered: 0, dropped: 1 }]));
    expect(f.server.closing()[0]!.note).toContain(`life ${L(3)}`);
    expect(await f.server.closeFace(0), "the life may still stand: no lock").toMatchObject({ reading: "closing" });
    expect(f.kept.unlockedFaces()).toContain(a.fcid);
    hearth(f, 4);
    expect(f.server.closing(), "a hearth naming another life clears its drop").toEqual([{ face: 0, unanswered: 0, note: "face h0: no session still owes its close; close it again to lock it, or force it by hand" }]);
    expect(await f.server.closeFace(0)).toEqual({ reading: "locked", face: 0 });
    expect(f.kept.unlockedFaces()).not.toContain(a.fcid);
  });

  test("SAME LIFE: the vessel of life 3 comes back under a new session, the close asked again tells it, and its answer locks the key", async () => {
    const { f, a } = await standOne("life-same", 3);
    const first = f.vessel({}, { id: L(3) });
    await first.unlock([]);
    expect(await f.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 1 });
    await first.lock();
    await vi.waitFor(() => expect(f.server.closing()).toMatchObject([{ dropped: 1 }]));
    const back = f.vessel({}, { id: L(3) });
    await back.unlock([]);
    const heard: string[] = [];
    back.onClosing!((fcid) => heard.push(fcid));
    expect(await f.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 1 });
    await vi.waitFor(() => expect(heard).toEqual([a.fcid]));
    await back.faceClosed!(a.fcid, f.kept.faceOpening!(a.fcid));
    await vi.waitFor(() => expect(f.kept.unlockedFaces()).not.toContain(a.fcid));
    expect(f.server.closing()).toEqual([]);
  });

  test("NO LIFE: a hello that names no life, or a life the hearth does not read, drops a close only the operator's hand clears", async () => {
    for (const [label, life] of [["life-none", undefined], ["life-mismatch", { id: L(2) }], ["life-malformed", { id: "3" }]] as const) {
      const { f, a } = await standOne(label, 3);
      const vessel = f.vessel({}, life);
      await vessel.unlock([]);
      expect(await f.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 1 });
      await vessel.lock();
      await vi.waitFor(() => expect(f.server.closing()).toMatchObject([{ dropped: 1 }]));
      hearth(f, 9);
      expect(await f.server.closeFace(0), `${label}: no hearth life clears a drop that names no life`).toMatchObject({ reading: "closing" });
      expect(f.kept.unlockedFaces()).toContain(a.fcid);
      expect(await f.server.closeFace(0, { force: true })).toMatchObject({ reading: "locked", forced: true });
      await f.drop(); fx = null;
    }
  });

  test("UNREAD: a hearth that names no life (absent or torn) proves nothing, and the drop waits; a hearth naming another life clears it", async () => {
    const { f, a } = await standOne("life-unread", 3);
    const vessel = f.vessel({}, { id: L(3) });
    await vessel.unlock([]);
    expect(await f.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 1 });
    await vessel.lock();
    await vi.waitFor(() => expect(f.server.closing()).toMatchObject([{ dropped: 1 }]));
    for (const torn of [null, "not-a-life", L(3).slice(1)]) {
      hearth(f, torn);
      expect(await f.server.closeFace(0)).toMatchObject({ reading: "closing" });
      expect(f.kept.unlockedFaces()).toContain(a.fcid);
    }
    hearth(f, 1);
    expect(await f.server.closeFace(0), "the hearth names a life other than the dropped one").toEqual({ reading: "locked", face: 0 });
    expect(f.kept.unlockedFaces()).not.toContain(a.fcid);
  });

  test("a told session's answer clears its life's drop as it lands: one session of the life drops, another of the same life answers, and the key locks", async () => {
    const { f, a } = await standOne("life-answer", 5);
    const one = f.vessel({}, { id: L(5) });
    await one.unlock([]);
    const two = f.vessel({}, { id: L(5) });
    await two.unlock([]);
    expect(await f.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 2 });
    await one.lock();
    await vi.waitFor(() => expect(f.server.closing()).toMatchObject([{ unanswered: 1, dropped: 1 }]));
    await two.faceClosed!(a.fcid, f.kept.faceOpening!(a.fcid));
    await vi.waitFor(() => expect(f.kept.unlockedFaces()).not.toContain(a.fcid));
  });
});

describe("a first close reads the lives this pūlama lent the face", () => {
  test("ENDED BEFORE THE CLOSE: life 3 lent the face and left before any close; the close holds, naming its clearing line, until the hearth names another life", async () => {
    const { f, a } = await standOne("life-before", 3);
    const vessel = f.vessel({}, { id: L(3) });
    await vessel.unlock([]);
    await vessel.lock();
    await vi.waitFor(() => expect(f.server.sessions()).toBe(0));
    expect(await f.server.closeFace(0)).toMatchObject({ reading: "closing", face: 0, unanswered: 0 });
    expect(f.kept.unlockedFaces()).toContain(a.fcid);
    const [held] = f.server.closing();
    expect(held).toMatchObject({ face: 0, unanswered: 0, dropped: 1 });
    expect(held!.note).toContain("ended its session before the close");
    expect(held!.note).toContain(`life ${L(3)}`);
    hearth(f, 4);
    expect(await f.server.closeFace(0)).toEqual({ reading: "locked", face: 0 });
    expect(f.kept.unlockedFaces()).not.toContain(a.fcid);
  });

  test("ENDED BEFORE, CAME BACK: the same life returns, the close asked again tells it, and its answer locks", async () => {
    const { f, a } = await standOne("life-before-back", 3);
    const first = f.vessel({}, { id: L(3) });
    await first.unlock([]);
    await first.lock();
    await vi.waitFor(() => expect(f.server.sessions()).toBe(0));
    expect(await f.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 0 });
    const back = f.vessel({}, { id: L(3) });
    await back.unlock([]);
    expect(await f.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 1 });
    await back.faceClosed!(a.fcid, f.kept.faceOpening!(a.fcid));
    await vi.waitFor(() => expect(f.kept.unlockedFaces()).not.toContain(a.fcid));
  });

  test("LENT BEFORE IT FOUNDED: a life lent the face by ordinal before the face stood (no custody id at its hello) and ended; the first close still holds on it", async () => {
    fx = await standPulama("life-before-founded", () => openGate({ faces: lend(0), coldReads: [] }));
    hearth(fx, 3);
    const early = fx.vessel({}, { id: L(3) });
    await early.unlock([]);
    await early.lock();
    await vi.waitFor(() => expect(fx!.server.sessions()).toBe(0));
    const a = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    expect(await fx.server.closeFace(0)).toMatchObject({ reading: "closing", face: 0, unanswered: 0 });
    expect(fx.kept.unlockedFaces()).toContain(a.fcid);
    hearth(fx, 4);
    expect(await fx.server.closeFace(0)).toEqual({ reading: "locked", face: 0 });
  });

  test("A LEND OF ANOTHER FACE AT THE ORDINAL: a life whose lend named another custody id at that ordinal never served this face, and holds no first close", async () => {
    fx = await standPulama("life-other-fcid", () => openGate({ faces: lend({ fcid: "fcid-of-another-face", ordinal: 0 }), coldReads: [] }));
    hearth(fx, 3);
    const other = fx.vessel({}, { id: L(3) });
    await other.unlock([]);
    await other.lock();
    await vi.waitFor(() => expect(fx!.server.sessions()).toBe(0));
    const a = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    expect(await fx.server.closeFace(0)).toEqual({ reading: "locked", face: 0 });
    expect(fx.kept.unlockedFaces()).not.toContain(a.fcid);
  });

  test("DEAD BEFORE THE CLOSE, OR NO LIFE: a life the hearth no longer names, or a session that named none, holds no first close", async () => {
    const { f, a } = await standOne("life-before-dead", 3);
    const dead = f.vessel({}, { id: L(3) });
    await dead.unlock([]);
    await dead.lock();
    const bare = f.vessel();
    await bare.unlock([]);
    await bare.lock();
    await vi.waitFor(() => expect(f.server.sessions()).toBe(0));
    hearth(f, 4);
    expect(await f.server.closeFace(0)).toEqual({ reading: "locked", face: 0 });
    expect(f.kept.unlockedFaces()).not.toContain(a.fcid);
    await settle();
  });
});

describe("a clean goodbye: a vessel that drained every save tells its pūlama so, naming its life", () => {
  test("★ GOODBYE BEFORE A FIRST CLOSE: life 3 lent the face, drained, said goodbye and left; the first close locks at once, the hearth still naming life 3, no force ★", async () => {
    const { f, a } = await standOne("goodbye-first-close", 3);
    const vessel = f.vessel({}, { id: L(3) });
    await vessel.unlock([]);
    expect(await vessel.goodbye(), "the pūlama heard it").toBe(true);
    await vi.waitFor(() => expect(f.server.sessions(), "the goodbye ends the session").toBe(0));
    expect(vessel.isUnlocked()).toBe(false);
    expect(await f.server.closeFace(0)).toEqual({ reading: "locked", face: 0 });
    expect(f.kept.unlockedFaces()).not.toContain(a.fcid);
  });

  test("GOODBYE ANSWERS A TOLD CLOSE: a session told to close says goodbye in place of face.closed, and the key locks", async () => {
    const { f, a } = await standOne("goodbye-told", 3);
    const vessel = f.vessel({}, { id: L(3) });
    await vessel.unlock([]);
    expect(await f.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 1 });
    expect(await vessel.goodbye()).toBe(true);
    await vi.waitFor(() => expect(f.kept.unlockedFaces()).not.toContain(a.fcid));
    expect(f.server.closing()).toEqual([]);
  });

  test("GOODBYE CLEARS ITS LIFE'S DROP: a session of life 3 dropped its close; the same life comes back and says goodbye; the key locks", async () => {
    const { f, a } = await standOne("goodbye-drop", 3);
    const first = f.vessel({}, { id: L(3) });
    await first.unlock([]);
    expect(await f.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 1 });
    await first.lock();
    await vi.waitFor(() => expect(f.server.closing()).toMatchObject([{ dropped: 1 }]));
    const back = f.vessel({}, { id: L(3) });
    await back.unlock([]);
    expect(await back.goodbye()).toBe(true);
    await vi.waitFor(() => expect(f.kept.unlockedFaces()).not.toContain(a.fcid));
  });

  test("AN UNSENT OR UNHEARD GOODBYE CHANGES NOTHING: no life to name, or a life the hearth does not read, and the first close holds as before", async () => {
    for (const [label, life] of [["goodbye-no-life", undefined], ["goodbye-mismatch", { id: L(2) }]] as const) {
      const { f, a } = await standOne(label, 3);
      const named = f.vessel({}, { id: L(3) });
      await named.unlock([]);
      await named.lock();
      const vessel = f.vessel({}, life);
      await vessel.unlock([]);
      expect(await vessel.goodbye(), `${label}: no goodbye stands`).toBe(false);
      await vi.waitFor(() => expect(f.server.sessions()).toBe(0));
      expect(await f.server.closeFace(0), `${label}: life 3's lend still holds the first close`).toMatchObject({ reading: "closing", unanswered: 0, face: 0 });
      expect(f.kept.unlockedFaces()).toContain(a.fcid);
      await f.drop(); fx = null;
    }
  });

  test("A GOODBYE SPEAKS FOR ITS OWN LIFE ALONE: life 3's goodbye leaves life 5's lend holding the first close", async () => {
    const { f, a } = await standOne("goodbye-other-life", 5);
    const five = f.vessel({}, { id: L(5) });
    await five.unlock([]);
    await five.lock();
    hearth(f, 3);
    const three = f.vessel({}, { id: L(3) });
    await three.unlock([]);
    expect(await three.goodbye()).toBe(true);
    await vi.waitFor(() => expect(f.server.sessions()).toBe(0));
    hearth(f, 5);   // the hearth names life 5 again: its lend stands, unproven ended
    expect(await f.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 0 });
    expect(f.kept.unlockedFaces()).toContain(a.fcid);
  });

  test("THE STAND-BY SAYS IT: a goodbye through the stand-by ends the session and composes no floor after it; CONTROL: a plain drop composes the floor", async () => {
    const { f } = await standOne("goodbye-standby", 3);
    for (const leave of ["goodbye", "drop"] as const) {
      const vessel = f.vessel({}, { id: L(3) });
      const composed: boolean[] = [];
      const by = pulamaStandBy({ holder: vessel, onLog: () => {}, recompose: async (sovereign) => { composed.push(sovereign); return { standing: "hearth" }; } });
      expect(await by.dial()).toEqual({ session: true, waits: null });
      if (leave === "goodbye") expect(await by.goodbye()).toBe(true);
      else await vessel.lock();
      await vi.waitFor(() => expect(f.server.sessions()).toBe(0));
      await settle();
      expect(composed, leave).toEqual(leave === "goodbye" ? [true] : [true, false]);
    }
  });

  test("A LIFE THAT CAME BACK AFTER ITS GOODBYE lends again, and its next leaving holds the first close as before", async () => {
    const { f, a } = await standOne("goodbye-back", 3);
    const first = f.vessel({}, { id: L(3) });
    await first.unlock([]);
    expect(await first.goodbye()).toBe(true);
    await vi.waitFor(() => expect(f.server.sessions()).toBe(0));
    const back = f.vessel({}, { id: L(3) });
    await back.unlock([]);
    await back.lock();
    await vi.waitFor(() => expect(f.server.sessions()).toBe(0));
    expect(await f.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 0 });
    expect(f.kept.unlockedFaces()).toContain(a.fcid);
  });
});
