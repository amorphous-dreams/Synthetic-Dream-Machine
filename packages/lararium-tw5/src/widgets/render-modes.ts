/**
 * render-modes — shared render mode dispatch for child-slot sigil widgets.
 *
 * The kahea/aka/carrier principle applies to ANY sigil that owns a child tiddler slot:
 *   HTML mode (default): live render — transclude child tiddler into DOM
 *   carrier mode:        disk export — emit definition form with child body inline
 *   projection mode:     frozen read — emit aka (shadow) reference sigil
 *
 * ahu is the prototype. All future child-slot sigils (e.g. kau scopes, etc.)
 * use this same dispatch rather than re-implementing the mode logic.
 *
 * Usage in a widget's render():
 *   const mode = getVariable("lar-render-mode") ?? "";
 *   const result = dispatchRenderMode(mode, { sigil, slot, childUri, wiki, document });
 *   if (result !== null) { ... emit text node ... return; }
 *   // else: fall through to HTML render
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
 * Dispatch text-output render modes for a child-slot sigil widget.
 * Returns the raw text string to emit, or null if HTML mode should proceed.
 */
export function dispatchSlotRenderMode(
  mode:    string,
  ctx:     SlotRenderContext,
): RenderModeResult {
  const { sigil, slot, childUri, wiki } = ctx;

  if (mode === "carrier") {
    // Disk export: always emit definition form — read child body from wiki.
    const childBody = wiki.getTiddlerText?.(childUri, "") ?? "";
    return { kind: "text", raw: `<<~ ${sigil} ${slot} >>\n${childBody}\n<<~/${sigil} >>` };
  }

  if (mode === "projection") {
    // Shadow transclusion: freeze the live kahea ref to an aka ref.
    return { kind: "text", raw: `<<~ aka ${sigil} ${slot} >>` };
  }

  return null;
}
