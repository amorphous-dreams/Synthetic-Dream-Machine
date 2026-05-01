/**
 * VmPool — isomorphic TW5 VM lifecycle manager.
 *
 * Manages LarariumTW5 instances keyed by recipe ID (sorted bag slugs).
 * Identical shape on server and browser — the only difference is isolation:
 *   Node:    each entry is a truly isolated TiddlyWiki() instance.
 *   Browser: the global $tw is shared; VmPool manages wrapper lifecycle but
 *            cannot provide hard tiddler isolation without iframe/worker boundaries.
 *
 * Usage (server):
 *   const pool = new VmPool();
 *   const vm = await pool.get("lares+room", () => { const v = new LarariumTW5(); return v.boot().then(() => v); });
 *   vm.setTiddler({ title: "lar:///foo", text: "bar" });
 *   pool.release("lares+room"); // dispose + remove
 *
 * recipeId convention: sorted bag slugs joined by "+"
 *   Use makeRecipeId(bagIds) from server-api to produce canonical keys.
 */

import type { LarariumTW5 } from "./lararium-tw5.js";

export class VmPool {
  private readonly _entries = new Map<string, Promise<LarariumTW5>>();

  /**
   * Get a VM for the given key. If not yet booted, calls factory() once
   * and caches the result. Subsequent calls for the same key return the
   * cached promise without re-calling factory().
   */
  async get(key: string, factory: () => Promise<LarariumTW5>): Promise<LarariumTW5> {
    const existing = this._entries.get(key);
    if (existing) return existing;
    const p = factory();
    this._entries.set(key, p);
    // On factory rejection, clean up the map entry so a future call retries.
    p.catch(() => { if (this._entries.get(key) === p) this._entries.delete(key); });
    return p;
  }

  /** Returns true if a VM for this key is warmed (or currently booting). */
  has(key: string): boolean {
    return this._entries.has(key);
  }

  /**
   * Release the VM for a key — disposes the instance and removes it from the pool.
   * Safe to call with an unknown key (no-op).
   */
  release(key: string): void {
    const p = this._entries.get(key);
    if (!p) return;
    this._entries.delete(key);
    void p.then((vm) => vm.dispose()).catch(() => {/* already gone */});
  }

  /** Release all VMs in the pool. */
  releaseAll(): void {
    for (const key of [...this._entries.keys()]) this.release(key);
  }

  /** Number of live (booting or ready) VM entries. */
  get size(): number { return this._entries.size; }

  /** List all warmed keys — useful for diagnostics. */
  keys(): string[] { return [...this._entries.keys()]; }
}
