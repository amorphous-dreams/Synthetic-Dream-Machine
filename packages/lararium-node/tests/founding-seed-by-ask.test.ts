import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { runFoundTheFace } from "../src/commands/init.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { hearthAid } from "../src/hearth-aid.js";
import {
  faceAtomGroupFile, loadFaceAtomOfGroup, loadPendingFoundingSeed,
  pendingFoundingFile, standPendingFoundingSeed, type FoundingAtomAsk,
} from "../src/face-atom-store.js";
import { larDataDir, larIdentityDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { foundDirect, seatSeedCharter } from "./found-route.js";

const root = mkdtempSync(join(tmpdir(), "lar-founding-ask-"));
const genesisDir = join(root, "genesis");
const foundFace = direct(runFoundTheFace);

afterAll(async () => {
  await withLarRoot(root, async () => {
    const holder = seatedCustody();
    if (holder) { await holder.lock(); unseatCustody(holder); }
  });
  rmSync(root, { recursive: true, force: true });
});

describe("a founding seed follows its ask", () => {
  test("a stopped act resumes; another compartment cannot read it; completion leaves only the group row", async () => {
    await withLarRoot(root, async () => {
      cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), genesisDir, { recursive: true });
      await foundDirect({ storageDir: larDataDir(), genesisDir });
      await seatSeedCharter();
      const hearthTrueName = hearthAid();
      if (!hearthTrueName) throw new Error("the test charter names no hearth");
      const ask: FoundingAtomAsk = {
        hearthTrueName, bindingMode: "self-stood", personaKelPrefix: null,
        mount: true, handleIndex: 0,
      };
      // The first act stops after sealing the seed and before a group exists.
      const stopped = await standPendingFoundingSeed(ask);
      const otherAsk = { ...ask, handleIndex: 1, mount: false };
      expect(await loadPendingFoundingSeed(otherAsk)).toBeNull();
      expect(pendingFoundingFile(otherAsk)).not.toBe(pendingFoundingFile(ask));
      const resumed = await standPendingFoundingSeed(ask);
      expect(resumed).toEqual(stopped);
      const founded = await foundFace({ storageDir: larDataDir(), genesisDir });
      expect(founded.alreadyStood).toBe(false);
      expect(existsSync(join(larIdentityDir(), pendingFoundingFile(ask)))).toBe(false);
      expect(existsSync(join(larIdentityDir(), faceAtomGroupFile(founded.personaGroupId)))).toBe(true);
      expect(await loadFaceAtomOfGroup(founded.personaGroupId)).toEqual(stopped);
      stopped.fill(0); resumed.fill(0);
    });
  }, 180_000);
});
