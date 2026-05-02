// pranala-parser — edge vocabulary and validation.
//
// grammarRulesFromText and parsePranalaEdges live in @lararium/tw5 (they call
// parseMemeCarrier). Only the vocabulary constants and validatePranalaEdge stay
// here so compiler.ts and meme-graph.ts can use them without a circular dep.

import type {
  PranalaEdge,
  PranalaEdgeViolation,
  PranalaViolationSeverity,
  GrammarRules,
  SigilRule,
  FamilyRule,
} from "./ast.js";

export type { PranalaEdge, PranalaEdgeViolation as PranalaEdgeViolation, PranalaViolationSeverity as PranalaViolationSeverity, GrammarRules, SigilRule, FamilyRule };

// ---------------------------------------------------------------------------
// Family vocabulary
// ---------------------------------------------------------------------------

export const KNOWN_FAMILIES = ["control", "relation", "observe", "dataflow", "message", "constraint", "reaction", "spatial"] as const;
export type PranalaFamily = typeof KNOWN_FAMILIES[number];

export const FAMILY_ROLES: Partial<Record<PranalaFamily, readonly string[]>> = {
  control:    ["owns", "implements", "extends", "configures", "delegates", "governed-by"],
  dataflow:   ["reads", "writes", "streams", "buffers", "pipes"],
  message:    ["sends", "receives", "publishes", "subscribes", "replies"],
  constraint: ["must-hold", "invariant", "requires", "forbids", "guards", "bounds", "governs"],
  reaction:   ["triggers", "handles", "observes", "throttles", "debounces", "subscription"],
  spatial:    ["contains", "portal", "adjacent", "layer"],
};

interface FamilyContract { roleRecommended: boolean; confidenceBounded: boolean; }

export const FAMILY_CONTRACTS: Record<string, FamilyContract> = {
  control:    { roleRecommended: true,  confidenceBounded: false },
  relation:   { roleRecommended: false, confidenceBounded: false },
  observe:    { roleRecommended: false, confidenceBounded: true  },
  dataflow:   { roleRecommended: true,  confidenceBounded: false },
  message:    { roleRecommended: true,  confidenceBounded: false },
  constraint: { roleRecommended: false, confidenceBounded: false },
  reaction:   { roleRecommended: true,  confidenceBounded: false },
  spatial:    { roleRecommended: true,  confidenceBounded: false },
};

// ---------------------------------------------------------------------------
// validatePranalaEdge
// ---------------------------------------------------------------------------

export function validatePranalaEdge(edge: PranalaEdge, grammar?: GrammarRules): PranalaEdgeViolation[] {
  const violations: PranalaEdgeViolation[] = [];
  const base = { fromUri: edge.fromUri, toUri: edge.toUri, family: edge.family };

  const contracts: Record<string, FamilyContract> = { ...FAMILY_CONTRACTS };
  if (grammar?.families.length) {
    for (const f of grammar.families) {
      contracts[f.name] = { roleRecommended: f.roleRecommended, confidenceBounded: f.confidenceBounded };
    }
  }
  const knownFamilies = grammar
    ? grammar.families.map((f) => f.name)
    : (KNOWN_FAMILIES as readonly string[]);

  if (!knownFamilies.includes(edge.family)) {
    violations.push({ ...base, severity: "error", rule: "unknown-family",
      message: `family "${edge.family}" not in [${knownFamilies.join(", ")}]` });
    return violations;
  }

  const contract = contracts[edge.family]!;

  if (contract.roleRecommended && !edge.role) {
    violations.push({ ...base, severity: "warning", rule: "role-recommended",
      message: `${edge.family} edge missing role (from ${edge.fromUri} → ${edge.toUri})` });
  }

  const knownRoles = FAMILY_ROLES[edge.family as PranalaFamily];
  if (knownRoles && edge.role && !knownRoles.includes(edge.role)) {
    violations.push({ ...base, severity: "warning", rule: "unknown-role",
      message: `role "${edge.role}" not in ${edge.family} vocabulary [${knownRoles.join(", ")}]` });
  }

  if (contract.confidenceBounded && edge.confidence !== null) {
    if (typeof edge.confidence !== "number" || edge.confidence < 0 || edge.confidence > 1) {
      violations.push({ ...base, severity: "error", rule: "confidence-out-of-range",
        message: `confidence ${edge.confidence} outside [0, 1]` });
    }
  }

  return violations;
}
