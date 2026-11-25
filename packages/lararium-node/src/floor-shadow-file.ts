/**
 * floor-shadow-file — the node host's rest for the floor shadow tally (`@lararium/mesh` `floor-shadow`, backlog-awakens 3a):
 * one small JSON file beside the vessel store, written whole through a rename, so `lares vessel read` prints the count
 * whether or not the vessel stands. A re-founding clears it with the hearth: the count belongs to one founding record.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readFloorShadowTally, type FloorShadowStore, type FloorShadowTally } from "@lararium/mesh/floor-shadow";

/** The tally's file name inside the vessel store dir. */
export const FLOOR_SHADOW_FILE = "floor-shadow.json";

/** The tally kept in `storageDir`, or null where none stands or the file will not read as one. Never throws. */
export function readFloorShadowFile(storageDir: string): FloorShadowTally | null {
  try { return readFloorShadowTally(JSON.parse(readFileSync(join(storageDir, FLOOR_SHADOW_FILE), "utf8"))); } catch { return null; }
}

/** The tally, told apart from its absence: a file that stands and reads as no tally names why (corrupt), never reads as absent. */
export type FloorShadowRead = { readonly tally: FloorShadowTally | null; readonly corrupt?: string };
export function readFloorShadowFileTold(storageDir: string): FloorShadowRead {
  const path = join(storageDir, FLOOR_SHADOW_FILE);
  if (!existsSync(path)) return { tally: null };
  try {
    const tally = readFloorShadowTally(JSON.parse(readFileSync(path, "utf8")));
    return tally ? { tally } : { tally: null, corrupt: `${FLOOR_SHADOW_FILE} holds no tally of the kept shape` };
  } catch (e) { return { tally: null, corrupt: `${FLOOR_SHADOW_FILE} will not read (${(e instanceof Error ? e.message : String(e)).replace(/[\r\n]+/g, " ").trim()})` }; }
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
