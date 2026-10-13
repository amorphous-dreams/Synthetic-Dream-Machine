/**
 * persona-selves-plane — the mounted face's persona plane, as the vessel's MAIN THREAD reads and writes it.
 *
 * A face's two own names (its private pet-name and its declared Handle) rest sealed on the vessel and ride that
 * face's persona plane to its other vessels. The plane's document lives in the main thread's own Repo, which
 * resolved it at boot and saves it, so this thread writes the record straight onto the plane: no verb, no
 * invocation, no outcome, no receipt, no worker message. The sealed-act table's `selves.read` and `selves.carry`
 * rows call it (`sealed-acts`), and the standing composition lends it to the custody door.
 *
 * The stamp beside each name orders two concurrent renames of that one field on a human's own vessels, and it
 * decides nothing else: no act runs or waits on it.
 */
import type { Repo, AutomergeUrl } from "@automerge/automerge-repo";
import { AutomergeDocStore, type LarDoc, type LarTiddlerStore } from "@lararium/mesh";
import { readPersonaSelves, writePersonaSelfName } from "@lararium/tw5";
import type { PersonaSelvesPlane } from "./sealed-acts.js";

/** A persona plane over any tiddler store that holds it. `stamp` answers the ordering hint one write carries. */
export function personaSelvesPlaneOver(
  resolveStore: () => Promise<LarTiddlerStore>, stamp: () => string = () => new Date().toISOString(),
): PersonaSelvesPlane {
  return {
    read: async () => readPersonaSelves(await resolveStore()),
    write: async (handleIndex, name, value) => writePersonaSelfName(await resolveStore(), handleIndex, name, value, stamp()),
  };
}

/**
 * The mounted face's plane off this thread's Repo: the document the boot resolved at `personaUrl`, read and
 * written under the plane's own bag id.
 */
export function repoPersonaSelvesPlane(repo: Repo, personaUrl: string, personaBagId: string): PersonaSelvesPlane {
  let store: Promise<LarTiddlerStore> | null = null;
  const resolveStore = (): Promise<LarTiddlerStore> =>
    (store ??= repo.find<LarDoc>(personaUrl as AutomergeUrl)
      .then((handle) => new AutomergeDocStore(handle as never, personaBagId) as LarTiddlerStore)
      .catch((err: unknown) => { store = null; throw err; }));
  return personaSelvesPlaneOver(resolveStore);
}
