/**
 * face-plane-fixture — the catalog and PersonaGroup plane a direct (never-booted) hearth lacks.
 *
 * A device admit seals its issued edge onto the face's PersonaGroup plane, which the catalog names. A boot registers
 * that plane; a suite that drives the admit over a founded-only store stands the same two documents by hand and
 * passes the catalog's url, as the standing vessel's store door does from `catalog-url`.
 */
import type { Repo } from "@automerge/automerge-repo";
import { personaBagIdFor, type LarDoc } from "@lararium/mesh";
import { ownedStore } from "../src/owned-store.js";
import { loadIdentityAnchors } from "../src/identity-anchors.js";

/** Stand the plane of face `handleIndex` in the store at `storageDir`, and return the catalog url that names it. */
export async function standFacePlane(storageDir: string, handleIndex = 0): Promise<string> {
  const anchors = await loadIdentityAnchors(handleIndex);
  if (!anchors) throw new Error("fixture: the face holds no anchors; found it first");
  return ownedStore(storageDir, async (repo: Repo) => {
    const plane = repo.create<LarDoc>({ schemaVersion: "lar/1", tiddlers: {} } as unknown as LarDoc);
    const bagId = personaBagIdFor(anchors.personaGroupId);
    const catalog = repo.create<LarDoc>({
      schemaVersion: "lar/1",
      tiddlers: { [bagId]: { tiddler: { title: bagId, text: plane.url } } },
    } as unknown as LarDoc);
    await repo.flush([plane.documentId, catalog.documentId]);
    return catalog.url as string;
  });
}
