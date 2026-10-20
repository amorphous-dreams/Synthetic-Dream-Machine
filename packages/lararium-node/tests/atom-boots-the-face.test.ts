import { cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { CARRIAGE_CARRIER_DOMAIN, FACE_CHECKPOINT_INFO, PLACE_SIGNER_DOMAINS, faceAtomKeyFromSeed, placeSignerFromSeed, readVkCarrier } from "@lararium/mesh";
import { runFoundTheFace } from "../src/commands/init.js";
import { loadFaceAtom } from "../src/face-atom-store.js";
import { loadLeafIdentity } from "../src/leaf-identity.js";
import { loadVesselSigningSeed, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
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
    const seed = (await loadFaceAtom(0))!;
    const atom = faceAtomKeyFromSeed(seed, group);
    const placeKey = await loadVesselVerifyingKey();
    const presenter = await loadLeafIdentity("face", { handleIndex: 0, personaGroupId: group });
    expect(presenter.arm).toBe("face");
    expect(presenter.peerPubKey).toBe(atom.key);
    expect(presenter.peerPubKey).not.toBe(placeKey);
    const floor = placeSignerFromSeed(await loadVesselSigningSeed());
    expect(PLACE_SIGNER_DOMAINS).toContain(CARRIAGE_CARRIER_DOMAIN);
    expect(PLACE_SIGNER_DOMAINS).not.toContain(FACE_CHECKPOINT_INFO);
    await expect(floor.signFloor(FACE_CHECKPOINT_INFO, new TextEncoder().encode(FACE_CHECKPOINT_INFO))).rejects.toThrow(/no floor duty/);
  }, 180_000);

  test("the atom row is VK sealed and a locked custody seat opens none", async () => {
    const row = join(larIdentityDir(), "face-atom-h0.bin");
    expect(readVkCarrier(readFileSync(row))).toBe("sealed");
    const holder = seatedCustody()!;
    await holder.lock();
    await expect(loadFaceAtom(0)).rejects.toThrow(/CustodyLocked|locked|rests unopened/i);
    await holder.unlock([{ kind: "passphrase", passphrase: "test-founding-passphrase" }]);
  });

  test("a worn face with no atom refuses by name; the row present opens", async () => {
    const row = join(larIdentityDir(), "face-atom-h0.bin");
    expect(await loadLeafIdentity("face", { handleIndex: 0, personaGroupId: group })).toMatchObject({ arm: "face" });
    unlinkSync(row);
    await expect(loadLeafIdentity("face", { handleIndex: 0, personaGroupId: group })).rejects.toThrow("this face holds no atom; re-found or re-admit it");
  }, 180_000);
});
