/**
 * call-heads — wait until this replica holds the heads one call's changes reached (`call-touches`). An island's change
 * crosses its sync leg before the vessel's Repo holds it; a door that flushed before the arrival would read a write that
 * never reached this rest as sealed. Answers the documents whose heads did not arrive within the bound (owed by name).
 */
import * as A from "@automerge/automerge";
import type { CallTouches } from "@lararium/mesh/call-touches";

/** How long a door waits for its call's changes to cross into this replica before it answers them `save-unsynced`. */
export const REST_OWED_SYNC_BOUND_MS = 5_000;

interface HeadsHandle { isReady(): boolean; doc(): unknown; on(event: "change", fn: () => void): unknown; off(event: "change", fn: () => void): unknown }

const holds = (handle: HeadsHandle | undefined, heads: readonly string[]): boolean => {
  if (handle === undefined || !handle.isReady()) return false;
  try {
    const doc = handle.doc() as A.Doc<unknown>;
    return A.hasHeads(doc, [...heads]);
  } catch { return false; }
};

export async function awaitCallHeads(repo: { readonly handles: Record<string, unknown> }, touches: CallTouches, boundMs: number): Promise<string[]> {
  const waits = (Object.entries(touches) as Array<[string, readonly string[]]>).map(([id, heads]) => new Promise<string | null>((resolve) => {
    const handle = repo.handles[id] as HeadsHandle | undefined;
    if (holds(handle, heads)) { resolve(null); return; }
    if (handle === undefined) { resolve(id); return; }
    const check = (): void => { if (holds(handle, heads)) { clearTimeout(timer); handle.off("change", check); resolve(null); } };
    const timer = setTimeout(() => { handle.off("change", check); resolve(holds(handle, heads) ? null : id); }, boundMs);
    handle.on("change", check);
  }));
  return (await Promise.all(waits)).filter((id): id is string => id !== null);
}
