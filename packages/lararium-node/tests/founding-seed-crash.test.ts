/** A stopped founding must hand its atom from the ask to its group in one observable act. */
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test, vi } from "vitest";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";

const fault = vi.hoisted(() => ({ throwAfterGroup: false }));
vi.mock("../src/identity-anchors.js", async (importActual) => {
  const actual = await importActual<typeof import("../src/identity-anchors.js")>();
  return {
    ...actual,
    persistVeilArchive: async (...args: Parameters<typeof actual.persistVeilArchive>) => {
      if (fault.throwAfterGroup) {
        fault.throwAfterGroup = false;
        throw new Error("planted after the group row");
      }
      return actual.persistVeilArchive(...args);
    },
  };
});

import { runFoundTheFace } from "../src/commands/init.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { hearthAid } from "../src/hearth-aid.js";
import { faceAtomGroupFile, loadFaceAtomOfGroup, loadPendingFoundingSeed, pendingFoundingFile, type FoundingAtomAsk } from "../src/face-atom-store.js";
import { larDataDir, larIdentityDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { foundDirect, seatSeedCharter } from "./found-route.js";

const foundFace = direct(runFoundTheFace);
const roots: string[] = [];
const genesisSource = join(import.meta.dirname, "..", "..", "..", "genesis");
const liveRows = (ask: FoundingAtomAsk, group: string) => {
  const files = new Set(readdirSync(larIdentityDir()));
  return Number(files.has(pendingFoundingFile(ask))) + Number(files.has(faceAtomGroupFile(group)));
};

async function rig() {
  const root = mkdtempSync(join(tmpdir(), "lar-atom-crash-"));
  roots.push(root);
  return withLarRoot(root, async () => {
    const genesisDir = join(root, "genesis");
    cpSync(genesisSource, genesisDir, { recursive: true });
    await foundDirect({ storageDir: larDataDir(), genesisDir });
    await seatSeedCharter();
    const hearthTrueName = hearthAid();
    if (!hearthTrueName) throw new Error("the charter names no hearth");
    return { root, genesisDir, ask: { hearthTrueName, bindingMode: "self-stood", personaKelPrefix: null, mount: true, handleIndex: 0 } as FoundingAtomAsk };
  });
}

afterAll(async () => {
  for (const root of roots) {
    await withLarRoot(root, async () => {
      const holder = seatedCustody();
      if (holder) { await holder.lock(); unseatCustody(holder); }
    });
    rmSync(root, { recursive: true, force: true });
  }
});

describe("the founding seed moves in one act", () => {
  test("a crash after the group write leaves one live seed and re-entry keeps it", async () => {
    const { root, genesisDir, ask } = await rig();
    await withLarRoot(root, async () => {
      fault.throwAfterGroup = true;
      await expect(foundFace({ storageDir: larDataDir(), genesisDir })).rejects.toThrow("planted after the group row");
      const groupRows = readdirSync(larIdentityDir()).filter((f) => /^face-atom-g[0-9a-f]{64}\.bin$/.test(f));
      expect(groupRows).toHaveLength(1);
      const askRow = readdirSync(larIdentityDir()).filter((f) => f === pendingFoundingFile(ask));
      const stoppedSeed = await loadPendingFoundingSeed(ask);
      expect(stoppedSeed).toHaveLength(32);
      expect(groupRows.length + askRow.length, "one row holds the seed after the interrupted handoff").toBe(1);
      const resumed = await foundFace({ storageDir: larDataDir(), genesisDir });
      expect(resumed.alreadyStood).toBe(false);
      expect(await loadFaceAtomOfGroup(resumed.personaGroupId)).toEqual(stoppedSeed);
      expect(liveRows(ask, resumed.personaGroupId)).toBe(1);
    });
  }, 180_000);

  test("control: an uninterrupted founding leaves only its group row", async () => {
    const { root, genesisDir, ask } = await rig();
    await withLarRoot(root, async () => {
      const face = await foundFace({ storageDir: larDataDir(), genesisDir });
      expect(liveRows(ask, face.personaGroupId)).toBe(1);
      expect(readdirSync(larIdentityDir())).toContain(faceAtomGroupFile(face.personaGroupId));
    });
  }, 180_000);
});
