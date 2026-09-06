/**
 * vessel-bag-tier — the crossing gate's disk shore reads a hearth bag's declared tier.
 *
 * Fail-closed at every edge: a non-bag URL, a path-shaped name, an absent directory, an absent or
 * torn manifest — each answers null (or the manifest's own VEIL default), never a guess.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/cap-tier
 */

import { describe, test, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BagHomeRoots } from "@lararium/mesh";
import { makeBagTierReader, bagNameFromBagUrl } from "../src/vessel-bag-tier.js";

function makeHearth(): { roots: BagHomeRoots; hearth: string } {
  const hearth = mkdtempSync(join(tmpdir(), "bag-tier-"));
  return { roots: { hearth, repositories: new Map() }, hearth };
}

function declareBag(hearth: string, name: string, tier: string): void {
  const dir = join(hearth, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "meta.mem"), [
    "```toml meta",
    `bag       = "${name}"`,
    `cap-tier  = "${tier}"`,
    `home      = "hearth"`,
    "```",
    "",
  ].join("\n"));
}

describe("bagNameFromBagUrl", () => {
  test("parses exactly the manifest's own address shape", () => {
    expect(bagNameFromBagUrl("lar:///ha.ka.ba/bags/shelf")).toBe("shelf");
  });

  test("refuses everything looser", () => {
    expect(bagNameFromBagUrl("lar:///ha.ka.ba/bags/")).toBeNull();
    expect(bagNameFromBagUrl("lar:///ha.ka.ba/bags/a/b")).toBeNull();
    expect(bagNameFromBagUrl("lar:///ha.ka.ba/bags/.hidden")).toBeNull();
    expect(bagNameFromBagUrl("lar:///ha.ka.ba/wikis/shelf")).toBeNull();
    expect(bagNameFromBagUrl("https://example.com/bags/shelf")).toBeNull();
  });
});

describe("makeBagTierReader", () => {
  test("reads a declared tier off the hearth", () => {
    const { roots, hearth } = makeHearth();
    declareBag(hearth, "shelf", "public");
    const tier = makeBagTierReader(roots);
    expect(tier("lar:///ha.ka.ba/bags/shelf")).toBe("public");
  });

  test("a bag with no hearth directory answers null — the gate reads VEIL", () => {
    const { roots } = makeHearth();
    const tier = makeBagTierReader(roots);
    expect(tier("lar:///ha.ka.ba/bags/absent")).toBeNull();
  });

  test("a bag directory with no manifest answers the fail-closed default (veil)", () => {
    const { roots, hearth } = makeHearth();
    mkdirSync(join(hearth, "bare"), { recursive: true });
    const tier = makeBagTierReader(roots);
    expect(tier("lar:///ha.ka.ba/bags/bare")).toBe("veil");
  });

  test("a torn cap-tier value reads VEIL through parseCapTier, never a throw", () => {
    const { roots, hearth } = makeHearth();
    declareBag(hearth, "torn", "loud-nonsense");
    const tier = makeBagTierReader(roots);
    expect(tier("lar:///ha.ka.ba/bags/torn")).toBe("veil");
  });

  test("a non-bag URL answers null", () => {
    const { roots } = makeHearth();
    const tier = makeBagTierReader(roots);
    expect(tier("lar:///lares.scryer.found")).toBeNull();
  });
});
