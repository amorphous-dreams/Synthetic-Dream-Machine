/**
 * meme-grammar — derive GrammarRules from a grammar meme text.
 *
 * The grammar meme IS a meme: its text follows the memetic-wikitext carrier
 * protocol and is parsed by BOOTSTRAP_SCANS (Invariant 1 of grammar-invariants.ts).
 * GrammarRules are extracted from `[[sigils]]` and `[[families]]` TOML
 * array-of-tables inside toml-fenced blocks in the grammar meme body.
 *
 * This module lives in lararium-core (isomorphic) because:
 *   - lararium-node needs it to seed the engine doc at server start (Sprint 2)
 *   - lararium-tw5 needs it at VM boot to recover GrammarRules from the system tiddler
 *   - Neither should import from each other
 *
 * Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/meme-grammar
 */

import type { GrammarRules, SigilRule, FamilyRule } from "./ast.js";
import { parseMemeText } from "./meme-ast/index.js";
import type { MemeAstNode, SigilNode } from "./meme-ast/types.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse a TOML array-of-tables `[[tableName]]` from a combined TOML string.
 * Returns the entries as plain key→value record arrays.
 * Only handles simple scalar values (strings, booleans) — no nested tables.
 */
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

/** Collect all SigilNodes (kind==="Sigil", sigilName==="toml") from an AST recursively. */
function collectTomlNodes(nodes: readonly MemeAstNode[]): SigilNode[] {
  const out: SigilNode[] = [];
  for (const n of nodes) {
    if (n.kind === "Sigil" && (n as SigilNode).sigilName === "toml") {
      out.push(n as SigilNode);
    }
    // Recurse into body arrays (Ahu, Pranala sugar bodies, etc.)
    if ("body" in n && Array.isArray((n as { body?: unknown }).body)) {
      out.push(...collectTomlNodes((n as { body: readonly MemeAstNode[] }).body));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// grammarRulesFromText — public API
// ---------------------------------------------------------------------------

/**
 * Parse a grammar meme text into `GrammarRules`.
 *
 * Uses `parseMemeText()` with no pre-existing GrammarRules (bootstrap mode —
 * Invariant 1 of grammar-invariants.ts). Reads `[[sigils]]` and `[[families]]`
 * TOML array-of-tables from the combined content of all `toml` Sigil nodes.
 *
 * Returns `null` when the text yields no sigils or families (e.g. empty file,
 * grammar meme not yet seeded). Callers should fall back to `BOOTSTRAP_SCANS`
 * alone when `null` is returned.
 *
 * @param uri  - Canonical `lar:` URI of the grammar meme (for error context)
 * @param text - Raw memetic-wikitext body of the grammar meme
 */
export function grammarRulesFromText(uri: string, text: string): GrammarRules | null {
  const { nodes } = parseMemeText(uri, text /*, no grammar — bootstrap mode */);

  const combined = collectTomlNodes(nodes)
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

  const families: FamilyRule[] = parseArrayOfTables(combined, "families").map((r): FamilyRule => ({
    name:              r["name"] ?? "",
    dagRequired:       r["dag_required"]       === "true",
    roleRecommended:   r["role_recommended"]   === "true",
    confidenceBounded: r["confidence_bounded"] === "true",
  }));

  if (sigils.length === 0 && families.length === 0) return null;
  return { sigils, families };
}
