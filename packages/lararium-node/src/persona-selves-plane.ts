/**
 * persona-selves-plane — each face's own persona plane, as the vessel's MAIN THREAD reads and writes it.
 *
 * A face's two own names (its private pet-name and its declared Handle) rest sealed on the vessel and ride that
 * face's persona plane to its other vessels. This thread's Repo resolved every plane the vessel carries at boot
 * and saves it, so this thread writes the record straight onto the plane: no verb, no invocation, no outcome, no
 * receipt. The sealed-act table's `selves` rows call it (`sealed-acts`), and the standing composition lends it to
 * the custody door.
 *
 * ONE FACE, ONE PLANE. A name of the face at handle-index N lands on N's OWN plane and on no other: the plane
 * of the group N's anchors name. A vessel that holds several faces therefore tells no face's fleet about
 * another face. The read answers each plane's own face alone.
 *
 * WHAT CROSSES A PORT. The daemon island mounts the worn face's plane, so that plane's own document syncs
 * between this Repo and the island's, as the plane itself. No message beside that document carries a name.
 *
 * The stamp beside each name orders two concurrent renames of that one field on a face's own vessels, and it
 * decides nothing else: no act runs or waits on it.
 */
import type { Repo, AutomergeUrl } from "@automerge/automerge-repo";
import { AutomergeDocStore, personaBagIdFor, type LarDoc, type LarTiddlerStore } from "@lararium/mesh";
import { readPersonaSelves, writePersonaSelfName } from "@lararium/tw5";
import type { PersonaSelfLine, PersonaSelvesPlane } from "./sealed-acts.js";

/** One face this vessel carries a plane for: its handle-index and the store over its own plane. */
export interface FacePlane {
  readonly handleIndex: number;
  readonly store: () => Promise<LarTiddlerStore>;
}

/**
 * The planes of the faces a vessel carries. `faces` answers each face with its own plane's store; `stamp` answers
 * the ordering hint one write carries.
 */
export function personaSelvesPlaneOver(
  faces: () => Promise<readonly FacePlane[]>, stamp: () => string = () => new Date().toISOString(),
): PersonaSelvesPlane {
  return {
    async read() {
      const out: PersonaSelfLine[] = [];
      for (const face of await faces()) {
        // A plane answers for its own face alone, whatever else its document holds.
        const own = (await readPersonaSelves(await face.store())).find((s) => s.handleIndex === face.handleIndex);
        if (own) out.push(own);
      }
      return out.sort((a, b) => a.handleIndex - b.handleIndex);
    },
    async write(handleIndex, name, value, opts = {}) {
      const face = (await faces()).find((f) => f.handleIndex === handleIndex);
      if (!face) return { written: false, plane: false };
      const { written } = await writePersonaSelfName(await face.store(), handleIndex, name, value, stamp(), opts);
      return { written, plane: true };
    },
  };
}

/**
 * Every face's plane off this thread's Repo. `planes` lists the plane documents the boot read (one per
 * PersonaGroup this vessel carries); `faceGroups` answers each anchored face with the group its anchors name.
 */
export function repoPersonaSelvesPlane(
  repo: Repo,
  planes: readonly { readonly personaGroupId: string; readonly url: string }[],
  faceGroups: () => Promise<readonly { readonly handleIndex: number; readonly personaGroupId: string }[]>,
): PersonaSelvesPlane {
  const stores = new Map<string, Promise<LarTiddlerStore>>();
  const storeOf = (plane: { readonly personaGroupId: string; readonly url: string }): Promise<LarTiddlerStore> => {
    let store = stores.get(plane.personaGroupId);
    if (!store) {
      store = repo.find<LarDoc>(plane.url as AutomergeUrl)
        .then((handle) => new AutomergeDocStore(handle as never, personaBagIdFor(plane.personaGroupId)) as LarTiddlerStore);
      store.catch(() => { stores.delete(plane.personaGroupId); });
      stores.set(plane.personaGroupId, store);
    }
    return store;
  };
  return personaSelvesPlaneOver(async () => {
    const out: FacePlane[] = [];
    for (const face of await faceGroups()) {
      const plane = planes.find((p) => p.personaGroupId === face.personaGroupId);
      if (plane) out.push({ handleIndex: face.handleIndex, store: () => storeOf(plane) });
    }
    return out;
  });
}
