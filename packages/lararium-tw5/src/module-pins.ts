/**
 * module-pins — a CAS blob reaches the engine only once its bytes hash to the CID that names it.
 *
 * The CID plane carries the engine's plugin blobs by content address: the manifest or the genesis seed names each blob's CID, and
 * `casBlobPreloads` reads a blob's preloads only after its bytes rehash to that CID (`BlobPinMismatch` otherwise). Past the blob,
 * TiddlyWiki boots natively: it unpacks the plugins and defines the modules the preloads carry, as it does with any store.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/island-host-contract#/ses-gate
 */
import { sha256HexBytesSync } from "@lararium/mesh/crypto";
import { preloadsFromCasBlob } from "./cas-preloads.js";

/** The named refusal a CAS blob meets when its bytes hash to another value than the CID that names it. */
export const BLOB_PIN_MISMATCH = "BlobPinMismatch";

/** A CAS blob's preloads, read only once its bytes hash to the CID that names it; another hash refuses by name. */
export function casBlobPreloads(bytes: Uint8Array, cid: string): Record<string, unknown>[] {
  const actual = sha256HexBytesSync(bytes);
  if (actual !== cid.toLowerCase()) throw new Error(`${BLOB_PIN_MISMATCH}: the blob named ${cid.slice(0, 12)}… hashes to ${actual.slice(0, 12)}…`);
  return preloadsFromCasBlob(bytes);
}
