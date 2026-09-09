/**
 * handle-publish — the platform-blind orchestration behind publishing a Handle (the public "here I am").
 *
 * A vessel of ANY class runs this: a node CLI, a browser tab, a phone. The disk/store shores differ per
 * platform, but the ACT stays one — read the persona-KEL prefix off the daemon doc, seat it as the face's
 * owner, mint the card, announce it. Keeping it here lets a phone-only holder (three phones, a friend's
 * Nexus) publish a face with no node vessel in reach.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/handle-card · lar:///ha.ka.ba/lararium/mesh/identity-classes
 */
import type { DocHandle } from "@automerge/automerge-repo";
import { PERSONA_KEL_PREFIX_TIDDLER } from "./lar-uris.js";
import { tiddlerText } from "./base-doc.js";
import { publishPersonaGlamour } from "./persona-glamour.js";
import type { LarDoc } from "./base-doc.js";
import type { HandleCard } from "./handle-card.js";
import type { OwnPublicHandleStore } from "./persona-glamour.js";

/**
 * Read the persona-KEL prefix off the daemon doc and publish a Handle owned by that persona. FAILS CLOSED
 * when the doc carries no prefix — a face with no persona to own it never falls back to self-ownership
 * (self-ownership resolves to no persona head and forecloses recovery), so the absence refuses. Platform-blind:
 * the caller supplies the resolved board + the persona seed + the vessel's own published-faces store.
 */
export async function publishHandleFromDaemonDoc(opts: {
  daemonDoc: LarDoc;
  board: DocHandle<LarDoc>;
  seed: Uint8Array;
  handleIndex: number;
  glamour: string;
  now: number;
  store: OwnPublicHandleStore;
}): Promise<HandleCard> {
  const prefix = tiddlerText(
    (opts.daemonDoc as { tiddlers?: Record<string, unknown> }).tiddlers?.[PERSONA_KEL_PREFIX_TIDDLER] as never,
  );
  if (!prefix) {
    throw new Error(
      "[handle-publish] no persona-KEL prefix on the daemon doc — a face belongs to its persona, " +
      "never itself; found the vessel first (fail-closed, the face never self-owns).",
    );
  }
  return publishPersonaGlamour({
    board: opts.board, seed: opts.seed, handleIndex: opts.handleIndex,
    glamour: opts.glamour, now: opts.now, store: opts.store,
    ownerPersonaKelPrefix: prefix,
  });
}
