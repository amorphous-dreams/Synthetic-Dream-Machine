/** The boot sweep retires a duplicate ask only after committed anchors name its digest. */
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test, vi } from "vitest";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { runFoundTheFace } from "../src/commands/init.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { seatedCustody, unseatCustody, readCustodyRow, writeCustodyRow } from "../src/custody-seat.js";
import { hearthAid } from "../src/hearth-aid.js";
import { pendingFoundingFile, loadPendingFoundingSeed, sweepFoundingSeeds, faceAtomGroupFile, type FoundingAtomAsk } from "../src/face-atom-store.js";
import { larDataDir, larIdentityDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { foundDirect, seatSeedCharter } from "./found-route.js";

const foundFace = direct(runFoundTheFace);
const roots: string[] = [];
afterAll(async () => { for (const root of roots) { await withLarRoot(root, async () => { const holder = seatedCustody(); if (holder) { await holder.lock(); unseatCustody(holder); } }); rmSync(root, { recursive: true, force: true }); } });

async function rig() {
  const root = mkdtempSync(join(tmpdir(), "lar-seed-sweep-")); roots.push(root);
  return withLarRoot(root, async () => {
    const genesisDir = join(root, "genesis"); cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), genesisDir, { recursive: true });
    await foundDirect({ storageDir: larDataDir(), genesisDir }); await seatSeedCharter();
    const hearthTrueName = hearthAid(); if (!hearthTrueName) throw new Error("no charter hearth");
    const ask: FoundingAtomAsk = { hearthTrueName, bindingMode: "self-stood", personaKelPrefix: null, mount: true, handleIndex: 0 };
    return { root, genesisDir, ask };
  });
}

describe("the founding seed sweep", () => {
  test("equal seed bytes in another group's row do not retire an unrelated ask digest", async () => {
    const { root, genesisDir, ask } = await rig();
    await withLarRoot(root, async () => {
      const face = await foundFace({ storageDir: larDataDir(), genesisDir });
      const groupSeed = await readCustodyRow("identity", faceAtomGroupFile(face.personaGroupId));
      expect(groupSeed, "control: the related group holds its founding seed").toHaveLength(32);
      const unrelated = { ...ask, handleIndex: 1 };
      expect(pendingFoundingFile(unrelated)).not.toBe(pendingFoundingFile(ask));
      await writeCustodyRow("identity", pendingFoundingFile(unrelated), groupSeed!);
      await sweepFoundingSeeds();
      expect(await loadPendingFoundingSeed(unrelated), "a matching seed cannot retire an ask with another digest").toEqual(groupSeed);
      expect(await readCustodyRow("identity", faceAtomGroupFile(face.personaGroupId)), "control: the anchored group keeps its seed").toEqual(groupSeed);
    });
  }, 180_000);
  test("a crash at the move seam keeps the ask until anchors name it, then sweep retires it", async () => {
    const { root, genesisDir, ask } = await rig();
    await withLarRoot(root, async () => {
      const original = FsCustodyIo.prototype.remove;
      let crashed = false;
      const fault = vi.spyOn(FsCustodyIo.prototype, "remove").mockImplementation(async function (path) {
        if (!crashed && path.endsWith(pendingFoundingFile(ask))) { crashed = true; throw new Error("move seam crash"); }
        return original.call(this, path);
      });
      try { await expect(foundFace({ storageDir: larDataDir(), genesisDir })).rejects.toThrow("move seam crash"); }
      finally { fault.mockRestore(); }
      expect(crashed, "the fault struck the ask removal after the group write").toBe(true);
      const names = () => readdirSync(larIdentityDir()).filter((name) => name === pendingFoundingFile(ask) || /^face-atom-g[0-9a-f]{64}\.bin$/.test(name)).sort();
      expect(names(), "the interrupted move exposes both sealed rows").toHaveLength(2);
      const [groupFile] = names().filter((name) => name.startsWith("face-atom-g"));
      expect(await readCustodyRow("identity", groupFile!)).toEqual(await loadPendingFoundingSeed(ask));
      await sweepFoundingSeeds();
      expect(names(), "without committed anchors the ask still names the pending founding").toHaveLength(2);
      const face = await foundFace({ storageDir: larDataDir(), genesisDir });
      expect(faceAtomGroupFile(face.personaGroupId)).toBe(groupFile);
      // Recreate the residue after the resumed founding retires it; the anchored relation now permits sweep.
      await writeCustodyRow("identity", pendingFoundingFile(ask), (await readCustodyRow("identity", groupFile!))!);
      await sweepFoundingSeeds();
      expect(names(), "one group row keeps the seed").toEqual([groupFile]);
      const bytes = readFileSync(join(larIdentityDir(), groupFile!));
      await sweepFoundingSeeds();
      expect(names()).toEqual([groupFile]);
      expect(readFileSync(join(larIdentityDir(), groupFile!))).toEqual(bytes);
      const boot = readFileSync(join(import.meta.dirname, "..", "src", "open-node-vessel.ts"), "utf8");
      expect(boot, "node boot invokes the founding sweep").toMatch(/sweepFoundingSeeds\s*\(/);
    });
  }, 180_000);
});
