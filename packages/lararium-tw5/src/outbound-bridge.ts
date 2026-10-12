/**
 * The wiki's `change` notification, bound to the shore. Tiddlers are invariants and every write replaces a
 * tiddler; the bridge only decides what each notified title is for the adaptor.
 *
 * One dispatch is read WHOLE, in this order:
 *   1. Discrete acts first. A dispatch holding the deletion of a draft the adaptor's draft book knows is a
 *      save, a rename or a cancel; the adaptor takes the draft, its target and a rename's source, consumes
 *      their pending gate entries and issues the act's store calls inside this handler, in the turn of the
 *      dispatch. The titles it took are skipped below.
 *   2. Every other title is a hand or foam. A change equal to the value the last wave landed is foam, and
 *      a foam notification for a title that already holds a hand (marked, or sent and not yet landed) is
 *      never skipped: the title re-marks, so the flush reads the title's state at flush even when that
 *      state has returned to the landed value. Any other change marks the title for the per-title pacing
 *      gate, a deletion included.
 */
import type { TW5Engine } from "./tw5-vm.js";
import type { IslandAdaptor } from "./island-adaptor.js";

type WikiChanges = Record<string, { modified?: boolean; deleted?: boolean }>;
interface BridgeWiki {
  addEventListener(type: "change", fn: (changes: WikiChanges) => void): void;
  removeEventListener(type: "change", fn: (changes: WikiChanges) => void): void;
  getTiddler(title: string): unknown;
}

/** Bind live wiki notifications to the adaptor. */
export function bridgeWikiToAdaptor(tw5: TW5Engine, adaptor: IslandAdaptor): () => void {
  const wiki = tw5.$tw.wiki as unknown as BridgeWiki;
  adaptor.installLandingQueue();
  const onChange = (changes: WikiChanges): void => {
    if (!adaptor.isResident()) return;
    const dispatch = changes ?? {};
    const consumed = adaptor.handleChangeDispatch(dispatch);
    for (const title of Object.keys(dispatch)) {
      if (consumed.has(title)) continue;
      const current = wiki.getTiddler(title) ?? null;
      if (!adaptor.holdsHand(title) && adaptor.isFoam(title, current)) continue;
      if (current) {
        void adaptor.saveTiddler(current).catch((err: unknown) => console.warn(`[outbound-bridge] save "${title}" faulted: ${String(err)}`));
      } else {
        void adaptor.deleteTiddler(title).catch((err: unknown) => console.warn(`[outbound-bridge] delete "${title}" faulted: ${String(err)}`));
      }
    }
  };
  wiki.addEventListener("change", onChange);
  return () => wiki.removeEventListener("change", onChange);
}
