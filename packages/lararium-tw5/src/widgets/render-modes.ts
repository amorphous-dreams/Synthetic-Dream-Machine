/**
 * render-modes — projection-mode dispatch for child-slot sigil widgets.
 *
 * Architecture note (post-rewrite):
 *   The `markdown-meme` and HTML render scopes for ahu now live entirely
 *   in TW5 templates + cascades (see widgets/ahu.ts and the tag
 *   `$:/tags/Lar/AhuTemplate`). This module retained only the
 *   `projection` mode for legacy callers (kau widget). When kau follows
 *   the same template-cascade rewrite, this module disappears.
 *
 * Projection mode (frozen read):
 *   Emit a `<<~ aka sigil slot >>` shadow reference instead of live
 *   transclusion. The aka form is stable across versions — used in
 *   archival contexts where the slot child shouldn't resolve.
 *
 * Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/render-modes
 */

import type { TW5FakeDocument, TW5Wiki } from "../types/tiddlywiki.js";

export interface SlotRenderContext {
  /** The sigil keyword (e.g. "ahu", "kau", "scope") */
  sigil:    string;
  /** The slot identifier (e.g. "#body", "#header") */
  slot:     string;
  /** Resolved child tiddler URI (parentUri + slot, or explicit uri attr) */
  childUri: string;
  wiki:     TW5Wiki;
  document: TW5FakeDocument;
}

export type RenderModeResult =
  | { kind: "text"; raw: string }
  | null;   // null = not a text-output mode; caller handles HTML render

/**
 * Dispatch projection-mode emission for a child-slot sigil widget.
 * Returns the raw text string for projection mode, or null otherwise
 * (caller must handle HTML / markdown-meme via cascades).
 */
export function dispatchSlotRenderMode(
  mode: string,
  ctx:  SlotRenderContext,
): RenderModeResult {
  const { sigil, slot } = ctx;
  if (mode === "projection") {
    return { kind: "text", raw: `<<~ aka ${sigil} ${slot} >>` };
  }
  return null;
}
