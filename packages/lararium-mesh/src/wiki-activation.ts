/**
 * wiki-activation — the ACTIVATION-ON-REFERENCE capability (a base mesh #has cap).
 *
 * A reference to a wiki grain ACTIVATES it (Orleans virtual-actors: the grain
 * wakes on reference; the caller need not know it slept). The vessel HOLDS this
 * cap; the resolver READS it — so verb routing calls `ensureActive(wikiId)` and
 * only then places the verb, instead of rejecting a cold grain outright. A
 * cold→wela activation is a LOCAL-FIRST act on the vessel's own island (no global
 * now): it heats the grain through the ONE residency collector, which mounts a
 * cold grain (onHydrate → pool.ensureWiki) and enforces the wiki cap (onEvict →
 * pool.unmountWiki the LRU wiki), all single-flight (one sovereign body per stream).
 *
 * ONE cap, a SPECTRUM of grants (the vessel gradient): a resource-rich vessel
 * (node) advertises a high `activationCap` + `keepBudget` (concurrent multi-wiki);
 * a constrained vessel (browser) advertises a minimal grant (the daemon bag always + a
 * small active set), degrading gracefully — the resolver honors whatever grant the
 * vessel carries. The daemon bag's always-there pin holds on every grant level; the faces
 * together MAY keep up to `keepBudget` further wiki grains warm (vessel-resource scaled): each
 * keep belongs to the face that asked, and a full budget refuses by name, never dropping a hold.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/wiki-activation
 */

import type { WikiMountSpec } from "./wiki-recipe.js";

/** The residency collector surface the cap heats a grain through (BagStowage). */
export interface ActivationResidency {
  touch(url: string, grainType?: string): Promise<void>;
  pin(url: string, reason?: string, grainType?: string): Promise<void>;
  unpin(url: string): void;
}

/** The pool surface the cap reads (VesselIslandPoolCore): liveness + spec knowledge,
 *  plus the register-spec shore the unknown-grain resolver teaches through. */
export interface ActivationPool {
  has(wikiId: string): boolean;
  knowsSpec(wikiId: string): boolean;
  registerSpec(wikiId: string, spec: WikiMountSpec, opts?: { pinned?: boolean }): void;
}

/**
 * Resolve a never-opened wiki's mount spec from its recipe/catalog — the UNKNOWN-grain
 * branch of activation-on-reference. The vessel supplies it over the catalog and
 * binding resolver; a refusal names the cause before the caller parks a verb.
 */
export type WikiActivationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly cause: "no-such-bag" | "record-unparsable" | "no-read-grant" | "unmounted"; readonly detail: string };
export type WikiSpecResolution =
  | { readonly ok: true; readonly spec: WikiMountSpec }
  | { readonly ok: false; readonly cause: "no-such-bag" | "record-unparsable" | "no-read-grant"; readonly detail: string };
export type ResolveWikiSpec = (wikiId: string) => Promise<WikiSpecResolution>;

/**
 * The vessel's activation GRANT — the spectrum point this vessel advertises.
 * `activationCap` bounds the concurrent live-wiki set (the collector's `wiki`
 * typeCap); `keepBudget` bounds the wiki grains the faces keep warm BESIDES the daemon bag.
 */
export interface WikiActivationGrant {
  readonly activationCap: number;
  readonly keepBudget:    number;
}

/** The refusal a keep answers when the vessel's budget stands full: no hold moves. */
export type WikiKeepResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly cause: "keep-full" | "no-such-bag" | "record-unparsable" | "no-read-grant" | "unmounted"; readonly detail: string };

export interface WikiActivationCap {
  /**
   * Ensure a wiki grain is live, activating a cold/known grain on reference.
   * Answers success when the grain lives. A refusal carries its cause and leaves
   * no phantom resident; callers can park the verb with that cause.
   */
  ensureActive(wikiId: string): Promise<WikiActivationResult>;
  /**
   * KEEP a wiki warm for one holder (a face, by its ordinal text): the grain stays exempt from collection while any holder
   * keeps it. Activates it first (a keep means nothing on a dead grain), then pins it in the collector. The vessel's
   * `keepBudget` bounds the distinct kept grains: past it the keep REFUSES `keep-full`, naming the holders, and no hold
   * moves, so one face never loses a keep to seat another's. Idempotent for a grain the holder keeps already.
   */
  keep(wikiId: string, holder: string): Promise<WikiKeepResult>;
  /** END one holder's keep on a grain. The grain stays live (a cooling candidate again) once no holder keeps it; a no-op
   *  for a grain the holder never kept. */
  unkeep(wikiId: string, holder: string): void;
  /** END every keep a holder carries: the end of a face's lit life. */
  unkeepAll(holder: string): void;
  /** The wiki grains a holder keeps (every distinct kept grain where no holder names), in the order first kept. */
  kept(holder?: string): readonly string[];
  /** This vessel's advertised grant (the gradient point the resolver honors). */
  readonly grant: WikiActivationGrant;
}

/**
 * Build the activation cap over a residency collector + a pool + the vessel grant.
 * The vessel constructs it once and hands it to the resolver. `resolveSpec` (optional)
 * is the UNKNOWN-grain branch — the true multi-wiki swap; absent → retain-only.
 */
export function makeWikiActivationCap(
  residency: ActivationResidency,
  pool:      ActivationPool,
  grant:     WikiActivationGrant,
  resolveSpec?: ResolveWikiSpec,
): WikiActivationCap {
  // Kept grains (besides the daemon bag): wikiId -> the holders that keep it. The Map's insertion order carries first-kept order.
  const keeps = new Map<string, Set<string>>();
  const kept = (holder?: string): readonly string[] =>
    [...keeps].filter(([, who]) => holder === undefined || who.has(holder)).map(([id]) => id);
  // The refusal names the count and the asker's own keeps alone: another holder's wiki or ordinal never rides it.
  const full = (wikiId: string, holder: string): WikiKeepResult | null => {
    if (keeps.has(wikiId) || keeps.size < grant.keepBudget) return null;
    const own = kept(holder);
    return { ok: false, cause: "keep-full", detail: `the keep budget stands full (${keeps.size}/${grant.keepBudget}); this face keeps ${own.length === 0 ? "none" : own.join(", ")}` };
  };
  const unkeep = (wikiId: string, holder: string): void => {
    const holders = keeps.get(wikiId);
    if (!holders?.delete(holder)) return;
    if (holders.size > 0) return;
    residency.unpin(wikiId);
    keeps.delete(wikiId);
  };

  // The one activation chokepoint — closed over so `keep` and the method share it
  // (destructure-safe: no `this`).
  const ensureActive = async (wikiId: string): Promise<WikiActivationResult> => {
    // Already live → done (cheap, the common case for a pinned/active wiki).
    if (pool.has(wikiId)) return { ok: true };
    // Unknown grain (the pool never mounted it, no retained spec): the true swap
    // RESOLVES its spec from the recipe/catalog and teaches the pool, so a bare
    // reference wakes ANY wiki cold. A genuinely-unknown reference (resolveSpec
    // null, or no resolver under retain-only) refuses cleanly — the caller parks;
    // touching an unresolved grain would strand a phantom resident (wela in the
    // collector, cold in the pool), so we teach-BEFORE-touch or not at all.
    if (!pool.knowsSpec(wikiId)) {
      const resolved = resolveSpec ? await resolveSpec(wikiId) : { ok: false as const, cause: "no-such-bag" as const, detail: wikiId };
      if (!resolved.ok) return resolved;
      pool.registerSpec(wikiId, resolved.spec);   // teach it (no mount) — now knowsSpec
    }
    // Heat the grain through the ONE collector: `touch` marks it wela (its
    // onHydrate mounts the now-known grain via pool.ensureWiki, single-flight) and
    // enforces the wiki cap (onEvict unmounts the LRU wiki). Local-first act.
    await residency.touch(wikiId, "wiki");
    return pool.has(wikiId) ? { ok: true } : { ok: false, cause: "unmounted", detail: wikiId };
  };

  return {
    grant,
    ensureActive,
    async keep(wikiId: string, holder: string): Promise<WikiKeepResult> {
      const before = full(wikiId, holder);
      if (before) return before;
      // A keep means nothing on a dead grain: activate first (resolves + mounts).
      const active = await ensureActive(wikiId);
      if (!active.ok) return active;
      // The budget reads again past the await: a keep that landed meanwhile may have filled it.
      const after = full(wikiId, holder);
      if (after) return after;
      const holders = keeps.get(wikiId) ?? new Set<string>();
      holders.add(holder);
      keeps.set(wikiId, holders);
      await residency.pin(wikiId, "face:keep", "wiki");
      return { ok: true };
    },
    unkeep,
    unkeepAll(holder: string): void {
      for (const wikiId of [...keeps.keys()]) unkeep(wikiId, holder);
    },
    kept,
  };
}
