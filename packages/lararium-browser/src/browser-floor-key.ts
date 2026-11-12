/**
 * browser-floor-key — where a browser vessel keeps its FLOOR's rest seed: one place row, `floor-rest`.
 *
 * THE FLOOR STANDS BEFORE ANY FACE, so its key cannot wait on the secret home, which mints with a face (operator ruling
 * 2026-11-09). A browser's floor documents (a wiki's floor working layer and canon, the daemon wiki's floor memory) seal
 * under the floor's rest key (`@lararium/mesh` `floorRestKey`), derived from 32 random bytes this browser keeps in one row
 * of its place rows.
 *
 * NEVER THE PLACE KEL SEED. A browser arms pre-rotation on its place KEL, and a rotation would strand every floor document
 * its seed had sealed. The floor's seed stands apart and never rotates with the place.
 *
 * THE THROWAWAY RUNG'S PRICE (the-veil-ladder#/the-base-model, in-house ruling 6). Before the place tree binds, the row rests
 * clear beside the place seed, and the page says so; the first bind moves it under the seal. A sealed keystore this page
 * holds no unlock for answers `vessel-locked`, and the floor stands no document until it opens.
 */
import type { Repo } from "@automerge/automerge-repo";
import { HELD_REST_KEY_LEN, floorRestKey, seedFloorDoor, standFloorKeyOn, VESSEL_LOCKED } from "@lararium/mesh";
import { BrowserCustodyRefused, withCustodyRows } from "./browser-custody.js";

/** The place row the floor's rest seed rests in. */
export const FLOOR_REST_ROW = "floor-rest";

/** The floor key's standing on a browser: it stands, or the keystore stays shut. */
export type BrowserFloorKey = "stands" | typeof VESSEL_LOCKED;

/**
 * Stand the floor's rest key on `repo`'s rest: read this browser's `floor-rest` seed (minting it once where the row
 * stands absent), derive the key through the one helper, and stand it. A sealed keystore with no unlock answers
 * `vessel-locked` and stands nothing; a later call, once it opens, stands the key.
 */
export async function standBrowserFloorKey(idbName: string, repo: Repo): Promise<BrowserFloorKey> {
  let seed: Uint8Array;
  try {
    seed = await withCustodyRows(idbName, async (rows) => {
      const standing = await rows.read(FLOOR_REST_ROW);
      if (standing instanceof Uint8Array && standing.length === HELD_REST_KEY_LEN) return Uint8Array.from(standing);
      if (standing !== undefined) throw new Error("[browser-floor-key] the floor-rest row reads malformed");
      const minted = globalThis.crypto.getRandomValues(new Uint8Array(HELD_REST_KEY_LEN));
      await rows.write(FLOOR_REST_ROW, minted);
      return minted;
    });
  } catch (e) {
    if (e instanceof BrowserCustodyRefused && e.refusal === VESSEL_LOCKED) return VESSEL_LOCKED;
    throw e;
  }
  const key = floorRestKey(seedFloorDoor(seed));
  seed.fill(0);
  try { standFloorKeyOn(repo, key); } finally { key.fill(0); }
  return "stands";
}
