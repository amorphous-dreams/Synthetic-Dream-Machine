/**
 * main-origin-composition — source weld for the startup/banner boundary.
 *
 * The pure origin controls live in lan-address.test.ts. This small source control pins the production
 * shore to the same contract until main grows an injectable boot harness: custody refuses first, a lararium
 * resolves one explicit composition per reach face before listening, the crossing banner prints only on the
 * hearth's composition and never in the herm's, and main never calls the retired relay→Web helper.
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

  test("the crossing banner prints only in the hearth's composition, never the herm's", () => {
    const hermStanding = SOURCE.indexOf("async function composeHermStanding(");
    const hearthStanding = SOURCE.indexOf("async function composeHearthStanding(");
    const banner = SOURCE.indexOf("crossingBannerLines(\"lararium\"");
    expect(hermStanding).toBeGreaterThan(-1);
    expect(hearthStanding).toBeGreaterThan(hermStanding);
    expect(banner).toBeGreaterThan(hearthStanding);
    expect(SOURCE.slice(hermStanding, hearthStanding)).not.toContain("crossingBannerLines(");
    expect(SOURCE.match(/crossingBannerLines\(/g)).toHaveLength(1);
  });

  test("the banner uses the resolved Web and relay origins independently", () => {
    expect(SOURCE).toContain("crossingBannerLines(\"lararium\", crossings, gateIdentity.verifyingKey)");
    expect(SOURCE).toContain(".relayOrigin");
    expect(SOURCE).not.toContain("webOriginForFace(");
  });
});

// A REFUSAL ABOVE THE FLOOR LEAVES THE FLOOR STANDING: the boot's own source composes at the floor when a
// composition handed the sovereign rows refuses, and ends the process only when the floor itself refuses. The
// first boot and every custody recomposition take the same road.
describe("main leaves the floor standing under a sovereign refusal", () => {
  const start = SOURCE.indexOf("const composeOrFloor = async (");
  const end = SOURCE.indexOf("// ── THE CUSTODY DOOR'S RECOMPOSITION", start);
  const road = SOURCE.slice(start, end);

  test("the sovereign refusal recomposes at the floor; a floor refusal frees the store and rethrows", () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const sovereign = road.indexOf("return { stood: await composeStanding(readers) };");
    const named = road.indexOf("the sovereign composition refused", sovereign);
    const floor = road.indexOf("return { stood: await composeStanding(null).catch(floorRefused), refused };", named);
    expect(sovereign).toBeGreaterThan(-1);
    expect(named).toBeGreaterThan(sovereign);
    expect(floor).toBeGreaterThan(named);
    // The refusal never wears the supervisor's `fatal:` marker while the floor stands.
    expect(road).not.toContain("fatal:");
    // A floor that refuses closes the front, frees the store's name and rethrows.
    expect(SOURCE).toMatch(/const floorRefused = async \(err: unknown\): Promise<never> => \{\s*front\.close\(\);\s*await floor\.release\(\);\s*throw err;/);
  });

  test("the first boot and the custody door's recomposition both compose through that one road", () => {
    expect(SOURCE).toContain("composition = (await composeOrFloor(null)).stood;");
    expect(SOURCE).toContain("const out = await composeOrFloor(sovereign ? seatedSovereignReaders() : null);");
    expect(SOURCE.match(/composeStanding\(/g)!.length, "no third road composes past composeOrFloor").toBe(3);
  });
});
