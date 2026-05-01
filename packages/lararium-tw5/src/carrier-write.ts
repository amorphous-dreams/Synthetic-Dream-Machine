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
import type { LarTiddlerRecord } from "@lararium/core";
import { serializeCarrier, replaceCarrierSlot, removeCarrierSlot, composeCarrierSlotBody } from "./carrier-codec.js";

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
  const childTitles: string[] = tw5.filterTiddlers(`[tag[${parentUri}]has[ahu-slot]] [field:fragment-parent[${parentUri}]]`);
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
