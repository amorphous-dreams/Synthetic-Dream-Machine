/**
 * Grammar Phase 2.x parser tests.
 *
 * papalohe (reaction family sugar):
 *   <<~ papalohe FROM -> TO >>
 *   <<~ papalohe FROM -> TO trigger:EventName >>
 *   <<~ papalohe #slot FROM -> TO trigger:EventName >>
 *
 * reaction family: wired in KNOWN_FAMILIES + FAMILY_CONTRACTS
 *   - roleRecommended: true (trigger recommended — warns if absent)
 *   - confidenceBounded: false
 *
 * kau / kumu / new aliases: grammar meme registration only (no parser wiring needed
 * until Phase 3 rule-interpreter — they are TOML entries read by GrammarRules).
 * Validated here via validatePranaEdge on reaction edges and KNOWN_FAMILIES export.
 */

import { describe, test, expect } from "@jest/globals";
import { parsePranalaEdges, validatePranaEdge, KNOWN_FAMILIES } from "../src/pranala-parser.js";

const BASE = "lar:///grammars/test-carrier";

function edges(body: string) {
  return parsePranalaEdges(BASE, body);
}

// ---------------------------------------------------------------------------
// papalohe sugar
// ---------------------------------------------------------------------------

describe("papalohe — reaction family sugar", () => {
  test("minimal: FROM -> TO, no trigger", () => {
    const result = edges("<<~ papalohe lar:///device-a -> lar:///device-b >>");
    expect(result).toHaveLength(1);
    const e = result[0]!;
    expect(e.family).toBe("reaction");
    expect(e.fromUri).toBe("lar:///device-a");
    expect(e.toUri).toBe("lar:///device-b");
  });

  test("with trigger property", () => {
    const result = edges("<<~ papalohe lar:///device-a -> lar:///device-b trigger:OnBegin >>");
    expect(result).toHaveLength(1);
    const e = result[0]!;
    expect(e.family).toBe("reaction");
    expect(e.payload?.["trigger"]).toBe("OnBegin");
  });

  test("with #slot anchor", () => {
    const body = `
<<~ ahu #source >>
<<~ papalohe #wire lar:///device-a -> lar:///device-b trigger:OnEnd >>
<<~/ahu >>`;
    const result = edges(body);
    const papaloheEdge = result.find((e) => e.family === "reaction");
    expect(papaloheEdge).toBeDefined();
    expect(papaloheEdge!.fromSlot).toBe(`${BASE}#wire`);
  });

  test("? resolves from enclosing ahu socket", () => {
    const body = `
<<~ ahu #my-device >>
<<~ papalohe ? -> lar:///device-b trigger:OnActivated >>
<<~/ahu >>`;
    const result = edges(body);
    const e = result.find((e) => e.family === "reaction");
    expect(e).toBeDefined();
    expect(e!.fromSocket).toBe(`${BASE}#my-device`);
  });

  test("multiple papalohe edges in one carrier", () => {
    const body = `
<<~ papalohe lar:///a -> lar:///b trigger:OnBegin >>
<<~ papalohe lar:///b -> lar:///c trigger:OnEnd >>`;
    const result = edges(body);
    expect(result.filter((e) => e.family === "reaction")).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// reaction family contract
// ---------------------------------------------------------------------------

describe("reaction family — validatePranaEdge", () => {
  test("reaction edge without trigger: no error (trigger not required, just recommended)", () => {
    const violations = validatePranaEdge({
      fromUri: "lar:///a", fromSocket: "lar:///a", fromSlot: null,
      toUri: "lar:///b", toSocket: "lar:///b",
      family: "reaction", role: null, lifecycle: "instance",
      label: "", cardinality: null, polarity: null, status: "declared",
      confidence: null, renderMode: null, traversal: "source-to-target",
      propagation: "none", payload: {},
    });
    const errors = violations.filter((v) => v.severity === "error");
    expect(errors).toHaveLength(0);
  });

  test("reaction edge without role: warning (roleRecommended = true)", () => {
    const violations = validatePranaEdge({
      fromUri: "lar:///a", fromSocket: "lar:///a", fromSlot: null,
      toUri: "lar:///b", toSocket: "lar:///b",
      family: "reaction", role: null, lifecycle: "instance",
      label: "", cardinality: null, polarity: null, status: "declared",
      confidence: null, renderMode: null, traversal: "source-to-target",
      propagation: "none", payload: {},
    });
    const warnings = violations.filter((v) => v.severity === "warning" && v.rule === "role-recommended");
    expect(warnings).toHaveLength(1);
  });

  test("reaction edge with role: no warnings", () => {
    const violations = validatePranaEdge({
      fromUri: "lar:///a", fromSocket: "lar:///a", fromSlot: null,
      toUri: "lar:///b", toSocket: "lar:///b",
      family: "reaction", role: "subscription", lifecycle: "instance",
      label: "", cardinality: null, polarity: null, status: "declared",
      confidence: null, renderMode: null, traversal: "source-to-target",
      propagation: "none", payload: {},
    });
    expect(violations).toHaveLength(0);
  });

  test("unknown family still errors", () => {
    const violations = validatePranaEdge({
      fromUri: "lar:///a", fromSocket: "lar:///a", fromSlot: null,
      toUri: "lar:///b", toSocket: "lar:///b",
      family: "ghost-family", role: null, lifecycle: "instance",
      label: "", cardinality: null, polarity: null, status: "declared",
      confidence: null, renderMode: null, traversal: "source-to-target",
      propagation: "none", payload: {},
    });
    const errors = violations.filter((v) => v.severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]!.rule).toBe("unknown-family");
  });
});

// ---------------------------------------------------------------------------
// KNOWN_FAMILIES export
// ---------------------------------------------------------------------------

describe("KNOWN_FAMILIES — 7 families registered", () => {
  test("reaction is in KNOWN_FAMILIES", () => {
    expect((KNOWN_FAMILIES as readonly string[]).includes("reaction")).toBe(true);
  });

  test("all 7 families present", () => {
    const expected = ["control", "relation", "observe", "dataflow", "message", "constraint", "reaction"];
    for (const f of expected) {
      expect((KNOWN_FAMILIES as readonly string[]).includes(f)).toBe(true);
    }
  });
});
