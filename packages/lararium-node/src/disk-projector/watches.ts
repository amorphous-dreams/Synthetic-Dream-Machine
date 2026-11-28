/**
 * SETTLE WAKES AND RECONCILE WATCHES: the wake a settle wait arms before each look, the watch on a carrier's next
 * reconcile, the reconcile that tells its watches how it ended, and the census of what the queue still owes.
 * Heleuma ha: see lararium/mesh/disk-projector-watches.
 */

import type { ProjectorCore } from "./core.js";
import type { ReconcileWatch } from "./entries.js";

/** A wake the caller arms before it looks, and cancels when it stops waiting, so no waiter outlives its wait. */
export function nextWake(core: ProjectorCore): { readonly promise: Promise<void>; readonly cancel: () => void } {
  if (core.stopping) return { promise: Promise.resolve(), cancel: () => {} };
  let wake: () => void = () => {};
  const promise = new Promise<void>((resolve) => { wake = resolve; });
  core.settleWakes.add(wake);
  return { promise, cancel: () => { core.settleWakes.delete(wake); } };
}

/** Wake every settle wait, dropping the changed roots into each wait's inbox (every root when none named). */
export function wakeWaiters(core: ProjectorCore, roots?: ReadonlySet<string>): void {
  for (const inbox of core.settleInboxes) {
    if (roots === undefined) inbox.all = true;
    else for (const root of roots) inbox.roots.add(root);
  }
  const waiters = [...core.settleWakes];
  core.settleWakes.clear();
  for (const wake of waiters) wake();
}

/** Watch the next reconcile of `uri` that STARTS from now on. */
export function watchReconcile(core: ProjectorCore, uri: string): ReconcileWatch {
  const watch: ReconcileWatch = { ran: false, threw: false };
  let set = core.reconcileWatches.get(uri);
  if (!set) { set = new Set(); core.reconcileWatches.set(uri, set); }
  set.add(watch);
  return watch;
}

export function releaseWatch(core: ProjectorCore, uri: string, watch: ReconcileWatch): void {
  const set = core.reconcileWatches.get(uri);
  if (!set) return;
  set.delete(watch);
  if (set.size === 0) core.reconcileWatches.delete(uri);
}

/** Reconcile one carrier and tell every watch that stood when it started how it ended (the last run counts). */
export async function reconcileWatched(core: ProjectorCore, rootUri: string): Promise<void> {
  const watching = [...(core.reconcileWatches.get(rootUri) ?? [])];
  try {
    await core.reconcile(rootUri);
    core.failedRoots.delete(rootUri);
    for (const watch of watching) { watch.ran = true; watch.threw = false; }
  } catch (error) {
    core.failedRoots.add(rootUri);
    for (const watch of watching) watch.threw = true;
    throw error;
  }
}

/**
 * WHAT THE PROJECTOR HAS NOT SETTLED, read and never moved: each carrier root its queue still owes a reconcile
 * (`pending`), and each whose latest reconcile threw (`failed`), with the bag the view names for it (null: none).
 * A stop that would leave these off disk lists them first (`lares vessel census`).
 */
export function unsettled(core: ProjectorCore): { readonly pending: ReadonlyArray<{ readonly uri: string; readonly bagId: string | null }>; readonly failed: ReadonlyArray<{ readonly uri: string; readonly bagId: string | null }> } {
  const bagOf = (uri: string): string | null => {
    const origin = (core._tw5?.$tw.wiki.getTiddler?.(uri)?.fields as Record<string, unknown> | undefined)?.["$origin-bag"];
    return typeof origin === "string" ? origin : null;
  };
  const row = (uri: string) => ({ uri, bagId: bagOf(uri) });
  return { pending: (core.gate?.pending() ?? []).map(row), failed: [...core.failedRoots].map(row) };
}
