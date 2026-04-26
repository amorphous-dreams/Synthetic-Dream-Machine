#!/usr/bin/env tsx
/**
 * Build a lararium-web JSON snapshot from the live lares/ tree.
 *
 * Output: lares/lararium-node/snapshot.json
 *
 * The snapshot embeds:
 *   - All carrier meme texts (for browser hydration without file system access)
 *   - Pre-computed room filter results via TW5 engine (for browser-side room rendering
 *     without needing to run TW5 in the browser — though the browser CAN also re-filter
 *     dynamically using the pre-built tw-filter-engine.browser.js bundle)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import {
  compileCarrierIndex,
  createLarariumRuntime,
  LARES_ROOT,
} from "../src/node-host.js";
import { resolveLarUri, precomputeRooms } from "@lararium/core";
import { DEFAULT_ROOMS } from "@lararium/tldraw";

// ---------------------------------------------------------------------------
// 1. Collect all carrier meme texts
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 2. Compile boot artifact and pre-compute room filter results via TW5
// ---------------------------------------------------------------------------

const runtime = createLarariumRuntime({ writeback: false });
const artifact = runtime.compileMinimalBoot();
const allEntries = artifact.closure;

const roomFilters: Record<string, string> = {};
for (const room of DEFAULT_ROOMS) {
  roomFilters[room.id] = room.filter;
}

console.log(`Pre-computing ${DEFAULT_ROOMS.length} room filters via TW5...`);
const roomData = await precomputeRooms(allEntries, roomFilters);

// ---------------------------------------------------------------------------
// 3. Write snapshot
// ---------------------------------------------------------------------------

const snapshot = {
  version: 1 as const,
  compiledAt: new Date().toISOString(),
  memes,
  rooms: roomData,         // roomId → string[] of URIs
  bootMemeCount: artifact.memeCount,
};

const out = join(LARES_ROOT, "lararium-node", "snapshot.json");
writeFileSync(out, JSON.stringify(snapshot, null, 2));
console.log(`Snapshot written: ${out}`);
console.log(`  Memes: ${Object.keys(memes).length}`);
console.log(`  Rooms: ${Object.keys(roomData).map((id) => `${id}(${roomData[id]!.length})`).join(', ')}`);
