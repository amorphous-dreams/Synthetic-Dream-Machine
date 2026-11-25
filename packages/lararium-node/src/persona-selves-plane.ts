/**
 * persona-selves-plane — each face's own SELVES RECORD, as the vessel's MAIN THREAD reads and writes it.
 *
 * A face's two own names (its private pet-name and its declared Handle) rest on their sealed rows on this vessel (the
 * custody record, under the vessel key) and ride that face's selves record to its other vessels
 * (lar:///ha.ka.ba/kahua/memory/research/persona-selves-sealed). The record stands as a document of its own, split off
 * the persona plane by document (`selvesRecordOf`): the plane stays clear and holds only the signed public acts the
 * locked floor folds, and the record rests sealed under the FACE'S KEY GROUP, so every vessel seated in that group opens
 * it after its lift and a vessel of another face opens nothing. This thread's Repo holds the record (a blank under its
 * derived id merges with every replica), so this thread writes the name straight into it: no verb, no invocation, no
 * outcome, no receipt. The sealed-act table's `selves` rows call it (`sealed-acts`), and the standing composition lends
 * it to the custody door.
 *
 * ONE FACE, ONE RECORD. A name of the face at handle-index N lands in N's OWN record and in no other: the record of the
 * group N's anchors name. A vessel that holds several faces therefore tells no face's fleet about another face. The read
 * answers each record's own face alone.
 *
 * WHAT CROSSES A PORT. The record's own document syncs between this Repo and the face's other vessels by the fleet sync
 * the plane rides, resting sealed on each under that vessel's own session. No message beside that document carries a name.
 *
 * The stamp beside each name orders two concurrent renames of that one field on a face's own vessels, and it decides
 * nothing else: no act runs or waits on it.
 *
 * A NAME RIDES ONLY ONTO A REST THAT SEALS. Cleartext rests in the live wiki and the operator's projected files alone
 * (lar:///ha.ka.ba/lararium/mesh/sealed-store). Each record names its rest by the bag the vessel's map files it under
 * (`selvesRestOf`): `sealed` under its lit face, `shut` while its face stands unlifted (the record neither opens nor takes
 * a name, and the floor never reads it), `clear` where no sealed bag names it. A name refuses on any rest but `sealed`; a
 * clear runs on a clear rest, since it moves no name onto it, and refuses on a shut one, which opens for nothing.
 */
import type { Repo, AutomergeUrl } from "@automerge/automerge-repo";
import { AutomergeDocStore } from "@lararium/mesh/automerge-doc-store";
import { materializeSharedLarDoc } from "@lararium/mesh/deterministic-doc";
import { selvesRecordOf } from "@lararium/mesh/persona-planes";
import { type LarTiddlerStore } from "@lararium/mesh/tiddler-store";
import { readPersonaSelves, writePersonaSelfName } from "@lararium/tw5";
import type { PersonaSelfLine, PersonaSelvesPlane, PlaneRest } from "./sealed-acts.js";

/** One face this vessel carries a selves record for: its handle-index, the store over its own record, and its rest now. */
export interface FaceSelves {
  readonly handleIndex: number;
  readonly store: () => Promise<LarTiddlerStore>;
  /** Where this face's record rests on this vessel now, read at each ask. */
  readonly rest: () => PlaneRest;
}

/** The rest every carried record answers together: sealed where any opens sealed, else clear where any rests clear, else shut. */
function restOfAll(rests: readonly PlaneRest[]): PlaneRest {
  if (rests.includes("sealed")) return "sealed";
  return rests.includes("clear") || rests.length === 0 ? "clear" : "shut";
}

/**
 * The selves records of the faces a vessel carries. `faces` answers each face with its own record's store and rest;
 * `stamp` answers the ordering hint one write carries. `rest` answers the records together, read at each ask: a read
 * returns names off sealed records alone, so a `sealed` answer vouches for every name it carries.
 */
export function personaSelvesPlaneOver(
  faces: () => Promise<readonly FaceSelves[]>,
  opts: { readonly stamp?: () => string; readonly rests?: () => readonly PlaneRest[] } = {},
): PersonaSelvesPlane {
  const stamp = opts.stamp ?? (() => new Date().toISOString());
  let known: readonly FaceSelves[] = [];
  const carried = async (): Promise<readonly FaceSelves[]> => (known = await faces());
  return {
    get rest() { return restOfAll(opts.rests ? opts.rests() : known.map((f) => f.rest())); },
    async restOf(handleIndex) {
      return (await carried()).find((f) => f.handleIndex === handleIndex)?.rest() ?? null;
    },
    async read() {
      const out: PersonaSelfLine[] = [];
      for (const face of await carried()) {
        // A shut record opens for no one, and a clear one vouches for nothing: only a sealed record answers.
        if (face.rest() !== "sealed") continue;
        // A record answers for its own face alone, whatever else its document holds.
        const own = (await readPersonaSelves(await face.store())).find((s) => s.handleIndex === face.handleIndex);
        if (own) out.push(own);
      }
      return out.sort((a, b) => a.handleIndex - b.handleIndex);
    },
    async write(handleIndex, name, value, writeOpts = {}) {
      const face = (await carried()).find((f) => f.handleIndex === handleIndex);
      if (!face) return { written: false, plane: false };
      const rest = face.rest();
      if (rest === "shut") {
        throw new Error(`h${handleIndex}'s selves record stays sealed until its face lifts on this vessel, so no name rides onto it`);
      }
      if (value.trim().length > 0 && rest !== "sealed") {
        throw new Error(`h${handleIndex}'s selves record rests in the clear on this vessel's disk, so no name rides onto it`);
      }
      const { written } = await writePersonaSelfName(await face.store(), handleIndex, name, value, stamp(), writeOpts);
      return { written, plane: true };
    },
  };
}

/**
 * Each anchored face's own selves record off this thread's Repo. `planes` lists the plane documents a face proof vouched
 * for (one per PersonaGroup this vessel carries): a face carries a record only where it carries a proven plane.
 * `faceGroups` answers each anchored face with the group its anchors name; `restOf` answers where a document rests by the
 * vessel's own bag map; `opened` hears each record the first time this Repo stands it (the catalog's row).
 */
export function repoFaceSelves(
  repo: Repo,
  planes: readonly { readonly personaGroupId: string; readonly url: string }[],
  faceGroups: () => Promise<readonly { readonly handleIndex: number; readonly personaGroupId: string }[]>,
  ports: { readonly restOf: (documentId: string) => PlaneRest; readonly opened?: (record: { readonly personaGroupId: string; readonly bagId: string; readonly url: string }) => void },
): () => Promise<readonly FaceSelves[]> {
  const stores = new Map<string, Promise<LarTiddlerStore>>();
  const storeOf = (personaGroupId: string): Promise<LarTiddlerStore> => {
    let store = stores.get(personaGroupId);
    if (!store) {
      const record = selvesRecordOf(personaGroupId);
      store = materializeSharedLarDoc(repo, record.url as AutomergeUrl, "selves-record")
        .then((handle) => { ports.opened?.(record); return new AutomergeDocStore(handle as never, record.bagId) as LarTiddlerStore; });
      store.catch(() => { stores.delete(personaGroupId); });
      stores.set(personaGroupId, store);
    }
    return store;
  };
  return async () => {
    const out: FaceSelves[] = [];
    for (const face of await faceGroups()) {
      if (!planes.some((p) => p.personaGroupId === face.personaGroupId)) continue;
      const documentId = selvesRecordOf(face.personaGroupId).url.slice("automerge:".length);
      out.push({ handleIndex: face.handleIndex, store: () => storeOf(face.personaGroupId), rest: () => ports.restOf(documentId) });
    }
    return out;
  };
}

/** Every carried face's selves record off this thread's Repo, each resting where the vessel's bag map files it. */
export function repoPersonaSelvesPlane(
  repo: Repo,
  planes: readonly { readonly personaGroupId: string; readonly url: string }[],
  faceGroups: () => Promise<readonly { readonly handleIndex: number; readonly personaGroupId: string }[]>,
  ports: Parameters<typeof repoFaceSelves>[3] & { readonly stamp?: () => string },
): PersonaSelvesPlane {
  // The rest answers live off the planes the face proof vouched for, before any face list resolves.
  const rests = (): PlaneRest[] => planes.map((p) => ports.restOf(selvesRecordOf(p.personaGroupId).url.slice("automerge:".length)));
  return personaSelvesPlaneOver(repoFaceSelves(repo, planes, faceGroups, ports), { rests, ...(ports.stamp ? { stamp: ports.stamp } : {}) });
}
