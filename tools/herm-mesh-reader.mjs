// herm-mesh-reader — what the herm-mesh witnesses read with. Peers prove first: a hop's FLOW-map crosses only
// the gated oracle socket, to a dialer that proved its key at that hop's gate. The witnesses dial as a READER
// vessel the driver founded in a scratch root (`LAR_ROOT`, `lares vessel found`): its vessel key and the
// ContactCard its founding cached are the identity it proves.
//
// The pure readers (`dialsOf`, `pointerAdvanced`) live here too, so a test can hold them to a known positive
// without standing a mesh.

import { pullAndVerifyOracle } from "../packages/lararium-mesh/dist/oracle-read-client.js";

/** The reader's identity, loaded once from its founded root. Throws when `LAR_ROOT` holds no founded vessel. */
let identityPromise = null;
export function readerIdentity() {
  if (!process.env.LAR_ROOT) {
    throw new Error("LAR_ROOT names no reader vessel — found one first: LAR_ROOT=$(mktemp -d) lares vessel found");
  }
  identityPromise ??= import("../packages/lararium-node/dist/src/leaf-identity.js").then((m) => m.loadLeafIdentity());
  return identityPromise;
}

/** One proven, verified read of a hop's FLOW-map. */
export async function pullHop(url) {
  return pullAndVerifyOracle(url, { identity: await readerIdentity() });
}

/** The dial bearings a decoded FLOW-map carries — each rides a `…/bags/meshpalace/dial/<slug>` tiddler. */
export function dialsOf(doc) {
  const out = [];
  for (const [title, entry] of Object.entries(doc?.tiddlers ?? {})) {
    if (title.includes("bags/meshpalace/dial/") && typeof entry?.tiddler?.bearing === "string") out.push(entry.tiddler.bearing);
  }
  return out;
}

/** A pointer's act identity — the one field that moves when a publisher re-publishes. Refuses a pointer without one. */
export function actOf(pointer) {
  if (typeof pointer?.actCid !== "string" || pointer.actCid.length === 0) {
    throw new Error("the pointer carries no actCid — the witness would read every pointer as the same act");
  }
  return pointer.actCid;
}

/** Did the publisher re-publish past `settled`? A fresh act is a different actCid; no sequence number rides. */
export function pointerAdvanced(settled, now) {
  return actOf(now) !== actOf(settled);
}
