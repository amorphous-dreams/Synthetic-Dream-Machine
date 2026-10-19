import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { didKeyFromVerifyingKey } from "../src/cold-boot-ceremony.js";
import { hex, hexToBytes } from "../src/crypto.js";

describe("strict hex decoding", () => {
  test.each(["0g", "g0", "abc", " 1", "+f", "-1", "0x", "éé", "٠١"])("rejects %s", (value) => {
    expect(() => hexToBytes(value)).toThrow(TypeError);
  });
  test.each(["", "00ff", "00FF", "aBcD"])("accepts %s", (value) => {
    expect(hex(hexToBytes(value))).toBe(value.toLowerCase());
  });
  test("cold boot imports the shared decoder, and a malformed key refuses there", () => {
    const source = readFileSync(new URL("../src/cold-boot-ceremony.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/function\s+hexToBytes/);
    expect(source).toMatch(/import\s*\{[^}]*\bhexToBytes\b[^}]*\}\s*from\s*"\.\/crypto\.js"/);
    expect(didKeyFromVerifyingKey("ab".repeat(32))).toMatch(/^did:key:z/);   // CONTROL
    expect(() => didKeyFromVerifyingKey("0g".repeat(32))).toThrow(TypeError);
  });
});
