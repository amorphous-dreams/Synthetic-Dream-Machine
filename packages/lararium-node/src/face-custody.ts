/**
 * face-custody — one face's custody on disk: its directory, its slot tree, the carriers that rest under its key.
 *
 * A face lives in `faces/<fcid>/` under the identity home. The tree `fk-slots.bin` wraps the face's custody key (FCK)
 * under each human route of that face and nothing else; the D rows of the face rest beside it, each sealed under the FCK
 * with a context that names the face's custody id, the row, its kind and its reference (`@lararium/mesh` `fck`). Nothing
 * outside the directory is the face's, and the node holds no key that opens a sibling's directory.
 */
import { join } from "node:path";
import {
  decodeSlotTree, openTreeKey, settleFaceRotation,
  type Credential, type CustodyIo, type FaceCarrier, type FaceCustodyKey, type SlotTree,
} from "@lararium/mesh";
import { carrierTable, type CarrierRow, type CustodyHomes } from "./vault-carriers.js";
import { FACE_TREE_FILE, FACES_DIR, faceDir, faceTreePath } from "./face-index.js";

/** The store namespace every node D context binds: one vessel store. */
export const FACE_STORE = "lares-vessel";

/** What a route opens at a face's slot tree. */
export type FaceTreeOpening =
  | { readonly reading: "opens"; readonly fck: FaceCustodyKey; readonly slot: string }
  | { readonly reading: "no-slot-opens"; readonly notes: readonly string[] }
  | { readonly reading: "tree-absent" }
  | { readonly reading: "tree-unreadable"; readonly why: string };

/** The carrier a face row at `faces/<fcid>/<file>` is: the context fields come from the row and the face, never from the bytes. */
export function faceCarrierFor(homes: CustodyHomes, fcid: string, file: string, row: Pick<CarrierRow, "row" | "keyClass">): FaceCarrier {
  return {
    name: `identity/${file}`, path: join(faceDir(homes.identity, fcid), file), kind: row.row, ref: `identity/${file}`,
    owner: fcid, store: FACE_STORE, keyClass: row.keyClass,
  };
}

/** Every carrier standing in one face's directory that a face row names, as the sealed writer's census wants them. */
export async function faceCarriersOf(io: Pick<CustodyIo, "list">, homes: CustodyHomes, fcid: string): Promise<FaceCarrier[]> {
  const dir = faceDir(homes.identity, fcid);
  const rows = carrierTable().filter((r) => r.faceRow !== undefined);
  const out: FaceCarrier[] = [];
  for (const path of await io.list()) {
    if (!path.startsWith(`${dir}/`)) continue;
    const file = path.slice(dir.length + 1);
    if (file === FACE_TREE_FILE || file.includes("/")) continue;
    const row = rows.find((r) => r.faceRow!.inner.test(file));
    if (row) out.push(faceCarrierFor(homes, fcid, file, row));
  }
  return out;
}

/** Open one face's FCK with the presented credentials, settling a left-behind rotation first; never throws on a credential. */
export async function openFaceTree(args: {
  readonly io: CustodyIo; readonly homes: CustodyHomes; readonly fcid: string; readonly credentials: readonly Credential[];
}): Promise<FaceTreeOpening> {
  const treePath = faceTreePath(args.homes.identity, args.fcid);
  await settleFaceRotation({ io: args.io, treePath, carriers: await faceCarriersOf(args.io, args.homes, args.fcid) });
  const reading = decodeSlotTree(await args.io.read(treePath));
  if (reading.reading === "absent") return { reading: "tree-absent" };
  if (reading.reading === "unreadable") return { reading: "tree-unreadable", why: reading.why };
  const opened = openTreeKey(reading.tree, args.credentials);
  if (opened.reading !== "opens") return { reading: "no-slot-opens", notes: opened.notes };
  return { reading: "opens", fck: opened.treeKey, slot: opened.slot };
}

/** The tree standing for a face, readable or the reading that names why not. */
export async function readFaceTree(io: Pick<CustodyIo, "read">, homes: CustodyHomes, fcid: string): Promise<{ readonly bytes: Uint8Array | null; readonly tree: SlotTree | null }> {
  const bytes = await io.read(faceTreePath(homes.identity, fcid));
  const reading = decodeSlotTree(bytes);
  return { bytes, tree: reading.reading === "readable" ? reading.tree : null };
}

export { FACES_DIR };
