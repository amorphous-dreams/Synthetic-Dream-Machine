/**
 * main-origin-composition — source weld for the startup/banner boundary.
 *
 * The pure origin controls live in lan-address.test.ts. This small source control pins the production
 * shore to the same contract until main grows an injectable boot harness: it must resolve one explicit
 * composition per reach face before listening and must not call the retired relay→Web helper.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = readFileSync(join(process.cwd(), "src", "main.ts"), "utf8");

describe("main's explicit origin composition weld", () => {
  test("loads the config declaration and resolves every reach face before the listener", () => {
    expect(SOURCE).toContain("originDeclaration(cfg)");
    expect(SOURCE).toContain("const originCompositions = reachFaces.map");
    expect(SOURCE).toContain("originCompositionForFace(face, origins)");
    expect(SOURCE.indexOf("const originCompositions = reachFaces.map")).toBeLessThan(SOURCE.indexOf("httpServer.listen"));
  });

  test("the banner uses the resolved Web and relay origins independently", () => {
    expect(SOURCE).toContain("composition.webOrigin");
    expect(SOURCE).toContain("composition.relayOrigin");
    expect(SOURCE).not.toContain("webOriginForFace(");
  });
});
