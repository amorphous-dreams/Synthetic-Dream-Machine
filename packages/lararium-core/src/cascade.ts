/**
 * wikitext-filter cascade engine — core primitive (lar:///grammars/wikitext-filter).
 *
 * Cascade semantics mirror TW5's :cascade filter run:
 *   priority-ordered list; first matching entry per target wins.
 *
 * Generic over the override shape (TOverride) so render-target adapters
 * (tldraw, React, future) can specialise without pulling tldraw types into core.
 *
 * Pipeline:
 *   TemplateCascade<TOverride>  (authored — filter expressions + match predicates)
 *     ↓ compileCascade(cascade, closure, filterEngine, edges?)   async
 *   CompiledCascade<TOverride>  (pre-resolved URI sets)
 *     ↓ applyCascade(…)         sync — render-target adapter responsibility
 *   target-specific output (LarTLSnapshot in tldraw, ReactNode tree in React, …)
 *
 * Both server (renderAllViews) and browser (applyFilterCascade in LarariumCanvas)
 * compile cascades with the appropriate async FilterEngineFn injected.
 * The FilterEngineFn receives the full closure + optional pranala edges
 * so edge: operator queries resolve correctly.
 */

import type { ClosureEntry, EdgeRecord } from "./compiler.js";
import type { FilterEngineFn } from "./tiddler-store.js";

// Re-export so callers get both types from one subpath.
export type { FilterEngineFn } from "./tiddler-store.js";
export type { EdgeRecord } from "./compiler.js";

// ---------------------------------------------------------------------------
// MemeCascadeFrame — epistemic view of a ClosureEntry for match predicates
// ---------------------------------------------------------------------------

export type MemeCascadeFrame = {
  readonly uri:        string;
  readonly rating:     string;
  readonly register:   string;
  readonly confidence: number;
  readonly manaoio:    number;
  readonly implements: readonly string[];
};

// ---------------------------------------------------------------------------
// MemeCascadePredicate — structural match (no filter engine required)
// ---------------------------------------------------------------------------

export interface MemeCascadePredicate {
  /** URI prefix (string) or regex test against full URI. */
  uri?:          string | RegExp;
  rating?:       string;
  register?:     string;
  /** Require this URI to appear in implements[]. */
  implements?:   string;
  minConfidence?: number;
  maxConfidence?: number;
}

// ---------------------------------------------------------------------------
// CascadeEntry — authored form, generic over override shape
// ---------------------------------------------------------------------------

/**
 * One priority-ordered entry in a cascade.
 *
 * Evaluation order: `filter` takes precedence over `match`.
 *   - `filter` present → evaluate as wikitext-filter expression against full closure;
 *     result is a URI set. O(1) lookup at apply time.
 *   - `match` present, `filter` absent → evaluate predicate per frame at apply time.
 *   - Both absent → never matches.
 *
 * TOverride is the shape of the override object.
 * For tldraw: Partial<MemeTemplateProps>.
 * For React: Partial<KumuRenderProps> (future).
 * For generic use: Record<string, unknown>.
 */
export interface CascadeEntry<TOverride = Record<string, unknown>> {
  /**
   * wikitext-filter expression (lar:///grammars/wikitext-filter).
   * Evaluated against full closure + edges. Takes precedence over match.
   *
   * @example "[all[memes]toml:register[CS]]"
   * @example "[all[memes]edge:control[implements]]"
   * @example "[tag[lar:///ha.ka.ba/api/v0.1/pono/invariant]]"
   */
  filter?: string;
  /**
   * Structural predicate (no filter engine required).
   * Evaluated per frame at apply time when filter is absent.
   */
  match?: MemeCascadePredicate | ((frame: MemeCascadeFrame) => boolean);
  /**
   * Override merged into the matching target's props on first match.
   * Render-target adapters specialise TOverride for their own shape.
   */
  override: Partial<TOverride>;
}

/** Priority-ordered list — first matching entry per target wins. TW5 cascade semantics. */
export type TemplateCascade<TOverride = Record<string, unknown>> =
  readonly CascadeEntry<TOverride>[];

// ---------------------------------------------------------------------------
// CompiledCascade — pre-resolved for O(1) apply pass
// ---------------------------------------------------------------------------

export interface CompiledCascadeEntry<TOverride = Record<string, unknown>> {
  /**
   * Pre-resolved URI set for filter-based entries.
   * null means use match fn/predicate at apply time (no filter was present).
   */
  readonly matchingUris: ReadonlySet<string> | null;
  readonly entry:        CascadeEntry<TOverride>;
}

export type CompiledCascade<TOverride = Record<string, unknown>> =
  readonly CompiledCascadeEntry<TOverride>[];

// ---------------------------------------------------------------------------
// compileCascade — async, parallelised, injectable engine
// ---------------------------------------------------------------------------

/**
 * Resolve all filter expressions in a TemplateCascade to URI sets.
 * match-only entries pass through with matchingUris: null.
 *
 * Parallelises filter evaluations via Promise.all.
 * Call once per render pass (renderAllViews / applyFilterCascade).
 *
 * @param cascade      Authored cascade (TemplateCascade)
 * @param closure      Full ClosureEntry array from BootArtifact
 * @param filterEngine Injected async wikitext-filter engine
 * @param edges        Optional pranala edges — enables edge: operator in filter exprs
 */
export async function compileCascade<TOverride = Record<string, unknown>>(
  cascade:      TemplateCascade<TOverride>,
  closure:      readonly ClosureEntry[],
  filterEngine: FilterEngineFn,
  edges?:       readonly EdgeRecord[],
): Promise<CompiledCascade<TOverride>> {
  return Promise.all(cascade.map(async (entry) => {
    if (!entry.filter) {
      return { matchingUris: null, entry };
    }
    const matched = await filterEngine(entry.filter, closure, edges);
    return {
      matchingUris: new Set(matched.map((e) => e.uri)),
      entry,
    };
  }));
}

// ---------------------------------------------------------------------------
// matchesEntry — exported helper for render-target apply passes
//
// Render-target adapters (tldraw applyCascade, future React applyCascade)
// call this per frame per compiled entry — no duplication of match logic.
// ---------------------------------------------------------------------------

export function matchesEntry<TOverride>(
  compiled: CompiledCascadeEntry<TOverride>,
  frame:    MemeCascadeFrame,
): boolean {
  const { matchingUris, entry } = compiled;
  if (matchingUris !== null) return matchingUris.has(frame.uri);
  const { match } = entry;
  if (!match) return false;
  if (typeof match === "function") return match(frame);
  const { uri, rating, register, implements: impl, minConfidence, maxConfidence } = match;
  if (uri !== undefined) {
    if (typeof uri === "string" && !frame.uri.startsWith(uri)) return false;
    if (uri instanceof RegExp && !uri.test(frame.uri)) return false;
  }
  if (rating    !== undefined && frame.rating    !== rating)   return false;
  if (register  !== undefined && frame.register  !== register) return false;
  if (impl      !== undefined && !frame.implements.includes(impl)) return false;
  if (minConfidence !== undefined && frame.confidence < minConfidence) return false;
  if (maxConfidence !== undefined && frame.confidence > maxConfidence) return false;
  return true;
}
