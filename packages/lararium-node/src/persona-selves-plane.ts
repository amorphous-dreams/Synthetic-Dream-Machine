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
 *
 * A NAME RIDES ONLY ONTO A REST THAT SEALS. Both names rest sealed under the vessel key, and cleartext rests in
 * the live wiki and the operator's projected files alone (lar:///ha.ka.ba/lararium/mesh/sealed-store). A plane
 * names its own rest, and its write refuses any name while that rest stands clear; a clear still runs, since it
 * moves no name onto the rest. The vessel's Repo rests each document through its own storage adapter
 * (`durable-storage-adapter`), which writes the bytes Automerge saves, so a name on a plane rests verbatim on disk
 * (the suite measures it). Its plane therefore rests `clear`, until the sealed store's step three seals the Repo's
 * storage values and answers `sealed` here.
 */
import type { Repo, AutomergeUrl } from "@automerge/automerge-repo";
import { AutomergeDocStore, personaBagIdFor, type LarDoc, type LarTiddlerStore } from "@lararium/mesh";
import { readPersonaSelves, writePersonaSelfName } from "@lararium/tw5";
import type { PersonaSelfLine, PersonaSelvesPlane, PlaneRest } from "./sealed-acts.js";

/** One face this vessel carries a plane for: its handle-index and the store over its own plane. */
export interface FacePlane {
  readonly handleIndex: number;
  readonly store: () => Promise<LarTiddlerStore>;
}

/**
 * The planes of the faces a vessel carries. `faces` answers each face with its own plane's store; `rest` names
 * where those planes' documents rest; `stamp` answers the ordering hint one write carries.
 */
export function personaSelvesPlaneOver(
  faces: () => Promise<readonly FacePlane[]>,
  opts: { readonly rest: PlaneRest; readonly stamp?: () => string },
): PersonaSelvesPlane {
  const stamp = opts.stamp ?? (() => new Date().toISOString());
  return {
    rest: opts.rest,
    async read() {
      const out: PersonaSelfLine[] = [];
      for (const face of await faces()) {
        // A plane answers for its own face alone, whatever else its document holds.
        const own = (await readPersonaSelves(await face.store())).find((s) => s.handleIndex === face.handleIndex);
        if (own) out.push(own);
      }
      return out.sort((a, b) => a.handleIndex - b.handleIndex);
    },
    async write(handleIndex, name, value, writeOpts = {}) {
      const face = (await faces()).find((f) => f.handleIndex === handleIndex);
      if (!face) return { written: false, plane: false };
      if (value.trim().length > 0 && opts.rest !== "sealed") {
        throw new Error(`h${handleIndex}'s persona plane rests in the clear on this vessel's disk, so no name rides onto it`);
      }
      const { written } = await writePersonaSelfName(await face.store(), handleIndex, name, value, stamp(), writeOpts);
      return { written, plane: true };
    },
  };
}

/**
 * Each anchored face's own plane store off this thread's Repo. `planes` lists the plane documents the boot read
 * (one per PersonaGroup this vessel carries); `faceGroups` answers each anchored face with the group its anchors
 * name.
 */
export function repoFacePlanes(
  repo: Repo,
  planes: readonly { readonly personaGroupId: string; readonly url: string }[],
  faceGroups: () => Promise<readonly { readonly handleIndex: number; readonly personaGroupId: string }[]>,
): () => Promise<readonly FacePlane[]> {
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
  return async () => {
    const out: FacePlane[] = [];
    for (const face of await faceGroups()) {
      const plane = planes.find((p) => p.personaGroupId === face.personaGroupId);
      if (plane) out.push({ handleIndex: face.handleIndex, store: () => storeOf(plane) });
    }
    return out;
  };
}

/** Every face's plane off this thread's Repo, which rests its documents in the clear (the head of this module). */
export function repoPersonaSelvesPlane(
  repo: Repo,
  planes: readonly { readonly personaGroupId: string; readonly url: string }[],
  faceGroups: () => Promise<readonly { readonly handleIndex: number; readonly personaGroupId: string }[]>,
): PersonaSelvesPlane {
  return personaSelvesPlaneOver(repoFacePlanes(repo, planes, faceGroups), { rest: "clear" });
}
