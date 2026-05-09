/**
 * meme-write — disk export of memes via TW5 templates + cascades.
 *
 * Architecture (rewrite, no legacy code):
 *   `exportMemeText` invokes `wiki.renderTiddler` on the parent meme tiddler
 *   under a scope variable (`lar-export-scope = "markdown-meme"`). The
 *   wikifier walks the parent's parse tree in source order; each AhuWidget
 *   it encounters resolves the ahu cascade — which reads the scope variable
 *   and picks the matching slot template (`templates/ahu/markdown-meme`).
 *   The slot template emits the canonical `<<~ ahu slot >>\n{body}\n<<~/ahu>>`
 *   form by transcluding the slot child tiddler. Non-sigil prose between
 *   slots renders as text; the iam toml fenced block survives as literal
 *   text under text/plain rendering. Source-order ahu emission falls out
 *   of TW5's parse-tree rendering — no manual ordering needed.
 *
 *   The cascade-template chain replaces the prior `lar-render-mode` widget
 *   dispatch entirely. AhuWidget knows nothing about render scopes.
 *
 *   Round-trip idempotency target: the operator-authored meme grammar
 *   round-trips through sync → CRDT → render → disk byte-equivalent
 *   (modulo trailing-newline normalization). Anything not in the source
 *   does not appear on render.
 *
 * Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/meme-write
 */

import type { TW5TiddlerFields } from "./types/tiddlywiki.js";
import type { TW5Engine } from "./tw5-vm.js";
import type { LarTiddlerRecord } from "@lararium/core";

// ---------------------------------------------------------------------------
// inferChildMemeTitle — sync-adaptor delete-path helper
// ---------------------------------------------------------------------------

/**
 * Given a child tiddler title, infer its parent meme URI and slot fragment.
 * Returns null when the title doesn't identify an ahu slot child.
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

/** Build a LarTiddlerRecord for the `direct` save strategy. */
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
// exportMemeText — disk export via TW5 templates + cascades
// ---------------------------------------------------------------------------

/**
 * Return the canonical memetic-wikitext for a meme URI.
 *
 * Routes through TW5's renderTiddler pipeline — the same path the wiki
 * shell and HTML export use — with the `lar-export-scope` variable set
 * to "markdown-meme". The wikifier walks the parent's parse tree;
 * AhuWidget instances resolve the ahu cascade and transclude their slot
 * children through the disk-export template. Non-sigil text renders as-is.
 *
 * @param tw5     - Live TW5Engine VM instance
 * @param memeUri - lar:/// URI of the meme parent tiddler
 * @returns       - Canonical memetic-wikitext, or empty string if absent
 */
const MEME_MARKDOWN_TEMPLATE = "lar:///ha.ka.ba/@lararium/templates/meme/markdown-meme";

export function exportMemeText(tw5: TW5Engine, memeUri: string): string {
  const wiki = tw5.wiki;
  if (!wiki?.renderTiddler) return "";
  try {
    // Render through the meme-level template, which carries `\rules only
    // transcludeinline lar-sigil-block lar-sigil-inline lar-doctype-comment`.
    // The pragma curates the wikitext rule set so backticks, dashes, html
    // entities, html comments, and macrocall stay literal — only sigil and
    // transclusion rules fire. AhuWidget transcludes slot children through
    // the cascade-resolved slot template; everything else passes verbatim.
    return wiki.renderTiddler("text/plain", MEME_MARKDOWN_TEMPLATE, {
      variables: {
        currentTiddler:    memeUri,
        "lar-export-scope": "markdown-meme",
      },
    }) ?? "";
  } catch {
    return wiki.getTiddlerText?.(memeUri, "") ?? "";
  }
}
