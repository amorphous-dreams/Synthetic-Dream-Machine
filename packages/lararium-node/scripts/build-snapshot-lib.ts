/**
 * Core snapshot builder — shared between the build-snapshot script and the serve server.
 *
 * Reads the live lares/ tree, compiles a boot artifact, and returns a BuiltSnapshot.
 * The snapshot is used to:
 *   1. Seed the Automerge meme-store doc on first server boot.
 *   2. Recompute the boot receipt SHA after reseed/promote.
 *
 * This module is Node-only (reads lares/ from disk).
 * Room filter precomputation was removed — room projections run live in the browser
 * from the Automerge-backed TW5 instance, not from a baked snapshot.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { resolveLarUri } from "@lararium/core";
import { compileCarrierIndex, LARES_ROOT } from "../src/node-host.js";
import type { LarariumRuntime } from "../src/node-host.js";
import { buildSourceMemes } from "./source-memes.js";

export interface BuiltSnapshot {
  version: 1;
  compiledAt: string;
  /** lares/ memes (laresRelPath set) + source memes (laresRelPath null). */
  memes: Record<string, { text: string; laresRelPath: string | null; fields?: Record<string, string> }>;
  bootMemeCount: number;
  memeCount: number;
  edgeCount: number;
}

export async function buildSnapshot(runtime: LarariumRuntime): Promise<BuiltSnapshot> {
  const compiledAt = new Date().toISOString();
  const carriers = compileCarrierIndex();

  const memes: BuiltSnapshot["memes"] = {};
  for (const carrier of carriers) {
    const resolution = resolveLarUri(carrier.uri);
    if (!resolution.laresRelPath) continue;
    const abs = join(LARES_ROOT, resolution.laresRelPath);
    if (!existsSync(abs)) continue;
    memes[carrier.uri] = { text: readFileSync(abs, "utf8"), laresRelPath: resolution.laresRelPath };
  }

  // Source module memes — verbatim TS/TSX source seeded into the store for graph navigation.
  for (const sm of buildSourceMemes(compiledAt)) {
    memes[sm.uri] = { text: sm.text, laresRelPath: null, fields: sm.fields };
  }

  const artifact = runtime.compileBoot();

  return {
    version: 1,
    compiledAt,
    memes,
    bootMemeCount: artifact.memeCount,
    memeCount: artifact.memeCount,
    edgeCount: artifact.edgeCount ?? 0,
  };
}
