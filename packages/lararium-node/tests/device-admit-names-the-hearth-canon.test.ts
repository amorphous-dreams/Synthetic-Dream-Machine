/**
 * device-admit names the hearth's canon documents — the per-relation pointer a joinee mounts by.
 *
 * A leaf opens its hearth's wiki. The documents that wiki reads (`@lares`, `@lararium`) ride the fleet-join answer's
 * signed carriage by name, beside the gate pin, so the joinee's gate widens by exactly those documents and the
 * hearth's catalog plane never crosses to it. The Kahu realm owns those names (one owner per registry): the door reads
 * them through `admitCanonDocs` keyed by the hearth's custody group, never off the catalog. What that reading names
 * stands in `admit-canon-reads-the-realm`; this file holds the door to it.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/device-admit
 */
import { readFileSync } from "node:fs";
import { describe, test, expect } from "vitest";

describe("the fleet-join door names the hearth's canon", () => {
  test("★ the door reads the realm's canon into the hearth reading the fleet-join answer signs ★", () => {
    const src = readFileSync(new URL("../src/commands/device-admit.ts", import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const hearth = src.slice(src.indexOf("const hearth: AdmitHearthReading = {"));
    expect(hearth.slice(0, hearth.indexOf("};")), "the hearth reading names no canon documents")
      .toMatch(/canon:\s*await admitCanonDocs\(repo, larSealHome\(\), await hearthCustodyGroup\(\)\)/);
    expect(src, "the door imports the realm's canon reader").toMatch(/import \{ admitCanonDocs, hearthCustodyGroup \} from "\.\.\/kahu-realm\.js";/);
    expect(src, "a carried admit composes beside the signed edge").not.toMatch(/CarriedAdmitPayload\s*=/);
  });
});
