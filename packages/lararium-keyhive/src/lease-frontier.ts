/**
 * lease-frontier — THE ONE ROAD a daemon island reads its own PersonaGroup lease epoch by.
 *
 * The per-writer lease slots rest in the vessel's CONTROL document (`control-home`), which the daemon island holds as its
 * control store (`IslandContext.control`, granted by `controlUrl`) and never as a recipe layer. The control store is the
 * address the island actually holds, on every platform, so the read goes there, with no second road to fall back on.
 *
 * TWO VERDICTS, NEVER MERGED (null-as-default law):
 *   - the control layer reads, and holds no slot under the group's prefix → `{kind:"epoch", n:0}`, the founding
 *     epoch. An empty, readable lease set reads zero.
 *   - no group pinned, no control store captured, the control layer absent, or the read faults → `{kind:"unavailable"}`.
 *     A mutation gate refuses on it; it never stands in for 0.
 *
 * Meme: lar:///ha.ka.ba/lararium/keyhive/lease-frontier
 */
import { CONTROL_HOME_ID, leaseEpochPrefix, signedLeaseEpoch, type LarTiddlerStore } from "@lararium/mesh";

/** What a lease read yields: the current epoch, or a named reason the frontier cannot be read. */
export type LeaseFrontier =
  | { readonly kind: "epoch"; readonly n: number }
  | { readonly kind: "unavailable"; readonly why: string };

/** The one surface the read needs off a store: the store of a named layer, or null when none is mounted. */
export interface ControlLayerHolder {
  storeForBag(bagId: string): LarTiddlerStore | null;
}

/** The control document's store, as this island's control store holds it — null when the layer is absent. */
export function controlLayerOf(control: ControlLayerHolder | null | undefined): LarTiddlerStore | null {
  return control?.storeForBag(CONTROL_HOME_ID) ?? null;
}

/** Fold every slot under the group's lease prefix by max, off the island's own control layer. Read fresh per call. */
export async function readLeaseFrontier(
  composite: ControlLayerHolder | null | undefined,
  groupDocIdHex: string | null | undefined,
  authorize: (writerHex: string) => boolean,
): Promise<LeaseFrontier> {
  if (!groupDocIdHex) return { kind: "unavailable", why: "no PersonaGroup pinned" };
  if (!composite) return { kind: "unavailable", why: "no island control store in scope" };
  const store = controlLayerOf(composite);
  if (!store) return { kind: "unavailable", why: "the control layer is absent from this island's control store" };
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
    return { kind: "unavailable", why: `the control layer read faulted: ${(err as Error)?.message ?? String(err)}` };
  }
}

/**
 * The lease a LIVE door acts under: the current roster's signed advances off the control layer (`FaceReading.currentSigner`), floored
 * under the sealed anchor the reading holds, so a missing or replayed older slot never lowers the epoch a join or a grant checks an
 * edge against. No verified face reading: no signer, so nothing raises; an unavailable layer stays unavailable.
 */
export async function readLeaseUnderFace(
  composite: ControlLayerHolder | null | undefined,
  groupDocIdHex: string | null | undefined,
  face: { readonly currentSigner: (writerHex: string) => boolean; readonly floor: (observed: number) => number } | null,
): Promise<LeaseFrontier> {
  const frontier = await readLeaseFrontier(composite, groupDocIdHex, face?.currentSigner ?? (() => false));
  return frontier.kind === "epoch" && face ? { kind: "epoch", n: face.floor(frontier.n) } : frontier;
}
