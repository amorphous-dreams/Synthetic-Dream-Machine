import { readCasBlobFromOpfs } from "@lararium/browser";
import { sha256HexBytesSync } from "@lararium/mesh/crypto";
import { preloadsFromCasBlob } from "@lararium/tw5/glass";

export interface GlassBootInputs {
  coreBytes: Uint8Array;
  preloadedTiddlers: Record<string, unknown>[];
  coreCid: string;
}

const CID = /^[0-9a-f]{64}$/;
const named = (kind: string, cid: string): string => {
  if (!CID.test(cid)) throw new Error(`glass-${kind}-cid-refused:${cid.slice(0, 80)}`);
  return cid;
};

/** Read only the named CAS members and witness the core's byte identity. */
export async function readGlassBootInputs({ coreCid, pluginCids }: {
  coreCid: string; pluginCids: readonly string[];
}): Promise<GlassBootInputs> {
  named("core", coreCid);
  const coreBytes = await readCasBlobFromOpfs(coreCid);
  if (!coreBytes) throw new Error(`glass-core-cas-miss:${coreCid}`);
  if (sha256HexBytesSync(coreBytes) !== coreCid) throw new Error(`glass-core-sha256-mismatch:${coreCid}`);
  const preloadedTiddlers: Record<string, unknown>[] = [];
  for (const cid of pluginCids) {
    const bytes = await readCasBlobFromOpfs(named("plugin", cid));
    if (!bytes) throw new Error(`glass-plugin-cas-miss:${cid}`);
    if (sha256HexBytesSync(bytes) !== cid) throw new Error(`glass-plugin-sha256-mismatch:${cid}`);
    preloadedTiddlers.push(...preloadsFromCasBlob(bytes));
  }
  return { coreBytes, preloadedTiddlers, coreCid };
}
