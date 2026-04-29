/**
 * carrier-split — split a memetic carrier file into parent + child tiddlers.
 *
 * One .md file per lar: address. The parser emits WorksiteNodes (#ahu slots).
 * This module maps those to TW5 tiddler records:
 *
 *   #iam ahu      → parent tiddler fields (dissolved, no child tiddler)
 *   all other ahu → child tiddlers  title = parentUri + "#" + slot
 *                                   tags  = [parentUri]  (enables filter)
 *
 * Graceful degradation:
 *   - Missing #iam       → parent fields empty; parsing continues
 *   - Malformed TOML     → field ignored; warning recorded on parent
 *   - Unknown ahu kind   → child tiddler created with raw text; no crash
 *   - Duplicate slots    → last one wins (last-write-wins semantics)
 *   - Any thrown error   → caught; warning added; partial result returned
 *
 * Round-trip invariant:
 *   serializeCarrier(splitCarrierToTiddlers(uri, text).parent, children) ≈ text
 *   (whitespace and comment normalization permitted)
 */

import { parseMemeCarrier } from "@lararium/core";
import type { MemeAstNode, WorksiteNode, SigilNode } from "@lararium/core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParentTiddler {
  title:    string;
  fields:   Record<string, string | string[]>;
  /** Raw carrier text — kept for MemeticParser and round-trip write-back. */
  text:     string;
}

export interface ChildTiddler {
  title:    string;                          // parentUri + "#" + slot
  fields:   Record<string, string | string[]>;
  text:     string;                          // raw ahu body text
}

export interface CarrierSplit {
  parent:   ParentTiddler;
  children: ChildTiddler[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// TOML field extractor — handles the subset used in #iam blocks
// ---------------------------------------------------------------------------

function parseIamToml(content: string): Record<string, string | string[]> {
  const fields: Record<string, string | string[]> = {};
  const lines = content.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!.trim();
    i++;

    // Skip blank lines and comments
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key   = line.slice(0, eq).trim();
    const rest  = line.slice(eq + 1).trim();

    if (!key) continue;

    // Inline array: key = ["a", "b", "c"]
    if (rest.startsWith("[")) {
      // Collect until closing ] (handles multi-line arrays)
      let accum = rest;
      while (!accum.includes("]") && i < lines.length) {
        accum += " " + lines[i]!.trim();
        i++;
      }
      const inner = accum.match(/\[([\s\S]*?)\]/)?.[1] ?? "";
      const items = inner
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      fields[key] = items;
      continue;
    }

    // Quoted string
    if (rest.startsWith('"') || rest.startsWith("'")) {
      fields[key] = rest.replace(/^["']|["']$/g, "");
      continue;
    }

    // Bare value (number, bool, unquoted string)
    fields[key] = rest;
  }

  return fields;
}

// ---------------------------------------------------------------------------
// extractIamFields — find #iam ahu and dissolve its TOML into parent fields
// ---------------------------------------------------------------------------

function extractIamFields(
  nodes: MemeAstNode[],
  warnings: string[],
): Record<string, string | string[]> {
  for (const node of nodes) {
    if (node.kind !== "Worksite") continue;
    const ws = node as WorksiteNode;
    if (ws.slot !== "#iam") continue;

    for (const child of ws.body) {
      if (child.kind === "Sigil") {
        const sig = child as SigilNode;
        if (sig.sigilName === "toml" || sig.sigilName === "iam") {
          try {
            return parseIamToml(sig.attrs["content"] ?? "");
          } catch (e) {
            warnings.push(`#iam TOML parse error: ${e}`);
            return {};
          }
        }
      }
    }
    // #iam found but no TOML block inside
    return {};
  }
  return {};
}

// ---------------------------------------------------------------------------
// ahuBodyText — reconstruct raw body text from a WorksiteNode's children
// ---------------------------------------------------------------------------

function ahuBodyText(ws: WorksiteNode): string {
  return ws.body.map((n) => n.raw).join("");
}

// ---------------------------------------------------------------------------
// splitCarrierToTiddlers — main export
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

  // Dissolve #iam into parent fields
  const iamFields = extractIamFields(nodes, warnings);

  // Normalise implements and tags from TOML
  const normaliseArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return (v as unknown[]).map(String).filter(Boolean);
    if (typeof v === "string") return v.split(/\s+/).filter(Boolean);
    return [];
  };

  const implements_ = normaliseArray(iamFields["implements"]);
  const tags_       = normaliseArray(iamFields["tags"]);

  // Build parent fields — scalar TOML values become string fields
  const parentFields: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(iamFields)) {
    if (k === "implements" || k === "tags") continue;  // handled separately
    if (k === "uri-path" || k === "file-path") continue; // derived, not stored
    parentFields[k] = Array.isArray(v) ? v : String(v);
  }
  parentFields["implements"] = implements_.join(" ");
  parentFields["tags"]       = tags_;

  // Child tiddlers — one per non-#iam ahu, last-write-wins on duplicate slots
  const childMap = new Map<string, ChildTiddler>();
  const slotOrder: string[] = [];

  for (const node of nodes) {
    if (node.kind !== "Worksite") continue;
    const ws    = node as WorksiteNode;
    const slot  = ws.slot;
    if (slot === "#iam") continue;

    const childUri   = uri + slot;   // slot already includes "#" prefix
    const bodyText   = ahuBodyText(ws);

    if (!childMap.has(childUri)) slotOrder.push(childUri);

    childMap.set(childUri, {
      title: childUri,
      fields: {
        "ahu-slot":   slot,
        "ahu-parent": uri,
        tags:         [uri],          // parent URI as tag → [tag[lar:///SESSION]] filter
      },
      text: bodyText,
    });
  }

  // Record slot order on parent for round-trip serialisation
  if (slotOrder.length > 0) {
    parentFields["ahu-slots"] = slotOrder.join(" ");
  }

  return {
    parent: {
      title:  uri,
      fields: parentFields,
      text,   // raw carrier text kept for MemeticParser
    },
    children: slotOrder.map((t) => childMap.get(t)!),
    warnings,
  };
}

// ---------------------------------------------------------------------------
// serializeCarrier — reconstruct single-file format from parent + children.
// Used by the promote / write-back path in LarDiskSyncAdaptor.
// ---------------------------------------------------------------------------

export function serializeCarrier(
  parent: ParentTiddler,
  children: ChildTiddler[],
): string {
  // If the parent carries the original raw text, return it verbatim.
  // The raw text is authoritative; child bodies are derived views.
  if (parent.text) return parent.text;

  // Fallback: reconstruct from fields + children (lossy — no sigil decorations)
  const lines: string[] = [
    `<<~ ? -> ${parent.title} >>`,
    "",
    "<<~ ahu #iam >>",
    "",
    "```toml",
  ];

  for (const [k, v] of Object.entries(parent.fields)) {
    if (k === "implements" || k === "tags" || k === "ahu-slots") continue;
    lines.push(`${k} = "${Array.isArray(v) ? v.join(" ") : v}"`);
  }
  const impl = parent.fields["implements"];
  if (impl && (Array.isArray(impl) ? impl.length : impl)) {
    const arr = Array.isArray(impl) ? impl : String(impl).split(" ").filter(Boolean);
    lines.push(`implements = [${arr.map((s) => `"${s}"`).join(", ")}]`);
  }
  const tags = parent.fields["tags"];
  if (tags && (Array.isArray(tags) ? tags.length : tags)) {
    const arr = Array.isArray(tags) ? tags : String(tags).split(" ").filter(Boolean);
    lines.push(`tags = [${arr.map((s) => `"${s}"`).join(", ")}]`);
  }
  lines.push("```", "", "<<~/ahu >>", "");

  for (const child of children) {
    const slot = String(child.fields["ahu-slot"] ?? "");
    lines.push(`<<~ ahu ${slot} >>`, child.text, `<<~/ahu >>`, "");
  }

  lines.push(`<<~ -> ? >>`);
  return lines.join("\n");
}
