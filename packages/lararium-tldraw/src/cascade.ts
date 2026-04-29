/**
 * tldraw cascade adapter — extends @lararium/core/cascade for tldraw render targets.
 *
 * Core cascade (lar:///grammars/wikitext-filter):
 *   CascadeEntry<TOverride>, TemplateCascade<TOverride>, compileCascade, matchesEntry
 *   all live in @lararium/core/cascade — generic, no tldraw coupling.
 *
 * This file adds:
 *   CascadeEntry      — tldraw-specialised (override: Partial<MemeTemplateProps>, levels?)
 *   TemplateCascade   — tldraw alias
 *   applyCascade()    — stamps per-meme templateProps overrides into LarTLSnapshot
 *
 * Re-exports everything from core so downstream callers only import from @lararium/tldraw.
 */

import {
  matchesEntry,
  type CascadeEntry as CoreCascadeEntry,
  type CompiledCascade,
  type CompiledCascadeEntry,
  type MemeCascadeFrame,
  type MemeCascadePredicate,
} from "@lararium/core/cascade";

export {
  compileCascade,
  matchesEntry,
  type CompiledCascade,
  type CompiledCascadeEntry,
  type MemeCascadeFrame,
  type MemeCascadePredicate,
} from "@lararium/core/cascade";

export type { FilterEngineFn } from "@lararium/core/cascade"; // canonical: @lararium/core/tw5
export type { EdgeRecord }     from "@lararium/core/cascade";

import type { LarTLSnapshot, MemeTemplateProps, TemplatePropsByLevel } from "./records.js";

// ---------------------------------------------------------------------------
// tldraw-specialised CascadeEntry
//
// Extends the core generic type with:
//   override  →  Partial<MemeTemplateProps>  (tldraw frame template props)
//   levels    →  zoom levels to restrict the override to (default: all five)
// ---------------------------------------------------------------------------

export interface CascadeEntry extends CoreCascadeEntry<MemeTemplateProps> {
  /**
   * Restrict override to specific zoom levels (default: all five).
   * Useful for level-only cascade entries: e.g. hide at strategic but show at action.
   */
  levels?: ReadonlyArray<keyof TemplatePropsByLevel>;
}

/** Priority-ordered tldraw cascade — tldraw-specialised. */
export type TemplateCascade = readonly CascadeEntry[];

// ---------------------------------------------------------------------------
// applyCascade — tldraw-specific apply pass
//
// Stamps per-meme templateProps overrides into a LarTLSnapshot.
// Sync — call after compileCascade resolves.
// First match wins per zoom level (TW5 cascade semantics).
// ---------------------------------------------------------------------------

const ALL_LEVELS: ReadonlyArray<keyof TemplatePropsByLevel> = [
  "strategic", "operational", "tactical", "combat", "action",
];

/**
 * Apply a compiled cascade to a LarTLSnapshot.
 * Returns a new frozen snapshot with templateProps overrides stamped per meme.
 *
 * Sync; call after compileCascade resolves.
 */
export function applyCascade(
  snapshot: LarTLSnapshot,
  compiled: CompiledCascade<MemeTemplateProps>,
): LarTLSnapshot {
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

    for (const level of ALL_LEVELS) {
      for (const compiledEntry of compiled) {
        const entry = compiledEntry.entry as CascadeEntry;
        if (entry.levels && !entry.levels.includes(level)) continue;
        if (matchesEntry(compiledEntry, subject)) {
          overridden[level] = { ...frame.templateProps[level], ...compiledEntry.entry.override };
          break; // first match wins — TW5 cascade semantics
        }
      }
    }

    return { ...frame, templateProps: overridden as TemplatePropsByLevel };
  });

  return Object.freeze({ ...snapshot, frames: Object.freeze(frames) });
}
