/**
 * repo-wear — THE ACTOR DOOR A REPO WEARS: each Repo a composition stands (the vessel's own, an island's) seats the door
 * its stores write a worn face's change through, and every store built over that Repo's documents reads it there.
 *
 * A store lands a write whose origin names a face (`ChangeOrigin.face`) under the actor that face derives for the
 * document (`AutomergeDocStore`'s `wear`), or refuses `worn-face-unwritable`. The stores of one Repo are built at many
 * sites (a recipe's layers, a verb's reach, a catalog's plane), and every one of them takes `wearOf(repo)`: a door that
 * reads the Repo's seat at write time, so a store built before its Repo's seat stood still writes through it, and a
 * Repo with no seat refuses by name rather than land a face's write under the engine's actor.
 *
 * The seat is keyed by the Repo itself (one per composition or island), never by a call: the face still rides each
 * write's own origin, so no ambient face crosses an async hop.
 */
import { VerbRefusal } from "./verb-refusal.js";
import type { FaceActorDoor } from "./automerge-doc-store.js";

const seats = new WeakMap<object, FaceActorDoor>();

/** Seat `door` on `repo`: every store `wearOf(repo)` built writes a worn face's change through it. Answers the unseat. */
export function seatRepoWear(repo: object, door: FaceActorDoor): () => void {
  seats.set(repo, door);
  return () => { if (seats.get(repo) === door) seats.delete(repo); };
}

/**
 * The store options that seat a Repo's actor door: `new AutomergeDocStore(handle, bag, wearOf(repo))`. The door reads the
 * Repo's seat when a face's write arrives; with none seated, it refuses `worn-face-unwritable`. A site with no Repo at
 * hand passes none and holds no door (its store refuses a face's write the same way).
 */
export function wearOf(repo: object | null | undefined): { readonly wear?: FaceActorDoor } {
  if (repo === null || repo === undefined) return {};
  return {
    wear: {
      actor: (face, documentId, replica) => {
        const door = seats.get(repo);
        if (!door) {
          return Promise.reject(new VerbRefusal("worn-face-unwritable", "worn-face-unwritable: a write names a face, and the Repo its store stands over seats no actor door; it refuses rather than land under the engine's actor"));
        }
        return door.actor(face, documentId, replica);
      },
    },
  };
}
