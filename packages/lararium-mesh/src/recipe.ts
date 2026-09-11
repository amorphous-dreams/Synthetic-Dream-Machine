/**
 * recipe — recipe-record helpers + URI helpers for Lares recipe tiddlers.
 *
 * Canonical home: @lararium/mesh.
 * Public face: @lararium/tw5 re-exports this module as the operator-facing surface.
 *
 * A recipe tiddler functions as a first-class tiddler stored inside a root doc (typically
 * LarariumDoc or CatalogDoc) that describes an ordered bag stack for a TW5 VM.
 * Recipes bridge the static Automerge doc topology and the dynamic
 * TW5 FilterRecipe evaluation surface.
 *
 * Recipe tiddler addressing:
 *   recipeUri("lararium", "default")  → "lar:///ha.ka.ba/lararium/recipes/default"
 *   recipeUri("catalog",  "elyncia")  → "lar:///ha.ka.ba/bags/catalog/recipes/elyncia"
 *
 * Bag stack order: lowest-priority first → highest-priority last (TW5 convention).
 * Each entry in `bag-stack` is a well-known lar: bag ID (a root doc URI or corpusLarUri).
 *
 * Genesis seeds NO recipes — user recipes live in the user's catalog registry,
 * minted per-wiki by init-wiki. The lararium bag stays pure protocol substrate.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/recipe
 */

// ---------------------------------------------------------------------------
// BagTiddler — bag descriptor stored in the ha island (one per root-doc bag)
//
// TW5 Bags and Recipes model: "bags have access controls that determine which
// users can read or write to them."  BagTiddler makes those policies first-class
// tiddlers rather than ephemeral runtime flags.
//
// Policy values (open-ended string; enforced by the authority layer):
//   "public"          — any peer may read / write
//   "private"         — owning operator only
//   "group:{uri}"     — members of the group at lar: uri
//
// Self-describing: each root-doc bag carries its own descriptor tiddler inside
// the ha island.  Corpus / wiki bags seed their own descriptor inside their doc.
//
// Meme: lar:///ha.ka.ba/lararium/mesh/bag
// ---------------------------------------------------------------------------

export interface BagTiddler {
  /** Stable lar: URI of the bag this tiddler describes (= the bag's Automerge doc). */
  readonly title:       string;
  /** Human-readable label for UI display. */
  readonly label:       string;
  /** Read-access policy expression. Default: "public". */
  readonly readPolicy:  string;
  /** Write-access policy expression. Default: "private" for root docs; "public" for wiki draft bags. */
  readonly writePolicy: string;
  /**
   * The bag's DECLARED cap-tier — the SELF-DESCRIBING sharing-posture datum the quine speaks (cap-tier.ts).
   * ONE question, WHO holds the read-cap, as the chain VEIL ⊂ PERSONAGROUP ⊂ CONTRACT ⊂ PUBLIC. This datum
   * only DECLARES; the federation gate ENFORCES `declared ∧ structural-floor` (`capTierShareDecision`), so a
   * bag may only ever self-TIGHTEN below its crypto floor — a declared PUBLIC on a sealed-floor bag resolves
   * to the sealed tier, never PUBLIC. Absent / torn → VEIL (fail-closed; `parseCapTier`). A per-tiddler
   * refinement (a tiddler's own `capTier` field) may tighten a bag further via the taint-meet, never loosen
   * it. This is the bag-level DEFAULT the recipe surface carries.
   */
  readonly capTier?:    import("./cap-tier.js").CapTier;
  /** ISO 8601 creation / last-update timestamp. */
  readonly updatedAt:   string;
  /** Authority that created this descriptor. */
  readonly authority:   string;
  /** Owning bag (ha island for root-doc descriptors). */
  readonly bag:         string;
}

export { bagDescriptorUri } from "./lar-uris.js";

import type { LarTiddlerRecord } from "./tiddler-store.js";
import { bagStackFromRec } from "./bag-stack-from-rec.js";

// ---------------------------------------------------------------------------
// URI helpers
// ---------------------------------------------------------------------------

export { recipeUri } from "./lar-uris.js";

export { parseBagStack } from "./bag-stack-from-rec.js";

/**
 * The designated writable bag a recipe record names: `writable-bag`, else the top of its
 * `bag-stack`. Throws when the record names neither — a recipe with no bag to write is a torn record,
 * never a default.
 */
export function designatedBagOf(rec: LarTiddlerRecord, label = rec.tiddler.title): string {
  const declared = rec.tiddler["writable-bag"];
  if (typeof declared === "string" && declared) return declared;
  const stack = bagStackFromRec(rec);
  const top = stack[stack.length - 1];
  if (!top) throw new Error(`recipe "${label}" names no writable bag and an empty bag-stack`);
  return top;
}
