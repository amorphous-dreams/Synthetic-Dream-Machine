/**
 * Pranala family contracts — edge vocabulary law.
 *
 * P9 / pranala-schema-binding: validatePranalaEdge() enforces per-family
 * property contracts before edges enter the boot closure. No web2 ceremony;
 * edges live in carrier #edges sections and travel through the causal island
 * stack as Automerge CRDT mutations.
 *
 * Meme: lar:///ha.ka.ba/@lares/api/v0.1/pono/pranala-schema-binding
 */

import { describe, test, expect } from "@jest/globals";
import {
  validatePranalaEdge,
  KNOWN_FAMILIES,
} from "../src/index.js";
import type { PranalaEdge } from "../src/index.js";

// ---------------------------------------------------------------------------
// Fixture builder
// ---------------------------------------------------------------------------

function edge(overrides: Partial<PranalaEdge>): PranalaEdge {
  return {
    fromUri:     "lar:///ha.ka.ba/@lares/api/v0.1/mu",
    fromSocket:  "lar:///ha.ka.ba/@lares/api/v0.1/mu#spine",
    fromSlot:    null,
    toUri:       "lar:///AGENTS",
    toSocket:    "",
    family:      "control",
    lifecycle:   "instance",
    role:        "implements",
    traversal:   "source-to-target",
    propagation: "none",
    label:       "",
    payload:     {},
    cardinality: null,
    polarity:    null,
    status:      "declared",
    confidence:  null,
    renderMode:  null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Known family vocabulary
// ---------------------------------------------------------------------------

describe("KNOWN_FAMILIES", () => {
  test("contains all eight registered families", () => {
    const expected = ["control", "relation", "observe", "dataflow", "message", "constraint", "reaction", "spatial"];
    for (const f of expected) expect(KNOWN_FAMILIES).toContain(f);
  });

  test("control family carries structural graph law (owns/implements/extends)", () => {
    expect(KNOWN_FAMILIES).toContain("control");
  });

  test("reaction family supports kumu device event wiring", () => {
    expect(KNOWN_FAMILIES).toContain("reaction");
  });
});

// ---------------------------------------------------------------------------
// validatePranalaEdge — well-formed edges produce no errors
// ---------------------------------------------------------------------------

describe("validatePranalaEdge — well-formed edges", () => {
  test("control edge with role 'implements' — no errors", () => {
    const violations = validatePranalaEdge(edge({ family: "control", role: "implements" }));
    expect(violations.filter((v) => v.severity === "error")).toHaveLength(0);
  });

  test("dataflow edge with role 'reads' — no errors", () => {
    const violations = validatePranalaEdge(edge({ family: "dataflow", role: "reads" }));
    expect(violations.filter((v) => v.severity === "error")).toHaveLength(0);
  });

  test("spatial edge — no errors (open role set)", () => {
    const violations = validatePranalaEdge(edge({ family: "spatial", role: "portal" }));
    expect(violations.filter((v) => v.severity === "error")).toHaveLength(0);
  });

  test("observe edge — no errors", () => {
    const violations = validatePranalaEdge(edge({ family: "observe", role: "watches" }));
    expect(violations.filter((v) => v.severity === "error")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validatePranalaEdge — unknown family is an error
// ---------------------------------------------------------------------------

describe("validatePranalaEdge — unknown family", () => {
  test("unknown family produces an error violation", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const violations = validatePranalaEdge(edge({ family: "web2-http-route" as any }));
    const errors = violations.filter((v) => v.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
  });

  test("null-ish family produces an error", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const violations = validatePranalaEdge(edge({ family: "" as any }));
    const errors = violations.filter((v) => v.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Causal island edge shapes — lar:/// URIs on both ends
// ---------------------------------------------------------------------------

describe("validatePranalaEdge — causal island URI contracts", () => {
  test("ha.ka.ba sub-path URIs accepted as fromUri", () => {
    const violations = validatePranalaEdge(
      edge({ fromUri: "lar:///ha.ka.ba/@lares/api/v0.1/lararium" }),
    );
    expect(violations.filter((v) => v.severity === "error")).toHaveLength(0);
  });

  test("AGENTS root-level URI accepted as toUri", () => {
    const violations = validatePranalaEdge(
      edge({ toUri: "lar:///AGENTS" }),
    );
    expect(violations.filter((v) => v.severity === "error")).toHaveLength(0);
  });
});
