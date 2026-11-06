import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { faceAtomKeyFromSeed, fleetJoinOffer, mintFaceAtomSeed } from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { runFleetJoinAbandon, runFleetJoinRequest } from "../src/commands/fleet-join.js";
import { loadFaceAtomOfGroup } from "../src/face-atom-store.js";
import { generateOrLoadVesselIdentity } from "../src/node-vessel-identity.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { atomSeedOf, seedFaceAtom } from "./atom-fixture.js";
import { sealTestCustody, TEST_PASSPHRASE } from "./found-route.js";
import { wardCredential } from "../src/ward-credential.js";

const GROUP_A = "0x" + "a1".repeat(16);
const GROUP_B = "0x" + "b2".repeat(16);
const root = mkdtempSync(join(tmpdir(), "lar-fleet-cross-face-atom-"));

function offerFor(personaGroup: string) {
  const rootSeed = mintFaceAtomSeed();
  const nonce = mintFaceAtomSeed();
  try {
    return fleetJoinOffer({
      personaGroup,
      rootKey: faceAtomKeyFromSeed(rootSeed, personaGroup).key,
      nonce: Buffer.from(nonce).toString("hex"),
      scopes: [],
    });
  } finally { rootSeed.fill(0); nonce.fill(0); }
}

afterAll(async () => {
  await withLarRoot(root, async () => {
    const holder = seatedCustody();
    if (holder) { await holder.lock(); unseatCustody(holder); }
  });
  rmSync(root, { recursive: true, force: true });
});

describe("a fleet request keeps each face's atom", () => {
  test("an own-group offer carries A's key; a B offer carries a distinct key and leaves A's row", async () => {
    await withLarRoot(root, async () => {
      await sealTestCustody();
      // The joining vessel stands founded; each join's tag rests in its own face's row.
      await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
      const atomA = await seedFaceAtom(0, GROUP_A);
      const seedA = await atomSeedOf(0);

      // Face A stood before the join, so its ward key's pop asks the face's own route for this one act.
      const own = await runFleetJoinRequest({ offer: offerFor(GROUP_A), ward: wardCredential([{ kind: "passphrase", passphrase: TEST_PASSPHRASE }]) });
      expect(own.atomKey).toBe(atomA.key);
      expect(await runFleetJoinAbandon()).toBe(true);

      const other = await runFleetJoinRequest({ offer: offerFor(GROUP_B) });
      expect(other.atomKey).not.toBe(atomA.key);
      expect(await loadFaceAtomOfGroup(GROUP_A)).toEqual(seedA);
      seedA.fill(0);
    });
  });
});
