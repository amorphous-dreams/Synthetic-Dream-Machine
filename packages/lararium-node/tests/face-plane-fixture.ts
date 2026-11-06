/**
 * face-plane-fixture — the catalog a direct (never-booted) hearth lacks.
 *
 * A device admit seals its issued edge onto the face's PersonaGroup plane: the plane the founding's bootstrap names, which
 * the admit's own projection verifies against the face's lineage, and a catalog row naming another plane refuses by name
 * (`device-admit.ts`, the face-proof check). A boot registers the bootstrap's plane into the catalog (`open-node-vessel.ts`,
 * the worn face's proven plane), so the two agree by construction; a suite that drives the admit over a founded-only store
 * stands that same catalog row by hand, naming the bootstrap's plane, never a fresh one, and passes the catalog's url, as the
 * standing vessel's store door does from `catalog-url`.
 */
import { readFileSync } from "node:fs";
import type { Repo } from "@automerge/automerge-repo";
import { ownEntry, personaBagIdFor, type LarDoc } from "@lararium/mesh";
import { ownedStore } from "../src/owned-store.js";
import { loadIdentityAnchors } from "../src/identity-anchors.js";
import { larBootstrapPath } from "../src/vessel-paths.js";

/** Stand a catalog naming face `handleIndex`'s PersonaGroup plane (the bootstrap's) in the store at `storageDir`; return its url. */
export async function standFacePlane(storageDir: string, handleIndex = 0): Promise<string> {
  const anchors = await loadIdentityAnchors(handleIndex);
  if (!anchors) throw new Error("fixture: the face holds no anchors; found it first");
  const bagId = personaBagIdFor(anchors.personaGroupId);
  const plugin = JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text?: string };
  const tiddlers = (JSON.parse(plugin.text ?? "{}") as { tiddlers?: Record<string, { text?: string }> }).tiddlers ?? {};
  const planeUrl = ownEntry(tiddlers, bagId)?.text;
  if (!planeUrl) throw new Error("fixture: the founding's bootstrap names no PersonaGroup plane; found the face first");
  return ownedStore(storageDir, async (repo: Repo) => {
    const catalog = repo.create<LarDoc>({
      schemaVersion: "lar/1",
      tiddlers: { [bagId]: { tiddler: { title: bagId, text: planeUrl } } },
    } as unknown as LarDoc);
    await repo.flush([catalog.documentId]);
    return catalog.url as string;
  });
}
