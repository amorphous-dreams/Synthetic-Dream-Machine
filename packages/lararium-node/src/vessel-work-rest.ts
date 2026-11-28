import { bytesEqual } from "@lararium/mesh/crypto";
import { openVesselWork, type VesselWork } from "@lararium/mesh/vessel-work";
import { openedCustody, readCustodyRecord, updateCustodyRecord } from "./custody-seat.js";

/** The custody holder serializes compare-and-replace; its sealed writer fsyncs file and directory. */
const workByHolder = new WeakMap<object, Promise<VesselWork>>();
export async function openNodeWork(): Promise<VesselWork> {
  const holder = await openedCustody();
  let work = workByHolder.get(holder);
  if (work) return work;
  work = openVesselWork({
    read: () => readCustodyRecord("identity", "vessel-work.json"),
    replace: (bytes, previous) => updateCustodyRecord("identity", "vessel-work.json", standing => {
      if ((standing === null) !== (previous === null) || (standing !== null && previous !== null && !bytesEqual(standing, previous))) throw new Error("vessel-work: snapshot changed under another owner");
      return { plaintext: bytes, value: undefined };
    }),
  });
  workByHolder.set(holder, work);
  try { return await work; } catch (error) { workByHolder.delete(holder); throw error; }
}
