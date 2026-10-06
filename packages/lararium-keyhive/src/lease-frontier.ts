/**
 * lease-frontier — THE ONE ROAD a daemon island reads its own PersonaGroup lease epoch by.
 *
 * The per-writer lease slots live in the daemon doc, and the daemon island holds that doc as a LAYER of its own
 * composite. Under an owned document the island's main repo DENIES the daemon doc (it lives in the owned repo
 * alone), so a registry lookup over the main repo never resolves. The composite layer is the address the island
 * actually holds, on every platform, owned or not — so the read goes there, with no second road to fall back on.
 *
 * TWO VERDICTS, NEVER MERGED (null-as-default law):
 *   - the daemon layer reads, and holds no slot under the group's prefix → `{kind:"epoch", n:0}`, the founding
 *     epoch. An empty, readable lease set reads zero.
 *   - no group pinned, no composite captured, the daemon layer absent, or the read faults → `{kind:"unavailable"}`.
 *     A mutation gate refuses on it; it never stands in for 0.
 *
 * Meme: lar:///ha.ka.ba/lararium/keyhive/lease-frontier
 */
import { DAEMON_BAG_ID, leaseEpochPrefix, effectiveLeaseEpoch, type LarTiddlerStore } from "@lararium/mesh";

/** What a lease read yields: the current epoch, or a named reason the frontier cannot be read. */
export type LeaseFrontier =
  | { readonly kind: "epoch"; readonly n: number }
  | { readonly kind: "unavailable"; readonly why: string };

/** The one surface the read needs off a composite: the store of a named layer, or null when none is mounted. */
export interface DaemonLayerHolder {
  storeForBag(bagId: string): LarTiddlerStore | null;
}

/** The daemon doc's store, as this island's composite holds it — null when the layer is absent. */
export function daemonLayerOf(composite: DaemonLayerHolder | null | undefined): LarTiddlerStore | null {
  return composite?.storeForBag(DAEMON_BAG_ID) ?? null;
}

/** Fold every slot under the group's lease prefix by max, off the island's own daemon layer. Read fresh per call. */
export async function readLeaseFrontier(
  composite: DaemonLayerHolder | null | undefined,
  groupDocIdHex: string | null | undefined,
): Promise<LeaseFrontier> {
  if (!groupDocIdHex) return { kind: "unavailable", why: "no PersonaGroup pinned" };
  if (!composite) return { kind: "unavailable", why: "no island composite in scope" };
  const store = daemonLayerOf(composite);
  if (!store) return { kind: "unavailable", why: "the daemon layer is absent from this island's composite" };
  try {
    const prefix = leaseEpochPrefix(groupDocIdHex);
    const slots: string[] = [];
    for (const title of await store.listVisible()) {
      if (!title.startsWith(prefix)) continue;
      const record = await store.get(title);
      const text = (record as { tiddler?: { text?: unknown } } | null)?.tiddler?.text;
      if (typeof text === "string") slots.push(text);
    }
    return { kind: "epoch", n: effectiveLeaseEpoch(slots) };
  } catch (err) {
    return { kind: "unavailable", why: `the daemon layer read faulted: ${(err as Error)?.message ?? String(err)}` };
  }
}
