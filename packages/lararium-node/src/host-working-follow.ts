/**
 * host-working-follow — THE HOST'S DAEMON WORKING LAYER FOLLOWS THE ISLAND'S.
 *
 * A main-side write to the daemon wiki lands on the document the island reads: when the island's resolver names a new
 * document for the daemon wiki's working slot (`docstore:slot`, the seat's lift moving it to the face's, a wear change, a
 * re-found), the host's working layer rebinds onto it (`followHostWorkingLayer`). The outcome ledger rests in the control
 * document, never here.
 *
 * IT FOLLOWS THE WORN FACE'S OWN SLOT ALONE (face isolation: a face's daemon layer belongs to that face, opened at its own
 * wear). A face-named wave to a lit SIBLING (open, not worn) resolves that sibling's own daemon slot, and the island names
 * it marked (`sibling`, `slot-announcer`). The vessel still maps it for its seal, but the host's working layer stays where it
 * stands, by rule, and the log names why; it never waits on a sealed refusal to stop a follow onto another face's document.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";

const DAEMON_WORKING_SLOT = wikiSlotUri("daemon", "working");

export interface HostWorkingFollowDeps {
  /** Rebind the host's daemon working layer onto `url` (the daemon VM's `followHostWorkingLayer`); throws where no daemon stands. */
  readonly follow: (url: string) => Promise<void>;
  readonly log?: (line: string) => void;
}

/** The slot notice's follower: `(bagId, documentId, sibling)` from each `docstore:slot` the island posts. */
export function hostWorkingFollower(deps: HostWorkingFollowDeps): (bagId: string, documentId: string, sibling: boolean) => void {
  const log = deps.log ?? ((line: string) => console.log(line));
  return (bagId, documentId, sibling) => {
    if (bagId !== DAEMON_WORKING_SLOT) return;
    if (sibling) {
      log(`[daemon] the host working layer stays where it stands: ${documentId.slice(0, 8)}… names a sibling face's daemon doc; the host follows its own face alone`);
      return;
    }
    let follow: Promise<void>;
    try { follow = deps.follow(`automerge:${documentId}`); }
    catch { return; }   // no daemon stands yet, or it restarts: its next mount resolves the island's document afresh
    void follow.catch((e: unknown) => log(`[daemon] the host working layer stays where it stands: ${e instanceof Error ? e.message : String(e)}`));
  };
}
