// Present this reader's opening-epoch carry at relay-2's floor gate twice, through one path:
// once with A's own roll anchor off the reader's board (it must verify), once with that anchor's
// parts signed by a key this probe mints, which the opened quorum never seated (the gate must fall
// silent). The two anchors share one act CID; only the signer differs.
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
// The file holds A's `nexus carry --json` answer; the bundle rides it as `data.carryBundle`, as carry-take reads it.
const answer = JSON.parse(readFileSync(bundlePath, "utf8"));
const bundle = answer?.data?.carryBundle ?? answer?.carryBundle ?? answer;
if (bundle?.kind === undefined || !bundle.contract) throw new Error("the opening file carries no carry bundle");
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
    const board = await open(mesh.carriageDocUrl(reading.island), "board:carriage-contracts");
    const contractCid = mesh.carriageEntryActCid(bundle.contract);
    const real = mesh.rollAnchorsFromBoard(board).find((a) => a.prevEpochCid === old.epochCid &&
      a.sealEpochCid === opened.epochCid && a.parents.includes(contractCid));
    if (!real) throw new Error("the reader's board holds no roll anchor of A's that cites the opening carry");
    const forged = await mesh.signRollAnchor({
      prevEpochCid: real.prevEpochCid, sealEpochCid: real.sealEpochCid,
      prevKeys: real.prevKeys, prevThreshold: real.prevThreshold, parents: real.parents,
    }, [{ signer: stranger, sign: signStranger }]);
    if (mesh.rollAnchorCid(forged) !== mesh.rollAnchorCid(real)) throw new Error("the forged anchor differs from A's in more than its signer");
    if (real.signatures.some((s) => s.signer.toLowerCase() === stranger.toLowerCase())) throw new Error("the probe's key signed A's anchor");
    const armWith = (anchor) => ({ kind: "place", contract: bundle.contract, lineage: [...bundle.lineage, anchor], sealLineage: reading.sealLineage });
    const ancestry = mesh.carriageAncestryFromBoard(reading.sealLineage, board);
    const carriers = await mesh.foldCarrierSet(reading.denyBoard, reading.roster, ancestry);
    const index = mesh.hearthPinIndex();
    mesh.filePlaceFloorPins(index, mesh.placeFloorPinsFromBoard(board), {
      nexusHex: Buffer.from(bundle.aid, "utf8").toString("hex"), route: mesh.FLOW_SOCKET_ROUTE, kelRows: mesh.placeKelRowsFromBoard(board), standing: { via: "carrier", carriers },
    });
    const present = (arm) => mesh.pullAndVerifyFlow(`http://localhost:${process.env.MESH_PORT_RELAY_2 ?? "18093"}`, {
      pins: index, hearth: publisher, nexus: Buffer.from(bundle.aid, "utf8").toString("hex"),
      presentation: { kind: "place", placeKey: own, sign: async (bytes) => mesh.hexToBytes(await signOwn(bytes)), arm },
      audience: mesh.DAEMON_BAG_ID, deadlines: pins.dialDeadlines(), verifyingKey: publisher,
    });
    const twin = await present(armWith(real));
    if (!twin.ok) throw new Error(`the opening carry under A's own roll anchor did not verify at relay-2: ${JSON.stringify(twin)}`);
    console.log(`✓ TWIN: the opening carry under A's roll anchor ${mesh.rollAnchorCid(real).slice(0, 16)}… verified at relay-2's rolled head`);
    const result = await present(armWith(forged));
    if (result.ok || result.reason !== "dial failed: the gate said nothing") {
      throw new Error(`the forged anchor did not produce gate silence: ${JSON.stringify(result)}`);
    }
    console.log("✓ forged roll anchor met gate silence (the same act, signed outside the opened seats)");
  });
} finally {
  seed.fill(0);
}
