/** An uncommitted group's checkpoint answers only the compartment that founded it. */
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test, vi } from "vitest";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";

const fault = vi.hoisted(() => ({ once: false, group: "" }));
vi.mock("../src/identity-anchors.js", async (importActual) => {
  const actual = await importActual<typeof import("../src/identity-anchors.js")>();
  return { ...actual, persistVeilArchive: async (...args: Parameters<typeof actual.persistVeilArchive>) => {
    if (fault.once) { fault.once = false; fault.group = args[1]; throw new Error("planted after h1 group row"); }
    return actual.persistVeilArchive(...args);
  } };
});
import { runFoundTheFace } from "../src/commands/init.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { loadFaceAtomOfGroup } from "../src/face-atom-store.js";
import { larDataDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { foundDirect, seatSeedCharter } from "./found-route.js";

const foundFace = direct(runFoundTheFace);
const roots: string[] = [];
afterAll(async () => { for (const root of roots) { await withLarRoot(root, async () => { const holder = seatedCustody(); if (holder) { await holder.lock(); unseatCustody(holder); } }); rmSync(root, { recursive: true, force: true }); } });

describe("a founding checkpoint stays with its compartment", () => {
  test("h2 cannot recover h1's stopped group; h1 re-enters its own seed", async () => {
    const root = mkdtempSync(join(tmpdir(), "lar-cross-ask-")); roots.push(root);
    await withLarRoot(root, async () => {
      const genesisDir = join(root, "genesis"); cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), genesisDir, { recursive: true });
      await foundDirect({ storageDir: larDataDir(), genesisDir }); await seatSeedCharter();
      await foundFace({ storageDir: larDataDir(), genesisDir, handleIndex: 0 });
      fault.once = true;
      await expect(foundFace({ storageDir: larDataDir(), genesisDir, handleIndex: 1 })).rejects.toThrow("planted after h1 group row");
      const h1Group = fault.group;
      expect(h1Group, "the stopped h1 wrote a group row").toBeTruthy();
      const h1Seed = await loadFaceAtomOfGroup(h1Group);
      expect(h1Seed).toHaveLength(32);
      const h2 = await foundFace({ storageDir: larDataDir(), genesisDir, handleIndex: 2 });
      const h2Seed = await loadFaceAtomOfGroup(h2.personaGroupId);
      expect(h2.personaGroupId, "h2 keeps a different interrupted group's identity out").not.toBe(h1Group);
      expect(h2Seed, "h2 mints its own atom").not.toEqual(h1Seed);
      const h1 = await foundFace({ storageDir: larDataDir(), genesisDir, handleIndex: 1 });
      expect(h1.personaGroupId, "h1 re-enters its checkpoint").toBe(h1Group);
      expect(await loadFaceAtomOfGroup(h1.personaGroupId)).toEqual(h1Seed);
    });
  }, 180_000);
});
