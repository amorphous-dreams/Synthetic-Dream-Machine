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
import type { LarariumTW5 } from "./lararium-tw5.js";
import { exportMemeText } from "./meme-write.js";

// ---------------------------------------------------------------------------
// MemeRecipeVm — isomorphic interface for a TW5 wiki engine slot in the VmPool
// ---------------------------------------------------------------------------

/**
 * One VM slot per recipe. Two implementations:
 *   `DirectMemeRecipeVm`  — in-process LarariumTW5 (default; no Worker overhead)
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
// DirectMemeRecipeVm — in-process LarariumTW5 wrapper
// ---------------------------------------------------------------------------

export class DirectMemeRecipeVm implements MemeRecipeVm {
  constructor(private readonly vm: LarariumTW5) {}

  /** Full LarariumTW5 instance — available for admin/debug surfaces only. */
  get tw5(): LarariumTW5 { return this.vm; }

  onUriChanged(change: LarTiddlerChange): void {
    if (!change.record || change.record.deleted) {
      this.vm.removeTiddler(change.title);
    } else {
      this.vm.setTiddler({
        title: change.record.title,
        ...change.record.fields,
        ...(change.record.text !== undefined ? { text: change.record.text } : {}),
      });
    }
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
