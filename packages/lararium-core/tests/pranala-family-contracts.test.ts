/**
 * Family contract validation — P9 / pranala-schema-binding law.
 * validatePranaEdge() enforces per-family property contracts before edges
 * enter the boot closure.
 */

import { validatePranaEdge, type PranaEdge } from "../src/pranala-parser.js";

function edge(overrides: Partial<PranaEdge>): PranaEdge {
  return {
    fromUri: "lar:///test",
    fromSocket: "lar:///test#section",
    fromSlot: null,
    toUri: "lar:///target",
    toSocket: "",
    family: "control",
    lifecycle: "instance",
    role: "owns",
    traversal: "source-to-target",
    propagation: "none",
    label: "",
    payload: {},
    cardinality: null,
    polarity: null,
    status: "declared",
    confidence: null,
    renderMode: null,
    ...overrides,
  };
}

describe("validatePranaEdge — family contracts", () => {
  test("known families produce no errors", () => {
    for (const family of ["control", "relation", "observe", "dataflow"]) {
      const violations = validatePranaEdge(edge({ family, role: "test" }));
      expect(violations.filter((v) => v.severity === "error")).toHaveLength(0);
    }
  });

  test("unknown family → error", () => {
    const v = validatePranaEdge(edge({ family: "invented" }));
    expect(v).toHaveLength(1);
    expect(v[0]!.severity).toBe("error");
    expect(v[0]!.rule).toBe("unknown-family");
  });

  test("control without role → warning, not error", () => {
    const v = validatePranaEdge(edge({ family: "control", role: null }));
    expect(v).toHaveLength(1);
    expect(v[0]!.severity).toBe("warning");
    expect(v[0]!.rule).toBe("role-recommended");
  });

  test("control with role → clean", () => {
    const v = validatePranaEdge(edge({ family: "control", role: "owns" }));
    expect(v).toHaveLength(0);
  });

  test("dataflow without role → warning", () => {
    const v = validatePranaEdge(edge({ family: "dataflow", role: null }));
    expect(v.some((x) => x.severity === "warning" && x.rule === "role-recommended")).toBe(true);
  });

  test("relation without role → clean (role not required)", () => {
    const v = validatePranaEdge(edge({ family: "relation", role: null }));
    expect(v.filter((x) => x.rule === "role-recommended")).toHaveLength(0);
  });

  test("observe with confidence in [0,1] → clean", () => {
    const v = validatePranaEdge(edge({ family: "observe", role: null, confidence: 0.75 }));
    expect(v.filter((x) => x.rule === "confidence-out-of-range")).toHaveLength(0);
  });

  test("observe with confidence > 1 → error", () => {
    const v = validatePranaEdge(edge({ family: "observe", role: null, confidence: 1.5 }));
    expect(v.some((x) => x.severity === "error" && x.rule === "confidence-out-of-range")).toBe(true);
  });

  test("observe with confidence < 0 → error", () => {
    const v = validatePranaEdge(edge({ family: "observe", role: null, confidence: -0.1 }));
    expect(v.some((x) => x.severity === "error" && x.rule === "confidence-out-of-range")).toBe(true);
  });

  test("observe with null confidence → clean", () => {
    const v = validatePranaEdge(edge({ family: "observe", role: null, confidence: null }));
    expect(v.filter((x) => x.rule === "confidence-out-of-range")).toHaveLength(0);
  });

  test("violation carries edge identity fields", () => {
    const v = validatePranaEdge(edge({ family: "invented", fromUri: "lar:///a", toUri: "lar:///b" }));
    expect(v[0]!.fromUri).toBe("lar:///a");
    expect(v[0]!.toUri).toBe("lar:///b");
    expect(v[0]!.family).toBe("invented");
  });
});
