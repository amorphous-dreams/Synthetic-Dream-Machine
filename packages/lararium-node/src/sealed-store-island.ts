/**
 * sealed-store-island — what the node hands its daemon island so the content-key holder can stand there.
 *
 * THE HOLDER LIVES BESIDE THE KEY SEAT, in the daemon island, and the Keyhive package stays fs-blind. So the
 * node injects three rests, each a sibling of the island's own storage directory under the vessel's storage
 * root:
 *
 *   sealed/   lockboxes, signed records and index rows (`sealed-store-fs`), and under `keyhive-chunks/` the
 *             Keyhive ciphertext each identity tracks per bag. No secret, no name, no key.
 *   cad/      the sealed values themselves, by `blake3:` address: the same tier the vessel registers and a
 *             relay serves. A value reads back only where its bytes still recompute to its address.
 *   cas/      the cleartext-local tier a staged body reads from and an opened body lands in, by the SHA-256
 *             of its plaintext: the tier the wake reads.
 *
 * The island and the vessel share one filesystem and no key: the island writes a sealed value into `cad/`, and
 * the vessel registers it by address (`seal-carrier-federation` `registerSealedCarrier`).
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { dirname, join } from "node:path";
import { sha256HexBytesSync } from "@lararium/mesh";
import type { SealedStoreShore } from "@lararium/keyhive/operator-daemon-behavior";
import { casDirForStorage, readVerifiedCasBlobFromFs, writeCasEntriesFs } from "./node-cas.js";
import { cadSealDir } from "./seal-carrier-federation.js";
import { fsProviderChunkRest, fsSealedStoreRest, sealedStoreDir } from "./sealed-store-fs.js";

/**
 * The daemon island's own storage directory, as its manifest names it: the island's Repo store where it keeps
 * one, else the store of the document it owns. A vessel's daemon island owns its document and keeps no other
 * store, so the owned document's directory names where this island rests; either directory stands as a child of
 * the vessel's storage root, which the shore below reads. Null for an island with no directory of its own.
 */
export function islandStorageDirOf(manifest: {
  readonly storage?: { readonly type: string; readonly dir?: string };
  readonly ownedDocument?: { readonly storage?: { readonly type: string; readonly dir?: string } };
}): string | null {
  for (const storage of [manifest.storage, manifest.ownedDocument?.storage]) {
    if (storage?.type === "nodefs" && typeof storage.dir === "string" && storage.dir.length > 0) return storage.dir;
  }
  return null;
}

/** The sealed store's shore for a daemon island whose own storage directory reads `islandStorageDir`. */
export function nodeSealedStoreShore(islandStorageDir: string): SealedStoreShore {
  const storageDir = dirname(islandStorageDir);
  const cadDir = cadSealDir(storageDir);
  const casDir = casDirForStorage(storageDir);
  return {
    rest: fsSealedStoreRest(sealedStoreDir(storageDir)),
    chunks: fsProviderChunkRest(join(sealedStoreDir(storageDir), "keyhive-chunks")),
    values: {
      read:  async (address) => readVerifiedCasBlobFromFs(address, cadDir),
      write: async (address, sealed) => { writeCasEntriesFs([{ cid: address, bytes: sealed }], cadDir); },
    },
    staged: {
      read:  (cid) => readVerifiedCasBlobFromFs(cid, casDir),
      write: (plaintext) => {
        const cid = sha256HexBytesSync(plaintext);
        writeCasEntriesFs([{ cid, bytes: plaintext }], casDir);
        return cid;
      },
    },
  };
}
