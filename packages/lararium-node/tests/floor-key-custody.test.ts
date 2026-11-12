/**
 * floor-key-custody — THE NODE'S FLOOR KEY DOOR (the-veil-ladder#/the-base-model, in-house ruling 7).
 *
 * A node derives its floor's rest key through its custody root (`custodyFloorKeyDoor`, one child under the floor's own
 * registered domain). The custody root mints once, at the custody's founding, so the key holds across every face that
 * lands; a locked hearth derives none, and a herm, which never unlocks, derives none and so registers no floor row.
 * The rotation leg (a new S key re-seals the same root) reads in `custody-session.test.ts`.
 */
import { afterEach, describe, expect, test } from "vitest";
import { FLOOR_REST_KEY_INFO, GATE_BUNDLE_INFO, floorRestKey, mintSecretHomeAddress, type SlotSpec } from "@lararium/mesh";
import { CustodyLocked } from "../src/custody-holder.js";
import { CustodyRootRefused } from "../src/custody-root.js";
import { custodyFloorKeyDoor, custodyGateDoor, unseatCustody } from "../src/custody-seat.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

const slot = (passphrase: string): SlotSpec => ({ t: 1, pins: [{ kind: "passphrase", passphrase }] });
let seat: SeatedScratchCustody | null = null;
afterEach(async () => { await seat?.drop(); seat = null; });

describe("the node's floor key derives through the custody root, and only while it stands unlocked", () => {
  test("FKN1: an unlocked custody derives one floor key every time, apart from every other child and from a secret home's key", async () => {
    seat = await seatScratchCustody("floor-key");
    const a = floorRestKey(custodyFloorKeyDoor()), b = floorRestKey(custodyFloorKeyDoor());
    expect(a).toHaveLength(32);
    expect([...a]).toEqual([...b]);
    expect([...a]).toEqual([...seat.holder.derive(FLOOR_REST_KEY_INFO)]);
    expect([...a]).not.toEqual([...custodyGateDoor().derive(GATE_BUNDLE_INFO)]);
    // The secret home's key mints at random with a face; nothing of the floor's key derives it.
    expect([...a]).not.toEqual([...mintSecretHomeAddress().key]);
    // The door derives the floor's key alone.
    expect(() => custodyFloorKeyDoor()(GATE_BUNDLE_INFO)).toThrow(CustodyRootRefused);
  });

  test("RED FKN2: the floor key holds across a face landing: a founded face moves nothing of it", async () => {
    seat = await seatScratchCustody("floor-key-face");
    const before = floorRestKey(custodyFloorKeyDoor());
    await seat.holder.foundFace({ group: personaGroupDigest("group-floor-key"), slots: [slot("route-face")] });
    expect([...floorRestKey(custodyFloorKeyDoor())]).toEqual([...before]);
  });

  test("RED FKN3: a locked hearth refuses the floor key, and a place whose custody never opened (a herm) derives none", async () => {
    seat = await seatScratchCustody("floor-key-locked");
    const open = floorRestKey(custodyFloorKeyDoor());
    await seat.holder.lock();
    expect(() => floorRestKey(custodyFloorKeyDoor())).toThrow(CustodyLocked);
    // No seat at all: a place that never unlocks holds no holder to ask.
    unseatCustody(seat.holder);
    expect(() => floorRestKey(custodyFloorKeyDoor())).toThrow(CustodyLocked);
    expect(open).toHaveLength(32);
  });
});
