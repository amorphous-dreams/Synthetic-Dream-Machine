/** Device-local promotion records, sealed under the browser's custody slot. */
import { EMPTY_LEDGER, decodeLedger, encodeLedger } from "@lararium/mesh/promote";
import { EMPTY_KAPAE_LOCAL, decodeKapaeLocal, encodeKapaeLocal } from "@lararium/mesh/promote-kapae";
import { sha256HexBytesSync } from "@lararium/mesh/crypto";
import type { PromotionLedger } from "@lararium/mesh/promote";
import type { KapaeLocal } from "@lararium/mesh/promote-kapae";
import { readKeystoreRecord, withCustodyRecords } from "./browser-custody.js";
import { OPFS_CAS_DIR } from "./browser-genesis.js";

export function promotedRecord(group: string): string {
  if (!group) throw new Error("promoted row names no PersonaGroup");
  return `promoted/${group}`;
}
export function kapaeRecord(group: string): string {
  if (!group) throw new Error("kāpae row names no PersonaGroup");
  return `kapae/${group}`;
}

export function browserPromoteStores(idbName: string, group: string) {
  const ledgerRow = promotedRecord(group), localRow = kapaeRecord(group);
  return {
    ledger: {
      async read() { const bytes = await readKeystoreRecord(idbName, ledgerRow); return bytes === undefined ? EMPTY_LEDGER : decodeLedger(bytes as Uint8Array); },
      async write(value: PromotionLedger) { await withCustodyRecords(idbName, rows => rows.write(ledgerRow, encodeLedger(value))); },
      // One exclusive keystore hold across the read, the decision and the write: two commits never lose each other.
      update: (fn: (standing: PromotionLedger) => PromotionLedger): Promise<PromotionLedger> => withCustodyRecords(idbName, async rows => {
        const bytes = await rows.read(ledgerRow);
        const next = fn(bytes === undefined ? EMPTY_LEDGER : decodeLedger(bytes as Uint8Array));
        await rows.write(ledgerRow, encodeLedger(next));
        return next;
      }),
    },
    local: {
      async read() { const bytes = await readKeystoreRecord(idbName, localRow); return bytes === undefined ? EMPTY_KAPAE_LOCAL : decodeKapaeLocal(bytes as Uint8Array); },
      async write(value: KapaeLocal) { await withCustodyRecords(idbName, rows => rows.write(localRow, encodeKapaeLocal(value))); },
      update: (fn: (standing: KapaeLocal) => KapaeLocal): Promise<KapaeLocal> => withCustodyRecords(idbName, async rows => {
        const bytes = await rows.read(localRow);
        const next = fn(bytes === undefined ? EMPTY_KAPAE_LOCAL : decodeKapaeLocal(bytes as Uint8Array));
        await rows.write(localRow, encodeKapaeLocal(next));
        return next;
      }),
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
