/**
 * browser-sovereign-island-model — browser host shore for the sovereign kernel.
 *
 * The lifecycle itself lives in @lararium/tw5 `runSovereignKernel` — ONE flow
 * both vessels compose. This file supplies only the browser platform pieces:
 *   - transport : Web Worker self (self.postMessage / self.addEventListener)
 *   - storage   : ordinary manifests retain their IndexedDB partition keyed by
 *                 wikiUri; a D-VR daemon manifest opts its primary Repo into memory
 *                 and supplies an explicit owned-document IDB scope separately
 *   - ready     : self.postMessage(mkReady()) — IoC handshake; the WASM
 *                 top-level await in this ES-module Worker completes before the
 *                 kernel fires it, so the vessel may send a manifest only after.
 *
 * Divergence is COMPOSITION (which pieces the shore resolves), not an OO
 * platform interface. See feedback_isomorphism_by_composition.
 *
 * ## VM Pool alignment
 *
 *   Browser vessel: Daemon island (sovereign island) + Pinned (primary wiki)
 *                   + N hot islands (session wikis, LRU-evicted to cold)
 *   Every hot island runs via runBrowserSovereignWorker(behavior).
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-sovereign-island-model
 */

import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import {
  runSovereignKernel,
  type IslandHostShore,
} from "@lararium/tw5";
import { mkReady } from "@lararium/mesh";
import type { IslandMsg_Manifest, IslandToVesselMsg } from "@lararium/mesh";
import type { IslandBehavior } from "@lararium/tw5";
import { readCasBlobFromOpfs } from "./browser-genesis.js";

/** Browser storage composition: preserve ordinary wiki durability while the
 * D-VR daemon primary crossing stays ephemeral. */
export function browserIslandStorage(msg: IslandMsg_Manifest) {
  if (msg.storage?.type === "idb") return new IndexedDBStorageAdapter(msg.storage.dbName);
  if (msg.storage?.type === "memory" || msg.ownedDocument) return undefined;
  return new IndexedDBStorageAdapter(msg.wikiUri);
}

// ── runBrowserSovereignWorker — browser host shore over the shared kernel ────

export function runBrowserSovereignWorker(
  behaviorOrFactory: IslandBehavior | ((manifest: IslandMsg_Manifest) => IslandBehavior),
): void {
  const host: IslandHostShore = {
    post:    (msg: IslandToVesselMsg) => self.postMessage(msg),
    listen:  (onMessage) => self.addEventListener("message", (e: MessageEvent) => onMessage(e.data)),
    storage: browserIslandStorage,
    ready:   () => self.postMessage(mkReady()),
    // The breath path: pull engine + plugin bytes by CID from the OPFS CAS the vessel
    // populated on genesis-load — never CRDT-synced over the port.
    resolveByCid: (cid) => readCasBlobFromOpfs(cid),
  };

  runSovereignKernel(host, behaviorOrFactory);
}
