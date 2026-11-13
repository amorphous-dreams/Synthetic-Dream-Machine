/**
 * kahua-layer — THE ONE SEAM through which an island mounts the face's kahua stage.
 *
 * The document reads off the island's manifest grant (`IslandGrants.kahuaUrl`), which the vessel fills from the url
 * the face's verified `plane` act pins (`adoptKahuaPlane`); a catalog row never answers for `bags/kahua`, so a holder
 * who rewrites the row moves no layer. The store the layer stands on comes from `kahuaLayerStore`, the one place a
 * verify-on-read adapter (the stage's fold over its signed acts) replaces the raw document store.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import {
  KAHUA_BAG, kahuaStageStore, personaKelChainForPrefix, readFace,
  type DocHandle, type FaceAnchor, type KahuaStageFace, type LarDoc, type LarTiddlerStore, type PersonaKelEvent,
} from "@lararium/mesh";

/**
 * The document a library slot mounts from. `bags/kahua` answers from the grant alone and never asks the catalog;
 * every other library bag asks the catalog lookup.
 */
export async function librarySlotUrl(
  slot: string,
  grants: { readonly kahuaUrl?: string | null },
  catalog: ((slot: string) => Promise<string | null>) | null,
): Promise<string | null> {
  if (slot === KAHUA_BAG) return grants.kahuaUrl ?? null;
  return catalog ? catalog(slot) : null;
}

/** The store the kahua layer stands on: the verify-on-read stage fold, re-folding when the stage doc or the face moves. */
export function kahuaLayerStore(handle: DocHandle<LarDoc>, face: () => KahuaStageFace | null, faceChanges?: (fn: () => void) => () => void): LarTiddlerStore {
  // The stage serves what the fold verifies under the worn face, never the doc's titles: a plain tiddler a synced
  // member writes into the stage doc reads as nothing here.
  return kahuaStageStore({ handle, bagId: KAHUA_BAG, face, ...(faceChanges ? { faceChanges } : {}) });
}

/** The face a running island's kahua layer folds under, read LIVE, and the watch that wakes its re-fold. */
export interface LiveKahuaFace {
  readonly read: () => KahuaStageFace | null;
  readonly watch: (fn: () => void) => () => void;
}

/**
 * THE KAHUA FACE, READ LIVE. The manifest names the face's KEL chain as it stood at boot; a rotation merged into the
 * island's own replica of the KEL board after boot must reach the next fold. So the face reads the board the manifest
 * names (`personaKel.board`) once its replica answers, the boot chain until then, and each board change wakes the
 * watchers; the reading folds once per board snapshot. With no board named, the boot chain decides for the island's life.
 */
export function liveKahuaFace(input: {
  readonly group: string;
  readonly prefix: string;
  readonly bootChain: readonly PersonaKelEvent[] | null | undefined;
  readonly anchor: FaceAnchor | null;
  /** The island's replica of the persona-KEL board, as its find resolves; null where the manifest names none. */
  readonly board: Promise<DocHandle<LarDoc>> | null;
}): LiveKahuaFace {
  let board: DocHandle<LarDoc> | null = null;
  const watchers = new Set<() => void>();
  const wake = (): void => { for (const fn of [...watchers]) fn(); };
  let memo: { readonly from: unknown; readonly face: KahuaStageFace | null } | null = null;
  const fold = (chain: readonly PersonaKelEvent[] | null | undefined): KahuaStageFace | null => {
    const reading = readFace(chain, input.anchor);
    return reading ? { group: input.group, grant: reading.currentSigner, signedAt: reading.signsAt } : null;
  };
  void input.board?.then((handle) => {
    board = handle;
    handle.on("change", wake);
    wake();
  }, () => { /* no replica answers: the boot chain stands */ });
  return {
    read() {
      const doc = board?.doc() ?? null;
      const from = doc ?? input.bootChain ?? null;
      if (memo && memo.from === from) return memo.face;
      const chain = doc ? personaKelChainForPrefix(doc, input.prefix) ?? input.bootChain : input.bootChain;
      memo = { from, face: fold(chain) };
      return memo.face;
    },
    watch(fn) { watchers.add(fn); return () => { watchers.delete(fn); }; },
  };
}
