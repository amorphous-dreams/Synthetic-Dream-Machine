/**
 * VmPool — isomorphic VM lifecycle manager.
 *
 * Generic over T so it can hold LarariumTW5, RecipeVm, TW5WorkerProxy, or
 * any other disposable VM-shaped object. Same shape on server and browser.
 *
 * Usage:
 *   const pool = new VmPool<RecipeVm>();
 *   const vm = await pool.get("lares", () => bootDirectVm(store));
 *   await vm.filterTiddlers("[all[memes]]");
 *   pool.release("lares"); // calls vm.dispose() + removes from pool
 *
 * recipeId convention: sorted bag slugs joined by "+"
 *   Use makeRecipeId(bagIds) from server-api to produce canonical keys.
 */

export class VmPool<T extends { dispose(): void }> {
  private readonly _entries = new Map<string, Promise<T>>();

  /**
   * Get a VM for the given key. If not yet booted, calls factory() once and
   * caches the result. Concurrent calls for the same key during boot share
   * the same Promise — factory is called exactly once.
   */
  async get(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this._entries.get(key);
    if (existing) return existing;
    const p = factory();
    this._entries.set(key, p);
    // On factory rejection, remove the entry so a future call retries.
    p.catch(() => { if (this._entries.get(key) === p) this._entries.delete(key); });
    return p;
  }

  /** Returns true if a VM for this key is booted or currently booting. */
  has(key: string): boolean {
    return this._entries.has(key);
  }

  /**
   * Release the VM — calls dispose() and removes from pool.
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

  /** All warmed keys — useful for diagnostics. */
  keys(): string[] { return [...this._entries.keys()]; }
}
