/**
 * wear-frame — `op: "wear", face: N` on the custody door: unlock opens custody, wear chooses the face. A wear asks no route,
 * carries none and hands none to the composition it stands; it moves the mount to a face already open (under a pūlama, one
 * inside the lent set) and recomposes, and a composition that refuses wears the face it left.
 */
import { EventEmitter } from "node:events";
import type { Socket } from "node:net";
import { afterEach, describe, expect, test } from "vitest";
import type { SlotSpec } from "@lararium/mesh";
import { custodyFrameHandler } from "../src/custody-frames.js";
import type { CustodyHolder } from "../src/custody-holder.js";
import { mountedFaceOrdinal, setMountedFace, sovereignStands } from "../src/node-vessel-identity.js";
import type { WardCredential } from "../src/ward-credential.js";
import { FIXTURE_PASSPHRASE, seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

const slot = (passphrase: string): SlotSpec => ({ t: 1, pins: [{ kind: "passphrase", passphrase }] });
const cred = (passphrase: string) => [{ kind: "passphrase" as const, passphrase }];
const SECOND = "the-second-face-route";
let seat: SeatedScratchCustody | null = null;
afterEach(async () => { setMountedFace(undefined); await seat?.drop(); seat = null; });

function sender(handle: (parsed: unknown, sock: Socket) => boolean) {
  return (frame: unknown): Promise<Record<string, unknown>> => new Promise((resolve) => {
    const sock = Object.assign(new EventEmitter(), { end: (line: string) => resolve(JSON.parse(line) as Record<string, unknown>) }) as unknown as Socket;
    expect(handle(frame, sock)).toBe(true);
  });
}

/** A scratch vessel with faces under the routes named; `refuseWearing` names a face whose composition refuses to stand. */
/** What the stub composition does, settable mid-test: the mounts it refuses to stand on, and the mounts it throws on. */
interface Composing { readonly refuse: Set<number>; readonly throwOn: Set<number> }
async function vessel(faceRoutes: readonly string[], refuseWearing?: number, ctl: Composing = { refuse: new Set(), throwOn: new Set() }) {
  seat = await seatScratchCustody("wear-frame");
  const { holder } = seat;
  for (const [i, route] of faceRoutes.entries()) await holder.foundFace({ group: `${String(i + 1).repeat(64)}`, slots: [slot(route)] });
  await holder.lock();
  const composed: Array<{ sovereign: boolean; ward: WardCredential | undefined; mount: number | undefined }> = [];
  const logs: string[] = [];
  const handle = custodyFrameHandler({
    holder, testScratch: false, standing: () => "hearth", onLog: (l) => logs.push(l),
    recompose: async (sovereign, ward) => {
      composed.push({ sovereign, ward, mount: mountedFaceOrdinal() });
      if (sovereign && refuseWearing !== undefined && mountedFaceOrdinal() === refuseWearing) return { standing: "herm", refused: `h${refuseWearing} would not stand` };
      const m = mountedFaceOrdinal();
      if (sovereign && m !== undefined && ctl.throwOn.has(m)) throw new Error(`the composition wearing h${m} fell over`);
      if (sovereign && m !== undefined && ctl.refuse.has(m)) return { standing: "herm", refused: `h${m} would not stand` };
      return { standing: sovereign ? "hearth" : "herm" };
    },
  });
  return { holder, composed, logs, send: sender(handle), ctl };
}

describe("RED wear: the session's choice among the faces standing open, with no route", () => {
  test("wear-recomposes-sovereign-with-no-ward-credential, and wear-sets-the-mount-before-the-recompose", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, SECOND]);
    await v.send({ op: "unlock", credentials: [...cred(FIXTURE_PASSPHRASE), ...cred(SECOND)], all: true });
    expect(mountedFaceOrdinal()).toBe(0);
    v.composed.length = 0;
    const a = await v.send({ op: "wear", face: 1 });
    expect(a).toMatchObject({ op: "wear", face: 1, held: true, standing: "hearth" });
    expect(v.composed).toEqual([{ sovereign: true, ward: undefined, mount: 1 }]);
    expect(mountedFaceOrdinal()).toBe(1);
    expect(sovereignStands()).toBe(true);
  });

  test("wear-refuses-a-face-not-open: the mount stays and nothing recomposes", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, SECOND]);
    await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), all: true });
    v.composed.length = 0;
    expect(await v.send({ op: "wear", face: 1 })).toMatchObject({ op: "wear", status: "error", refusal: { reason: "face-not-open" } });
    expect(await v.send({ op: "wear", face: 7 })).toMatchObject({ op: "wear", status: "error", refusal: { reason: "face-not-open" } });
    expect(mountedFaceOrdinal()).toBe(0);
    expect(v.composed).toEqual([]);
  });

  test("wear-rolls-the-mount-back-when-the-composition-refuses, and keeps the node key", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, SECOND], 1);
    await v.send({ op: "unlock", credentials: [...cred(FIXTURE_PASSPHRASE), ...cred(SECOND)], all: true });
    v.composed.length = 0;
    const a = await v.send({ op: "wear", face: 1 });
    expect(a).toMatchObject({ op: "wear", face: 1, held: true, switchRefused: "h1 would not stand", wornAgain: 0, standing: "hearth" });
    expect(mountedFaceOrdinal()).toBe(0);
    expect(v.holder.isUnlocked()).toBe(true);
    expect(v.composed.map((c) => c.mount)).toEqual([1, 0]);
    expect(v.composed.every((c) => c.ward === undefined)).toBe(true);
  });

  test("wear-of-the-worn-face-recomposes-nothing", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, SECOND]);
    await v.send({ op: "unlock", credentials: [...cred(FIXTURE_PASSPHRASE), ...cred(SECOND)], all: true });
    v.composed.length = 0;
    expect(await v.send({ op: "wear", face: 0 })).toMatchObject({ op: "wear", face: 0, held: true, already: true });
    expect(v.composed).toEqual([]);
  });

  test("wear-frame-refuses-stray-keys-and-a-credential, before anything reads it", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, SECOND]);
    await v.send({ op: "unlock", credentials: [...cred(FIXTURE_PASSPHRASE), ...cred(SECOND)], all: true });
    v.composed.length = 0;
    const route = "a-route-that-rides-no-wear";
    const carried = await v.send({ op: "wear", face: 1, credentials: cred(route) });
    expect(carried).toMatchObject({ op: "wear", status: "error", refusal: { reason: "bad-custody-frame" } });
    for (const bad of [{ op: "wear" }, { op: "wear", face: -1 }, { op: "wear", face: "1" }, { op: "wear", face: 1.5 }]) {
      expect(await v.send(bad)).toMatchObject({ op: "wear", status: "error", refusal: { reason: "bad-custody-frame" } });
    }
    expect(v.composed).toEqual([]);
    expect(mountedFaceOrdinal()).toBe(0);
    expect(JSON.stringify([carried, v.logs])).not.toContain(route);
  });

  test("wear-while-custody-locked-refuses-and-recomposes-nothing (unlock owns that act)", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE]);
    expect(await v.send({ op: "wear", face: 0 })).toMatchObject({ op: "wear", status: "error", refusal: { reason: "custody-locked" } });
    expect(v.composed).toEqual([]);
  });

  test("CONTROL: the unlock's own switch still hands its route to the composition it stands", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE]);
    await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE) });
    expect(v.composed).toHaveLength(1);
    expect(v.composed[0]!.ward).toBeDefined();
  });
});

/** A door seated by a pūlama lending `lent`; the holder's faces stand open per `open`. */
function pulamaDoor(lent: readonly number[], open: readonly number[]) {
  const unlockFaceCalls: unknown[] = [];
  const composed: Array<number | undefined> = [];
  const holder = {
    isUnlocked: () => true, attemptsLeft: () => 0, openedSlot: () => "pulama", unlockedFaces: () => open.map((o) => `fcid-${o}`),
    faceStanding: async ({ ordinal }: { ordinal: number }) => (open.includes(ordinal) || lent.includes(ordinal) ? { ordinal, fcid: `fcid-${ordinal}`, unlocked: open.includes(ordinal) } : null),
    unlockFace: async (face: unknown) => { unlockFaceCalls.push(face); return { reading: "attempts-spent" }; },
    unlockFaces: async () => { unlockFaceCalls.push("all"); return []; },
    unlock: async () => ({ reading: "already-unlocked" }), lock: async () => {},
  } as unknown as CustodyHolder;
  const handle = custodyFrameHandler({
    holder, testScratch: false, standing: () => "hearth", onLog: () => {},
    recompose: async () => { composed.push(mountedFaceOrdinal()); return { standing: "hearth" }; },
    pulama: { standing: () => ({ session: true, waits: null }), dial: async () => ({ session: true, waits: null }), lent: () => lent },
  });
  return { send: sender(handle), unlockFaceCalls, composed };
}

describe("RED wear under a pūlama: the lent set bounds it", () => {
  test("wear-under-a-pulama-takes-a-lent-face and calls no holder unlock", async () => {
    setMountedFace(0);
    const d = pulamaDoor([0, 2], [0, 2]);
    expect(await d.send({ op: "wear", face: 2 })).toMatchObject({ op: "wear", face: 2, held: true });
    expect(d.composed).toEqual([2]);
    expect(d.unlockFaceCalls).toEqual([]);
  });

  test("wear-under-a-pulama-refuses-a-face-outside-the-lend, naming the lent set", async () => {
    setMountedFace(0);
    const d = pulamaDoor([0, 2], [0, 1, 2]);
    const a = await d.send({ op: "wear", face: 1 });
    expect(a).toMatchObject({ op: "wear", status: "error", refusal: { reason: "face-not-lent", lent: [0, 2] } });
    expect(d.composed).toEqual([]);
    expect(mountedFaceOrdinal()).toBe(0);
    expect(d.unlockFaceCalls).toEqual([]);
  });
});

describe("RED wear's rollback: a key never rests over a floor", () => {
  test("wear-rollback-that-also-refuses-locks-and-answers-not-held", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, SECOND]);
    await v.send({ op: "unlock", credentials: [...cred(FIXTURE_PASSPHRASE), ...cred(SECOND)], all: true });
    v.ctl.refuse.add(0); v.ctl.refuse.add(1);
    const a = await v.send({ op: "wear", face: 1 });
    expect(a).toMatchObject({ op: "wear", face: 1, held: false, switchRefused: "h1 would not stand" });
    expect(a["held"]).not.toBe(true);
    expect(v.holder.isUnlocked()).toBe(false);
  });

  test("wear-whose-recompose-throws-restores-the-prior-mount", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, SECOND]);
    await v.send({ op: "unlock", credentials: [...cred(FIXTURE_PASSPHRASE), ...cred(SECOND)], all: true });
    v.ctl.throwOn.add(1);
    const a = await v.send({ op: "wear", face: 1 });
    expect(a).toMatchObject({ op: "wear", status: "error" });
    expect(mountedFaceOrdinal()).toBe(0);
  });

  test("CONTROL: a rollback that stands keeps the key and answers held on the face it left", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, SECOND]);
    await v.send({ op: "unlock", credentials: [...cred(FIXTURE_PASSPHRASE), ...cred(SECOND)], all: true });
    v.ctl.refuse.add(1);
    expect(await v.send({ op: "wear", face: 1 })).toMatchObject({ held: true, wornAgain: 0 });
    expect(v.holder.isUnlocked()).toBe(true);
  });
});
