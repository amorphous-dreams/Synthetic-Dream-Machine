/**
 * The one island record (slice 5b).
 * Canon: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices
 */
import { describe, test, expect, vi } from "vitest";
import {
  islandFloorStack, islandLiftStack, larVesselOf,
  type LarariumVesselOptions, type LarariumVesselResult,
  CompositeStore, BAG_IDS,
} from "../src/index.js";
import { composeVessel } from "../src/cap-compose.js";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";

function makeStore(): CompositeStore {
  const store = new CompositeStore();
  const wiki = new MemoryTiddlerStore();
  store.addLayer({ bagId: BAG_IDS.lararium, store: wiki, writable: true });
  return store;
}

const cas = async () => null;
const receipt = async () => {};

describe("LarVessel — one island record", () => {
  test("the floor composes one record with its members alone", async () => {
    const vessel = larVesselOf(await composeVessel(islandFloorStack({ cas, receipt })));
    expect(vessel.record.cas).toBe(cas);
    expect(vessel.stands("cas")).toBe(true);
    expect(vessel.stands("dyad")).toBe(false);
    expect(vessel.stands("sessionSign")).toBe(false);
    expect(vessel.stands("custodyWrite")).toBe(false);
    expect(vessel.liftedFace()).toBeNull();
  });

  test("larVesselOf refuses a composition with no island record", async () => {
    const composed = await composeVessel([]);
    expect(() => larVesselOf(composed)).toThrow(/no-island-record/);
  });

  test("the floor's dispose takes its members back, and a second dispose takes nothing", async () => {
    const composed = await composeVessel(islandFloorStack({ cas, receipt }));
    const vessel = larVesselOf(composed);
    await composed.dispose();
    expect(vessel.stands("cas")).toBe(false);
    await expect(composed.dispose()).resolves.toBeUndefined();
  });

  test("a lift seated by islandLiftStack leaves through its own dispose only; the read face carries no setter", async () => {
    const floor = await composeVessel(islandFloorStack({ cas, receipt }));
    const vessel = larVesselOf(floor);
    const door = async () => ({ refusal: "x" });
    const drop = vi.fn();
    const lift = await composeVessel(islandLiftStack(vessel, { face: "G-A", sessionSign: door, drop }));
    expect(vessel.liftedFace()).toBe("G-A");
    expect(vessel.stands("sessionSign")).toBe(true);
    expect(Object.keys(vessel).some((key) => /^(set|seat)/.test(key))).toBe(false);
    await lift.dispose();
    expect(vessel.stands("sessionSign")).toBe(false);
    expect(drop).toHaveBeenCalledOnce();
  });

  // THE FENCE READS ON BOTH SIDES OF ITS AWAIT (row B8): a custody write the lock overtook in flight answers `lift-locked`,
  // as a session sign that settles after the lock does, so no caller reads a write of a face the lock ended as landed.
  test("L1 RED: a custody write in flight when the lift locks refuses `lift-locked` once it settles", async () => {
    const vessel = larVesselOf(await composeVessel(islandFloorStack({ cas, receipt })));
    let land!: () => void;
    const lift = await composeVessel(islandLiftStack(vessel, {
      face: "G-A", drop: () => {}, custodyWrite: () => new Promise<void>((resolve) => { land = resolve; }),
    }));
    const write = vessel.record.custodyWrite!("veil-archive" as never, new Uint8Array([1]));
    await lift.dispose();
    land();
    await expect(write).rejects.toThrow(/lift-locked/);
  });

  test("L0 CONTROL: a custody write that settles while the lift stands lands", async () => {
    const vessel = larVesselOf(await composeVessel(islandFloorStack({ cas, receipt })));
    const landed: Uint8Array[] = [];
    await composeVessel(islandLiftStack(vessel, { face: "G-A", drop: () => {}, custodyWrite: async (_c, bytes) => { landed.push(bytes); } }));
    await expect(vessel.record.custodyWrite!("veil-archive" as never, new Uint8Array([1]))).resolves.toBeUndefined();
    expect(landed).toHaveLength(1);
  });

  test("a lift over a record no floor composed refuses", async () => {
    const lift = { face: "G-A", sessionSign: async () => ({ refusal: "x" }), drop: () => {} };
    await expect(composeVessel(islandLiftStack({ record: {}, stands: () => false, liftedFace: () => null }, lift)))
      .rejects.toThrow(/no-island-record/);
  });
});

describe("lararium-vessel contract — shared boot surface", () => {
  test("shared options carry host/wiki identity", () => {
    const options: LarariumVesselOptions = {
      hostId: "elyncia",
      wikiId: "test-wiki",
    };

    expect(options.hostId).toBe("elyncia");
    expect(options.wikiId).toBe("test-wiki");
  });

  test("shared result surface exposes vessel/repo/store/pool symmetry", () => {
    const store = makeStore();
    const result: LarariumVesselResult<"vessel", "pool", { kind: "repo" }, CompositeStore> = {
      vessel: "vessel",
      pool: "pool",
      repo: { kind: "repo" },
      store,
      catalogHandleUrl: "automerge:catalog",
      oracleDocUrl: null,
      larariumDocUrl: "automerge:island",
      phase: "live",
    };

    expect(result.vessel).toBe("vessel");
    expect(result.store).toBe(store);
    expect(result.phase).toBe("live");
  });
});
