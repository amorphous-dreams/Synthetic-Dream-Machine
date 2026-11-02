/**
 * The ledger and kāpae cache belong to this device and rest sealed under the vessel key in the face's folder.
 * Their names carry the PersonaGroup digest; they ride no CRDT document and no face bundle.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { EMPTY_LEDGER, EMPTY_KAPAE_LOCAL, decodeLedger, decodeKapaeLocal, encodeLedger, encodeKapaeLocal, sha256HexBytesSync } from "@lararium/mesh";
import { readCustodyRow, writeCustodyRow } from "./custody-seat.js";
import { personaGroupDigest } from "./persona-group-file.js";
import { pinCas, writeCasEntriesFs } from "./node-cas.js";
import type { PromotionPorts } from "./kahua-promotions.js";

export const KAHUA_PROMOTED_FILE = /^kahua-promoted-g([0-9a-f]{64})\.bin$/;
export const KAHUA_KAPAE_FILE = /^kahua-kapae-g([0-9a-f]{64})\.bin$/;

export function kahuaPromotedFile(group: string): string {
  if (!group) throw new Error("kahua promoted row names no PersonaGroup");
  return `kahua-promoted-g${personaGroupDigest(group)}.bin`;
}
export function kahuaKapaeFile(group: string): string {
  if (!group) throw new Error("kahua kāpae row names no PersonaGroup");
  return `kahua-kapae-g${personaGroupDigest(group)}.bin`;
}

export function nodeKahuaStores(group: string): { ledger: PromotionPorts["ledger"]; local: PromotionPorts["local"] } {
  const ledgerFile = kahuaPromotedFile(group), localFile = kahuaKapaeFile(group);
  return {
    ledger: {
      async read() { const bytes = await readCustodyRow("identity", ledgerFile); return bytes === null ? EMPTY_LEDGER : decodeLedger(bytes); },
      async write(ledger) { await writeCustodyRow("identity", ledgerFile, encodeLedger(ledger)); },
    },
    local: {
      async read() { const bytes = await readCustodyRow("identity", localFile); return bytes === null ? EMPTY_KAPAE_LOCAL : decodeKapaeLocal(bytes); },
      async write(local) { await writeCustodyRow("identity", localFile, encodeKapaeLocal(local)); },
    },
  };
}

export function nodeKahuaCas(casDir: string, holder: string): PromotionPorts["cas"] {
  return {
    put(digest, bytes) {
      if (sha256HexBytesSync(bytes) !== digest) throw new Error(`cas-digest-mismatch: ${digest}`);
      writeCasEntriesFs([{ cid: digest, bytes }], casDir);
    },
    pin(digest) { pinCas(casDir, { cid: digest, tier: "veil", holder }); },
  };
}
