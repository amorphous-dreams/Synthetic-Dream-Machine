/** Device-local promotion records, sealed under the browser's custody slot. */
import { EMPTY_LEDGER, EMPTY_KAPAE_LOCAL, decodeLedger, decodeKapaeLocal, encodeLedger, encodeKapaeLocal, sha256HexBytesSync } from "@lararium/mesh";
import type { PromotionLedger, KapaeLocal } from "@lararium/mesh";
import { readKeystoreRow, withCustodyRows } from "./browser-custody.js";
import { OPFS_CAS_DIR } from "./browser-genesis.js";

export function promotedRow(group: string): string {
  if (!group) throw new Error("promoted row names no PersonaGroup");
  return `promoted/${group}`;
}
export function kapaeRow(group: string): string {
  if (!group) throw new Error("kāpae row names no PersonaGroup");
  return `kapae/${group}`;
}

export function browserPromoteStores(idbName: string, group: string) {
  const ledgerRow = promotedRow(group), localRow = kapaeRow(group);
  return {
    ledger: {
      async read() { const bytes = await readKeystoreRow(idbName, ledgerRow); return bytes === undefined ? EMPTY_LEDGER : decodeLedger(bytes as Uint8Array); },
      async write(value: PromotionLedger) { await withCustodyRows(idbName, rows => rows.write(ledgerRow, encodeLedger(value))); },
    },
    local: {
      async read() { const bytes = await readKeystoreRow(idbName, localRow); return bytes === undefined ? EMPTY_KAPAE_LOCAL : decodeKapaeLocal(bytes as Uint8Array); },
      async write(value: KapaeLocal) { await withCustodyRows(idbName, rows => rows.write(localRow, encodeKapaeLocal(value))); },
    },
  };
}

/** OPFS has no content-store sweep, so pinning needs no separate record. */
export function browserPromoteCas(): { put(digest: string, bytes: Uint8Array): Promise<void>; pin(digest: string): void } {
  return {
    async put(digest, bytes) {
      if (sha256HexBytesSync(bytes) !== digest) throw new Error(`cas-digest-mismatch: ${digest}`);
      if (!globalThis.navigator?.storage?.getDirectory) throw new Error("cas-opfs-unavailable");
      const root = await navigator.storage.getDirectory();
      const cas = await root.getDirectoryHandle(OPFS_CAS_DIR, { create: true });
      const file = await cas.getFileHandle(digest, { create: true });
      const writer = await file.createWritable();
      await writer.write(bytes.slice());
      await writer.close();
    },
    pin(_digest) {},
  };
}
