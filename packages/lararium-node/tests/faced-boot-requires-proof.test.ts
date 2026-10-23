/**
 * faced-boot-requires-proof — a boot that wears a sealed face anchor cannot skip its proof by leaving the persona plane out of
 * the bootstrap. A source weld over both composers (the boot itself needs a founded vessel; the face-boot-proof mesh tests carry
 * the behaviour): the proof block stands under the anchor alone, names the missing plane by refusal, hands the device edge to
 * the proof, and pins the verified head back into the anchor. CONTROL: the proof block still calls `proveFaceFromLog`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const read = (rel: string): string => readFileSync(join(import.meta.dirname, "..", "..", rel), "utf8");

describe("a faced boot proves its face", () => {
  for (const [name, rel, plane, pin] of [
    ["node composer", "lararium-node/src/open-node-vessel.ts", "bootstrap.personaUrl", "keepFaceAnchorOfGroup(pinned)"],
    ["browser composer", "lararium-browser/src/open-browser-vessel.ts", "social.personaUrl", "keepBrowserFaceAnchor(idbName, pinned)"],
  ] as const) {
    test(`RED: ${name} refuses a sealed anchor with no persona plane named, and pins the verified head`, () => {
      const src = read(rel);
      const proofAt = src.indexOf("proveFaceFromLog({");
      expect(proofAt, "CONTROL: the composer still proves the face").toBeGreaterThan(0);
      const before = src.slice(Math.max(0, proofAt - 900), proofAt);
      expect(before).toContain(`if (!${plane}) throw new Error(`);
      expect(before).toContain("names no persona plane for a face with a sealed anchor");
      const block = src.slice(proofAt, proofAt + 2200);
      expect(block).toMatch(/edge: (deviceEdge|wornEdge)/);
      expect(block).toContain(pin);
    });
  }
});
