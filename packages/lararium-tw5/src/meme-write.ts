/**
 * meme-write — disk-export utilities for meme format.
 *
 * Replaces carrier-write.ts / carrier-write.web2.ts:
 *   exportCarrierText  → exportMemeText
 *   buildDirectRecord  — same contract (bag / revision fields unchanged)
 *   replaceCarrierSlot → replaceMemeSlot  (slot-surgery; Sprint 4+)
 *   removeCarrierSlot  → removeMemeSlot   (slot-surgery; Sprint 4+)
 *   composeCarrierSlotBody → composeMemeSlotBody (Sprint 4+)
 *
 * Projection layer only. Nothing here writes to a LarTiddlerStore.
 *
 * Key shift from carrier-write:
 *   In the meme model the tiddler `text` field IS the memetic-wikitext source —
 *   no expansion from kahea-reference form is needed for identity-form memes.
 *   exportMemeText returns the live TW5 tiddler text directly.
 *   Slot-expanded definition form (for carrier-style disk layout) is a
 *   future lar-render-mode pass, noted below with TODO.
 *
 * Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/meme-write
 */

import type { TW5TiddlerFields } from "./types/tiddlywiki.js";
import type { TW5Engine } from "./tw5-vm.js";
import type { LarTiddlerRecord } from "@lararium/core";

// ---------------------------------------------------------------------------
// inferChildMemeTitle — used by deleteTiddler guard
// ---------------------------------------------------------------------------

/**
 * Given a child tiddler title, infer the parent meme URI and slot fragment.
 * Returns null when the title does not identify an ahu slot child.
 */
export function inferChildMemeTitle(
  tw5:   TW5Engine,
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
  const slot      = title.slice(hash);
  if (!parentUri || !slot) return null;
  if (!wiki.getTiddler?.(parentUri)) return null;
  return { parentUri, slot };
}

// ---------------------------------------------------------------------------
// buildDirectRecord — sync-adaptor write path
// ---------------------------------------------------------------------------

/** Build a `LarTiddlerRecord` for the `direct` save strategy. */
export function buildDirectRecord(
  title:     string,
  fields:    Record<string, string>,
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
    bag: targetBag,
  };
}

// ---------------------------------------------------------------------------
// exportMemeText — disk export of a meme's canonical text form
// ---------------------------------------------------------------------------

/**
 * Return the canonical memetic-wikitext for a meme URI.
 *
 * In the meme model the `text` field of a tiddler IS the source form —
 * no kahea-reference expansion is needed for identity-form memes.
 *
 * TODO (Sprint 4+): add `lar-render-mode: "meme"` render pass for memes
 * that use slot-body kahea references (parent tiddler stores reference form,
 * children are authoritative for body). This mirrors the carrier-write pattern:
 *   tw5.wiki.renderTiddler("text/plain", memeUri, { variables: { "lar-render-mode": "meme" } })
 *
 * @param tw5     - Live TW5Engine VM instance
 * @param memeUri - lar:/// URI of the meme tiddler
 * @returns       - Canonical memetic-wikitext string, or "" if not found
 */
export function exportMemeText(tw5: TW5Engine, memeUri: string): string {
  return tw5.wiki.getTiddlerText?.(memeUri, "") ?? "";
}

// ---------------------------------------------------------------------------
// Slot-surgery helpers — Sprint 4+ stubs
//
// Wire `DirectMemeRecipeVm.renderMeme` to `exportMemeText` in Sprint 3c.
// Implement full slot-surgery in Sprint 4 alongside KumuDeviceSpec.
// ---------------------------------------------------------------------------

/**
 * Replace the body of a named ahu slot in memetic-wikitext source.
 * TODO Sprint 4 — implement slot-surgery on MemeAstNode tree.
 */
export function replaceMemeSlot(
  _source:   string,
  _slot:     string,
  _newBody:  string,
): string {
  throw new Error("[meme-write] replaceMemeSlot not yet implemented — Sprint 4+");
}

/**
 * Remove a named ahu slot block from memetic-wikitext source.
 * TODO Sprint 4 — implement slot-surgery on MemeAstNode tree.
 */
export function removeMemeSlot(_source: string, _slot: string): string {
  throw new Error("[meme-write] removeMemeSlot not yet implemented — Sprint 4+");
}

/**
 * Compose a slot body string from parts.
 * TODO Sprint 4 — implement once slot-surgery helpers land.
 */
export function composeMemeSlotBody(_parts: string[]): string {
  throw new Error("[meme-write] composeMemeSlotBody not yet implemented — Sprint 4+");
}
