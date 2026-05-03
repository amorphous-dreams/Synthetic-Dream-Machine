/**
 * lararium-node — causal island URI resolver + grammar runtime tests.
 *
 * Node-host duties: filesystem hydration, carrier index compilation, grammar
 * seeding (disk → CRDT once; runtime reads CRDT — never disk again).
 *
 * Tests exercise pure, I/O-free functions from @lararium/core plus the one
 * grammar round-trip that reads the canonical lares/grammars/memetic-wikitext.md
 * carrier from disk (present in the monorepo; stable contract).
 *
 * No HTTP, no OAuth routes, no web2 auth ceremony.
 *
 * Meme: lar:///ha.ka.ba/@lares/api/v0.1/lararium/node-host
 */

import { describe, test, expect } from "@jest/globals";
import {
  resolveLarUri,
  parseHostfulLarUri,
  isHostfulLarUri,
  abilityImplies,
  grammarRulesFromText,
} from "@lararium/core";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { LARES_ROOT } from "../src/node-host.js";

// ---------------------------------------------------------------------------
// lar:/// URI resolver — isomorphic, pure (no I/O)
// ---------------------------------------------------------------------------

describe("resolveLarUri — canonical URI topology", () => {
  test("AGENTS root resolves as caps-file, non-virtual", () => {
    const r = resolveLarUri("lar:///AGENTS");
    expect(r.kind).toBe("caps-file");
    expect(r.virtual).toBe(false);
    expect(r.root).toBe("AGENTS");
  });

  test("LARES root resolves as caps-file", () => {
    const r = resolveLarUri("lar:///LARES");
    expect(r.kind).toBe("caps-file");
    expect(r.virtual).toBe(false);
  });

  test("ha.ka.ba/@lares sub-path resolves as tuple-file, non-virtual", () => {
    const r = resolveLarUri("lar:///ha.ka.ba/@lares/api/v0.1/mu");
    expect(["file", "tuple-file"]).toContain(r.kind);
    expect(r.virtual).toBe(false);
    expect(r.root).toBe("ha.ka.ba");
  });

  test("ha.ka.ba/@lares/AGENTS shorthand resolves as caps-file", () => {
    const r = resolveLarUri("lar:///ha.ka.ba/@lares/AGENTS");
    expect(r.kind).toBe("caps-file");
    expect(r.virtual).toBe(false);
  });

  test("INDEXES/* paths are virtual (cannot be materialized from disk)", () => {
    const r = resolveLarUri("lar:///INDEXES/carriers");
    expect(r.virtual).toBe(true);
  });

  test("resolves laresRelPath for grammar carrier", () => {
    const r = resolveLarUri("lar:///ha.ka.ba/@lares/api/v0.1/mu");
    expect(r.laresRelPath).toBeTruthy();
    expect(r.laresRelPath).toMatch(/\.md$/);
  });
});

// ---------------------------------------------------------------------------
// isHostfulLarUri / parseHostfulLarUri
// ---------------------------------------------------------------------------

describe("isHostfulLarUri", () => {
  test("hostless lar:///path → false", () => {
    expect(isHostfulLarUri("lar:///AGENTS")).toBe(false);
    expect(isHostfulLarUri("lar:///ha.ka.ba/@lares/api/v0.1/mu")).toBe(false);
  });

  test("hostful lar://node.local/path → true", () => {
    expect(isHostfulLarUri("lar://altar-fire.local/rooms/main")).toBe(true);
    expect(isHostfulLarUri("lar://elyncia.social/ha.ka.ba/@lares/api/v0.1/mu")).toBe(true);
  });
});

describe("parseHostfulLarUri", () => {
  test("extracts host and path from a hostful lar: URI", () => {
    const r = parseHostfulLarUri("lar://elyncia.social/rooms/altar-fire");
    expect(r.host).toBe("elyncia.social");
    expect(r.root).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// grammarRulesFromText — reads real grammar carrier from lares/
// ---------------------------------------------------------------------------

describe("grammarRulesFromText — real lares/grammars/memetic-wikitext.md", () => {
  const grammarPath = join(LARES_ROOT, "grammars", "memetic-wikitext.md");
  const grammarExists = existsSync(grammarPath);

  // Skip gracefully if the carrier is not present (CI without full repo).
  test.skipIf(!grammarExists)("loads grammar carrier from disk", () => {
    const text = readFileSync(grammarPath, "utf8");
    const rules = grammarRulesFromText("lar:///grammars/memetic-wikitext", text);
    expect(rules).not.toBeNull();
  });

  test.skipIf(!grammarExists)("extracts expected sigil names", () => {
    const text  = readFileSync(grammarPath, "utf8");
    const rules = grammarRulesFromText("lar:///grammars/memetic-wikitext", text);
    const names = rules!.sigils.map((s) => s.name);
    expect(names).toContain("ahu");
    expect(names).toContain("pranala");
    expect(names).toContain("loulou");
    expect(names).toContain("aka");
    expect(names).toContain("kahea");
  });

  test.skipIf(!grammarExists)("ahu sigil has open and close patterns", () => {
    const text = readFileSync(grammarPath, "utf8");
    const rules = grammarRulesFromText("lar:///grammars/memetic-wikitext", text);
    const ahu = rules!.sigils.find((s) => s.name === "ahu");
    expect(ahu?.openPattern).toBeTruthy();
    expect(ahu?.closePattern).toBeTruthy();
  });

  test.skipIf(!grammarExists)("papalohe/reaction family registered (Phase 2x)", () => {
    const text = readFileSync(grammarPath, "utf8");
    const rules = grammarRulesFromText("lar:///grammars/memetic-wikitext", text);
    const families = rules!.families.map((f) => f.name);
    // reaction family powers kumu device event wiring
    expect(families).toContain("reaction");
  });
});

// ---------------------------------------------------------------------------
// Node-peer capability invariants (pure, no Automerge required)
// ---------------------------------------------------------------------------

describe("Node-peer causal island capabilities", () => {
  test("node peer holds promote ability (can gate canon ceremony)", () => {
    // Admin implies promote — the node peer must hold admin to gate promotions.
    expect(abilityImplies("admin", "promote")).toBe(true);
  });

  test("room-level write does NOT imply canon promote (content ≠ authority)", () => {
    expect(abilityImplies("write", "promote")).toBe(false);
  });

  test("relay (pull) cannot read room content (causal island boundary law)", () => {
    expect(abilityImplies("pull", "read")).toBe(false);
  });
});
