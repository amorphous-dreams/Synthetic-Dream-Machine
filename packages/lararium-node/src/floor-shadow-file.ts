/**
 * floor-shadow-file — the node host's rest for the floor shadow tally (`@lararium/mesh` `floor-shadow`, backlog-awakens 3a):
 * one small JSON file beside the vessel store, written whole through a rename, so `lares vessel read` prints the count
 * whether or not the vessel stands. A re-founding clears it with the hearth: the count belongs to one founding record.
 */
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readFloorShadowTally, type FloorShadowStore, type FloorShadowTally } from "@lararium/mesh";

/** The tally's file name inside the vessel store dir. */
export const FLOOR_SHADOW_FILE = "floor-shadow.json";

/** The tally kept in `storageDir`, or null where none stands or the file will not read as one. Never throws. */
export function readFloorShadowFile(storageDir: string): FloorShadowTally | null {
  try { return readFloorShadowTally(JSON.parse(readFileSync(join(storageDir, FLOOR_SHADOW_FILE), "utf8"))); } catch { return null; }
}

/** The pool's store over that file. */
export function floorShadowFileStore(storageDir: string): FloorShadowStore {
  const path = join(storageDir, FLOOR_SHADOW_FILE);
  return {
    load: () => readFloorShadowFile(storageDir),
    save: (tally) => {
      const tmp = `${path}.${process.pid}.tmp`;
      writeFileSync(tmp, `${JSON.stringify(tally, null, 2)}\n`);
      renameSync(tmp, path);
    },
  };
}
