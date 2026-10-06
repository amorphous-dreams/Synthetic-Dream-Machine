/**
 * main-origin-composition — source weld for the startup/banner boundary.
 *
 * The pure origin controls live in lan-address.test.ts. This small source control pins the production
 * shore to the same contract until main grows an injectable boot harness: custody refuses first, a lararium
 * resolves one explicit composition per reach face before listening, the crossing banner prints only on the
 * lararium side of the herm branch, and main never calls the retired relay→Web helper.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = readFileSync(join(process.cwd(), "src", "main.ts"), "utf8");

describe("main's explicit origin composition weld", () => {
  test("loads the config declaration and resolves every reach face before the listener", () => {
    expect(SOURCE).toContain("originDeclaration(cfg)");
    expect(SOURCE).toContain("const originCompositions = askedStanding !== \"lararium\" ? null : reachFaces.map");
    expect(SOURCE).toContain("originCompositionForFace(face, origins, askedStanding)");
    expect(SOURCE.indexOf("const originCompositions =")).toBeLessThan(SOURCE.indexOf("httpServer.listen"));
  });

  test("origin custody refuses before the composition, the Pronaos, and the listener", () => {
    const custody = SOURCE.indexOf("assertWaystoneCustody(askedStanding, origins, process.env)");
    expect(custody).toBeGreaterThan(-1);
    expect(custody).toBeLessThan(SOURCE.indexOf("const originCompositions ="));
    expect(custody).toBeLessThan(SOURCE.indexOf("composePronaosFromEnv("));
    expect(SOURCE.indexOf("composePronaosFromEnv({ httpServer, genesisDir, dispatcher, standing: askedStanding })")).toBeLessThan(SOURCE.indexOf("httpServer.listen"));
  });

  test("the crossing banner prints only past the herm branch's return", () => {
    const hermBranch = SOURCE.indexOf("if (standing === \"herm\") {");
    const hermReturn = SOURCE.indexOf("    return;\n  }", hermBranch);
    const banner = SOURCE.indexOf("crossingBannerLines(\"lararium\"");
    expect(hermBranch).toBeGreaterThan(-1);
    expect(hermReturn).toBeGreaterThan(hermBranch);
    expect(banner).toBeGreaterThan(hermReturn);
    expect(SOURCE.match(/crossingBannerLines\(/g)).toHaveLength(1);
  });

  test("the banner uses the resolved Web and relay origins independently", () => {
    expect(SOURCE).toContain("crossingBannerLines(\"lararium\", crossings, gateIdentity.verifyingKey)");
    expect(SOURCE).toContain(".relayOrigin");
    expect(SOURCE).not.toContain("webOriginForFace(");
  });
});
