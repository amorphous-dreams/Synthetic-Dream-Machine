/**
 * VesselIslandPool — node host construction over the shared VesselIslandPoolCore.
 *
 * The pool logic (residency wela/anu + pin, LRU, placeWikiVerb, diskMirror,
 * handshakes) lives once in @lararium/mesh `VesselIslandPoolCore`. This file
 * supplies only the node platform host: worker_threads worker spawn, a
 * worker_threads MessageChannel, and per-wiki NodeFS storage. The TW5Engine
 * lives inside the Worker thread; the vessel holds no engine reference
 * (no-VM-on-main-thread).
 *
 * Meme: lar:///ha.ka.ba/lararium/node/vessel-island-pool
 */

import { join } from "path";
import {
  VesselIslandPoolCore,
  type Repo,
  type IslandMsg_Event,
  type IslandStorageConfig,
  type WikiRecipe,
} from "@lararium/mesh";
import { nodeNewSyncChannel, nodeSpawnWorker } from "./worker-handle.js";

/** Node's default live-wiki activation cap — the vessel advertises this as the
 *  `wiki` typeCap on the ONE residency collector (the collector, not the pool, now
 *  bounds live wikis). A resource-rich vessel; the browser advertises a smaller grant. */
export const NODE_WIKI_ACTIVATION_CAP = 4;
const DEFAULT_WORKER_URL = new URL("./node-wiki-island.js", import.meta.url);

export interface VesselIslandPoolOptions {
  /** Compiled island entry script. Defaults to node-wiki-island.js alongside this module. */
  workerScriptUrl?: URL;
  /** Called when an island emits a IslandMsg_Event (RE reaction). */
  onWorkerEvent?: (wikiId: string, msg: IslandMsg_Event) => void;
  /** Called when the island's ea declaration lands — the mailbox drain rides the breath. */
  onEa?: (wikiId: string) => void;
  /** Vessel Automerge Repo — each island's mainPort wires to it for CRDT sync. */
  mainRepo?: Repo;
  /** Root dir for island-owned NodeFS storage partitions; absent = memory-only. */
  storageRoot?: string;
  /** R3/M6 — resolve a mount's OWN recipe into its final pluginCids (the boot-set floor UNION its
   *  verified offering selection). REQUIRED — the pre-R3 flat `pluginCids` floor (every island
   *  getting the SAME vessel-wide list) has retired; `open-node-vessel.ts` always supplies
   *  `resolveNodeIslandPluginCids` (`node-plugin-resolution.ts`) at both its call sites, and
   *  `VesselIslandPoolCore`'s own constructor refuses to build a pool with no resolver at all
   *  (`VesselIslandPoolCoreOptions.resolvePluginCids`, M6). See that module's docblock. */
  resolvePluginCids: (recipe: WikiRecipe) => Promise<
    | { readonly ok: true; readonly pluginCids: readonly string[] }
    | { readonly ok: false; readonly error: string }
  >;
  /** Held disk-write capability: canon bag → mirror configs this pool MAY project. */
  diskMirrorGrant?: readonly { bagId: string; mirrorRoot: string; scope: string; perWikiSlug?: boolean; selfCanon?: boolean }[];
  /** Override the mount silence budget in ms (tests). */
  mountSilenceMs?: number;
  /** Override the mount progress-stall budget in ms (default 3x silence). */
  mountStallMs?: number;
  /** Mount failures tolerated per wiki inside the window before the cap trips. */
  maxMountFailures?: number;
  /** The intensity window in ms (OTP MaxR/MaxT discipline). */
  mountFailureWindowMs?: number;
}

/** Node island pool: VesselIslandPoolCore configured with a worker_threads host. */
export class VesselIslandPool extends VesselIslandPoolCore {
  constructor(options: VesselIslandPoolOptions) {
    const workerUrl   = options.workerScriptUrl ?? DEFAULT_WORKER_URL;
    const storageRoot = options.storageRoot ?? null;
    super({
      host: {
        spawnWorker: () => nodeSpawnWorker(workerUrl),
        newSyncChannel: nodeNewSyncChannel,
        storage: (wikiId): IslandStorageConfig | undefined =>
          storageRoot ? { type: "nodefs", dir: join(storageRoot, _sanitizeWikiId(wikiId)) } : undefined,
      },
      mainRepo: options.mainRepo ?? null,
      diskMirrorGrant: options.diskMirrorGrant ?? [],
      resolvePluginCids: options.resolvePluginCids,
      ...(options.onWorkerEvent ? { onWorkerEvent: options.onWorkerEvent } : {}),
      ...(options.onEa ? { onEa: options.onEa } : {}),
      ...(options.mountSilenceMs       !== undefined ? { mountSilenceMs:       options.mountSilenceMs }       : {}),
      ...(options.mountStallMs         !== undefined ? { mountStallMs:         options.mountStallMs }         : {}),
      ...(options.maxMountFailures     !== undefined ? { maxMountFailures:     options.maxMountFailures }     : {}),
      ...(options.mountFailureWindowMs !== undefined ? { mountFailureWindowMs: options.mountFailureWindowMs } : {}),
    });
  }
}

/** Convert a lar: URI to a safe filesystem path component. */
function _sanitizeWikiId(wikiId: string): string {
  return wikiId.replace(/^lar:\/\/\//, "").replace(/[^a-zA-Z0-9@._-]/g, "_");
}
