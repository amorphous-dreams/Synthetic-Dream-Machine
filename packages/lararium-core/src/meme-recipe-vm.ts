/**
 * MemeRecipeVm — isomorphic interface for a TW5 wiki engine slot in the VmPool.
 *
 * Lives in @lararium/core so both @lararium/node and @dreamdeck/app can type
 * against it without a @lararium/tw5 dependency.
 *
 * Two implementations in @lararium/tw5:
 *   DirectMemeRecipeVm — in-process TW5Engine wrapper (default; no Worker overhead)
 *   TW5WorkerProxy     — Worker Thread (node) or Web Worker (browser), constructed
 *                        with a platform-supplied workerFactory
 *
 * Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/meme-recipe-vm
 */

import type { MemeProjection } from "./meme-provider.js";

/**
 * One VM slot per recipe in the VmPool.
 * Implements MemeProjection so it registers directly with MemeProvider.
 */
export interface MemeRecipeVm extends MemeProjection {
  // onUriChanged(change): void  — inherited (required) from MemeProjection
  // onChangeset?(uris, origin)  — inherited (optional) from MemeProjection

  /** VM slot must handle island sync-complete (Scale 4). */
  onSyncComplete(islandId: string): void;
  /** Run a TW5 wikitext filter expression, return matching titles. */
  filterTiddlers(expr: string): Promise<string[]>;
  /**
   * Render a meme URI to its disk format (memetic-wikitext export).
   * Returns null if the URI is not present or is deleted.
   */
  renderMeme(uri: string): Promise<string | null>;
  /** Release resources. Called by VmPool.release(). */
  dispose(): void;
}
