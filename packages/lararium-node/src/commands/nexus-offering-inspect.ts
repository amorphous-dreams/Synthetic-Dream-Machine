/**
 * nexus-offering-inspect — inspect one exact immutable gift already carried by this Nexus.
 *
 * This is deliberately a read seam. It opens the deterministic Crossroads board only when the
 * board already exists, verifies the signed offering, and reports the local CAS gradient. It does
 * not create a board, fetch bytes, consult Offering Antigen, install anything, or touch genesis.
 */

import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  crossroadsDocUrl,
  inspectPluginOffering,
  offeringAnnounceKey,
  PLUGIN_OFFERING_ANNOUNCE_DOMAIN,
  type LarDoc,
  type PluginOfferingAnnounce,
  resolveBootDoc,
} from "@lararium/mesh";
import { larDataDir } from "../vessel-paths.js";
import { casDirForStorage, readCasBlobFromFs } from "../node-cas.js";
import { loadVesselVerifyingKey } from "../node-vessel-identity.js";
import { nodeNexusIsland } from "../nexus-standing.js";

export class NexusOfferingInspectError extends Error {}

export interface NexusOfferingInspectOptions {
  readonly offeringCid: string;
  readonly storageDir?: string;
  readonly casDir?: string;
  readonly ownVesselKey?: string;
}

export interface NexusOfferingInspectResult {
  readonly offeringCid: string;
  readonly boardUrl: string;
  /** The read transport completed locally; this says nothing about semantic acceptance or adoption. */
  readonly transport: {
    readonly status: "complete";
    readonly source: "local-crossroads";
    readonly remoteFetch: false;
  };
  /** Signed descriptor inspection and byte materialization are observations, not a take decision. */
  readonly inspection: {
    readonly status: "verified";
    readonly byteStatus: "complete" | "partial" | "invalid";
    readonly adoption: "not-requested";
  };
  readonly verification: {
    readonly ok: boolean;
    readonly offeror?: string;
    readonly pluginsCid?: string;
    readonly blobCount?: number;
  };
  readonly bytes: {
    readonly held: readonly string[];
    readonly missing: readonly string[];
    readonly invalid: readonly string[];
  };
  /** The receiver has no wired Offering Antigen consultation in this cut. */
  readonly antigen: {
    readonly status: "unavailable";
    readonly reason: "not-configured";
  };
}

function parseAnnounce(raw: unknown, cid: string): PluginOfferingAnnounce {
  if (typeof raw !== "object" || raw === null) {
    throw new NexusOfferingInspectError(`offering ${cid} is malformed on the Crossroads board`);
  }
  const record = raw as { tiddler?: { text?: unknown } };
  if (typeof record.tiddler?.text !== "string") {
    throw new NexusOfferingInspectError(`offering ${cid} is malformed on the Crossroads board`);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(record.tiddler.text); } catch {
    throw new NexusOfferingInspectError(`offering ${cid} is malformed on the Crossroads board`);
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new NexusOfferingInspectError(`offering ${cid} is malformed on the Crossroads board`);
  }
  const announce = parsed as Partial<PluginOfferingAnnounce>;
  if (
    announce.kind !== PLUGIN_OFFERING_ANNOUNCE_DOMAIN ||
    announce.offeringCid !== cid ||
    typeof announce.offering !== "object" ||
    announce.offering === null
  ) {
    throw new NexusOfferingInspectError(`offering ${cid} is malformed on the Crossroads board`);
  }
  return announce as PluginOfferingAnnounce;
}

/** Inspect one locally carried offering; no missing board or byte is materialized or fetched. */
export async function runNexusInspectOffering(
  opts: NexusOfferingInspectOptions,
): Promise<NexusOfferingInspectResult> {
  if (!/^sha256:[0-9a-f]{64}$/.test(opts.offeringCid)) {
    throw new NexusOfferingInspectError(`malformed offering CID "${opts.offeringCid}"`);
  }
  const storageDir = opts.storageDir ?? larDataDir();
  const vesselKey = opts.ownVesselKey ?? await loadVesselVerifyingKey();
  const boardUrl = crossroadsDocUrl(nodeNexusIsland({ ownVesselKey: vesselKey }));
  const repo = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  try {
    let board: { doc(): LarDoc | undefined };
    try {
      board = await resolveBootDoc<LarDoc>(repo, boardUrl, {
        tideline: "hearth-private", label: "board:crossroads", expectPresent: true,
      });
    } catch {
      throw new NexusOfferingInspectError(`offering ${opts.offeringCid} is not present on the local Crossroads board`);
    }
    const record = board.doc()?.tiddlers?.[offeringAnnounceKey(opts.offeringCid)];
    if (record === undefined) {
      throw new NexusOfferingInspectError(`offering ${opts.offeringCid} is not present on the local Crossroads board`);
    }
    const announce = parseAnnounce(record, opts.offeringCid);
    const casDir = opts.casDir ?? casDirForStorage(storageDir);
    const observed = await inspectPluginOffering({
      offeringCid: opts.offeringCid,
      offering: announce.offering,
      read: (cid) => readCasBlobFromFs(cid, casDir),
    });
    if (!observed.verification.ok) {
      throw new NexusOfferingInspectError(`offering ${opts.offeringCid} refused: ${observed.verification.reason}`);
    }
    const byteStatus = observed.status === "corrupt"
      ? "invalid"
      : observed.status === "pending"
        ? "partial"
        : "complete";
    return {
      offeringCid: opts.offeringCid,
      boardUrl,
      transport: { status: "complete", source: "local-crossroads", remoteFetch: false },
      inspection: { status: "verified", byteStatus, adoption: "not-requested" },
      verification: observed.verification,
      bytes: { held: observed.bytes.held, missing: observed.bytes.pending, invalid: observed.bytes.corrupt },
      antigen: { status: "unavailable", reason: "not-configured" },
    };
  } finally {
    await repo.shutdown().catch(() => { /* inspection is already complete */ });
  }
}
