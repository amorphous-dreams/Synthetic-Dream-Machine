import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createPublicKey, verify } from "node:crypto";
import { describe, expect, test } from "vitest";
import { seatScratchCustody } from "./custody-seat-fixture.js";
import { mintIntentRelayKey, heldIntentRelayKey, intentRelayPublicKey, rotateIntentRelayKey, signAsIntentRelay, INTENT_RELAY_KEY_FILE } from "../src/intent-relay-key-store.js";
import { carrierTable } from "../src/vault-carriers.js";
import { signAsCadence } from "../src/cadence-key-store.js";
import { ed25519VerifyingKeyFromSeed } from "@lararium/mesh";

const image = new TextEncoder().encode("one admission image");
function verifies(key: string, signature: string): boolean {
  const publicKey = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: Buffer.from(key, "hex").toString("base64url") }, format: "jwk" });
  return verify(null, image, publicKey, Buffer.from(signature, "hex"));
}

describe("the intent-admission service's cold S row", () => {
  test("RED: a second mint refuses and the row rests sealed; CONTROL: first mint signs under its own public key", async () => {
    const seat = await seatScratchCustody("intent-key");
    try {
      expect(heldIntentRelayKey()).toBe(false);
      await expect(signAsIntentRelay(image)).rejects.toMatchObject({ reading: "absent" });
      const first = await mintIntentRelayKey();
      expect(heldIntentRelayKey()).toBe(true);
      expect(await intentRelayPublicKey()).toBe(first.key);
      expect(verifies(first.key, await signAsIntentRelay(image))).toBe(true);
      await expect(signAsCadence(first.key, image)).rejects.toMatchObject({ name: "CustodyRowUnavailable" });
      await expect(mintIntentRelayKey()).rejects.toMatchObject({ reading: "names-another-key" });
      expect(readFileSync(join(seat.homes.identity, INTENT_RELAY_KEY_FILE)).length).toBeGreaterThan(32);
      expect(carrierTable().find((row) => row.row === "intent-relay-key")).toMatchObject({ custody: "cold", keyClass: "device-minted", writer: "intent-relay-key-store" });
    } finally { await seat.drop(); }
  });

  test("RED: rotation leaves the previous key unable to verify a fresh signature; CONTROL: the new key verifies", async () => {
    const seat = await seatScratchCustody("intent-rotate");
    try {
      const first = await mintIntentRelayKey();
      const next = await rotateIntentRelayKey();
      expect(next.previous).toBe(first.key);
      expect(next.key).not.toBe(first.key);
      const signature = await signAsIntentRelay(image);
      expect(verifies(next.key, signature)).toBe(true);
      expect(verifies(first.key, signature)).toBe(false);
    } finally { await seat.drop(); }
  });

  test("RED: locked custody refuses signing; CONTROL: unlocked custody signs", async () => {
    const seat = await seatScratchCustody("intent-locked");
    try {
      const { key } = await mintIntentRelayKey();
      expect(verifies(key, await signAsIntentRelay(image))).toBe(true);
      await seat.holder.lock();
      await expect(signAsIntentRelay(image)).rejects.toMatchObject({ name: "CustodyLocked" });
    } finally { await seat.drop(); }
  });

  test("RED: a planted borrowed-seed source trips the census; CONTROL: relay modules name no carriage or vessel seed", () => {
    const forbidden = /(?:from\s+["'][^"']*carriage-relay|\bresolveRelayGateSeed\b|\bvesselSeed\b)/;
    expect(forbidden.test('import { resolveRelayGateSeed } from "./carriage-relay.js"')).toBe(true);
    const source = new URL("../src/", import.meta.url);
    for (const file of readdirSync(source).filter((name) => /^intent-relay-.*\.ts$/.test(name))) {
      expect(forbidden.test(readFileSync(new URL(file, source), "utf8")), file).toBe(false);
    }
  });

  test("RED: independent vessel mints never alias; CONTROL: each public key verifies its own signature", async () => {
    const keys = new Set<string>();
    const fixedSeedPublic = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(7));
    for (let i = 0; i < 16; i++) {
      const seat = await seatScratchCustody(`intent-many-${i}`);
      try { const { key } = await mintIntentRelayKey(); keys.add(key); expect(key).not.toBe(fixedSeedPublic); expect(verifies(key, await signAsIntentRelay(image))).toBe(true); }
      finally { await seat.drop(); }
    }
    expect(keys.size).toBe(16);
  });
});
