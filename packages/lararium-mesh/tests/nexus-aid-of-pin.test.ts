import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { hex } from "../src/crypto.js";
import { nexusAidOfPin } from "../src/gate-bundle.js";

describe("nexusAidOfPin", () => {
  test.each([
    ["valid", hex(new TextEncoder().encode("nexus-a")), "nexus-a"],
    ["invalid pair", "0g00", null],
    ["odd", "abc", null],
    ["malformed UTF-8", "fffe", null],
    ["uppercase", "4E45585553", "NEXUS"],
  ])("%s", (_label, nexus, expected) => expect(nexusAidOfPin({ nexus })).toBe(expected));
  test("node and browser presentation import the shared helper", () => {
    for (const path of ["../../lararium-node/src/dial-presentation.ts", "../../lararium-browser/src/browser-face-presentation.ts"]) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).not.toMatch(/function\s+nexusAidOfPin/);
      expect(source).toMatch(/import\s*\{[^}]*\bnexusAidOfPin\b[^}]*\}\s*from\s*"@lararium\/mesh"/);
    }
  });
});
