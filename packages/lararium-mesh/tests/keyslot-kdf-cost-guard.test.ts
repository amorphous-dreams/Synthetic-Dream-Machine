/**
 * keyslot-kdf-cost-guard.test — no input lowers the scrypt cost, and a refusing KDF fails closed.
 *
 * Canon (keyslot.ts, `SCRYPT`): "A change of cost is a change of pin kind, never a stored parameter a tree could lower."
 * The port that derives rides every verb as an argument, so the argument itself must carry no cost: only this package
 * mints a port (a hand-built one refuses before any derivation), the port receives the ONE constant from keyslot, the
 * mint stays off both public doors, and no tree field, setting or environment variable reaches the cost. A port that
 * throws or answers short refuses by name, never as a wrong passphrase.
 */
import { describe, test, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { scryptSync } from "node:crypto";

vi.setConfig({ testTimeout: 60_000 });
import { bindSlot, openTreeKey, encodeSlotTree, decodeSlotTree, nobleKdf, mintKdfPort, type KdfPort } from "../src/keyslot.js";
import { mintTreeKey } from "../src/tree-key.js";
import { defaultCryptoProvider } from "../src/crypto.js";

const right = { kind: "passphrase", passphrase: "correct horse battery staple" } as const;
const REAL_COST = { N: 1 << 17, r: 8, p: 1, dkLen: 32 };
const src = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");

describe("only this package mints a port", () => {
  test("a hand-built port refuses at bind and at open, before it derives", async () => {
    let calls = 0;
    const forged = { derive: async () => { calls++; return new Uint8Array(32); } } as unknown as KdfPort;
    await expect(bindSlot(null, mintTreeKey(), { t: 1, pins: [right] }, forged, defaultCryptoProvider)).rejects.toThrow(/kdf-port-unminted/);
    const tree = await bindSlot(null, mintTreeKey(), { t: 1, pins: [right] }, nobleKdf, defaultCryptoProvider);
    await expect(openTreeKey(tree, [right], forged)).rejects.toThrow(/kdf-port-unminted/);
    expect(calls).toBe(0);
  });

  test("the mint stays off the barrel and the host door; each door offers its own port", async () => {
    const barrel = await import("../src/index.js");
    const host = await import("../src/node.js");
    expect("mintKdfPort" in barrel).toBe(false);
    expect("mintKdfPort" in host).toBe(false);
    expect("nobleKdf" in barrel).toBe(true);
    expect("nativeKdf" in barrel).toBe(false);
    expect("nativeKdf" in host).toBe(true);
  });
});

describe("the port receives the ONE cost", () => {
  test("every derivation hands the port the real cost, frozen, at bind and at open", async () => {
    const seen: unknown[] = [];
    const counting = mintKdfPort(async (pw, salt, cost) => { seen.push(cost); return nobleKdfDerive(pw, salt, cost); });
    const tree = await bindSlot(null, mintTreeKey(), { t: 1, pins: [right] }, counting, defaultCryptoProvider);
    expect((await openTreeKey(tree, [right], counting)).reading).toBe("opens");
    expect(seen.length).toBe(2);
    for (const c of seen) { expect(c).toEqual(REAL_COST); expect(Object.isFrozen(c)).toBe(true); }
  });

  test("a cost written into the tree at rest reaches no derivation", async () => {
    const seen: unknown[] = [];
    const counting = mintKdfPort(async (pw, salt, cost) => { seen.push(cost); return nobleKdfDerive(pw, salt, cost); });
    const tree = await bindSlot(null, mintTreeKey(), { t: 1, pins: [right] }, nobleKdf, defaultCryptoProvider);
    const json = JSON.parse(new TextDecoder().decode(encodeSlotTree(tree)));
    json.slots[0].pins[0] = { ...json.slots[0].pins[0], N: 2, r: 1, p: 1, cost: { N: 2, r: 1, p: 1 } };
    json.scrypt = { N: 2 };
    const back = decodeSlotTree(new TextEncoder().encode(JSON.stringify(json)));
    if (back.reading === "readable") {
      await openTreeKey(back.tree, [right], counting);
      for (const c of seen) expect(c).toEqual(REAL_COST);
    } else {
      expect(back.reading).toBe("unreadable");
    }
  });

  test("the cost stands written once, and no KDF source reads a setting or the environment", () => {
    const keyslot = src("keyslot.ts");
    const native = src("kdf-native.ts");
    expect(keyslot.match(/1 << 17/g)?.length).toBe(1);
    expect(native).not.toMatch(/1 << 17|131072|\bN:\s*\d/);
    for (const s of [keyslot, native]) expect(s).not.toMatch(/process\.env|getenv|LAR_[A-Z_]*SCRYPT/);
  });

  test("CONTROL: node's default maxmem refuses the real cost, so the native port must carry its own", () => {
    expect(() => scryptSync("x", "salt", 32, { N: REAL_COST.N, r: REAL_COST.r, p: REAL_COST.p })).toThrow(/memory|scrypt|params/i);
  });
});

describe("a refusing KDF fails closed", () => {
  test("a port that throws refuses the bind and the open by name, never as a wrong passphrase", async () => {
    const tree = await bindSlot(null, mintTreeKey(), { t: 1, pins: [right] }, nobleKdf, defaultCryptoProvider);
    const refusing = mintKdfPort(async () => { throw new Error("ERR_CRYPTO_INVALID_SCRYPT_PARAMS"); });
    await expect(bindSlot(null, mintTreeKey(), { t: 1, pins: [right] }, refusing, defaultCryptoProvider)).rejects.toThrow(/kdf-refused/);
    await expect(openTreeKey(tree, [right], refusing)).rejects.toThrow(/kdf-refused/);
  });

  test("a port that answers short refuses by name", async () => {
    const tree = await bindSlot(null, mintTreeKey(), { t: 1, pins: [right] }, nobleKdf, defaultCryptoProvider);
    const short = mintKdfPort(async () => new Uint8Array(31));
    await expect(openTreeKey(tree, [right], short)).rejects.toThrow(/kdf-refused/);
  });
});

// The counting ports derive through noble's own module, so the guard reads the cost keyslot hands over, unchanged.
import { scryptAsync } from "@noble/hashes/scrypt.js";
function nobleKdfDerive(pw: Uint8Array, salt: Uint8Array, cost: { readonly N: number; readonly r: number; readonly p: number; readonly dkLen: number }): Promise<Uint8Array> {
  return scryptAsync(pw, salt, { ...cost });
}
