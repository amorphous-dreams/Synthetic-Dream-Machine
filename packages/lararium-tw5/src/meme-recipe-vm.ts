/**
 * meme-recipe-vm — DirectMemeRecipeVm and bootMemeRecipeVm.
 *
 * MemeRecipeVm interface lives in @lararium/core (meme-recipe-vm.ts) so both
 * @lararium/node and @lararium/app can type against it without pulling in TW5.
 *
 * DirectMemeRecipeVm — in-process TW5Engine wrapper (no Worker overhead).
 * TW5WorkerProxy     — Worker-backed implementation; lives in tw5-worker-proxy.ts.
 *                      Platform supplies the workerFactory at construction time.
 */

import type { LarTiddlerChange, MemeProvider, MemeRecipeVm } from "@lararium/core";
import type { TW5Engine } from "./tw5-vm.js";
import { exportMemeText } from "./meme-write.js";

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
