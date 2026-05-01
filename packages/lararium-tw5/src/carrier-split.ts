/**
 * carrier-split — splitCarrierToTiddlers using new ```toml iam``` root prelude format.
 *
 * New format: root-level ```toml iam``` block instead of <<~ ahu #iam >> metadata block.
 * Fragment children use fragment-* structural fields instead of tags:[parentUri].
 *
 * Import path: disk carrier text → CarrierSplit
 */

import { parseMemeCarrier } from "@lararium/core";
import type { MemeAstNode, AhuNode, SigilNode, PaeNode, TextNode } from "@lararium/core";
import { parseTaploFields } from "./toml-ast.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParentTiddler {
  title:  string;
  fields: Record<string, string | string[]>;
  text:   string;
}

export interface ChildTiddler {
  title:  string;
  fields: Record<string, string | string[]>;
  text:   string;
}

export interface CarrierSplit {
  parent:   ParentTiddler;
  children: ChildTiddler[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTROL_SLOTS = new Set([
  "#iam",
  "#exit",
  "#stream-open",
  "#stream-close",
  "#stream-exit",
  "#body-open",
  "#body-close",
  "#meme-body-open",
  "#meme-body-close",
]);

const MEMETIC_CHILD_SCAN_TYPES = new Set(["text/x-memetic-wikitext"]);

// ---------------------------------------------------------------------------
// extractRootTomlPrelude — find ```toml iam``` before first ahu/STX marker
// ---------------------------------------------------------------------------

export function extractRootTomlPrelude(
  text: string,
): { content: string; fullMatch: string } | null {
  // Find position of first ahu open or STX marker
  const firstAhuIdx = text.search(/<<~[^>]*\bahu\s+#[\w-]+\s*>>/);
  const firstStxIdx = text.search(/<<~[^>]*&#x0002;/);
  let limitIdx = text.length;
  if (firstAhuIdx >= 0) limitIdx = Math.min(limitIdx, firstAhuIdx);
  if (firstStxIdx >= 0) limitIdx = Math.min(limitIdx, firstStxIdx);

  const searchText = text.slice(0, limitIdx);
  const regex = /```toml[ \t]+iam[ \t]*\n([\s\S]*?)```/;
  const match = regex.exec(searchText);
  if (!match) return null;
  return { content: match[1] ?? "", fullMatch: match[0] };
}

// ---------------------------------------------------------------------------
// extractUnitTomlPrelude — find ```toml iam``` at start of ahu body
// ---------------------------------------------------------------------------

export function extractUnitTomlPrelude(
  bodyText: string,
): { content: string; fullMatch: string } | null {
  const regex = /^[ \t\n]*```toml[ \t]+iam[ \t]*\n([\s\S]*?)```[ \t]*\n?/;
  const match = regex.exec(bodyText);
  if (!match) return null;
  return { content: match[1] ?? "", fullMatch: match[0] };
}

// ---------------------------------------------------------------------------
// sanitizeProjectedFields — drop title and text, warn
// ---------------------------------------------------------------------------

export function sanitizeProjectedFields(
  fields: Record<string, unknown>,
  warnings: string[],
  context: string,
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k === "title") {
      warnings.push(`${context}: "title" in TOML is ignored (derived from URI)`);
      continue;
    }
    if (k === "text") {
      warnings.push(`${context}: "text" in TOML is ignored (derived from body)`);
      continue;
    }
    if (Array.isArray(v)) {
      out[k] = (v as unknown[]).map(String);
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// fragmentFields — build fragment-* structural fields for ahu children
// ---------------------------------------------------------------------------

export function fragmentFields(opts: {
  kind: string;
  rootUri: string;
  parentTitle: string;
  fragmentPath: string;
  segment: string;
  depth: number;
}): Record<string, string> {
  return {
    "fragment-kind":    opts.kind,
    "fragment-root":    opts.rootUri,
    "fragment-parent":  opts.parentTitle,
    "fragment-path":    opts.fragmentPath,
    "fragment-segment": opts.segment,
    "fragment-depth":   String(opts.depth),
  };
}

// ---------------------------------------------------------------------------
// ahuBodyText — reconstruct raw body text from AhuNode children
// ---------------------------------------------------------------------------

function ahuBodyText(ws: AhuNode): string {
  return ws.body.map((n) => n.raw).join("");
}

// ---------------------------------------------------------------------------
// collectAhuBodies — recover exact ahu body spans from source text
// ---------------------------------------------------------------------------

function collectAhuBodies(text: string): Map<string, string> {
  const bodies = new Map<string, string>();
  const pattern = /<<~[^>]*\bahu\s+(#[\w-]+)\s*>>([\s\S]*?)<<~\/ahu\s*>>/g;
  for (const match of text.matchAll(pattern)) {
    const slot = match[1];
    if (!slot) continue;
    bodies.set(slot, match[2] ?? "");
  }
  return bodies;
}

// ---------------------------------------------------------------------------
// generateParentText — mixed wikitext for parent tiddler text field
// ---------------------------------------------------------------------------

function generateParentText(uri: string, nodes: MemeAstNode[]): string {
  const parts: string[] = [];
  let inBody = false;

  for (const node of nodes) {
    if (node.kind === "Pae") {
      const phase = (node as PaeNode).phase;
      if (phase === "stx") { inBody = true; continue; }
      if (phase === "etx" || phase === "eot") break;
      continue;
    }
    if (!inBody) continue;

    if (node.kind === "Ahu") {
      const ws = node as AhuNode;
      if (!CONTROL_SLOTS.has(ws.slot)) {
        parts.push(`<$transclude tiddler="${uri}${ws.slot}" mode="block"/>`);
      }
    } else if (node.kind === "Text") {
      const prose = (node as TextNode).content.trim();
      if (prose) parts.push(prose);
    }
  }

  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// splitCarrierToTiddlers — main export (new format with toml iam prelude)
// ---------------------------------------------------------------------------

export function splitCarrierToTiddlers(uri: string, text: string): CarrierSplit {
  const warnings: string[] = [];
  let nodes: MemeAstNode[] = [];

  try {
    nodes = parseMemeCarrier(uri, text);
  } catch (e) {
    warnings.push(`parse failed: ${e}`);
    return {
      parent:   { title: uri, fields: {}, text },
      children: [],
      warnings,
    };
  }

  // Extract root-level ```toml iam``` prelude for parent fields
  let iamFields: Record<string, string | string[]> = {};
  const rootPrelude = extractRootTomlPrelude(text);
  if (rootPrelude) {
    const raw = parseTaploFields(rootPrelude.content, warnings, "root-toml-iam");
    iamFields = sanitizeProjectedFields(raw, warnings, "root-toml-iam");
  } else {
    // Legacy fallback: look for #iam ahu block (for backwards compatibility)
    for (const node of nodes) {
      if (node.kind !== "Ahu") continue;
      const ws = node as AhuNode;
      if (ws.slot !== "#iam") continue;
      for (const child of ws.body) {
        if (child.kind === "Sigil") {
          const sig = child as SigilNode;
          if (sig.sigilName === "toml" || sig.sigilName === "iam") {
            const raw = parseTaploFields(sig.attrs["content"] ?? "", warnings, "#iam");
            iamFields = sanitizeProjectedFields(raw, warnings, "#iam");
            break;
          }
        }
      }
      break;
    }
  }

  // Normalise implements and tags
  const normaliseArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return (v as unknown[]).map(String).filter(Boolean);
    if (typeof v === "string") return v.split(/\s+/).filter(Boolean);
    return [];
  };

  const implements_ = normaliseArray(iamFields["implements"]);
  const tags_       = normaliseArray(iamFields["tags"]);

  // Build parent fields
  const parentFields: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(iamFields)) {
    if (k === "implements" || k === "tags") continue;
    if (k === "uri-path" || k === "file-path") continue; // derived, not stored
    parentFields[k] = Array.isArray(v) ? v : String(v);
  }
  parentFields["implements"] = implements_.join(" ");
  parentFields["tags"]       = tags_;

  // Child tiddlers — one per non-control ahu slot
  const childMap = new Map<string, ChildTiddler>();
  const slotOrder: string[] = [];
  const sourceBodies = collectAhuBodies(text);

  for (const node of nodes) {
    if (node.kind !== "Ahu") continue;
    const ws   = node as AhuNode;
    const slot = ws.slot;
    if (CONTROL_SLOTS.has(slot)) continue;

    const childUri  = uri + slot;
    const bodyText  = sourceBodies.get(slot) ?? ahuBodyText(ws);

    if (!childMap.has(childUri)) slotOrder.push(childUri);

    // Build fragment structural fields
    const segment = slot.startsWith("#") ? slot.slice(1) : slot;
    const fragFields = fragmentFields({
      kind:          "ahu",
      rootUri:       uri,
      parentTitle:   uri,
      fragmentPath:  slot,
      segment,
      depth:         1,
    });

    const childFields: Record<string, string | string[]> = {
      ...fragFields,
      // Ahu aliases
      "ahu-slot":    slot,
      "ahu-parent":  uri,
      // Streams plugin compatibility
      "parent":      uri,
      "stream-type": "default",
    };

    // Extract leading ```toml iam``` or plain ```toml``` fence from child body
    const iamFence = extractUnitTomlPrelude(bodyText);
    // Also try legacy plain toml fence
    const plainFence = iamFence ? null : /^[ \t]*```toml[ \t]*\n([\s\S]*?)```[ \t]*\n?/.exec(bodyText.trimStart());

    let displayText = bodyText;
    if (iamFence) {
      const fenceFields = parseTaploFields(iamFence.content, warnings, `child-fence:${slot}`);
      const sanitized = sanitizeProjectedFields(fenceFields, warnings, `child-fence:${slot}`);
      for (const [k, v] of Object.entries(sanitized)) {
        // Preserve author-provided tags exactly; don't override fragment fields
        if (!(k in fragFields) || k === "tags") {
          childFields[k] = v;
        }
      }
      childFields["fragment-body-prefix"] = iamFence.fullMatch;
      const endIdx = bodyText.indexOf(iamFence.fullMatch) + iamFence.fullMatch.length;
      displayText = bodyText.slice(endIdx).trimStart();
    } else if (plainFence) {
      const fenceFields = parseTaploFields(plainFence[1] ?? "", warnings, `child-fence:${slot}`);
      const sanitized = sanitizeProjectedFields(fenceFields, warnings, `child-fence:${slot}`);
      for (const [k, v] of Object.entries(sanitized)) {
        if (!(k in fragFields) || k === "tags") {
          childFields[k] = v;
        }
      }
      childFields["fragment-body-prefix"] = plainFence[0];
      const endIdx = plainFence.index! + plainFence[0].length;
      displayText = bodyText.slice(endIdx).trimStart();
    }

    // Only scan child body for nested ahu if type is memetic-wikitext
    const childType = typeof childFields["type"] === "string" ? childFields["type"] : "";
    if (childType && !MEMETIC_CHILD_SCAN_TYPES.has(childType)) {
      // Non-memetic body: don't nest-scan; use displayText as-is
    }

    childMap.set(childUri, {
      title:  childUri,
      fields: childFields,
      text:   displayText,
    });
  }

  if (slotOrder.length > 0) {
    parentFields["ahu-slots"]   = slotOrder.join(" ");
    parentFields["stream-list"] = slotOrder.join(" ");
    parentFields["stream-type"] = "stream";
  }

  // carrier-text is NOT stored in Automerge. The TW5 VM render pipeline
  // (exportCarrierText via fakeDOM) is the canonical projection path — the same
  // pipeline used to bootstrap the browser client over the wire.
  // Round-trip: disk file → splitCarrierToTiddlers → store → VM render → disk file.

  return {
    parent: {
      title:  uri,
      fields: parentFields,
      text:   generateParentText(uri, nodes),
    },
    children: slotOrder.map((t) => childMap.get(t)!),
    warnings,
  };
}
