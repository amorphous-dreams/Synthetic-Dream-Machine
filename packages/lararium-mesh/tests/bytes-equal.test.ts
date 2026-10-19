import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { bytesEqual, constantTimeBytesEqual } from "../src/crypto.js";

describe("byte comparison", () => {
  const cases: [string, Uint8Array, Uint8Array, boolean][] = [
    ["equal", Uint8Array.of(1, 2), Uint8Array.of(1, 2), true],
    ["first byte", Uint8Array.of(0, 2), Uint8Array.of(1, 2), false],
    ["last byte", Uint8Array.of(1, 2), Uint8Array.of(1, 3), false],
    ["length", Uint8Array.of(1), Uint8Array.of(1, 2), false],
    ["empty", new Uint8Array(), new Uint8Array(), true],
    ["views", Uint8Array.of(8, 1, 2, 9).subarray(1, 3), Uint8Array.of(1, 2), true],
  ];
  test.each(cases)("%s", (_name, a, b, expected) => {
    expect(bytesEqual(a, b)).toBe(expected);
    expect(constantTimeBytesEqual(a, b)).toBe(expected);
  });
  test("the constant-time loop has no early return and sensitive callers import it", () => {
    const crypto = readFileSync(new URL("../src/crypto.ts", import.meta.url), "utf8");
    const body = crypto.match(/export function constantTimeBytesEqual\([^)]*\): boolean \{([\s\S]*?)\n\}/)?.[1];
    expect(body).toBeDefined();
    // Past the length guard, the body answers once, after the loop: no return can leave the scan early.
    const scan = body!.replace(/^\s*if \(a\.length !== b\.length\) return false;/m, "");
    expect(scan).not.toBe(body);
    expect(scan.match(/\breturn\b/g)).toHaveLength(1);
    expect(scan.trim()).toMatch(/for\s*\([^)]*\)[^;]*\^[^;]*;\s*return diff === 0;$/);
    for (const path of ["../src/sealed-chunk.ts", "../../lararium-browser/src/browser-custody.ts"]) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).toMatch(/import\s*\{[^}]*constantTimeBytesEqual[^}]*\}\s*from/);
      expect(source).not.toMatch(/function\s+bytesEqual|const\s+bytesEqual\s*=/);
    }
    for (const path of ["../src/slip39.ts", "../src/sealed-writer.ts", "../../lararium-browser/src/browser-fleet-join.ts", "../../lararium-node/src/fleet-join-custody.ts", "../../lararium-node/src/seat-key-store.ts", "../../lararium-node/src/face-key-custody.ts"]) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).not.toMatch(/(?:function\s+sameBytes|const\s+sameBytes\s*=|function\s+bytesEqual)/);
    }
  });
});
