/**
 * K15 Wave D, slice 3: the unlock frame presents one typed credential where it is named. The node key opens alone, a face
 * opens by its own tree, and a key never rests over a floor.
 */
import { EventEmitter } from "node:events";
import type { Socket } from "node:net";
import { afterEach, describe, expect, test } from "vitest";
import type { SlotSpec } from "@lararium/mesh";
import { custodyFrameHandler } from "../src/custody-frames.js";
import { mountedFaceOrdinal, setMountedFace, sovereignStands } from "../src/node-vessel-identity.js";
import { FIXTURE_PASSPHRASE, seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

const slot = (passphrase: string): SlotSpec => ({ t: 1, pins: [{ kind: "passphrase", passphrase }] });
const cred = (passphrase: string) => [{ kind: "passphrase" as const, passphrase }];
let seat: SeatedScratchCustody | null = null;
afterEach(async () => { setMountedFace(undefined); await seat?.drop(); seat = null; });

async function vessel(faceRoutes: readonly string[]) {
  seat = await seatScratchCustody("unlock-per-face");
  const { holder } = seat;
  const fcids: string[] = [];
  for (const [i, route] of faceRoutes.entries()) fcids.push((await holder.foundFace({ group: `${String(i + 1).repeat(64)}`, slots: [slot(route)] })).fcid);
  await holder.lock();
  const composed: boolean[] = [];
  const handle = custodyFrameHandler({
    holder, testScratch: false, standing: () => "herm", onLog: () => {},
    recompose: async (sovereign) => { composed.push(sovereign); return { standing: sovereign ? "hearth" : "herm" }; },
  });
  const send = (frame: unknown): Promise<Record<string, unknown>> => new Promise((resolve) => {
    const sock = Object.assign(new EventEmitter(), { end: (line: string) => resolve(JSON.parse(line) as Record<string, unknown>) }) as unknown as Socket;
    handle(frame, sock);
  });
  return { holder, fcids, composed, send };
}

describe("one credential, tried where it is named", () => {
  test("CONTROL: the S route opens the node key and the one face that route fits; the composition stands and mounts that face", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE]);
    const a = await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE) });
    expect(a).toMatchObject({ op: "unlock", reading: "opens", held: true });
    expect(v.holder.unlockedFaces()).toEqual([v.fcids[0]]);
    expect(mountedFaceOrdinal()).toBe(0);
    expect(v.composed).toEqual([true]);
  });

  test("RED: two faces and none named refuse `face-not-named`, open no face, and drop the node key again", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, FIXTURE_PASSPHRASE]);
    const a = await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE) });
    expect(a).toMatchObject({ op: "unlock", reading: "face-not-named" });
    expect(v.holder.isUnlocked()).toBe(false);
    expect(v.holder.unlockedFaces()).toEqual([]);
    expect(v.composed).toEqual([]);
  });

  test("RED: a credential that opens the node key and not the named face refuses `face-refused`, and nothing stays open", async () => {
    const v = await vessel(["a-route-the-node-key-does-not-take"]);
    const a = await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), face: 0 });
    expect(a).toMatchObject({ op: "unlock", reading: "face-refused", face: 0, faceReading: "no-slot-opens" });
    expect(v.holder.isUnlocked()).toBe(false);
    expect(v.composed).toEqual([]);
  });

  test("CONTROL: `--face N` opens that face alone; the sibling stays shut; `--all` tries the credential on every tree", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, "the-second-face-route"]);
    const one = await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), face: 0 });
    expect(one).toMatchObject({ reading: "opens", held: true });
    expect(v.holder.unlockedFaces()).toEqual([v.fcids[0]]);
    const second = await v.send({ op: "unlock", credentials: cred("the-second-face-route"), face: 1 });
    expect(second).toMatchObject({ op: "unlock", reading: "already-unlocked", held: true });
    expect(new Set(v.holder.unlockedFaces())).toEqual(new Set(v.fcids));
    await v.holder.lock();
    const all = await v.send({ op: "unlock", credentials: [...cred(FIXTURE_PASSPHRASE), ...cred("the-second-face-route")], all: true });
    expect(all).toMatchObject({ reading: "opens", held: true });
    expect(new Set(v.holder.unlockedFaces())).toEqual(new Set(v.fcids));
  });
});

describe("the sovereign gate: the node key held AND the worn face unlocked", () => {
  test("RED: unlock S and the face, the vessel stands sovereign; lock the worn face, the gate reads the floor and the composition re-stands — CONTROL: locking a sibling leaves sovereign standing", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, "the-second-face-route"]);
    expect(sovereignStands()).toBe(false);                                   // nothing held: the floor
    const both = [...cred(FIXTURE_PASSPHRASE), ...cred("the-second-face-route")];
    await v.send({ op: "unlock", credentials: both, face: 1 });
    await v.send({ op: "unlock", credentials: both, face: 0 });                           // the last unlock names the worn face
    expect(new Set(v.holder.unlockedFaces())).toEqual(new Set(v.fcids));
    expect(sovereignStands()).toBe(true);
    const standingComposed = v.composed.length;
    const sibling = await v.send({ op: "lock", face: 1 });                   // CONTROL: face 1 is not worn
    expect(sibling).toMatchObject({ op: "lock", locked: true, face: 1 });
    expect(v.holder.unlockedFaces()).toEqual([v.fcids[0]]);
    expect(sovereignStands()).toBe(true);
    expect(v.composed).toHaveLength(standingComposed);                       // no recomposition for a sibling
    const worn = await v.send({ op: "lock", face: 0 });
    expect(worn).toMatchObject({ op: "lock", locked: true, face: 0, was: "unlocked" });
    expect(v.holder.isUnlocked()).toBe(true);                                // S stays held
    expect(sovereignStands()).toBe(false);                                   // the gate reads the floor
    expect(v.composed).toHaveLength(standingComposed + 1);                   // the composition re-stood through the gate
  });

  test("RED: the node key locked drops the gate whatever faces stand open", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE]);
    await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE) });
    expect(sovereignStands()).toBe(true);
    await v.send({ op: "lock" });
    expect(sovereignStands()).toBe(false);
  });
});

describe("the gate with no face, and with one that stays shut", () => {
  test("CONTROL: a place the floor index names no face for stands sovereign on the node key alone; RED: once a face stands, the node key alone leaves sovereign shut", async () => {
    seat = await seatScratchCustody("gate-no-face");
    expect(sovereignStands()).toBe(true);                                     // no face named: the node key alone
    await seat.holder.foundFace({ group: "1".repeat(64), slots: [slot(FIXTURE_PASSPHRASE)] });
    await seat.holder.lockFace((await seat.holder.faceStanding({ ordinal: 0 }))!.fcid);
    expect(seat.holder.isUnlocked()).toBe(true);                              // the node key stands held
    expect(seat.holder.unlockedFaces()).toEqual([]);
    expect(sovereignStands()).toBe(false);                                    // a face stands and none is open
  });
});
