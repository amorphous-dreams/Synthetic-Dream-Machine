#!/usr/bin/env tsx
/**
 * Build a lararium-web JSON snapshot from the live lares/ tree.
 *
 * Output: lares/lararium-node/snapshot.json
 *
 * The snapshot embeds all carrier meme texts so the browser runtime can
 * hydrate without any server or file system access.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { compileCarrierIndex, LARES_ROOT } from "../src/node-host.js";
import { resolveLarUri } from "@lararium/core";

const carriers = compileCarrierIndex();

const memes: Record<string, { text: string; laresRelPath: string }> = {};

for (const carrier of carriers) {
  const resolution = resolveLarUri(carrier.uri);
  if (!resolution.laresRelPath) continue;
  const abs = join(LARES_ROOT, resolution.laresRelPath);
  if (!existsSync(abs)) continue;
  const text = readFileSync(abs, "utf8");
  memes[carrier.uri] = { text, laresRelPath: resolution.laresRelPath };
}

const snapshot = {
  version: 1 as const,
  compiledAt: new Date().toISOString(),
  memes,
};

const out = join(LARES_ROOT, "lararium-node", "snapshot.json");
writeFileSync(out, JSON.stringify(snapshot, null, 2));
console.log(`Snapshot written: ${out}`);
console.log(`  Memes: ${Object.keys(memes).length}`);
