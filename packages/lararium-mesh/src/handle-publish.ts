/**
 * handle-publish — the platform-blind orchestration behind publishing a Handle (the public "here I am").
 *
 * A vessel of ANY class runs this: a node CLI, a browser tab, a phone. The disk/store shores differ per
 * platform, but the ACT stays one — take the owner from the selected face's sealed anchor through the door
 * (`readFaceOwner`), seat its Persona KEL prefix as the face's owner, mint the card, announce it. Keeping it here lets a
 * phone-only holder (three phones, a friend's Nexus) publish a face with no node vessel in reach.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/handle-card · lar:///ha.ka.ba/lararium/mesh/identity-classes
 */
import type { DocHandle } from "@automerge/automerge-repo";
import { isFaceOwner, type FaceOwner } from "./face-reading.js";
import { publishPersonaGlamour } from "./persona-glamour.js";
import type { LarDoc } from "./base-doc.js";
import type { HandleCard } from "./handle-card.js";
import type { OwnPublicHandleStore } from "./persona-glamour.js";

/**
 * Publish a Handle owned by the persona the selected face's sealed anchor names. The owner comes from `readFaceOwner` and
 * nowhere else: a daemon tiddler never chooses it, and a face with no issued owner REFUSES (a face never falls back to
 * self-ownership, which resolves to no persona head and forecloses recovery). Platform-blind: the caller supplies the
 * resolved board + the persona seed + the vessel's own published-faces store.
 */
export async function publishHandleForFace(opts: {
  owner: FaceOwner;
  board: DocHandle<LarDoc>;
  seed: Uint8Array;
  handleIndex: number;
  glamour: string;
  store: OwnPublicHandleStore;
}): Promise<HandleCard> {
  if (!isFaceOwner(opts.owner)) {
    throw new Error("[handle-publish] the owner did not come through the door (readFaceOwner) — a face belongs to its persona, never itself, and never to a document's say-so (fail-closed).");
  }
  return publishPersonaGlamour({
    board: opts.board, seed: opts.seed, handleIndex: opts.handleIndex,
    glamour: opts.glamour, store: opts.store,
    ownerPersonaKelPrefix: opts.owner.personaKelPrefix,
  });
}
