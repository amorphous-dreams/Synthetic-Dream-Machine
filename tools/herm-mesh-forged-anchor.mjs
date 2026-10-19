// Present this reader's opening-epoch carry at relay-2's floor gate with an anchor
// signed by a key this probe mints. The opened quorum never seated that key.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import * as mesh from "../packages/lararium-mesh/dist/index.js";
import * as ident from "../packages/lararium-node/dist/src/node-vessel-identity.js";
import * as raise from "../packages/lararium-node/dist/src/vessel-raise.js";
import * as store from "../packages/lararium-node/dist/src/owned-store.js";
import * as paths from "../packages/lararium-node/dist/src/vessel-paths.js";
import * as pins from "../packages/lararium-node/dist/src/hearth-gate-pins.js";
import { readPins } from "./mesh-pins.mjs";

const [bundlePath, fromArg] = process.argv.slice(2);
if (!bundlePath || !process.env.LAR_ROOT) throw new Error("the probe needs an opening bundle and its founded reader root");
const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
const publisher = fromArg || readPins().HERM_RELAY_2_PUBLISHER;
if (!/^[0-9a-f]{64}$/.test(publisher ?? "")) throw new Error("relay-2 names no publisher key");

const own = (await ident.loadVesselVerifyingKey()).toLowerCase();
if (bundle.contract?.nym?.toLowerCase() !== own) throw new Error("the opening contract names another reader");
const signOwn = mesh.ed25519SignerFromSeed(await ident.loadVesselSigningSeed());
const seed = randomBytes(32);
const stranger = await mesh.ed25519VerifyingKeyFromSeed(seed);
const signStranger = mesh.ed25519SignerFromSeed(seed);
try {
  await store.ownedStore(paths.larDataDir(), async (repo) => {
    const open = async (url, label) => (await mesh.materializeSharedLarDoc(repo, url, label)).doc();
    const readings = await raise.placeCarriedNexuses({ sealHome: paths.larSealHome(), ownVesselKey: own, open });
    const reading = readings.find((r) => r.aid === bundle.aid);
    if (!reading || reading.sealLineage.length < 2) throw new Error("the reader holds no opened charter head");
    const old = reading.sealLineage[0];
    const opened = reading.sealLineage.at(-1);
    const seats = mesh.epochSeats(old);
    if (!seats || bundle.contract.sealEpochCid !== old.epochCid) throw new Error("the opening carry names no closing epoch");
    const forged = await mesh.signRollAnchor({
      prevEpochCid: old.epochCid, sealEpochCid: opened.epochCid,
      prevKeys: seats.keys, prevThreshold: seats.threshold,
      parents: [mesh.carriageEntryActCid(bundle.contract)],
    }, [{ signer: stranger, sign: signStranger }]);
    const arm = { kind: "place", contract: bundle.contract, lineage: [...bundle.lineage, forged], sealLineage: reading.sealLineage };
    const board = await open(mesh.carriageDocUrl(reading.island), "board:carriage-contracts");
    const ancestry = mesh.carriageAncestryFromBoard(reading.sealLineage, board);
    const carriers = await mesh.foldCarrierSet(reading.denyBoard, reading.roster, ancestry);
    const index = mesh.hearthPinIndex();
    mesh.filePlaceFloorPins(index, mesh.placeFloorPinsFromBoard(board), {
      nexusHex: Buffer.from(bundle.aid, "utf8").toString("hex"), route: mesh.ORACLE_SOCKET_ROUTE, carriers,
    });
    const result = await mesh.pullAndVerifyOracle(`http://localhost:${process.env.MESH_PORT_RELAY_2 ?? "18093"}`, {
      pins: index, hearth: publisher, nexus: Buffer.from(bundle.aid, "utf8").toString("hex"),
      presentation: { kind: "place", placeKey: own, sign: async (bytes) => mesh.hexToBytes(await signOwn(bytes)), arm },
      audience: mesh.DAEMON_BAG_ID, deadlines: pins.dialDeadlines(), verifyingKey: publisher,
    });
    if (result.ok || result.reason !== "dial failed: the gate said nothing") {
      throw new Error(`the forged anchor did not produce gate silence: ${JSON.stringify(result)}`);
    }
    console.log("✓ forged roll anchor met gate silence (the signer sits outside the opened seats)");
  });
} finally {
  seed.fill(0);
}
