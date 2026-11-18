/** key-class — one closed vocabulary, one guard, read by node · keyhive · browser alike. */
import { describe, expect, test } from "vitest";
import { KEY_CLASSES, isKeyClass, isRelationClass } from "../src/key-class.js";

describe("the key-class vocabulary", () => {
  test("four classes and no fifth: relation joins the three", () => {
    expect([...KEY_CLASSES]).toEqual(["device-minted", "seed", "cloud-synced", "relation"]);
    expect(isKeyClass("passkey")).toBe(false);
    expect(isKeyClass("cloud-synced")).toBe(true);
    expect(isKeyClass("relation")).toBe(true);
  });

  test("CONTROL: the other classes stand, and a near-miss of relation does not", () => {
    for (const c of ["device-minted", "seed", "cloud-synced"]) expect(isKeyClass(c)).toBe(true);
    for (const c of ["relations", "Relation", "relationship", "", null, undefined, 4]) expect(isKeyClass(c)).toBe(false);
  });

  test("only relation reads as a secret another party re-issues", () => {
    expect(isRelationClass("relation")).toBe(true);
    for (const c of ["device-minted", "seed", "cloud-synced"] as const) expect(isRelationClass(c)).toBe(false);
  });
});
