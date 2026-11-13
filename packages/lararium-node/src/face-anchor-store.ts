/** The node's sealed, PersonaGroup-named face anchor row. */
import { keepFaceAnchor, loadFaceAnchor, requireFaceAnchor, type FaceAnchor, type FaceAnchorRows } from "@lararium/mesh";
import { readCustodyRow, writeCustodyRow } from "./custody-seat.js";
import { personaGroupDigest } from "./persona-group-file.js";

export const FACE_ANCHOR_GROUP_FILE = /^face-anchor-g([0-9a-f]{64})\.json$/;

export function faceAnchorGroupFile(group: string): string {
  if (!group) throw new Error("face anchor row names no PersonaGroup");
  return `face-anchor-g${personaGroupDigest(group)}.json`;
}

export const nodeFaceAnchorRows: FaceAnchorRows = {
  async read(group) { return (await readCustodyRow("identity", faceAnchorGroupFile(group))) ?? undefined; },
  async write(group, bytes) { await writeCustodyRow("identity", faceAnchorGroupFile(group), bytes); },
};

export const loadFaceAnchorOfGroup = (group: string): Promise<FaceAnchor | null> => loadFaceAnchor(nodeFaceAnchorRows, group);
export const requireFaceAnchorOfGroup = (group: string): Promise<FaceAnchor> => requireFaceAnchor(nodeFaceAnchorRows, group);
export const keepFaceAnchorOfGroup = (anchor: FaceAnchor): Promise<void> => keepFaceAnchor(nodeFaceAnchorRows, anchor);
