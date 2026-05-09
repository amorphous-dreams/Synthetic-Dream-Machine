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
    // When the child tiddler carries non-body fields (anything beyond `title`,
    // `text`, `bag`, `fragment-parent`, framework bookkeeping), emit a
    // per-slot iam toml block before the body so the round-trip preserves
    // slot-local metadata. Plain bodies omit the iam block to keep the
    // disk form readable for hand-edited memes.
    const childBody = wiki.getTiddlerText?.(childUri, "") ?? "";
    const childTid  = wiki.getTiddler?.(childUri);
    const iamBlock  = childTid ? renderSlotIam(childTid.fields ?? {}) : "";
    const head = iamBlock ? `<<~ ${sigil} ${slot} >>\n${iamBlock}\n` : `<<~ ${sigil} ${slot} >>\n`;
    return { kind: "text", raw: `${head}${childBody}\n<<~/${sigil} >>` };
  }

  if (mode === "projection") {
    // Shadow transclusion: freeze the live kahea ref to an aka ref.
    return { kind: "text", raw: `<<~ aka ${sigil} ${slot} >>` };
  }

  return null;
}

// Fields suppressed from the per-slot iam emission. These are framework
// bookkeeping (title/text identity) or routing metadata (bag, fragment-
// parent, source-file, synced-at, modified, created, revision) that the
// disk form reconstructs implicitly.
const SLOT_IAM_SUPPRESS = new Set<string>([
  "title", "text", "bag", "fragment-parent", "source-file", "synced-at",
  "modified", "created", "revision", "type",
]);

function renderSlotIam(fields: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (SLOT_IAM_SUPPRESS.has(k)) continue;
    if (v === undefined || v === null) continue;
    const value = formatTomlScalar(v);
    if (value === null) continue;
    lines.push(`${k} = ${value}`);
  }
  if (lines.length === 0) return "";
  return "```toml iam\n" + lines.join("\n") + "\n```";
}

function formatTomlScalar(v: unknown): string | null {
  if (typeof v === "string") {
    return JSON.stringify(v);
  }
  if (typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  if (Array.isArray(v)) {
    const parts: string[] = [];
    for (const item of v) {
      const s = formatTomlScalar(item);
      if (s !== null) parts.push(s);
    }
    return `[${parts.join(", ")}]`;
  }
  return null;
}
