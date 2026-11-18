/**
 * floor-offering — the floor's plugins, carried as ONE signed PluginOffering (`plugin-offering.ts`): every non-core blob a mount
 * loads (the memetic-wikitext parser, the base seed, the stock themes, an operator's own) rides it by {id, version, sha256,
 * provenance}, and the floor manifest's `plugins` field names the offering record's CAS address (the sha256 hex of its exact
 * record bytes; `pluginOfferingCid` spells the same digest with a `sha256:` prefix). So a floor names the whole set a mount
 * needs, and a release's bytes travel with it.
 *
 * Each blob's `version` stays what the offering always carried: the upstream plugin's own version string (a TW5 plugin's
 * `version` field, `unknown` where the blob declares none), read for a human and folded into nothing. No house counter rides it.
 *
 * `resolveFloorWhole` reads the floor as a taker must before it lands or accepts it: the manifest and snapshots
 * (`resolveFloor`), then the offering record, verified as any offering is (`verifyPluginOffering`: shape, provenance,
 * signature, fold), then each blob it carries, re-hashed. A mount keeps reading the snapshots alone.
 */
import { sha256BytesSync, sha256HexBytesSync, utf8Bytes } from "./crypto.js";
import { PLUGIN_OFFERING_DOMAIN } from "./domains.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "./ed25519-door.js";
import { ENGINE_CORE_ID } from "./base-doc.js";
import { computePluginsCid } from "./genesis-doc.js";
import { FLOOR_OFFERING_BLOB_ID, FLOOR_OFFERING_MIME, floorOfferingSetDiff, resolveFloor, type ResolvedFloor } from "./floor-manifest.js";
import {
  pluginOfferingRecordBytes, signPluginOffering, verifyPluginOffering, type OfferedBlob, type PluginOffering, type PluginProvenance,
} from "./plugin-offering.js";

export { FLOOR_OFFERING_MIME, FLOOR_OFFERING_BLOB_ID };

const HEX64 = /^[0-9a-f]{64}$/;
const decoder = new TextDecoder("utf-8", { fatal: true });

/** The offering record's CAS address: the sha256 hex of its exact record bytes. */
export function floorOfferingRecordCid(offering: PluginOffering): string {
  return sha256HexBytesSync(pluginOfferingRecordBytes(offering));
}

/** The blobs an offering carries, sorted by id: the order every reader walks. */
export function floorOfferingBlobsOf(offering: Pick<PluginOffering, "blobs">): OfferedBlob[] {
  return [...offering.blobs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Sign an offering over `blobs` with the hand `seed` derives; its region folds as the genesis bake folds it. */
export async function signFloorOffering(args: { readonly blobs: readonly OfferedBlob[]; readonly seed: Uint8Array }): Promise<{
  readonly offering: PluginOffering; readonly bytes: Uint8Array; readonly cid: string;
}> {
  const offering = await signPluginOffering(
    { offeror: await ed25519VerifyingKeyFromSeed(args.seed), pluginsCid: computePluginsCid(args.blobs), blobs: args.blobs },
    ed25519SignerFromSeed(args.seed),
  );
  const bytes = pluginOfferingRecordBytes(offering);
  return { offering, bytes, cid: sha256HexBytesSync(bytes) };
}

export type FloorOfferingRefusal = "floor-offering-refused";

/** Read an offering record off its bytes: they hash to `cid` and encode canonically. Verification stays the caller's (async). */
export function readFloorOffering(bytes: Uint8Array, cid: string):
  | { readonly offering: PluginOffering }
  | { readonly refusal: FloorOfferingRefusal; readonly reason: string } {
  try {
    if (!HEX64.test(cid) || sha256HexBytesSync(bytes) !== cid) return { refusal: "floor-offering-refused", reason: "malformed: offering record bytes differ from their CID" };
    const raw = JSON.parse(decoder.decode(bytes)) as PluginOffering;
    const canonical = pluginOfferingRecordBytes(raw);
    if (canonical.length !== bytes.length || canonical.some((b, i) => b !== bytes[i])) {
      return { refusal: "floor-offering-refused", reason: "malformed: offering record bytes differ from their canonical encoding" };
    }
    return { offering: raw };
  } catch (error) {
    return { refusal: "floor-offering-refused", reason: `malformed: ${String(error)}` };
  }
}

/**
 * Every blob a mount loads beside the core, off a seed's blob rows: the boot set's selection (`bootSetPluginCids`: every
 * non-core `application/json` blob), as offered-blob triples. The genesis bake offers exactly this set.
 */
export function floorMountBlobRows<T extends { readonly id: string; readonly version: string; readonly sha256: string; readonly mimeType: string }>(
  rows: readonly T[],
): T[] {
  return rows.filter((r) => r.id !== ENGINE_CORE_ID && r.mimeType === "application/json")
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * THE GENESIS OFFEROR. The genesis bake signs its floor's offering with a hand the actor seed derives, so one tree bakes one
 * offering byte for byte. The actor seed folds only what every Lararium shares, so this hand proves no person stood behind the
 * offering: anyone holding the tree could sign it. The trust rides elsewhere, in the CID chain: the seed names the floor
 * manifest, the manifest names this record by its bytes, and a release's quorum approves the manifest's exact bytes.
 */
export function genesisOfferorSeed(actorSeed: string): Uint8Array {
  return sha256BytesSync(utf8Bytes(`${PLUGIN_OFFERING_DOMAIN}\ngenesis-offeror\n${actorSeed}`));
}

/** The genesis floor's offering: every blob the mount loads beside the core, each with the provenance the bake names. */
export async function genesisFloorOffering<T extends { readonly id: string; readonly version: string; readonly sha256: string; readonly mimeType: string }>(args: {
  readonly actorSeed:    string;
  readonly plugins:      readonly T[];
  readonly provenanceOf: (entry: T) => PluginProvenance;
}): Promise<{ readonly offering: PluginOffering; readonly bytes: Uint8Array; readonly cid: string }> {
  const blobs = floorMountBlobRows(args.plugins).map((p) => ({ id: p.id, version: p.version, sha256: p.sha256, provenance: args.provenanceOf(p) }));
  return signFloorOffering({ blobs, seed: genesisOfferorSeed(args.actorSeed) });
}

/** Null where the offering carries exactly the blobs a mount loads off `rows` (by id and sha256), else what differs, by id. */
export function verifyFloorOfferingSet(
  offering: Pick<PluginOffering, "blobs">,
  rows: readonly { readonly id: string; readonly sha256: string; readonly mimeType: string; readonly version: string }[],
): string | null {
  return floorOfferingSetDiff(offering.blobs, floorMountBlobRows(rows));
}

/** Resolve a floor whole, offering and blobs included, re-hashing every byte. Never throws. */
export async function resolveFloorWhole(manifestCid: string, resolveByCid: (cid: string) => Promise<Uint8Array | null>): Promise<
  | (ResolvedFloor & { readonly offering: PluginOffering })
  | { readonly refusal: Exclude<Awaited<ReturnType<typeof resolveFloor>>, ResolvedFloor>["refusal"] | FloorOfferingRefusal; readonly reason: string }> {
  const floor = await resolveFloor(manifestCid, resolveByCid);
  if ("refusal" in floor) return floor;
  try {
    const cid = floor.manifest.plugins;
    const bytes = await resolveByCid(cid);
    if (!bytes) return { refusal: "floor-absent", reason: `Floor plugins offering absent: ${cid}` };
    const read = readFloorOffering(bytes, cid);
    if ("refusal" in read) return read;
    const verdict = await verifyPluginOffering(read.offering);
    if (!verdict.ok) return { refusal: "floor-offering-refused", reason: `${verdict.code}: ${verdict.reason}` };
    for (const blob of floorOfferingBlobsOf(read.offering)) {
      const blobBytes = await resolveByCid(blob.sha256);
      if (!blobBytes) return { refusal: "floor-absent", reason: `Floor blob ${blob.id} absent: ${blob.sha256}` };
      if (sha256HexBytesSync(blobBytes) !== blob.sha256) return { refusal: "floor-absent", reason: `Floor blob ${blob.id} bytes differ from their CID: ${blob.sha256}` };
    }
    return { ...floor, offering: read.offering };
  } catch (error) {
    return { refusal: "floor-absent", reason: String(error) };
  }
}
