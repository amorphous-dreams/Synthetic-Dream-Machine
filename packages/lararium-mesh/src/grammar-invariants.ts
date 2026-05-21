/**
 * grammar-invariants — hard constraints on the memetic-wikitext grammar system.
 *
 * No runtime code lives here — only constants, types, and doc-comments.
 *
 * Invariant 1 — Grammar fully self-hosted via SharktoothSigil tiddlers:
 *   Every sigil and family rule carries as a tiddler tagged
 *   `lar:///ha.ka.ba/tags/SharktoothSigil`. `grammar-cache.ts` reads this tag
 *   exclusively. No TOML monolith, no fallback parse path.
 *   Adding a sigil = tagging a tiddler. No code change required.
 *
 * Invariant 2 — GRAMMAR_TAG as the single registration surface:
 *   `lar:///ha.ka.ba/tags/SharktoothSigil` owns the grammar namespace.
 *   Lives in `lar://` space — operator-extensible, federated with the wiki,
 *   readable by any peer holding the `ha.ka.ba` bag.
 *   Writable by any operator with bag write access: language extension requires
 *   no authority beyond bag membership.
 *
 * Invariant 3 — SharktoothSigil tiddlers travel inside the compiled plugin:
 *   All sigil tiddlers live in `packages/lararium-tw5/tiddlers/sigil-*.tid`.
 *   The build packs them into the plugin at `lar:///plugins/lares/memetic-wikitext`.
 *   The plugin travels in genesis/island.bin. No peer reads grammar from disk at runtime.
 *
 * Invariant 4 — Operator grammar extension via bag priority:
 *   Operators extend grammar by adding SharktoothSigil-tagged tiddlers in a
 *   higher-priority bag (wiki > corpus > system). No modification of the plugin
 *   artifact required. TW5's tiddler resolution handles precedence automatically.
 *
 * Invariant 5 — BOOTSTRAP_SCANS cover base structural sigils:
 *   `ahu`, `pranala`, `toml`, `loulou`, `aka` must remain in BOOTSTRAP_SCANS
 *   (grammar-invariants.ts → ast.ts) as well as in SharktoothSigil tiddlers.
 *   BOOTSTRAP_SCANS handle the cold-boot window before TW5 and the grammar
 *   startup module have initialized.
 *
 * Invariant 6 — Grammar version bump = plugin rebuild + genesis rebuild:
 *   Changing a sigil rule requires: rebuild plugin (`build:plugin`), rebuild
 *   genesis (`build:genesis`). No in-place upgrade path exists until Keyhive
 *   provides signed migration receipts.
 */

/** Canonical tag URI for SharktoothSigil grammar tiddlers. */
export const GRAMMAR_TAG =
  "lar:///ha.ka.ba/tags/SharktoothSigil" as const;

/**
 * The bag in which system-level SharktoothSigil tiddlers live (plugin shadow bag).
 * Higher-priority bags (wiki, corpus) extend the grammar without touching this.
 */
export { LARARIUM_DOC_URI as GRAMMAR_BAG } from "./lar-uris.js";
