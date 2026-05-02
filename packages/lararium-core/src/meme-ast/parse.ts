/**
 * meme-ast/parse.ts — parseMemeText(): top-level public entry point.
 *
 * Local-first, isomorphic: no fs/path/DOM imports.
 * Runs in Node, Deno, browser, and TW5-era JS environments.
 *
 * Three tiers of result:
 *   nodes  — MemeAstNode[] (full parse tree)
 *   edges  — PranalaEdge[]   (projected edge records for the meme graph)
 *   meme   — MemeNode      (rooted document with uri + body)
 *
 * In a live client, parsing MUST happen inside the TW5 VM so that the grammar
 * meme (sigil vocabulary) is available and the deserializer can split ahu slots.
 * This module enables the same parsing in Node, Deno, VS Code grammar plugins,
 * syntax highlighters, and other tooling without a TW5 runtime.
 *
 * Heleuma ka: sync-heleuma tracks this file.
 * Bundle entry: packages/lararium-tw5/src/meme-ast-entry.ts
 */

import type { GrammarRules } from "./types.js";
import type { MemeAstNode, MemeNode, PranalaEdge } from "./types.js";
import { collectEvents } from "./scanner.js";
import { buildMemeAst } from "./builder.js";
import { edgesFromMemeAst } from "./edges.js";

// ---------------------------------------------------------------------------
// ParseMemeResult — all three tiers in one call
// ---------------------------------------------------------------------------

export interface ParseMemeResult {
  /** Rooted document node: { kind: "Meme", uri, body }. */
  readonly meme:  MemeNode;
  /** Flat parse tree (same as meme.body, exposed for convenience). */
  readonly nodes: readonly MemeAstNode[];
  /** Projected edge records for the meme graph / TW5 edge-field codec. */
  readonly edges: readonly PranalaEdge[];
}

// ---------------------------------------------------------------------------
// parseMemeText — main public entry
// ---------------------------------------------------------------------------

export function parseMemeText(
  uri:      string,
  text:     string,
  grammar?: GrammarRules,
): ParseMemeResult {
  const events = collectEvents(text, grammar);
  const nodes  = buildMemeAst(events, uri, grammar, text);
  const edges  = edgesFromMemeAst(nodes, uri);
  const meme: MemeNode = { kind: "Meme", uri, body: nodes };
  return { meme, nodes, edges };
}

// ---------------------------------------------------------------------------
// parseMemeNodes — convenience: just the node array (no edge projection)
// ---------------------------------------------------------------------------

export function parseMemeNodes(
  uri:      string,
  text:     string,
  grammar?: GrammarRules,
): MemeAstNode[] {
  return buildMemeAst(collectEvents(text, grammar), uri, grammar, text);
}

// ---------------------------------------------------------------------------
// parseMemeEdges — convenience: just the edge projection
// ---------------------------------------------------------------------------

export function parseMemeEdges(
  uri:      string,
  text:     string,
  grammar?: GrammarRules,
): PranalaEdge[] {
  return edgesFromMemeAst(
    buildMemeAst(collectEvents(text, grammar), uri, grammar, text),
    uri,
  );
}
