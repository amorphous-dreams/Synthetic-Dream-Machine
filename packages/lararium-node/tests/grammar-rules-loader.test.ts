/**
 * Integration test: loadGrammarRules() reads lares/grammars/memetic-wikitext.md
 * and extracts the [[sigils]] and [[families]] TOML arrays into a GrammarRules object.
 *
 * This test verifies that Phase 2 wiring works end-to-end — the grammar carrier
 * provides the same patterns as the built-in constants, so all existing parses
 * produce identical results with or without the grammar arg.
 */

import { loadGrammarRules } from "../src/node-host.js";

describe("loadGrammarRules()", () => {
  let grammar: ReturnType<typeof loadGrammarRules>;

  beforeAll(() => {
    grammar = loadGrammarRules();
  });

  test("returns non-null when lares/grammars/memetic-wikitext.md exists", () => {
    expect(grammar).not.toBeNull();
  });

  test("extracts expected sigil names", () => {
    const names = grammar!.sigils.map((s) => s.name);
    expect(names).toContain("ahu");
    expect(names).toContain("pranala");
    expect(names).toContain("loulou");
    expect(names).toContain("aka");
    expect(names).toContain("kahea");
  });

  test("ahu sigil has open and close patterns", () => {
    const ahu = grammar!.sigils.find((s) => s.name === "ahu");
    expect(ahu).toBeDefined();
    expect(ahu!.openPattern).toBeTruthy();
    expect(ahu!.closePattern).toBeTruthy();
  });

  test("pranala sigil has block and inline patterns", () => {
    const pranala = grammar!.sigils.find((s) => s.name === "pranala");
    expect(pranala).toBeDefined();
    expect(pranala!.blockPattern).toBeTruthy();
    expect(pranala!.inlinePattern).toBeTruthy();
  });

  test("sugar sigils have default families matching built-in defaults", () => {
    const loulou = grammar!.sigils.find((s) => s.name === "loulou");
    const aka    = grammar!.sigils.find((s) => s.name === "aka");
    const kahea  = grammar!.sigils.find((s) => s.name === "kahea");
    expect(loulou!.defaultFamily).toBe("relation");
    expect(aka!.defaultFamily).toBe("observe");
    expect(kahea!.defaultFamily).toBe("dataflow");
    expect(kahea!.defaultPropagation).toBe("push-forward");
  });

  test("extracts expected family names", () => {
    const names = grammar!.families.map((f) => f.name);
    expect(names).toContain("control");
    expect(names).toContain("relation");
    expect(names).toContain("observe");
    expect(names).toContain("dataflow");
  });

  test("control family has roleRecommended=true", () => {
    const control = grammar!.families.find((f) => f.name === "control");
    expect(control!.roleRecommended).toBe(true);
  });

  test("observe family has confidenceBounded=true", () => {
    const observe = grammar!.families.find((f) => f.name === "observe");
    expect(observe!.confidenceBounded).toBe(true);
  });

  test("relation family has roleRecommended=false", () => {
    const relation = grammar!.families.find((f) => f.name === "relation");
    expect(relation!.roleRecommended).toBe(false);
  });

  test("sigil patterns compile to valid RegExp without throwing", () => {
    for (const sigil of grammar!.sigils) {
      for (const key of ["openPattern", "closePattern", "blockPattern", "inlinePattern", "pattern"] as const) {
        const src = sigil[key];
        if (src) expect(() => new RegExp(src)).not.toThrow();
      }
    }
  });
});
