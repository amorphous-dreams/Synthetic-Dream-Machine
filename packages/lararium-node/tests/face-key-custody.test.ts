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
 *   K7  TAMPER PROBE. Under a holder that kept a RETIRED key both doors refuse `key-fails` and both stores land
 *       nothing; a stranger key handed to the sealed writer refuses `TreeVkRefusal`; no byte moves.
 *                                                  control: a holder over the new key signs under both rows
 *   K8  the carrier table names both rows as the library names them: `face-proof-key` cold and of ONE face,
 *       `vessel-face-key` hot and of the vessel; and the table's shapes match `FACE_PROOF_CUSTODY_ROWS`.
 */
import { createPrivateKey, createPublicKey, verify } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mintVk, readVkCarrier, writeSealedCarrier, TreeVkRefusal } from "@lararium/mesh";
import { FACE_PROOF_CUSTODY_ROWS } from "../../lararium-mesh/src/face-authority.js";
import {
  faceProofKeyFile, vesselFaceKeyFile, storeFaceProofKey, storeVesselFaceKey, nodeFaceKeyCustody, nodeVesselFaceKeyCustody,
} from "../src/face-key-custody.js";
import { CustodyLocked, CustodyRowUnavailable, makeCustodyHolder } from "../src/custody-holder.js";
import { seatCustody } from "../src/custody-seat.js";
import { rotateCustody } from "../src/custody-session.js";
import { carrierTable, vkSlotsPath } from "../src/vault-carriers.js";
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
const at = (file: string): string => join(c.homes.identity, file);
beforeEach(async () => { c = await seatScratchCustody("face-key"); });
afterEach(async () => { await c.drop(); });

describe("the face proof's custody rows and signing doors", () => {
  test("K1 — the face proof key rests sealed and cold; the door signs exactly the image", async () => {
    await storeFaceProofKey(scope, FACE_SECRET, 2);
    const file = faceProofKeyFile(scope, 2);
    expect(file).toMatch(/^face-proof-key-h2-[0-9a-f]{32}\.bin$/);
    const rest = readFileSync(at(file));
    expect(readVkCarrier(rest)).toBe("sealed");
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
    await storeVesselFaceKey(scope, VESSEL_SECRET);
    const file = vesselFaceKeyFile(scope);
    expect(file).toMatch(/^vessel-face-key-[0-9a-f]{32}\.bin$/);
    expect(readVkCarrier(readFileSync(at(file)))).toBe("sealed");
    expect(readFileSync(at(file)).includes(Buffer.from(VESSEL_SECRET))).toBe(false);
    const signature = await nodeVesselFaceKeyCustody.signAsVesselFace(scope, vesselFaceKey, IMAGE);
    expect(verifies(vesselFaceKey, IMAGE, signature)).toBe(true);
    await expect(nodeVesselFaceKeyCustody.signAsVesselFace(scope, publicOf(secretOf(9)), IMAGE)).rejects.toThrow(/reads names-another-key/);
  });

  test("K3 — a scope no row holds refuses absent at both doors", async () => {
    await expect(nodeFaceKeyCustody.signAsFace(scope, IMAGE)).rejects.toThrow(/reads absent/);
    await expect(nodeVesselFaceKeyCustody.signAsVesselFace(scope, vesselFaceKey, IMAGE)).rejects.toThrow(/reads absent/);
    expect(readdirSync(c.homes.identity).filter((f) => /face-key/.test(f))).toEqual([]);
  });

  test("K4 — a store never lands over a different standing key; the same key again changes nothing", async () => {
    await storeFaceProofKey(scope, FACE_SECRET, 0);
    await storeVesselFaceKey(scope, VESSEL_SECRET);
    const standing = [faceProofKeyFile(scope, 0), vesselFaceKeyFile(scope)].map((f) => readFileSync(at(f)));
    await storeFaceProofKey(scope, FACE_SECRET, 0);
    await storeVesselFaceKey(scope, VESSEL_SECRET);
    await expect(storeVesselFaceKey(scope, secretOf(55))).rejects.toThrow(/reads names-another-key/);
    [faceProofKeyFile(scope, 0), vesselFaceKeyFile(scope)].forEach((f, i) => expect(readFileSync(at(f)).equals(standing[i]!), f).toBe(true));
    // a face proof key that does not answer the scope's own face key never lands
    const other = { faceKey: publicOf(secretOf(77)), nexus: scope.nexus };
    await expect(storeFaceProofKey(other, FACE_SECRET, 0)).rejects.toThrow(/names-another-key/);
    expect(existsSync(at(faceProofKeyFile(other, 0)))).toBe(false);
    // one face key at one Nexus rests under ONE face: a second face's store of the same scope refuses
    await expect(storeFaceProofKey(scope, FACE_SECRET, 1)).rejects.toThrow(/stands under another face/);
    await expect(storeFaceProofKey(scope, new Uint8Array(31), 0)).rejects.toThrow(/32 secret bytes/);
  });

  test("K5 — a row that stands and does not open, or opens to another length, refuses by name", async () => {
    await storeFaceProofKey(scope, FACE_SECRET, 0);
    await storeVesselFaceKey(scope, VESSEL_SECRET);
    const doors: Array<[string, () => Promise<unknown>]> = [
      [faceProofKeyFile(scope, 0), () => nodeFaceKeyCustody.signAsFace(scope, IMAGE)],
      [vesselFaceKeyFile(scope), () => nodeVesselFaceKeyCustody.signAsVesselFace(scope, vesselFaceKey, IMAGE)],
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
    await storeVesselFaceKey(scope, VESSEL_SECRET);
    const files = [faceProofKeyFile(scope, 0), vesselFaceKeyFile(scope)];
    const standing = files.map((f) => readFileSync(at(f)));
    await c.holder.lock();
    await expect(nodeFaceKeyCustody.signAsFace(scope, IMAGE)).rejects.toThrow(CustodyLocked);
    await expect(nodeVesselFaceKeyCustody.signAsVesselFace(scope, vesselFaceKey, IMAGE)).rejects.toThrow(CustodyLocked);
    await expect(storeFaceProofKey(scope, FACE_SECRET, 0)).rejects.toThrow(CustodyLocked);
    await expect(storeVesselFaceKey(scope, VESSEL_SECRET)).rejects.toThrow(CustodyLocked);
    files.forEach((f, i) => expect(readFileSync(at(f)).equals(standing[i]!)).toBe(true));
  });

  test("K7 — TAMPER PROBE: a retired key and a stranger key land nothing; the standing rows sign under the tree's key", async () => {
    await storeFaceProofKey(scope, FACE_SECRET, 0);
    await storeVesselFaceKey(scope, VESSEL_SECRET);
    const files = [faceProofKeyFile(scope, 0), vesselFaceKeyFile(scope)];
    const rotated = await rotateCustody({ io: c.io, homes: c.homes, oldVk: c.vk, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }] }] });
    const standing = files.map((f) => readFileSync(at(f)));
    await expect(nodeFaceKeyCustody.signAsFace(scope, IMAGE)).rejects.toThrow(/reads key-fails/);
    await expect(nodeVesselFaceKeyCustody.signAsVesselFace(scope, vesselFaceKey, IMAGE)).rejects.toThrow(/reads key-fails/);
    await expect(storeFaceProofKey(scope, FACE_SECRET, 0)).rejects.toThrow(/key-fails/);
    await expect(storeVesselFaceKey(scope, VESSEL_SECRET)).rejects.toThrow(/key-fails/);
    const keyB = mintVk();
    for (const f of files) {
      await expect(writeSealedCarrier({
        io: c.io, vk: keyB, treePath: vkSlotsPath(c.homes.identity),
        carrier: { name: `identity/${f}`, path: at(f), keyClass: "seed" }, plaintext: secretOf(200),
      })).rejects.toThrow(TreeVkRefusal);
    }
    files.forEach((f, i) => {
      expect(readFileSync(at(f)).equals(standing[i]!), `${f} never moved`).toBe(true);
      expect(existsSync(`${at(f)}.vk-sealing`)).toBe(false);
    });
    const fresh = makeCustodyHolder({ io: c.io, homes: c.homes });
    await fresh.adopt(rotated.vk);
    seatCustody(fresh);
    expect(verifies(scope.faceKey, IMAGE, await nodeFaceKeyCustody.signAsFace(scope, IMAGE))).toBe(true);
    expect(verifies(vesselFaceKey, IMAGE, await nodeVesselFaceKeyCustody.signAsVesselFace(scope, vesselFaceKey, IMAGE))).toBe(true);
    await fresh.lock();
    seatCustody(c.holder);
  });

  test("K8 — the carrier table names both rows as the library names them", () => {
    const rowOf = (file: string) => carrierTable().find((r) => r.home === "identity" && r.match.test(file));
    const face = rowOf(faceProofKeyFile(scope, 4))!;
    const vessel = rowOf(vesselFaceKeyFile(scope))!;
    expect([face.row, face.custody, face.keyClass]).toEqual(["face-proof-key", "cold", "seed"]);
    expect(face.face(face.match.exec(faceProofKeyFile(scope, 4))!)).toBe(4);
    expect([vessel.row, vessel.custody, vessel.keyClass]).toEqual(["vessel-face-key", "hot", "device-minted"]);
    expect(vessel.face(vessel.match.exec(vesselFaceKeyFile(scope))!)).toBe("vessel");
    expect(FACE_PROOF_CUSTODY_ROWS.map((r) => [r.row, r.custody])).toEqual([["face-proof-key", "cold"], ["vessel-face-key", "hot"]]);
  });
});
