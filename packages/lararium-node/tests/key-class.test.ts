/**
 * key-class.test — EVERY KEY NAMES ITS CLASS (basket-one #/the-phone-seat, ruled 2026-09-11: "every key names its
 * class in vault status"). The classes form a CLOSED vocabulary — `device-minted` (the vessel key, the veil it
 * derives), `seed` (a persona root, a recovery share of it), `cloud-synced` (any key that reads identical across
 * devices — none today; the slot exists so a future PRF / synced-passkey wrap MUST declare it). An unknown class
 * refuses at the type AND at the guard, so a synced key can never pass as a device key by omission.
 */
import { describe, test, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KEY_CLASSES, isKeyClass, vesselKeyCensus, type KeyClass } from "../src/key-class.js";

describe("the key-class vocabulary is closed", () => {
  test("three classes, and an unknown spelling refuses at the guard", () => {
    expect([...KEY_CLASSES]).toEqual(["device-minted", "seed", "cloud-synced"]);
    expect(isKeyClass("device-minted")).toBe(true);
    expect(isKeyClass("cloud-synced")).toBe(true);
    expect(isKeyClass("passkey")).toBe(false);
    expect(isKeyClass("")).toBe(false);
    // CONTROL at the TYPE: a KeyClass slot takes no other string (a compile-time refusal, witnessed by ts-expect-error).
    // @ts-expect-error — "synced" is not a KeyClass
    const refused: KeyClass = "synced";
    void refused;
  });
});

describe("vesselKeyCensus — every key the identity dir holds, with its class", () => {
  test("the vessel key reads device-minted; a persona root and a recovery share read seed; nothing reads cloud-synced today", () => {
    const dir = mkdtempSync(join(tmpdir(), "lar-keys-"));
    try {
      writeFileSync(join(dir, ".vessel-key-joshua.json"), "{}");
      writeFileSync(join(dir, ".persona-group-root-joshua-h0.json"), "{}");
      writeFileSync(join(dir, ".persona-group-root-joshua-h2.json"), "{}");
      writeFileSync(join(dir, "keyhive-archive.bin"), "x");
      writeFileSync(join(dir, "veil-archive.bin"), "x");
      writeFileSync(join(dir, ".vessel-card-joshua.json"), "{}");   // a CARD is public — never a key
      const keys = vesselKeyCensus(dir);
      const byName = Object.fromEntries(keys.map((k) => [k.name, k.class]));
      expect(byName["vessel-key"]).toBe("device-minted");
      expect(byName["veil"]).toBe("device-minted");
      expect(byName["persona-root-h0"]).toBe("seed");
      expect(byName["persona-root-h2"]).toBe("seed");
      expect(keys.every((k) => isKeyClass(k.class))).toBe(true);
      expect(keys.some((k) => k.class === "cloud-synced")).toBe(false);
      expect(keys.some((k) => /card/.test(k.name))).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  test("CONTROL: an empty identity dir names no keys (and faults nothing)", () => {
    const dir = mkdtempSync(join(tmpdir(), "lar-keys-"));
    try { expect(vesselKeyCensus(dir)).toEqual([]); } finally { rmSync(dir, { recursive: true, force: true }); }
    expect(vesselKeyCensus(join(tmpdir(), "no-such-dir-" + Date.now()))).toEqual([]);
  });
});
