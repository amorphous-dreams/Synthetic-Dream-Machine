import { readCasBlobFromOpfs } from "@lararium/browser";
import { sha256HexBytesSync } from "@lararium/mesh/crypto";
import { preloadsFromCasBlob } from "@lararium/tw5/glass";

export interface GlassBootInputs {
  coreBytes: Uint8Array;
  preloadedTiddlers: Record<string, unknown>[];
  coreCid: string;
}

/** Read only the named CAS members and witness the core's byte identity. */
export async function readGlassBootInputs({ coreCid, pluginCids }: {
  coreCid: string; pluginCids: readonly string[];
}): Promise<GlassBootInputs> {
  const coreBytes = await readCasBlobFromOpfs(coreCid);
  if (!coreBytes) throw new Error(`glass-core-cas-miss:${coreCid}`);
  if (sha256HexBytesSync(coreBytes) !== coreCid) throw new Error(`glass-core-sha256-mismatch:${coreCid}`);
  const preloadedTiddlers: Record<string, unknown>[] = [];
  for (const cid of pluginCids) {
    const bytes = await readCasBlobFromOpfs(cid);
    if (!bytes) throw new Error(`glass-plugin-cas-miss:${cid}`);
    preloadedTiddlers.push(...preloadsFromCasBlob(bytes));
  }
  return { coreBytes, preloadedTiddlers, coreCid };
}
