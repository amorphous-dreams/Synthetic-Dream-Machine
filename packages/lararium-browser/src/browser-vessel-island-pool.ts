/**
 * BrowserVesselIslandPool — browser host construction over VesselIslandPoolCore.
 *
 * The pool logic (residency, mount/unmount handshakes, placeWikiVerb, event
 * routing) lives once in @lararium/mesh `VesselIslandPoolCore`. This file
 * supplies only the browser platform host: Web Worker spawn, a global
 * MessageChannel, and the ES-module worker's "ready" (WASM-load) handshake.
 * Browser inherits the residency model by subtraction; `pinned` is honored the
 * moment a finite hotCap creates eviction pressure.
 *
 * The pool supplies no explicit storage config: ordinary browser islands retain
 * their legacy IndexedDB partition keyed by wiki URI inside the worker. D-VR
 * daemon ownership is a separate explicit manifest capability.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-vessel-island-pool
 */

import {
  VesselIslandPoolCore,
  type Repo,
  type IslandMsg_Event,
  type LarIslandToVesselMsg,
  type WikiRecipe,
} from "@lararium/mesh";
import { browserNewSyncChannel, browserSpawnWorker } from "./worker-handle.js";
import { refuseBrowserDyadAsks } from "./browser-dyad-door.js";
import { readCasBlobFromOpfs } from "./browser-genesis.js";

export interface BrowserVesselIslandPoolOptions {
  /**
   * URL of the compiled browser-wiki-worker entry script. Optional at
   * construction; required before mountWiki (a placeholder pool may predate the
   * genesis island that supplies TW5 core bytes).
   */
  workerScriptUrl?: URL;
  /** Vessel Automerge Repo — each island's mainPort wires to it for CRDT sync. */
  mainRepo?: Repo;
  /** Called when an island outside any session emits a verse-event reaction or one of the camera's kinds
   *  (`lar:frame`, `lar:control-result`, `lar:service`); a session island's traffic reaches its own surface door instead. */
  onWorkerEvent?: (id: string, msg: IslandMsg_Event | LarIslandToVesselMsg) => void;
  /** R4 — resolve ONE mount's own `recipe` into the CIDs its manifest should carry (the fixed
   *  boot-set floor UNION its verified, byte-checked offering selection). REQUIRED: the flat
   *  vessel-wide `pluginCids` floor has retired — `VesselIslandPoolCore` itself refuses to
   *  construct without this, so the browser can supply no blanket list even by omission. See
   *  `resolveBrowserIslandPluginCids` in `open-browser-vessel.ts`. */
  resolvePluginCids: (recipe: WikiRecipe) => Promise<
    | { readonly ok: true; readonly pluginCids: readonly string[] }
    | { readonly ok: false; readonly error: string }
  >;
}

/** Browser island pool: VesselIslandPoolCore configured with a Web Worker host. */
export class BrowserVesselIslandPool extends VesselIslandPoolCore {
  constructor(opts: BrowserVesselIslandPoolOptions) {
    const workerUrl = opts.workerScriptUrl ?? null;
    super({
      resolvePluginCids: opts.resolvePluginCids,
      host: {
        spawnWorker: () => {
          if (!workerUrl) {
            throw new Error(
              "[browser-vessel-island-pool] cannot mountWiki — no workerScriptUrl set. " +
              "Pass workerScriptUrl when constructing the pool (requires genesis island for TW5 core bytes).",
            );
          }
          // A wiki island reaches no dyad door: its ask draws `aside` and one named warning.
          const handle = browserSpawnWorker(workerUrl);
          refuseBrowserDyadAsks(handle);
          return handle;
        },
        newSyncChannel: browserNewSyncChannel,
        storage: () => undefined,
        awaitReady: true,
      },
      mainRepo: opts.mainRepo ?? null,
      // The vessel's content store, as a session island's scoped view reads it: the origin's OPFS plane.
      readContent: (cid) => readCasBlobFromOpfs(cid),
      ...(opts.onWorkerEvent ? { onWorkerEvent: opts.onWorkerEvent } : {}),
    });
  }
}
