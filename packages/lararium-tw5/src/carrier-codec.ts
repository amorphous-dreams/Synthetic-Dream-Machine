/**
 * carrier-codec — projection codec for memetic carrier format ↔ LarTiddlerRecord[].
 *
 * Operates at the import/export boundary only. Does not write to any store.
 * Heleuma: lar:///ha.ka.ba/api/v0.1/lararium/schema/projection-codec
 *
 * Import path (disk → records):
 *   parseCarrier(parentUri, text, parentFields) → LarTiddlerRecord[]
 *
 * Export path (records → disk, operator-initiated):
 *   serializeCarrier(parent, children) → string
 *
 * One .md file per lar: address. The parser emits AhuNodes (#ahu slots).
 * This module maps those to TW5 tiddler records:
 *
 *   root ```toml iam``` → parent tiddler fields (dissolved, no child tiddler)
 *   control ahu         → parent structural leaves (body/stream markers; no child)
 *   all other ahu       → child tiddlers  title = parentUri + "#" + slot
 *                                         fragment-parent = parentUri  (enables filter)
 *
 * Graceful degradation:
 *   - Missing toml iam  → parent fields empty; parsing continues
 *   - Malformed TOML    → field ignored; warning recorded on parent
 *   - Unknown ahu kind  → child tiddler created with raw text; no crash
 *   - Duplicate slots   → last one wins (last-write-wins semantics)
 *   - Any thrown error  → caught; warning added; partial result returned
 *
 * Round-trip invariant:
 *   serializeCarrier(parseCarrier(uri, text, {}).parent, children) ≈ text
 *   (whitespace and comment normalization permitted)
 */

import type { MemeStreamEvent } from "@lararium/core";

// ---------------------------------------------------------------------------
// Types — defined in carrier-split, re-exported here for compatibility
// ---------------------------------------------------------------------------

export type { ParentTiddler, ChildTiddler, CarrierSplit } from "./carrier-split.js";
import type { ParentTiddler, ChildTiddler } from "./carrier-split.js";

// splitCarrierToTiddlers — re-exported from carrier-split.ts (new toml iam prelude format)
export { splitCarrierToTiddlers } from "./carrier-split.js";
import { splitCarrierToTiddlers } from "./carrier-split.js";

// ---------------------------------------------------------------------------
// streamEventsToTiddlers — convert MemeStreamEvents to TW5 tiddler field batches.
//
// Only carrier-close events produce tiddlers — one batch of [parent, ...children]
// per carrier, fully resolved via splitCarrierToTiddlers (toml iam prelude included).
//
// ahu-child events are intentionally skipped here: they carry incomplete fields
// and would produce duplicate child tiddlers that the carrier-close batch overwrites.
// Callers that want progressive/incremental rendering should consume ahu-child directly.
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
      const split = splitCarrierToTiddlers(ev.uri, ev.fullText);
      const parent: TiddlerFields = {
        title: ev.uri,
        ...split.parent.fields,
        text: ev.fullText,
      };
      if (realmOrigin) parent["realm-origin"] = realmOrigin;
      const children: TiddlerFields[] = split.children.map((c: ChildTiddler) => {
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
// serializeCarrier — reconstruct single-file carrier format from parent + children.
// Used by the promote / write-back path. Prefers carrier-text field (raw on-disk
// format) over parent.text (which is mixed TW5 wikitext, not carrier).
// ---------------------------------------------------------------------------

export function serializeCarrier(
  parent: ParentTiddler,
  children: ChildTiddler[],
): string {
  // carrier-text holds the raw on-disk carrier format. parent.text is the
  // mixed wikitext (transcludes + prose) used by the TW5 VM — not suitable
  // for disk round-trips.
  const carrierText = (parent.fields as Record<string, unknown>)["carrier-text"];
  if (typeof carrierText === "string" && carrierText) return carrierText;
  if (parent.text && !parent.text.includes("<$transclude")) return parent.text;

  // Fallback: reconstruct from fields + children (lossy — no sigil decorations)
  const lines: string[] = [
    `<<~ ? -> ${parent.title} >>`,
    "",
    "```toml iam",
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
  lines.push("```", "");

  for (const child of children) {
    const slot = String(child.fields["ahu-slot"] ?? "");
    lines.push(`<<~ ahu ${slot} >>`, child.text, `<<~/ahu >>`, "");
  }

  lines.push(`<<~ -> ? >>`);
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
// composeCarrierSlotBody — rebuild a carrier slot body from tiddler fields.
//
// Child tiddlers display editable body text with any leading ```toml iam``` fence
// stripped. The stripped fence lives in fragment-body-prefix, preserving metadata
// for write-back while keeping TW5 view/edit surfaces clean.
// ---------------------------------------------------------------------------

export function composeCarrierSlotBody(
  fields: Record<string, string | string[] | undefined>,
  text: string,
): string {
  // Check both new and legacy prefix field names
  const prefix = fields["fragment-body-prefix"] ?? fields["ahu-body-prefix"];
  if (typeof prefix !== "string" || prefix.length === 0) return text;
  if (text.startsWith(prefix)) return text;
  return `${prefix}${text}`;
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

// ---------------------------------------------------------------------------
// parseCarrier — canonical import-path alias (replaces splitCarrierToTiddlers)
// ---------------------------------------------------------------------------

/** Canonical import-path entry: disk carrier text → individual tiddler records. */
export { splitCarrierToTiddlers as parseCarrier } from "./carrier-split.js";
