/**
 * @deprecated web2-era — RecipeVm imports exportCarrierText from carrier-write.
 * Do NOT add new exports here.
 *
 * Principles worth keeping in the new model:
 *   - RecipeVm interface is the right abstraction: one VM slot per recipe,
 *     opaque to callers (DirectRecipeVm vs TW5WorkerProxy are interchangeable).
 *     FFZ-aligned: the VM pool IS the causal-island execution boundary.
 *   - renderCarrier(uri): disk export reconstructs definition form from the
 *     live wiki via a TW5 render pass ("lar-render-mode": "carrier").
 *     This is correct — the wiki is authoritative, disk is a projection.
 *   - Worker isolation model (Node Worker Thread / Web Worker) is right.
 *     $tw global sharing is the web2 problem; Worker boundary solves it.
 *
 * Rebuild target: meme-recipe-vm.ts — same interface, same Worker model,
 *   renderMeme(uri) calls exportMemeText (not exportCarrierText) from meme-write.ts.
 *
 * RecipeVm — isomorphic interface for a TW5 wiki engine slot in the VmPool.
 *
 * Every projection surface goes through a RecipeVm:
 *   filter queries  → filterTiddlers(expr)
 *   disk renders    → renderCarrier(uri)
 *   store sync      → setTiddler / removeTiddler / loadRecords
 *
 * Two implementations:
 *   DirectRecipeVm    — in-process LarariumTW5 (current default; Node isolation free)
 *   TW5WorkerProxy    — Worker Thread (Node) / Web Worker (browser); solves $tw global
 *                       sharing on browser, enables parallel renders
 *
 * The VmPool factory is the only place that decides which backend runs.
 * All call sites are identical regardless of backend.
 */

import type { LarariumTW5 } from "./lararium-tw5.js";
import { exportCarrierText } from "./carrier-write.js";

// ---------------------------------------------------------------------------
// Serialized record — crosses the Worker message boundary
// ---------------------------------------------------------------------------

export interface SerializedRecord {
  title:  string;
  fields: Record<string, string | string[]>;
  text?:  string;
}

// ---------------------------------------------------------------------------
// RecipeVm interface
// ---------------------------------------------------------------------------

export interface RecipeVm {
  /** One-time full corpus load. Called once after boot, before subscribe. */
  loadRecords(records: SerializedRecord[]): Promise<void>;
  /** Incremental update — apply a single tiddler change. Fire and forget. */
  setTiddler(fields: Record<string, string | string[]>): void;
  /** Incremental update — remove a tiddler. Fire and forget. */
  removeTiddler(title: string): void;
  /** Run a TW5 wikitext filter expression, return matching titles. */
  filterTiddlers(expr: string): Promise<string[]>;
  /** Render a parent carrier URI to its disk format. */
  renderCarrier(uri: string): Promise<string | null>;
  /** Release resources. Called by VmPool.release(). */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// DirectRecipeVm — in-process LarariumTW5 wrapper
// ---------------------------------------------------------------------------

export class DirectRecipeVm implements RecipeVm {
  constructor(private readonly vm: LarariumTW5) {}

  /** Full LarariumTW5 instance — available for admin/debug surfaces only. */
  get tw5(): LarariumTW5 { return this.vm; }

  async loadRecords(records: SerializedRecord[]): Promise<void> {
    this.vm.bulkSetTiddlers(
      records.map((r) => ({
        title: r.title,
        ...r.fields,
        ...(r.text !== undefined ? { text: r.text } : {}),
      })),
    );
  }

  setTiddler(fields: Record<string, string | string[]>): void {
    this.vm.setTiddler(fields);
  }

  removeTiddler(title: string): void {
    this.vm.removeTiddler(title);
  }

  async filterTiddlers(expr: string): Promise<string[]> {
    return this.vm.filterTiddlers(expr);
  }

  async renderCarrier(uri: string): Promise<string | null> {
    try {
      return exportCarrierText(this.vm, uri);
    } catch (e) {
      console.warn(`[lararium] DirectRecipeVm.renderCarrier failed for ${uri}:`, e);
      return null;
    }
  }

  dispose(): void {
    this.vm.dispose();
  }
}
