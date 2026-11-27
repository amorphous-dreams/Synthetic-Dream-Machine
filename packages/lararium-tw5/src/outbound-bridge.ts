/**
 * The wiki's `change` notification, bound to the shore. Tiddlers are invariants and every write replaces a
 * tiddler; the bridge only decides what each notified title is for the adaptor.
 *
 * One dispatch is read WHOLE, in this order:
 *   1. Discrete acts first. A dispatch holding the deletion of a draft the adaptor's draft book knows is a
 *      save, a rename or a cancel; the adaptor takes the draft, its target and a rename's source, consumes
 *      registers the act's writes through the shore's one drain, and starts it inside this handler, in the
 *      turn of the dispatch. The titles it took are skipped below.
 *   2. Every other title is a hand or foam. A change equal to the title's row (the value the last wave landed,
 *      or the wiki's value when the shore started) is foam, and a foam notification for a title that already
 *      holds a hand (marked, or sent and not yet landed) is never skipped: the title re-marks, so the flush
 *      reads the title's state at flush even when that state has returned to the landed value. Any other
 *      change marks the title in the shore's drain, a deletion included.
 */
import type { TW5Engine } from "./tw5-vm.js";
import type { IslandAdaptor } from "./island-adaptor.js";

/** TiddlyWiki flags each notified title `normal` (an ordinary tiddler moved) and/or `shadow` (the shadow layer moved). */
type WikiChanges = Record<string, { modified?: boolean; deleted?: boolean; normal?: boolean; shadow?: boolean }>;
interface BridgeWiki {
  addEventListener(type: "change", fn: (changes: WikiChanges) => void): void;
  removeEventListener(type: "change", fn: (changes: WikiChanges) => void): void;
  getTiddler(title: string): unknown;
  tiddlerExists(title: string): boolean;
}

/** Bind live wiki notifications to the adaptor. */
export function bridgeWikiToAdaptor(tw5: TW5Engine, adaptor: IslandAdaptor): () => void {
  const wiki = tw5.$tw.wiki as unknown as BridgeWiki;
  adaptor.installLandingQueue();
  // One fault reaction per title generation: repeated dispatches may share one gate promise.
  const reactions = new Map<string, Promise<void>>();
  const reactOnce = (title: string, op: "save" | "delete", task: Promise<void>): void => {
    if (reactions.get(title) === task) return;
    reactions.set(title, task);
    void task.catch((err: unknown) => console.warn(`[outbound-bridge] ${op} "${title}" faulted: ${String(err)}`)).finally(() => {
      if (reactions.get(title) === task) reactions.delete(title);
    });
  };
  // NO HOLD, NO CHECKPOINT GATE. The shore stands one row per synced title when it starts (`IslandAdaptor.start`, TW5's
  // `Syncer.readTiddlerInfo`), so a boot write TW5 tells after the bridge stands (a status title, the story, a startup action's
  // creation) and every mount wave that lands read as foam here; only a title that moved past its row is a hand.
  const onChange = (changes: WikiChanges): void => {
    const dispatch = changes ?? {};
    const consumed = adaptor.handleChangeDispatch(dispatch);
    for (const title of Object.keys(dispatch)) {
      if (consumed.has(title)) continue;
      // THE SHADOW LAYER RESTS IN MEMORY ALONE: a notification that moved only shadows (a plugin re-laid, the daemon's
      // surfaces seeded as a face's planes arrive) is no hand's write, and no store hears it.
      if (dispatch[title]?.shadow && !dispatch[title]?.normal) continue;
      // An ordinary tiddler, never the shadow `getTiddler` answers beneath it: a hand's delete of an override lands its
      // tombstone, and the shadow it uncovers stays in the shadow layer.
      const current = wiki.tiddlerExists(title) ? wiki.getTiddler(title) ?? null : null;
      if (!adaptor.holdsHand(title) && adaptor.isFoam(title, current)) continue;
      if (current) {
        reactOnce(title, "save", adaptor.saveTiddler(current));
      } else {
        reactOnce(title, "delete", adaptor.deleteTiddler(title));
      }
    }
    // The dispatch ends: an idle drain starts now (unless an attached trigger owns that clock); a write in flight keeps the next turn.
    adaptor.dispatchEnded();
  };
  wiki.addEventListener("change", onChange);
  return () => wiki.removeEventListener("change", onChange);
}
