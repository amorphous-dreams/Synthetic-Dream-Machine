import { cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { CARRIAGE_CARRIER_DOMAIN, FACE_CHECKPOINT_INFO, PLACE_SIGNER_DOMAINS, faceAtomKeyFromSeed, verifyEd25519, readFckCarrier } from "@lararium/mesh";
import { faceSigningSeat } from "../src/face-signing-seat.js";
import { runFoundTheFace } from "../src/commands/init.js";
import { faceAtomGroupFile, loadFaceAtomOfGroup } from "../src/face-atom-store.js";
import { loadLeafIdentity } from "../src/leaf-identity.js";
import { vesselPlaceSignerDoor, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { groupRowPath } from "./face-paths.js";
import { larIdentityDir, larDataDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { foundDirect, seatSeedCharter } from "./found-route.js";

const foundFace = direct(runFoundTheFace);
const genesis = join(import.meta.dirname, "..", "..", "..", "genesis");
let root: string;
let priorRoot: string | undefined;
let group: string;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "lar-atom-boot-"));
  priorRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
  cpSync(genesis, join(root, "genesis"), { recursive: true });
  await foundDirect({ storageDir: larDataDir(), genesisDir: join(root, "genesis") });
  await seatSeedCharter();
  group = (await foundFace({ genesisDir: join(root, "genesis") })).personaGroupId;
}, 180_000);

afterAll(async () => {
  const holder = seatedCustody();
  if (holder) { await holder.lock(); unseatCustody(holder); }
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
  rmSync(root, { recursive: true, force: true });
});

describe("the atom boots the face", () => {
  test("the face presenter names the atom and the place signer refuses face domains", async () => {
    const seed = (await loadFaceAtomOfGroup(group))!;
    const atom = faceAtomKeyFromSeed(seed, group);
    const placeKey = await loadVesselVerifyingKey();
    const presenter = await loadLeafIdentity({ handleIndex: 0, personaGroupId: group });
    expect(presenter.arm).toBe("face");
    expect(presenter.peerPubKey).toBe(atom.key);
    expect(presenter.peerPubKey).not.toBe(placeKey);
    const floor = await vesselPlaceSignerDoor();
    expect(PLACE_SIGNER_DOMAINS).toContain(CARRIAGE_CARRIER_DOMAIN);
    expect(PLACE_SIGNER_DOMAINS).not.toContain(FACE_CHECKPOINT_INFO);
    await expect(floor.signFloor(FACE_CHECKPOINT_INFO, new TextEncoder().encode(FACE_CHECKPOINT_INFO))).rejects.toThrow(/no floor duty/);
  }, 180_000);

  test("RED: a place-key meme signature cannot verify for the face; CONTROL: the selected atom can", async () => {
    const selected = await faceSigningSeat(0);
    const placeKey = await loadVesselVerifyingKey();
    const image = new TextEncoder().encode("meme-promotion-face-relation");
    const floor = await vesselPlaceSignerDoor();
    await expect(floor.signFloor("meme-promotion-face-relation", image)).rejects.toThrow(/no floor duty/);
    expect(verifyEd25519(await selected.sign(image), image, selected.key)).toBe(true);
  });

  test("the atom row is face-key sealed and a locked custody seat opens none", async () => {
    const row = groupRowPath(group, faceAtomGroupFile(group));
    expect(readFckCarrier(readFileSync(row))).toBe("sealed");
    const holder = seatedCustody()!;
    await holder.lock();
    await expect(loadFaceAtomOfGroup(group)).rejects.toThrow(/CustodyLocked|locked|rests unopened/i);
    await holder.unlock([{ kind: "passphrase", passphrase: "test-founding-passphrase" }]);
    await holder.unlockFaces([{ kind: "passphrase", passphrase: "test-founding-passphrase" }]);
  });

  test("a worn face with no atom refuses by name; the row present opens", async () => {
    const row = groupRowPath(group, faceAtomGroupFile(group));
    expect(await loadLeafIdentity({ handleIndex: 0, personaGroupId: group })).toMatchObject({ arm: "face" });
    unlinkSync(row);
    await expect(loadLeafIdentity({ handleIndex: 0, personaGroupId: group })).rejects.toThrow("this face holds no atom; re-found or re-admit it");
  }, 180_000);
});
