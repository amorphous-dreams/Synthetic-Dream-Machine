/**
 * lease-frontier — THE ONE ROAD a daemon island reads its own PersonaGroup lease epoch by.
 *
 * The per-writer lease slots rest in the vessel's registry (`vessel-state`), which the daemon island holds as its
 * state store (`IslandContext.state`, granted by `stateUrl`) and never as a recipe layer. The state store is the
 * address the island actually holds, on every platform, so the read goes there, with no second road to fall back on.
 *
 * TWO VERDICTS, NEVER MERGED (null-as-default law):
 *   - the state layer reads, and holds no slot under the group's prefix → `{kind:"epoch", n:0}`, the founding
 *     epoch. An empty, readable lease set reads zero.
 *   - no group pinned, no state store captured, the state layer absent, or the read faults → `{kind:"unavailable"}`.
 *     A mutation gate refuses on it; it never stands in for 0.
 *
 * Meme: lar:///ha.ka.ba/lararium/keyhive/lease-frontier
 */
import { VESSEL_STATE_ID } from "@lararium/mesh/lar-uris";
import { leaseEpochPrefix } from "@lararium/mesh/epoch-lease";
import { signedLeaseEpoch } from "@lararium/mesh/lease-advance";
import { type LarTiddlerStore } from "@lararium/mesh/tiddler-store";

/** What a lease read yields: the current epoch, or a named reason the frontier cannot be read. */
export type LeaseFrontier =
  | { readonly kind: "epoch"; readonly n: number }
  | { readonly kind: "unavailable"; readonly why: string };

/** The one surface the read needs off a store: the store of a named layer, or null when none is mounted. */
export interface StateLayerHolder {
  storeForBag(bagId: string): LarTiddlerStore | null;
}

/** The state document's store, as this island's state store holds it — null when the layer stands absent. */
export function stateLayerOf(state: StateLayerHolder | null | undefined): LarTiddlerStore | null {
  return state?.storeForBag(VESSEL_STATE_ID) ?? null;
}

/** Fold every slot under the group's lease prefix by max, off the island's own state layer. Read fresh per call. */
export async function readLeaseFrontier(
  composite: StateLayerHolder | null | undefined,
  groupDocIdHex: string | null | undefined,
  authorize: (writerHex: string) => boolean,
): Promise<LeaseFrontier> {
  if (!groupDocIdHex) return { kind: "unavailable", why: "no PersonaGroup pinned" };
  if (!composite) return { kind: "unavailable", why: "no island state store in scope" };
  const store = stateLayerOf(composite);
  if (!store) return { kind: "unavailable", why: "the state layer is absent from this island's state store" };
  try {
    const prefix = leaseEpochPrefix(groupDocIdHex);
    const slots: string[] = [];
    for (const title of await store.listVisible()) {
      if (!title.startsWith(prefix)) continue;
      const record = await store.get(title);
      const text = (record as { tiddler?: { text?: unknown } } | null)?.tiddler?.text;
      if (typeof text === "string") slots.push(text);
    }
    return { kind: "epoch", n: signedLeaseEpoch(groupDocIdHex, slots, authorize) };
  } catch (err) {
    return { kind: "unavailable", why: `the state layer read faulted: ${(err as Error)?.message ?? String(err)}` };
  }
}

/**
 * The lease a LIVE door acts under: the current roster's signed advances off the state layer (`FaceReading.currentSigner`), floored
 * under the sealed anchor the reading holds, so a missing or replayed older slot never lowers the epoch a join or a grant checks an
 * edge against. No verified face reading: no signer, so nothing raises; an unavailable layer stays unavailable.
 */
export async function readLeaseUnderFace(
  composite: StateLayerHolder | null | undefined,
  groupDocIdHex: string | null | undefined,
  face: { readonly currentSigner: (writerHex: string) => boolean; readonly floor: (observed: number) => number } | null,
): Promise<LeaseFrontier> {
  const frontier = await readLeaseFrontier(composite, groupDocIdHex, face?.currentSigner ?? (() => false));
  return frontier.kind === "epoch" && face ? { kind: "epoch", n: face.floor(frontier.n) } : frontier;
}
