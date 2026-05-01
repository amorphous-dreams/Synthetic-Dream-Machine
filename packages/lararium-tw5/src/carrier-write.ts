/**
 * carrier-write — operator-facing disk-export utilities for carrier format.
 *
 * Projection layer only. Nothing here writes to a LarTiddlerStore.
 * Heleuma: lar:///ha.ka.ba/api/v0.1/lararium/schema/projection-codec
 *
 * These helpers support the export path (Automerge/TW5 → carrier file on disk)
 * and the child-tiddler inference needed by sync-adaptor's deleteTiddler guard.
 * They do not appear in the saveTiddler write path.
 */

import type { TW5TiddlerFields } from "./types/tiddlywiki.js";
import type { LarariumTW5 } from "./lararium-tw5.js";
import type { LarTiddlerRecord, AhuNode } from "@lararium/core";
import { parseMemeCarrier } from "@lararium/core";
import { serializeCarrier, replaceCarrierSlot, removeCarrierSlot, composeCarrierSlotBody } from "./carrier-codec.js";

// ---------------------------------------------------------------------------
// Carrier decompile — memetic wikitext → parent + fragment tiddler records
//
// When an operator saves a tiddler whose text is a full memetic wikitext
// carrier (contains <<~ ahu #slot >> blocks), we split it into:
//   parent  — carrier-text field holds the lossless original; text holds TW5
//             transclusion markup so the parent renders correctly in TW5.
//   fragments — one LarTiddlerRecord per <<~ ahu #slot >> worksite, keyed
//               by "parentUri#slot". fragment-parent + ahu-slot fields link
//               them back to the parent for queries and write-back.
//
// Round-trip invariant: carrier-text MUST survive any edit cycle unchanged
// unless a fragment body is explicitly edited. replaceCarrierSlot() is the
// only mutation allowed on carrier-text (surgical, lossless).
// ---------------------------------------------------------------------------

/**
 * Decompose a full memetic wikitext carrier into a parent record + fragment
 * records. Returns null when the text contains no <<~ ahu >> worksites
 * (plain tiddler — let the caller store it as-is).
 */
export function decompileCarrierRecord(
  title: string,
  fields: Record<string, string>,
  text: string,
  targetBag: NonNullable<LarTiddlerRecord["bag"]> = "room",
): { parent: LarTiddlerRecord; fragments: LarTiddlerRecord[] } | null {
  if (!text.includes("<<~ ahu ")) return null;

  const ast = parseMemeCarrier(title, text);
  const slots = ast.filter((n): n is AhuNode => n.kind === "Ahu");
  if (slots.length === 0) return null;

  // Parent text: walk the full AST in document order.
  // Non-worksite nodes (prose, control bytes, edges, TOML blocks) pass through
  // as raw text — preserving all structure including control characters.
  // AhuNode → <$ahu slot="#name">{{uri#name}}</$ahu>
  // This is valid TW5 wikitext: operators can use either the sigil or widget form.
  const parentText = ast.map((n) => {
    if (n.kind === "Ahu") {
      const s = n as AhuNode;
      return `<$ahu slot="${s.slot}">{{${s.uri}}}</$ahu>`;
    }
    return n.raw;
  }).join("");

  const parent: LarTiddlerRecord = {
    title,
    fields: Object.fromEntries(
      Object.entries(fields).filter(([k]) => k !== "text" && k !== "title"),
    ),
    text: parentText,
    bag: targetBag,
  };

  // Fragments: body text from AhuNode body nodes.
  const fragments: LarTiddlerRecord[] = slots.map((s) => ({
    title: s.uri,
    fields: {
      "fragment-parent": title,
      "ahu-slot": s.slot,
    },
    text: s.body.map((n) => n.raw).join(""),
    bag: targetBag,
  }));

  return { parent, fragments };
}


// ---------------------------------------------------------------------------
// Child carrier inference (used by deleteTiddler guard only)
// ---------------------------------------------------------------------------

/**
 * Given a child tiddler title, infer the parent carrier URI and slot name.
 *
 * Returns null when the title does not identify an ahu slot child.
 * Used only to detect whether a deletion targets a child tiddler —
 * not to route writes through parent reconstruction.
 */
export function inferChildCarrierTitle(
  tw5: LarariumTW5,
  title: string,
): { parentUri: string; slot: string } | null {
  const wiki = tw5.wiki;
  const tiddler = wiki.getTiddler?.(title);
  const fields: TW5TiddlerFields = tiddler?.fields ?? ({} as TW5TiddlerFields);

  const explicitParent = fields["ahu-parent"];
  if (typeof explicitParent === "string" && explicitParent) {
    const explicitSlot = fields["ahu-slot"];
    const slot =
      typeof explicitSlot === "string" && explicitSlot
        ? explicitSlot
        : title.startsWith(explicitParent)
          ? title.slice(explicitParent.length)
          : "";
    if (slot) return { parentUri: explicitParent, slot };
  }

  const hash = title.lastIndexOf("#");
  if (!title.startsWith("lar:") || hash < 0) return null;
  const parentUri = title.slice(0, hash);
  const slot = title.slice(hash);
  if (!parentUri || !slot) return null;
  if (!wiki.getTiddler?.(parentUri)) return null;
  return { parentUri, slot };
}

// ---------------------------------------------------------------------------
// Direct record construction (sync-adaptor write path)
// ---------------------------------------------------------------------------

/** Build a `LarTiddlerRecord` for the `direct` save strategy. */
export function buildDirectRecord(
  title: string,
  fields: Record<string, string>,
  revision: string,
  targetBag: NonNullable<LarTiddlerRecord["bag"]> = "room",
): LarTiddlerRecord {
  const textVal = fields["text"];
  return {
    title,
    fields: Object.fromEntries(
      Object.entries(fields)
        .filter(([k]) => k !== "text" && k !== "title")
        .map(([k, v]) => [k, String(v)]),
    ),
    ...(textVal !== undefined ? { text: textVal } : {}),
    revision,
    bag: targetBag,
  };
}

// ---------------------------------------------------------------------------
// Disk-export utilities (operator tooling only — not in sync path)
// ---------------------------------------------------------------------------

/**
 * Collect all ahu slot child tiddlers for a given parent carrier URI.
 * Used only for operator-initiated disk export.
 */
export function buildCarrierChildren(
  tw5: LarariumTW5,
  parentUri: string,
  excludeTitle?: string,
): Array<{ title: string; fields: Record<string, string | string[]>; text: string }> {
  const wiki = tw5.wiki;
  const childTitles: string[] = tw5.filterTiddlers(`[field:fragment-parent[${parentUri}]]`);
  return childTitles
    .filter((ct) => ct !== excludeTitle)
    .map((ct) => {
      const ct5 = wiki.getTiddler?.(ct);
      const cf: TW5TiddlerFields = ct5?.fields ?? ({} as TW5TiddlerFields);
      return {
        title: ct,
        fields: {
          ...(cf as Record<string, string | string[]>),
          "ahu-slot":   String(cf["ahu-slot"] ?? ""),
          "ahu-parent": parentUri,
          tags:         [parentUri],
        },
        text: String(cf["text"] ?? ""),
      };
    });
}

/**
 * Serialize all tiddlers for a given parent URI back to carrier text.
 * Operator-initiated export only — not called during Automerge sync.
 */
export function exportCarrierText(
  tw5: LarariumTW5,
  parentUri: string,
): string {
  const wiki = tw5.wiki;
  const parentTiddler = wiki.getTiddler?.(parentUri);
  const parentFields: TW5TiddlerFields = parentTiddler?.fields ?? ({} as TW5TiddlerFields);
  return serializeCarrier(
    { title: parentUri, fields: parentFields as Record<string, string | string[]>, text: "" },
    buildCarrierChildren(tw5, parentUri),
  );
}

// Re-export surgical slot editors for operator tooling.
export { replaceCarrierSlot, removeCarrierSlot, composeCarrierSlotBody };
