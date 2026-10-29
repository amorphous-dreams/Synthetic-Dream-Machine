/**
 * nexus-publish — the Node shore of the immutable plugin offering door.
 *
 * This command publishes a LOCAL OFFERING SOURCE — never genesis (H3, R2). `--source <dir>` names a
 * directory this operator already holds: `<dir>/offering.json` plus each blob's bytes beside it. The
 * genesis seed carries the boot set alone since the Streams retirement (`3d38cb691`); it was never a
 * registry of what an operator may offer, and reading `$:/plugins/*` blobs out of it folded to an
 * EMPTY gift the instant genesis stopped carrying any (an empty offering that still signed, verified,
 * and announced — H3's live finding).
 *
 * TWO SOURCE SHAPES (offerings-handoff.md "Who signs"):
 *   - A SIGNED GIFT (`offering.json` already carries `sig`/`offeror`/`pluginsCid`): a friend's offering,
 *     carried here to republish toward this Nexus's own Crossroads. `verifyPluginOffering` must pass,
 *     and it is announced EXACTLY as signed — never re-signed, never re-derived (the friend's-gift law).
 *     Its blobs' bytes sit at `<dir>/<sha256>` (content-addressed; the signed record itself carries no
 *     filename field to ride unsigned on the same CID).
 *   - An UNSIGNED SOURCE DESCRIPTOR (`{ blobs: [{ id, version, sha256, provenance, file }] }`, no `sig`):
 *     this operator's own collection, not yet offered by anyone. The active persona signs it fresh, as
 *     PUBLISHER, with provenance riding inside the signed preimage. `file` names each blob's bytes,
 *     relative to `<dir>` — a LOCAL layout convenience, never part of what gets signed.
 *
 * Every blob's bytes are hash-checked against its declared `sha256` BEFORE anything is signed or
 * announced (`missing-bytes`/`corrupt-bytes`, `verifyCasBytes`) — then written into this publisher's
 * own CAS, so `nexus offering inspect` reads them held and a joinee can take them. A boot-set id never
 * verifies (`boot-set-collision`); an empty source never verifies (`empty-offering`).
 *
 * The active persona is explicit custody. A faceless Node can carry a Crossroads board, but it cannot
 * publish in a human's name; an unset selector therefore refuses instead of choosing handle zero.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Repo } from "@automerge/automerge-repo";
import {
  crossroadsDocUrl,
  ed25519SignerFromSeed,
  materializeSharedLarDoc,
  pluginOfferingCid,
  signPluginOffering,
  verifyPluginOffering,
  verifyCasBytes,
  computePluginsCid,
  writeOfferingAnnounce,
  sha256HexBytesSync,
  type OfferedBlob,
  type PluginOffering,
  type PluginProvenance,
} from "@lararium/mesh";
import { readGenesisCasManifest } from "../genesis-artifact.js";
import { FaceNotNamed, resolveFace } from "../face-selector.js";
import { casDirForStorage, writeCasEntriesFs } from "../node-cas.js";
import {
  loadPersonaGroupRootSeed,
  loadPersonaGroupRootVerifyingKey,
  loadVesselVerifyingKey,
  personaRootExists,
} from "../node-vessel-identity.js";
import { nodeNexusIsland } from "../nexus-standing.js";

export class NexusPublishError extends Error {}

export interface NexusPublishPluginsOptions {
  /** The store's one holder: the standing vessel's own Repo, or the direct holder's (`ownedStore`). */
  readonly repo: Repo;
  /** This vessel's own storage root — where the publisher's CAS (`casDirForStorage`) lives. */
  readonly storageDir: string;
  /** A LOCAL offering source directory: `offering.json` plus each blob's bytes beside it. */
  readonly source: string;
  /** The genesis directory whose blob ids `boot-set-collision` reads; absent, the vessel's own (`readGenesisSeed`'s default). */
  readonly genesisDir?: string;
  /** The face that signs the offering: named by the caller, else the one face standing open. */
  readonly handleIndex?: number;
}

export interface NexusPublishPluginsResult {
  readonly offering: PluginOffering;
  readonly offeringCid: string;
  readonly boardUrl: string;
  readonly offeror: string;
  readonly pluginsCid: string;
  readonly blobCount: number;
}

/** An unsigned source descriptor's one blob — the signed shape plus a LOCAL, unsigned `file` path. */
interface SourceDescriptorBlob {
  readonly id: string;
  readonly version: string;
  readonly sha256: string;
  readonly provenance?: PluginProvenance;
  readonly file?: string;
}
interface SourceDescriptor {
  readonly blobs: readonly SourceDescriptorBlob[];
}

function isSignedGift(v: unknown): v is PluginOffering {
  return !!v && typeof v === "object" && typeof (v as { sig?: unknown }).sig === "string";
}

/** Read one blob's bytes off the source dir — `file` when the descriptor names one, else the blob's
 *  own sha256 as a content-addressed filename (the signed-gift convention, which carries no `file`). */
function sourceBlobPath(sourceDir: string, blob: { readonly sha256: string; readonly file?: string }): string {
  return join(sourceDir, blob.file ?? blob.sha256);
}

/** Sign and announce an offering source on this vessel's Nexus Crossroads. */
export async function runNexusPublishPlugins(
  opts: NexusPublishPluginsOptions,
): Promise<NexusPublishPluginsResult> {
  // The face the act names, else the one face standing open; several and none named refuse by name (--face N).
  const handleIndex = await resolveFace(opts.handleIndex).catch((e: unknown) => {
    if (e instanceof FaceNotNamed) throw new NexusPublishError(`publishing requires a face to sign as — ${e.message}`);
    throw e;
  });
  if (!(await personaRootExists(handleIndex))) {
    throw new NexusPublishError(
      `the active persona h${handleIndex} is not held by this vessel — publishing refuses without root custody`,
    );
  }

  const sourceDir = resolve(opts.source);
  const descriptorPath = join(sourceDir, "offering.json");
  if (!existsSync(descriptorPath)) {
    throw new NexusPublishError(`no offering source at ${descriptorPath} — publishing refuses with nothing to read`);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(descriptorPath, "utf8")); }
  catch (err) { throw new NexusPublishError(`${descriptorPath} does not read as JSON: ${(err as Error).message}`); }

  const blobsIn: readonly SourceDescriptorBlob[] = Array.isArray((parsed as { blobs?: unknown })?.blobs)
    ? (parsed as SourceDescriptor).blobs : [];
  if (blobsIn.length === 0) {
    // L-e: this refusal now NAMES its code, exactly as the other three (`boot-set-collision`,
    // `boot-set-unknown`, `missing-bytes`/`corrupt-bytes`) already do.
    throw new NexusPublishError("refusing to announce an offering that does not self-verify (empty-offering): an offering with no blobs names nothing to take");
  }

  // BOOT-SET COLLISION, BEFORE ANYTHING ELSE TOUCHES BYTES. A source naming a boot-set id (the
  // grammar, boot shadows, the engine core) can never verify — a third party's "plugin" shadowing the
  // fixed floor is precisely what `boot-set-collision` exists to refuse (M3, reused here at publish time
  // rather than only at a recipe's selection).
  //
  // M-d (gp3-episkopos, measured live): an ABSENT or unreadable genesis seed read as "no boot ids" —
  // `readGenesisCasManifest(...)?.blobs ?? []` folds null into an EMPTY set, so moving genesis aside
  // let a source claiming the grammar's own id sign and announce as a PUBLISHER record. An empty
  // protect set must never mean "nothing to guard" (`genesis-artifact.ts`'s own protect-set law) — a
  // null manifest here refuses by name instead, `boot-set-unknown`, rather than failing open.
  const manifest = readGenesisCasManifest(opts.genesisDir);
  if (manifest === null) {
    throw new NexusPublishError(
      "refusing to announce an offering whose boot-set collision cannot be checked (boot-set-unknown): no readable genesis seed at this root",
    );
  }
  const genesisIds = new Set(manifest.blobs.map((b) => b.id));
  for (const blob of blobsIn) {
    if (genesisIds.has(blob.id)) {
      throw new NexusPublishError(`refusing to announce an offering that claims a boot-set id (boot-set-collision): ${blob.id}`);
    }
  }

  // THE BYTES, HASH-CHECKED, BEFORE ANYTHING IS SIGNED OR ANNOUNCED. `missing-bytes`/`corrupt-bytes`,
  // fail-closed by name — a signature over a declared sha256 nobody can produce the bytes for proves
  // nothing a taker could ever redeem.
  const casDir = casDirForStorage(opts.storageDir);
  const bytesByCid = new Map<string, Uint8Array>();
  const verdict = verifyCasBytes(
    blobsIn.map((b) => b.sha256),
    (cid) => {
      if (bytesByCid.has(cid)) return bytesByCid.get(cid)!;
      const blob = blobsIn.find((b) => b.sha256 === cid);
      const path = blob ? sourceBlobPath(sourceDir, blob) : join(sourceDir, cid);
      if (!existsSync(path)) return null;
      const bytes = new Uint8Array(readFileSync(path));
      bytesByCid.set(cid, bytes);
      return bytes;
    },
    sha256HexBytesSync,
  );
  if (!verdict.ok) {
    const { code, cid } = verdict.failure;
    throw new NexusPublishError(`refusing to announce an offering whose bytes fail closed (${code}): ${cid}`);
  }

  const parsedGift = isSignedGift(parsed) ? (parsed as PluginOffering) : null;

  let offering: PluginOffering;
  if (parsedGift) {
    // A FRIEND'S GIFT — kept EXACTLY as signed, never re-signed, never re-derived.
    offering = parsedGift;
  } else {
    const offeror = await loadPersonaGroupRootVerifyingKey(handleIndex);
    if (!offeror) {
      throw new NexusPublishError(
        `the active persona h${handleIndex} has no readable public root — publishing refuses`,
      );
    }
    const blobs: readonly OfferedBlob[] = blobsIn.map((b) => ({
      id: b.id, version: b.version, sha256: b.sha256, ...(b.provenance ? { provenance: b.provenance } : {}),
    }));
    const pluginsCid = computePluginsCid(blobs);
    offering = await signPluginOffering(
      { offeror: offeror.toLowerCase(), pluginsCid, blobs },
      ed25519SignerFromSeed(await loadPersonaGroupRootSeed(handleIndex)),
    );
  }

  const verified = await verifyPluginOffering(offering);
  if (!verified.ok) {
    throw new NexusPublishError(`refusing to announce an offering that does not self-verify: ${verified.reason}`);
  }

  // INTO THE PUBLISHER'S OWN CAS — `nexus offering inspect` and a joinee's take both read bytes held
  // here, keyed by the SAME sha256 the offering's own descriptors declare.
  writeCasEntriesFs(offering.blobs.map((b) => ({ cid: b.sha256, bytes: bytesByCid.get(b.sha256)! })), casDir);

  const vesselKey = await loadVesselVerifyingKey();
  const boardUrl = crossroadsDocUrl(nodeNexusIsland({ ownVesselKey: vesselKey }));
  const repo = opts.repo;
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
