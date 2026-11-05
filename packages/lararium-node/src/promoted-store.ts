/**
 * The ledger (rows keyed by (wiki, digest)) and the kāpae cache belong to this device and rest sealed under the vessel key in the
 * face's folder. Their names carry the PersonaGroup digest; they ride no CRDT document and no face bundle.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { EMPTY_LEDGER, EMPTY_KAPAE_LOCAL, decodeLedger, decodeKapaeLocal, encodeLedger, encodeKapaeLocal, sha256HexBytesSync } from "@lararium/mesh";
import { readCustodyRow, updateCustodyRow, writeCustodyRow } from "./custody-seat.js";
import { personaGroupDigest } from "./persona-group-file.js";
import { pinCas, writeCasEntriesFs } from "./node-cas.js";
import type { KapaeLocal, PromotionLedger } from "@lararium/mesh";

type Rows<T> = { read(): Promise<T>; write(value: T): Promise<void>; update(fn: (standing: T) => T): Promise<T> };

export const PROMOTED_FILE = /^promoted-g([0-9a-f]{64})\.bin$/;
export const KAPAE_FILE = /^kapae-g([0-9a-f]{64})\.bin$/;

export function promotedFile(group: string): string {
  if (!group) throw new Error("promoted row names no PersonaGroup");
  return `promoted-g${personaGroupDigest(group)}.bin`;
}
export function kapaeFile(group: string): string {
  if (!group) throw new Error("kāpae row names no PersonaGroup");
  return `kapae-g${personaGroupDigest(group)}.bin`;
}

export function nodePromoteStores(group: string): { ledger: Rows<PromotionLedger>; local: Rows<KapaeLocal> } {
  const ledgerFile = promotedFile(group), localFile = kapaeFile(group);
  return {
    ledger: {
      async read() { const bytes = await readCustodyRow("identity", ledgerFile); return bytes === null ? EMPTY_LEDGER : decodeLedger(bytes); },
      async write(ledger) { await writeCustodyRow("identity", ledgerFile, encodeLedger(ledger)); },
      // One custody-holder hold across the read, the decision and the write: two commits never lose each other.
      update: (fn) => updateCustodyRow("identity", ledgerFile, (bytes) => { const next = fn(bytes === null ? EMPTY_LEDGER : decodeLedger(bytes)); return { plaintext: encodeLedger(next), value: next }; }),
    },
    local: {
      async read() { const bytes = await readCustodyRow("identity", localFile); return bytes === null ? EMPTY_KAPAE_LOCAL : decodeKapaeLocal(bytes); },
      async write(local) { await writeCustodyRow("identity", localFile, encodeKapaeLocal(local)); },
      update: (fn) => updateCustodyRow("identity", localFile, (bytes) => { const next = fn(bytes === null ? EMPTY_KAPAE_LOCAL : decodeKapaeLocal(bytes)); return { plaintext: encodeKapaeLocal(next), value: next }; }),
    },
  };
}

export function nodePromoteCas(casDir: string, holder: string): { put(digest: string, bytes: Uint8Array): void; pin(digest: string): void } {
  return {
    put(digest, bytes) {
      if (sha256HexBytesSync(bytes) !== digest) throw new Error(`cas-digest-mismatch: ${digest}`);
      writeCasEntriesFs([{ cid: digest, bytes }], casDir);
    },
    pin(digest) { pinCas(casDir, { cid: digest, tier: "veil", holder }); },
  };
}
