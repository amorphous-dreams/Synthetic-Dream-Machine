/** key-class — one closed vocabulary, one guard, read by node · keyhive · browser alike. */
import { describe, expect, test } from "vitest";
import { KEY_CLASSES, isKeyClass } from "../src/key-class.js";

describe("the key-class vocabulary", () => {
  test("three classes and no fourth", () => {
    expect([...KEY_CLASSES]).toEqual(["device-minted", "seed", "cloud-synced"]);
    expect(isKeyClass("passkey")).toBe(false);
    expect(isKeyClass("cloud-synced")).toBe(true);
  });
});
