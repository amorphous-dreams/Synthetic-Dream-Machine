/**
 * carrier-split — split a memetic carrier file into parent + child tiddlers.
 *
 * One .md file per lar: address. The parser emits WorksiteNodes (#ahu slots).
 * This module maps those to TW5 tiddler records:
 *
 *   #iam ahu      → parent tiddler fields (dissolved, no child tiddler)
 *   control ahu   → parent structural leaves (body/stream markers; no child)
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
import type { MemeAstNode, WorksiteNode, SigilNode, MemeStreamEvent } from "@lararium/core";

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
            const raw = sig.attrs["content"] ?? "";
            const firstBadLine = raw.split("\n").find(l => {
              try { parseIamToml(l); return false; } catch { return l.trim() && !l.startsWith("#"); }
            }) ?? "(unknown line)";
            warnings.push(`#iam TOML parse error near: ${JSON.stringify(firstBadLine)} — ${e}`);
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
// collectAhuBodies — recover exact ahu body spans from source text.
//
// The parser AST keeps each nested sigil's opening token as `raw`, not always
// the full source span. For child tiddlers we therefore prefer source slices so
// edits/round-trips preserve nested blocks and close markers.
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
// CONTROL_SLOTS — structural ahu frame markers that dissolve into the parent
// tiddler (or are discarded). They do NOT become child tiddlers.
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
  const sourceBodies = collectAhuBodies(text);

  for (const node of nodes) {
    if (node.kind !== "Worksite") continue;
    const ws    = node as WorksiteNode;
    const slot  = ws.slot;
    if (CONTROL_SLOTS.has(slot)) continue;

    const childUri   = uri + slot;   // slot already includes "#" prefix
    const bodyText   = sourceBodies.get(slot) ?? ahuBodyText(ws);

    if (!childMap.has(childUri)) slotOrder.push(childUri);

    // Extract optional TOML metadata from the child body — first ```toml ... ``` fence.
    // Enables child ahu sections to declare TW5-native fields (type, mime-type, etc.).
    const childFields: Record<string, string | string[]> = {
      "ahu-slot":    slot,
      "ahu-parent":  uri,
      tags:          [uri],   // parent URI as tag → [tag[lar:///SESSION]] filter
      // Streams plugin (sq/streams) compatibility aliases
      "parent":      uri,
      "stream-type": "default",
    };
    const tomlFence = /^```toml\s*\n([\s\S]*?)```/m.exec(bodyText);
    if (tomlFence) {
      const toml = tomlFence[1] ?? "";
      for (const line of toml.split("\n")) {
        const kv = line.match(/^\s*([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([\w/+-]+))/);
        if (kv) childFields[kv[1]!] = kv[2] ?? kv[3] ?? kv[4] ?? "";
      }
    }

    childMap.set(childUri, {
      title: childUri,
      fields: childFields,
      text: bodyText,
    });
  }

  // Record slot order on parent for round-trip serialisation.
  // stream-list mirrors ahu-slots for Streams plugin (sq/streams) compatibility.
  if (slotOrder.length > 0) {
    parentFields["ahu-slots"]    = slotOrder.join(" ");
    parentFields["stream-list"]  = slotOrder.join(" ");
    parentFields["stream-type"]  = "stream";
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
// streamEventsToTiddlers — convert MemeStreamEvents to TW5 tiddler field batches.
//
// Only carrier-close events produce tiddlers — one batch of [parent, ...children]
// per carrier, fully resolved via splitCarrierToTiddlers (#iam TOML included).
//
// ahu-child events are intentionally skipped here: they carry incomplete fields
// (no #iam resolution) and would produce duplicate child tiddlers that the
// carrier-close batch overwrites. Callers that want progressive/incremental
// rendering should consume MemeStreamEvent.ahu-child directly.
//
// realmOrigin — lar URI of the source Realm. Injected as "realm-origin" on every
// tiddler for multi-Realm provenance: [all[memes]field:realm-origin[lar:///remote]]
// ---------------------------------------------------------------------------

export type TiddlerFields = Record<string, string | string[]>;

export function streamEventsToTiddlers(
  events:       readonly MemeStreamEvent[],
  realmOrigin?: string,
): TiddlerFields[][] {
  const batches: TiddlerFields[][] = [];

  for (const ev of events) {
    if (ev.kind === "carrier-close") {
      // Full split — resolves #iam TOML into parent fields + re-derives children.
      const split = splitCarrierToTiddlers(ev.uri, ev.fullText);
      const parent: TiddlerFields = {
        title: ev.uri,
        ...split.parent.fields,
        text: ev.fullText,
      };
      if (realmOrigin) parent["realm-origin"] = realmOrigin;
      const children: TiddlerFields[] = split.children.map((c) => {
        const f: TiddlerFields = { ...c.fields, title: c.title, text: c.text };
        if (realmOrigin) f["realm-origin"] = realmOrigin;
        return f;
      });
      batches.push([parent, ...children]);
    }
  }

  return batches;
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

// ---------------------------------------------------------------------------
// replaceCarrierSlot — surgical in-place replacement of one ahu slot's body.
//
// Finds the <<~ ahu #slot >> ... <<~/ahu >> span in the raw carrier text and
// replaces only the body content, preserving all other slots and decorators.
// Returns null if the slot is not found (caller should fall back to full reconstruct).
// ---------------------------------------------------------------------------

export function replaceCarrierSlot(
  carrierText: string,
  slot: string,         // e.g. "#ooda-ha"
  newBody: string,
): string | null {
  const escaped = slot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Opening tag may have control/html-entity/memetic decorator prefixes.
  const pattern = new RegExp(
    `(<<~[^>]*\\bahu\\s+${escaped}\\s*>>)([\\s\\S]*?)(<<~\\/ahu\\s*>>)`,
    "g",
  );
  let matched = false;
  const result = carrierText.replace(pattern, (_full, open, _body, close) => {
    matched = true;
    return `${open}${newBody}${close}`;
  });
  return matched ? result : null;
}

// ---------------------------------------------------------------------------
// removeCarrierSlot — surgical removal of one ahu slot from a raw carrier.
//
// Used when a TW5 child tiddler is deleted: the persisted store still owns only
// the parent carrier, so deleting `lar:///x#slot` should remove that slot from
// `lar:///x` rather than tombstoning a derived child title.
// ---------------------------------------------------------------------------

export function removeCarrierSlot(carrierText: string, slot: string): string | null {
  const escaped = slot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<<~[^>]*\\bahu\\s+${escaped}\\s*>>[\\s\\S]*?<<~\\/ahu\\s*>>`, "g");
  let matched = false;
  const result = carrierText.replace(pattern, () => {
    matched = true;
    return "";
  });
  return matched ? result : null;
}
