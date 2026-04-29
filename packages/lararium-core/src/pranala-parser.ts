/**
 * Pranala parser — extract PranaEdge records from carrier text.
 *
 * parsePranalaEdges is now a thin shim over parseMemeCarrier + edgesFromAst.
 * Types (PranaEdge, GrammarRules, SigilRule, FamilyRule) live in ast.ts to
 * break the former circular dependency with parser.ts.
 *
 * The lower-level helpers (validatePranaEdge, resolveRegexes, fieldsFromToml,
 * makeEdge, URI helpers) are kept here for use by parser.ts and compiler.ts.
 */

import { parseMemeCarrier, edgesFromAst } from "./parser.js";
import type {
  PranaEdge,
  PranaEdgeViolation,
  PranaViolationSeverity,
  GrammarRules,
  SigilRule,
  FamilyRule,
} from "./ast.js";

// Re-export types so downstream code importing from pranala-parser still works
export type { PranaEdge, PranaEdgeViolation, PranaViolationSeverity, GrammarRules, SigilRule, FamilyRule };

// ---------------------------------------------------------------------------
// Family contracts
// ---------------------------------------------------------------------------

interface FamilyContract {
  knownFamilies: readonly string[];
  roleRecommended: boolean;
  confidenceBounded: boolean;
}

export const KNOWN_FAMILIES = ["control", "relation", "observe", "dataflow", "message", "constraint", "reaction", "spatial"] as const;
export type PranalaFamily = typeof KNOWN_FAMILIES[number];

/**
 * Canonical role vocabularies per family.
 * roleRecommended families should use these roles; others accept free-form.
 * spatial roles unblock portals-as-graph-edges and multi-level room navigation.
 */
export const FAMILY_ROLES: Partial<Record<PranalaFamily, readonly string[]>> = {
  control:    ["owns", "implements", "extends", "configures", "delegates"],
  dataflow:   ["reads", "writes", "streams", "buffers", "pipes"],
  message:    ["sends", "receives", "publishes", "subscribes", "replies"],
  reaction:   ["triggers", "handles", "observes", "throttles", "debounces", "subscription"],
  spatial:    ["contains", "portal", "adjacent", "layer"],
};

export const FAMILY_CONTRACTS: Record<string, Omit<FamilyContract, "knownFamilies">> = {
  control:    { roleRecommended: true,  confidenceBounded: false },
  relation:   { roleRecommended: false, confidenceBounded: false },
  observe:    { roleRecommended: false, confidenceBounded: true  },
  dataflow:   { roleRecommended: true,  confidenceBounded: false },
  message:    { roleRecommended: true,  confidenceBounded: false },
  constraint: { roleRecommended: false, confidenceBounded: false },
  reaction:   { roleRecommended: true,  confidenceBounded: false },
  spatial:    { roleRecommended: true,  confidenceBounded: false },
};

export function validatePranaEdge(edge: PranaEdge, grammar?: GrammarRules): PranaEdgeViolation[] {
  const violations: PranaEdgeViolation[] = [];
  const base = { fromUri: edge.fromUri, toUri: edge.toUri, family: edge.family };
  const contracts = resolveFamilyContracts(grammar);
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
// Built-in regex constants (bootstrap safety net; grammar rules override)
// ---------------------------------------------------------------------------

const BUILTIN_AHU_OPEN    = /<<~[^>]*\bahu\s+(#[\w-]+)\s*>>/g;
const BUILTIN_AHU_CLOSE   = /<<~\/ahu\s*>>/g;
const BUILTIN_BLOCK_RE    = /<<~\s*pranala\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)\s*>>([\s\S]*?)<<~\/pranala\s*>>/gs;
const BUILTIN_INLINE_RE   = /<<~\s*pranala\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+family:([\w-]+))?(?:\s+role:([\w-]+))?\s*>>/g;
const BUILTIN_LOULOU_RE   = /<<~\s*loulou\s+(\S+)\s*>>/g;
const BUILTIN_AKA_RE      = /<<~\s*aka\s+(\S+)\s*>>/g;
const BUILTIN_KAHEA_RE    = /<<~\s*kahea\s+(\S+)\s*>>/g;
const BUILTIN_PONO_RE     = /<<~\s*pono\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+role:([\w-]+))?\s*>>/g;
const BUILTIN_LELE_RE     = /<<~\s*lele\s+(\S+)\s*>>/g;
// papalohe: full UEFN wire — groups [full, #slot?, FROM, TO, trigger?, fn?]
const BUILTIN_PAPALOHE_RE = /<<~\s*papalohe\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+trigger:([\w.-]+))?(?:\s+fn:([\w.-]+))?\s*>>/g;
const TOML_FENCE_RE = /```toml\s*([\s\S]*?)```/;

// ---------------------------------------------------------------------------
// Grammar-aware regex resolution
// ---------------------------------------------------------------------------

interface ActiveRegexes {
  ahuOpen:  RegExp;
  ahuClose: RegExp;
  block:    RegExp;
  inline:   RegExp;
  loulou:   RegExp;
  aka:      RegExp;
  kahea:    RegExp;
  pono:     RegExp;
  lele:     RegExp;
  papalohe: RegExp;
  loulouDefaultFamily:     string;
  akaDefaultFamily:        string;
  kaheaDefaultFamily:      string;
  kaheaDefaultPropagation: string;
  ponoDefaultFamily:       string;
  leleDefaultFamily:       string;
  papaloheDefaultFamily:   string;
}

function sigilPattern(grammar: GrammarRules, name: string, key: keyof SigilRule): string | undefined {
  return grammar.sigils.find((s) => s.name === name)?.[key] as string | undefined;
}

export function resolveRegexes(grammar?: GrammarRules): ActiveRegexes {
  if (!grammar) {
    return {
      ahuOpen:  BUILTIN_AHU_OPEN,
      ahuClose: BUILTIN_AHU_CLOSE,
      block:    BUILTIN_BLOCK_RE,
      inline:   BUILTIN_INLINE_RE,
      loulou:   BUILTIN_LOULOU_RE,
      aka:      BUILTIN_AKA_RE,
      kahea:    BUILTIN_KAHEA_RE,
      pono:     BUILTIN_PONO_RE,
      lele:     BUILTIN_LELE_RE,
      papalohe: BUILTIN_PAPALOHE_RE,
      loulouDefaultFamily:      "relation",
      akaDefaultFamily:         "observe",
      kaheaDefaultFamily:       "dataflow",
      kaheaDefaultPropagation:  "push-forward",
      ponoDefaultFamily:        "constraint",
      leleDefaultFamily:        "message",
      papaloheDefaultFamily:    "reaction",
    };
  }

  const safe = (src: string | undefined, fallback: RegExp, flags: string): RegExp => {
    if (!src) return new RegExp(fallback.source, flags);
    try { return new RegExp(src, flags); }
    catch { return new RegExp(fallback.source, flags); }
  };

  return {
    ahuOpen:  safe(sigilPattern(grammar, "ahu", "openPattern"),  BUILTIN_AHU_OPEN,  "g"),
    ahuClose: safe(sigilPattern(grammar, "ahu", "closePattern"), BUILTIN_AHU_CLOSE, "g"),
    block:    safe(sigilPattern(grammar, "pranala", "blockPattern"),  BUILTIN_BLOCK_RE,  "gds"),
    inline:   safe(sigilPattern(grammar, "pranala", "inlinePattern"), BUILTIN_INLINE_RE, "g"),
    loulou:   safe(sigilPattern(grammar, "loulou", "pattern"), BUILTIN_LOULOU_RE, "g"),
    aka:      safe(sigilPattern(grammar, "aka",    "pattern"), BUILTIN_AKA_RE,    "g"),
    kahea:    safe(sigilPattern(grammar, "kahea",  "pattern"), BUILTIN_KAHEA_RE,  "g"),
    pono:     safe(sigilPattern(grammar, "pono",   "pattern"), BUILTIN_PONO_RE,   "g"),
    lele:     safe(sigilPattern(grammar, "lele",   "pattern"), BUILTIN_LELE_RE,   "g"),
    papalohe: safe(sigilPattern(grammar, "papalohe", "pattern"), BUILTIN_PAPALOHE_RE, "g"),
    loulouDefaultFamily:      sigilPattern(grammar, "loulou",   "defaultFamily")      ?? "relation",
    akaDefaultFamily:         sigilPattern(grammar, "aka",      "defaultFamily")      ?? "observe",
    kaheaDefaultFamily:       sigilPattern(grammar, "kahea",    "defaultFamily")      ?? "dataflow",
    kaheaDefaultPropagation:  sigilPattern(grammar, "kahea",    "defaultPropagation") ?? "push-forward",
    ponoDefaultFamily:        sigilPattern(grammar, "pono",     "defaultFamily")      ?? "constraint",
    leleDefaultFamily:        sigilPattern(grammar, "lele",     "defaultFamily")      ?? "message",
    papaloheDefaultFamily:    sigilPattern(grammar, "papalohe", "defaultFamily")      ?? "reaction",
  };
}

function resolveFamilyContracts(grammar?: GrammarRules): typeof FAMILY_CONTRACTS {
  if (!grammar || grammar.families.length === 0) return FAMILY_CONTRACTS;
  const out: typeof FAMILY_CONTRACTS = {};
  for (const f of grammar.families) {
    out[f.name] = { roleRecommended: f.roleRecommended, confidenceBounded: f.confidenceBounded };
  }
  for (const [k, v] of Object.entries(FAMILY_CONTRACTS)) {
    if (!out[k]) out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// URI helpers (used by parser.ts via internal import)
// ---------------------------------------------------------------------------

export function resolveTo(raw: string, carrierUri: string): [string, string] {
  if (raw.startsWith("#")) return [carrierUri, carrierUri + raw];
  if (raw.startsWith("lar:///") && raw.includes("#")) {
    const idx = raw.indexOf("#");
    const uri = raw.slice(0, idx);
    return [uri, uri + "#" + raw.slice(idx + 1)];
  }
  if (raw.startsWith("lar:///")) return [raw, ""];
  const parts = carrierUri.split("/");
  let apiIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "api" || parts[i] === "docs" || parts[i] === "library") { apiIdx = i; break; }
  }
  const root = apiIdx >= 0
    ? parts.slice(0, apiIdx + 2).join("/") + "/"
    : carrierUri.slice(0, carrierUri.lastIndexOf("/") + 1);
  return [root + raw, ""];
}

export function resolveFrom(token: string, carrierUri: string, ahuStack: string[]): [string, string] {
  if (token === "?") {
    const socket = ahuStack.length > 0 ? (ahuStack[ahuStack.length - 1] as string) : carrierUri;
    return [carrierUri, socket];
  }
  if (token.startsWith("#")) return [carrierUri, carrierUri + token];
  if (token.startsWith("lar:///") && token.includes("#")) {
    const idx = token.indexOf("#");
    const uri = token.slice(0, idx);
    return [uri, uri + "#" + token.slice(idx + 1)];
  }
  if (token.startsWith("lar:///")) return [token, token];
  return [carrierUri, carrierUri];
}

// ---------------------------------------------------------------------------
// Minimal TOML field extraction
// ---------------------------------------------------------------------------

export function fieldsFromToml(tomlText: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const payload: Record<string, unknown> = {};
  const known = new Set([
    "family","lifecycle","role","label","cardinality","polarity",
    "status","confidence","render-mode","traversal","propagation",
    "dir","payload","from","to","when",
  ]);

  for (const line of tomlText.split("\n")) {
    const m = line.match(/^\s*([\w-]+)\s*=\s*"([^"]*)"\s*$/) ??
              line.match(/^\s*([\w-]+)\s*=\s*(\S+)\s*$/);
    if (!m) continue;
    const [, key, val] = m as [string, string, string];
    const parsed: unknown =
      val === "true" ? true : val === "false" ? false : /^\d+(\.\d+)?$/.test(val) ? Number(val) : val;
    if (known.has(key)) out[key] = parsed;
    else payload[key] = parsed;
  }

  const lifecycle  = (out["lifecycle"]  as string | undefined) ?? "instance";
  const role       = (out["role"]       as string | undefined) ?? null;
  const label      = (out["label"]      as string | undefined) ?? "";
  const cardinality = (out["cardinality"] as string | undefined) ?? null;
  const polarity   = (out["polarity"]   as string | undefined) ?? null;
  const status     = (out["status"]     as string | undefined) ?? "declared";
  const confidence = (out["confidence"] as number | undefined) ?? null;
  const renderMode = (out["render-mode"] as string | undefined) ?? null;

  const dirVal = out["dir"] as string | undefined;
  let traversal = (out["traversal"] as string | undefined) ?? "source-to-target";
  if (dirVal === "both") { traversal = "source-to-target"; payload["dir_hint"] = "both"; }
  else if (dirVal === "back") traversal = "target-to-source";
  else if (dirVal === "forward") traversal = "source-to-target";

  const propagation = (out["propagation"] as string | undefined) ?? "none";

  return { lifecycle, role, label, cardinality, polarity, status, confidence, renderMode, traversal, propagation, payload };
}

// ---------------------------------------------------------------------------
// makeEdge — shared edge record constructor
// ---------------------------------------------------------------------------

export function makeEdge(
  fromUri: string,
  fromSocket: string,
  fromSlot: string | null,
  toUri: string,
  toSocket: string,
  family: string,
  fields: Record<string, unknown>,
): PranaEdge {
  return {
    fromUri,
    fromSocket,
    fromSlot,
    toUri,
    toSocket,
    family,
    lifecycle:   (fields["lifecycle"]   as string | undefined)      ?? "instance",
    role:        (fields["role"]        as string | null | undefined) ?? null,
    traversal:   (fields["traversal"]   as string | undefined)      ?? "source-to-target",
    propagation: (fields["propagation"] as string | undefined)      ?? "none",
    label:       (fields["label"]       as string | undefined)      ?? "",
    payload:     (fields["payload"]     as Record<string, unknown> | undefined) ?? {},
    cardinality: (fields["cardinality"] as string | null | undefined) ?? null,
    polarity:    (fields["polarity"]    as string | null | undefined) ?? null,
    status:      (fields["status"]      as string | undefined)      ?? "declared",
    confidence:  (fields["confidence"]  as number | null | undefined) ?? null,
    renderMode:  (fields["renderMode"]  as string | null | undefined) ?? null,
  };
}

// ---------------------------------------------------------------------------
// parsePranalaEdges — thin shim over parseMemeCarrier + edgesFromAst
//
// The old event-loop implementation is retired. Single parse path: tree first,
// edge projection second. Callers that already use parseMemeCarrier directly
// should prefer edgesFromAst(ast, uri) to avoid double-parsing.
// ---------------------------------------------------------------------------

export function parsePranalaEdges(carrierUri: string, text: string, grammar?: GrammarRules): PranaEdge[] {
  return edgesFromAst(parseMemeCarrier(carrierUri, text, grammar), carrierUri);
}

// TOML_FENCE_RE kept for compiler.ts (carrier metadata extraction)
export { TOML_FENCE_RE };
