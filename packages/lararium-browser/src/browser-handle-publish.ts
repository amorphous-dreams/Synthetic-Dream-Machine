/**
 * browser-handle-publish — a browser/phone vessel publishes a Handle (the public "here I am"), with no node
 * CLI in reach. The browser twin of node's `runHandlePublish`: the ACT is one and platform-blind
 * (`publishHandleFromDaemonDoc`, @lararium/mesh); only the shores differ. Here they read the ORIGIN's own
 * IndexedDB — the persona-vault for the seed, the browser public-handle store for the vessel's own published
 * faces — while the caller supplies the daemon doc and the resolved WHO board its boot already holds
 * (whoFaceCap). The fail-closed fence rides in the core: a daemon doc with no persona-KEL prefix REFUSES, so a
 * browser face never self-owns, exactly as the node CLI refuses.
 */
import type { DocHandle } from "@automerge/automerge-repo";
import {
  publishHandleFromDaemonDoc, loadPersonaRootSeed,
  type LarDoc, type HandleCard,
} from "@lararium/mesh";
import { makeBrowserIdbPersonaVault, makeBrowserPublicHandleStore } from "./browser-vessel-identity.js";

/**
 * Publish a persona-anchored Handle from a browser vessel. `daemonDoc` carries the persona-KEL prefix (its
 * absence refuses in the core); `board` is the resolved WHO board (the boot holds it via whoFaceCap); the
 * seed + store read the origin's IDB at `idbName`. Reuses the browser vessel's existing seed custody — it
 * mints no new key material of its own.
 */
export async function publishHandleBrowser(opts: {
  daemonDoc:   LarDoc;
  board:       DocHandle<LarDoc>;
  handleIndex: number;
  glamour:     string;
  idbName?:    string;
  now?:        number;
}): Promise<HandleCard> {
  const idbName = opts.idbName ?? "lares:vessel";
  const seed  = await loadPersonaRootSeed(await makeBrowserIdbPersonaVault(idbName), opts.handleIndex);
  const store = await makeBrowserPublicHandleStore(idbName);
  return publishHandleFromDaemonDoc({
    daemonDoc:   opts.daemonDoc,
    board:       opts.board,
    seed,
    handleIndex: opts.handleIndex,
    glamour:     opts.glamour,
    now:         opts.now ?? Date.now(),
    store,
  });
}
