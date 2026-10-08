/**
 * node-walk-store — a node vessel WALKS like any leaf (operator-ruled): it keeps, per hearth it walks at, the
 * carried invite until it settles, the grant that hearth pushed, its wallet, and where that hearth's relay
 * answers — one file per hearth under its own store, never federated.
 *
 * The hearth's sorter reads only what a socket presents, never what kind of device it is, so a node walks on the
 * one platform-blind walk client (`walk-client`, mesh) exactly as a browser does. Walking grants the node no carry
 * duty and touches its own Nexus not at all: the record names the hearth's Nexus and nothing of this vessel's.
 *
 * Each file holds the hearth's gate key beside its record, so the vessel can read back where it walks without a
 * second index. The `walk/` directory is the operator's alone (0700, re-moded when it already stands): a wallet
 * holds unspent bearer invites.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sha256HexSync, type WalkRecord, type WalkStore } from "@lararium/mesh";
import { atomicWriteFileSync, ownerOnlyDir } from "./fs-atomic.js";

function walkDir(storageDir: string): string { return join(storageDir, "walk"); }

/** The file one hearth's walk record lives in, keyed by a digest of its gate key. */
function recordPath(storageDir: string, gatePubKey: string): string {
  return join(walkDir(storageDir), `${sha256HexSync(gatePubKey.toLowerCase()).slice(0, 32)}.json`);
}

interface WalkFile { readonly gatePubKey: string; readonly record: WalkRecord }

function readWalkFile(path: string): WalkFile | null {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<WalkFile>;
    return typeof raw.gatePubKey === "string" && raw.record && typeof raw.record.nexusAid === "string" ? raw as WalkFile : null;
  } catch { return null; }
}

/** The walk store over this vessel's own disk. */
export function nodeWalkStore(storageDir: string): WalkStore {
  return {
    async read(gatePubKey) { return readWalkFile(recordPath(storageDir, gatePubKey))?.record ?? null; },
    async write(gatePubKey, record) {
      ownerOnlyDir(walkDir(storageDir));
      const file: WalkFile = { gatePubKey: gatePubKey.toLowerCase(), record };
      atomicWriteFileSync(recordPath(storageDir, gatePubKey), JSON.stringify(file));
    },
  };
}

/** Every hearth this vessel walks at: its gate key and its record. A torn file names no hearth. */
export function listWalkRecords(storageDir: string): ReadonlyArray<{ readonly gatePubKey: string; readonly record: WalkRecord }> {
  const dir = walkDir(storageDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => readWalkFile(join(dir, f)))
    .filter((w): w is WalkFile => w !== null)
    .sort((a, b) => a.gatePubKey.localeCompare(b.gatePubKey));
}
