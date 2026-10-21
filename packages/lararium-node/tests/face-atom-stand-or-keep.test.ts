import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { FaceAtomConflict, mintFaceAtomSeed } from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { faceAtomGroupFile, keepFaceAtom, loadFaceAtomOfGroup } from "../src/face-atom-store.js";
import { larIdentityDir } from "../src/vessel-paths.js";
import { sealTestCustody } from "./found-route.js";

const root = mkdtempSync(join(tmpdir(), "lar-face-atom-keep-"));

afterAll(async () => {
  await withLarRoot(root, async () => {
    const holder = seatedCustody();
    if (holder) { await holder.lock(); unseatCustody(holder); }
  });
  rmSync(root, { recursive: true, force: true });
});

describe("the node keeps an atom row once", () => {
  test("the same seed keeps the row; another seed refuses and leaves the first one", async () => {
    await withLarRoot(root, async () => {
      await sealTestCustody();
      const seedX = mintFaceAtomSeed();
      const seedY = mintFaceAtomSeed();
      try {
        expect(await keepFaceAtom("group-test", seedX)).toBe("minted");
        const row = join(larIdentityDir(), faceAtomGroupFile("group-test"));
        const first = readFileSync(row);
        expect(await keepFaceAtom("group-test", Uint8Array.from(seedX))).toBe("kept");
        expect(readFileSync(row)).toEqual(first);
        expect(await loadFaceAtomOfGroup("group-test")).toEqual(seedX);

        await expect(keepFaceAtom("group-test", seedY)).rejects.toBeInstanceOf(FaceAtomConflict);
        expect(readFileSync(row)).toEqual(first);
        expect(await loadFaceAtomOfGroup("group-test")).toEqual(seedX);
      } finally { seedX.fill(0); seedY.fill(0); }
    });
  });
});
