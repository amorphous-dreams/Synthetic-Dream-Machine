import { bytesEqual } from "@lararium/mesh/crypto";
import { openVesselWork, type VesselWork } from "@lararium/mesh/vessel-work";
import { readKeystoreRecord, withCustodyRecords } from "./browser-custody.js";

/** Web Locks hold compare-and-replace; the sealed writer publishes the row in one IndexedDB transaction. */
const byPlace = new Map<string, Promise<VesselWork>>();
export async function openBrowserWork(idbName: string): Promise<VesselWork> {
  const prior = byPlace.get(idbName); if (prior) return prior;
  const work = openVesselWork({
    read: async () => {
      const bytes = await readKeystoreRecord(idbName, "vessel-work");
      if (bytes === undefined) return null;
      if (!(bytes instanceof Uint8Array)) throw new Error("vessel-work: malformed sealed row");
      return bytes;
    },
    replace: (bytes, previous) => withCustodyRecords(idbName, async rows => {
      const value = await rows.read("vessel-work");
      const standing = value === undefined ? null : value;
      if ((standing === null) !== (previous === null) || (standing !== null && (!(standing instanceof Uint8Array) || previous === null || !bytesEqual(standing, previous)))) throw new Error("vessel-work: snapshot changed under another owner");
      await rows.write("vessel-work", bytes);
    }),
  });
  byPlace.set(idbName, work);
  try { return await work; } catch (error) { byPlace.delete(idbName); throw error; }
}
