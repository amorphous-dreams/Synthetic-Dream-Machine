/**
 * Pranala parser — edge validation and public API surface.
 *
 * Parse path: parsePranalaEdges → parseMemeCarrier (parser.ts) → edgesFromAst (parser.ts).
 * This file owns only: family/role vocabulary, validatePranaEdge, and the public shim.
 *
 * Types (PranaEdge, GrammarRules, SigilRule, FamilyRule) live in ast.ts.
 */

import { parseMemeCarrier, edgesFromAst } from "./parser.js";
import type {
  PranaEdge,
  PranaEdgeViolation,
  PranaViolationSeverity,
  GrammarRules,
  SigilRule,
  FamilyRule,
  SigilNode,
} from "./ast.js";

export type { PranaEdge, PranaEdgeViolation, PranaViolationSeverity, GrammarRules, SigilRule, FamilyRule };

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
// validatePranaEdge
// ---------------------------------------------------------------------------

export function validatePranaEdge(edge: PranaEdge, grammar?: GrammarRules): PranaEdgeViolation[] {
  const violations: PranaEdgeViolation[] = [];
  const base = { fromUri: edge.fromUri, toUri: edge.toUri, family: edge.family };

  // Merge grammar-defined families over built-ins
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

// ---------------------------------------------------------------------------
// grammarRulesFromText — parse a grammar carrier text → GrammarRules.
//
// Uses parseMemeCarrier (bootstrap / grammar-free) to extract toml SigilNodes,
// then reads [[sigils]] and [[families]] array-of-tables from their content.
// Shared by node-host (disk path) and MemeticParser (automerge/wiki path) so
// both derive grammar through the same parser they're configuring.
//
// Returns null when the text yields no sigils or families (e.g. empty carrier).
// ---------------------------------------------------------------------------

function parseArrayOfTables(src: string, tableName: string): Record<string, string>[] {
  const entries: Record<string, string>[] = [];
  const re = new RegExp(`\\[\\[${tableName}\\]\\]([\\s\\S]*?)(?=\\[\\[|$)`, "g");
  for (const m of src.matchAll(re)) {
    const entry: Record<string, string> = {};
    for (const line of (m[1] ?? "").split("\n")) {
      const kv = line.match(/^\s*([\w_]+)\s*=\s*(?:'([^']*)'|"([^"]*)"|(true|false)(?=[\s#]|$))/);
      if (kv) entry[kv[1]!] = kv[2] ?? kv[3] ?? kv[4] ?? "";
    }
    if (Object.keys(entry).length > 0) entries.push(entry);
  }
  return entries;
}

export function grammarRulesFromText(uri: string, text: string): GrammarRules | null {
  const ast = parseMemeCarrier(uri, text);
  const combined = ast
    .filter((n): n is SigilNode => n.kind === "Sigil" && n.sigilName === "toml")
    .map((n) => n.attrs["content"] ?? "")
    .join("\n");

  const sigils: SigilRule[] = parseArrayOfTables(combined, "sigils").map((r): SigilRule => ({
    name: r["name"] ?? "",
    kind: (r["kind"] ?? "edge") as SigilRule["kind"],
    ...(r["inline_pattern"]      !== undefined && { inlinePattern:      r["inline_pattern"] }),
    ...(r["block_pattern"]       !== undefined && { blockPattern:       r["block_pattern"] }),
    ...(r["open_pattern"]        !== undefined && { openPattern:        r["open_pattern"] }),
    ...(r["close_pattern"]       !== undefined && { closePattern:       r["close_pattern"] }),
    ...(r["pattern"]             !== undefined && { pattern:            r["pattern"] }),
    ...(r["default_family"]      !== undefined && { defaultFamily:      r["default_family"] }),
    ...(r["default_propagation"] !== undefined && { defaultPropagation: r["default_propagation"] }),
    ...(r["pragma_pattern"]      !== undefined && { pragmaPattern:      r["pragma_pattern"] }),
    ...(r["alias_for"]           !== undefined && { aliasFor:           r["alias_for"] }),
    ...(r["layer"] === "compile" || r["layer"] === "render" || r["layer"] === "both"
      ? { layer: r["layer"] as "compile" | "render" | "both" } : {}),
  }));

  const families: FamilyRule[] = parseArrayOfTables(combined, "families").map((r) => ({
    name:              r["name"] ?? "",
    dagRequired:       r["dag_required"]       === "true",
    roleRecommended:   r["role_recommended"]   === "true",
    confidenceBounded: r["confidence_bounded"] === "true",
  }));

  if (sigils.length === 0 && families.length === 0) return null;
  return { sigils, families };
}

// ---------------------------------------------------------------------------
// replaceCarrierSlot — surgical in-place replacement of one ahu slot's body.
//
// Pure function — no TW5 or Node dependencies. Usable in browser and server.
// Returns null when the slot is not found (caller should fall back to full
// reconstruction via serializeCarrier).
// ---------------------------------------------------------------------------

export function replaceCarrierSlot(
  carrierText: string,
  slot: string,       // e.g. "#ooda-ha"
  newBody: string,
): string | null {
  const escaped = slot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(<<~[^>]*\\bahu\\s+${escaped}\\s*>>)([\\s\\S]*?)(<<~\\/ahu\\s*>>)`,
    "g",
  );
  let matched = false;
  const result = carrierText.replace(pattern, (_full, open, _body, close) => {
    matched = true;
    return `${open}${newBody}${close}`;
  });
  return matched ? result : null;
}

// ---------------------------------------------------------------------------
// parsePranalaEdges — public shim; callers that hold an AST should use
// edgesFromAst(ast, uri) directly to avoid double-parsing.
// ---------------------------------------------------------------------------

export function parsePranalaEdges(carrierUri: string, text: string, grammar?: GrammarRules): PranaEdge[] {
  return edgesFromAst(parseMemeCarrier(carrierUri, text, grammar), carrierUri);
}
