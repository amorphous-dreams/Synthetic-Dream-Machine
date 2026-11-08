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
export function tightenShare(base: boolean, documentId: string | undefined, audience: ShareAudience | undefined, ring: CapTierRing,
  onRefusal?: (refusal: Error) => void): boolean {
  if (!base) return false;
  let refusal: Error;
  try {
    if (!audience || !["in-process", "fleet", "contract", "world"].includes(audience)) {
      throw new DeclaredTierRefusal("declared-tier-audience-unresolved", "the asking island proves no audience relation");
    }
    if (audience === "in-process") return true;
    if (!documentId) throw new DeclaredTierRefusal("declared-tier-unresolved", "the crossing names no document");
    const tier = resolveTierForDoc(ring, documentId);
    if (audiencePermits(tier, audience)) return true;
    refusal = new DeclaredTierRefusal("declared-tier-audience", `${documentId}: ${tier} withholds from ${audience}`);
  } catch (error) {
    refusal = error instanceof Error ? error : new DeclaredTierRefusal("declared-tier-reading-refused", String(error));
  }
  onRefusal?.(refusal);
  return false;
}

/**
 * Every production crossing holds this floor: boolean Repo hooks report a name; byte doors throw that same refusal.
 *
 * `carried` names the gate that ALLOWED the crossing (selfSlotFedGate, the sibling gate, the browser's `crossing.gate`,
 * the face-grant ring): the structure that let the document cross is that gate, so the floor reads it in place of the
 * narrower public-board set (`carried` ring). A byte door names no gate (`require`): its floor reads the held ring alone.
 */
export interface ShareBoundary {
  allows(base: boolean, documentId: string | undefined, audience: ShareAudience | undefined, carried?: boolean): boolean;
  require(documentId: string | undefined, audience: ShareAudience | undefined): void;
}

/**
 * The boundary over its two rings: `ring` (the floor as the vessel holds it) and `carried` (the same declaration, floored
 * by the gate that allowed the crossing). A boundary built with one ring reads it for both.
 */
export function makeShareBoundary(ring: CapTierRing, onRefusal: (refusal: Error) => void, carried: CapTierRing = ring): ShareBoundary {
  const decide = (base: boolean, documentId: string | undefined, audience: ShareAudience | undefined, viaGate: boolean, throwing: boolean): boolean => {
    let refusal: Error | undefined;
    const allowed = tightenShare(base, documentId, audience, viaGate ? carried : ring, (error) => { refusal = error; onRefusal(error); });
    if (!allowed && throwing) throw refusal;
    return allowed;
  };
  return {
    allows: (base, documentId, audience, viaGate = false) => decide(base, documentId, audience, viaGate, false),
    require: (documentId, audience) => { decide(true, documentId, audience, false, true); },
  };
}

/**
 * peerShareAudience — the audience a Repo peer PROVES, positively, or undefined (the predicate refuses it by name):
 *   · a sibling the sibling channel proved, on no relay → `fleet`;
 *   · a relay peer the face-grant ring admits for this document → `fleet`;
 *   · a relay peer behind an armed gate → `world`; a relay peer with no gate armed proves nothing;
 *   · a peer the vessel attached for its own islands → `in-process`;
 *   · any other peer proves nothing.
 */
export function peerShareAudience(peer: {
  readonly sibling: boolean; readonly relay: boolean; readonly gateArmed: boolean;
  readonly grantAdmits: boolean; readonly houseIsland: boolean;
}): ShareAudience | undefined {
  if (peer.sibling) return peer.relay ? undefined : "fleet";
  if (peer.relay) return !peer.gateArmed ? undefined : peer.grantAdmits ? "fleet" : "world";
  return peer.houseIsland ? "in-process" : undefined;
}

// ── The production DeclaredTierSource ───────────────────────────────────────────────────────────

/** How a doc binds to its declaration: one bag, or a plane bound EXPLICITLY as no bag, carrying the tier it declares. */
export type DocBagBinding = { readonly kind: "bag"; readonly bag: string } | { readonly kind: "non-bag"; readonly tier: CapTier };

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
  | "declared-tier-audience"
  | "declared-tier-audience-unresolved"
  | "declared-tier-reading-refused"
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
 * mismatched manifest, or an incomplete cascade REFUSES by name; a plane bound as no bag answers the tier it declares.
 */
export function makeManifestTierSource(readers: ManifestTierReaders): DeclaredTierSource {
  return {
    declaredTierForDoc(documentId: string): CapTier | null {
      const binding = readers.bagOfDoc(documentId);
      if (binding === null || (binding.kind === "bag" && !binding.bag)) {
        throw new DeclaredTierRefusal("declared-tier-unresolved", `${documentId} resolves to no registered bag`);
      }
      if (binding.kind === "non-bag") {
        if (!["veil", "personagroup", "contract", "public"].includes(binding.tier)) {
          throw new DeclaredTierRefusal("declared-tier-unresolved", `${documentId} binds as no bag and declares no tier`);
        }
        return binding.tier;
      }
      const manifest = readers.manifestOf(binding.bag);
      if (manifest === null) throw new DeclaredTierRefusal("declared-tier-manifest-unread", `bag ${binding.bag} holds no readable manifest`);
      if (manifest.bag !== binding.bag) {
        throw new DeclaredTierRefusal("declared-tier-manifest-mismatch", `bag ${binding.bag} reads a manifest naming ${manifest.bag}`);
      }
      const raw = readers.tiddlerTiersOf(binding.bag);
      if (raw === null) throw new DeclaredTierRefusal("declared-tier-cascade-incomplete", `bag ${binding.bag}'s tiddlers have not all read`);
      // Only `undefined` reads absent: a present `null` names a torn refinement, and parses VEIL.
      const refinements = raw.filter((t) => t !== undefined).map(parseCapTier);
      return refineBagTierWithTiddlers(manifest.tier, refinements);
    },
  };
}
