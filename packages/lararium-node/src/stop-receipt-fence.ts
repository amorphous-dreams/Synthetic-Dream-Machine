/**
 * stop-receipt-fence — once a composition's stop begins, no receipt claims a save rests that waits in memory.
 *
 * The stop seals what waits while the sessions and the daemon island's holder still stand, then drops the sessions and lifts
 * the lift, then settles the islands. An island's write that lands in that gap reaches the vessel's Repo, and the sealed store
 * holds its save in memory (no session books it any more), while `repo.flush()` resolves as if it rested. A receipt read off
 * that flush would claim a durability the save lacks. So, from the stop's first step, a receipt whose document holds a save
 * in memory refuses by name (`held-in-memory`), and the island records no binding over it.
 */
import type { HeldSaves, ReceiptIssuer } from "@lararium/mesh";

export interface StopFence {
  /** Whether the composition's stop has begun. */
  readonly stopping: () => boolean;
  /** The saves the sealed store holds in memory, by document. */
  readonly held: () => readonly HeldSaves[];
}

/** The receipt issuer behind the fence: `inner` runs whole; past the stop's start, a held document refuses the receipt. */
export function fenceReceiptAtStop(inner: ReceiptIssuer, fence: StopFence): ReceiptIssuer {
  return async (documentIds, heads) => {
    await inner(documentIds, heads);
    if (!fence.stopping()) return;
    const asked = new Set(documentIds);
    const held = fence.held().filter((h) => asked.has(h.documentId));
    if (held.length > 0) {
      throw new Error(`held-in-memory: the vessel stops, and ${held.map((h) => `${h.documentId} (${h.refusal})`).join(", ")} waits unsealed in memory; no receipt claims it rests`);
    }
  };
}
