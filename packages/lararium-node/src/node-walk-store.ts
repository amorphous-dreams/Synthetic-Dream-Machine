/**
 * node-walk-store — a node vessel WALKS like any leaf (operator-ruled): it keeps, per hearth it walks at, the
 * carried invite until it settles, the grant that hearth pushed, and its wallet — one file per hearth under its
 * own store, never federated.
 *
 * The hearth's sorter reads only what a socket presents, never what kind of device it is, so a node walks on the
 * one platform-blind walk client (`walk-client`, mesh) exactly as a browser does. Walking grants the node no carry
 * duty and touches its own Nexus not at all: the record names the hearth's Nexus and nothing of this vessel's.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256HexSync, type WalkRecord, type WalkStore } from "@lararium/mesh";
import { atomicWriteFileSync } from "./fs-atomic.js";

/** The file one hearth's walk record lives in, keyed by a digest of its gate key. */
function recordPath(storageDir: string, gatePubKey: string): string {
  return join(storageDir, "walk", `${sha256HexSync(gatePubKey.toLowerCase()).slice(0, 32)}.json`);
}

/** The walk store over this vessel's own disk. */
export function nodeWalkStore(storageDir: string): WalkStore {
  return {
    async read(gatePubKey) {
      try { return JSON.parse(readFileSync(recordPath(storageDir, gatePubKey), "utf8")) as WalkRecord; }
      catch { return null; }
    },
    async write(gatePubKey, record) {
      mkdirSync(join(storageDir, "walk"), { recursive: true });
      atomicWriteFileSync(recordPath(storageDir, gatePubKey), JSON.stringify(record));
    },
  };
}
