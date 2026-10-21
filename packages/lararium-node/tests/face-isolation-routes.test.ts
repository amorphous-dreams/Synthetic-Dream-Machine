/**
 * K15's isolation red at the node's routes (Wave B, R2): unlock face A alone, go around every router, session and
 * UI, and try to open and replace face B's occupied atom row with every key A holds.
 *
 * What stands now MEASURES ROUTING: the face-atom door refuses a different seed over B's row, leaves B's bytes
 * unchanged, and every accessor A wears resolves A's atom and never B's. What it CANNOT measure yet is the key
 * class: today every hot row seals under the one vessel key, so the key that unlocks A opens B's row. Those two
 * readings stand as expected failures that name their cure, `K15` step 6 (each face's custody rows seal under its own
 * face custody key). The day step 6 lands they turn green and the `test.fails` marks come off.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { FaceAtomConflict, mintFaceAtomSeed } from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { readCustodyRow, seatedCustody, unseatCustody, writeCustodyRow } from "../src/custody-seat.js";
import { faceAtomGroupFile, keepFaceAtom, loadFaceAtom, loadFaceAtomOfGroup } from "../src/face-atom-store.js";
import { larIdentityDir } from "../src/vessel-paths.js";
import { sealTestCustody } from "./found-route.js";
import { atomKeyOf, atomSeedOf, seedFaceAtom } from "./atom-fixture.js";

const root = mkdtempSync(join(tmpdir(), "lar-face-isolation-"));
const GROUP_A = "group-isolation-a";
const GROUP_B = "group-isolation-b";

afterAll(async () => {
  await withLarRoot(root, async () => {
    const holder = seatedCustody();
    if (holder) { await holder.lock(); unseatCustody(holder); }
  });
  rmSync(root, { recursive: true, force: true });
});

/** A vessel that holds A at h0 and B at h1, both atoms resting under the one vessel key. */
async function twoFaces(act: (b: { rowB: string; bytesB: Buffer; seedB: Uint8Array }) => Promise<void>): Promise<void> {
  await withLarRoot(root, async () => {
    await sealTestCustody();
    await seedFaceAtom(0, GROUP_A);
    await seedFaceAtom(1, GROUP_B);
    const rowB = join(larIdentityDir(), faceAtomGroupFile(GROUP_B));
    await act({ rowB, bytesB: readFileSync(rowB), seedB: await atomSeedOf(1) });
  });
}

describe("face isolation at the node's routes", () => {
  test("ROUTING: B's atom row refuses another seed and keeps its bytes; the accessors A wears resolve A alone", async () => {
    await twoFaces(async ({ rowB, bytesB, seedB }) => {
      await expect(keepFaceAtom(GROUP_B, mintFaceAtomSeed())).rejects.toBeInstanceOf(FaceAtomConflict);
      expect(readFileSync(rowB)).toEqual(bytesB);
      expect(await keepFaceAtom(GROUP_B, Uint8Array.from(seedB))).toBe("kept");
      // CONTROL: B's own door opens B, and A's index reads A's atom, which differs from B's.
      expect(await loadFaceAtomOfGroup(GROUP_B)).toEqual(seedB);
      expect(await atomKeyOf(0)).not.toBe(await atomKeyOf(1));
      expect(await loadFaceAtom(0)).not.toEqual(seedB);
    });
  });

  test.fails("K15.6 owes: the key that unlocks A refuses to open B's atom row (every hot row seals under one vessel key today)", async () => {
    await twoFaces(async () => {
      await expect(readCustodyRow("identity", faceAtomGroupFile(GROUP_B))).rejects.toBeDefined();
    });
  });

  test.fails("K15.6 owes: the key that unlocks A refuses to replace B's atom row around the face-atom door", async () => {
    await twoFaces(async ({ rowB, bytesB }) => {
      await expect(writeCustodyRow("identity", faceAtomGroupFile(GROUP_B), mintFaceAtomSeed())).rejects.toBeDefined();
      expect(readFileSync(rowB)).toEqual(bytesB);
    });
  });
});
