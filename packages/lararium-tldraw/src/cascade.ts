/**
 * TW5-style template cascade for meme frame templateProps.
 *
 * TW5 golden principle: `:cascade` filter run — priority-ordered list of tiddlers;
 * each carries a filter expression evaluated against the target tiddler's context;
 * first non-empty result wins and selects the template.
 *
 * Lararium equivalent: CascadeEntry carries a TW5 filter expression (or structural
 * predicate) evaluated per meme frame; first matching entry wins per zoom level;
 * override is merged into that frame's templateProps.
 *
 * Pipeline:
 *   TemplateCascade (authored)
 *     ↓ compileCascade(closure, filterEngine)   async — resolves filter exprs to URI sets
 *   CompiledCascade
 *     ↓ applyCascade(snapshot)                  sync — stamps overrides into frame templateProps
 *   LarTLSnapshot (with per-meme overrides)
 *     ↓ emitTldrawRecords()
 *   tldraw store (shapes carry overridden templateProps in meta)
 *
 * Both server (renderAllViews) and browser (applyFilterCascade in LarariumCanvas)
 * call compileCascade with the appropriate async filter engine injected.
 */

import type { ClosureEntry } from "@lararium/core";
import type { LarTLSnapshot, MemeTemplateProps, TemplatePropsByLevel } from "./records.js";

// ---------------------------------------------------------------------------
// Cascade entry — authored form
// ---------------------------------------------------------------------------

export interface MemeCascadePredicate {
  uri?:        string | RegExp;
  rating?:     string;
  register?:   string;
  implements?: string;
  /** Minimum confidence scalar (inclusive). */
  minConfidence?: number;
  /** Maximum confidence scalar (inclusive). */
  maxConfidence?: number;
}

export type MemeCascadeFrame = {
  readonly uri:        string;
  readonly rating:     string;
  readonly register:   string;
  readonly confidence: number;
  readonly manaoio:    number;
  readonly implements: readonly string[];
};

export interface CascadeEntry {
  /**
   * Structural match — used when `filter` is absent.
   * Predicate object (matched by field equality/pattern) OR arbitrary function.
   */
  match?: MemeCascadePredicate | ((frame: MemeCascadeFrame) => boolean);
  /**
   * wikitext-filter expression (lar:///grammars/wikitext-filter) — takes precedence
   * over `match` when present. Evaluated against the full meme closure; memes whose
   * URI appears in the result are matched by this cascade entry.
   *
   * Standard operators:
   *   "[field:rating[claim]]"                              — all claim-rated memes
   *   "[tag[lar:///ha.ka.ba/api/v0.1/pono/invariant]]"    — invariant memes
   *   "[prefix[lar:///ha.ka.ba/api/v0.1]]"                — memes in the API namespace
   *   "[all[memes]nsort[depth]limit[5]]"                  — shallowest 5 memes
   *
   * wikitext-filter extensions (translated before evaluation):
   *   "[toml:register[CS]]"                               — CS-confidence-register memes
   *   "[toml:register[SC]field:rating[meme]]"             — SC-register memes with meme rating
   *   "[toml:tagspace[grammar]]"                          — grammar-tagspace memes
   *
   * Future (edge graph pre-loading required):
   *   "[edge:family[control]role[implements]]"            — memes that implement an interface
   *   "[self[]]"                                          — current-context meme URI
   */
  filter?: string;
  /** Partial override merged into templateProps for matching memes. */
  override: Partial<MemeTemplateProps>;
  /** Restrict override to specific zoom levels (default: all five). */
  levels?: ReadonlyArray<keyof TemplatePropsByLevel>;
}

/** Priority-ordered list — first matching entry wins per zoom level. TW5 cascade semantics. */
export type TemplateCascade = readonly CascadeEntry[];

// ---------------------------------------------------------------------------
// Filter engine injection — isomorphic contract
// ---------------------------------------------------------------------------

/**
 * Async filter engine — injectable so this module stays environment-agnostic.
 *
 * Dialect: wikitext-filter (lar:///grammars/wikitext-filter).
 * x-tiddlywiki-filter remains available as a compatibility helper for TW5 content import.
 *
 * Node:    inject filterMemesWikitext from "@lararium/core/tw-filter"
 * Browser: inject filterMemesWikitext from "@lararium/core/tw-filter" (Vite alias → browser bundle)
 *
 * Both satisfy this type; both are async.
 */
export type FilterEngineFn = (
  expr:    string,
  closure: readonly ClosureEntry[],
) => Promise<ClosureEntry[]>;

// ---------------------------------------------------------------------------
// Compiled cascade — pre-resolved URI sets for sync apply pass
// ---------------------------------------------------------------------------

export interface CompiledCascadeEntry {
  /** Pre-resolved URI set for filter-based entries; null = use match fn/predicate at runtime. */
  readonly matchingUris: ReadonlySet<string> | null;
  readonly entry:        CascadeEntry;
}

export type CompiledCascade = readonly CompiledCascadeEntry[];

// ---------------------------------------------------------------------------
// compileCascade — async, injectable filter engine
// ---------------------------------------------------------------------------

/**
 * Resolve all `filter` expressions in a TemplateCascade to URI sets.
 * `match`-only entries pass through with `matchingUris: null`.
 *
 * Call once per renderAllViews / applyFilterCascade invocation.
 * Parallelises filter evaluations across entries via Promise.all.
 */
export async function compileCascade(
  cascade:      TemplateCascade,
  closure:      readonly ClosureEntry[],
  filterEngine: FilterEngineFn,
): Promise<CompiledCascade> {
  return Promise.all(cascade.map(async (entry) => {
    if (!entry.filter) {
      return { matchingUris: null, entry };
    }
    const matched = await filterEngine(entry.filter, closure);
    return {
      matchingUris: new Set(matched.map((e) => e.uri)),
      entry,
    };
  }));
}

// ---------------------------------------------------------------------------
// applyCascade — sync, consumes pre-compiled cascade
// ---------------------------------------------------------------------------

const ALL_LEVELS: ReadonlyArray<keyof TemplatePropsByLevel> = [
  "strategic", "operational", "tactical", "combat", "action",
];

function matchesEntry(compiled: CompiledCascadeEntry, frame: MemeCascadeFrame): boolean {
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
  if (rating   !== undefined && frame.rating   !== rating)   return false;
  if (register !== undefined && frame.register !== register) return false;
  if (impl     !== undefined && !frame.implements.includes(impl)) return false;
  if (minConfidence !== undefined && frame.confidence < minConfidence) return false;
  if (maxConfidence !== undefined && frame.confidence > maxConfidence) return false;
  return true;
}

/**
 * Apply a compiled cascade to a snapshot — stamps per-meme templateProps overrides.
 * Sync; call after compileCascade resolves.
 */
export function applyCascade(snapshot: LarTLSnapshot, compiled: CompiledCascade): LarTLSnapshot {
  if (compiled.length === 0) return snapshot;

  const frames = snapshot.frames.map((frame) => {
    if (!frame.templateProps) return frame;
    const subject: MemeCascadeFrame = {
      uri:        frame.uri,
      rating:     frame.rating,
      register:   frame.register,
      confidence: frame.confidence,
      manaoio:    frame.manaoio,
      implements: frame.implements,
    };
    const overridden = { ...frame.templateProps } as Record<string, MemeTemplateProps>;
    for (const level of (frame.templateProps ? ALL_LEVELS : [])) {
      for (const compiled_entry of compiled) {
        if (compiled_entry.entry.levels && !compiled_entry.entry.levels.includes(level)) continue;
        if (matchesEntry(compiled_entry, subject)) {
          overridden[level] = { ...frame.templateProps[level], ...compiled_entry.entry.override };
          break; // first match wins — TW5 cascade semantics
        }
      }
    }
    return { ...frame, templateProps: overridden as TemplatePropsByLevel };
  });

  return Object.freeze({ ...snapshot, frames: Object.freeze(frames) });
}
