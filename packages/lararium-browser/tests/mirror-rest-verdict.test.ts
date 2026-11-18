/**
 * A VEIL FLOOR'S MIRROR RUNS NO PERSON-AUTHORED CODE (the-veil-ladder #/the-base-model). The mirror's census admits a code plugin
 * only where the vessel's answer carries `sealedRest`; today no host wires it true, so every browser mirror holds such a plugin
 * (`plugin-gate`). The guard stands where it would first be wired: a store that rests sealed under the vessel's own key still
 * answers no `sealedRest` while no face is lit, since a floor's content carries no person's custody to vouch for the code it holds.
 *
 *   MR1  a veil floor (no face lit) answers no `sealedRest`, sealed store or not.
 *   MR2  CONTROL: a lit face over a store that rests sealed answers `sealedRest: true`; over a clear store, none.
 *   MR3  an absent boot set stays absent.
 */
import { describe, expect, test } from "vitest";
import { mirrorInputsAt } from "../src/mirror-rest-verdict.js";

const inputs = { coreCid: "core", pluginCids: ["one", "two"] } as const;

describe("the mirror's sealed-rest verdict", () => {
  test("MR1: a veil floor answers no sealedRest, sealed store or not", () => {
    for (const restsSealed of [true, false]) {
      const answer = mirrorInputsAt(inputs, { face: null, restsSealed });
      expect(answer, `restsSealed=${restsSealed}`).toEqual(inputs);
      expect(answer && "sealedRest" in answer).toBe(false);
    }
  });
  test("MR2 CONTROL: a lit face over a sealed store answers sealedRest; over a clear store, none", () => {
    expect(mirrorInputsAt(inputs, { face: "face-a", restsSealed: true })).toEqual({ ...inputs, sealedRest: true });
    const clear = mirrorInputsAt(inputs, { face: "face-a", restsSealed: false });
    expect(clear && "sealedRest" in clear).toBe(false);
  });
  test("MR3: an absent boot set stays absent", () => {
    expect(mirrorInputsAt(null, { face: "face-a", restsSealed: true })).toBeNull();
  });
});
