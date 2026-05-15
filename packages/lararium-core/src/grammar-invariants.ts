/**
 * grammar-invariants — hard constraints on the memetic-wikitext grammar meme.
 *
 * This file documents non-negotiable invariants that any agent, operator, or
 * build tool MUST uphold when reading, writing, or seeding the grammar meme.
 * No runtime code lives here — only types and doc-comments.
 *
 * Invariant 1 — BOOTSTRAP parseable:
 *   The grammar meme text at lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext
 *   MUST be fully parseable by BOOTSTRAP_SCANS alone (no loaded GrammarRules).
 *   Non-negotiable: the grammar meme defines the rules that parse itself;
 *   if it uses a custom sigil from those rules, an infinite regress results.
 *   Allowed structural elements: ahu, pranala, toml fences, loulou, aka, SOH/STX/ETX/EOT.
 *   FORBIDDEN: any sigil registered by the grammar meme itself.
 *
 * Invariant 2 — System-bag tiddler, raw carrier text, not deserialized fragments:
 *   The grammar meme lives as a memetic-wikitext tiddler in the 'system' bag of
 *   the LarariumDoc (engine Automerge document). It does NOT live as a binary blob
 *   in LarariumDoc.blobs. Binary blobs serve large, immutable, non-parseable
 *   assets (TW5 core JS, plugin bundles). The grammar meme text stays small, mutable
 *   across versions, and must remain human-readable and diff-able.
 *
 *   The grammar tiddler stores raw carrier text in its .text field — it functions as
 *   the deliberate exception to the "meme files deserialize into fragment tiddlers" law.
 *   Reason: grammarRulesFromText() must walk the carrier AST (collecting toml
 *   SigilNodes) via BOOTSTRAP_SCANS. Storing pre-deserialized fragment tiddlers
 *   would require deserializeCarrier() to run first — which needs the grammar —
 *   closing the bootstrap circle. Raw carrier text + BOOTSTRAP_SCANS breaks the
 *   circle. Path β (fragment tiddler storage) was evaluated and rejected: moving
 *   deserialization earlier in boot tightens, not relaxes, the dependency.
 *
 * Invariant 3 — Grammar travels inside the compiled plugin blob in genesis:
 *   The grammar meme lives as a shadow tiddler inside the compiled plugin
 *   (`lar:///plugins/lares/memetic-wikitext`), which travels in genesis/island.bin
 *   as a blob entry. No peer reads grammar from any filesystem path at runtime.
 *   At boot, TW5 loads the plugin; the grammar tiddler is available immediately
 *   as a shadow tiddler via `$tw.wiki.getTiddlerText(GRAMMAR_MEME_URI)`.
 *
 *   Invariant 4 (operator shadow-override) is satisfied automatically by TW5's
 *   shadow tiddler resolution: any tiddler at GRAMMAR_MEME_URI in a higher-
 *   priority bag shadows the plugin shadow, extending the grammar vocabulary
 *   without modifying the plugin artifact.
 *
 *   Grammar version bump = plugin rebuild + genesis rebuild. No in-place upgrade
 *   path exists until Keyhive provides signed migration receipts (Invariant 6).
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
 *   at other URIs and merge with the base at parse time. The base URI anchors
 *   BOOTSTRAP_SCANS-level trust.
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
 * This URI anchors Invariant 1 trust.
 */
export const GRAMMAR_MEME_URI =
  "lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext" as const;

/**
 * The bag in which the base grammar tiddler lives in the engine Automerge doc.
 * Must equal LARARIUM_DOC_URI (lowest-priority bag) so room tiddlers can shadow it (Invariant 4).
 */
export { LARARIUM_DOC_URI as GRAMMAR_BAG } from "./lararium-doc.js";

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
