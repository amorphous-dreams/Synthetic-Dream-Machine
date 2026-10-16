// herm-mesh-reader — what the herm-mesh witnesses read with. Peers prove first: a hop's FLOW-map crosses only
// the gated oracle socket, to a dialer that proved itself at that hop's floor gate. The witnesses read as a
// faceless PLACE the driver founded in a scratch root (`LAR_ROOT`, `lares vessel found`) and joined to the mesh's
// Nexus the way a herm joins (`nexus carry-for` → `nexus carry --floor-pin` → `nexus carry-take`): it presents the
// quorum's counted carry over its own vessel key, and dials only at the floor pins its own board replica files.
//
// The pure readers (`dialsOf`, `pointerAdvanced`) live here too, so a test can hold them to a known positive
// without standing a mesh.

import { plainField } from "../packages/lararium-mesh/dist/stored-value.js";

/**
 * The reader's gate-native pull, stood once from its founded root (house ruling "Routes at the cutover";
 * lar:///ha.ka.ba/lararium/node/herm-carriage): the same `vesselCarriagePull` a herm's carriage holds, over the reader's own store. It files the
 * place floor-pin statements its replica of each carrying Nexus's board counts, and presents its place arm there. It
 * lays no statement of its own: the reader stands no gate. Throws when `LAR_ROOT` holds no founded vessel.
 */
let pullPromise = null;
function readerPull() {
  if (!process.env.LAR_ROOT) {
    throw new Error("LAR_ROOT names no reader vessel — found one first: LAR_ROOT=$(mktemp -d) lares vessel found");
  }
  pullPromise ??= (async () => {
    const [mesh, ident, raise, store, paths, herm, pins] = await Promise.all([
      import("../packages/lararium-mesh/dist/index.js"),
      import("../packages/lararium-node/dist/src/node-vessel-identity.js"),
      import("../packages/lararium-node/dist/src/vessel-raise.js"),
      import("../packages/lararium-node/dist/src/owned-store.js"),
      import("../packages/lararium-node/dist/src/vessel-paths.js"),
      import("../packages/lararium-node/dist/src/herm-carriage.js"),
      import("../packages/lararium-node/dist/src/hearth-gate-pins.js"),
    ]);
    const ownPlaceKey = (await ident.loadVesselVerifyingKey()).toLowerCase();
    const signer = mesh.ed25519SignerFromSeed(await ident.loadVesselSigningSeed());
    const index = mesh.hearthPinIndex();
    return (peer, publisherKey) => store.ownedStore(paths.larDataDir(), async (repo) => {
      const open = async (url, label) => (await mesh.materializeSharedLarDoc(repo, url, label)).doc();
      const pull = herm.vesselCarriagePull({
        placeClass: "herm", ownPlaceKey,
        sign: async (image) => mesh.hexToBytes(await signer(image)),
        readings: () => raise.placeCarriedNexuses({ sealHome: paths.larSealHome(), ownVesselKey: ownPlaceKey, open }),
        ownNexus: () => null,
        openBoard: (url) => open(url, "board:carriage-contracts"),
        pins: index, audience: mesh.DAEMON_BAG_ID, deadlines: pins.dialDeadlines(),
      });
      return pull(peer, publisherKey);
    });
  })();
  return pullPromise;
}

/**
 * One proven, verified read of a hop's FLOW-map. The hop names its publisher key (its vessel key) in its fragment —
 * `<http read-face>#<publisher key hex>`. A hop with no key is refused. The read knocks only where the reader's pair
 * index holds that hop's floor pin at a Nexus the reader stands carried in; elsewhere it answers `pin-absent` and
 * dials nothing.
 */
export async function pullHop(hop) {
  const at = hop.indexOf("#");
  const gate = at < 0 ? "" : hop.slice(at + 1).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(gate)) return { ok: false, reason: `the hop names no gate key to pin (write <url>#<gate key hex>): ${hop}` };
  return (await readerPull())(hop.slice(0, at), gate);
}

/** The dial bearings a decoded FLOW-map carries — each rides a `…/bags/meshpalace/dial/<slug>` tiddler. */
export function dialsOf(doc) {
  const out = [];
  for (const [title, entry] of Object.entries(doc?.tiddlers ?? {})) {
    // A record read off a document rests its strings as immutable scalars: unwrap through the one door.
    const bearing = plainField(entry, "bearing");
    if (title.includes("bags/meshpalace/dial/") && typeof bearing === "string") out.push(bearing);
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
