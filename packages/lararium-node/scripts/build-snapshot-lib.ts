/**
 * Core snapshot builder — shared between the build-snapshot script and the serve server.
 *
 * Reads the live lares/ tree, compiles a minimal boot artifact, pre-computes room
 * filter results via TW5, and returns a LarSnapshot-compatible object.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { resolveLarUri } from "@lararium/core";
import { precomputeRooms } from "@lararium/tw5";
import { DEFAULT_ROOMS } from "@lararium/tldraw";
import { compileCarrierIndex, LARES_ROOT, type LarariumRuntime } from "../src/node-host.js";

export interface BuiltSnapshot {
  version: 1;
  compiledAt: string;
  memes: Record<string, { text: string; laresRelPath: string }>;
  rooms: Record<string, string[]>;
  bootMemeCount: number;
  memeCount: number;
  edgeCount: number;
}

export async function buildSnapshot(runtime: LarariumRuntime): Promise<BuiltSnapshot> {
  const carriers = compileCarrierIndex();

  const memes: Record<string, { text: string; laresRelPath: string }> = {};
  for (const carrier of carriers) {
    const resolution = resolveLarUri(carrier.uri);
    if (!resolution.laresRelPath) continue;
    const abs = join(LARES_ROOT, resolution.laresRelPath);
    if (!existsSync(abs)) continue;
    memes[carrier.uri] = { text: readFileSync(abs, "utf8"), laresRelPath: resolution.laresRelPath };
  }

  const artifact = runtime.compileBoot();

  const roomFilters: Record<string, string> = {};
  for (const room of DEFAULT_ROOMS) roomFilters[room.id] = room.filter;

  const rooms = await precomputeRooms(artifact.closure, roomFilters);

  return {
    version: 1,
    compiledAt: new Date().toISOString(),
    memes,
    rooms,
    bootMemeCount: artifact.memeCount,
    memeCount: artifact.memeCount,
    edgeCount: artifact.edgeCount ?? 0,
  };
}
