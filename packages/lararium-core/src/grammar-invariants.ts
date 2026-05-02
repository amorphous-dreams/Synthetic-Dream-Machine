/**
 * grammar-invariants — hard constraints on the memetic-wikitext grammar meme.
 *
 * This file documents non-negotiable invariants that any agent, operator, or
 * build tool MUST uphold when reading, writing, or seeding the grammar meme.
 * No runtime code lives here — only types and doc-comments.
 *
 * Invariant 1 — BOOTSTRAP parseable:
 *   The grammar meme text at lar:///ha.ka.ba/@lares/grammars/memetic-wikitext
 *   MUST be fully parseable by BOOTSTRAP_SCANS alone (no loaded GrammarRules).
 *   This is non-negotiable: the grammar meme defines the rules that parse itself;
 *   if it uses a custom sigil from those rules, an infinite regress results.
 *   Allowed structural elements: ahu, pranala, toml fences, loulou, aka, SOH/STX/ETX/EOT.
 *   FORBIDDEN: any sigil registered by the grammar meme itself.
 *
 * Invariant 2 — System-bag tiddler, not a blob:
 *   The grammar meme lives as a memetic-wikitext tiddler in the 'system' bag of
 *   the LarariumDoc (engine Automerge document). It is NOT stored as a binary blob
 *   in LarariumDoc.blobs. Binary blobs are for large, immutable, non-parseable
 *   assets (TW5 core JS, plugin bundles). The grammar meme text is small, mutable
 *   across versions, and must remain human-readable and diff-able.
 *
 * Invariant 3 — Seeded at server start, from lares/:
 *   The canonical source of truth is lares/grammars/memetic-wikitext.md (filesystem).
 *   At server start, the host reads this file using BOOTSTRAP_SCANS, computes a
 *   SHA-256 contentHash, and writes/updates the system tiddler in the engine doc
 *   if the contentHash has changed. Runtime always reads from the engine doc (CRDT),
 *   never from the filesystem after boot.
 *
 * Invariant 4 — Operator shadow-override via bag priority:
 *   Operators may extend or override grammar rules by creating a tiddler at the
 *   same URI in the room doc. The bag priority (system < corpus < room) makes
 *   the room tiddler shadow the system tiddler in TW5's tiddler resolution.
 *   This uses TW5's own shadow tiddler mechanism — no special Lararium logic needed.
 *   Risk: overrides that violate Invariant 1 (using a custom sigil in the grammar
 *   meme text itself) cause bootstrap failure at next VM boot. Operators accept this.
 *
 * Invariant 5 — Single source per Automerge doc:
 *   Each LarariumDoc contains exactly one grammar tiddler for the base grammar.
 *   Additional grammar memes (extension grammars, domain vocabularies) MAY live
 *   at other URIs and are merged with the base at parse time. The base URI is
 *   the sole anchor for BOOTSTRAP_SCANS-level trust.
 *
 * Invariant 6 — Version gate stub (Keyhive):
 *   When Keyhive lands, grammar meme changes to the engine doc MUST be signed
 *   by a threshold of group members. The KumuGrammarVersionGate type below names
 *   this seam. No runtime path calls it yet.
 *
 * Invariant 7 — Upgrade path:
 *   Radical grammar changes (breaking existing meme syntax) require clearing the
 *   Automerge doc store on disk (cold boot to void state). A versioned upgrade
 *   system is deferred until Keyhive integration provides signed migration receipts.
 *   For now: delete the store directory and re-seed.
 */

/**
 * The canonical URI of the base memetic-wikitext grammar meme.
 * This URI is the single anchor for Invariant 1 trust.
 */
export const GRAMMAR_MEME_URI =
  "lar:///ha.ka.ba/@lares/grammars/memetic-wikitext" as const;

/**
 * The bag in which the base grammar tiddler lives in the engine Automerge doc.
 * Must be "system" (lowest priority bag) so room tiddlers can shadow it (Invariant 4).
 */
export const GRAMMAR_BAG = "system" as const;

/**
 * Relative path of the grammar meme source within the lares/memes/ directory.
 * Used by the server-side seeder to locate the file on the filesystem.
 */
export const GRAMMAR_LARES_REL_PATH = "grammars/memetic-wikitext.md" as const;

// ---------------------------------------------------------------------------
// Version gate stub — Keyhive (Invariant 6)
//
// Leave this type here as an aiming point for future Keyhive integration.
// No runtime code should import or use this until Keyhive lands.
// ---------------------------------------------------------------------------

/** @keyhive-stub — no runtime path. Placeholder for signed grammar version proofs. */
export interface GrammarVersionGate {
  /** URI of the grammar meme whose update this gate approves. */
  readonly grammarUri:      typeof GRAMMAR_MEME_URI;
  /** New contentHash (SHA-256 hex) of the updated grammar text. */
  readonly newContentHash:  string;
  /** Previous contentHash this update supersedes. */
  readonly prevContentHash: string;
  /** Keyhive group ID that owns grammar write authority. */
  readonly keyhiveGroupId:  string;
  /** Epoch of the Keyhive membership graph at time of signing. */
  readonly epochAt:         string;
  /** Threshold of member signatures required to accept this update. */
  readonly thresholdMet:    number;
}
