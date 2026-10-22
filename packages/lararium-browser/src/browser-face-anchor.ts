/** The browser's sealed, PersonaGroup-named face anchor custody row. */
import { keepFaceAnchor, loadFaceAnchor, requireFaceAnchor, type FaceAnchor, type FaceAnchorRows } from "@lararium/mesh";
import { readKeystoreRow, withCustodyRows } from "./browser-custody.js";

export function faceAnchorRow(personaGroup: string): string {
  if (!personaGroup) throw new Error("[browser-face-anchor] an anchor names its PersonaGroup");
  return `face-anchor/${personaGroup}`;
}

export function browserFaceAnchorRows(idbName: string): FaceAnchorRows {
  return {
    async read(personaGroup) {
      return await readKeystoreRow(idbName, faceAnchorRow(personaGroup)) as Uint8Array | undefined;
    },
    async write(personaGroup, bytes) {
      const row = faceAnchorRow(personaGroup);
      await withCustodyRows(idbName, async (rows) => {
        await rows.write(row, Uint8Array.from(bytes));
      });
    },
  };
}

export const loadBrowserFaceAnchor = (idbName: string, personaGroup: string): Promise<FaceAnchor | null> =>
  loadFaceAnchor(browserFaceAnchorRows(idbName), personaGroup);

export const requireBrowserFaceAnchor = (idbName: string, personaGroup: string): Promise<FaceAnchor> =>
  requireFaceAnchor(browserFaceAnchorRows(idbName), personaGroup);

/** Founding, admission and recovery keep the anchor under the group that owns it. */
export const keepBrowserFaceAnchor = (idbName: string, anchor: FaceAnchor): Promise<void> =>
  keepFaceAnchor(browserFaceAnchorRows(idbName), anchor);
