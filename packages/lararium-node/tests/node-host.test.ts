/**
 * lararium-node — causal island URI resolver + grammar runtime tests.
 *
 * All tests are pure and I/O-free. Grammar tests use inline TOML fixtures
 * to prove grammarRulesFromText() parses correctly — no disk reads.
 * The grammar content round-trip (shadow tiddler in built plugin) lives in
 * scripts/test-quine.ts.
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
  GRAMMAR_MEME_URI,
} from "@lararium/core";

// Minimal inline grammar fixture — exercises [[sigils]] and [[families]] TOML
// parsing without touching the filesystem. Proves the extractor works; the
// full canonical grammar content is verified by test-quine.ts at build time.
const GRAMMAR_FIXTURE = `\
<<~ ? -> ${GRAMMAR_MEME_URI} >>
\`\`\`toml iam
uri-path = "ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext"
\`\`\`
<<~>>
\`\`\`toml
[[sigils]]
name = "ahu"
kind = "block"
open_pattern = "<<~ ahu"
close_pattern = "<<~/ahu >>"

[[sigils]]
name = "pranala"
kind = "edge"
inline_pattern = "<<~ pranala"

[[sigils]]
name = "loulou"
kind = "edge"
inline_pattern = "<<~ loulou"

[[sigils]]
name = "aka"
kind = "edge"
inline_pattern = "<<~ aka"

[[sigils]]
name = "kahea"
kind = "edge"
inline_pattern = "<<~ kahea"

[[families]]
name = "reaction"
dag_required = "true"
role_recommended = "true"
confidence_bounded = "false"
\`\`\`
<<~>>`;

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
    const r = parseHostfulLarUri("lar://altar-fire:peer@elyncia.social/rooms/altar-fire");
    expect(r.authority.host).toBe("elyncia.social");
    expect(r.root).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// grammarRulesFromText — pure inline fixture, no I/O
// ---------------------------------------------------------------------------

describe("grammarRulesFromText — inline fixture", () => {
  test("parses sigils and families from TOML", () => {
    const rules = grammarRulesFromText(GRAMMAR_MEME_URI, GRAMMAR_FIXTURE);
    expect(rules).not.toBeNull();
  });

  test("extracts expected sigil names", () => {
    const rules = grammarRulesFromText(GRAMMAR_MEME_URI, GRAMMAR_FIXTURE);
    const names = rules!.sigils.map((s) => s.name);
    expect(names).toContain("ahu");
    expect(names).toContain("pranala");
    expect(names).toContain("loulou");
    expect(names).toContain("aka");
    expect(names).toContain("kahea");
  });

  test("ahu sigil has open and close patterns", () => {
    const rules = grammarRulesFromText(GRAMMAR_MEME_URI, GRAMMAR_FIXTURE);
    const ahu = rules!.sigils.find((s) => s.name === "ahu");
    expect(ahu?.openPattern).toBeTruthy();
    expect(ahu?.closePattern).toBeTruthy();
  });

  test("reaction family registered", () => {
    const rules = grammarRulesFromText(GRAMMAR_MEME_URI, GRAMMAR_FIXTURE);
    const families = rules!.families.map((f) => f.name);
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
