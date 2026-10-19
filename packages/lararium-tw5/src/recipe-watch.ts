/**
 * recipe-watch — island-side LIVE composition reconcile (isomorphic).
 *
 * The composition class of change (recipe bag membership, oracle doc-URL
 * moves) rides ordinary sync — so a running island can reconcile it without
 * a reboot. This watch subscribes to the `catalog` registry doc (access≠load:
 * watched, never rendered), reads the island's OWN recipe record, and applies
 * the diff to its own composite:
 *
 *   - bag added to the recipe   → resolve through its registry plane, insert the
 *     layer above the lares bag (library position), replay its content into the wiki.
 *   - bag removed               → removeLayerLive: departed titles tombstone,
 *     unshadowed lower records resurface (no reboot).
 *   - registry URL moved        → resolve the new doc before removing the old
 *     layer; an unresolved pointer leaves the old layer and handle in place.
 *     A resolved doc swaps in at the same cascade position and replays.
 *   - system wiki's own canon  → hold its mounted handle when the shared
 *     oracle plane names another URL; the island's grant anchors that canon.
 *
 * Pono: the daemon never reaches in — it writes the catalog and each island
 * reconciles itself. After a successful reconcile the island clears its own
 * reboot-pending alert (temp): the alert remains the FALLBACK for islands
 * that sleep through the change; the engine-epoch class keeps the alert as
 * its permanent mechanism (see engine-watch — code never live-swaps).
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/recipe-watch
 */

import {
  AutomergeDocStore,
  LARES_BAG,
  ORACLE_BAG,
  SYSTEM_BAGS,
  structuralSlots,
  slotLayerFlags,
  wikiBagUri,
  wikiSlotUri,
  bagStackFromRec,
  type ChangeOrigin,
  type DocHandle,
  type LarDoc,
  type LarTiddlerRecord,
} from "@lararium/mesh";
import { makeCatalogAccessor, findOrThrow } from "./catalog-accessor.js";
import { effectiveRecipe } from "./recipe-planes.js";
import { REBOOT_ALERT_TITLE } from "./wiki-behavior.js";
import type { IslandContext } from "./island-context.js";

/**
 * startRecipeWatch — subscribe to the catalog registry; reconcile this island's mounted
 * layer set against its live recipe record. Returns a cleanup for onHooAnu,
 * or undefined when the island carries no catalog access.
 */
export async function startRecipeWatch(ctx: IslandContext): Promise<(() => void) | undefined> {
  // A mounted island never hot-swaps: a session surface lays the recipe the one resolver returned at its
  // mount, and a recipe written later reaches the next mount. No watch stands over a resolved mount.
  if (ctx.resolvedMount) return undefined;
  if (!ctx.catalogUrl && !ctx.oracleUrl) return undefined;
  const slug        = ctx.recipe.wikiSlug;

  // Two registry planes (wiki-layer-ontology#oracle-planes):
  // the oracle SYSTEM plane carries system-bag pointers + system wiki-recipes
  // (lares, lararium) as DEFAULTS; the catalog registry carries USER bags and the vessel's own
  // recipes. System bags resolve from the oracle plane.
  const catalog   = ctx.catalogUrl ? makeCatalogAccessor(ctx.repo, ctx.catalogUrl) : null;
  const sysPlane  = ctx.oracleUrl  ? makeCatalogAccessor(ctx.repo, ctx.oracleUrl)  : null;
  const catHandle = catalog ? await catalog.handle() : null;
  const sysHandle = sysPlane ? await sysPlane.handle() : null;

  // System bags resolve from the oracle plane; everything else from the catalog registry.
  const urlOfBag = async (bagId: string): Promise<string | null> =>
    (SYSTEM_BAGS.has(bagId) && sysPlane) ? sysPlane.urlOf(bagId) : (catalog ? catalog.urlOf(bagId) : null);

  // The island's own recipe record, through the one reader every site shares: the vessel's own
  // composition (catalog) shadows a system wiki's default (oracle), the same two planes, own first.
  const loadRecipeRec = (): LarTiddlerRecord | undefined =>
    effectiveRecipe(slug, (plane, title) =>
      (plane === "oracle" ? sysHandle : catHandle)?.doc()?.tiddlers?.[title],
    )?.record;

  // Slots the recipe model owns structurally (`structuralSlots` — the ONE spelling the record
  // minters and `recipeFromRecord` read too) — everything else in the cascade counts as a library
  // bag for membership reconcile. The four instance slots are per-(PersonaGroup×fingerprint) GRANT
  // slots threaded through the manifest, never named in a recipe's bag-stack — exempt, else this
  // reconcile evicts the live write layer buildIslandRecipe just mounted (the OCI
  // writable-upper-layer law: keep the scratch layer out of the membership diff). The wiki's OWN
  // canon and the oracle floor are structural too. The lares bag is a LIBRARY like the lararium
  // bag: a record that names it mounts it, one that does not, does not.
  const structural = structuralSlots(slug);

  const origin = (): ChangeOrigin =>
    ({ kind: "canon-hydrate", receipt: `recipe-watch:${slug}` });

  // A document that cannot resolve leaves the current composition intact.
  // A later change event can kick another reconcile.
  const resolveBag = async (bagId: string, docUrl: string): Promise<DocHandle<LarDoc> | null> => {
    try {
      return await findOrThrow(ctx.repo, docUrl, `bag ${bagId}`);
    } catch (err) {
      ctx.post({
        type: "event", wikiUri: ctx.wikiUri,
        listenable: "recipe-watch:bag-unresolved",
        payload: { bagId, docUrl, reason: String(err) },
      });
      return null;
    }
  };

  const layAt = (bagId: string, handle: DocHandle<LarDoc>, at: number): void => {
    const store = new AutomergeDocStore(handle, bagId);
    ctx.composite.addLayer({ bagId, store, ...slotLayerFlags(bagId, slug) }, at);
    ctx.handles.set(bagId, handle);
    store.emitInitialReplay();
    store.markSyncComplete();
  };

  const mountAt = async (bagId: string, docUrl: string, at: number): Promise<boolean> => {
    const handle = await resolveBag(bagId, docUrl);
    if (!handle) return false;
    layAt(bagId, handle, at);
    return true;
  };

  /** Library bags insert above the lares bag, below the wiki bag. */
  const libraryInsertIndex = (): number => {
    const lares = ctx.composite.layerIndexOf(LARES_BAG);
    if (lares !== -1) return lares + 1;
    const lararium = ctx.composite.layerIndexOf(ORACLE_BAG);
    return lararium === -1 ? 0 : lararium + 1;
  };

  let busy = false;
  let rerun = false;
  // Each held or kept move speaks once per (bag, named url), so a pointer that stays moved across many reconciles
  // leaves one line in the vessel log, never one per change event.
  const heldOwnCanonUrls = new Set<string>();
  const keptMoves = new Set<string>();

  const reconcile = async (): Promise<void> => {
    const rec = loadRecipeRec();
    if (!rec) return;   // no recipe registered (e.g. the daemon island) — idle
    let applied = false;

    // ── membership: library bags ──
    const desired = new Set(bagStackFromRec(rec).filter((uri) => !structural.has(uri)));
    const mounted = new Set(ctx.composite.layerIds.filter((uri) => !structural.has(uri)));

    for (const bagId of mounted) {
      if (desired.has(bagId)) continue;
      await ctx.composite.removeLayerLive(bagId);
      ctx.handles.delete(bagId);
      applied = true;
    }
    for (const bagId of desired) {
      if (ctx.composite.hasBag(bagId)) continue;
      const docUrl = await urlOfBag(bagId);
      if (!docUrl) continue;   // unregistered — the daemon's alert stays the fallback
      if (await mountAt(bagId, docUrl, libraryInsertIndex())) applied = true;
    }

    // ── registry moves: resolve first, then swap the mounted CRDT slot ──
    const tempBag = wikiSlotUri(slug, "temp");
    for (const bagId of ctx.composite.layerIds) {
      if (bagId === tempBag) continue;
      const current = ctx.handles.get(bagId)?.url;
      if (!current) continue;
      const docUrl = await urlOfBag(bagId);
      if (!docUrl || docUrl === current) continue;
      if (bagId === wikiBagUri(slug) && SYSTEM_BAGS.has(bagId) && sysPlane) {
        if (!heldOwnCanonUrls.has(docUrl)) {
          console.log(`[recipe-watch] ${slug}: layer ${bagId} held at ${current}; the shared plane names ${docUrl}`);
          heldOwnCanonUrls.add(docUrl);
        }
        continue;
      }
      const handle = await resolveBag(bagId, docUrl);
      if (!handle) {
        const kept = `${bagId} ${docUrl}`;
        if (!keptMoves.has(kept)) {
          console.log(`[recipe-watch] ${slug}: layer ${bagId} kept at ${current}; ${docUrl} unresolved`);
          keptMoves.add(kept);
        }
        continue;
      }
      const at = ctx.composite.layerIndexOf(bagId);
      await ctx.composite.removeLayerLive(bagId);
      layAt(bagId, handle, at);
      console.log(`[recipe-watch] ${slug}: layer ${bagId} moved ${current} -> ${docUrl}`);
      applied = true;
    }

    // The change just applied live — the reboot-pending notice (if the daemon's
    // alert verb raced ahead of this reconcile) no longer holds.
    if (applied && ctx.composite.hasWritableBag(tempBag)) {
      await ctx.composite.tombstoneInBag(tempBag, REBOOT_ALERT_TITLE, origin());
    }
  };

  // Serialize: one reconcile at a time; a change arriving mid-run queues one rerun.
  const kick = (): void => {
    if (busy) { rerun = true; return; }
    busy = true;
    void (async () => {
      try {
        do { rerun = false; await reconcile(); } while (rerun);
      } finally {
        busy = false;
      }
    })();
  };

  const onChange = (): void => kick();
  catHandle?.on("change", onChange);
  sysHandle?.on("change", onChange);
  kick();   // catch up on anything that moved while the island booted
  return () => { catHandle?.off("change", onChange); sysHandle?.off("change", onChange); };
}
