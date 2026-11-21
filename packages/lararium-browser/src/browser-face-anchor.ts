/** The browser's sealed, PersonaGroup-named face anchor custody row. */
import { keepFaceAnchor, loadFaceAnchor, requireFaceAnchor, type FaceAnchor, type FaceAnchorRecords } from "@lararium/mesh";
import { readKeystoreRecord, withCustodyRecords } from "./browser-custody.js";

export function faceAnchorRecord(personaGroup: string): string {
  if (!personaGroup) throw new Error("[browser-face-anchor] an anchor names its PersonaGroup");
  return `face-anchor/${personaGroup}`;
}

export function browserFaceAnchorRecords(idbName: string): FaceAnchorRecords {
  return {
    async read(personaGroup) {
      return await readKeystoreRecord(idbName, faceAnchorRecord(personaGroup)) as Uint8Array | undefined;
    },
    async write(personaGroup, bytes) {
      const row = faceAnchorRecord(personaGroup);
      await withCustodyRecords(idbName, async (records) => {
        await records.write(row, Uint8Array.from(bytes));
      });
    },
  };
}

export const loadBrowserFaceAnchor = (idbName: string, personaGroup: string): Promise<FaceAnchor | null> =>
  loadFaceAnchor(browserFaceAnchorRecords(idbName), personaGroup);

export const requireBrowserFaceAnchor = (idbName: string, personaGroup: string): Promise<FaceAnchor> =>
  requireFaceAnchor(browserFaceAnchorRecords(idbName), personaGroup);

/** Founding, admission and recovery keep the anchor under the group that owns it. */
export const keepBrowserFaceAnchor = (idbName: string, anchor: FaceAnchor): Promise<void> =>
  keepFaceAnchor(browserFaceAnchorRecords(idbName), anchor);
