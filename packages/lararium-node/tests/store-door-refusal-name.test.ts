/**
 * A store-door row that refuses answers the name it refuses under, beside the door's words.
 */
import { describe, expect, test } from "vitest";
import { storeDoorReactors, storeRefusalName } from "../src/store-door-verbs.js";
import { faceRouteBindDigest, parkFaceRoute } from "../src/face-route.js";
import { seatScratchCustody } from "./custody-seat-fixture.js";

const rows = storeDoorReactors({ storageDir: "/nonexistent", sealHome: "/nonexistent", repo: {} as never });
const run = (verb: keyof typeof rows, args: Record<string, unknown>) => (rows[verb] as (a: Record<string, unknown>) => Promise<Record<string, unknown>>)(args);

describe("a row's refusal names itself", () => {
  test("persona-new answers face-route-refused for a wrong index and spends the ref; a fresh matching ref reaches the command", async () => {
    const seat = await seatScratchCustody("store-route-refusal");
    try {
      const slots = [{ t: 1, pins: [{ kind: "passphrase" as const, passphrase: "store-route" }] }];
      const park = () => parkFaceRoute(slots, "persona-new", faceRouteBindDigest("persona-new", { handleIndex: 1 }));
      const ref = park();
      expect(await run("persona-new", { handleIndex: 2, faceRouteRef: ref })).toMatchObject({
        verb: "persona-new", refusal: "face-route-refused", refused: expect.stringContaining("face-route-refused"),
      });
      expect(await run("persona-new", { handleIndex: 1, faceRouteRef: ref })).toMatchObject({ refusal: "face-route-refused" });
      // CONTROL: real row and command, no mock. A matching ref clears the route gate and reaches the
      // command's missing-place guard under this fresh scratch root, before any persona can mint.
      await expect(run("persona-new", { handleIndex: 1, faceRouteRef: park() })).rejects.toThrow(/no place stands here/);
    } finally { await seat.drop(); }
  });

  test("★ a refused row answers `refusal`: its own verb's name, never one word shared by every door ★", async () => {
    const out = await run("edge-seat-duties", { fleetRoot: "f", stray: 1 });
    expect(typeof out["refused"]).toBe("string");
    expect(out["refusal"]).toBe("edge-seat-duties-refused");
    expect(storeRefusalName("nexus-kapae")).toBe("nexus-kapae-refused");
  });

  test("a fleet-join row refuses a face that reads as no index, before any read: never the founding face's act", async () => {
    // A face row rides its session's face: a face that reads as no index names a face the session does not wear.
    const worn = { worn: { ordinal: 0, presenter: `0x${"00".repeat(32)}` } };
    for (const face of ["2", 1.5, -1, null, true]) {
      for (const verb of ["fleet-join-offer", "fleet-join-answer"] as const) {
        const out = await (rows[verb] as (a: Record<string, unknown>, c: unknown) => Promise<Record<string, unknown>>)({ face, request: {} }, worn);
        expect(out["refusal"], `${verb} ${JSON.stringify(face)}`).toBe(`${verb}-refused`);
        expect(String(out["refused"])).toMatch(/face-row-other-face/);
      }
    }
  });

  test("CONTROL: a fault that belongs to no refusal class throws through the row, unnamed", async () => {
    await expect(run("persona-kel-head", {})).rejects.toThrow(/needs "prefix"/);
  });
});
