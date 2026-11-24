/**
 * VesselIslandPool — node host construction over the shared VesselIslandPoolCore.
 *
 * The pool logic (residency wela/anu + pin, LRU, placeWikiVerb, diskMirror,
 * handshakes) lives once in @lararium/mesh `VesselIslandPoolCore`. This file
 * supplies only the node platform host: worker_threads worker spawn and a
 * worker_threads MessageChannel. No island it spawns keeps a store: the vessel's
 * Repo rests every document once, and each island relays through it. The TW5Engine
 * lives inside the Worker thread; the vessel holds no engine reference
 * (no-VM-on-main-thread).
 *
 * Meme: lar:///ha.ka.ba/lararium/node/vessel-island-pool
 */

import {
  VesselIslandPoolCore, houseCanonSlugsSeated,
  type Repo,
  type IslandMsg_Event,
  type LarIslandToVesselMsg,
  type WikiRecipe,
  type PortIslandToVesselMsg,
  type CapabilityRecord,
  type LarDoc,
  type WikiMountSpec,
} from "@lararium/mesh";
import { islandStoreDir, islandStoreLeftLine } from "./island-store-left.js";
import { floorShadowFileStore } from "./floor-shadow-file.js";
import type { PortPolicy } from "@lararium/mesh/port-lease";
import { nodeNewSyncChannel, nodeSpawnSessionWorker, nodeSpawnWikiWorker } from "./worker-handle.js";
import { readCasBlobFromFs, type IslandCasData } from "./node-cas.js";

/**
 * The vessel's content store, as a session island's scoped view reads it: the vessel's one runtime `cid/` dir
 * (`cidDir`, handed at construction), then the vessel's `cas` capability, read off the record at ask time (absent, or
 * faulting, reads a miss; the corpus store rides inside that capability as its second tier). A session island holds no
 * store of its own, so every content read it makes arrives here, after its view has passed the address. No env read.
 */
export function nodeContentReader(cidDir: string | null, caps: CapabilityRecord): (cid: string) => Promise<Uint8Array | null> {
  return async (cid) =>
    (cidDir ? readCasBlobFromFs(cid, cidDir) : null)
      ?? (caps.cas ? caps.cas(cid).catch(() => null) : null);
}

/** Node's default live-wiki activation cap — the vessel advertises this as the
 *  `wiki` typeCap on the ONE residency collector (the collector, not the pool, now
 *  bounds live wikis). A resource-rich vessel; the browser advertises a smaller grant. */
export const NODE_WIKI_ACTIVATION_CAP = 4;
const DEFAULT_WORKER_URL = new URL("./node-wiki-island.js", import.meta.url);

export interface VesselIslandPoolOptions {
  /**
   * THE CAPABILITY RECORD the vessel hands every island this pool spawns. A wiki island reaches its `cas` alone (its
   * receipt, custody and dyad asks refuse by name); a session island reaches none. The members read at ask time.
   */
  caps: CapabilityRecord;
  /** Compiled island entry script. Defaults to node-wiki-island.js alongside this module. */
  workerScriptUrl?: URL;
  /** Called when an island outside any session emits an `event` (RE reaction) or one of the camera's kinds
   *  (`lar:frame`, `lar:control-result`, `lar:service`); a session island's traffic reaches its own surface door instead. */
  onWorkerEvent?: (wikiId: string, msg: IslandMsg_Event | LarIslandToVesselMsg) => void;
  /** Called when the island's ea declaration lands — the mailbox drain rides the breath. */
  onEa?: (wikiId: string) => void;
  /** Vessel Automerge Repo — each island's mainPort wires to it for CRDT sync. */
  mainRepo?: Repo;
  portPolicy?: PortPolicy;
  onPortMessage?: (binding: string, islandKey: string, msg: PortIslandToVesselMsg) => void;
  onPortDrop?: (islandKey: string, type: string, reason: "no-port-lease") => void;
  /** The vessel's store dir: the floor shadow tally rests beside it. No island this pool spawns keeps a store there. */
  storageRoot?: string;
  /** The vessel's ONE runtime `cid/` dir, handed at construction: the pool's content reader and every island it spawns read it. */
  cidDir?: string;
  /** The CORPUS CAS dir the vessel resolved at construction, handed to each WIKI island it spawns (the islands read no env; a session island gets no dir, it reads through its view). */
  corpusCasDir?: string | null;
  /** R3/M6 — resolve a mount's OWN recipe into its final pluginCids (the boot-set floor UNION its
   *  verified offering selection). REQUIRED — no flat vessel-wide `pluginCids` floor stands (every island
   *  getting the SAME list); `open-node-vessel.ts` always supplies
   *  `resolveNodeIslandPluginCids` (`node-plugin-resolution.ts`) at both its call sites, and
   *  `VesselIslandPoolCore`'s own constructor refuses to build a pool with no resolver at all
   *  (`VesselIslandPoolCoreOptions.resolvePluginCids`, M6). See that module's docblock. */
  resolvePluginCids: (recipe: WikiRecipe) => Promise<
    | { readonly ok: true; readonly pluginCids: readonly string[] }
    | { readonly ok: false; readonly error: string }
  >;
  /** The floor each mount stands on: the vessel's accepted pin (`@lararium/mesh` `vesselFloorCid`); null mounts genesis. */
  floorCid?: () => string | null | Promise<string | null>;
  /** The founding record (the genesis island document): each wiki mount shadow-reads its floor beside it (`floor-shadow`). */
  foundingRecord?: () => LarDoc | null | undefined;
  /** Held disk-write capability: canon bag → mirror configs this pool MAY project. */
  diskMirrorGrant?: readonly { bagId: string; mirrorRoot: string; scope: string; perWikiSlug?: boolean; selfCanon?: boolean }[];
  /** The person's stand-off collapse rules, read from the worn face's daemon wiki at each mount (`IslandMsg_Manifest.shoreCollapse`). */
  shoreCollapse?: () => Readonly<Record<string, readonly string[]>> | null | Promise<Readonly<Record<string, readonly string[]>> | null>;
  /** Override the mount silence budget in ms (tests). */
  mountSilenceMs?: number;
  /** Override the mount progress-stall budget in ms (default 3x silence). */
  mountStallMs?: number;
  /** Mount failures tolerated per wiki in a row before the cap trips. */
  maxMountFailures?: number;
}

/** Node island pool: VesselIslandPoolCore configured with a worker_threads host. */
export class VesselIslandPool extends VesselIslandPoolCore {
  readonly #storageRoot: string | null;
  /** Each left island store this pool has named, so a remount names nothing twice. */
  readonly #named = new Set<string>();

  constructor(options: VesselIslandPoolOptions) {
    const workerUrl   = options.workerScriptUrl ?? DEFAULT_WORKER_URL;
    const storageRoot = options.storageRoot ?? null;
    const casData: IslandCasData = { cidDir: options.cidDir ?? null, corpusCasDir: options.corpusCasDir ?? null, houseCanon: houseCanonSlugsSeated() };
    super({
      host: {
        spawnWorker: (spawn) => (spawn?.session ? nodeSpawnSessionWorker(workerUrl, options.caps) : nodeSpawnWikiWorker(workerUrl, options.caps, casData)),
        newSyncChannel: nodeNewSyncChannel,
      },
      mainRepo: options.mainRepo ?? null,
      readContent: nodeContentReader(options.cidDir ?? null, options.caps),
      diskMirrorGrant: options.diskMirrorGrant ?? [],
      ...(options.shoreCollapse ? { shoreCollapse: options.shoreCollapse } : {}),
      resolvePluginCids: options.resolvePluginCids,
      ...(options.floorCid ? { floorCid: options.floorCid } : {}),
      // The shadow tally rests beside the vessel store, where `lares vessel read` prints it.
      ...(options.foundingRecord ? { foundingRecord: options.foundingRecord } : {}),
      ...(storageRoot ? { floorShadow: floorShadowFileStore(storageRoot) } : {}),
      ...(options.onWorkerEvent ? { onWorkerEvent: options.onWorkerEvent } : {}),
      ...(options.portPolicy ? { portPolicy: options.portPolicy } : {}),
      ...(options.onPortMessage ? { onPortMessage: options.onPortMessage } : {}),
      ...(options.onPortDrop ? { onPortDrop: options.onPortDrop } : {}),
      ...(options.onEa ? { onEa: options.onEa } : {}),
      ...(options.mountSilenceMs       !== undefined ? { mountSilenceMs:       options.mountSilenceMs }       : {}),
      ...(options.mountStallMs         !== undefined ? { mountStallMs:         options.mountStallMs }         : {}),
      ...(options.maxMountFailures     !== undefined ? { maxMountFailures:     options.maxMountFailures }     : {}),
    });
    this.#storageRoot = storageRoot;
  }

  /** A wiki's first mount names the island store an older composition left for it (`island-store-left`), once. */
  override mountWiki(wikiId: string, spec: WikiMountSpec, opts: { pinned?: boolean } = {}): Promise<void> {
    if (this.#storageRoot) {
      const dir = islandStoreDir(this.#storageRoot, wikiId);
      if (!this.#named.has(dir)) {
        this.#named.add(dir);
        const line = islandStoreLeftLine(dir);
        if (line) console.warn(line);
      }
    }
    return super.mountWiki(wikiId, spec, opts);
  }
}

