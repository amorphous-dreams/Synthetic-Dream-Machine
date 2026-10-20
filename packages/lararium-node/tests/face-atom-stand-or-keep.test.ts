import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { mintFaceAtomSeed } from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { loadFaceAtom, persistFaceAtom } from "../src/face-atom-store.js";
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
        await persistFaceAtom(0, seedX);
        await persistFaceAtom(0, Uint8Array.from(seedX));
        expect(await loadFaceAtom(0)).toEqual(seedX);

        await expect(persistFaceAtom(0, seedY)).rejects.toThrow(/another seed/i);
        expect(await loadFaceAtom(0)).toEqual(seedX);
      } finally { seedX.fill(0); seedY.fill(0); }
    });
  });
});
