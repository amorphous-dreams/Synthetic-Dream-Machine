/**
 * browser-handle-publish — a browser/phone vessel publishes a Handle (the public "here I am"), with no node
 * CLI in reach. The browser twin of node's `runHandlePublish`: the ACT is one and platform-blind
 * (`publishHandleForFace`, @lararium/mesh); only the shores differ. Here they read the ORIGIN's own
 * IndexedDB — the persona-vault for the seed and the selected face's anchors, the sealed face-anchor row, the browser
 * public-handle store for the vessel's own published faces — while the caller supplies the resolved WHO board and
 * the per-Nexus persona-KEL board its boot already holds. The owner comes from the selected face's sealed anchor through
 * `readFaceOwner` (the one door); a face with no anchor or no verified chain REFUSES, so a browser face never self-owns
 * and no daemon document chooses its owner.
 */
import type { DocHandle } from "@automerge/automerge-repo";
import {
  publishHandleForFace, loadPersonaRootSeed, readFaceOwner, personaKelChainForPrefix,
  type LarDoc, type HandleCard, type FaceOwner,
} from "@lararium/mesh";
import { makeBrowserIdbPersonaVault, makeBrowserPublicHandleStore } from "./browser-vessel-identity.js";
import { loadBrowserFaceAnchor } from "./browser-face-anchor.js";

/**
 * The owner of the face the verb selects: the sealed anchor of persona `handleIndex` (its PersonaGroup names the anchor row),
 * read against the verified persona-KEL chain beneath the anchor's prefix on `kelBoard`. Refuses by name on a missing anchor,
 * a missing or forked chain, or a chain under another prefix.
 */
export async function readHandleOwnerBrowser(opts: {
  handleIndex: number; kelBoard: Pick<DocHandle<LarDoc>, "doc">; idbName: string; verb: string;
}): Promise<FaceOwner> {
  const group  = (await (await makeBrowserIdbPersonaVault(opts.idbName)).anchors.load(opts.handleIndex))?.personaGroupId ?? null;
  const anchor = group ? await loadBrowserFaceAnchor(opts.idbName, group) : null;
  const chain  = anchor ? personaKelChainForPrefix(opts.kelBoard.doc() as LarDoc, anchor.personaKelPrefix) : null;
  const read   = await readFaceOwner(chain, anchor);
  if (!read.ok) throw new Error(`[browser handle ${opts.verb}] persona h${opts.handleIndex}: ${read.reason}`);
  return read.owner;
}

/**
 * Publish a persona-anchored Handle from a browser vessel. `board` is the resolved WHO board (the boot holds it via
 * whoFaceCap); `kelBoard` the per-Nexus persona-KEL board the owner's chain reads from; the seed + store read the origin's
 * IDB at `idbName`. Reuses the browser vessel's existing seed custody — it mints no new key material of its own.
 */
export async function publishHandleBrowser(opts: {
  board:       DocHandle<LarDoc>;
  kelBoard:    Pick<DocHandle<LarDoc>, "doc">;
  handleIndex: number;
  glamour:     string;
  idbName?:    string;
}): Promise<HandleCard> {
  const idbName = opts.idbName ?? "lares:vessel";
  const owner = await readHandleOwnerBrowser({ handleIndex: opts.handleIndex, kelBoard: opts.kelBoard, idbName, verb: "publish" });
  const seed  = await loadPersonaRootSeed(await makeBrowserIdbPersonaVault(idbName), opts.handleIndex);
  const store = await makeBrowserPublicHandleStore(idbName);
  return publishHandleForFace({
    owner, board: opts.board, seed, handleIndex: opts.handleIndex, glamour: opts.glamour, store,
  });
}
