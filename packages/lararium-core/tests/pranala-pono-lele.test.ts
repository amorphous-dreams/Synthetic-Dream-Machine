/**
 * pono (constraint family sugar) and lele (message family sugar) parser tests.
 *
 * pono: inline-pranala-style with family:constraint default
 *   <<~ pono ? -> lar:///target >>
 *   <<~ pono #slot ? -> lar:///target >>
 *   <<~ pono ? -> lar:///target role:invariant >>
 *
 * lele: single-URI sugar with family:message default
 *   <<~ lele lar:///target >>
 */

import { describe, test, expect } from "@jest/globals";
import { parsePranalaEdges, validatePranaEdge } from "../src/pranala-parser.js";

const BASE = "lar:///grammars/test-carrier";

function edges(body: string) {
  return parsePranalaEdges(BASE, body);
}

describe("pono — constraint family edge sugar", () => {
  test("bare ? -> resolves fromSocket to carrier URI when no ahu open", () => {
    const [e] = edges(`<<~ pono ? -> lar:///ha.ka.ba/api/v0.1/pono/invariant >>`);
    expect(e).toBeDefined();
    expect(e!.family).toBe("constraint");
    expect(e!.fromUri).toBe(BASE);
    expect(e!.fromSocket).toBe(BASE);
    expect(e!.fromSlot).toBeNull();
    expect(e!.toUri).toBe("lar:///ha.ka.ba/api/v0.1/pono/invariant");
    expect(e!.role).toBeNull();
  });

  test("bare ? -> resolves fromSocket to innermost ahu when ahu open", () => {
    const body = `
<<~ ahu #rules >>
<<~ pono ? -> lar:///ha.ka.ba/api/v0.1/pono/invariant >>
<<~/ahu >>
    `;
    const [e] = edges(body);
    expect(e!.family).toBe("constraint");
    expect(e!.fromSocket).toBe(`${BASE}#rules`);
    expect(e!.fromSlot).toBeNull();
  });

  test("#slot sets fromSlot, ? still resolves fromSocket from ahu stack", () => {
    const body = `
<<~ ahu #body >>
<<~ pono #required ? -> lar:///ha.ka.ba/api/v0.1/pono/invariant >>
<<~/ahu >>
    `;
    const [e] = edges(body);
    expect(e!.family).toBe("constraint");
    expect(e!.fromSocket).toBe(`${BASE}#body`);
    expect(e!.fromSlot).toBe(`${BASE}#required`);
  });

  test("role field is captured", () => {
    const [e] = edges(`<<~ pono ? -> lar:///ha.ka.ba/api/v0.1/pono/invariant role:must-hold >>`);
    expect(e!.role).toBe("must-hold");
    expect(e!.family).toBe("constraint");
  });

  test("produces no edge when pattern does not match", () => {
    const result = edges(`<<~ loulou lar:///something >>`);
    expect(result[0]!.family).toBe("relation");
  });
});

describe("lele — message family edge sugar", () => {
  test("single URI target produces family:message edge", () => {
    const [e] = edges(`<<~ lele lar:///ha.ka.ba/api/v0.1/lararium/signal >>`);
    expect(e).toBeDefined();
    expect(e!.family).toBe("message");
    expect(e!.toUri).toBe("lar:///ha.ka.ba/api/v0.1/lararium/signal");
    expect(e!.fromUri).toBe(BASE);
    expect(e!.role).toBeNull();
  });

  test("fromSocket resolves to innermost ahu when open", () => {
    const body = `
<<~ ahu #dispatch >>
<<~ lele lar:///ha.ka.ba/api/v0.1/lararium/signal >>
<<~/ahu >>
    `;
    const [e] = edges(body);
    expect(e!.family).toBe("message");
    expect(e!.fromSocket).toBe(`${BASE}#dispatch`);
  });

  test("multiple lele edges in one carrier", () => {
    const body = `
<<~ lele lar:///ha.ka.ba/api/v0.1/lararium/signal-a >>
<<~ lele lar:///ha.ka.ba/api/v0.1/lararium/signal-b >>
    `;
    const result = edges(body);
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.family === "message")).toBe(true);
  });
});

describe("pono and lele family validation", () => {
  test("pono edges pass validatePranaEdge (constraint family known)", () => {
    const [e] = edges(`<<~ pono ? -> lar:///something >>`);
    const violations = validatePranaEdge(e!);
    expect(violations.filter((v) => v.severity === "error")).toHaveLength(0);
  });

  test("lele edges pass validatePranaEdge (message family known, role warning expected)", () => {
    const [e] = edges(`<<~ lele lar:///something >>`);
    const violations = validatePranaEdge(e!);
    // message has roleRecommended — expect one warning, zero errors
    expect(violations.filter((v) => v.severity === "error")).toHaveLength(0);
    expect(violations.filter((v) => v.severity === "warning")).toHaveLength(1);
  });
});
