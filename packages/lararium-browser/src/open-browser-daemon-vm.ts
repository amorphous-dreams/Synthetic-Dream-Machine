/**
 * openBrowserDaemonVm — browser host wrapper over the shared daemon-VM core.
 *
 * The lifecycle lives in @lararium/tw5 `openDaemonVmCore` — ONE core both
 * vessels compose. This file supplies the browser platform pieces:
 *   - spawnWorker  : Web Worker (type: module) (.addEventListener / .postMessage)
 *   - newSyncChannel: global MessageChannel
 *   - daemonHandle  : find-or-create strategy
 *
 * The browser vessel does not yet wire the node-ahead capability proxies
 * (authShore, resolveBinding); when it needs them they compose the same way —
 * a second listener on the core's exposed worker handle.
 *
 * Boot ordering: workerEa resolves only after the daemon island sends "ea".
 * openBrowserVessel awaits it before emitting "live".
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/open-browser-daemon-vm
 */

import {
  emptyLarDoc,
  daemonFaceCanonBag,
  standControlHome,
  type Repo, type AutomergeUrl, type LarDoc,
  type WikiRecipe,
  type IslandMsg_Manifest,
  type IslandGrants,
  type VesselWorkerHandle,
  type CapabilityRecord,
  answerIslandAsks,
} from "@lararium/mesh";
import {
  openDaemonVmCore,
  VerbTable,
  type DaemonVmHost,
  type DaemonVmCore,
} from "@lararium/tw5";
import { browserNewSyncChannel, browserSpawnWorker } from "./worker-handle.js";

export interface BrowserDaemonVmOptions {
  repo:             Repo;
  daemonUrl:         string;
  /** The persona plane's doc URL (the PersonaGroup veiled identity) — resolved alongside the daemon doc. */
  /** ABSENT on a place that never grew a face. */
  personaUrl?:       string;
  /** The mounted plane's bag id, resolved once at the boot path — carried, never re-derived here. */
  personaBagId?:     string;
  /** SHA-256 hex of TW5 core blob. null = pre-CAS path. */
  coreHash:         string | null;
  /** CIDs of the engine's plugin-tiddler blobs — the worker pulls them by CID from OPFS. */
  pluginCids?:      readonly string[];
  /** Canonical one-recipe model for the daemon island. */
  recipe:           WikiRecipe;
  faceRelation?:    string | null;
  /** Typed structural capabilities (engine doc, daemon bag, the lares bag, catalog registry access). */
  grants:           IslandGrants;
  /**
   * Operator authn/z material delivered to the daemon island for in-worker
   * keyhive boot (Stage 1) — seed + sentinel hexes + bags to register.
   */
  daemonAuth?:       IslandMsg_Manifest["daemonAuth"];
  /** D-VR-C: persist only the explicit daemon document in its owned scope. */
  ownedDocument?:    boolean;
  /** URL of the compiled browser daemon island Worker script. */
  workerScriptUrl:  URL;
  /** The spawn seam. ABSENT → a dedicated module Worker at `workerScriptUrl` (today's path). PRESENT → the
   *  shared holder's port wrapped as the handle (shared-holder.ts): the island stands once per house and
   *  this tab attaches to it; no worker spawns here. */
  spawnWorker?:     (url: URL) => VesselWorkerHandle;
  /** THE CAPABILITY RECORD this vessel hands its daemon island (`browser-island-caps.ts`): the vessel worker answers the
   *  island's `cas:want`, `receipt:request`, `dyad:ask`, `custody:write` and `session:sign` through it, read at ask time. */
  caps:             CapabilityRecord;
  /** The holder path installs this factory for a replacement manifest after a late floor swap. */
  onManifestReplay?: (rePost: () => { msg: IslandMsg_Manifest; transfer: MessagePort[]; afterPost?: () => void }) => void;
}

export { VerbTable };
export type { VerbTable as BrowserVerbTable };
export type { VerbReactor } from "@lararium/tw5";

/** Stable browser storage namespace for the one explicit worker-owned document. */
export function ownedDaemonDbName(daemonUrl: string): string {
  return `lararium:daemon-owned:${encodeURIComponent(daemonUrl)}`;
}

export interface BrowserVerbPlacementRequest {
  verb:         string;
  args:         Record<string, unknown>;
  requestedBy?: string;
  requestId?:   string;
  fromUri?:     string;
  listenable?:  string;
}

/**
 * A spawned daemon island asks through the record (`answerIslandAsks`), and its answers, the document store's door
 * among them, leave with the island. A browser Worker gives no exit event, so the island's leaving reads off every event
 * it does give, the way the daemon VM core ends its own asks: its `fault` frame, its error (a crash), its exit (the
 * handle's own terminate). Each detaches the door's cell, so every seal or open still waiting refuses by name at once,
 * and a later one refuses at once (no island answers the door).
 */
export function islandAskingThroughRecord(handle: VesselWorkerHandle, caps: CapabilityRecord): VesselWorkerHandle {
  const stop = answerIslandAsks(handle, caps);
  let ended = false;
  const offs: Array<() => void> = [];
  const end = (): void => {
    if (ended) return;
    ended = true;
    for (const off of offs.splice(0)) off();
    stop();
  };
  offs.push(handle.onError(() => end()));
  if (handle.onExit) offs.push(handle.onExit(() => end()));
  offs.push(handle.listen((raw) => { if ((raw as { type?: unknown } | null)?.type === "fault") end(); }));
  return { ...handle, terminate: () => { end(); handle.terminate(); } };
}

export async function openBrowserDaemonVm(
  opts: BrowserDaemonVmOptions,
): Promise<DaemonVmCore> {
  const { repo, daemonUrl, personaUrl, personaBagId, coreHash, pluginCids, recipe, grants, daemonAuth, ownedDocument = false, workerScriptUrl, spawnWorker, onManifestReplay, caps } = opts;
  const canonBag = opts.faceRelation && grants.canonUrl ? daemonFaceCanonBag(opts.faceRelation) : undefined;
  const daemonRecipe: WikiRecipe = { ...recipe, ...(canonBag ? { canonBag } : {}) };

  // ── Daemon doc handle (browser strategy: find-or-create) ────────────────────
  const daemonHandle = await (async () => {
    try {
      // automerge-repo 2.6: find() rejects on unavailable → caught below.
      return await repo.find<LarDoc>(daemonUrl as AutomergeUrl);
    } catch {
      return repo.create<LarDoc>(emptyLarDoc());
    }
  })();
  // ── The vessel's control document, named by the daemon document (`control-home`) ──
  const controlHandle = await standControlHome(repo, daemonHandle);
  // ── Persona doc handle (same find-or-create) — the one VM tends both bags ────
  const personaHandle = await (async () => {
    try {
      return personaUrl ? await repo.find<LarDoc>(personaUrl as AutomergeUrl) : undefined;
    } catch {
      return repo.create<LarDoc>(emptyLarDoc());
    }
  })();

  const host: DaemonVmHost = {
    newSyncChannel: browserNewSyncChannel,
    ...(ownedDocument ? { newOwnedSyncChannel: browserNewSyncChannel } : {}),
    // Each island this VM spawns asks through the record, and its answers leave with the worker.
    spawnWorker:    (url) => islandAskingThroughRecord((spawnWorker ?? browserSpawnWorker)(url), caps),
    awaitReady:     true,
    ...(onManifestReplay ? { onManifestReplay } : {}),
  };

  // The wrapper IS the shore — host pieces + find-or-create daemonHandle; the lifecycle and the
  // whole result surface (DaemonVmCore) live once in the core. Return it directly, no re-spread.
  return openDaemonVmCore(host, {
    repo, daemonHandle, controlHandle, recipe: daemonRecipe, grants, coreHash,
    ...(personaHandle ? { personaHandle } : {}),
    ...(personaBagId  ? { personaBagId }  : {}),
    ...(pluginCids?.length ? { pluginCids } : {}),
    ...(daemonAuth ? { daemonAuth } : {}),
    ...(ownedDocument ? { ownedDocument: {
      documentUrl: daemonUrl,
      storage: { type: "idb" as const, dbName: ownedDaemonDbName(daemonUrl) },
    } } : {}),
    workerScriptUrl,
  });
}
