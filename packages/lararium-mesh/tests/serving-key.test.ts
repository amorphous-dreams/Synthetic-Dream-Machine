/**
 * serving-key.test — SK mints as 32 random bytes and derives from no key
 * (lar:///ha.ka.ba/lararium/mesh/ember#/the-serving-key). The serving tree that holds it stands in the node
 * (lararium-node custody-session tests).
 */
import { describe, expect, test } from "vitest";
import { mintServingKey, SK_LENGTH } from "../src/serving-key.js";

const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");

describe("the serving key mints alone", () => {
  test("K1 — SK is 32 bytes and differs across mints", () => {
    const a = mintServingKey();
    const b = mintServingKey();
    expect(a.length).toBe(SK_LENGTH);
    expect(hex(a)).not.toBe(hex(b));
  });
});
