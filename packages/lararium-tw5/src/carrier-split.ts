/**
 * carrier-split — disk carrier text → tiddler fields.
 *
 * Model:
 *   Parent tiddler: title = URI, text = original carrier text, type = text/x-memetic-wikitext.
 *   Child tiddlers: one per non-control ahu slot, text = ahu body (also memetic-wikitext).
 *
 * No AST→string reconstruction. The MemeticParser owns rendering for both levels.
 * This module only projects TOML iam fields and fragment-* structural fields.
 *
 * Round-trip: disk file → splitCarrierToTiddlers → store → MemeticParser → TW5 render.
 */

import { parseMemeCarrier } from "@lararium/core";
import type { MemeAstNode, AhuNode } from "@lararium/core";
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

// ---------------------------------------------------------------------------
// extractRootTomlPrelude — find ```toml iam``` before first ahu/STX marker
// ---------------------------------------------------------------------------

export function extractRootTomlPrelude(
  text: string,
): { content: string; fullMatch: string } | null {
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
// extractUnitTomlPrelude — find ```toml iam``` or plain ```toml``` at ahu body start
// ---------------------------------------------------------------------------

export function extractUnitTomlPrelude(
  bodyText: string,
): { content: string; fullMatch: string; isIam: boolean } | null {
  const iamRe    = /^[ \t\n]*```toml[ \t]+iam[ \t]*\n([\s\S]*?)```[ \t]*\n?/;
  const plainRe  = /^[ \t\n]*```toml[ \t]*\n([\s\S]*?)```[ \t]*\n?/;
  const iamMatch = iamRe.exec(bodyText);
  if (iamMatch) return { content: iamMatch[1] ?? "", fullMatch: iamMatch[0], isIam: true };
  const plainMatch = plainRe.exec(bodyText);
  if (plainMatch) return { content: plainMatch[1] ?? "", fullMatch: plainMatch[0], isIam: false };
  return null;
}

// ---------------------------------------------------------------------------
// sanitizeProjectedFields — drop title and text, warn on collision
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
// fragmentFields — structural fields for ahu child tiddlers
// ---------------------------------------------------------------------------

export function fragmentFields(opts: {
  kind:          string;
  rootUri:       string;
  parentTitle:   string;
  fragmentPath:  string;
  segment:       string;
  depth:         number;
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
// collectAhuBodies — exact ahu body spans from source text (preserves whitespace)
// ---------------------------------------------------------------------------

function collectAhuBodies(text: string): Map<string, string> {
  const bodies = new Map<string, string>();
  const pattern = /<<~[^>]*\bahu\s+(#[\w-]+)\s*>>([\s\S]*?)<<~\/ahu\s*>>/g;
  for (const match of text.matchAll(pattern)) {
    const slot = match[1];
    if (slot && !bodies.has(slot)) {
      bodies.set(slot, match[2] ?? "");
    }
  }
  return bodies;
}

// ---------------------------------------------------------------------------
// splitCarrierToTiddlers — disk carrier text → CarrierSplit
//
// Parent tiddler text  = original carrier text (MemeticParser renders it).
// Child tiddler text   = ahu body text (also memetic-wikitext).
// No string reconstruction from AST. Field projection only.
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

  // ── Root TOML iam → parent fields ─────────────────────────────────────────
  let iamFields: Record<string, string | string[]> = {};
  const rootPrelude = extractRootTomlPrelude(text);
  if (rootPrelude) {
    const raw = parseTaploFields(rootPrelude.content, warnings, "root-toml-iam");
    iamFields = sanitizeProjectedFields(raw, warnings, "root-toml-iam");
  }

  const normaliseArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return (v as unknown[]).map(String).filter(Boolean);
    if (typeof v === "string") return v.split(/\s+/).filter(Boolean);
    return [];
  };

  const implements_ = normaliseArray(iamFields["implements"]);
  const tags_       = normaliseArray(iamFields["tags"]);

  const parentFields: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(iamFields)) {
    if (k === "implements" || k === "tags") continue;
    if (k === "uri-path" || k === "file-path") continue;
    parentFields[k] = Array.isArray(v) ? v : String(v);
  }
  parentFields["implements"] = implements_.join(" ");
  parentFields["tags"]       = tags_;
  // Parent text = original carrier; type declares content-type for MemeticParser.
  parentFields["type"]       = "text/x-memetic-wikitext";

  // ── Ahu children ──────────────────────────────────────────────────────────
  const sourceBodies = collectAhuBodies(text);
  const childMap     = new Map<string, ChildTiddler>();
  const slotOrder:     string[] = [];

  for (const node of nodes) {
    if (node.kind !== "Ahu") continue;
    const ws   = node as AhuNode;
    const slot = ws.slot;
    if (CONTROL_SLOTS.has(slot)) continue;

    const childUri = uri + slot;
    if (childMap.has(childUri)) continue;
    slotOrder.push(childUri);

    const segment   = slot.startsWith("#") ? slot.slice(1) : slot;
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
      "ahu-slot":   slot,
      "ahu-parent": uri,
      "type":       "text/x-memetic-wikitext",
    };

    // Raw body text from source — ahu body IS memetic-wikitext.
    const rawBody   = sourceBodies.get(slot) ?? ws.body.map((n) => n.raw).join("");

    // Extract leading TOML fence (iam or plain) for additional projected fields.
    const fence = extractUnitTomlPrelude(rawBody);
    let displayText = rawBody;

    if (fence) {
      const fenceFields = parseTaploFields(fence.content, warnings, `child-fence:${slot}`);
      const sanitized   = sanitizeProjectedFields(fenceFields, warnings, `child-fence:${slot}`);
      for (const [k, v] of Object.entries(sanitized)) {
        if (!(k in fragFields) || k === "tags") {
          childFields[k] = v;
        }
      }
      // Strip the fence from displayText; the rest is the live memetic-wikitext body.
      const endIdx = rawBody.indexOf(fence.fullMatch) + fence.fullMatch.length;
      displayText  = rawBody.slice(endIdx).trimStart();
    }

    childMap.set(childUri, {
      title:  childUri,
      fields: childFields,
      text:   displayText,
    });
  }

  if (slotOrder.length > 0) {
    parentFields["ahu-slots"] = slotOrder.join(" ");
  }

  return {
    parent: {
      title:  uri,
      fields: parentFields,
      text,              // original carrier text — MemeticParser owns rendering
    },
    children: slotOrder.map((t) => childMap.get(t)!),
    warnings,
  };
}
