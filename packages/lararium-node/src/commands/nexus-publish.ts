/**
 * nexus-publish — the Node shore of the immutable plugin offering door.
 *
 * This command publishes one local operator's already-baked plugin collection. The offering is a gift:
 * it signs the genesis-derived descriptors, verifies the signed record, then places the exact record on
 * the local Nexus Crossroads board. It never changes grammar, installs bytes, or consults Offering Antigen.
 *
 * The active persona is explicit custody. A faceless Node can carry a Crossroads board, but it cannot
 * publish in a human's name; an unset selector therefore refuses instead of choosing handle zero.
 */

import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  crossroadsDocUrl,
  ed25519SignerFromSeed,
  materializeSharedLarDoc,
  pluginOfferingCid,
  signPluginOffering,
  verifyPluginOffering,
  writeOfferingAnnounce,
  type PluginOffering,
} from "@lararium/mesh";
import { readGenesisCasManifest } from "../genesis-artifact.js";
import { larDataDir } from "../vessel-paths.js";
import {
  loadActivePersonaIndex,
  loadPersonaGroupRootSeed,
  loadPersonaGroupRootVerifyingKey,
  loadVesselVerifyingKey,
  personaRootExists,
} from "../node-vessel-identity.js";
import { nodeNexusIsland } from "../nexus-standing.js";

export class NexusPublishError extends Error {}

export interface NexusPublishPluginsOptions {
  readonly storageDir?: string;
  readonly genesisDir?: string;
}

export interface NexusPublishPluginsResult {
  readonly offering: PluginOffering;
  readonly offeringCid: string;
  readonly boardUrl: string;
  readonly offeror: string;
  readonly pluginsCid: string;
  readonly blobCount: number;
}

/** Sign and announce the local genesis plugin collection on this vessel's Nexus Crossroads. */
export async function runNexusPublishPlugins(
  opts: NexusPublishPluginsOptions = {},
): Promise<NexusPublishPluginsResult> {
  const handleIndex = await loadActivePersonaIndex();
  if (handleIndex === undefined) {
    throw new NexusPublishError(
      "publishing requires an active persona — wear a held persona before offering a collection",
    );
  }
  if (!(await personaRootExists(handleIndex))) {
    throw new NexusPublishError(
      `the active persona h${handleIndex} is not held by this vessel — publishing refuses without root custody`,
    );
  }

  const manifest = readGenesisCasManifest(opts.genesisDir);
  if (!manifest) {
    throw new NexusPublishError(
      "publishing requires a readable genesis seed — no plugin collection was offered",
    );
  }
  if (typeof manifest.pluginsCid !== "string" || manifest.pluginsCid.length === 0) {
    throw new NexusPublishError("the genesis seed carries no plugin collection to offer");
  }

  const blobs = manifest.blobs
    .filter((blob) => blob.id.startsWith("$:/plugins/"))
    .map((blob) => ({ id: blob.id, version: blob.version, sha256: blob.cid }));
  const offeror = await loadPersonaGroupRootVerifyingKey(handleIndex);
  if (!offeror) {
    throw new NexusPublishError(
      `the active persona h${handleIndex} has no readable public root — publishing refuses`,
    );
  }
  const offering = await signPluginOffering(
    { offeror: offeror.toLowerCase(), pluginsCid: manifest.pluginsCid, blobs },
    ed25519SignerFromSeed(await loadPersonaGroupRootSeed(handleIndex)),
  );
  const verified = await verifyPluginOffering(offering);
  if (!verified.ok) {
    throw new NexusPublishError(`refusing to announce an offering that does not self-verify: ${verified.reason}`);
  }

  const vesselKey = await loadVesselVerifyingKey();
  const boardUrl = crossroadsDocUrl(nodeNexusIsland({ ownVesselKey: vesselKey }));
  const repo = new Repo({ storage: new NodeFSStorageAdapter(opts.storageDir ?? larDataDir()) });
  try {
    const board = await materializeSharedLarDoc(repo, boardUrl, "board:crossroads");
    // The key is the complete signed offering CID. Re-running therefore replaces only the same exact
    // projection; a changed collection or signing hand receives a distinct additive address.
    board.change((draft) => writeOfferingAnnounce(draft, offering));
    await repo.flush();
    const offeringCid = pluginOfferingCid(offering);
    return {
      offering,
      offeringCid,
      boardUrl,
      offeror: offering.offeror,
      pluginsCid: offering.pluginsCid,
      blobCount: offering.blobs.length,
    };
  } finally {
    await repo.flush().catch(() => { /* best-effort final flush */ });
  }
}
