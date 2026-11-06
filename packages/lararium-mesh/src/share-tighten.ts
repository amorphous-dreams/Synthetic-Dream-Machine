/**
 * share-tighten — the ONE tighten predicate every allowing return of a share verdict passes through, and the
 * production `DeclaredTierSource` it reads (cap-tier#/the-keystone; reach-plane#/the-vault-reads-as-a-bag).
 *
 * A share verdict holds many allowing returns (sibling, same-operator face, walker or contracted hosting, carrier,
 * in-process), and the tier must tighten each one. `capTierShareDecision` tightens relay peers alone and merges
 * fleet with contracted, so it cannot split PERSONAGROUP from CONTRACT. This predicate takes the structural verdict
 * a branch already reached and the AUDIENCE that branch proved, and only ever withdraws it:
 *
 *   · a structural deny stays deny — a tier never resurrects a doc;
 *   · `in-process` stays allowed after the structural checks — the tier never gates the house's own island;
 *   · every other audience crosses a vessel boundary (a same-face sibling reads `fleet`), and the resolved tier
 *     (declared ∧ floor) must hold that audience in its read-cap set;
 *   · a reading that cannot answer — a `SecretsRegistryRefusal`, a declared source that refuses, any throw — reads
 *     as deny, and so does a vessel crossing that names no document (nothing to prove the tier against).
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/cap-tier
 */
import { resolveTierForDoc, parseCapTier, refineBagTierWithTiddlers, type CapTier, type CapTierRing, type DeclaredTierSource } from "./cap-tier.js";
import type { BagManifest } from "./bag-manifest.js";

/**
 * Who a crossing reaches, as the allowing branch PROVED it:
 *   · `in-process` — the vessel's own island (no boundary crossed);
 *   · `fleet`      — a vessel of the operator's own persona fleet (a same-face sibling, a same-operator node);
 *   · `contract`   — a contracted member outside the fleet (a cabal's carrier);
 *   · `world`      — anyone else (a stranger, a walker, an unproven peer).
 */
export type ShareAudience = "in-process" | "fleet" | "contract" | "world";

/** Does a resolved tier's read-cap set hold this audience? VEIL ⊂ PERSONAGROUP ⊂ CONTRACT ⊂ PUBLIC, read per audience. */
export function audiencePermits(tier: CapTier, audience: ShareAudience): boolean {
  switch (audience) {
    case "in-process": return true;
    case "fleet":      return tier !== "veil";
    case "contract":   return tier === "contract" || tier === "public";
    case "world":      return tier === "public";
  }
}

/**
 * tightenShare — withdraw an allowing verdict the resolved tier does not cover. Never allows what `base` denied.
 * The ring stands REQUIRED: a composer with no ring has no tier to tighten by, and an omitted ring must not read
 * as an inert one.
 */
export function tightenShare(base: boolean, documentId: string | undefined, audience: ShareAudience, ring: CapTierRing): boolean {
  if (!base) return false;                      // structural deny stands
  if (audience === "in-process") return true;   // the house's own island, after the structural checks
  if (!documentId) return false;                // a vessel crossing that names no doc proves nothing
  try {
    return audiencePermits(resolveTierForDoc(ring, documentId), audience);
  } catch {
    return false;                               // SecretsRegistryRefusal, DeclaredTierRefusal, any torn reading: deny
  }
}

// ── The production DeclaredTierSource ───────────────────────────────────────────────────────────

/** How a doc binds to its declaration: one bag, or a plane bound EXPLICITLY as no bag (the inert null's one home). */
export type DocBagBinding = { readonly kind: "bag"; readonly bag: string } | { readonly kind: "non-bag" };

/** What the manifest source reads through. A composer over the bag registry and each bag's home supplies them. */
export interface ManifestTierReaders {
  /** The doc's binding; null while the doc resolves to no registered bag (unresolved — refuses). */
  bagOfDoc(documentId: string): DocBagBinding | null;
  /** The bag's manifest (`bagManifestFromMeta` over its root `meta.mem`); null when it cannot read (refuses). */
  manifestOf(bag: string): BagManifest | null;
  /** Every tiddler's raw `capTier` value (undefined where a tiddler declares none); null while incomplete (refuses). */
  tiddlerTiersOf(bag: string): readonly unknown[] | null;
}

export type DeclaredTierReason =
  | "declared-tier-unresolved"
  | "declared-tier-manifest-unread"
  | "declared-tier-manifest-mismatch"
  | "declared-tier-cascade-incomplete";

/** The declaration cannot answer: the predicate reads this as deny. */
export class DeclaredTierRefusal extends Error {
  override readonly name = "DeclaredTierRefusal";
  constructor(readonly reason: DeclaredTierReason, detail: string) { super(`${reason}: ${detail}`); }
}

/**
 * makeManifestTierSource — the declared tier for a doc: its bag's manifest tier met with every PRESENT per-tiddler
 * refinement. An absent refinement adds nothing; a present torn one parses VEIL. An unresolved doc, an unread or
 * mismatched manifest, or an incomplete cascade REFUSES by name; null answers only for a plane bound as no bag.
 */
export function makeManifestTierSource(readers: ManifestTierReaders): DeclaredTierSource {
  return {
    declaredTierForDoc(documentId: string): CapTier | null {
      const binding = readers.bagOfDoc(documentId);
      if (binding === null || (binding.kind === "bag" && !binding.bag)) {
        throw new DeclaredTierRefusal("declared-tier-unresolved", `${documentId} resolves to no registered bag`);
      }
      if (binding.kind === "non-bag") return null;
      const manifest = readers.manifestOf(binding.bag);
      if (manifest === null) throw new DeclaredTierRefusal("declared-tier-manifest-unread", `bag ${binding.bag} holds no readable manifest`);
      if (manifest.bag !== binding.bag) {
        throw new DeclaredTierRefusal("declared-tier-manifest-mismatch", `bag ${binding.bag} reads a manifest naming ${manifest.bag}`);
      }
      const raw = readers.tiddlerTiersOf(binding.bag);
      if (raw === null) throw new DeclaredTierRefusal("declared-tier-cascade-incomplete", `bag ${binding.bag}'s tiddlers have not all read`);
      const refinements = raw.filter((t) => t !== undefined && t !== null).map(parseCapTier);
      return refineBagTierWithTiddlers(manifest.tier, refinements);
    },
  };
}
