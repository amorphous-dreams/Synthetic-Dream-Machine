/**
 * vessel-face-tag-door — the node vessel's tag door over a staged custody: the tag a join and a founding carry derives
 * from the vessel's own key through the floor key's door, holds for the face and atom it names, differs per face and per
 * vessel, and a request composed over it reads back through the shared reader a hearth reads with.
 *
 * Reds: the door answers fields that hold; two vessels' tags in one face differ (the hearth tells them apart); one
 * vessel's tags in two faces differ. Control: the node's floor child and the mesh's HKDF child (the browser door's
 * derivation) agree on one seed, so a browser and a node vessel tag alike.
 */
import { execFileSync } from "node:child_process";
import { hkdfSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  VESSEL_FACE_TAG_SECRET_DOMAIN, composeFleetJoinRequest, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, fleetJoinOffer, fleetJoinSealPair,
  readFleetJoinRequest, vesselFaceTagFields, vesselFaceTagHolds, vesselFaceTagSecret, type FleetJoinOffer,
} from "@lararium/mesh";
import { FsCustodyIo } from "../src/custody-io.js";
import { makeCustodyHolder } from "../src/custody-holder.js";
import { seatCustody } from "../src/custody-seat.js";
import { generateOrLoadVesselIdentity, vesselFaceTagDoor, vesselFloorKeyDoor } from "../src/node-vessel-identity.js";
import { vesselCustodyHomes } from "../src/vault-carriers.js";

const repoRoot = resolve(new URL(".", import.meta.url).pathname, "../../..");
const STAGED_ROUTE = "test-founding-passphrase";
const FACE_A = "0xa1a1a1a1a1a1a1a1", FACE_B = "0xb2b2b2b2b2b2b2b2";
let priorRoot: string | undefined;
const roots: string[] = [];

/** Stage a vessel root as a harness does, seat its custody, and found its vessel key. */
async function staged(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), "vessel-face-tag-door-"));
  roots.push(root);
  for (const tool of ["test-scratch-marker.mjs", "seed-test-custody.mjs"]) {
    execFileSync("node", [join(repoRoot, "tools", tool), root], { env: { ...process.env, LAR_ROOT: root }, stdio: "pipe" });
  }
  process.env["LAR_ROOT"] = root;
  const homes = vesselCustodyHomes();
  const holder = makeCustodyHolder({ io: new FsCustodyIo(homes), homes });
  const opened = await holder.unlock([{ kind: "passphrase", passphrase: STAGED_ROUTE }]);
  if (opened.reading !== "opens") throw new Error(`the staged custody reads ${opened.reading}`);
  seatCustody(holder);
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
}

const atomOf = async (n: number) => {
  const seed = new Uint8Array(32).fill(n);
  return { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
};
const offerFor = async (group: string): Promise<FleetJoinOffer> =>
  fleetJoinOffer({ personaGroup: group, rootKey: (await atomOf(99)).key, nonce: "ab".repeat(32), scopes: [] });

beforeAll(() => { priorRoot = process.env["LAR_ROOT"]; seatCustody(null); });
afterAll(() => {
  seatCustody(null);
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe("the node vessel's tag door", { timeout: 180_000 }, () => {
  test("RED: the door's fields hold for their face and atom, differ per face and per vessel, and a request composed over it reads through the shared reader", async () => {
    const atom = await atomOf(21);
    await staged();
    const doorA = await vesselFaceTagDoor();
    const inA = await doorA(FACE_A, atom.key), inB = await doorA(FACE_B, atom.key);
    expect(Object.keys(inA).sort()).toEqual(["vesselSig", "vesselTag"]);   // the door answers the tag and its proof, never a secret
    expect(vesselFaceTagHolds(FACE_A, atom.key, inA)).toBe(true);
    expect(vesselFaceTagHolds(FACE_B, atom.key, inA)).toBe(false);
    expect(inA.vesselTag).not.toBe(inB.vesselTag);
    // The floor child under the minted domain is the secret behind the tag.
    const child = (await vesselFloorKeyDoor()).derive(VESSEL_FACE_TAG_SECRET_DOMAIN);
    try { expect((await vesselFaceTagFields(child, FACE_A, atom.key)).vesselTag).toBe(inA.vesselTag); } finally { child.fill(0); }
    // NODE COMPOSES, THE HEARTH READS: the request carries the door's tag and reads back whole.
    const offer = await offerFor(FACE_A);
    const request = await composeFleetJoinRequest({
      offer, atomKey: atom.key, sealKey: fleetJoinSealPair().key, mintFaceKey: async () => { throw new Error("no scope offered"); },
      custody: { signAsVesselFace: async () => { throw new Error("no scope offered"); } }, sign: async (image) => atom.sign(image), vesselTag: doorA,
    });
    if ("refusal" in request) throw new Error(request.refusal);
    expect(readFleetJoinRequest(JSON.parse(JSON.stringify(request)), offer)).toEqual(request);
    expect(request.vesselTag).toBe(inA.vesselTag);
    // ANOTHER VESSEL in the same face carries another tag, so the hearth seats both.
    await staged();
    const otherInA = await (await vesselFaceTagDoor())(FACE_A, atom.key);
    expect(otherInA.vesselTag).not.toBe(inA.vesselTag);
    expect(vesselFaceTagHolds(FACE_A, atom.key, otherInA)).toBe(true);
  });

  test("CONTROL: the node floor child and the mesh HKDF child the browser door derives agree on one seed", () => {
    const seed = new Uint8Array(32).map((_, i) => i * 7 + 3);
    expect(Array.from(vesselFaceTagSecret(seed))).toEqual(Array.from(new Uint8Array(hkdfSync("sha256", seed, new Uint8Array(0), VESSEL_FACE_TAG_SECRET_DOMAIN, 32))));
  });
});
