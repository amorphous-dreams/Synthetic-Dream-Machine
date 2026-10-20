import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { faceAtomKeyFromSeed, fleetJoinOffer, mintFaceAtomSeed } from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { runFleetJoinAbandon, runFleetJoinRequest } from "../src/commands/fleet-join.js";
import { loadFaceAtom } from "../src/face-atom-store.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { atomSeedOf, seedFaceAtom } from "./atom-fixture.js";
import { sealTestCustody } from "./found-route.js";

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
      const atomA = await seedFaceAtom(0, GROUP_A);
      const seedA = await atomSeedOf(0);

      const own = await runFleetJoinRequest({ offer: offerFor(GROUP_A) });
      expect(own.atomKey).toBe(atomA.key);
      expect(await runFleetJoinAbandon()).toBe(true);

      const other = await runFleetJoinRequest({ offer: offerFor(GROUP_B) });
      expect(other.atomKey).not.toBe(atomA.key);
      expect(await loadFaceAtom(0)).toEqual(seedA);
      seedA.fill(0);
    });
  });
});
