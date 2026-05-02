/**
 * @deprecated web2-era — "carrier"-era parse bridge. Do NOT add new exports here.
 *
 * Principles worth keeping in the new model:
 *   - grammarRulesFromText: grammar discovery from TOML [[sigils]]/[[families]]
 *     array-of-tables inside a meme body — the FFZ principle that a meme's
 *     grammar rule IS a meme itself (self-describing corpus).
 *   - parsePranalaEdges: edge extraction from raw text as a composable operation
 *     separate from render. Lives in isomorphic core, not the VM.
 *   - validatePranaEdge and family vocabulary stay in @lararium/core (no change).
 *
 * Rebuild target:
 *   grammarRulesFromText  → @lararium/core/meme-grammar (reads TOML via parseMemeText)
 *   parsePranalaEdges     → @lararium/core/meme-ast (already: parseMemeEdges)
 *   Both MUST have self-describing anchor memes and ship as TW5 library modules.
 */

import { parseMemeCarrier, edgesFromAst } from "./parser.js";
import type { SigilNode, MemeAstNode } from "./ast.js";
import type { PranaEdge, GrammarRules, SigilRule, FamilyRule } from "@lararium/core";

export type { PranaEdge, GrammarRules, SigilRule, FamilyRule };

// ---------------------------------------------------------------------------
// grammarRulesFromText — parse a grammar carrier text → GrammarRules.
//
// Uses parseMemeCarrier (bootstrap / grammar-free) to extract toml SigilNodes,
// then reads [[sigils]] and [[families]] array-of-tables from their content.
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

function collectTomlNodes(nodes: MemeAstNode[]): SigilNode[] {
  const out: SigilNode[] = [];
  for (const n of nodes) {
    if (n.kind === "Sigil" && n.sigilName === "toml") out.push(n as SigilNode);
    if ("body" in n && Array.isArray(n.body)) out.push(...collectTomlNodes(n.body as MemeAstNode[]));
  }
  return out;
}

export function grammarRulesFromText(uri: string, text: string): GrammarRules | null {
  const ast = parseMemeCarrier(uri, text);
  const combined = collectTomlNodes(ast)
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
// parsePranalaEdges — public shim.
// Callers that already hold an AST should call edgesFromAst(ast, uri) directly.
// ---------------------------------------------------------------------------

export function parsePranalaEdges(carrierUri: string, text: string, grammar?: GrammarRules): PranaEdge[] {
  return edgesFromAst(parseMemeCarrier(carrierUri, text, grammar), carrierUri);
}
