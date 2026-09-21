/**
 * The test-only genesis source. Production boot consumes seed.json directly;
 * tests that need an Automerge document materialize it as an integrity witness.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { materializeGenesisDoc, type GenesisSeed } from "@lararium/mesh";

const TEST_DIR = fileURLToPath(new URL(".", import.meta.url));
export const GENESIS_SEED = join(TEST_DIR, "../../../genesis/seed.json");

export function loadGenesisBytes(): Uint8Array {
  const seed = JSON.parse(readFileSync(GENESIS_SEED, "utf8")) as GenesisSeed;
  return materializeGenesisDoc(seed);
}

export function genesisSeedExists(): boolean {
  return existsSync(GENESIS_SEED);
}
