import { describe, expect, it } from "vitest";
import { dyadId, dyadBindingSubject } from "../src/dyad.js";

const atomA = "0x" + "ab".repeat(32);
const atomB = "0x" + "cd".repeat(32);

describe("the one ended dyad", () => {
  it("separates two atoms and folds spelling of one atom", () => {
    expect(dyadId({ deviceDid: atomA })).not.toBe(dyadId({ deviceDid: atomB }));
    expect(dyadId({ deviceDid: atomA })).toBe(dyadId({ deviceDid: atomA.toUpperCase() }));
  });
  it("binds exactly the atom DID", () => {
    expect(dyadBindingSubject({ deviceDid: atomA })).toEqual({ deviceDid: atomA });
  });
});
