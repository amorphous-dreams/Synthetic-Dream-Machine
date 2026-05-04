/**
 * meme-recipe-vm — MemeRecipeVm interface and DirectMemeRecipeVm implementation.
 *
 * Replaces the web2-era RecipeVm (recipe-vm.ts / recipe-vm.web2.ts) with an
 * interface aligned to the FFZ 5-scale causal-island model:
 *
 *   - `loadRecords` REMOVED — MemeProvider projection IS the bulk path.
 *     The VM receives incremental `onUriChanged` calls from MemeProvider;
 *     the provider coalesces CRDT patches per DEBOUNCE_MS.
 *   - `onSyncComplete(islandId)` replaces the old "loadRecords done" signal.
 *     Called once per causal island after initial sync completes (Scale 4).
 *     Made required (not optional) at the MemeRecipeVm layer.
 *   - `renderMeme(uri)` replaces `renderCarrier(uri)`.
 *     Sprint 3c: calls exportMemeText from meme-write.ts.
 *     Sprint 3a stub: delegates to renderTiddler (HTML render pass).
 *   - Worker isolation (DirectMemeRecipeVm vs TW5WorkerProxy) is unchanged.
 *     The factory seam is kept; all call sites are backend-agnostic.
 *
 * Boot sequence (via `bootMemeRecipeVm`):
 *   provider.addProjection(vm) → vm receives incremental deltas from CRDT
 *   vm.onSyncComplete(islandId) → called once when initial sync is done
 *
 * Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/meme-recipe-vm
 */

import type { LarTiddlerChange, MemeProjection, MemeProvider } from "@lararium/core";
import type { TW5Engine } from "./tw5-vm.js";
import { exportMemeText } from "./meme-write.js";

// ---------------------------------------------------------------------------
// MemeRecipeVm — isomorphic interface for a TW5 wiki engine slot in the VmPool
// ---------------------------------------------------------------------------

/**
 * One VM slot per recipe. Two implementations:
 *   `DirectMemeRecipeVm`  — in-process TW5Engine (default; no Worker overhead)
 *   `TW5WorkerProxy`      — Worker Thread / Web Worker (Sprint 6 browser host)
 *
 * Implements MemeProjection so it can be registered directly with MemeProvider.
 */
export interface MemeRecipeVm extends MemeProjection {
  // onUriChanged(change): void  — inherited (required) from MemeProjection
  // onChangeset?(uris, origin)  — inherited (optional) from MemeProjection

  /** Required at this layer — VM slot must handle island sync-complete (Scale 4). */
  onSyncComplete(islandId: string): void;
  /** Run a TW5 wikitext filter expression, return matching titles. */
  filterTiddlers(expr: string): Promise<string[]>;
  /**
   * Render a meme URI to its disk format (memetic-wikitext export).
   * Calls exportMemeText from meme-write.ts — not exportCarrierText.
   * Returns null if the URI is not present or is deleted.
   */
  renderMeme(uri: string): Promise<string | null>;
  /** Release resources. Called by VmPool.release(). */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// DirectMemeRecipeVm — in-process TW5Engine wrapper
// ---------------------------------------------------------------------------

export class DirectMemeRecipeVm implements MemeRecipeVm {
  /**
   * @param vm       - The TW5Engine instance this VM slot wraps.
   * @param bagStack - Optional ordered bag IDs (lowest → highest priority).
   *                   When supplied, `onUriChanged` only loads tiddlers from
   *                   these bags into the engine — giving the VM a recipe-scoped
   *                   view of the corpus.  Tombstones always pass through so
   *                   deletions from any bag are honoured.
   *                   When omitted, all tiddlers pass through (full composite view).
   */
  constructor(
    private readonly vm: TW5Engine,
    private readonly bagStack?: readonly string[],
  ) {}

  /** Full TW5Engine instance — available for admin/debug surfaces only. */
  get tw5(): TW5Engine { return this.vm; }

  onUriChanged(change: LarTiddlerChange): void {
    // Tombstones always pass through — honour deletions regardless of bag origin.
    if (!change.record || change.record.deleted) {
      this.vm.removeTiddler(change.title);
      return;
    }
    // If a bagStack was configured, gate additions/updates to those bags only.
    if (this.bagStack && this.bagStack.length > 0) {
      const bag = change.record.fields?.["bag"] as string | undefined;
      // Skip if tiddler has a bag field that falls outside the configured stack.
      // Tiddlers without a bag field pass through (defensive — should not occur post-M20).
      if (bag && !this.bagStack.includes(bag)) return;

      // Priority-correct conflict resolution (TW5 Bags/Recipes law: highest-priority wins).
      // If the wiki already holds a version of this title from a higher-priority bag,
      // the incoming lower-priority update MUST NOT overwrite it.
      // bagStack ordering: index 0 = lowest, length-1 = highest.
      if (bag) {
        const existingBag = this.vm.getTiddlerField(change.title, "bag");
        if (existingBag && existingBag !== bag) {
          const incomingIdx = this.bagStack.indexOf(bag);
          const existingIdx = this.bagStack.indexOf(existingBag);
          // Both bags are in our stack; skip if the existing version wins.
          if (existingIdx > incomingIdx) return;
        }
      }
    }
    this.vm.setTiddler({
      title: change.record.title,
      ...change.record.fields,
      ...(change.record.text !== undefined ? { text: change.record.text } : {}),
    });
  }

  onSyncComplete(_islandId: string): void {
    // No-op in direct mode — VM is always live.
    // Worker proxy will flush its pending render queue here.
  }

  async filterTiddlers(expr: string): Promise<string[]> {
    return this.vm.filterTiddlers(expr);
  }

  async renderMeme(uri: string): Promise<string | null> {
    try {
      const text = exportMemeText(this.vm, uri);
      return text || null;
    } catch {
      return null;
    }
  }

  dispose(): void {
    this.vm.dispose?.();
  }
}

// ---------------------------------------------------------------------------
// bootMemeRecipeVm — cold-start a VM slot wired to a MemeProvider
// ---------------------------------------------------------------------------

/**
 * Boot a MemeRecipeVm slot and wire it to a MemeProvider.
 *
 * The provider drives all incremental updates (Scale 1–4). No bulk
 * `loadRecords` call — the VM receives deltas as CRDT patches arrive.
 *
 * @param provider   - MemeProvider instance managing the corpus/room doc
 * @param factory    - VM factory; pass `() => new DirectMemeRecipeVm(ltw)` or
 *                     a TW5WorkerProxy factory for Worker isolation (Sprint 6).
 * @returns `{ vm, unsubscribe }` — call `unsubscribe()` to detach the VM from the provider.
 */
export async function bootMemeRecipeVm(
  provider: MemeProvider,
  factory:  () => MemeRecipeVm,
): Promise<{ vm: MemeRecipeVm; unsubscribe: () => void }> {
  const vm = factory();
  const unsubscribe = provider.addProjection(vm);
  return { vm, unsubscribe };
}
