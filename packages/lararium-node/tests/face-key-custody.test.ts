/**
 * face-key-custody — the face proof's two custody rows and their two signing doors.
 *
 *   K1  a stored face proof key rests SEALED and COLD, its file names the face and the scope and carries no key
 *       byte in the clear; `signAsFace` signs exactly the image under that key and hands back 64 bytes that verify
 *       under the scope's own face key.            control: a moved image byte fails the same verify
 *   K2  a stored vessel face key rests SEALED and HOT; `signAsVesselFace` verifies under the vessel face key.
 *                                                  control: asked for another vessel face key it refuses by name
 *   K3  a door asked for a scope no row holds refuses `absent`, and signs nothing.
 *   K4  a store never lands over a standing key that differs (the standing bytes stay), and the same key again
 *       changes nothing. A face proof key whose public half differs from the scope's face key refuses before a write.
 *   K5  a row that stands and does not open (one byte moved, a bare 32 bytes) refuses by name at both doors, and
 *       one that opens to another length refuses `malformed`.
 *   K6  at the floor both doors and both stores refuse `CustodyLocked` and no file moves.
 *   K7  VK rotation leaves both face rows sealed under their own tree; a stranger face key handed to the sealed
 *       writer refuses `TreeVkRefusal` for either row, and no byte moves.
 *                                                  control: a holder over the new VK signs under both rows
 *   K8  the carrier table names both rows as the library names them: `face-proof-key` cold and of ONE face,
 *       `vessel-face-key` hot and of its face; and the table's shapes match `FACE_PROOF_CUSTODY_ROWS`.
 */
import { createPrivateKey, createPublicKey, verify } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mintFck, readFckCarrier, writeFaceCarrier, TreeVkRefusal } from "@lararium/mesh";
import { FACE_PROOF_CUSTODY_ROWS } from "../../lararium-mesh/src/face-authority.js";
import {
  faceProofKeyFile, vesselFaceKeyFile, storeFaceProofKey, storeVesselFaceKey, nodeFaceKeyCustody, nodeVesselFaceKeyCustody,
} from "../src/face-key-custody.js";
import { CustodyLocked, CustodyRowUnavailable, makeCustodyHolder } from "../src/custody-holder.js";
import { seatCustody } from "../src/custody-seat.js";
import { rotateCustody } from "../src/custody-session.js";
import { carrierTable } from "../src/vault-carriers.js";
import { faceTreePath, findFace, readFaceIndexSync } from "../src/face-index.js";
import { faceCarrierFor } from "../src/face-custody.js";
import { handleRowPathIn } from "./face-paths.js";
import { seatScratchCustody, FIXTURE_PASSPHRASE, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });

const publicOf = (secret: Uint8Array): string => {
  const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(secret)]);
  return Buffer.from((createPublicKey(createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" })).export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
};
const verifies = (publicHex: string, image: Uint8Array, signature: Uint8Array): boolean =>
  verify(null, image, createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(publicHex, "hex")]), format: "der", type: "spki" }), signature);
const secretOf = (fill: number): Uint8Array => Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + fill) & 0xff);

const FACE_SECRET = secretOf(3);
const VESSEL_SECRET = secretOf(101);
const scope = { faceKey: publicOf(FACE_SECRET), nexus: "nexus-" + "ab".repeat(32) };
const vesselFaceKey = publicOf(VESSEL_SECRET);
const IMAGE = new TextEncoder().encode("synthetic image the library hands the door");

let c: SeatedScratchCustody;
const at = (file: string): string => handleRowPathIn(c.homes.identity, file);
beforeEach(async () => { c = await seatScratchCustody("face-key"); });
afterEach(async () => { await c.drop(); });

describe("the face proof's custody rows and signing doors", () => {
  test("K1 — the face proof key rests sealed and cold; the door signs exactly the image", async () => {
    await storeFaceProofKey(scope, FACE_SECRET, 2);
    const file = faceProofKeyFile(2, scope.nexus);
    expect(file).toMatch(/^face-proof-key-h2-[0-9a-f]{32}\.bin$/);
    const rest = readFileSync(at(file));
    expect(readFckCarrier(rest)).toBe("sealed");
    expect(rest.includes(Buffer.from(FACE_SECRET))).toBe(false);
    const signature = await nodeFaceKeyCustody.signAsFace(scope, IMAGE);
    expect(signature).toHaveLength(64);
    expect(verifies(scope.faceKey, IMAGE, signature)).toBe(true);
    const moved = Uint8Array.from(IMAGE); moved[0]! ^= 1;
    expect(verifies(scope.faceKey, moved, signature)).toBe(false);
    // cold: a hot read of the row refuses; it opens per act alone
    await expect(c.holder.readRow("identity", file)).rejects.toThrow(/cold rows require openColdRow/);
  });

  test("K2 — the vessel face key rests sealed and hot; the door signs under the key it holds and no other", async () => {
    await storeVesselFaceKey(0, scope, VESSEL_SECRET);
    const file = vesselFaceKeyFile(0, scope);
    expect(file).toMatch(/^vessel-face-key-h0-[0-9a-f]{32}\.bin$/);
    expect(readFckCarrier(readFileSync(at(file)))).toBe("sealed");
    expect(readFileSync(at(file)).includes(Buffer.from(VESSEL_SECRET))).toBe(false);
    const signature = await nodeVesselFaceKeyCustody.signAsVesselFace(scope, vesselFaceKey, IMAGE);
    expect(verifies(vesselFaceKey, IMAGE, signature)).toBe(true);
    await expect(nodeVesselFaceKeyCustody.signAsVesselFace(scope, publicOf(secretOf(9)), IMAGE)).rejects.toThrow(/reads names-another-key/);
  });

  test("K3 — a scope no row holds refuses absent at both doors", async () => {
    await expect(nodeFaceKeyCustody.signAsFace(scope, IMAGE)).rejects.toThrow(/reads absent/);
    await expect(nodeVesselFaceKeyCustody.signAsVesselFace(scope, vesselFaceKey, IMAGE)).rejects.toThrow(/reads absent/);
    expect(readdirSync(c.homes.identity).filter((f) => /face-key/.test(f))).toEqual([]);
    expect(readFaceIndexSync(c.homes.identity).faces).toEqual([]);
  });

  test("K4 — a store never lands over a different standing key; the same key again changes nothing", async () => {
    await storeFaceProofKey(scope, FACE_SECRET, 0);
    await storeVesselFaceKey(0, scope, VESSEL_SECRET);
    const standing = [faceProofKeyFile(0, scope.nexus), vesselFaceKeyFile(0, scope)].map((f) => readFileSync(at(f)));
    await storeFaceProofKey(scope, FACE_SECRET, 0);
    await storeVesselFaceKey(0, scope, VESSEL_SECRET);
    await expect(storeVesselFaceKey(0, scope, secretOf(55))).rejects.toThrow(/reads names-another-key/);
    [faceProofKeyFile(0, scope.nexus), vesselFaceKeyFile(0, scope)].forEach((f, i) => expect(readFileSync(at(f)).equals(standing[i]!), f).toBe(true));
    // a face proof key that does not answer the scope's own face key never lands
    const other = { faceKey: publicOf(secretOf(77)), nexus: "nexus-" + "cd".repeat(32) };
    await expect(storeFaceProofKey(other, FACE_SECRET, 0)).rejects.toThrow(/names-another-key/);
    expect(existsSync(at(faceProofKeyFile(0, other.nexus)))).toBe(false);
    // one face holds ONE key at one Nexus: a second key for the same face and Nexus refuses, the standing bytes untouched
    const second = { faceKey: publicOf(secretOf(78)), nexus: scope.nexus };
    await expect(storeFaceProofKey(second, secretOf(78), 0)).rejects.toThrow(/names-another-key/);
    expect(readFileSync(at(faceProofKeyFile(0, scope.nexus))).equals(standing[0]!)).toBe(true);
    await expect(storeFaceProofKey(scope, new Uint8Array(31), 0)).rejects.toThrow(/32 secret bytes/);
  });

  test("K5 — a row that stands and does not open, or opens to another length, refuses by name", async () => {
    await storeFaceProofKey(scope, FACE_SECRET, 0);
    await storeVesselFaceKey(0, scope, VESSEL_SECRET);
    const doors: Array<[string, () => Promise<unknown>]> = [
      [faceProofKeyFile(0, scope.nexus), () => nodeFaceKeyCustody.signAsFace(scope, IMAGE)],
      [vesselFaceKeyFile(0, scope), () => nodeVesselFaceKeyCustody.signAsVesselFace(scope, vesselFaceKey, IMAGE)],
    ];
    for (const [file, door] of doors) {
      const intact = readFileSync(at(file));
      const moved = Buffer.from(intact); moved[Math.floor(moved.length / 2)]! ^= 1;
      expect(moved.equals(intact)).toBe(false);
      for (const [damaged, reading] of [[moved, /reads (key-fails|torn)/], [Buffer.from(FACE_SECRET), /reads bare/]] as const) {
        writeFileSync(at(file), damaged);
        await expect(door(), file).rejects.toThrow(CustodyRowUnavailable);
        await expect(door(), file).rejects.toThrow(reading);
        expect(readFileSync(at(file)).equals(damaged)).toBe(true);
      }
      writeFileSync(at(file), intact);
      await door();   // control: the intact row signs again
      await c.holder.writeRow("identity", file, new Uint8Array(31));
      await expect(door(), file).rejects.toThrow(/reads malformed/);
    }
  });

  test("K6 — at the floor both doors and both stores refuse CustodyLocked and no file moves", async () => {
    await storeFaceProofKey(scope, FACE_SECRET, 0);
    await storeVesselFaceKey(0, scope, VESSEL_SECRET);
    const files = [faceProofKeyFile(0, scope.nexus), vesselFaceKeyFile(0, scope)];
    const standing = files.map((f) => readFileSync(at(f)));
    await c.holder.lock();
    await expect(nodeFaceKeyCustody.signAsFace(scope, IMAGE)).rejects.toThrow(CustodyLocked);
    await expect(nodeVesselFaceKeyCustody.signAsVesselFace(scope, vesselFaceKey, IMAGE)).rejects.toThrow(CustodyLocked);
    await expect(storeFaceProofKey(scope, FACE_SECRET, 0)).rejects.toThrow(CustodyLocked);
    await expect(storeVesselFaceKey(0, scope, VESSEL_SECRET)).rejects.toThrow(CustodyLocked);
    files.forEach((f, i) => expect(readFileSync(at(f)).equals(standing[i]!)).toBe(true));
  });

  test("K7 — VK rotation leaves both face keys sealed under their own tree; foreign keys move neither row", async () => {
    await storeFaceProofKey(scope, FACE_SECRET, 0);
    await storeVesselFaceKey(0, scope, VESSEL_SECRET);
    const files = [faceProofKeyFile(0, scope.nexus), vesselFaceKeyFile(0, scope)];
    const beforeRotation = files.map((f) => readFileSync(at(f)));
    const rotated = await rotateCustody({ io: c.io, homes: c.homes, oldVk: c.vk, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }] }] });
    const standing = files.map((f) => readFileSync(at(f)));
    files.forEach((f, i) => expect(standing[i]!.equals(beforeRotation[i]!), `VK rotation leaves ${f} byte-identical`).toBe(true));
    expect(verifies(scope.faceKey, IMAGE, await nodeFaceKeyCustody.signAsFace(scope, IMAGE))).toBe(true);
    expect(verifies(vesselFaceKey, IMAGE, await nodeVesselFaceKeyCustody.signAsVesselFace(scope, vesselFaceKey, IMAGE))).toBe(true);
    await storeFaceProofKey(scope, FACE_SECRET, 0);
    await storeVesselFaceKey(0, scope, VESSEL_SECRET);
    const face = findFace(readFaceIndexSync(c.homes.identity), { ordinal: 0 })!;
    for (const [file, row, keyClass] of [[files[0]!, "face-proof-key", "seed"], [files[1]!, "vessel-face-key", "device-minted"]] as const) {
      await expect(writeFaceCarrier({
        io: c.io, key: mintFck(), treePath: faceTreePath(c.homes.identity, face.fcid),
        carrier: faceCarrierFor(c.homes, face.fcid, file, { row, keyClass }), plaintext: secretOf(200),
      })).rejects.toThrow(TreeVkRefusal);
    }
    files.forEach((f, i) => {
      expect(readFileSync(at(f)).equals(standing[i]!), `${f} never moved`).toBe(true);
      expect(existsSync(`${at(f)}.s-sealing`)).toBe(false);
    });
    const fresh = makeCustodyHolder({ io: c.io, homes: c.homes });
    await fresh.adopt(rotated.vk);
    await fresh.unlockFace({ ordinal: 0 }, [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }]);
    seatCustody(fresh);
    expect(verifies(scope.faceKey, IMAGE, await nodeFaceKeyCustody.signAsFace(scope, IMAGE))).toBe(true);
    expect(verifies(vesselFaceKey, IMAGE, await nodeVesselFaceKeyCustody.signAsVesselFace(scope, vesselFaceKey, IMAGE))).toBe(true);
    await fresh.lock();
    seatCustody(c.holder);
  });

  test("K8 — the carrier table names both rows as the library names them", () => {
    const rowOf = (file: string) => carrierTable().find((r) => r.home === "identity" && r.match.test(`faces/${"ab".repeat(16)}/${file}`));
    const face = rowOf(faceProofKeyFile(4, scope.nexus))!;
    const vessel = rowOf(vesselFaceKeyFile(4, scope))!;
    expect([face.row, face.custody, face.keyClass]).toEqual(["face-proof-key", "face-cold", "seed"]);
    expect(face.face(face.match.exec(`faces/${"ab".repeat(16)}/${faceProofKeyFile(4, scope.nexus)}`)!)).toBe(4);
    expect([vessel.row, vessel.custody, vessel.keyClass]).toEqual(["vessel-face-key", "face-hot", "device-minted"]);
    expect(vessel.face(vessel.match.exec(`faces/${"ab".repeat(16)}/${vesselFaceKeyFile(4, scope)}`)!)).toBe(4);
    expect(FACE_PROOF_CUSTODY_ROWS.map((r) => [r.row, r.custody])).toEqual([["face-proof-key", "cold"], ["vessel-face-key", "hot"]]);
  });
});
