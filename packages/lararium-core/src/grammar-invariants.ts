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
 * Invariant 3 — Grammar travels in the genesis artifact:  (@phase: S2 — declared now; implemented Sprint 2)
 *   The grammar meme travels as an ordinary tiddler inside genesis/island.bin —
 *   an Automerge.save() binary embedded in the bundle at build time. No peer
 *   reads grammar from any filesystem path at runtime. At boot, repo.import(genesisBytes)
 *   hydrates the full engine doc; the grammar tiddler is present with its sealed
 *   content-hash. A peer whose genesis binary is absent or whose grammar tiddler
 *   hash diverges from the sealed root MUST halt rather than fall back to any
 *   local filesystem source.
 *
 *   Grammar version bump = new genesis binary with a new artifact root. No in-place
 *   upgrade path exists until Keyhive provides signed migration receipts
 *   (Invariant 6). Code that assumes the current grammar hash is permanent will
 *   break on version bump; plan for this before S2 ships.
 *
 *   Transitional state (pre-S2): the node peer reads lares/grammars/memetic-wikitext.md
 *   at cold-boot with BOOTSTRAP_SCANS, seeds the engine doc, then treats CRDT as
 *   authoritative. Named exception: CODEC_EX_PRE_S2_COLD_BOOT in
 *   system-invariants.ts. It disappears when build-genesis-island.ts ships.
 *   See GRAMMAR_GENESIS_REL_PATH — marked @remove: S2.
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
  "lar:///ha.ka.ba/@lares/grammars/memetic-wikitext" as const;

/**
 * The bag in which the base grammar tiddler lives in the engine Automerge doc.
 * Must equal LARARIUM_DOC_URI (lowest-priority bag) so room tiddlers can shadow it (Invariant 4).
 */
export { LARARIUM_DOC_URI as GRAMMAR_BAG } from "./lararium-doc.js";

/**
 * Relative path of the grammar genesis artifact within the lares/ directory.
 * Used only during cold-boot seeding (Invariant 3). Not read at runtime.
 */
export const GRAMMAR_GENESIS_REL_PATH = "grammars/memetic-wikitext.md" as const;

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
