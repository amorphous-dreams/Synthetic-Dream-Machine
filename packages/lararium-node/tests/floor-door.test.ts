/**
 * floor-door — the node binds the vessel's floor pin to the store door (w26-floor-lane#/the-vessel-pin).
 *
 *   · both rows stand on the door, as rows of the PLACE: the pin keys on (vessel, Nexus), so no face row carries it and a
 *     face switch reaches no pin;
 *   · the accept rides a person's hand alone (`floor-needs-hand`): a seat session reads the status and never moves the floor;
 *   · the node's binding answers the mesh's own decision: its module calls `acceptFloorRelease` and `readFloorStatus`, and
 *     declares no live floor swap (the remount raises the reboot-pending alert).
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { STORE_DOOR_FACE_ROWS, STORE_DOOR_HAND_CODES, STORE_DOOR_HAND_ONLY_ACTS, STORE_DOOR_VERBS } from "../src/store-door-verbs.js";

describe("the floor rows on the node's store door", () => {
  test("both rows stand, as rows of the place: no face row carries the pin", () => {
    expect(STORE_DOOR_VERBS).toEqual(expect.arrayContaining(["floor-status", "floor-accept"]));
    expect(STORE_DOOR_FACE_ROWS.has("floor-status")).toBe(false);
    expect(STORE_DOOR_FACE_ROWS.has("floor-accept")).toBe(false);
  });

  test("RED: the accept rides a person's hand alone; the status stays open to a seat", () => {
    expect(STORE_DOOR_HAND_CODES.get("floor-accept")).toBe("floor-needs-hand");
    expect(STORE_DOOR_HAND_ONLY_ACTS.has("floor-accept")).toBe(true);
    expect(STORE_DOOR_HAND_ONLY_ACTS.has("floor-status")).toBe(false);
  });

  test("the node's binding answers the mesh's one decision and declares no live swap", () => {
    const source = readFileSync(new URL("../src/commands/floor.ts", import.meta.url), "utf8");
    expect(source).toMatch(/acceptFloorRelease\(ports, opts\.target\)/);
    expect(source).toMatch(/readFloorStatus\(await nodeFloorPorts\(opts\)\)/);
    expect(source).toMatch(/floorSwap: false/);
    expect(source).not.toMatch(/floorPathFromPin|decideFloorAccept/);          // no second copy of the decision
  });
});
