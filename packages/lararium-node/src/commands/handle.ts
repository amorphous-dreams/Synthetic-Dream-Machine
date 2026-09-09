/**
 * `lares handle publish` — the Node adapter for the publicly published "here I am" note (a Handle).
 *
 * A Handle is a persona's outward face: a self-certifying card carrying its glamour, put on the Nexus's WHO
 * board so the relay carries it to peers. The card anchors to its persona — the daemon doc's persona-KEL
 * prefix seats as the face's owner, so a lost presentation key recovers THROUGH the persona rather than
 * orphaning the face. This adapter opens the store, loads the persona seed + prefix, resolves the WHO board,
 * and mints + announces.
 *
 * Only the disk/store shores belong here; the mint logic (the veiled key, the monotone lineage, the announce)
 * is platform-blind in @lararium/mesh (publishPersonaGlamour), the very code a browser vessel runs.
 */
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import { readFileSync, existsSync } from "node:fs";
import {
  DAEMON_BAG_ID, materializeSharedLarDoc, whoBoardDocUrl,
  publishHandleFromDaemonDoc,
  type LarDoc, type HandleCard,
} from "@lararium/mesh";
import { larDataDir, larBootstrapPath } from "../vessel-paths.js";
import {
  loadPersonaGroupRootSeed, loadVesselVerifyingKey, makeNodePublicHandleStore, loadActivePersonaIndex,
} from "../node-vessel-identity.js";

export interface HandlePublishOptions {
  /** The display name the world reads — "Guru-Josh", "The Dread Pirate Roberts". */
  readonly glamour: string;
  /** Which persona publishes; defaults to the worn persona, then 0. */
  readonly handleIndex?: number;
  readonly storageDir?: string;
  /** Injected clock for determinism in tests; defaults to now. */
  readonly now?: number;
}

/**
 * runHandlePublish — the disk adapter: resolve the daemon doc + WHO board from the vessel's own store, load
 * the persona seed at the chosen index, and publish the Handle. The WHO board rides the deterministic per-Nexus
 * id (nexusPubkey = this vessel's verifying key), so the announce lands on the island board the relay syncs.
 */
export async function runHandlePublish(opts: HandlePublishOptions): Promise<HandleCard> {
  const storageDir = opts.storageDir ?? larDataDir();
  const bootstrap  = larBootstrapPath();
  if (!existsSync(bootstrap)) {
    throw new Error(`[lares handle publish] ${bootstrap} not found — run \`lares vessel found\` first.`);
  }
  const tiddlers = (JSON.parse(
    (JSON.parse(readFileSync(bootstrap, "utf8")) as { text?: string }).text ?? "{}",
  ) as { tiddlers?: Record<string, { text?: string }> }).tiddlers ?? {};
  const daemonUrl = tiddlers[DAEMON_BAG_ID]?.text ?? null;
  if (!daemonUrl) {
    throw new Error("[lares handle publish] daemon doc URL missing from social-bootstrap.json — run `lares vessel found`.");
  }

  const repo     = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  const progress = repo.findWithProgress(daemonUrl as AutomergeUrl);
  const daemonHandle = await Promise.race([
    progress.whenReady(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("[lares handle publish] daemon doc not ready after 5s")), 5000),
    ),
  ]);
  const daemonDoc = daemonHandle.doc() as LarDoc;

  const handleIndex = opts.handleIndex ?? (await loadActivePersonaIndex(storageDir)) ?? 0;
  const seed        = await loadPersonaGroupRootSeed(storageDir, handleIndex);
  const nexusPubkey = await loadVesselVerifyingKey(storageDir);
  const board       = await materializeSharedLarDoc(repo, whoBoardDocUrl(nexusPubkey), "board:who-face");
  const store       = await makeNodePublicHandleStore();

  const card = await publishHandleFromDaemonDoc({
    daemonDoc, board, seed, handleIndex, glamour: opts.glamour, now: opts.now ?? Date.now(), store,
  });
  await repo.flush();
  return card;
}
