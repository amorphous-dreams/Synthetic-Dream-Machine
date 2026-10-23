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
    ["browser composer", "lararium-browser/src/open-browser-vessel.ts", "wornPlaneUrl", "keepBrowserFaceAnchor(idbName, pinned)"],
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

  for (const [name, rel] of [
    ["node composer", "lararium-node/src/open-node-vessel.ts"],
    ["browser composer", "lararium-browser/src/open-browser-vessel.ts"],
  ] as const) {
    test(`RED: ${name} registers a persona plane only where a face proof vouched for its url`, () => {
      const src = read(rel);
      expect(src, "no registration reads every bootstrap plane ungated").not.toMatch(/for \(const plane of (bootstrap|social)\.personaPlanes\)\s*\{?\s*registerInCatalog\(/);
      expect(src).toMatch(/provenPlanes\.get\(plane\.personaGroupId\) === plane\.url\) registerInCatalog\(/);
      const proofAt = src.indexOf("proveFaceFromLog({");
      const registerAt = src.indexOf("provenPlanes.get(plane.personaGroupId) === plane.url");
      expect(proofAt, "CONTROL: the worn proof stands").toBeGreaterThan(0);
      expect(registerAt, "the registration follows the worn face's proof").toBeGreaterThan(proofAt);
    });
  }

  test("RED: the node boot's two anchor writes chain through the standing anchor, so a lease raise never erases the act pin", () => {
    const src = read("lararium-node/src/open-node-vessel.ts");
    expect(src).toContain("raiseAnchorFromSlots(standingAnchor!, slots, personaKelChain)");
    expect(src).not.toMatch(/raiseAnchorFromSlots\(faceAnchor,/);
    expect(src).toContain("{ await keepFaceAnchorOfGroup(pinned); standingAnchor = pinned; }");
  });

  test("RED: the worn face's gates, same-operator views and Kahu mount read sealed custody's group, never the bootstrap's group text, and the views and gates wait for the proof", () => {
    const src = read("lararium-node/src/open-node-vessel.ts");
    expect(src).toContain("const custodyGroup: string | null = wornMount?.personaGroupId");
    expect(src).toContain("faceFleetViews(() => (wornFaceProven ? faceBootTiddlers : null), () => custodyGroup)");
    expect(src).toContain("return wornFaceProven && custodyGroup ? { face: wornMount?.handleIndex ?? 0, personaGroup: custodyGroup } : null;");
    expect(src).toContain("personaGroupId: custodyGroup,");
    expect(src).not.toMatch(/faceBootTiddlers\??\.\[PERSONA_GROUP_ID_TIDDLER\]/);
    expect(src).toContain("wornFaceProven = true;");
  });
});
