/**
 * @deprecated web2-era — "carrier" terminology replaced by "meme" in the FFZ model.
 * This file will be replaced by meme-write.ts once slot-surgery helpers migrate.
 * Do NOT add new exports here.
 *
 * carrier-write — operator-facing disk-export utilities for carrier format.
 *
 * Projection layer only. Nothing here writes to a LarTiddlerStore.
 *
 * Export path: parent tiddler in TW5 wiki holds kahea-reference form.
 * exportCarrierText expands kahea refs to definition form for disk write.
 * Surgical slot edits use replaceCarrierSlot / removeCarrierSlot on child bodies.
 */

import type { TW5TiddlerFields } from "./types/tiddlywiki.js";
import type { LarariumTW5 } from "./lararium-tw5.js";
import type { LarTiddlerRecord } from "@lararium/core";
import { replaceCarrierSlot, removeCarrierSlot, composeCarrierSlotBody } from "./carrier-codec.js";

// ---------------------------------------------------------------------------
// inferChildCarrierTitle — used by deleteTiddler guard
// ---------------------------------------------------------------------------

/**
 * Given a child tiddler title, infer the parent carrier URI and slot name.
 * Returns null when the title does not identify an ahu slot child.
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
// buildDirectRecord — sync-adaptor write path
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
// exportCarrierText — disk export via live VM wiki
//
// Parent tiddler stores the kahea-reference form (children authoritative).
// This function reconstructs the definition form needed for disk:
//   <<~ kahea ahu #slot >>  →  <<~ ahu #slot >>\n{child body}\n<<~/ahu >>
// ---------------------------------------------------------------------------

export function exportCarrierText(
  tw5: LarariumTW5,
  parentUri: string,
): string {
  // Render the parent tiddler through the full widget tree in carrier mode.
  // Each widget emits its definition form (ahu → body block, etc.).
  // This is the TW5-native serializer path: renderTiddler replaces regex expansion.
  return tw5.wiki.renderTiddler?.("text/plain", parentUri, {
    variables: { "lar-render-mode": "carrier" },
  }) ?? tw5.wiki.getTiddlerText?.(parentUri, "") ?? "";
}

// Re-export surgical slot editors for operator tooling.
export { replaceCarrierSlot, removeCarrierSlot, composeCarrierSlotBody };
