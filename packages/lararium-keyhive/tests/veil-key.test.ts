/**
 * veil-key.test — THE VEIL REFUSES A NON-DEVICE KEY AT THE TYPE (the veil ruling, 2026-09-05: the dyad veil
 * derives per-handle from the DEVICE-MINTED vessel key, never the seed; key-class.ts names the closed
 * vocabulary device-minted · seed · cloud-synced).
 *
 * The derivation takes a BRANDED `DeviceMintedKey` — minted through one door, `mintDeviceMintedKey`, at the
 * vessel-key mint site. A raw seed, a `seed`-class key or a `cloud-synced`-class key cannot reach it at compile
 * time (the `@ts-expect-error` lines below stand as the tsc witness) AND a caller that forges the shape at
 * runtime refuses with a NAMED error. CONTROL: the minted door derives byte-identical to the mesh
 * `deriveDyadVeil(seed, tag)` — the founder's own derivation is device-minted already, so nothing moves.
 */
import { describe, test, expect } from "vitest";
import { deriveDyadVeil } from "@lararium/mesh";
import {
  mintDeviceMintedKey, isDeviceMintedKey, deriveVeilFromDeviceKey, VeilKeyClassRefused,
  type DeviceMintedKey, type ClassedKey,
} from "../src/veil-key.js";

const SEED = new Uint8Array(32).fill(11);
const TAG  = "deadbeef".repeat(8);

describe("the veil derivation refuses every key class but device-minted", () => {
  test("a forged shape — the right fields, never minted through the door — refuses at runtime, named", async () => {
    const forged = { class: "device-minted", seed: SEED } as unknown as DeviceMintedKey;
    expect(isDeviceMintedKey(forged)).toBe(false);
    await expect(deriveVeilFromDeviceKey(forged, TAG)).rejects.toThrow(VeilKeyClassRefused);
    await expect(deriveVeilFromDeviceKey(forged, TAG)).rejects.toThrow(/device-minted/);
  });

  test("a raw seed and a seed-class / cloud-synced-class key cannot reach the derivation (compile + runtime)", async () => {
    const seedClass:  ClassedKey<"seed">         = { class: "seed",         seed: SEED };
    const cloudClass: ClassedKey<"cloud-synced"> = { class: "cloud-synced", seed: SEED };
    // @ts-expect-error — raw bytes carry no class; the derivation refuses them at the type.
    await expect(deriveVeilFromDeviceKey(SEED, TAG)).rejects.toThrow(VeilKeyClassRefused);
    // @ts-expect-error — a seed-class key is the thing the ruling forbids a veil to derive from.
    await expect(deriveVeilFromDeviceKey(seedClass, TAG)).rejects.toThrow(VeilKeyClassRefused);
    // @ts-expect-error — a cloud-synced key reads identical across devices: a seed wearing a device name.
    await expect(deriveVeilFromDeviceKey(cloudClass, TAG)).rejects.toThrow(VeilKeyClassRefused);
  });

  test("the door refuses a seed of the wrong length — a 32-byte Ed25519 seed or nothing", () => {
    expect(() => mintDeviceMintedKey(new Uint8Array(31))).toThrow(/32/);
  });
});

describe("CONTROL — the minted door derives byte-identical to the mesh derivation", () => {
  test("mintDeviceMintedKey(seed) → deriveVeilFromDeviceKey == deriveDyadVeil(seed, tag)", async () => {
    const key = mintDeviceMintedKey(SEED);
    expect(isDeviceMintedKey(key)).toBe(true);
    expect(key.class).toBe("device-minted");
    const viaDoor = await deriveVeilFromDeviceKey(key, TAG);
    const direct  = await deriveDyadVeil(SEED, TAG);
    expect(viaDoor).toEqual(direct);
  });
});
