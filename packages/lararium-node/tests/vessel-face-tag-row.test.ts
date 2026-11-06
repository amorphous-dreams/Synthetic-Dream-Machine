/**
 * vessel-face-tag-row — a vessel's per-face tag secret rests as a random D row in that face's own custody, never as a
 * child of any seed: a stolen place seed computes no face's tag, so it links none of the vessel's faces.
 *
 * Reds (each read on the lane head that derived the tag secret from the place seed):
 *   T1  the tag a join carries, and the tag a founding rests, match no HKDF child of the place seed; the floor door
 *       derives no tag child under the tag secret's old name.
 *   T2  the carrier table sorts the tag rows D, `face-hot`, device-minted, and `bundle: "stays"`.
 *   T3  a re-join on the same face presents the tag its face row keeps; control: another face presents an unrelated tag
 *       from its own row.
 *   T4  control kept: the re-join's tag equals the first join's, so a face's fold refuses the second admission
 *       (`vessel-already-admitted`).
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { hkdfSync } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  DOMAIN_ROOT, faceAtomKeyFromSeed, fleetJoinOffer, mintFaceAtomSeed, vesselFaceTagFields, type FleetJoinRequest,
} from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { runFleetJoinAbandon, runFleetJoinRequest } from "../src/commands/fleet-join.js";
import { runFoundTheFace } from "../src/commands/init.js";
import { readCustodyRow, seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { generateOrLoadVesselIdentity, vesselFloorKeyDoor } from "../src/node-vessel-identity.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { carrierTable } from "../src/vault-carriers.js";
import { larDataDir, larIdentityDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { faceRowNames, groupRowPath } from "./face-paths.js";
import { foundDirect, sealTestCustody, seatSeedCharter } from "./found-route.js";
import { seatSuiteWard } from "./support/scratch-custody-setup.js";

// The founding's root acts ask the suite's "person", who answers the routes its faces stood under (seat-harness#/the-ward).
seatSuiteWard();

const GROUP_A = "0x" + "a1".repeat(16);
const GROUP_B = "0x" + "b2".repeat(16);
/** The name the tag secret once derived under; the floor door must answer no child for it. */
const OLD_TAG_SECRET_NAME = `${DOMAIN_ROOT}/vessel-face-tag-secret`;
const tagRowOf = (group: string): string => `vessel-face-tag-g${personaGroupDigest(group)}.bin`;
const roots: string[] = [];
const scratch = (label: string): string => { const r = mkdtempSync(join(tmpdir(), `lar-tag-row-${label}-`)); roots.push(r); return r; };

function offerFor(personaGroup: string) {
  const rootSeed = mintFaceAtomSeed();
  const nonce = mintFaceAtomSeed();
  try {
    return fleetJoinOffer({ personaGroup, rootKey: faceAtomKeyFromSeed(rootSeed, personaGroup).key, nonce: Buffer.from(nonce).toString("hex"), scopes: [] });
  } finally { rootSeed.fill(0); nonce.fill(0); }
}

/** The tag a place seed's old HKDF child would mint for (group, atom): what a thief holding the seed computes. */
async function tagFromPlaceSeed(group: string, deviceKey: string): Promise<string> {
  const raw = JSON.parse(readFileSync(join(larIdentityDir(), ".vessel-key.json"), "utf8")) as { signingKey: string };
  const seed = Buffer.from(raw.signingKey, "hex");
  const child = new Uint8Array(hkdfSync("sha256", seed, new Uint8Array(0), OLD_TAG_SECRET_NAME, 32));
  try { return (await vesselFaceTagFields(child, group, deviceKey)).vesselTag; } finally { child.fill(0); seed.fill(0); }
}

async function lockAndUnseat(): Promise<void> {
  const holder = seatedCustody();
  if (holder) { await holder.lock(); unseatCustody(holder); }
}

afterAll(async () => {
  for (const root of roots) {
    await withLarRoot(root, lockAndUnseat);
    rmSync(root, { recursive: true, force: true });
  }
});

describe("the vessel tag secret rests per face", () => {
  test("T2 RED: the carrier table sorts each tag row D, face-hot, device-minted, and it stays on its vessel", () => {
    const rows = carrierTable().filter((r) => r.row === "vessel-face-tag" || r.row === "vessel-face-tag-ask");
    expect(rows.map((r) => r.row).sort()).toEqual(["vessel-face-tag", "vessel-face-tag-ask"]);
    for (const row of rows) {
      expect(row.custody).toBe("face-hot");
      expect(row.keyClass).toBe("device-minted");
      expect(row.target.classes).toEqual(["D"]);
      expect(row.bundle).toBe("stays");
    }
    // CONTROL: the table still names the bundle-carried face row it always did, so the filter reads a live table.
    expect(carrierTable().find((r) => r.row === "face-address-secret")?.bundle).toBe("whole");
  });

  test("T1/T3/T4 RED: a join's tag rests in its face's row, re-presents on a re-join, and no place-seed child computes it", async () => {
    await withLarRoot(scratch("join"), async () => {
      await sealTestCustody();
      await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });

      const first: FleetJoinRequest = await runFleetJoinRequest({ offer: offerFor(GROUP_A) });
      // T1: a thief holding the place seed computes another tag than the one this join carries.
      expect(first.vesselTag).not.toBe(await tagFromPlaceSeed(GROUP_A, first.atomKey));
      // T1: the floor door derives no child under the tag secret's old name.
      await expect((async () => (await vesselFloorKeyDoor()).derive(OLD_TAG_SECRET_NAME))()).rejects.toThrow(/refused domain/);
      // T3: the secret rests in the face's own row, a random 32 bytes.
      const row = await readCustodyRow("identity", tagRowOf(GROUP_A));
      expect(row?.length).toBe(32);
      expect(existsSync(groupRowPath(GROUP_A, tagRowOf(GROUP_A)))).toBe(true);
      expect((await vesselFaceTagFields(row!, GROUP_A, first.atomKey)).vesselTag).toBe(first.vesselTag);
      row!.fill(0);
      expect(await runFleetJoinAbandon()).toBe(true);

      // T3 + T4: the re-join on the same face presents the same tag, so the face's fold refuses its second admission.
      const again = await runFleetJoinRequest({ offer: offerFor(GROUP_A) });
      expect(again.nonce).not.toBe(first.nonce);
      expect(again.vesselTag).toBe(first.vesselTag);
      expect(await runFleetJoinAbandon()).toBe(true);

      // CONTROL: another face presents an unrelated tag from its own row.
      const other = await runFleetJoinRequest({ offer: offerFor(GROUP_B) });
      expect(other.vesselTag).not.toBe(first.vesselTag);
      expect(other.vesselTag).not.toBe(await tagFromPlaceSeed(GROUP_B, other.atomKey));
      expect((await readCustodyRow("identity", tagRowOf(GROUP_B)))?.length).toBe(32);
      expect(await runFleetJoinAbandon()).toBe(true);
    });
  }, 180_000);

  test("T1 RED: a founding rests its face's tag secret in the group's own row, moved off its ask, and no place-seed child computes it", async () => {
    const root = scratch("found");
    await withLarRoot(root, async () => {
      const genesisDir = join(root, "genesis");
      cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), genesisDir, { recursive: true });
      await foundDirect({ storageDir: larDataDir(), genesisDir });
      await seatSeedCharter();
      const founded = await direct(runFoundTheFace)({ storageDir: larDataDir(), genesisDir });
      const group = founded.personaGroupId;
      expect(existsSync(groupRowPath(group, tagRowOf(group)))).toBe(true);
      expect(faceRowNames().filter((name) => name.startsWith("vessel-face-tag-ask-"))).toEqual([]);
      const secret = await readCustodyRow("identity", tagRowOf(group));
      expect(secret?.length).toBe(32);
      const atomKey = "00".repeat(32);
      expect((await vesselFaceTagFields(secret!, group, atomKey)).vesselTag).not.toBe(await tagFromPlaceSeed(group, atomKey));
      secret!.fill(0);
    });
  }, 180_000);
});
