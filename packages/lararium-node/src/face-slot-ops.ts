/**
 * face-slot-ops — bind and unbind the routes of ONE face's slot tree, apart from the node tree.
 *
 * The face tree wraps the face's custody key (FCK) under the face's own routes: its own wrapped key, its own KDF salts and
 * its own slot ids. A bind, an unbind or a rotation here moves no byte of the node (S) tree, and the same acts on the node
 * tree move no byte of a face tree, so one typed credential may open both and neither tree depends on the other.
 */
import {
  bindSlot, commitFaceTree, mintFck, rotateFck, unbindSlot,
  type CustodyIo, type FaceCustodyKey, type SlotSpec, type SlotTree,
} from "@lararium/mesh";
import { faceCarriersOf, readFaceTree } from "./face-custody.js";
import { faceTreePath } from "./face-index.js";
import type { CustodyHomes } from "./vault-carriers.js";

/** A face whose tree is unreadable or absent has no route to move. */
export class FaceTreeUnreadable extends Error {
  override readonly name = "FaceTreeUnreadable";
  constructor(fcid: string) { super(`[face-slot-ops] the slot tree of face ${fcid} does not read; nothing was changed`); }
}

/** Bind one more route over the face's own FCK. Returns the new tree and the new slot's id. */
export async function bindFaceSlot(args: {
  readonly io: CustodyIo; readonly homes: CustodyHomes; readonly fcid: string; readonly fck: FaceCustodyKey; readonly spec: SlotSpec;
}): Promise<{ readonly tree: SlotTree; readonly slotId: string }> {
  const { bytes, tree } = await readFaceTree(args.io, args.homes, args.fcid);
  if (tree === null) throw new FaceTreeUnreadable(args.fcid);
  const next = bindSlot(tree, args.fck, args.spec);
  await commitFaceTree({
    io: args.io, path: faceTreePath(args.homes.identity, args.fcid), expected: bytes, key: args.fck, tree: next,
    carriers: await faceCarriersOf(args.io, args.homes, args.fcid),
  });
  return { tree: next, slotId: next.slots[next.slots.length - 1]!.id };
}

/**
 * Remove one route of the face (never the last). With `rotate`, the removal and an FCK rotation land as ONE act: `rotate`
 * names every route that stays, the face's rows re-seal under a fresh FCK and those routes bind over it.
 */
export async function unbindFaceSlot(args: {
  readonly io: CustodyIo; readonly homes: CustodyHomes; readonly fcid: string; readonly fck: FaceCustodyKey; readonly slotId: string;
  readonly rotate?: readonly SlotSpec[];
}): Promise<{ readonly tree: SlotTree; readonly rotationOffer: string; readonly rotated: boolean; readonly fck: FaceCustodyKey }> {
  const { bytes, tree } = await readFaceTree(args.io, args.homes, args.fcid);
  if (tree === null) throw new FaceTreeUnreadable(args.fcid);
  const out = unbindSlot(tree, args.slotId);
  const treePath = faceTreePath(args.homes.identity, args.fcid);
  const carriers = await faceCarriersOf(args.io, args.homes, args.fcid);
  if (args.rotate === undefined) {
    await commitFaceTree({ io: args.io, path: treePath, expected: bytes, key: args.fck, tree: out.tree, carriers });
    return { ...out, rotated: false, fck: args.fck };
  }
  if (args.rotate.length !== out.tree.slots.length) {
    throw new Error(`[face-slot-ops] ${out.tree.slots.length} route(s) stay once ${args.slotId} leaves, and the rotation names ${args.rotate.length}; nothing was changed`);
  }
  const newKey = mintFck();
  const next = await rotateFck({ io: args.io, treePath, carriers, oldKey: args.fck, newKey, slots: args.rotate });
  return { tree: next, rotationOffer: out.rotationOffer, rotated: true, fck: newKey };
}
