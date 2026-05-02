/**
 * seed-grammar-tiddler — writes or reconciles the grammar meme tiddler into a
 * system MemeStoreDoc Automerge handle.
 *
 * Boot sequence (invariants 2–3 of grammar-invariants.ts):
 *   1. Server start → read `lares/grammars/memetic-wikitext.md` from filesystem
 *   2. Compute SHA-256 of text (content-addressed identity)
 *   3. Compare with stored contentHash in system doc
 *   4. If different (or absent): write/update the system tiddler
 *   5. From here forward, runtime reads grammar from CRDT — NOT from disk
 *
 * The grammar meme is stored as a first-class tiddler (NOT a blob in LarariumDoc.blobs).
 * Blobs are for large, immutable, non-parseable assets.
 * Grammar text is small, mutable, human-readable memetic-wikitext.
 *
 * Grammar tiddler record:
 *   title       = GRAMMAR_MEME_URI  ("lar:///ha.ka.ba/@lares/grammars/memetic-wikitext")
 *   bag         = "system"
 *   text        = raw memetic-wikitext content
 *   contentHash = "sha256:" + hex
 *   fields.type = "text/x-memetic-wikitext"
 *   fields.uri  = GRAMMAR_MEME_URI
 *
 * Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/grammar-tiddler
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import type { DocHandle } from "@automerge/automerge-repo";
import type { LarariumDoc } from "@lararium/core";
import {
  GRAMMAR_MEME_URI,
  GRAMMAR_BAG,
  GRAMMAR_LARES_REL_PATH,
} from "@lararium/core";
import { laresRoot } from "@lares/lares";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sha256text(text: string): string {
  return "sha256:" + createHash("sha256").update(text, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// seedGrammarTiddler
// ---------------------------------------------------------------------------

/**
 * Write the grammar tiddler into a system `MemeStoreDoc` at first seed.
 * Should be called once during initial island creation before the first VM boot.
 *
 * @param handle   - Automerge handle for the system (or engine) MemeStoreDoc
 * @param grammarText - Raw memetic-wikitext body of the grammar meme
 * @param hash        - "sha256:..." pre-computed (pass output of sha256text())
 */
export function seedGrammarTiddler(
  handle:      DocHandle<LarariumDoc>,
  grammarText: string,
  hash:        string,
): void {
  handle.change((doc) => {
    if (!doc.tiddlers) (doc as { tiddlers?: Record<string, unknown> }).tiddlers = {};
    (doc.tiddlers as Record<string, unknown>)[GRAMMAR_MEME_URI] = {
      title:       GRAMMAR_MEME_URI,
      bag:         GRAMMAR_BAG,
      text:        grammarText,
      contentHash: hash,
      fields: {
        type: "text/x-memetic-wikitext",
        uri:  GRAMMAR_MEME_URI,
      },
    };
  });
  console.log(`[lararium-grammar] seeded grammar tiddler  hash=${hash.slice(0, 20)}…`);
}

// ---------------------------------------------------------------------------
// reconcileGrammarTiddlerIfChanged
// ---------------------------------------------------------------------------

/**
 * Check whether the grammar tiddler in the system doc differs from disk.
 * If so (or if absent), update it.
 *
 * Designed for use on resume boots: ensures a grammar upgrade (operator edits
 * `lares/grammars/memetic-wikitext.md`) propagates to all live peers without
 * requiring a full island reseed.
 *
 * Invariant 4 (operator shadow-override via bag priority) is enforced by the
 * recipe layer at VM boot, not here. This function only manages the base grammar.
 *
 * @returns the contentHash in use after the call (existing or updated)
 */
export function reconcileGrammarTiddlerIfChanged(
  handle: DocHandle<LarariumDoc>,
): string {
  const grammarPath = join(laresRoot, "memes", GRAMMAR_LARES_REL_PATH);

  if (!existsSync(grammarPath)) {
    const storedHash = handle.doc()?.tiddlers?.[GRAMMAR_MEME_URI]?.contentHash ?? "";
    console.warn("[lararium-grammar] grammar file not found on disk — using CRDT copy");
    return storedHash;
  }

  const grammarText = readFileSync(grammarPath, "utf8");
  const diskHash    = sha256text(grammarText);
  const storedHash  = handle.doc()?.tiddlers?.[GRAMMAR_MEME_URI]?.contentHash ?? "";

  if (diskHash === storedHash) return storedHash;

  seedGrammarTiddler(handle, grammarText, diskHash);
  console.log(`[lararium-grammar] grammar tiddler updated  (was ${storedHash.slice(0, 20)}…)`);
  return diskHash;
}

// ---------------------------------------------------------------------------
// loadGrammarFromStore
// ---------------------------------------------------------------------------

/**
 * Read grammar text from a system MemeStoreDoc handle.
 * Returns null if the grammar tiddler has not been seeded yet.
 *
 * Replaces `loadGrammarRules()` from node-host.web2.ts — runtime MUST read
 * grammar from CRDT, not from disk. Disk is only touched at seed/reconcile time.
 */
export function loadGrammarFromStore(handle: DocHandle<LarariumDoc>): string | null {
  return handle.doc()?.tiddlers?.[GRAMMAR_MEME_URI]?.text ?? null;
}
