/**
 * server-api — Recipe VM registry for the Lararium node peer.
 *
 * VmPool<RecipeVm> is the multi-peer backbone: the server holds one VM per
 * recipe, N recipes simultaneously (N realms, N corpora, portals).
 *
 * Each slot is a RecipeVm — the isomorphic orrery interface. Two backends:
 *   DirectRecipeVm   — in-process LarariumTW5 (default; Node isolation free)
 *   TW5WorkerProxy   — Worker Thread / Web Worker; swap via vmFactory param
 *
 * Boot sequence per recipe:
 *   bootRecipeVm(recipeId, store)
 *     → reads all records from store (main thread)
 *     → vmFactory() → RecipeVm.boot() → RecipeVm.loadRecords(records)
 *     → store.subscribe(incrementalSync) — VM stays live from here on
 *
 * The factory is the only seam between in-process and Worker backends.
 * All filter/render call sites are backend-agnostic.
 *
 * Flows are isomorphic between server and browser peers:
 *   server  — VmPool<RecipeVm>, N recipe slots, Worker Threads for isolation
 *   browser — VmPool<RecipeVm>, 1+ recipe slots, Web Workers for $tw isolation
 *
 * recipeId: sorted bag slugs joined by "+"  e.g. "lares+room"
 */

import type { LarTiddlerStore, LarTiddlerChange } from "@lararium/core";
import { LarariumTW5 } from "./lararium-tw5.js";
import { VmPool } from "./vm-pool.js";
import { DirectRecipeVm, type RecipeVm, type SerializedRecord } from "./recipe-vm.js";

if (typeof window !== "undefined") {
  throw new Error("server-api must not be imported in browser bundles.");
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const _pool = new VmPool<RecipeVm>();
const _subs = new Map<string, () => void>();

/** Canonical recipe key from an ordered list of bag slugs. */
export function makeRecipeId(bagIds: readonly string[]): string {
  return [...bagIds].sort().join("+");
}

// ---------------------------------------------------------------------------
// Store → serialized records (main-thread read, passed to any VM backend)
// ---------------------------------------------------------------------------

async function readAllFromStore(store: LarTiddlerStore): Promise<SerializedRecord[]> {
  const uris = await store.listVisible();
  const results = await Promise.all(
    uris.map(async (uri) => {
      const rec = await store.get(uri);
      if (!rec || rec.deleted) return null;
      const sr: SerializedRecord = {
        title:  rec.title,
        fields: rec.fields as Record<string, string | string[]>,
      };
      if (rec.text !== undefined) sr.text = rec.text;
      return sr;
    }),
  );
  return results.filter((r): r is SerializedRecord => r !== null);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

/**
 * Boot (or re-boot) a recipe VM for the given recipe.
 *
 * vmFactory — optional; defaults to DirectRecipeVm (in-process LarariumTW5).
 * Swap for TW5WorkerProxy to run TW5 in a Worker Thread / Web Worker:
 *
 *   await bootRecipeVm(id, store, () => new TW5WorkerProxy(workerScriptUrl));
 *
 * Safe to call again to re-attach a recipe to a new store — releases first.
 */
export async function bootRecipeVm(
  recipeId: string,
  store: LarTiddlerStore,
  vmFactory?: () => RecipeVm,
): Promise<RecipeVm> {
  releaseRecipeVm(recipeId);

  const records = await readAllFromStore(store);

  const vm = await _pool.get(recipeId, async () => {
    const v = vmFactory
      ? vmFactory()
      : new DirectRecipeVm(await (async () => { const tw = new LarariumTW5(); await tw.boot(); return tw; })());
    await v.loadRecords(records);
    return v;
  });

  // Incremental sync — fires synchronously on every store change so the VM
  // is always current before a debounced renderCarrier call fires.
  const unsub = store.subscribe((change: LarTiddlerChange) => {
    const { title, record } = change;
    if (!record || record.deleted) {
      vm.removeTiddler(title);
    } else {
      const fields: Record<string, string | string[]> = { title, ...record.fields };
      if (record.text !== undefined) fields["text"] = record.text;
      vm.setTiddler(fields);
    }
  });

  _subs.set(recipeId, unsub);
  return vm;
}

/**
 * Release a recipe VM — unsubscribes from the store and disposes the VM.
 * Safe to call with an unknown recipeId (no-op).
 */
export function releaseRecipeVm(recipeId: string): void {
  _subs.get(recipeId)?.();
  _subs.delete(recipeId);
  _pool.release(recipeId);
}

/** Number of live recipe VM instances. */
export function liveVmCount(): number { return _pool.size; }

// ---------------------------------------------------------------------------
// Filter — TW5 wikitext filter expressions against the live VM wiki state
// ---------------------------------------------------------------------------

/**
 * Run a TW5 wikitext filter expression against the recipe's loaded wiki.
 * Returns matching tiddler titles. VM must be booted via bootRecipeVm first.
 */
export async function filterRecipe(recipeId: string, expr: string): Promise<string[]> {
  if (!_pool.has(recipeId)) return [];
  const vm = await _pool.get(recipeId, async () => { throw new Error(`recipe ${recipeId} not booted`); });
  return vm.filterTiddlers(expr);
}

/**
 * Pre-compute multiple named filter results in one pass against the live VM.
 * Returns roomId → [tiddler titles].
 */
export async function precomputeRecipeRooms(
  recipeId: string,
  rooms: Record<string, string>,
): Promise<Record<string, string[]>> {
  if (!_pool.has(recipeId)) return {};
  const vm = await _pool.get(recipeId, async () => { throw new Error(`recipe ${recipeId} not booted`); });
  const result: Record<string, string[]> = {};
  for (const [roomId, expr] of Object.entries(rooms)) {
    result[roomId] = await vm.filterTiddlers(expr);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Render — carrier projection through the live VM (fakeDOM pipeline)
// ---------------------------------------------------------------------------

/**
 * Render a parent carrier URI to its disk format via the live recipe VM.
 * VM is always current via subscription — no store scan on this call.
 * Returns null if the recipe VM is not booted or render fails.
 */
export async function renderCarrier(recipeId: string, parentUri: string): Promise<string | null> {
  if (!_pool.has(recipeId)) return null;
  const vm = await _pool.get(recipeId, async () => { throw new Error(`recipe ${recipeId} not booted`); });
  return vm.renderCarrier(parentUri);
}
