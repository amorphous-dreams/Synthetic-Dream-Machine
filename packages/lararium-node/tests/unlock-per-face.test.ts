/**
 * K15 Wave D, slice 3: the unlock frame presents one typed credential where it is named. The node key opens alone, a face
 * opens by its own tree, and a key never rests over a floor.
 */
import { EventEmitter } from "node:events";
import type { Socket } from "node:net";
import { afterEach, describe, expect, test } from "vitest";
import type { SlotSpec } from "@lararium/mesh/keyslot-door";
import { custodyFrameHandler } from "../src/custody-frames.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { mountedFaceOrdinal, setMountedFace, sovereignStands } from "../src/node-vessel-identity.js";
import { FIXTURE_PASSPHRASE, seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

const slot = (passphrase: string): SlotSpec => ({ t: 1, pins: [{ kind: "passphrase", passphrase }] });
const cred = (passphrase: string) => [{ kind: "passphrase" as const, passphrase }];
let seat: SeatedScratchCustody | null = null;
afterEach(async () => { setMountedFace(undefined); await seat?.drop(); seat = null; });

async function vessel(faceRoutes: readonly string[], refuseWearing?: number | readonly number[], groups?: readonly string[]) {
  seat = await seatScratchCustody("unlock-per-face");
  const { holder } = seat;
  const fcids: string[] = [];
  for (const [i, route] of faceRoutes.entries()) fcids.push((await holder.foundFace({ group: groups?.[i] ?? `${String(i + 1).repeat(64)}`, slots: [slot(route)] })).fcid);
  await holder.lock();
  const composed: boolean[] = [];
  const handle = custodyFrameHandler({
    holder, testScratch: false, standing: () => "herm", onLog: () => {},
    recompose: async (sovereign) => {
      composed.push(sovereign);
      // A composition that refuses to stand while it would wear `refuseWearing` (a face whose memory will not open).
      const refusing = refuseWearing === undefined ? [] : typeof refuseWearing === "number" ? [refuseWearing] : refuseWearing;
      const worn = mountedFaceOrdinal();
      if (sovereign && worn !== undefined && refusing.includes(worn)) return { standing: "herm", refused: `h${worn} would not stand` };
      return { standing: sovereign ? "hearth" : "herm" };
    },
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

describe("the unlock answers honestly, and a failed switch wears the face it left", () => {
  test("RED: `--all` answers per face — the faces the route opened, and each that stayed shut under it with its reading", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, "the-second-face-route", "the-third-face-route"]);
    const all = await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), all: true });
    expect(all).toMatchObject({ reading: "opens", held: true });
    expect(all["faceReadings"]).toEqual([
      { face: 0, reading: "opened" },
      { face: 1, reading: "stayed-shut:no-slot-opens" },
      { face: 2, reading: "stayed-shut:no-slot-opens" },
    ]);
  });

  test("RED: a `--face N` switch whose composition refuses wears the previous face again, recomposes onto it, and keeps the node key", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, "the-second-face-route"], 1);
    const both = [...cred(FIXTURE_PASSPHRASE), ...cred("the-second-face-route")];
    expect(await v.send({ op: "unlock", credentials: both, face: 0 })).toMatchObject({ reading: "opens", held: true });
    expect(mountedFaceOrdinal()).toBe(0);
    const composedBefore = v.composed.length;
    const sw = await v.send({ op: "unlock", credentials: both, face: 1 });
    expect(sw).toMatchObject({ op: "unlock", held: true, switchRefused: "h1 would not stand", face: 1, wornAgain: 0, standing: "hearth" });
    expect(mountedFaceOrdinal()).toBe(0);                                     // the mount stands back on h0
    expect(v.holder.isUnlocked()).toBe(true);                                 // the node key never dropped
    expect(sovereignStands()).toBe(true);
    expect(v.composed.length).toBe(composedBefore + 2);                        // the refused switch, then h0 again
  });

  test("RED: an `--all --face N` switch whose composition refuses answers the face it wears again, never N", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, FIXTURE_PASSPHRASE], 1);
    expect(await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), all: true, face: 0 })).toMatchObject({ reading: "opens", held: true, wears: 0 });
    const sw = await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), all: true, face: 1 });
    expect(sw).toMatchObject({ op: "unlock", held: true, switchRefused: "h1 would not stand", face: 1, wornAgain: 0, wears: 0 });
    expect(mountedFaceOrdinal()).toBe(0);
  });

  test("CONTROL: `--all --face N` wears N where the route opened it; `--all` alone wears the lowest face it opened", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, "the-second-face-route", FIXTURE_PASSPHRASE]);
    const a = await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), all: true, face: 2 });
    expect(a).toMatchObject({ reading: "opens", held: true, wears: 2 });
    expect(mountedFaceOrdinal()).toBe(2);
    await v.send({ op: "lock" });
    setMountedFace(undefined);
    const b = await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), all: true });
    expect(b).toMatchObject({ reading: "opens", held: true, wears: 0 });
    expect(mountedFaceOrdinal()).toBe(0);
    expect(sovereignStands()).toBe(true);
  });

  test("RED: `--all --face N` refuses by name where N stayed shut under the route, and wears no other face", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, "the-second-face-route", FIXTURE_PASSPHRASE]);
    const r = await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), all: true, face: 1 });
    expect(r).toMatchObject({ op: "unlock", reading: "face-refused", face: 1, faceReading: "no-slot-opens" });
    expect(r).not.toHaveProperty("wears");
    expect(r).not.toHaveProperty("held");
    expect(mountedFaceOrdinal()).toBeUndefined();
    expect(v.holder.isUnlocked()).toBe(false);                                // a key never rests over a floor
    expect(v.holder.unlockedFaces()).toEqual([]);
    expect(sovereignStands()).toBe(false);
    expect(v.composed).toEqual([]);                                           // nothing composed on a face the operator never named
  });

  test("RED: `--all --face N` refuses by name where no face N stands", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, FIXTURE_PASSPHRASE]);
    const r = await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), all: true, face: 7 });
    expect(r).toMatchObject({ op: "unlock", reading: "face-refused", face: 7, faceReading: "not-standing" });
    expect(r).not.toHaveProperty("wears");
    expect(mountedFaceOrdinal()).toBeUndefined();
    expect(v.holder.isUnlocked()).toBe(false);
  });

  test("RED: over a held key, `--all --face N` with N shut refuses, keeps the face worn, and leaves open only what stood open before", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, "the-second-face-route", FIXTURE_PASSPHRASE]);
    expect(await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), face: 0 })).toMatchObject({ reading: "opens", held: true });
    const openBefore = [...v.holder.unlockedFaces()];
    const composedBefore = v.composed.length;
    const r = await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), all: true, face: 1 });
    expect(r).toMatchObject({ op: "unlock", reading: "face-refused", face: 1, faceReading: "no-slot-opens" });
    expect(r).not.toHaveProperty("wears");
    expect(mountedFaceOrdinal()).toBe(0);                                     // the worn face stands worn
    expect(v.holder.isUnlocked()).toBe(true);                                 // the node key stays held
    expect(v.holder.unlockedFaces()).toEqual(openBefore);                     // h2 opened under the route, and closed again
    expect(v.composed.length).toBe(composedBefore);
    expect(sovereignStands()).toBe(true);
  });

  test("CONTROL: a fresh unlock whose composition refuses still drops the node key (a key never rests over a floor)", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE], 0);
    const a = await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), face: 0 });
    expect(a).toMatchObject({ reading: "opens", held: false });
    expect(v.holder.isUnlocked()).toBe(false);
  });

  // THE FIRST ADMIT LANDS ON ITS OWN FACE (Sol, #408): a faceless vessel reserves h0 and h1 for two pending joins, and h1's lands
  // first. An opening `--all` that mounts the lowest face it opened mounts h0, whose anchors stand absent, and the boot reads them
  // empty while the daemon names h1. The opening mounts the lowest face that holds anchors, h1.
  test("RED: `--all` naming no face mounts the lowest opened face that holds anchors, never a pending one", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, FIXTURE_PASSPHRASE], undefined, [personaGroupDigest("the-pending-group"), personaGroupDigest("the-landed-group")]);
    await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), face: 1 });
    await v.holder.writeRecord("identity", "anchors-h1.json", new TextEncoder().encode(JSON.stringify({ personaGroupId: "the-landed-group", meshCabalDocIdHex: "ab" })));
    await v.holder.lock();
    setMountedFace(undefined);
    const all = await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), all: true });
    expect(all).toMatchObject({ reading: "opens", held: true, wears: 1 });
    expect(mountedFaceOrdinal()).toBe(1);
  });

  // A LOCK NEVER SLIDES THE MOUNT ONTO A PENDING FACE, AND A HELD SELECTION NEVER KEEPS ONE (Sol, #408 round 3): with h0 pending
  // and h1 landed, `lock --face 1` slid to the open h0 (no anchors) and the boot refused; a second `--all` kept h0 selected and
  // answered held while the vessel stood on the floor.
  test("RED: a lock slides only to a face holding anchors, and a later `--all` reselects the anchored face, never a pending one", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, FIXTURE_PASSPHRASE], undefined, [personaGroupDigest("the-pending-group"), personaGroupDigest("the-landed-group")]);
    await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), face: 1 });
    await v.holder.writeRecord("identity", "anchors-h1.json", new TextEncoder().encode(JSON.stringify({ personaGroupId: "the-landed-group", meshCabalDocIdHex: "ab" })));
    await v.holder.lock();
    setMountedFace(undefined);
    expect(await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), all: true })).toMatchObject({ held: true, wears: 1 });
    const composedBefore = v.composed.length;
    const locked = await v.send({ op: "lock", face: 1 });
    expect(locked).toMatchObject({ op: "lock", locked: true });
    expect(mountedFaceOrdinal(), "the mount never slides onto the pending h0").not.toBe(0);
    // NO COMPOSITION STANDS FOR h1 ONCE ITS KEY DROPS: the vessel composed again, and no default mount picks the pending h0, so it
    // stands at the floor (Sol, #408 round 4).
    expect(v.composed.length, "the lock composed again").toBe(composedBefore + 1);
    expect(sovereignStands(), "no default mount stands on the pending h0").toBe(false);
    const again = await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), all: true });
    expect(again).toMatchObject({ held: true, wears: 1 });
    expect(mountedFaceOrdinal()).toBe(1);
  });

  // A REFUSED WEAR KEEPS THE STATE IT FOUND (Sol, #408 round 5): from the floor a lock left (NO MOUNT, the pending h0 open), a wear
  // of the pending h0 refuses before anything moves; a wear whose composition refuses rolls back to NO MOUNT exactly (never to the
  // default rule, which would pick h0); a second refusal never drops a key.
  test("RED: a refused wear rolls back to the exact state it found (NO MOUNT), and a second refusal drops no key", async () => {
    const landed = (i: number) => personaGroupDigest(`landed-${i}`);
    // h0's composition refuses (its join waits: no anchors), as h2's does (its memory will not open).
    const v = await vessel([FIXTURE_PASSPHRASE, FIXTURE_PASSPHRASE, FIXTURE_PASSPHRASE], [0, 2], [personaGroupDigest("the-pending-group"), landed(1), landed(2)]);
    await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), all: true, face: 1 });
    for (const i of [1, 2]) await v.holder.writeRecord("identity", `anchors-h${i}.json`, new TextEncoder().encode(JSON.stringify({ personaGroupId: `landed-${i}`, meshCabalDocIdHex: "ab" })));
    await v.holder.lock();
    setMountedFace(undefined);
    expect(await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), all: true })).toMatchObject({ held: true, wears: 1 });
    // Lock h1 and then h2 (the slide's landing): no open face holding anchors stays, so NO MOUNT stands at the floor.
    await v.send({ op: "lock", face: 1 });
    await v.send({ op: "lock", face: 2 });
    expect(sovereignStands(), "the floor a lock left").toBe(false);
    // THE WEAR OF THE PENDING h0 refuses to compose; the rollback restores NO MOUNT exactly (the default rule would pick h0 again,
    // refuse again and drop every key), and no key drops.
    const refused = await v.send({ op: "wear", face: 0 });
    expect(refused).toMatchObject({ op: "wear", held: true, switchRefused: "h0 would not stand" });
    expect(sovereignStands(), "the floor it found").toBe(false);
    expect(mountedFaceOrdinal(), "never the pending h0").toBeUndefined();
    expect(v.holder.isUnlocked(), "the node key stays held").toBe(true);
    expect(v.holder.unlockedFaces().length, "h0's key stays open").toBe(1);
  });

  // A LOCK CLEARS THE SELECTION IT ENDS (Sol, #410): a face a person named and then locked leaves no selection behind, so no door
  // reads it worn after its key dropped.
  test("RED: locking a named face clears its selection", async () => {
    const v = await vessel([FIXTURE_PASSPHRASE, FIXTURE_PASSPHRASE]);
    await v.send({ op: "unlock", credentials: cred(FIXTURE_PASSPHRASE), face: 1 });
    expect(mountedFaceOrdinal()).toBe(1);
    await v.send({ op: "lock", face: 1 });
    expect(mountedFaceOrdinal(), "the named selection left with the key").toBeUndefined();
    expect(sovereignStands()).toBe(false);
  });
});

